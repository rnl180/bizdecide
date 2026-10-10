import { NextResponse } from "next/server";
import { isUploadPath, rateLimit, validateBusinessData } from "@/lib/guard";
import { createBusiness } from "@/lib/store";
import { BusinessInputSchema } from "@/lib/types";

export const runtime = "nodejs";

const MAX_DOCUMENTS = 20;

// The app's data layer: store what the owner uploaded. No analysis here.
export async function POST(req: Request) {
  const limited = rateLimit(req, "business", 20, 10 * 60);
  if (limited) return limited;
  const body = await req.json().catch(() => null);
  const parsed = BusinessInputSchema.safeParse(body?.business);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid business data", issues: parsed.error.issues.slice(0, 5) }, { status: 400 });
  }
  const problems = validateBusinessData(parsed.data);
  if (problems.length) return NextResponse.json({ error: problems[0], issues: problems }, { status: 400 });

  const rawDocs: unknown = body?.documents ?? [];
  if (!Array.isArray(rawDocs)) return NextResponse.json({ error: "documents must be a list of uploaded files" }, { status: 400 });
  if (rawDocs.length > MAX_DOCUMENTS) {
    return NextResponse.json({ error: `At most ${MAX_DOCUMENTS} documents per business` }, { status: 400 });
  }
  const badDoc = rawDocs.findIndex((d) => !isUploadPath(d));
  if (badDoc !== -1) {
    return NextResponse.json({ error: `Document ${badDoc + 1} is not a file uploaded to BizDecide` }, { status: 400 });
  }
  const documents = rawDocs as string[];
  const id = await createBusiness(parsed.data, documents);
  return NextResponse.json({ id });
}
