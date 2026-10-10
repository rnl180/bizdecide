import { after, NextResponse } from "next/server";
import { answerOwnerMessage, claudeEnabled, processRequest, STALE_RUN_MS } from "@/lib/claude-cfo";
import { getBusiness, getOpenQuestion, getRequest, getResult, isStaleRun, listMessages } from "@/lib/store";
import { buildStatements } from "@/lib/statements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 600;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const request = await getRequest(id);
  if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const done = request.status === "completed";
  const [question, result, messages, business] = await Promise.all([
    request.status === "waiting_for_user" ? getOpenQuestion(id) : Promise.resolve(null),
    done ? getResult(id) : Promise.resolve(null),
    done ? listMessages(id) : Promise.resolve([]),
    done ? getBusiness(request.businessId) : Promise.resolve(null),
  ]);
  // The figure cards on the brief: added up in code from the owner's own rows.
  const statements = business ? buildStatements(business) : null;
  // The brief page polls this route, so it also restarts work a server restart left behind.
  if (claudeEnabled()) {
    const older = (at: string | undefined, ms: number) => Boolean(at) && Date.now() - Date.parse(at!) > ms;
    if ((request.status === "submitted" && older(request.createdAt, 15_000)) || isStaleRun(request, STALE_RUN_MS)) {
      after(() => processRequest(id));
    }
    for (const m of messages) {
      if ((m.status === "open" && older(m.createdAt, 15_000)) || (m.status === "claimed" && older(m.claimedAt, 3 * 60_000))) {
        after(() => answerOwnerMessage(m.id));
      }
    }
  }
  const { claimToken: _claimToken, ...publicRequest } = request;
  return NextResponse.json({ request: publicRequest, question, result, messages, statements });
}
