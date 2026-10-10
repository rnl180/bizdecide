import { NextResponse } from "next/server";
import { getOpenQuestion, getRequest, getResult, listMessages } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const request = await getRequest(id);
  if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const done = request.status === "completed";
  const [question, result, messages] = await Promise.all([
    request.status === "waiting_for_user" ? getOpenQuestion(id) : Promise.resolve(null),
    done ? getResult(id) : Promise.resolve(null),
    done ? listMessages(id) : Promise.resolve([]),
  ]);
  return NextResponse.json({ request, question, result, messages });
}
