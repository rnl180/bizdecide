import { FieldValue } from "firebase-admin/firestore";
import { col, now } from "./firebase";
import type { BusinessInput, ProgressEntry, QuestionDoc, RequestDoc, RequestStatus, Result, Service } from "./types";

// ---------- businesses ----------

export async function createBusiness(input: BusinessInput, documents: string[] = []) {
  const ref = col.businesses().doc();
  await ref.set({ ...input, documents, createdAt: now(), updatedAt: now() });
  return ref.id;
}

export async function getBusiness(id: string) {
  const snap = await col.businesses().doc(id).get();
  return snap.exists ? { id: snap.id, ...(snap.data() as BusinessInput & { documents?: string[] }) } : null;
}

// ---------- requests ----------

export async function createRequest(businessId: string, businessName: string, service: Service) {
  const ref = col.requests().doc();
  const doc: Omit<RequestDoc, "id"> = {
    businessId,
    businessName,
    service,
    status: "submitted",
    createdAt: now(),
    updatedAt: now(),
    progress: [{ at: now(), step: "Request received", detail: "Waiting for BizDecide agents on WorkBuddy to pick it up" }],
  };
  await ref.set(doc);
  return ref.id;
}

export async function getRequest(id: string): Promise<RequestDoc | null> {
  const snap = await col.requests().doc(id).get();
  return snap.exists ? ({ id: snap.id, ...snap.data() } as RequestDoc) : null;
}

export async function listRequestsByStatus(statuses: RequestStatus[], limit = 20): Promise<RequestDoc[]> {
  const snap = await col.requests().where("status", "in", statuses).limit(limit).get();
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as RequestDoc)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function updateRequest(
  id: string,
  patch: { status?: RequestStatus; progress?: Omit<ProgressEntry, "at">; error?: string },
) {
  const update: Record<string, unknown> = { updatedAt: now() };
  if (patch.status) update.status = patch.status;
  if (patch.error) update.error = patch.error;
  if (patch.progress) update.progress = FieldValue.arrayUnion({ at: now(), ...patch.progress });
  await col.requests().doc(id).update(update);
}

// ---------- questions (live poll between the agent and the owner) ----------

export async function createQuestion(q: Omit<QuestionDoc, "id" | "status" | "createdAt">) {
  const ref = col.questions().doc();
  await ref.set({ ...q, status: "open", createdAt: now() });
  return ref.id;
}

export async function getQuestion(id: string): Promise<QuestionDoc | null> {
  const snap = await col.questions().doc(id).get();
  return snap.exists ? ({ id: snap.id, ...snap.data() } as QuestionDoc) : null;
}

export async function getOpenQuestion(requestId: string): Promise<QuestionDoc | null> {
  const snap = await col.questions().where("requestId", "==", requestId).where("status", "==", "open").limit(1).get();
  const d = snap.docs[0];
  return d ? ({ id: d.id, ...d.data() } as QuestionDoc) : null;
}

export async function answerQuestion(id: string, answer: string, otherText?: string) {
  await col.questions().doc(id).update({ status: "answered", answer, otherText, answeredAt: now() });
}

export async function expireQuestion(id: string) {
  await col.questions().doc(id).update({ status: "expired" });
}

// ---------- results ----------

export async function saveResult(requestId: string, result: Result) {
  await col.results().doc(requestId).set({ ...result, createdAt: now() });
}

export async function getResult(requestId: string): Promise<Result | null> {
  const snap = await col.results().doc(requestId).get();
  return snap.exists ? (snap.data() as Result) : null;
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
