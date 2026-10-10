import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import {
  answerMessage,
  claimNextAction,
  claimNextMessage,
  claimNextRequest,
  claimRequest,
  REQUEST_STALE_MS,
  RequestClaimError,
  completeAction,
  getAction,
  createQuestion,
  expireQuestion,
  getBusiness,
  getMessage,
  getQuestion,
  getRequest,
  getResult,
  listMessages,
  listRequestsByStatus,
  saveResult,
  sleep,
  updateRequest,
} from "@/lib/store";
import { LANE_IDS, LANE_STATES } from "@/lib/types";
import { impactKind } from "@/lib/impact";
import { makeDataLink, rememberOrigin } from "@/lib/data-link";
import { bucket } from "@/lib/firebase";
import { ActionCompletionError } from "@/lib/action-completion";
import { sourceRows } from "@/lib/source-rows";
import { DeliveryResultSchema, ResultDeliveryError } from "@/lib/result-delivery";
import { financialImpactChecks } from "@/lib/financial-impact";

/**
 * BizDecide MCP server.
 *
 * WorkBuddy owns planning, analysis, research and decisions. The backend also
 * independently recalculates supported financial effects from uploaded rows.
 */

export const runtime = "nodejs";
export const maxDuration = 120;

const json = (data: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] });
const fail = (message: string) => ({ isError: true, content: [{ type: "text" as const, text: message }] });

const mcp = createMcpHandler(
  (server) => {
    server.registerTool(
      "ping",
      {
        title: "Ping",
        description: "Health check. Confirms WorkBuddy can reach the BizDecide backend.",
        inputSchema: z.object({ name: z.string().optional() }),
      },
      async ({ name }) => json({ ok: true, message: `Hello ${name ?? "WorkBuddy"} from BizDecide`, at: new Date().toISOString() }),
    );

    server.registerTool(
      "list_pending_requests",
      {
        title: "List pending requests",
        description:
          "List business owners' service requests, oldest first. Listing does not claim anything: use claim_request before working, or use wait_for_request for automatic claiming and recovery.",
        inputSchema: z.object({ includeInProgress: z.boolean().optional().describe("Also return processing or waiting requests; claim_request will only take interrupted runs") }),
      },
      async ({ includeInProgress }) => {
        const statuses = includeInProgress ? (["submitted", "processing", "waiting_for_user"] as const) : (["submitted"] as const);
        const rows = await listRequestsByStatus([...statuses]);
        return json(rows.map(({ id, businessId, businessName, service, status, createdAt }) => ({ id, businessId, businessName, service, status, createdAt })));
      },
    );

    server.registerTool(
      "claim_request",
      {
        title: "Claim a selected request",
        description: "After list_pending_requests, atomically claim one request before doing any work. Keep request.claimToken and pass it to update_request, ask_user, get_answer and submit_results. A busy or completed request cannot be claimed; interrupted work can be recovered after ten minutes without progress.",
        inputSchema: z.object({ requestId: z.string() }),
      },
      async ({ requestId }) => {
        const request = await claimRequest(requestId, "BizDecide agents on WorkBuddy started working", REQUEST_STALE_MS);
        return request ? json({ request }) : fail("This request is already owned by another run, completed, or missing.");
      },
    );

    server.registerTool(
      "wait_for_request",
      {
        title: "Wait for the next request",
        description:
          "On-duty mode. Blocks until there is work (or waitSeconds pass), CLAIMS it and returns it. status 'owner_message': an owner asked a follow-up question on their brief page; answer it with reply_to_owner (quick, under 30 seconds). status 'owner_action': the owner tapped Approve on a decision; write the email or document now, save it as a Gmail DRAFT if your Gmail connector is available (never send), then complete_action. status 'new_request': process the request fully, then submit_results. status 'idle': nothing yet. After each, call wait_for_request again. Never stop the loop unless the user tells you to.",
        inputSchema: z.object({ waitSeconds: z.number().int().min(5).max(55).default(45) }),
      },
      async ({ waitSeconds }) => {
        const deadline = Date.now() + waitSeconds * 1000;
        while (Date.now() < deadline) {
          // Owner questions first: they are quick, and the owner is watching the chat.
          const msg = await claimNextMessage();
          if (msg) {
            const [result, thread] = await Promise.all([getResult(msg.requestId), listMessages(msg.requestId)]);
            return json({
              status: "owner_message",
              message: { id: msg.id, requestId: msg.requestId, businessId: msg.businessId, question: msg.question },
              brief: result && {
                headline: result.headline,
                keyNumbers: result.keyNumbers,
                decisions: result.decisions.map(({ priority, title, action, impactRm }) => ({ priority, title, action, impactRm })),
                applicationPacks: (result.applicationPacks ?? []).map(({ programId, programName, verdict, amountRm }) => ({ programId, programName, verdict, amountRm })),
              },
              earlierInThread: thread.filter((m) => m.status === "answered").map((m) => ({ question: m.question, answer: m.answer })),
              next: "Answer from this business's own data (get_data_link + the skill scripts) and the brief above. Then reply_to_owner(messageId, answer, evidence), then call wait_for_request again.",
            });
          }
          // Then approved decisions: the owner tapped Approve and is watching the card.
          const act = await claimNextAction();
          if (act) {
            const [result, business] = await Promise.all([getResult(act.requestId), getBusiness(act.businessId)]);
            const decision = result?.decisions[act.decisionIndex];
            if (!decision || !business) {
              await completeAction(act.id, { status: "failed", error: "The brief or business data is missing" });
              continue;
            }
            const kind = impactKind(decision);
            const p = business.profile;
            const x = (business.profileExtras ?? {}) as Record<string, unknown>;
            const owner = (x.owner ?? {}) as Record<string, unknown>;
            return json({
              status: "owner_action",
              action: { id: act.id, requestId: act.requestId, decisionIndex: act.decisionIndex, writeIn: act.lang === "ms" ? "Bahasa Melayu" : "English" },
              kind, // one_off: get money back · monthly: supplier price / cost · financing: funding application
              decision,
              sourceRows: decision.evidence.filter((e) => e.source).map((e) => {
                const rows = sourceRows(business, e.source!);
                return { source: e.source, rows: rows.slice(0, 50), total: rows.length, truncated: rows.length > 50 };
              }),
              business: {
                name: p.name,
                sector: p.sector,
                state: p.state,
                city: x.city,
                ssmNumber: p.ssmNumber,
                registeredSince: p.registeredSince,
                owner: owner.name,
                goal: p.goal,
              },
              suppliers: (business.suppliers ?? []).map(({ name, contact, category, paymentTerms }) => ({ name, contact, category, paymentTerms })),
              applicationPacks: kind === "financing" ? (result?.applicationPacks ?? []) : undefined,
              next:
                "Carry out this decision for the owner, in action.writeIn. one_off: a short, polite email to the counterparty (supplier, or the bank/QR acquirer) asking for the money back, quoting the invoice numbers, dates, amounts and bank references from decision.evidence. monthly: an email to the supplier asking why the price rose and for the old price, plus one line asking 2 alternative suppliers for a quote. financing: a document (the application pack: why the business qualifies, amount and purpose, prefilled answers, document checklist) and a short cover email to the agency. Use the supplier's email from suppliers[].contact when there is one. Sign as the owner. If your Gmail connector is available, save the email as a Gmail DRAFT (never send). Then complete_action(actionId, summary, channel, email and/or document). Then call wait_for_request again.",
            });
          }
          const next = await claimNextRequest("BizDecide agents on WorkBuddy started working");
          if (next) {
            const { id, businessId, businessName, service, market, createdAt } = next;
            const business = await getBusiness(businessId);
            return json({ status: "new_request", request: { id, businessId, businessName, service, claimToken: next.claimToken, market: market ?? "MY", language: next.language ?? business?.profile.language ?? "en", goal: business?.profile.goal, createdAt }, next: "Keep request.claimToken for update_request, ask_user, get_answer and submit_results. Read get_data_link(businessId), run python3 run_all.py --data <url>, ask_user only if needed, verify the selected evidence, then submit_results. An interrupted request restarts from its own data; never reuse unchecked output from an expired run. Then call wait_for_request again." });
          }
          await sleep(2000);
        }
        return json({ status: "idle", next: "No new requests yet. Call wait_for_request again." });
      },
    );

    server.registerTool(
      "get_data_link",
      {
        title: "Get data link (fast path)",
        description:
          "FAST PATH. Returns a 15-minute signed link to one business's full data (profile, sales, purchases, suppliers, bank, payables). Pass it to the BizDecide skill scripts (financial-analyzer, supplier-price-tracker, sme-classifier) with --data instead of reading the raw rows yourself. Prefer this over get_business_data.",
        inputSchema: z.object({ businessId: z.string() }),
      },
      async ({ businessId }) => {
        const b = await getBusiness(businessId);
        if (!b) return fail(`Business ${businessId} not found`);
        const url = makeDataLink(businessId);
        return json({
          url,
          expiresInSeconds: 900,
          run: [
            `python3 skills/financial-analyzer/scripts/analyze.py --data "${url}"`,
            `python3 skills/supplier-price-tracker/scripts/track.py --data "${url}"`,
            `python3 skills/sme-classifier/scripts/classify.py --data "${url}"`,
          ],
        });
      },
    );

    server.registerTool(
      "get_impact_checks",
      {
        title: "Get independently calculated financial effects",
        description: "Recalculate supported financial effects from the full uploaded data: overpayments, missing QR/card settlement query amounts, and monthly supplier price increases. Before submit_results, copy the selected check's id as impactCheckId, exact impactRm, impactType, and all sources into decision evidence. Keep its assumptions visible. Unsupported effects, including proposed financing amounts, must omit impactRm. The server recalculates again on delivery and rejects mismatches or double counting.",
        inputSchema: z.object({ businessId: z.string() }),
      },
      async ({ businessId }) => {
        const b = await getBusiness(businessId);
        return b ? json({ checks: financialImpactChecks(b) }) : fail(`Business ${businessId} not found`);
      },
    );

    server.registerTool(
      "get_business_data",
      {
        title: "Get business data",
        description:
          "Fetch everything the owner uploaded for one business: profile, monthly sales, purchase lines (with supplier, item, qty, unit price), supplier list and document paths.",
        inputSchema: z.object({ businessId: z.string() }),
      },
      async ({ businessId }) => {
        const b = await getBusiness(businessId);
        if (!b) return fail(`Business ${businessId} not found`);
        // Give WorkBuddy short-lived download links for uploaded documents (receipts, SSM cert).
        const documents = await Promise.all(
          (b.documents ?? []).map(async (path) => {
            try {
              const [url] = await bucket().file(path).getSignedUrl({ action: "read", expires: Date.now() + 60 * 60 * 1000 });
              return { path, url };
            } catch {
              return { path, url: null };
            }
          }),
        );
        return json({ ...b, documents });
      },
    );

    server.registerTool(
      "update_request",
      {
        title: "Update request",
        description:
          "Report progress to the owner's screen and/or change status. Call it at every major step (e.g. 'Classifying SME category', 'Verifying funding links') so the owner sees the agents working. Set status 'processing' when you start. Tag each step with its lane (bookkeeper, reconciliation, procurement, classifier, funding, verifier) and state, and put the RM amount of a money finding in impactRm.",
        inputSchema: z.object({
          requestId: z.string(),
          claimToken: z.string().min(1),
          status: z.enum(["processing", "failed"]).optional(),
          step: z.string().optional().describe("Short step label shown to the owner"),
          detail: z.string().optional(),
          lane: z.enum(LANE_IDS).optional().describe("Which agent lane this step belongs to; the app draws each lane separately"),
          state: z.enum(LANE_STATES).optional().describe("started when a lane begins, step for each finding, done or failed at the end"),
          impactRm: z.number().optional().describe("A money finding reported in this step (e.g. a duplicate payment); feeds the found-money counter"),
          error: z.string().optional(),
        }),
      },
      async ({ requestId, claimToken, status, step, detail, lane, state, impactRm, error }) => {
        const r = await getRequest(requestId);
        if (!r) return fail(`Request ${requestId} not found`);
        await updateRequest(requestId, { status, error, progress: step ? { step, detail, lane, state, impactRm } : undefined }, claimToken);
        return json({ ok: true });
      },
    );

    server.registerTool(
      "ask_user",
      {
        title: "Ask the business owner",
        description:
          "Ask the owner a multiple-choice question in the BizDecide app (they can also type their own answer under 'Other'). Use it only when the data is genuinely ambiguous and the answer changes the result, e.g. an invoice that could be personal or business. Waits up to waitSeconds for the answer. If it times out, it returns status 'pending' and a questionId: either call get_answer later, or continue with defaultOption and record that assumption.",
        inputSchema: z.object({
          requestId: z.string(),
          claimToken: z.string().min(1),
          question: z.string(),
          context: z.string().optional().describe("Evidence shown under the question, e.g. 'Invoice HN-2231, RM2,400, 14 Sep'"),
          options: z.array(z.string()).min(2).max(5),
          allowOther: z.boolean().default(true),
          defaultOption: z.string().optional(),
          waitSeconds: z.number().int().min(0).max(50).default(45),
        }),
      },
      async ({ requestId, claimToken, question, context, options, allowOther, defaultOption, waitSeconds }) => {
        const r = await getRequest(requestId);
        if (!r) return fail(`Request ${requestId} not found`);
        const questionId = await createQuestion({ requestId, question, context, options, allowOther, defaultOption }, claimToken);
        await updateRequest(requestId, { status: "waiting_for_user", progress: { step: "Waiting for your answer", detail: question } }, claimToken);

        const deadline = Date.now() + waitSeconds * 1000;
        while (Date.now() < deadline) {
          await sleep(2000);
          const q = await getQuestion(questionId);
          if (q?.status === "answered") {
            await updateRequest(requestId, { status: "processing", progress: { step: "Answer received", detail: q.otherText || q.answer } }, claimToken);
            return json({ status: "answered", questionId, answer: q.answer, otherText: q.otherText ?? null });
          }
        }
        return json({ status: "pending", questionId, defaultOption: defaultOption ?? null, hint: "Call get_answer(questionId) to check again, or proceed with defaultOption and list it under assumptions." });
      },
    );

    server.registerTool(
      "get_answer",
      {
        title: "Get answer",
        description:
          "Check whether the owner has answered a question from ask_user. Pass giveUp=true to close the question and continue with its default.",
        inputSchema: z.object({ questionId: z.string(), claimToken: z.string().min(1), giveUp: z.boolean().optional() }),
      },
      async ({ questionId, claimToken, giveUp }) => {
        const q = await getQuestion(questionId);
        if (!q) return fail(`Question ${questionId} not found`);
        if (q.status === "answered") {
          await updateRequest(q.requestId, { status: "processing", progress: { step: "Answer received", detail: q.otherText || q.answer } }, claimToken);
          return json({ status: "answered", answer: q.answer, otherText: q.otherText ?? null });
        }
        if (giveUp && q.status === "open") {
          await expireQuestion(questionId, claimToken);
          await updateRequest(q.requestId, {
            status: "processing",
            progress: { step: "No answer yet, continuing", detail: `Assumed: ${q.defaultOption ?? "default"}` },
          }, claimToken);
          return json({ status: "expired", usedDefault: q.defaultOption ?? null });
        }
        return json({ status: q.status });
      },
    );

    server.registerTool(
      "reply_to_owner",
      {
        title: "Reply to the owner",
        description:
          "Answer a follow-up question the owner asked on their brief page (from wait_for_request status 'owner_message'). 2-5 plain sentences in the owner's language, using figures from their own data and brief. Add evidence for each figure (invoice numbers, months, official URLs). Never invent numbers; if the data can't answer it, say what is missing.",
        inputSchema: z.object({
          messageId: z.string(),
          answer: z.string().min(1).max(2000),
          evidence: z
            .array(z.object({ label: z.string(), detail: z.string().optional(), url: z.string().optional() }))
            .max(5)
            .optional(),
        }),
      },
      async ({ messageId, answer, evidence }) => {
        const m = await getMessage(messageId);
        if (!m) return fail(`Message ${messageId} not found`);
        if (m.status === "answered") return fail("This question already has an answer");
        await answerMessage(messageId, answer, evidence);
        return json({ ok: true, next: "Call wait_for_request again." });
      },
    );

    server.registerTool(
      "complete_action",
      {
        title: "Complete an approved action",
        description:
          "Report the result of a decision the owner approved (wait_for_request status 'owner_action'). To finish with status done, attach the actual email {to, subject, body} and/or document {title, sections[]} plus a short summary. Refunds require an email. A summary or links alone will be rejected: repair the output and retry the same action. channel: 'gmail_draft' ONLY if you really saved it as a Gmail draft, 'document' for a pack or letter, else 'note'. Never send emails. If you could not do it, status 'failed' with error.",
        inputSchema: z.object({
          actionId: z.string(),
          status: z.enum(["done", "failed"]).default("done"),
          summary: z.string().min(1).max(300),
          channel: z.enum(["gmail_draft", "document", "note"]).optional(),
          email: z
            .object({
              to: z.string().max(200).optional(),
              cc: z.string().max(200).optional(),
              subject: z.string().min(1).max(200),
              body: z.string().min(1).max(6000),
            })
            .optional(),
          document: z
            .object({
              title: z.string().min(1).max(200),
              sections: z.array(z.object({ heading: z.string().max(200), body: z.string().max(4000) })).min(1).max(12),
            })
            .optional(),
          links: z.array(z.object({ label: z.string().max(100), url: z.string().max(500) })).max(5).optional(),
          error: z.string().max(500).optional(),
        }),
      },
      async ({ actionId, status, summary, channel, email, document, links, error }) => {
        const a = await getAction(actionId);
        if (!a) return fail(`Action ${actionId} not found`);
        if (a.status === "done") return fail("This action is already done");
        try {
          await completeAction(actionId, {
            status,
            summary,
            channel: channel ?? (document ? "document" : "note"),
            email,
            document,
            links,
            error: status === "failed" ? (error ?? summary) : undefined,
          });
        } catch (error) {
          if (error instanceof ActionCompletionError) return fail(error.message);
          throw error;
        }
        return json({ ok: true, next: "Call wait_for_request again." });
      },
    );

    server.registerTool(
      "submit_results",
      {
        title: "Submit results",
        description:
          "Deliver the final CFO brief to the owner and mark the request completed. Each numeric impactRm requires impactCheckId, exact impactRm/impactType and all source evidence from get_impact_checks; delivery independently recalculates and rejects mismatches. Omit impactRm for unsupported estimates or financing. Include the verification checks you ran (status not_checked for what the data can't show) and any assumptions. Give each decision a confidence (high, medium or check). Evidence that cites invoices, bank lines or sale dates carries source {table, keys} copied exactly from the data. Optional extras: numbers (the figures table with formula, source and basis), impactBasis, hoursSavedPerMonth with hoursBasis. For 'funding' and 'cfo_brief', add applicationPacks for the top 1-3 programmes the business is eligible or conditional for: a document checklist marked ready/partial/missing against the data we hold, prefilled application answers, suggested amount and purpose (a proposal, not verified funding), repayment and affordability, next steps and the official URL.",
        inputSchema: z.object({ requestId: z.string(), claimToken: z.string().min(1), result: DeliveryResultSchema }),
      },
      async ({ requestId, claimToken, result }) => {
        try {
          await saveResult(requestId, result, claimToken);
        } catch (error) {
          if (error instanceof ResultDeliveryError || error instanceof RequestClaimError) return fail(error.message);
          throw error;
        }
        return json({ ok: true, viewAt: `/r/${requestId}` });
      },
    );
  },
  {
    serverInfo: { name: "bizdecide", version: "0.1.0" },
    instructions:
      "BizDecide backend. Use wait_for_request, or list_pending_requests followed by claim_request. Keep request.claimToken for update_request, ask_user, get_answer and submit_results. Use get_impact_checks for every numeric decision impact; the server recalculates on delivery. Deliver supported decisions with source evidence and recorded verification checks. In on-duty mode, wait_for_request also returns owner follow-up questions (answer with reply_to_owner) and approved decisions (carry them out, Gmail drafts only, then complete_action). Plan and analyse with the BizDecide skills.",
  },
);

/** Shared-secret bearer auth. WorkBuddy sends: Authorization: Bearer <BIZDECIDE_MCP_KEY> */
async function handler(req: Request) {
  const key = process.env.BIZDECIDE_MCP_KEY;
  if (key) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${key}`) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    }
  }
  rememberOrigin(req);

  // The mcp-handler / MCP SDK requires Accept: application/json, text/event-stream
  // and returns SSE format. Some MCP clients (e.g. WorkBuddy) don't send that
  // Accept header and expect plain JSON. Patch the request to include the header,
  // then convert SSE responses back to JSON so any client can consume them.
  const accept = req.headers.get("accept") || "";
  const needsAcceptPatch = !accept.includes("text/event-stream");

  let requestToForward = req;
  if (needsAcceptPatch) {
    const headers = new Headers(req.headers);
    headers.set("accept", "application/json, text/event-stream");
    requestToForward = new Request(req.url, {
      method: req.method,
      headers,
      body: req.body,
      duplex: "half",
    } as RequestInit);
  }

  const response = await mcp(requestToForward);

  // If the client didn't ask for SSE but got an SSE response, convert to JSON.
  if (needsAcceptPatch && response.headers.get("content-type")?.includes("text/event-stream")) {
    const text = await response.text();
    // Parse SSE: find the last "data:" line and extract the JSON payload.
    let jsonPayload: unknown = null;
    for (const block of text.split(/\r?\n\r?\n/)) {
      const dataLines = block
        .split(/\r?\n/)
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).replace(/^ /, ""))
        .join("\n");
      if (!dataLines) continue;
      try {
        const parsed = JSON.parse(dataLines);
        if (parsed && ("result" in parsed || "error" in parsed)) {
          jsonPayload = parsed;
        }
      } catch {
        // skip non-JSON data
      }
    }
    return new Response(JSON.stringify(jsonPayload), {
      status: response.status,
      headers: { "content-type": "application/json" },
    });
  }

  return response;
}

export { handler as GET, handler as POST, handler as DELETE };
