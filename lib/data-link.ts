import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Short-lived, signed download links for one business's data.
 * The MCP tool get_data_link hands one to WorkBuddy; the BizDecide skills download the data
 * themselves, so the agent never has to read hundreds of rows and no secret lives in a skill.
 */

const g = globalThis as unknown as { __bizdecideLinkSecret?: string };
const secret = () => process.env.BIZDECIDE_MCP_KEY || (g.__bizdecideLinkSecret ??= randomBytes(32).toString("hex"));

let origin = process.env.BIZDECIDE_PUBLIC_URL ?? "";

/** Remember the public origin from the incoming MCP request (works behind Nginx/Caddy). */
export function rememberOrigin(req: Request) {
  if (process.env.BIZDECIDE_PUBLIC_URL) return;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!host) return;
  const local = /^(localhost|127\.|\[::1\])/.test(host);
  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || (local ? "http" : "https");
  origin = `${proto}://${host}`;
}

const sign = (id: string, exp: number) => createHmac("sha256", secret()).update(`${id}.${exp}`).digest("hex").slice(0, 32);

export function makeDataLink(businessId: string, ttlSeconds = 900) {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  return `${origin}/api/data/${encodeURIComponent(businessId)}?exp=${exp}&sig=${sign(businessId, exp)}`;
}

export function verifyDataLink(businessId: string, exp: string | null, sig: string | null) {
  const e = Number(exp);
  if (!sig || !Number.isFinite(e) || e < Date.now() / 1000) return false;
  const want = Buffer.from(sign(businessId, e));
  const got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got);
}
