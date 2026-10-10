import { useSyncExternalStore } from "react";
import { impactTotals } from "./impact";
import type { RequestDoc, RequestStatus, Result, Service } from "./types";

/**
 * "My requests": the requests this browser has sent or opened, kept in localStorage.
 * There are no accounts, so this list lives on the device only; the requests
 * themselves stay in Firestore and are opened by id.
 */

export interface SavedRequest {
  id: string;
  businessName: string;
  service: Service;
  market?: string; // for the currency of impactRm (RM, S$)
  status: RequestStatus;
  createdAt: string;
  headline?: string; // set once the brief is ready
  impactRm?: number; // total monthly impact of the decisions
}

const KEY = "bizdecide:my-requests:v1";
const CHANGE = "bizdecide:my-requests-change";
const MAX = 50;
const EMPTY: SavedRequest[] = [];

let cachedRaw: string | null = null;
let cached: SavedRequest[] = EMPTY;

const isSaved = (x: unknown): x is SavedRequest =>
  typeof x === "object" && x !== null && typeof (x as SavedRequest).id === "string" && typeof (x as SavedRequest).businessName === "string";

function read(): SavedRequest[] {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return EMPTY; // storage blocked (private mode, disabled site data)
  }
  if (raw === cachedRaw) return cached;
  cachedRaw = raw;
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    cached = Array.isArray(parsed) ? parsed.filter(isSaved) : EMPTY;
  } catch {
    cached = EMPTY;
  }
  return cached;
}

function write(list: SavedRequest[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    /* storage full or blocked: the list just won't persist */
  }
  window.dispatchEvent(new Event(CHANGE));
}

/** Adds the request or updates what we know about it. Newest first. */
export function saveRequest(entry: SavedRequest) {
  const list = read();
  const existing = list.find((r) => r.id === entry.id);
  const known = Object.fromEntries(Object.entries(entry).filter(([, v]) => v !== undefined)); // don't erase what we had
  const merged = { ...existing, ...known } as SavedRequest;
  if (existing && JSON.stringify(existing) === JSON.stringify(merged)) return;
  const next = [merged, ...list.filter((r) => r.id !== entry.id)];
  next.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  write(next);
}

/** What we keep about a request, from the API's { request, result }. */
export function toSaved(request: RequestDoc, result: Result | null): SavedRequest {
  const impact = result ? impactTotals(result.decisions).monthly : 0; // one-off and funding amounts are not monthly
  return {
    id: request.id,
    businessName: request.businessName,
    service: request.service,
    market: request.market,
    status: request.status,
    createdAt: request.createdAt,
    headline: result?.headline,
    impactRm: impact || undefined,
  };
}

export function removeRequest(id: string) {
  write(read().filter((r) => r.id !== id));
}

export function clearRequests() {
  write([]);
}

function subscribe(onChange: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY || e.key === null) onChange();
  };
  window.addEventListener("storage", onStorage); // other tabs
  window.addEventListener(CHANGE, onChange); // this tab
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE, onChange);
  };
}

/** The saved list; empty during server render and before hydration. */
export function useMyRequests(): SavedRequest[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}
