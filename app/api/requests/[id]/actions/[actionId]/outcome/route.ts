import { NextResponse } from "next/server";
import { ActionOutcomeError, ActionOutcomeInputSchema } from "@/lib/action-outcome";
import { rateLimit } from "@/lib/guard";
import { recordActionOutcome, withoutClaimToken } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string; actionId: string }> }) {
  const limited = rateLimit(req, "outcome", 30, 10 * 60);
  if (limited) return limited;
  const parsed = ActionOutcomeInputSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose a status; a recorded result needs an amount (up to two decimals) and a short explanation." }, { status: 400 });
  const { id, actionId } = await params;
  try {
    const action = await recordActionOutcome(id, actionId, parsed.data);
    return NextResponse.json({ action: withoutClaimToken(action) });
  } catch (error) {
    if (error instanceof ActionOutcomeError) return NextResponse.json({ error: error.message }, { status: error.status });
    throw error;
  }
}
