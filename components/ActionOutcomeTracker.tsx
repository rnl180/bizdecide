"use client";

import { useState } from "react";
import type { ActionDoc } from "@/lib/types";
import type { ActionOutcomeInput } from "@/lib/action-outcome";
import type { ImpactKind } from "@/lib/impact";
import type { Lang } from "@/lib/i18n";
import { ACT } from "@/lib/i18n-actions";

export function ActionOutcomeTracker({ action, kind, lang, onSave }: {
  action: ActionDoc; kind: ImpactKind; lang: Lang;
  onSave: (id: string, input: ActionOutcomeInput, lang: Lang) => Promise<void>;
}) {
  const t = ACT[lang].outcome;
  const outcome = action.outcome;
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState<ActionOutcomeInput["status"]>("sent");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const date = outcome && new Date(outcome.updatedAt).toLocaleDateString(ACT[lang].dateLocale);

  return <section className="ax-outcome" aria-label={t.title}>
    <div className="ax-outcome-head">
      <strong>{t[outcome?.status ?? "prepared"]}</strong>
      <button type="button" className="btn btn-secondary btn-sm no-print" disabled={editing} onClick={() => {
        setStatus(outcome?.status ?? "sent");
        setAmount(outcome?.status === "recorded" ? String(outcome.amountRm) : "");
        setNote(outcome?.status === "recorded" ? outcome.note : "");
        setRevision(outcome?.revision ?? 0);
        setError(""); setEditing(true);
      }}>{t.edit}</button>
    </div>
    {outcome?.status === "recorded" && <>
      <p><b>{t.amount[kind]}: {outcome.amountRm.toLocaleString(ACT[lang].dateLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b></p>
      <p className="ax-outcome-note">{outcome.note}</p>
    </>}
    {outcome && <p className="ax-outcome-source">{t.provenance} · {date}</p>}
    {editing && <form className="ax-outcome-form no-print" onSubmit={async (event) => {
      event.preventDefault();
      if (busy) return;
      setBusy(true); setError("");
      try {
        const input: ActionOutcomeInput = status === "recorded"
          ? { status, revision, amountRm: Number(amount), note }
          : { status, revision };
        await onSave(action.id, input, lang);
        setEditing(false);
      } catch (e) { setError(e instanceof Error && e.name !== "TypeError" ? e.message : t.error); }
      finally { setBusy(false); }
    }}>
      <label>{t.status}<select value={status} disabled={busy} onChange={(e) => setStatus(e.target.value as typeof status)}>
        <option value="prepared">{t.prepared}</option><option value="sent">{t.sent}</option><option value="recorded">{t.recorded}</option>
      </select></label>
      {status === "recorded" && <>
        <label>{t.amount[kind]}<input type="number" inputMode="decimal" min="0" max="999999999.99" step="0.01" required disabled={busy} value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
        <label>{t.note}<textarea required maxLength={500} disabled={busy} value={note} onChange={(e) => setNote(e.target.value)} /></label>
      </>}
      <p className="ax-outcome-source">{t.confirmation}</p>
      <div className="ax-btns">
        <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>{t.save}</button>
        <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => setEditing(false)}>{t.cancel}</button>
      </div>
      {error && <p role="alert">{error}</p>}
    </form>}
  </section>;
}
