import { after, NextResponse } from "next/server";
import { z } from "zod";
import { answerOwnerMessage, claudeEnabled } from "@/lib/claude-cfo";
import { rateLimit } from "@/lib/guard";
import { createMessage, getRequest, listMessages, withoutClaimToken } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const Body = z.object({ question: z.string().trim().min(3).max(500) });
const MAX_WAITING = 3; // unanswered at once, so one brief can't swamp the on-duty agent
const MAX_TOTAL = 30;

// "Ask your CFO": store the owner's follow-up question. Claude answers it (or the on-duty WorkBuddy agent, without an API key).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(req, "ask", 20, 10 * 60);
  if (limited) return limited;
  const { id } = await params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Type a question (up to 500 characters)" }, { status: 400 });
  const r = await getRequest(id);
  if (!r) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (r.status !== "completed") return NextResponse.json({ error: "Your brief isn't ready yet" }, { status: 409 });
  const thread = await listMessages(id);
  if (thread.filter((m) => m.status !== "answered").length >= MAX_WAITING) {
    return NextResponse.json({ error: "Your CFO is still answering. Ask again once those answers are in." }, { status: 429 });
  }
  if (thread.length >= MAX_TOTAL) return NextResponse.json({ error: "This brief has reached its question limit" }, { status: 429 });
  const messageId = await createMessage(id, r.businessId, parsed.data.question);
  if (claudeEnabled()) after(() => answerOwnerMessage(messageId));
  return NextResponse.json({ id: messageId });
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return NextResponse.json({ messages: (await listMessages(id)).map(withoutClaimToken) });
}
