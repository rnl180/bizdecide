import { z } from "zod";
import { DecisionSchema, EvidenceSchema, ResultSchema, VerificationSchema, type BusinessInput, type Result, type SourceRef } from "./types";
import { sourceRows } from "./source-rows";
import { financialImpactChecks } from "./financial-impact";

export class ResultDeliveryError extends Error {}

// Keep ResultSchema permissive for reading historical briefs. Enforce these rules on new deliveries.
export const DeliveryResultSchema = ResultSchema.extend({
  decisions: z.array(DecisionSchema.extend({
    evidence: z.array(EvidenceSchema.extend({ label: z.string().trim().min(1) })).min(1),
  })).min(1).max(5),
  verification: z.array(VerificationSchema.extend({ check: z.string().trim().min(1) })).min(1),
}).superRefine((result, ctx) => {
  if (!result.verification.some((v) => v.passed && (!v.status || v.status === "passed"))) {
    ctx.addIssue({ code: "custom", path: ["verification"], message: "Include at least one check that actually passed." });
  }
  result.verification.forEach((v, i) => {
    if (v.status && v.passed !== (v.status === "passed")) {
      ctx.addIssue({ code: "custom", path: ["verification", i], message: "passed must agree with the check's status." });
    }
  });
});

/** Require inspectable evidence; check source keys against this business, never another brief. */
export function validateResultDelivery(input: Result, business: BusinessInput): Result {
  const parsed = DeliveryResultSchema.safeParse(input);
  if (!parsed.success) {
    throw new ResultDeliveryError(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  }
  const result = parsed.data;
  const checkSource = (source: SourceRef, label: string) => {
    for (const key of source.keys) {
      if (!key.trim() || !sourceRows(business, { ...source, keys: [key] }).length) {
        throw new ResultDeliveryError(`${label}: source key '${key}' was not found in this business's ${source.table} data. Correct or remove the unsupported finding.`);
      }
    }
  };
  for (const [index, decision] of result.decisions.entries()) {
    let anchored = false;
    for (const evidence of decision.evidence) {
      if (evidence.source) checkSource(evidence.source, `Decision ${index + 1}`);
      if (evidence.url) {
        let url: URL;
        try { url = new URL(evidence.url); } catch { throw new ResultDeliveryError(`Decision ${index + 1}: use a valid evidence URL.`); }
        if (!['http:', 'https:'].includes(url.protocol)) throw new ResultDeliveryError(`Decision ${index + 1}: evidence URLs must use HTTP or HTTPS.`);
      }
      if ((evidence.source || evidence.url) && evidence.basis !== "assumption") anchored = true;
    }
    if (!anchored) throw new ResultDeliveryError(`Decision ${index + 1}: include uploaded source rows or a source URL. A label or assumption alone is not proof.`);
  }
  for (const number of result.numbers ?? []) {
    if (number.source) checkSource(number.source, `Number '${number.label}'`);
  }
  const checks = financialImpactChecks(business);
  const used = new Set<string>();
  const calculations: string[] = [];
  for (const [index, decision] of result.decisions.entries()) {
    const label = `Decision ${index + 1}`;
    if (decision.impactRm === undefined) {
      if (decision.impactCheckId) throw new ResultDeliveryError(`${label}: impactCheckId requires impactRm.`);
      continue;
    }
    const check = checks.find((c) => c.id === decision.impactCheckId);
    if (!check) throw new ResultDeliveryError(`${label}: impactRm needs a supported impactCheckId from get_impact_checks. Omit the financial impact when it cannot be calculated from uploaded data.`);
    if (decision.impactType !== check.impactType) throw new ResultDeliveryError(`${label}: impactType must be '${check.impactType}' for this calculation.`);
    if (Math.abs(decision.impactRm - check.impactRm) > 0.000001) {
      throw new ResultDeliveryError(`${label}: impactRm must be RM${check.impactRm.toFixed(2)}, recalculated from uploaded rows. ${check.formula}`);
    }
    if (used.has(check.id)) throw new ResultDeliveryError(`${label}: this financial effect is already counted in another decision.`);
    for (const source of check.sources) {
      for (const key of source.keys) {
        const covered = decision.evidence.some((e) => e.basis !== "assumption" && e.source?.table === source.table &&
          e.source.keys.includes(key) && (!source.item || e.source.item === source.item));
        if (!covered) throw new ResultDeliveryError(`${label}: include calculation evidence ${source.table} '${key}'${source.item ? `, item '${source.item}'` : ""}.`);
      }
    }
    used.add(check.id);
    calculations.push(`${label}: ${check.formula}`);
    // Preserve the conditions behind projections; they are not optional agent claims.
    for (const assumption of check.assumptions) if (!result.assumptions.includes(assumption)) result.assumptions.push(assumption);
  }
  if (calculations.length) result.verification.push({
    check: "Server recalculated financial impacts from uploaded data", passed: true, status: "passed", detail: calculations.join("; "),
  });
  return result;
}
