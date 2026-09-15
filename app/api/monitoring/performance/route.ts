import { env } from "cloudflare:workers";
import { authorize } from "../../../../lib/authorization";
import { moduleFromRoute, normalizeApiRoute } from "../../../../lib/monitoring-analytics";
import { enforceRateLimit, requireSameOrigin } from "../../../../lib/security";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const sameOrigin = requireSameOrigin(request);
  if (sameOrigin) return sameOrigin;
  const auth = await authorize("monitoring.view");
  if (!auth || !auth.organizationWide)
    return Response.json({ error: "Performance telemetry is not permitted." }, { status: 403 });
  if (!(await enforceRateLimit(auth, "monitoring.performance.record", 600, 300)))
    return Response.json({ error: "Performance sample limit reached." }, { status: 429 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const route = normalizeApiRoute(body?.route);
  const method = String(body?.method ?? "GET").toUpperCase().slice(0, 10);
  const statusCode = Math.round(Number(body?.statusCode));
  const durationMs = Math.round(Number(body?.durationMs));
  if (!route || !/^(GET|POST|PUT|PATCH|DELETE|HEAD)$/.test(method) || !Number.isFinite(statusCode) || statusCode < 0 || statusCode > 599 || !Number.isFinite(durationMs) || durationMs < 0 || durationMs > 120000)
    return Response.json({ error: "Invalid performance sample." }, { status: 400 });
  const setting = await env.DB.prepare("SELECT slow_request_threshold_ms FROM operational_monitoring_settings WHERE organization_id=?1").bind(auth.organizationId).first<{slow_request_threshold_ms:number}>();
  const threshold = setting?.slow_request_threshold_ms ?? 1000;
  await env.DB.batch([
    env.DB.prepare("INSERT INTO api_performance_samples (id,organization_id,user_id,route,module,method,status_code,duration_ms,is_slow) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)").bind(crypto.randomUUID(), auth.organizationId, auth.userId, route, moduleFromRoute(route), method, statusCode, durationMs, durationMs >= threshold ? 1 : 0),
    env.DB.prepare("DELETE FROM api_performance_samples WHERE organization_id=?1 AND created_at<?2").bind(auth.organizationId, Date.now() - 30 * 86400000),
  ]);
  return Response.json({ ok: true }, { status: 202, headers: { "cache-control": "private, no-store" } });
}
