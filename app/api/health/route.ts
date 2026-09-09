import { env } from "cloudflare:workers";

export const dynamic = "force-dynamic";

export async function GET() {
  const checkedAt = new Date().toISOString();
  try {
    const database = await env.DB.prepare("SELECT 1 AS ready").first<{ ready: number }>();
    await env.BUCKET.head("__health_probe__");
    const ready = database?.ready === 1;
    return Response.json(
      {
        service: "mentor-school-sms",
        release: "phase-14",
        status: ready ? "ready" : "degraded",
        checks: { application: true, database: database?.ready === 1, storage: true },
        checkedAt,
      },
      { status: ready ? 200 : 503, headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    console.error("Production health check failed", error);
    return Response.json(
      {
        service: "mentor-school-sms",
        release: "phase-14",
        status: "unavailable",
        checks: { application: true, database: false, storage: false },
        checkedAt,
      },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
