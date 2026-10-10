import { NextResponse } from "next/server";
import { getBusiness } from "@/lib/store";
import { verifyDataLink } from "@/lib/data-link";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Signed, short-lived download of one business's data, for the BizDecide skills.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(req.url);
  if (!verifyDataLink(id, url.searchParams.get("exp"), url.searchParams.get("sig"))) {
    return NextResponse.json({ error: "Link expired or invalid. Call get_data_link again." }, { status: 403 });
  }
  const b = await getBusiness(id);
  if (!b) return NextResponse.json({ error: "Business not found" }, { status: 404 });
  const { documents: _docs, ...data } = b as typeof b & { documents?: unknown };
  return NextResponse.json(data, { headers: { "cache-control": "no-store" } });
}
