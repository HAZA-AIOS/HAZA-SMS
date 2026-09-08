import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Phase 13 analytics uses the deployed D1 column names", async () => {
  const route = await read("app/api/analytics/route.ts");
  assert.match(route, /enrollment_status='active'/);
  assert.match(route, /avg\(m\.percentage\)/);
  assert.match(route, /a\.status IN \('approved','published'\)/);
  assert.doesNotMatch(route, /marks_obtained|m\.status IN/);
});

test("Phase 13 analytics always handles empty and invalid responses", async () => {
  const route = await read("app/api/analytics/route.ts");
  const panel = await read("app/AnalyticsPanel.tsx");
  assert.match(route, /Analytics request failed/);
  assert.match(route, /status:503/);
  assert.match(panel, /await response\.text\(\)/);
  assert.match(panel, /if\(!body\.trim\(\)\)/);
  assert.match(panel, /JSON\.parse\(body\)/);
});
