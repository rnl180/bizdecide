import { after, NextResponse } from "next/server";
import { z } from "zod";
import { claudeEnabled, processRequest } from "@/lib/claude-cfo";
import { rateLimit } from "@/lib/guard";
import { createRequest, getBusiness, listRequestsByStatus } from "@/lib/store";
import { SERVICES } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 600; // the Claude CFO team runs after the response (see after() below)

const Body = z.object({ businessId: z.string().min(1), service: z.enum(SERVICES) });
const QUEUE_CAP = 25; // requests waiting to be picked up

export async function POST(req: Request) {
  const limited = rateLimit(req, "request", 20, 10 * 60);
  if (limited) return limited;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "businessId and a valid service are required" }, { status: 400 });
  const business = await getBusiness(parsed.data.businessId);
  if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 });
  const queued = await listRequestsByStatus(["submitted"], QUEUE_CAP);
  if (queued.length >= QUEUE_CAP) {
    return NextResponse.json(
      { error: "BizDecide is busy right now. Please try again in a few minutes." },
      { status: 503, headers: { "Retry-After": "300" } },
    );
  }
  const id = await createRequest(business.id, business.profile.name, parsed.data.service, business.profile.market, business.profile.language);
  // With a Claude API key the server runs the CFO team itself; without one, WorkBuddy picks the request up via /api/mcp.
  if (claudeEnabled()) after(() => processRequest(id));
  return NextResponse.json({ id });
}
