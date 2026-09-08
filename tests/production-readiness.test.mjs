import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),"utf8");

test("production health is bounded, non-cached and checks D1 and R2",async()=>{const route=await read("app/api/health/route.ts");assert.match(route,/SELECT 1 AS ready/);assert.match(route,/Boolean\(env\.BUCKET\)/);assert.match(route,/status: ready \? 200 : 503/);assert.match(route,/cache-control.*no-store/);assert.doesNotMatch(route,/organization|campus|email|user/i)});
test("production responses include defensive browser headers",async()=>{const worker=await read("worker/index.ts");for(const header of["x-content-type-options","x-frame-options","referrer-policy","permissions-policy","strict-transport-security"])assert.match(worker,new RegExp(header))});
test("Phase 14 exposes rollout gates only through the protected dashboard",async()=>{const shell=await read("app/DashboardShell.tsx"),panel=await read("app/ProductionReadinessPanel.tsx"),docs=await read("docs/PRODUCTION_ROLLOUT.md");assert.match(shell,/activeView === "Reports" && securityData/);assert.match(panel,/PHASE 14 · PRODUCTION READINESS & ROLLOUT/);assert.match(panel,/47\/47/);assert.match(panel,/Run live check/);assert.match(docs,/Rollback procedure/);assert.match(docs,/Critical workflows/)});
