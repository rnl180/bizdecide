import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/guard";
import { normalizeCode, pollView, setVoterCookie, voterCookie } from "@/lib/poll";
import { getQuestionByPollCode } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The audience poll for one owner question: GET /api/polls/ABC234 → question, options, tally, this browser's vote.
 * Phones poll it every 2 s, so the limit is per browser (cookie) and IP: a venue behind one NAT is not one client.
 */
export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const code = normalizeCode((await params).code);
  if (!code) return NextResponse.json({ error: "Poll not found" }, { status: 404 });
  const voter = voterCookie(req);
  const limited = rateLimit(req, `poll:${code}:${voter.id}`, 600, 600);
  if (limited) return limited;
  const q = await getQuestionByPollCode(code);
  if (!q) return NextResponse.json({ error: "Poll not found" }, { status: 404 });
  const res = NextResponse.json(await pollView(q, voter.fresh ? null : voter.id), { headers: { "cache-control": "no-store" } });
  if (voter.fresh) setVoterCookie(res, req, voter.id);
  return res;
}
