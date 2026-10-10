import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { bucket } from "@/lib/firebase";

export const runtime = "nodejs";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = ["application/pdf", "image/png", "image/jpeg", "image/webp", "text/csv"];

// Stores supporting documents (SSM certificate, receipts) in Firebase Storage.
// Returns the storage path; WorkBuddy receives these paths via get_business_data.
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "file is required" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Max 10 MB per file" }, { status: 413 });
  if (!ALLOWED.includes(file.type)) return NextResponse.json({ error: "PDF, image or CSV only" }, { status: 415 });

  const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(0, 80);
  const path = `uploads/${randomUUID()}/${safeName}`;
  await bucket().file(path).save(Buffer.from(await file.arrayBuffer()), { contentType: file.type, resumable: false });
  return NextResponse.json({ path });
}
