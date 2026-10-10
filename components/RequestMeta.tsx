import type { RequestStatus, Service } from "@/lib/types";
import { Icon, type IconName } from "./Icon";

export const STATUS: Record<RequestStatus, { label: string; cls: string }> = {
  submitted: { label: "Queued", cls: "queued" },
  processing: { label: "Working", cls: "live" },
  waiting_for_user: { label: "Needs your answer", cls: "waiting" },
  completed: { label: "Ready", cls: "done" },
  failed: { label: "Stopped", cls: "failed" },
};

export const SERVICE_ICONS: Record<Service, IconName> = {
  cfo_brief: "file",
  bookkeeping: "calculator",
  procurement: "truck",
  funding: "landmark",
};

/** Every status, priority and verdict shows an icon with its word, so colour is never the only signal. */
export const STATUS_ICON: Record<RequestStatus, IconName> = {
  submitted: "clock",
  processing: "spinner",
  waiting_for_user: "helpCircle",
  completed: "checkCircle",
  failed: "xCircle",
};
export const PRIORITY_ICON: Record<"urgent" | "important" | "opportunity", IconName> = {
  urgent: "alarmClock",
  important: "flag",
  opportunity: "trendingUp",
};
export const VERDICT_ICON: Record<"eligible" | "conditional" | "need_info", IconName> = {
  eligible: "checkCircle",
  conditional: "alertTriangle",
  need_info: "helpCircle",
};

export function StatusIcon({ status }: { status: RequestStatus }) {
  return <Icon name={STATUS_ICON[status]} size={14} className={status === "processing" ? "spin" : undefined} />;
}

/** `label` overrides the English label (e.g. APP[lang].status[status]). */
export function StatusBadge({ status, label }: { status: RequestStatus; label?: string }) {
  const s = STATUS[status];
  return (
    <span className={`status ${s.cls}`}>
      <StatusIcon status={status} /> {label ?? s.label}
    </span>
  );
}
