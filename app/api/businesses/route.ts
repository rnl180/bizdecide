import { NextResponse } from "next/server";
import { createBusiness } from "@/lib/store";
import { BusinessInputSchema } from "@/lib/types";

export const runtime = "nodejs";

// The app's data layer: store what the owner uploaded. No analysis here.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = BusinessInputSchema.safeParse(body?.business);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid business data", issues: parsed.error.issues.slice(0, 5) }, { status: 400 });
  }
  const documents: string[] = Array.isArray(body?.documents) ? body.documents.filter((d: unknown) => typeof d === "string") : [];
  const id = await createBusiness(parsed.data, documents);
  return NextResponse.json({ id });
}
