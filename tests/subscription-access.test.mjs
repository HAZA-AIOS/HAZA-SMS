import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("new schools use a dedicated registration page with the approved plans", async () => {
  const [login, register, form] = await Promise.all([read("app/login/page.tsx"), read("app/register/page.tsx"), read("app/RegistrationForm.tsx")]);
  assert.match(login, /href="\/register"/);
  assert.doesNotMatch(login, /href=\{user \? dashboardPath : signInPath\}/);
  assert.match(register, /Rs\. 5,000/);
  assert.match(register, /Rs\. 50,000/);
  assert.match(register, /7-day demo/);
  assert.match(form, /name="plan"/);
});

test("registration atomically creates a trial or pending paid subscription", async () => {
  const route = await read("app/api/registration/route.ts");
  assert.match(route, /organization_subscriptions/);
  assert.match(route, /'demo','trialing'/);
  assert.match(route, /'pending_payment'/);
  assert.match(route, /DEMO_DAYS/);
  assert.match(route, /env\.DB\.batch\(statements\)/);
});

test("protected authorization is subscription gated with an explicit inactive exception", async () => {
  const [authorization, home, subscriptions] = await Promise.all([read("lib/authorization.ts"), read("app/page.tsx"), read("lib/subscriptions.ts")]);
  assert.match(authorization, /allowInactiveSubscription/);
  assert.match(authorization, /organizationAllowsDashboard/);
  assert.match(home, /redirect\("\/subscription"\)/);
  assert.match(subscriptions, /status === "trialing"/);
  assert.match(subscriptions, /status === "active"/);
  assert.match(subscriptions, /return false/);
});

test("receipt upload is tenant scoped and requires manual admin approval", async () => {
  const [receipt, admin, migration] = await Promise.all([read("app/api/subscription/receipt/route.ts"), read("app/api/platform-admin/subscriptions/route.ts"), read("drizzle/0036_subscription_access.sql")]);
  assert.match(receipt, /8\*1024\*1024/);
  assert.match(receipt, /subscriptions\/\$\{auth\.organizationId\}/);
  assert.match(receipt, /application\/pdf/);
  assert.match(admin, /isPlatformAdminEmail/);
  assert.match(admin, /status='active'/);
  assert.match(migration, /'legacy','active'/);
});
