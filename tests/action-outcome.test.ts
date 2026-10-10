import assert from "node:assert/strict";
import test from "node:test";
import { ActionOutcomeInputSchema } from "../lib/action-outcome";

test("outcomes require explicit owner totals and cannot claim bank verification", () => {
  const result = { status: "recorded", revision: 0, amountRm: 82.13, note: "September savings" };
  assert.ok(ActionOutcomeInputSchema.safeParse(result).success);
  for (const amountRm of [-1, Infinity, NaN, 0.001, 642.00000001, 1e12, "642", null]) {
    assert.equal(ActionOutcomeInputSchema.safeParse({ ...result, amountRm }).success, false);
  }
  for (const input of [
    { ...result, note: " " }, { ...result, note: "x".repeat(501) },
    { ...result, amountRm: undefined }, { ...result, revision: -1 },
    { ...result, source: "bank_verified" }, { ...result, updatedAt: "invented" },
    { ...result, status: "sent" }, { ...result, status: "prepared" },
  ]) assert.equal(ActionOutcomeInputSchema.safeParse(input).success, false);
});
