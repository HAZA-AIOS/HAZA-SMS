"use client";
import { useEffect, useState } from "react";

let visitRequest: Promise<number> | undefined;
export default function VisitorCounter() {
  const [total, setTotal] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    visitRequest ??= fetch("/api/public-visits", { method: "POST", credentials: "same-origin", cache: "no-store" })
      .then(async response => {
        if (!response.ok) throw new Error("Visit count unavailable");
        const data = await response.json() as { total: number };
        if (!Number.isSafeInteger(data.total) || data.total < 0) throw new Error("Invalid count");
        return data.total;
      });
    visitRequest.then(value => { if (active) setTotal(value); }).catch(() => { visitRequest = undefined; if (active) setFailed(true); });
    return () => { active = false; };
  }, []);
  return <div className="border-t border-white/10 pt-5 text-center md:col-span-2" aria-live="polite">
    <span className="text-sm text-zinc-400">Website visits</span>{" "}
    <strong className="text-lg tabular-nums text-yellow-400">{total === null ? failed ? "Unavailable" : "…" : total.toLocaleString()}</strong>
    <small className="mt-1 block text-xs text-zinc-500">Since counter launch · One visit per browser per day</small>
  </div>;
}
