export type PerformanceSample = {
  route: string;
  module: string;
  method: string;
  status_code: number;
  duration_ms: number;
  is_slow: number;
  created_at: number;
};

const idSegment = /^(?:\d+|[0-9a-f]{8}-[0-9a-f-]{27,}|[A-Za-z0-9_-]{24,})$/i;

export function normalizeApiRoute(value: unknown) {
  const raw = String(value ?? "").trim().slice(0, 300);
  let pathname = "";
  try {
    pathname = new URL(raw, "https://haza.invalid").pathname;
  } catch {
    return null;
  }
  if (!pathname.startsWith("/api/") || pathname === "/api/monitoring/performance")
    return null;
  return pathname
    .split("/")
    .map((segment) => (idSegment.test(segment) ? ":id" : segment))
    .join("/")
    .slice(0, 180);
}

export function moduleFromRoute(route: string) {
  const segment = route.split("/").filter(Boolean)[1] ?? "other";
  return segment.replace(/[^a-z0-9-]/gi, "").slice(0, 60) || "other";
}

export function percentile(values: number[], fraction: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1))];
}

export function summarizePerformance(samples: PerformanceSample[]) {
  const durations = samples.map((sample) => sample.duration_ms);
  const groups = new Map<string, PerformanceSample[]>();
  for (const sample of samples) {
    const list = groups.get(sample.module) ?? [];
    list.push(sample);
    groups.set(sample.module, list);
  }
  const modules = [...groups.entries()]
    .map(([module, rows]) => ({
      module,
      requests: rows.length,
      failed: rows.filter((row) => row.status_code === 0 || row.status_code >= 400).length,
      slow: rows.filter((row) => Boolean(row.is_slow)).length,
      averageMs: Math.round(rows.reduce((sum, row) => sum + row.duration_ms, 0) / rows.length),
      p95Ms: percentile(rows.map((row) => row.duration_ms), 0.95),
    }))
    .sort((a, b) => b.p95Ms - a.p95Ms || b.failed - a.failed)
    .slice(0, 12);
  const now = Date.now();
  const trend = Array.from({ length: 12 }, (_, index) => {
    const start = now - (12 - index) * 2 * 60 * 60 * 1000;
    const end = start + 2 * 60 * 60 * 1000;
    const rows = samples.filter((sample) => sample.created_at >= start && sample.created_at < end);
    return {
      at: start,
      requests: rows.length,
      averageMs: rows.length
        ? Math.round(rows.reduce((sum, row) => sum + row.duration_ms, 0) / rows.length)
        : 0,
      failed: rows.filter((row) => row.status_code === 0 || row.status_code >= 400).length,
    };
  });
  return {
    sampleCount: samples.length,
    averageMs: durations.length ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : 0,
    p50Ms: percentile(durations, 0.5),
    p95Ms: percentile(durations, 0.95),
    failed: samples.filter((sample) => sample.status_code === 0 || sample.status_code >= 400).length,
    slow: samples.filter((sample) => Boolean(sample.is_slow)).length,
    modules,
    trend,
  };
}
