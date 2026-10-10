import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { rateLimit } from "@/lib/guard";
import { storeMode } from "@/lib/store";

export const runtime = "nodejs";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = ["application/pdf", "image/png", "image/jpeg", "image/webp", "text/csv"];

// Stores supporting documents (SSM certificate, receipts).
// Firebase Storage in the cloud; .data/uploads/ on a laptop (WorkBuddy can read that folder directly).
// Returns the storage path; WorkBuddy receives these paths via get_business_data.
export async function POST(req: Request) {
  const limited = rateLimit(req, "upload", 40, 10 * 60);
  if (limited) return limited;
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "file is required" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Max 10 MB per file" }, { status: 413 });
  if (!ALLOWED.includes(file.type)) return NextResponse.json({ error: "PDF, image or CSV only" }, { status: 415 });

  const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(0, 80);
  const rel = `uploads/${randomUUID()}/${safeName}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  if (storeMode === "local") {
    const abs = path.join(process.cwd(), ".data", rel);
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, bytes);
    return NextResponse.json({ path: abs });
  }

  const { bucket } = await import("@/lib/firebase");
  await bucket().file(rel).save(bytes, { contentType: file.type, resumable: false });
  return NextResponse.json({ path: rel });
}
