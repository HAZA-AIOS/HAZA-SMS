import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("uses production school metadata and original logo", async () => {
  const [layout,page]=await Promise.all([
    readFile(new URL("../app/layout.tsx",import.meta.url),"utf8"),
    readFile(new URL("../app/page.tsx",import.meta.url),"utf8"),
  ]);
  assert.match(layout,/The Mentor School SMS/);
  assert.doesNotMatch(layout,/codex-preview/);
  assert.match(page,/tms-original-logo-transparent\.png/);
});
