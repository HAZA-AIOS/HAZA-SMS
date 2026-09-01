import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("uses production school metadata and original logo", async () => {
  const [layout,page,landing]=await Promise.all([
    readFile(new URL("../app/layout.tsx",import.meta.url),"utf8"),
    readFile(new URL("../app/page.tsx",import.meta.url),"utf8"),
    readFile(new URL("../app/PublicLandingPage.tsx",import.meta.url),"utf8"),
  ]);
  assert.match(layout,/The Mentor School \| Education for Life/);
  assert.doesNotMatch(layout,/codex-preview/);
  assert.match(landing,/tms-original-logo-transparent\.png/);
  assert.match(page,/PublicLandingPage/);
});
