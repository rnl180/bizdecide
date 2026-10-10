import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/guard";
import { answerQuestion, getQuestion } from "@/lib/store";

export const runtime = "nodejs";

const Body = z.object({ answer: z.string().min(1).max(500), otherText: z.string().max(500).optional() });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(req, "answer", 30, 10 * 60);
  if (limited) return limited;
  const { id } = await params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const tooLong = parsed.error.issues.some((i) => i.code === "too_big");
    return NextResponse.json({ error: tooLong ? "Answer is too long (max 500 characters)" : "answer is required" }, { status: 400 });
  }
  const q = await getQuestion(id);
  if (!q) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (q.status !== "open") return NextResponse.json({ error: "This question is already closed" }, { status: 409 });
  if (parsed.data.answer === "__other__" && !parsed.data.otherText?.trim()) {
    return NextResponse.json({ error: "Please type your answer" }, { status: 400 });
  }
  await answerQuestion(id, parsed.data.answer, parsed.data.otherText?.trim() || undefined);
  return NextResponse.json({ ok: true });
}
