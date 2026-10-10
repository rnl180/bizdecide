import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import {
  answerMessage,
  claimNextMessage,
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
import { ResultSchema } from "@/lib/types";
import { makeDataLink, rememberOrigin } from "@/lib/data-link";
import { bucket } from "@/lib/firebase";

/**
 * BizDecide MCP server.
 *
 * These tools only MOVE data between the BizDecide app and WorkBuddy.
 * They never analyse anything. All classification, analysis, research,
 * verification and decision-making happens inside WorkBuddy and its skills.
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
          "List business owners' service requests waiting to be processed (status 'submitted'), oldest first. Start every run here.",
        inputSchema: z.object({ includeInProgress: z.boolean().optional().describe("Also return requests already 'processing'") }),
      },
      async ({ includeInProgress }) => {
        const statuses = includeInProgress ? (["submitted", "processing"] as const) : (["submitted"] as const);
        const rows = await listRequestsByStatus([...statuses]);
        return json(rows.map(({ id, businessId, businessName, service, status, createdAt }) => ({ id, businessId, businessName, service, status, createdAt })));
      },
    );

    server.registerTool(
      "wait_for_request",
      {
        title: "Wait for the next request",
        description:
          "On-duty mode. Blocks until there is work (or waitSeconds pass), CLAIMS it and returns it. status 'owner_message': an owner asked a follow-up question on their brief page; answer it with reply_to_owner (quick, under 30 seconds). status 'new_request': process the request fully, then submit_results. status 'idle': nothing yet. After each, call wait_for_request again. Never stop the loop unless the user tells you to.",
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
          const [next] = await listRequestsByStatus(["submitted"], 1);
          if (next) {
            await updateRequest(next.id, {
              status: "processing",
              progress: { step: "Picked up by your CFO team", detail: "BizDecide agents on WorkBuddy started working" },
            });
            const { id, businessId, businessName, service, market, createdAt } = next;
            return json({ status: "new_request", request: { id, businessId, businessName, service, market: market ?? "MY", createdAt }, next: "Call get_business_data(businessId), plan, run the agents, then submit_results. Then call wait_for_request again." });
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
          "Report progress to the owner's screen and/or change status. Call it at every major step (e.g. 'Classifying SME category', 'Verifying funding links') so the owner sees the agents working. Set status 'processing' when you start.",
        inputSchema: z.object({
          requestId: z.string(),
          status: z.enum(["processing", "failed"]).optional(),
          step: z.string().optional().describe("Short step label shown to the owner"),
          detail: z.string().optional(),
          error: z.string().optional(),
        }),
      },
      async ({ requestId, status, step, detail, error }) => {
        const r = await getRequest(requestId);
        if (!r) return fail(`Request ${requestId} not found`);
        await updateRequest(requestId, { status, error, progress: step ? { step, detail } : undefined });
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
          question: z.string(),
          context: z.string().optional().describe("Evidence shown under the question, e.g. 'Invoice HN-2231, RM2,400, 14 Sep'"),
          options: z.array(z.string()).min(2).max(5),
          allowOther: z.boolean().default(true),
          defaultOption: z.string().optional(),
          waitSeconds: z.number().int().min(0).max(50).default(45),
        }),
      },
      async ({ requestId, question, context, options, allowOther, defaultOption, waitSeconds }) => {
        const r = await getRequest(requestId);
        if (!r) return fail(`Request ${requestId} not found`);
        const questionId = await createQuestion({ requestId, question, context, options, allowOther, defaultOption });
        await updateRequest(requestId, { status: "waiting_for_user", progress: { step: "Waiting for your answer", detail: question } });

        const deadline = Date.now() + waitSeconds * 1000;
        while (Date.now() < deadline) {
          await sleep(2000);
          const q = await getQuestion(questionId);
          if (q?.status === "answered") {
            await updateRequest(requestId, { status: "processing", progress: { step: "Answer received", detail: q.otherText || q.answer } });
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
        inputSchema: z.object({ questionId: z.string(), giveUp: z.boolean().optional() }),
      },
      async ({ questionId, giveUp }) => {
        const q = await getQuestion(questionId);
        if (!q) return fail(`Question ${questionId} not found`);
        if (q.status === "answered") {
          await updateRequest(q.requestId, { status: "processing", progress: { step: "Answer received", detail: q.otherText || q.answer } });
          return json({ status: "answered", answer: q.answer, otherText: q.otherText ?? null });
        }
        if (giveUp && q.status === "open") {
          await expireQuestion(questionId);
          await updateRequest(q.requestId, {
            status: "processing",
            progress: { step: "No answer yet, continuing", detail: `Assumed: ${q.defaultOption ?? "default"}` },
          });
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
      "submit_results",
      {
        title: "Submit results",
        description:
          "Deliver the final CFO brief to the owner and mark the request completed. Decisions must be concrete actions with money impact in the market's currency (impactRm holds it) and evidence (invoice numbers, supplier names, official programme URLs). Include the verification checks you ran and any assumptions. For 'funding' and 'cfo_brief', add applicationPacks for the top 1-3 programmes the business is eligible or conditional for: a document checklist marked ready/partial/missing against the data we hold, prefilled application answers, suggested amount and purpose, repayment and affordability, next steps and the official URL.",
        inputSchema: z.object({ requestId: z.string(), result: ResultSchema }),
      },
      async ({ requestId, result }) => {
        const r = await getRequest(requestId);
        if (!r) return fail(`Request ${requestId} not found`);
        await saveResult(requestId, result);
        await updateRequest(requestId, { status: "completed", progress: { step: "CFO brief delivered", detail: result.headline } });
        return json({ ok: true, viewAt: `/r/${requestId}` });
      },
    );
  },
  {
    serverInfo: { name: "bizdecide", version: "0.1.0" },
    instructions:
      "BizDecide backend. Use list_pending_requests, then get_business_data, then report progress with update_request, ask the owner with ask_user only when needed, and finish with submit_results. In on-duty mode, wait_for_request also returns owner follow-up questions; answer those with reply_to_owner. These tools move data only; do all analysis yourself with the BizDecide skills.",
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
