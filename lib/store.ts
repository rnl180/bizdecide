import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { BusinessInput, ChatMessageDoc, ProgressEntry, QuestionDoc, RequestDoc, RequestStatus, Result, Service } from "./types";

/**
 * Storage for the BizDecide app.
 *
 * - Firebase (Firestore) when credentials are configured or when running on Firebase App Hosting / Cloud Run.
 * - A local JSON file (.data/db.json) otherwise, so the whole flow (app + MCP + WorkBuddy) can be tested
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

type Collection = "businesses" | "requests" | "questions" | "results" | "messages";
type Doc = Record<string, unknown>;
/** Optional server-side pre-filter for Firestore: [field, "==" value] or [field, "in" values]. `match` still decides. */
type Pre = [string, "==" | "in", unknown];

interface Backend {
  add(c: Collection, data: Doc): Promise<string>;
  set(c: Collection, id: string, data: Doc): Promise<void>;
  get<T>(c: Collection, id: string): Promise<(T & { id: string }) | null>;
  update(c: Collection, id: string, patch: Doc, appendProgress?: ProgressEntry): Promise<void>;
  where<T>(c: Collection, match: (d: Doc) => boolean, limit: number, pre?: Pre): Promise<(T & { id: string })[]>;
}

// ---------- local JSON file backend ----------

const DATA_DIR = path.join(process.cwd(), ".data");
const DB_FILE = path.join(DATA_DIR, "db.json");
type Db = Record<Collection, Record<string, Doc>>;
let queue: Promise<unknown> = Promise.resolve();

async function loadDb(): Promise<Db> {
  const empty: Db = { businesses: {}, requests: {}, questions: {}, results: {}, messages: {} };
  try {
    return { ...empty, ...JSON.parse(await readFile(DB_FILE, "utf8")) };
  } catch {
    return empty;
  }
}
async function saveDb(db: Db) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(DB_FILE, JSON.stringify(db, null, 2));
}
// Serialise writes so concurrent requests don't clobber the file.
function withDb<T>(fn: (db: Db) => T | Promise<T>, write: boolean): Promise<T> {
  const run = queue.then(async () => {
    const db = await loadDb();
    const out = await fn(db);
    if (write) await saveDb(db);
    return out;
  });
  queue = run.catch(() => undefined);
  return run;
}

const local: Backend = {
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
    progress: [{ at: now(), step: "Request received", detail: "Waiting for BizDecide agents on WorkBuddy to pick it up" }],
  };
  return db.add("requests", doc as unknown as Doc);
}

export async function getRequest(id: string): Promise<RequestDoc | null> {
  return db.get<RequestDoc>("requests", id);
}

export async function listRequestsByStatus(statuses: RequestStatus[], limit = 20): Promise<RequestDoc[]> {
  const rows = await db.where<RequestDoc>("requests", (d) => statuses.includes(d.status as RequestStatus), 200, ["status", "in", statuses]);
  return rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(0, limit);
}

export async function updateRequest(
  id: string,
  patch: { status?: RequestStatus; progress?: Omit<ProgressEntry, "at">; error?: string },
) {
  await db.update(
    "requests",
    id,
    { updatedAt: now(), status: patch.status, error: patch.error },
    patch.progress ? { at: now(), ...patch.progress } : undefined,
  );
}

// ---------- questions (live poll between the agent and the owner) ----------

export async function createQuestion(q: Omit<QuestionDoc, "id" | "status" | "createdAt">) {
  return db.add("questions", { ...q, status: "open", createdAt: now() });
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

export async function expireQuestion(id: string) {
  await db.update("questions", id, { status: "expired" });
}

// ---------- results ----------

export async function saveResult(requestId: string, result: Result) {
  await db.set("results", requestId, { ...result, createdAt: now() });
}

export async function getResult(requestId: string): Promise<Result | null> {
  const r = await db.get<Result>("results", requestId);
  if (!r) return null;
  const { id: _id, ...rest } = r;
  return rest as Result;
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
  const next = rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
  if (!next) return null;
  await db.update("messages", next.id, { status: "claimed", claimedAt: now() });
  return next;
}

export async function getMessage(id: string): Promise<ChatMessageDoc | null> {
  return db.get<ChatMessageDoc>("messages", id);
}

export async function answerMessage(id: string, answer: string, evidence?: ChatMessageDoc["evidence"]) {
  await db.update("messages", id, { status: "answered", answer, evidence, answeredAt: now() });
}
