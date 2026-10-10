import { NextResponse } from "next/server";
import { z } from "zod";
import { createRequest, getBusiness } from "@/lib/store";
import { SERVICES } from "@/lib/types";

export const runtime = "nodejs";

const Body = z.object({ businessId: z.string().min(1), service: z.enum(SERVICES) });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "businessId and a valid service are required" }, { status: 400 });
  const business = await getBusiness(parsed.data.businessId);
  if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 });
  const id = await createRequest(business.id, business.profile.name, parsed.data.service);
  return NextResponse.json({ id });
}
