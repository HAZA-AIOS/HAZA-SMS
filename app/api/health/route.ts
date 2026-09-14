import { env } from "cloudflare:workers";

export const dynamic = "force-dynamic";
const PROBE_TIMEOUT_MS = 5000;

async function probe(check: () => Promise<boolean>): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve().then(check).catch(() => false),
      new Promise<false>(resolve => { timer = setTimeout(() => resolve(false), PROBE_TIMEOUT_MS); }),
    ]);
  } finally { clearTimeout(timer); }
}

export async function GET() {
  const [database, storage] = await Promise.all([
    probe(async () => (await env.DB.prepare("SELECT 1 AS ready").first<{ ready: number }>())?.ready === 1),
    probe(async () => { await env.BUCKET.head("__health_probe__"); return true; }),
  ]);
  const ready = database && storage;
  return Response.json({
    service: "mentor-school-sms",
    release: "phase-14",
    status: ready ? "ready" : "degraded",
    checks: { application: true, database, storage },
    checkedAt: new Date().toISOString(),
  }, { status: ready ? 200 : 503, headers: { "cache-control": "no-store" } });
}
