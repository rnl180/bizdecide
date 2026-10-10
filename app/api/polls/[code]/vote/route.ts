import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/guard";
import { normalizeCode, pollView, setVoterCookie, voterCookie, voterHash } from "@/lib/poll";
import { addVote, getQuestionByPollCode } from "@/lib/store";

export const runtime = "nodejs";

const Body = z.object({ option: z.string().min(1).max(200) });

/**
 * One audience vote: POST /api/polls/ABC234/vote {option}. No login; one vote per browser cookie per question.
 * Votes only add to the tally. The owner's (or presenter's) answer on /api/questions/[id]/answer closes the question.
 * Its own rate limit, separate from the answer route's, so a whole room behind one NAT can vote.
 */
export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const code = normalizeCode((await params).code);
  if (!code) return NextResponse.json({ error: "Poll not found" }, { status: 404 });
  const limited = rateLimit(req, `vote:${code}`, 300, 600);
  if (limited) return limited;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "option is required" }, { status: 400 });
  const q = await getQuestionByPollCode(code);
  if (!q) return NextResponse.json({ error: "Poll not found" }, { status: 404 });
  if (!q.options.includes(parsed.data.option)) return NextResponse.json({ error: "Not one of the options" }, { status: 400 });

  const voter = voterCookie(req);
  const reply = async (status: number, extra: Record<string, unknown> = {}) => {
    const res = NextResponse.json({ ...(await pollView(q, voter.id)), ...extra }, { status, headers: { "cache-control": "no-store" } });
    if (voter.fresh) setVoterCookie(res, req, voter.id);
    return res;
  };
  if (q.status !== "open") return reply(409, { error: "This question is already closed" });
  const added = await addVote(q.id, parsed.data.option, voterHash(voter.id, q.id));
  return added ? reply(200, { ok: true }) : reply(409, { error: "You have already voted" });
}
