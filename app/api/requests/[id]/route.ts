import { after, NextResponse } from "next/server";
import { answerOwnerMessage, claudeEnabled, processRequest } from "@/lib/claude-cfo";
import { getOpenQuestion, getRequest, getResult, listMessages } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 600;

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
  // The brief page polls this route, so it also restarts work a server restart left behind.
  if (claudeEnabled()) {
    const older = (at: string | undefined, ms: number) => Boolean(at) && Date.now() - Date.parse(at!) > ms;
    if (request.status === "submitted" && older(request.createdAt, 15_000)) after(() => processRequest(id));
    for (const m of messages) {
      if ((m.status === "open" && older(m.createdAt, 15_000)) || (m.status === "claimed" && older(m.claimedAt, 3 * 60_000))) {
        after(() => answerOwnerMessage(m.id));
      }
    }
  }
  return NextResponse.json({ request, question, result, messages });
}
