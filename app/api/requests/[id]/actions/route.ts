import { after, NextResponse } from "next/server";
import { claudeEnabled, processAction } from "@/lib/claude-cfo";
import { z } from "zod";
import { rateLimit } from "@/lib/guard";
import { createAction, getRequest, getResult, listActions, withoutClaimToken } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const Body = z.object({
  decisionIndex: z.number().int().min(0).max(9),
  lang: z.enum(["en", "ms"]).default("en"),
});
const MAX_ACTIVE = 3; // waiting or in progress at once, so one brief can't swamp the on-duty agent
const MAX_TOTAL = 20;

// "Approve & act": the owner approves one decision. Claude writes it (or the on-duty WorkBuddy agent, without an API key).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(req, "act", 20, 10 * 60);
  if (limited) return limited;
  const { id } = await params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Pick a decision to approve" }, { status: 400 });
  const r = await getRequest(id);
  if (!r) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (r.status !== "completed") return NextResponse.json({ error: "Your brief isn't ready yet" }, { status: 409 });
  const result = await getResult(id);
  const decision = result?.decisions[parsed.data.decisionIndex];
  if (!decision) return NextResponse.json({ error: "That decision doesn't exist" }, { status: 400 });

  const all = await listActions(id);
  // One live action per decision: approving twice returns the one already queued, in progress or done.
  const existing = all.filter((a) => a.decisionIndex === parsed.data.decisionIndex && a.status !== "failed").at(-1);
  if (existing) {
    if (claudeEnabled() && existing.status !== "done") after(() => processAction(existing.id));
    return NextResponse.json({ action: withoutClaimToken(existing) });
  }
  if (all.filter((a) => a.status === "queued" || a.status === "working").length >= MAX_ACTIVE) {
    return NextResponse.json({ error: "Your CFO team is still on the others. Approve this one when they're done." }, { status: 429 });
  }
  if (all.length >= MAX_TOTAL) return NextResponse.json({ error: "This brief has reached its approval limit" }, { status: 429 });

  const action = await createAction({
    requestId: id,
    businessId: r.businessId,
    decisionIndex: parsed.data.decisionIndex,
    decisionTitle: decision.title,
    lang: parsed.data.lang,
  });
  if (claudeEnabled()) after(() => processAction(action.id));
  return NextResponse.json({ action: withoutClaimToken(action) });
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actions = await listActions(id);
  // The brief page polls this while an action runs, so it also restarts work a server restart left behind.
  if (claudeEnabled()) {
    const older = (at: string | undefined, ms: number) => Boolean(at) && Date.now() - Date.parse(at!) > ms;
    for (const a of actions) {
      if ((a.status === "queued" && older(a.createdAt, 15_000)) || (a.status === "working" && older(a.claimedAt, 5 * 60_000))) {
        after(() => processAction(a.id));
      }
    }
  }
  return NextResponse.json({ actions: actions.map(withoutClaimToken) });
}
