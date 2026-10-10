import type { RequestStatus, Service } from "@/lib/types";
import type { IconName } from "./Icon";

export const STATUS: Record<RequestStatus, { label: string; cls: string }> = {
  submitted: { label: "Queued", cls: "queued" },
  processing: { label: "Working", cls: "live" },
  waiting_for_user: { label: "Needs your answer", cls: "waiting" },
  completed: { label: "Ready", cls: "done" },
  failed: { label: "Stopped", cls: "failed" },
};

export const SERVICE_ICONS: Record<Service, IconName> = {
  cfo_brief: "clipboard",
  bookkeeping: "calculator",
  procurement: "truck",
  funding: "landmark",
};

/** `label` overrides the English label (e.g. APP[lang].status[status]). */
export function StatusBadge({ status, label }: { status: RequestStatus; label?: string }) {
  const s = STATUS[status];
  return (
    <span className={`status ${s.cls}`}>
      <span className="dot" /> {label ?? s.label}
    </span>
  );
}
