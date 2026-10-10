import { NextResponse } from "next/server";
import { isSkillId, MAX_ZIP_BYTES, packSkill } from "@/lib/skills";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Serves a WorkBuddy skill as a .zip (SKILL.md at the root) for Skills → Import.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isSkillId(id)) return NextResponse.json({ error: "Unknown skill" }, { status: 404 });

  const pack = await packSkill(id);
  if (!pack) return NextResponse.json({ error: "This skill isn't packaged yet" }, { status: 404 });
  if (pack.zip.byteLength > MAX_ZIP_BYTES) {
    return NextResponse.json({ error: "Skill package is over WorkBuddy's 10 MB import limit" }, { status: 413 });
  }

  return new Response(Buffer.from(pack.zip), {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${pack.fileName}"`,
      "cache-control": "no-store",
    },
  });
}
