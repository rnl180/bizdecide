import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { ActionCompletionError, actionCompletionProblem, type ActionCompletion } from "./action-completion";
import { validateResultDelivery } from "./result-delivery";
import type { ActionDoc, BusinessInput, ChatMessageDoc, ProgressEntry, QuestionDoc, RequestDoc, RequestStatus, Result, Service } from "./types";

/**
 * Storage for the BizDecide app.
 *
 * - Firebase (Firestore) when credentials are configured or when running on Firebase App Hosting / Cloud Run.
 * - A local JSON file (.data/db.json) otherwise, so the whole flow (app + agents) can be tested
 *   on a laptop with no cloud setup.
 * Force one with BIZDECIDE_STORE=firebase|local.
 */

export const storeMode: "firebase" | "local" =
  process.env.BIZDECIDE_STORE === "local"
    ? "local"
    : process.env.BIZDECIDE_STORE === "firebase" ||
        process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 ||
        process.env.FIREBASE_PROJECT_ID ||
        process.env.K_SERVICE // set on Cloud Run / App Hosting
      ? "firebase"
      : "local";

const now = () => new Date().toISOString();
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Collection = "businesses" | "requests" | "questions" | "results" | "messages" | "actions" | "lane_outputs";
type Doc = Record<string, unknown>;
/** Optional server-side pre-filter for Firestore: [field, "==" value] or [field, "in" values]. `match` still decides. */
type Pre = [string, "==" | "in", unknown];

interface Backend {
  transaction<T>(fn: (tx: StoreTransaction) => Promise<T>): Promise<T>;
  add(c: Collection, data: Doc): Promise<string>;
  set(c: Collection, id: string, data: Doc): Promise<void>;
  get<T>(c: Collection, id: string): Promise<(T & { id: string }) | null>;
  update(c: Collection, id: string, patch: Doc, appendProgress?: ProgressEntry): Promise<void>;
  where<T>(c: Collection, match: (d: Doc) => boolean, limit: number, pre?: Pre): Promise<(T & { id: string })[]>;
}

interface StoreTransaction {
  get<T>(c: Collection, id: string): Promise<(T & { id: string }) | null>;
  set(c: Collection, id: string, data: Doc): void;
  update(c: Collection, id: string, patch: Doc): void;
}
const defined = (data: Doc): Doc => Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));

// ---------- local JSON file backend ----------

const DATA_DIR = path.join(process.cwd(), ".data");
const DB_FILE = path.join(DATA_DIR, "db.json");
type Db = Record<Collection, Record<string, Doc>>;
// Route bundles must share the same queue. Local storage is for a single Node process;
// Firestore transactions coordinate multiple server instances.
const queues = ((globalThis as unknown as { __bizdecideDbQueues?: Map<string, Promise<unknown>> }).__bizdecideDbQueues ??= new Map());

async function loadDb(): Promise<Db> {
  const empty: Db = { businesses: {}, requests: {}, questions: {}, results: {}, messages: {}, actions: {}, lane_outputs: {} };
  try {
    return { ...empty, ...JSON.parse(await readFile(DB_FILE, "utf8")) };
  } catch {
    return empty;
  }
}
async function saveDb(db: Db) {
  await mkdir(DATA_DIR, { recursive: true });
  const temp = `${DB_FILE}.${randomUUID()}.tmp`;
  await writeFile(temp, JSON.stringify(db, null, 2));
  await rename(temp, DB_FILE);
}
// Serialise writes so concurrent requests don't clobber the file.
function withDb<T>(fn: (db: Db) => T | Promise<T>, write: boolean): Promise<T> {
  const run = (queues.get(DB_FILE) ?? Promise.resolve()).then(async () => {
    const db = await loadDb();
    const out = await fn(db);
    if (write) await saveDb(db);
    return out;
  });
  queues.set(DB_FILE, run.catch(() => undefined));
  return run;
}

const local: Backend = {
  transaction: (fn) => withDb(async (data) => fn({
    get: async <T,>(c: Collection, id: string) => data[c][id] ? ({ id, ...data[c][id] } as T & { id: string }) : null,
    set: (c, id, doc) => { data[c][id] = defined(doc); },
    update: (c, id, patch) => {
      if (!data[c][id]) throw new Error(`${c}/${id} not found`);
      Object.assign(data[c][id], defined(patch));
    },
  }), true),
  add: (c, data) =>
    withDb((db) => {
      const id = randomUUID().replace(/-/g, "").slice(0, 20);
      db[c][id] = data;
      return id;
    }, true),
  set: (c, id, data) =>
    withDb((db) => {
      db[c][id] = data;
    }, true),
  get: <T,>(c: Collection, id: string) =>
    withDb((db) => (db[c][id] ? ({ id, ...db[c][id] } as T & { id: string }) : null), false),
  update: (c, id, patch, appendProgress) =>
    withDb((db) => {
      const cur = db[c][id];
      if (!cur) throw new Error(`${c}/${id} not found`);
      Object.assign(cur, Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)));
      if (appendProgress) cur.progress = [...((cur.progress as ProgressEntry[]) ?? []), appendProgress];
    }, true),
  where: <T,>(c: Collection, match: (d: Doc) => boolean, limit: number) =>
    withDb(
      (db) =>
        Object.entries(db[c] ?? {})
          .filter(([, d]) => match(d))
          .slice(0, limit)
          .map(([id, d]) => ({ id, ...d }) as T & { id: string }),
      false,
    ),
};

// ---------- Firestore backend ----------

async function fs() {
  const { col } = await import("./firebase");
  const { FieldValue } = await import("firebase-admin/firestore");
  return { col, FieldValue };
}

const firebase: Backend = {
  async transaction(fn) {
    const { col } = await fs();
    return col.requests().firestore.runTransaction(async (transaction) => fn({
      get: async <T,>(c: Collection, id: string) => {
        const snap = await transaction.get(col[c]().doc(id));
        return snap.exists ? ({ id: snap.id, ...snap.data() } as T & { id: string }) : null;
      },
      set: (c, id, data) => { transaction.set(col[c]().doc(id), defined(data)); },
      update: (c, id, patch) => { transaction.update(col[c]().doc(id), defined(patch)); },
    }));
  },
  async add(c, data) {
    const { col } = await fs();
    const ref = col[c]().doc();
    await ref.set(data);
    return ref.id;
  },
  async set(c, id, data) {
    const { col } = await fs();
    await col[c]().doc(id).set(data);
  },
  async get<T>(c: Collection, id: string) {
    const { col } = await fs();
    const snap = await col[c]().doc(id).get();
    return snap.exists ? ({ id: snap.id, ...snap.data() } as T & { id: string }) : null;
  },
  async update(c, id, patch, appendProgress) {
    const { col, FieldValue } = await fs();
    const u: Doc = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
    if (appendProgress) u.progress = FieldValue.arrayUnion(appendProgress);
    await col[c]().doc(id).update(u);
  },
  async where<T>(c: Collection, match: (d: Doc) => boolean, limit: number, pre?: Pre) {
    // Small, status-filtered queries. A single-field pre-filter needs no composite index; ordering and
    // the rest of the match happen in memory. Without one, scan the newest 200 (not the oldest).
    const { col } = await fs();
    const snap = await (pre
      ? col[c]().where(pre[0], pre[1], pre[2]).limit(500)
      : col[c]().orderBy("createdAt", "desc").limit(200)
    ).get();
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((d) => match(d))
      .slice(0, limit) as (T & { id: string })[];
  },
};

const db: Backend = storeMode === "firebase" ? firebase : local;

// ---------- businesses ----------

export async function createBusiness(input: BusinessInput, documents: string[] = []) {
  return db.add("businesses", { ...input, documents, createdAt: now(), updatedAt: now() });
}

export async function getBusiness(id: string) {
  return db.get<BusinessInput & { documents?: string[] }>("businesses", id);
}

// ---------- requests ----------

export async function createRequest(businessId: string, businessName: string, service: Service, market?: string, language?: string) {
  const doc: Omit<RequestDoc, "id"> = {
    businessId,
    businessName,
    service,
    market,
    language: language === "ms" ? "ms" : language === "en" ? "en" : undefined,
    status: "submitted",
    createdAt: now(),
    updatedAt: now(),
    progress: [{ at: now(), step: "Request received", detail: "Waiting for the BizDecide CFO team to pick it up" }],
  };
  return db.add("requests", doc as unknown as Doc);
}

export async function getRequest(id: string): Promise<RequestDoc | null> {
  return db.get<RequestDoc>("requests", id);
}

/** True when a run has gone quiet for staleMs: its server died mid-run (processing or waiting for an answer). */
export function isStaleRun(r: RequestDoc, staleMs: number) {
  return (r.status === "processing" || r.status === "waiting_for_user") && Date.now() - Date.parse(r.updatedAt) > staleMs;
}

export const REQUEST_STALE_MS = 10 * 60_000;
export class RequestClaimError extends Error {}

function assertClaim(r: RequestDoc | null, claimToken?: string): asserts r is RequestDoc {
  if (!r) throw new RequestClaimError("Request not found");
  if (!claimToken || r.claimToken !== claimToken || !["processing", "waiting_for_user"].includes(r.status)) {
    throw new RequestClaimError("This request is not owned by this run. Claim it first; discard output from an expired run.");
  }
}

/**
 * Moves a submitted request to processing. With staleMs, also takes over a run that went quiet for that long
 * (and closes the question it left open). Null if it's gone or someone else has it.
 */
export async function claimRequest(id: string, detail: string, staleMs?: number): Promise<RequestDoc | null> {
  const open = await getOpenQuestion(id);
  return db.transaction(async (tx) => {
    const r = await tx.get<RequestDoc>("requests", id);
    if (!r || (r.status !== "submitted" && (staleMs === undefined || !isStaleRun(r, staleMs)))) return null;
    const oldQuestion = open ? await tx.get<QuestionDoc>("questions", open.id) : null;
    const at = now();
    const patch = {
      status: "processing" as const, updatedAt: at, claimToken: randomUUID(),
      progress: [...r.progress, { at, step: r.status === "submitted" ? "Picked up by your CFO team" : "Restarted after an interruption", detail }],
    };
    if (oldQuestion?.status === "open") tx.update("questions", oldQuestion.id, { status: "expired" });
    tx.update("requests", id, patch);
    return { ...r, ...patch };
  });
}

/** Atomically pick new work or recover a run whose heartbeat stopped. */
export async function claimNextRequest(detail: string, staleMs = REQUEST_STALE_MS): Promise<RequestDoc | null> {
  const rows = await listRequestsByStatus(["submitted", "processing", "waiting_for_user"], 200);
  for (const r of rows) {
    if (r.status !== "submitted" && !isStaleRun(r, staleMs)) continue;
    const claimed = await claimRequest(r.id, detail, staleMs);
    if (claimed) return claimed;
  }
  return null;
}

export async function listRequestsByStatus(statuses: RequestStatus[], limit = 20): Promise<RequestDoc[]> {
  const rows = await db.where<RequestDoc>("requests", (d) => statuses.includes(d.status as RequestStatus), 200, ["status", "in", statuses]);
  return rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(0, limit);
}

export async function updateRequest(
  id: string,
  patch: { status?: RequestStatus; progress?: Omit<ProgressEntry, "at">; error?: string },
  claimToken?: string,
) {
  if (patch.status === "completed") throw new RequestClaimError("Use saveResult to validate and complete the brief.");
  await db.transaction(async (tx) => {
    const r = await tx.get<RequestDoc>("requests", id);
    assertClaim(r, claimToken);
    const at = now();
    tx.update("requests", id, { updatedAt: at, status: patch.status, error: patch.error,
      progress: patch.progress ? [...r.progress, { at, ...patch.progress }] : r.progress });
  });
}

// ---------- questions (live poll between the agent and the owner) ----------

export async function createQuestion(q: Omit<QuestionDoc, "id" | "status" | "createdAt">, claimToken?: string) {
  return db.transaction(async (tx) => {
    const r = await tx.get<RequestDoc>("requests", q.requestId);
    assertClaim(r, claimToken);
    const id = randomUUID().replace(/-/g, "").slice(0, 20);
    tx.set("questions", id, { ...q, status: "open", createdAt: now() });
    return id;
  });
}

export async function getQuestion(id: string): Promise<QuestionDoc | null> {
  return db.get<QuestionDoc>("questions", id);
}

export async function getOpenQuestion(requestId: string): Promise<QuestionDoc | null> {
  const rows = await db.where<QuestionDoc>("questions", (d) => d.requestId === requestId && d.status === "open", 1, ["requestId", "==", requestId]);
  return rows[0] ?? null;
}

export async function answerQuestion(id: string, answer: string, otherText?: string) {
  await db.update("questions", id, { status: "answered", answer, otherText, answeredAt: now() });
}

export async function expireQuestion(id: string, claimToken?: string) {
  await db.transaction(async (tx) => {
    const q = await tx.get<QuestionDoc>("questions", id);
    if (!q || q.status !== "open") return;
    const r = await tx.get<RequestDoc>("requests", q.requestId);
    assertClaim(r, claimToken);
    tx.update("questions", id, { status: "expired" });
  });
}

// ---------- results ----------

export async function saveResult(requestId: string, input: Result, claimToken?: string) {
  // Validation and completion share a transaction: failed validation leaves both documents unchanged.
  await db.transaction(async (tx) => {
    const r = await tx.get<RequestDoc>("requests", requestId);
    assertClaim(r, claimToken);
    const business = await tx.get<BusinessInput>("businesses", r.businessId);
    if (!business) throw new RequestClaimError("Business data is missing");
    const result = validateResultDelivery(input, business);
    const at = now();
    tx.set("results", requestId, { ...result, createdAt: at });
    tx.update("requests", requestId, { status: "completed", updatedAt: at,
      progress: [...r.progress, { at, step: "CFO brief delivered", detail: result.headline }] });
  });
}

export async function getResult(requestId: string): Promise<Result | null> {
  const r = await db.get<Result>("results", requestId);
  if (!r) return null;
  const { id: _id, ...rest } = r;
  return rest as Result;
}

// ---------- lane outputs (what the skill scripts computed for a brief; follow-up answers read them) ----------

// Stored as one JSON string: script output can hold map keys Firestore won't take as field names.
export async function saveLaneOutputs(requestId: string, lanes: Record<string, unknown>, claimToken?: string) {
  await db.transaction(async (tx) => {
    assertClaim(await tx.get<RequestDoc>("requests", requestId), claimToken);
    tx.set("lane_outputs", requestId, { json: JSON.stringify(lanes), createdAt: now() });
  });
}

export async function getLaneOutputs(requestId: string): Promise<Record<string, unknown> | null> {
  const d = await db.get<{ json?: string }>("lane_outputs", requestId);
  if (!d?.json) return null;
  try {
    return JSON.parse(d.json);
  } catch {
    return null;
  }
}

// ---------- messages ("Ask your CFO": owner asks on the brief page, the on-duty agent answers) ----------

export async function createMessage(requestId: string, businessId: string, question: string) {
  return db.add("messages", { requestId, businessId, question, status: "open", createdAt: now() });
}

export async function listMessages(requestId: string): Promise<ChatMessageDoc[]> {
  const rows = await db.where<ChatMessageDoc>("messages", (d) => d.requestId === requestId, 100, ["requestId", "==", requestId]);
  return rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** Oldest unanswered question. Claims re-open after 3 minutes so a crashed agent can't strand one. */
export async function claimNextMessage(): Promise<ChatMessageDoc | null> {
  const stale = new Date(Date.now() - 3 * 60_000).toISOString();
  const rows = await db.where<ChatMessageDoc>(
    "messages",
    (d) => d.status === "open" || (d.status === "claimed" && String(d.claimedAt) < stale),
    50,
    ["status", "in", ["open", "claimed"]],
  );
  for (const next of rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    const claimed = await claimMessage(next.id);
    if (claimed) return claimed;
  }
  return null;
}

/** Claims one question if it's open (or its claim went stale). Null otherwise. */
export async function claimMessage(id: string): Promise<ChatMessageDoc | null> {
  return db.transaction(async (tx) => {
    const m = await tx.get<ChatMessageDoc>("messages", id);
    const stale = new Date(Date.now() - 3 * 60_000).toISOString();
    if (!m || !(m.status === "open" || (m.status === "claimed" && String(m.claimedAt) < stale))) return null;
    const patch = { status: "claimed" as const, claimedAt: now() };
    tx.update("messages", id, patch);
    return { ...m, ...patch };
  });
}

export async function getMessage(id: string): Promise<ChatMessageDoc | null> {
  return db.get<ChatMessageDoc>("messages", id);
}

export async function answerMessage(id: string, answer: string, evidence?: ChatMessageDoc["evidence"]) {
  await db.update("messages", id, { status: "answered", answer, evidence, answeredAt: now() });
}

// ---------- actions ("Approve & act": the owner approves a decision, the on-duty agent carries it out) ----------

export async function createAction(a: Pick<ActionDoc, "requestId" | "businessId" | "decisionIndex" | "decisionTitle" | "lang">) {
  const doc = { ...a, status: "queued" as const, createdAt: now() };
  const id = await db.add("actions", doc);
  return { id, ...doc } as ActionDoc;
}

export async function listActions(requestId: string): Promise<ActionDoc[]> {
  const rows = await db.where<ActionDoc>("actions", (d) => d.requestId === requestId, 100, ["requestId", "==", requestId]);
  return rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function getAction(id: string): Promise<ActionDoc | null> {
  return db.get<ActionDoc>("actions", id);
}

/** Oldest approved action. A claim re-opens after 5 minutes so a crashed agent can't strand it. */
export async function claimNextAction(): Promise<ActionDoc | null> {
  const stale = new Date(Date.now() - 5 * 60_000).toISOString();
  const rows = await db.where<ActionDoc>(
    "actions",
    (d) => d.status === "queued" || (d.status === "working" && String(d.claimedAt) < stale),
    50,
    ["status", "in", ["queued", "working"]],
  );
  for (const next of rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    const claimed = await claimAction(next.id);
    if (claimed) return claimed;
  }
  return null;
}

/** Claims one action if it's queued (or its claim went stale). Null otherwise. */
export async function claimAction(id: string): Promise<ActionDoc | null> {
  return db.transaction(async (tx) => {
    const a = await tx.get<ActionDoc>("actions", id);
    const stale = new Date(Date.now() - 5 * 60_000).toISOString();
    if (!a || !(a.status === "queued" || (a.status === "working" && String(a.claimedAt) < stale))) return null;
    const patch = { status: "working" as const, claimedAt: now() };
    tx.update("actions", id, patch);
    return { ...a, ...patch };
  });
}

export async function completeAction(
  id: string,
  out: ActionCompletion,
) {
  await db.transaction(async (tx) => {
    const action = await tx.get<ActionDoc>("actions", id);
    if (!action) throw new ActionCompletionError(`Action ${id} not found`);
    if (action.status === "done") throw new ActionCompletionError("This action is already done");
    const result = out.status === "done" ? await tx.get<Result>("results", action.requestId) : null;
    const decision = result?.decisions[action.decisionIndex];
    if (out.status === "done" && !decision) throw new ActionCompletionError("The decision is missing. Restore the brief before completing this action.");
    const problem = actionCompletionProblem(out, decision);
    if (problem) throw new ActionCompletionError(problem);
    tx.update("actions", id, { ...out, completedAt: now() } as Doc);
  });
}
