import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import {
  createQuestion,
  expireQuestion,
  getBusiness,
  getQuestion,
  getRequest,
  listRequestsByStatus,
  saveResult,
  sleep,
  updateRequest,
} from "@/lib/store";
import { ResultSchema } from "@/lib/types";
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
      "submit_results",
      {
        title: "Submit results",
        description:
          "Deliver the final CFO brief to the owner and mark the request completed. Decisions must be concrete actions with RM impact and evidence (invoice numbers, supplier names, official programme URLs). Include the verification checks you ran and any assumptions.",
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
      "BizDecide backend. Use list_pending_requests, then get_business_data, then report progress with update_request, ask the owner with ask_user only when needed, and finish with submit_results. These tools move data only; do all analysis yourself with the BizDecide skills.",
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
  return mcp(req);
}

export { handler as GET, handler as POST, handler as DELETE };
