import { NextResponse } from "next/server";
import { getOpenQuestion, getRequest, getResult } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const request = await getRequest(id);
  if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const [question, result] = await Promise.all([
    request.status === "waiting_for_user" ? getOpenQuestion(id) : Promise.resolve(null),
    request.status === "completed" ? getResult(id) : Promise.resolve(null),
  ]);
  return NextResponse.json({ request, question, result });
}
