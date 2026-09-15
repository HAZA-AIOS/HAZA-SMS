import { env } from "cloudflare:workers";

export const dynamic = "force-dynamic";
const PROBE_TIMEOUT_MS = 5000;

async function probe(check: () => Promise<boolean>): Promise<{ready:boolean;latencyMs:number}> {
  const started = Date.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const ready = await Promise.race([
      Promise.resolve().then(check).catch(() => false),
      new Promise<false>(resolve => { timer = setTimeout(() => resolve(false), PROBE_TIMEOUT_MS); }),
    ]);
    return { ready, latencyMs: Date.now() - started };
  } finally { clearTimeout(timer); }
}

export async function GET() {
  const [database, storage] = await Promise.all([
    probe(async () => (await env.DB.prepare("SELECT 1 AS ready").first<{ ready: number }>())?.ready === 1),
    probe(async () => { await env.BUCKET.head("__health_probe__"); return true; }),
  ]);
  const ready = database.ready && storage.ready;
  return Response.json({
    service: "mentor-school-sms",
    release: "phase-15",
    status: ready ? "ready" : "degraded",
    checks: { application: true, database: database.ready, storage: storage.ready },
    latencyMs: { database: database.latencyMs, storage: storage.latencyMs },
    checkedAt: new Date().toISOString(),
  }, { status: ready ? 200 : 503, headers: { "cache-control": "no-store" } });
}
