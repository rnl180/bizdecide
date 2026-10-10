import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/guard";
import { getBusiness, getRequest } from "@/lib/store";
import { SOURCE_TABLES, type SourceTable } from "@/lib/types";
import { sourceRows } from "@/lib/source-rows";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ROWS = 200;
const MAX_KEYS = 50;

/**
 * The data rows behind a figure in the brief: GET /api/requests/[id]/rows?table=purchases&keys=KCB-26-1187,KCB-26-1229
 * Optional &item=… keeps only the purchase lines for that item.
 * The request id is already the brief's public handle, so it needs no other secret.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(req, "rows", 120, 600);
  if (limited) return limited;
  const { id } = await params;
  const url = new URL(req.url);
  const table = url.searchParams.get("table") as SourceTable | null;
  if (!table || !SOURCE_TABLES.includes(table)) {
    return NextResponse.json({ error: `table must be one of ${SOURCE_TABLES.join(", ")}` }, { status: 400 });
  }
  const keys = (url.searchParams.get("keys") ?? "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean)
    .slice(0, MAX_KEYS);
  if (!keys.length) return NextResponse.json({ error: "keys is required" }, { status: 400 });

  const request = await getRequest(id);
  if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const business = await getBusiness(request.businessId);
  if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 });

  const item = table === "purchases" ? url.searchParams.get("item")?.trim() : undefined;
  const all = sourceRows(business, { table, keys, item });
  return NextResponse.json(
    { table, keys, rows: all.slice(0, MAX_ROWS), total: all.length, truncated: all.length > MAX_ROWS },
    { headers: { "cache-control": "no-store" } },
  );
}
