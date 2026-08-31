import { env } from "cloudflare:workers";
import type { AuthzContext } from "./authorization";

export function requireSameOrigin(request: Request) {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") return Response.json({ error: "Cross-site requests are blocked." }, { status: 403 });
  return null;
}

export async function enforceRateLimit(auth: AuthzContext, action: string, limit = 20, windowSeconds = 60) {
  const now = Date.now(), windowStartedAt = now - (now % (windowSeconds * 1000));
  const key = `${auth.organizationId}:${auth.userId}:${action}:${windowStartedAt}`;
  await env.DB.prepare(`INSERT INTO rate_limits (key,organization_id,action,window_started_at,attempts,updated_at) VALUES (?1,?2,?3,?4,1,?5) ON CONFLICT(key) DO UPDATE SET attempts=attempts+1,updated_at=?5`).bind(key, auth.organizationId, action, windowStartedAt, now).run();
  const row = await env.DB.prepare("SELECT attempts FROM rate_limits WHERE key=?1").bind(key).first<{ attempts: number }>();
  return (row?.attempts ?? 1) <= limit;
}

export function safeMetadata(value: unknown) {
  const text = JSON.stringify(value ?? {});
  return text.length > 4000 ? JSON.stringify({ truncated: true }) : text;
}
