import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("public content management is protected and tenant scoped", async () => {
  const [downloads, multipart, news] = await Promise.all([
    read("app/api/public-content/downloads/route.ts"),
    read("app/api/public-content/downloads/multipart/route.ts"),
    read("app/api/public-content/news-events/route.ts"),
  ]);
  for (const source of [downloads, multipart, news]) {
    assert.match(source, /authorize\("settings\.edit"\)/);
    assert.match(source, /requireSameOrigin\(request\)/);
    assert.match(source, /organizationId/);
  }
  assert.match(downloads, /organizations\/\$\{auth\.organizationId\}\/public-downloads/);
  assert.match(multipart, /createMultipartUpload/);
  assert.match(multipart, /resumeMultipartUpload/);
  assert.match(multipart, /MAX_FILE_SIZE = 5 \* 1024 \* 1024 \* 1024/);
  assert.match(multipart, /object\.size !== metadata\.size/);
});

test("only published resources are exposed on the public website", async () => {
  const [page, download] = await Promise.all([
    read("app/page.tsx"),
    read("app/api/public-downloads/[id]/route.ts"),
  ]);
  assert.match(page, /d\.status='published'/);
  assert.match(page, /n\.status='published'/);
  assert.match(download, /d\.status='published'/);
  assert.match(download, /content-disposition/);
});

test("landing page separates campus teams and has no team social strip", async () => {
  const landing = await read("app/PublicLandingPage.tsx");
  assert.match(landing, /The Mentor School · Main Campus/);
  assert.match(landing, /The Mentor School · Hadi Campus/);
  assert.doesNotMatch(landing, /team-socials/);
  assert.match(landing, /id="downloads"/);
  assert.match(landing, /id="news-events"/);
});
