import { z } from "zod";

// Owner-entered totals, never agent estimates or automatically verified bank evidence.
export const ActionOutcomeInputSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("prepared"), revision: z.number().int().nonnegative() }).strict(),
  z.object({ status: z.literal("sent"), revision: z.number().int().nonnegative() }).strict(),
  z.object({
    status: z.literal("recorded"),
    revision: z.number().int().nonnegative(),
    amountRm: z.number().min(0).max(999_999_999.99)
      .refine((n) => n === Math.round(n * 100) / 100, "Use at most two decimal places"),
    note: z.string().trim().min(1).max(500),
  }).strict(),
]);
export type ActionOutcomeInput = z.infer<typeof ActionOutcomeInputSchema>;
export type ActionOutcome = ActionOutcomeInput & { source: "owner_reported"; updatedAt: string };

export class ActionOutcomeError extends Error {
  constructor(message: string, public status: 404 | 409) { super(message); }
}
