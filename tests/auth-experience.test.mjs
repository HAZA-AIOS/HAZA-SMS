import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("the branded sign-in gateway uses email identity and the original school logo", async () => {
  const login = await read("app/login/page.tsx");
  const home = await read("app/page.tsx");
  assert.match(login, /tms-original-logo-transparent\.png/);
  assert.match(login, /Continue with email/);
  assert.match(login, /No separate dashboard password/);
  assert.doesNotMatch(login, /type=["']password["']/);
  assert.match(home, /signInPath="\/login"/);
  assert.match(home, /redirect\("\/login"\)/);
});

test("dashboard navigation is filtered to server-authorized modules", async () => {
  const dashboard = await read("app/DashboardShell.tsx");
  const access = await read("app/AccessControlPanel.tsx");
  assert.match(dashboard, /const availableViews = new Set/);
  assert.match(dashboard, /const visibleNavigation = navigation\.filter/);
  assert.match(dashboard, /visibleNavigation\.map/);
  assert.match(access, /Invite the user with their exact email address and assign a role/);
  assert.match(access, /does not create, display or store separate dashboard passwords/);
});
