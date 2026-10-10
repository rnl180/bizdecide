import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { execFile } from "node:child_process";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { z } from "zod";
import { ANALYSIS_PROMPT, CHAT_PROMPT, VERIFIER_PROMPT } from "./claude-prompts";
import { marketPack, money } from "./markets";
import {
  answerMessage,
  claimAction,
  claimMessage,
  claimRequest,
  completeAction,
  createQuestion,
  expireQuestion,
  getBusiness,
  getQuestion,
  getRequest,
  getResult,
  listMessages,
  saveResult,
  sleep,
  updateRequest,
} from "./store";
import { ResultSchema, SERVICE_LABELS, type Result } from "./types";
import { impactKind } from "./impact";

/**
 * BizDecide on the Claude API: the server runs the CFO team itself instead of waiting for WorkBuddy on /api/mcp.
 *
 * - Analysis agent (Claude Opus 5.5): calls five skill lanes in parallel. Each lane runs the same Python scripts
 *   the WorkBuddy skills use, so every number is computed from the owner's data, not guessed. It asks the owner
 *   when it must (the live poll in the app) and drafts the brief.
 * - Verifier agent (Claude Opus 5.5): checks every figure in the draft against the lane outputs and returns the
 *   final Result as structured output.
 * - "Ask your CFO" follow-ups are answered the same way, from the lane outputs and the brief.
 *
 * On when ANTHROPIC_API_KEY is set. Without it, requests wait for WorkBuddy as before.
 */

const MODEL = "claude-opus-5-5";
const EFFORT = "high";
const BETAS = ["server-side-fallback-2026-07-01"]; // fallbacks: "default" re-runs a declined turn on another model
const WB = path.join(process.cwd(), "workbuddy");
const ASK_WAIT_MS = 60_000;
const MAX_QUESTIONS = 2;
const MAX_TURNS = 12;

export const claudeEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY);

// globalThis: Next bundles each route separately, and they must share one client and one in-flight set.
const g = globalThis as unknown as { __bizdecideClaude?: Anthropic; __bizdecideRunning?: Set<string> };
const client = () => (g.__bizdecideClaude ??= new Anthropic());
const running = (g.__bizdecideRunning ??= new Set<string>());

/** Run fn unless the same job is already running in this process. */
function once(key: string, fn: () => Promise<void>) {
  if (running.has(key)) return Promise.resolve();
  running.add(key);
  return fn().finally(() => running.delete(key));
}

// ---------- skill lanes (the BizDecide Python scripts) ----------

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const execFileP = promisify(execFile);

const SCRIPTS = {
  financial: "skills/financial-analyzer/scripts/analyze.py",
  prices: "skills/supplier-price-tracker/scripts/track.py",
  sme: "skills/sme-classifier/scripts/classify.py",
  all: "run_all.py", // the three above plus the funding pre-screen and ranked candidate decisions
} as const;

async function python(script: string, dataFile: string): Promise<Json> {
  try {
    const { stdout } = await execFileP(process.env.PYTHON_BIN || "python3", [path.join(WB, script), "--data", dataFile], {
      cwd: WB,
      timeout: 60_000,
      maxBuffer: 20 * 1024 * 1024,
    });
    return JSON.parse(stdout);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") throw new Error("python3 is not installed on the server; the BizDecide skill scripts need it");
    throw e;
  }
}

type Business = NonNullable<Awaited<ReturnType<typeof getBusiness>>>;
type Workspace = { business: Business; run: (s: keyof typeof SCRIPTS) => Promise<Json>; close: () => Promise<void> };

/** Writes the business's data to a temp file once; each script runs at most once per workspace. */
async function openWorkspace(businessId: string): Promise<Workspace> {
  const business = await getBusiness(businessId);
  if (!business) throw new Error(`Business ${businessId} not found`);
  const { documents: _docs, ...data } = business;
  const dir = await mkdtemp(path.join(os.tmpdir(), "bizdecide-"));
  const file = path.join(dir, "data.json");
  await writeFile(file, JSON.stringify(data));
  const cache = new Map<string, Promise<Json>>();
  const run = (s: keyof typeof SCRIPTS) => {
    if (!cache.has(s)) cache.set(s, python(SCRIPTS[s], file));
    return cache.get(s)!;
  };
  return { business, run, close: () => rm(dir, { recursive: true, force: true }) };
}

type Fmt = (n: number) => string;
interface Lane {
  tool: string;
  agent: string; // matches the TEAM names on the brief page
  description: string;
  run: (ws: Workspace, fmt: Fmt) => Promise<{ data: Json; summary: string }>;
}

const LANES: Lane[] = [
  {
    tool: "run_bookkeeper",
    agent: "Bookkeeper",
    description: "Bookkeeper lane: 12-month turnover, monthly revenue with open days and notes, channel totals, seasonal dips, supplier purchases by month, and the bank statement summary (opening, closing, reconciles).",
    run: async (ws, fmt) => {
      const { findings: _f, normal_do_not_flag: _n, matchedPayables: _m, ...data } = await ws.run("financial");
      return { data, summary: `${data.months ?? "?"} months, turnover ${fmt(data.turnover12m ?? 0)}` };
    },
  },
  {
    tool: "run_reconciliation",
    agent: "Reconciliation",
    description: "Reconciliation lane: payables vs bank (duplicate payments), sales vs bank (missing QR and card settlements), card purchases at non-suppliers (possible mixed receipts), cash to recover, and the items verified as normal that must not be flagged.",
    run: async (ws, fmt) => {
      const fin = await ws.run("financial");
      const f = fin.findings ?? {};
      const missing = (f.missingQrSettlements?.length ?? 0) + (f.missingCardSettlements?.length ?? 0);
      return {
        data: { findings: f, normal_do_not_flag: fin.normal_do_not_flag, matchedPayables: fin.matchedPayables, bank: fin.bank },
        summary: `${f.duplicatePayments?.length ?? 0} duplicate payment(s), ${missing} missing settlement(s), ${fmt(f.cashToRecover ?? 0)} to recover`,
      };
    },
  },
  {
    tool: "run_procurement",
    agent: "Procurement",
    description: "Procurement lane: unit price per supplier and item over time, price-rise alerts (item-specific or supplier-wide, notified or not, extra paid so far, projected extra per month and year, evidence invoices).",
    run: async (ws) => {
      const data = await ws.run("prices");
      return { data, summary: `${data.alerts?.length ?? 0} price alert(s)` };
    },
  },
  {
    tool: "run_classifier",
    agent: "Classifier",
    description: "Classifier lane: official SME category from actual 12-month sales (and declared vs actual), headroom to the next category, years operating, owner facts and what is unknown for funding eligibility.",
    run: async (ws) => {
      const data = await ws.run("sme");
      return { data, summary: String(data.category ?? "category unknown") };
    },
  },
  {
    tool: "run_funding",
    agent: "Funding",
    description: "Funding lane: every programme in the market pack pre-screened with the rules code can check (screen, checks, notes such as ASK the owner, verify flag, source URL), the excluded programmes with the failed rule, plus all lanes' candidate decisions ranked by yearly money impact.",
    run: async (ws) => {
      const all = await ws.run("all");
      return {
        data: {
          market: all.market,
          sme: all.sme,
          funding: all.funding,
          rankedCandidateDecisions: all.candidateDecisions,
          verified_ok_do_not_flag: all.verified_ok_do_not_flag,
          errors: all.errors,
        },
        summary: `${all.funding?.candidates?.length ?? 0} programme(s) pass the code checks`,
      };
    },
  },
];

async function runLanes(ws: Workspace, fmt: Fmt) {
  const out = await Promise.all(LANES.map((l) => l.run(ws, fmt).then((r) => r.data, (e: Error) => ({ error: e.message }))));
  return Object.fromEntries(LANES.map((l, i) => [l.agent, out[i]]));
}

// ---------- market pack (static per market, so it sits in the cached system prompt) ----------

const knowledge = new Map<string, Promise<string>>();

function marketKnowledge(code: string) {
  if (!/^[A-Z]{2}$/.test(code)) throw new Error(`Bad market code ${code}`);
  if (!knowledge.has(code)) knowledge.set(code, loadKnowledge(code));
  return knowledge.get(code)!;
}

async function loadKnowledge(code: string) {
  const dir = path.join(WB, "knowledge", "markets", code);
  const file = async (rel: string) => {
    const text = await readFile(path.join(dir, rel), "utf8").catch(() => null);
    return text === null ? "" : `<file name="${rel}">\n${text.trim()}\n</file>`;
  };
  const programs = (await readdir(path.join(dir, "programs")).catch(() => [] as string[])).filter((f) => f.endsWith(".md")).sort();
  const parts = await Promise.all(["market.json", "sme_definition.md", "sme_rules.json", "glossary.md", ...programs.map((p) => `programs/${p}`)].map(file));
  return `<market_pack code="${code}">\n${parts.filter(Boolean).join("\n\n")}\n</market_pack>`;
}

// ---------- the agent loop ----------

type Usage = { input: number; output: number; cacheRead: number; cacheWrite: number };
const newUsage = (): Usage => ({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });
// Opus 5.5 list prices per million tokens: $4 in, $20 out, $0.20 cache read, $5 cache write (5-minute TTL).
const usd = (u: Usage) => (u.input * 4 + u.output * 20 + u.cacheRead * 0.2 + u.cacheWrite * 5) / 1e6;

type Params = Omit<Anthropic.Beta.MessageCreateParamsNonStreaming, "model" | "max_tokens" | "messages" | "stream">;
type RunTools = (calls: Anthropic.Beta.BetaToolUseBlock[]) => Promise<Anthropic.Beta.BetaToolResultBlockParam[]>;

/** Streams turns until Claude stops calling tools; returns the final message. Appends every turn to `messages`. */
async function converse(params: Params, messages: Anthropic.Beta.BetaMessageParam[], usage: Usage, runTools?: RunTools) {
  let jsonRetries = 0;
  for (let turn = 0; turn < MAX_TURNS; turn++) {
    let message: Anthropic.Beta.BetaMessage;
    try {
      message = await client()
        .beta.messages.stream({
          model: MODEL,
          max_tokens: 64000,
          betas: BETAS,
          fallbacks: "default",
          thinking: { type: "adaptive" },
          cache_control: { type: "ephemeral" },
          ...params,
          messages,
        })
        .finalMessage();
      jsonRetries = 0;
    } catch (err) {
      // A streamed tool input that can't be parsed rejects finalMessage(); re-issue that turn. API errors are real.
      if (err instanceof Anthropic.APIError || jsonRetries++ >= 2) throw err;
      continue;
    }
    usage.input += message.usage.input_tokens;
    usage.output += message.usage.output_tokens;
    usage.cacheRead += message.usage.cache_read_input_tokens ?? 0;
    usage.cacheWrite += message.usage.cache_creation_input_tokens ?? 0;

    if (message.stop_reason === "refusal") throw new Error("Claude declined to process this request");
    if (message.stop_reason === "max_tokens") throw new Error("Claude ran out of output tokens");
    messages.push({ role: "assistant", content: message.content });
    if (message.stop_reason === "pause_turn") continue;
    const calls = message.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    if (message.stop_reason !== "tool_use" || !calls.length || !runTools) return message;
    messages.push({ role: "user", content: await runTools(calls) });
  }
  throw new Error("The CFO team took too many steps");
}

const textOf = (m: Anthropic.Beta.BetaMessage) =>
  m.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

const toolResult = (id: string, data: unknown, isError = false): Anthropic.Beta.BetaToolResultBlockParam => ({
  type: "tool_result",
  tool_use_id: id,
  content: typeof data === "string" ? data : JSON.stringify(data),
  ...(isError ? { is_error: true } : {}),
});

/** Schema-valid JSON from a structured-output turn, or one corrective turn if a client-side constraint fails. */
async function parseStructured<T>(
  schema: z.ZodType<T>,
  first: Anthropic.Beta.BetaMessage,
  params: Params,
  messages: Anthropic.Beta.BetaMessageParam[],
  usage: Usage,
  clamp: (raw: Json) => Json = (r) => r,
): Promise<T> {
  let message = first;
  for (let attempt = 0; ; attempt++) {
    let issue: string;
    try {
      const parsed = schema.safeParse(clamp(JSON.parse(textOf(message))));
      if (parsed.success) return parsed.data;
      issue = z.prettifyError(parsed.error);
    } catch (e) {
      issue = `Not valid JSON: ${(e as Error).message}`;
    }
    if (attempt >= 1) throw new Error(`Structured output failed validation: ${issue}`);
    messages.push({ role: "user", content: `That JSON failed validation:\n${issue}\nReturn the full corrected JSON.` });
    message = await converse(params, messages, usage);
  }
}

// ---------- tools for the Analysis agent ----------

const AskInput = z.object({
  question: z.string().min(1).max(300),
  context: z.string().max(500).optional(),
  options: z.array(z.string().min(1).max(120)).min(2).max(5),
  defaultOption: z.string().min(1),
});

const ANALYSIS_TOOLS: Anthropic.Beta.BetaTool[] = [
  ...LANES.map((l) => ({
    name: l.tool,
    description: l.description,
    input_schema: { type: "object" as const, properties: {}, additionalProperties: false },
    eager_input_streaming: true,
  })),
  {
    name: "ask_owner",
    description:
      "Ask the business owner a multiple-choice question in the BizDecide app; they can also type their own answer. Use it only when the data is genuinely ambiguous and the answer changes a decision. Waits up to 60 seconds. Returns the answer, or the default if the owner doesn't answer in time (record that as an assumption). At most 2 questions per request.",
    input_schema: {
      type: "object",
      properties: {
        question: { type: "string", description: "Short question in the owner's language" },
        context: { type: "string", description: "Evidence shown under the question, e.g. 'POS DEBIT PASARAYA SERBA MURAH PJ, RM144.15, 12 Sep'" },
        options: { type: "array", items: { type: "string" }, description: "2-4 answer options" },
        defaultOption: { type: "string", description: "The option you will assume if there is no answer; must be one of options" },
      },
      required: ["question", "options", "defaultOption"],
      additionalProperties: false,
    },
    eager_input_streaming: true,
  },
];

type Asked = { question: string; answer?: string; assumedDefault?: string };

async function askOwner(requestId: string, input: z.infer<typeof AskInput>, asked: Asked[]) {
  if (asked.length >= MAX_QUESTIONS) return { status: "limit_reached", note: "Question limit reached. Use your default and list it under assumptions." };
  const { question, context, options, defaultOption } = input;
  const questionId = await createQuestion({ requestId, question, context, options, allowOther: true, defaultOption });
  await updateRequest(requestId, { status: "waiting_for_user", progress: { step: "Waiting for your answer", detail: question } });
  const deadline = Date.now() + ASK_WAIT_MS;
  while (Date.now() < deadline) {
    await sleep(2000);
    const q = await getQuestion(questionId);
    if (q?.status === "answered") {
      const answer = q.answer === "__other__" ? `Other: ${q.otherText ?? ""}` : (q.answer ?? "");
      await updateRequest(requestId, { status: "processing", progress: { step: "Answer received", detail: q.otherText || q.answer } });
      asked.push({ question, answer });
      return { status: "answered", answer };
    }
  }
  await expireQuestion(questionId);
  await updateRequest(requestId, { status: "processing", progress: { step: "No answer yet, continuing", detail: `Assumed: ${defaultOption}` } });
  asked.push({ question, assumedDefault: defaultOption });
  return { status: "no_answer", usedDefault: defaultOption, note: "Continue with the default and list it under assumptions." };
}

// ---------- context the agents get about the business ----------

function coverage(b: Business) {
  const span = (dates: (string | undefined)[]) => {
    const s = dates.filter((d): d is string => Boolean(d)).sort();
    return s.length ? `${s[0]} to ${s[s.length - 1]}` : "none";
  };
  return {
    sales: { rows: b.sales?.length ?? 0, period: span((b.sales ?? []).map((s) => s.period)) },
    purchases: { rows: b.purchases?.length ?? 0, period: span((b.purchases ?? []).map((p) => p.date)) },
    bank: { rows: b.bank?.length ?? 0, period: span((b.bank ?? []).map((t) => t.date)) },
    payables: { rows: b.payables?.length ?? 0, period: span((b.payables ?? []).map((p) => p.invoiceDate)) },
    suppliers: b.suppliers?.length ?? 0,
    uploadedDocuments: (b.documents ?? []).map((d) => path.basename(d)),
  };
}

const block = (tag: string, data: unknown) => `<${tag}>\n${typeof data === "string" ? data : JSON.stringify(data, null, 1)}\n</${tag}>`;

// ---------- a request, end to end ----------

const ResultFormat = zodOutputFormat(ResultSchema);
const clampResult = (r: Json) => ({
  ...r,
  keyNumbers: Array.isArray(r.keyNumbers) ? r.keyNumbers.slice(0, 4) : r.keyNumbers,
  decisions: Array.isArray(r.decisions) ? r.decisions.slice(0, 5) : r.decisions,
  applicationPacks: Array.isArray(r.applicationPacks) ? r.applicationPacks.slice(0, 3) : r.applicationPacks,
});

/** Claims a submitted request and runs the Claude CFO team on it. Safe to call more than once. */
export function processRequest(requestId: string) {
  return once(`request:${requestId}`, async () => {
    const r = await claimRequest(requestId, `Claude Opus 5.5 started working`);
    if (!r) return;
    const usage = newUsage();
    const started = Date.now();
    let ws: Workspace | undefined;
    try {
      ws = await openWorkspace(r.businessId);
      const profile = ws.business.profile;
      const pack = marketPack(r.market ?? profile.market);
      if (!pack) throw new Error("Market not supported yet");
      const fmt = money(pack.code);
      const language = r.language ?? profile.language ?? "en";
      const system: Anthropic.Beta.BetaTextBlockParam[] = [
        { type: "text", text: ANALYSIS_PROMPT },
        { type: "text", text: await marketKnowledge(pack.code), cache_control: { type: "ephemeral" } },
      ];

      // 1) Analysis agent: lanes in parallel, owner questions, draft.
      const laneData: Record<string, Json> = {};
      const asked: Asked[] = [];
      const runTools: RunTools = async (calls) => {
        const lanes = calls.filter((c) => LANES.some((l) => l.tool === c.name));
        if (lanes.length > 1) {
          const names = lanes.map((c) => LANES.find((l) => l.tool === c.name)!.agent).join(" · ");
          await updateRequest(requestId, { progress: { step: `${lanes.length} agents working in parallel`, detail: names } });
        }
        const results = await Promise.all(
          calls.map(async (c) => {
            const lane = LANES.find((l) => l.tool === c.name);
            if (lane) {
              try {
                const { data, summary } = await lane.run(ws!, fmt);
                laneData[lane.agent] = data;
                await updateRequest(requestId, { progress: { step: `${lane.agent} done`, detail: summary } });
                return toolResult(c.id, data);
              } catch (e) {
                laneData[lane.agent] = { error: (e as Error).message };
                return toolResult(c.id, `Lane failed: ${(e as Error).message}`, true);
              }
            }
            if (c.name === "ask_owner") {
              const input = AskInput.safeParse(c.input);
              if (!input.success) return toolResult(c.id, `Invalid input: ${z.prettifyError(input.error)}`, true);
              return toolResult(c.id, await askOwner(requestId, input.data, asked));
            }
            return toolResult(c.id, `Unknown tool ${c.name}`, true);
          }),
        );
        if (lanes.length) await updateRequest(requestId, { progress: { step: "Choosing your 3 decisions" } });
        return results;
      };
      const analysisMessages: Anthropic.Beta.BetaMessageParam[] = [
        {
          role: "user",
          content: [
            `New BizDecide request ${requestId}: service "${r.service}" (${SERVICE_LABELS[r.service].title}). Market ${pack.code} (${pack.name}, currency ${pack.currencySymbol}). Owner's language: ${language}.`,
            block("business_profile", profile),
            block("owner_details", ws.business.profileExtras ?? {}),
            block("data_on_file", coverage(ws.business)),
            "Run the lanes, ask the owner only if needed, then write your draft.",
          ].join("\n\n"),
        },
      ];
      const draft = await converse(
        { system, tools: ANALYSIS_TOOLS, output_config: { effort: EFFORT } },
        analysisMessages,
        usage,
        runTools,
      );

      // Lanes the agent skipped still go to the Verifier, so every figure can be checked.
      for (const lane of LANES) {
        if (!laneData[lane.agent]) laneData[lane.agent] = await lane.run(ws, fmt).then((x) => x.data, (e: Error) => ({ error: e.message }));
      }

      // 2) Verifier agent: checks the draft against the lane outputs and writes the final Result.
      await updateRequest(requestId, { progress: { step: "Verifier checking every figure and link" } });
      const verifierParams: Params = {
        system: [
          { type: "text", text: VERIFIER_PROMPT },
          { type: "text", text: await marketKnowledge(pack.code), cache_control: { type: "ephemeral" } },
        ],
        output_config: { effort: EFFORT, format: { type: "json_schema", schema: ResultFormat.schema } },
      };
      const verifierMessages: Anthropic.Beta.BetaMessageParam[] = [
        {
          role: "user",
          content: [
            `Request ${requestId}: service "${r.service}" (${SERVICE_LABELS[r.service].title}). Market ${pack.code}, currency ${pack.currencySymbol}. Write the brief in: ${language === "ms" ? "Bahasa Melayu" : "English"}.`,
            block("business_profile", profile),
            block("owner_details", ws.business.profileExtras ?? {}),
            block("data_on_file", coverage(ws.business)),
            block("lane_outputs", laneData),
            block("owner_answers", asked.length ? asked : "No questions were asked."),
            block("draft", textOf(draft)),
          ].join("\n\n"),
        },
      ];
      const final = await converse(verifierParams, verifierMessages, usage);
      const result: Result = await parseStructured(ResultSchema, final, verifierParams, verifierMessages, usage, clampResult);
      result.agentsUsed = [...LANES.map((l) => l.agent).filter((a) => !laneData[a]?.error), "Verifier"];

      await saveResult(requestId, result);
      await updateRequest(requestId, { status: "completed", progress: { step: "CFO brief delivered", detail: result.headline } });
    } catch (e) {
      console.error(`[claude] request ${requestId} failed`, e);
      const detail = e instanceof Anthropic.AuthenticationError ? "The Claude API key was rejected" : (e as Error).message;
      await updateRequest(requestId, { status: "failed", error: detail, progress: { step: "Something went wrong", detail } }).catch(() => {});
    } finally {
      await ws?.close();
      console.log(
        `[claude] request ${requestId}: ${Math.round((Date.now() - started) / 1000)}s, ` +
          `${usage.input} in + ${usage.cacheRead} cache-read + ${usage.cacheWrite} cache-write + ${usage.output} out tokens, est. $${usd(usage).toFixed(3)}`,
      );
    }
  });
}

// ---------- "Ask your CFO" follow-up questions ----------

const ReplySchema = z.object({
  answer: z.string().min(1).max(2000),
  evidence: z.array(z.object({ label: z.string(), detail: z.string().optional(), url: z.string().optional() })).max(5),
});
const ReplyFormat = zodOutputFormat(ReplySchema);

/** Claims an owner's follow-up question and answers it from the business's data and brief. Safe to call more than once. */
export function answerOwnerMessage(messageId: string) {
  return once(`message:${messageId}`, async () => {
    const m = await claimMessage(messageId);
    if (!m) return;
    const usage = newUsage();
    let ws: Workspace | undefined;
    let language: string | undefined;
    try {
      const [request, brief, thread] = await Promise.all([getRequest(m.requestId), getResult(m.requestId), listMessages(m.requestId)]);
      ws = await openWorkspace(m.businessId);
      language = request?.language ?? ws.business.profile.language;
      const pack = marketPack(request?.market ?? ws.business.profile.market);
      if (!pack) throw new Error("Market not supported yet");
      const params: Params = {
        system: [
          { type: "text", text: CHAT_PROMPT },
          { type: "text", text: await marketKnowledge(pack.code), cache_control: { type: "ephemeral" } },
        ],
        output_config: { effort: EFFORT, format: { type: "json_schema", schema: ReplyFormat.schema } },
      };
      const messages: Anthropic.Beta.BetaMessageParam[] = [
        {
          role: "user",
          content: [
            `Market ${pack.code}, currency ${pack.currencySymbol}.`,
            block("business_profile", ws.business.profile),
            block("owner_details", ws.business.profileExtras ?? {}),
            block("lane_outputs", await runLanes(ws, money(pack.code))),
            block("brief", brief ?? "No brief yet."),
            block("earlier_questions", thread.filter((t) => t.status === "answered").map((t) => ({ question: t.question, answer: t.answer }))),
            block("owner_question", m.question),
          ].join("\n\n"),
        },
      ];
      const reply = await parseStructured(ReplySchema, await converse(params, messages, usage), params, messages, usage);
      await answerMessage(messageId, reply.answer, reply.evidence);
    } catch (e) {
      console.error(`[claude] message ${messageId} failed`, e);
      const sorry =
        language === "ms"
          ? "Maaf, saya tidak dapat menjawab soalan ini sekarang. Sila tanya sekali lagi sebentar lagi."
          : "Sorry, I couldn't answer that right now. Please ask again in a moment.";
      await answerMessage(messageId, sorry).catch(() => {});
    } finally {
      await ws?.close();
      console.log(`[claude] message ${messageId}: ${usage.input + usage.cacheRead + usage.cacheWrite} in / ${usage.output} out tokens, est. $${usd(usage).toFixed(3)}`);
    }
  });
}

// ---------- "Approve & act": the owner approved a decision; write what they need to send ----------

const ACTION_PROMPT = `You are the action agent of BizDecide, an AI CFO team for Malaysian small businesses. The owner has tapped Approve on one decision in their CFO brief. Carry it out: write exactly what the owner needs to send, ready to go.

Rules:
- Write in the language you are given (English or Bahasa Melayu), in a polite, short, specific Malaysian business tone.
- Use only facts from the decision, its evidence, the business details, the supplier list and the application packs. Never invent amounts, invoice numbers, dates, bank references, names, phone numbers or email addresses. If you don't have the recipient's email address, leave "to" out.
- kind "one_off" (money to get back): an email to the counterparty asking for the money back, quoting the invoice numbers, dates, amounts and bank references from the evidence. For a missing DuitNow QR or card settlement, write to the bank's merchant services and quote the sale date, the expected amount and the settlement that never arrived.
- kind "monthly" (a cost that keeps leaking, such as a supplier price rise): an email to the supplier asking why the price rose and asking for the old price back, quoting the old and new unit prices and the invoice numbers. Also add a document titled as a quote request, with one short section the owner can send to two other suppliers.
- kind "financing" (a loan or grant): a document that is the application pack, with these sections: Why this business qualifies; Amount and purpose; Prefilled answers; Documents checklist (mark each item ready or missing); Next steps. Use the application packs when they are given and the programme facts in the market pack. Also write a short cover email to the agency.
- Emails stay under 150 words and are signed with the owner's name and the business name.
- summary: one line for the owner saying what is ready, for example "Refund request to Ladang Susu Segar, ready to send". Never say that anything was sent or saved anywhere.`;

const ActionOutSchema = z.object({
  summary: z.string().min(1).max(300),
  email: z
    .object({
      to: z.string().max(200).optional(),
      subject: z.string().min(1).max(200),
      body: z.string().min(1).max(6000),
    })
    .optional(),
  document: z
    .object({
      title: z.string().min(1).max(200),
      sections: z.array(z.object({ heading: z.string().min(1).max(200), body: z.string().min(1).max(4000) })).min(1).max(12),
    })
    .optional(),
});
const ActionOutFormat = zodOutputFormat(ActionOutSchema);

/** Claims an approved action and writes the email or pack for the owner. Safe to call more than once. */
export function processAction(actionId: string) {
  return once(`action:${actionId}`, async () => {
    const a = await claimAction(actionId);
    if (!a) return;
    const usage = newUsage();
    const started = Date.now();
    try {
      const [request, brief, business] = await Promise.all([getRequest(a.requestId), getResult(a.requestId), getBusiness(a.businessId)]);
      const decision = brief?.decisions[a.decisionIndex];
      if (!request || !brief || !decision || !business) throw new Error("The brief or the business data is missing");
      const pack = marketPack(request.market ?? business.profile.market);
      if (!pack) throw new Error("Market not supported yet");
      const kind = impactKind(decision);
      const extras = (business.profileExtras ?? {}) as Json;
      const params: Params = {
        system: [
          { type: "text", text: ACTION_PROMPT },
          { type: "text", text: await marketKnowledge(pack.code), cache_control: { type: "ephemeral" } },
        ],
        output_config: { effort: "medium", format: { type: "json_schema", schema: ActionOutFormat.schema } },
      };
      const messages: Anthropic.Beta.BetaMessageParam[] = [
        {
          role: "user",
          content: [
            `The owner approved this decision. kind: ${kind}. Write in: ${a.lang === "ms" ? "Bahasa Melayu" : "English"}. Currency ${pack.currencySymbol}.`,
            block("decision", decision),
            block("business", {
              name: business.profile.name,
              sector: business.profile.sector,
              state: business.profile.state,
              city: extras.city,
              ssmNumber: business.profile.ssmNumber,
              registeredSince: business.profile.registeredSince,
              owner: extras.owner?.name,
              goal: business.profile.goal,
            }),
            block("suppliers", (business.suppliers ?? []).map(({ name, contact, category, paymentTerms }) => ({ name, contact, category, paymentTerms }))),
            ...(kind === "financing" ? [block("application_packs", brief.applicationPacks ?? [])] : []),
            block("brief_headline", brief.headline),
          ].join("\n\n"),
        },
      ];
      const out = await parseStructured(ActionOutSchema, await converse(params, messages, usage), params, messages, usage);
      if (!out.email && !out.document) throw new Error("Nothing was written");
      await completeAction(actionId, {
        status: "done",
        summary: out.summary,
        channel: out.email ? "note" : "document",
        email: out.email,
        document: out.document,
      });
    } catch (e) {
      console.error(`[claude] action ${actionId} failed`, e);
      const detail = e instanceof Anthropic.AuthenticationError ? "The Claude API key was rejected" : (e as Error).message;
      await completeAction(actionId, { status: "failed", summary: detail, error: detail }).catch(() => {});
    } finally {
      console.log(`[claude] action ${actionId}: ${Math.round((Date.now() - started) / 1000)}s, est. $${usd(usage).toFixed(3)}`);
    }
  });
}
