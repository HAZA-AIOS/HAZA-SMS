import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("monitoring persistence supports tenant-isolated checks and incident lifecycle", () => {
  const db = new DatabaseSync(":memory:");
  for (const file of readdirSync(new URL("../drizzle/", import.meta.url)).filter(file=>file.endsWith(".sql")).sort()) db.exec(read(`drizzle/${file}`));
  db.exec("INSERT INTO organizations(id,name,slug) VALUES('org-a','A','a'),('org-b','B','b'); INSERT INTO users(id,email,display_name,status) VALUES('operator','ops@example.invalid','Operator','active');");
  db.prepare("INSERT INTO operational_check_runs(id,organization_id,status,application_status,database_status,storage_status,database_latency_ms,storage_latency_ms,triggered_by) VALUES(?,?,?,?,?,?,?,?,?)").run("check-a","org-a","ready","ready","ready","ready",11,18,"operator");
  db.prepare("INSERT INTO monitoring_incidents(id,organization_id,source,severity,title,created_by) VALUES(?,?,?,?,?,?)").run("incident-a","org-a","storage","high","Receipt storage delayed","operator");
  assert.equal(db.prepare("SELECT count(*) value FROM operational_check_runs WHERE organization_id=?").get("org-b").value,0);
  assert.equal(db.prepare("SELECT status FROM monitoring_incidents WHERE id=? AND organization_id=?").get("incident-a","org-a").status,"open");
  db.prepare("UPDATE monitoring_incidents SET status='acknowledged',acknowledged_by=?,acknowledged_at=1 WHERE id=? AND organization_id=?").run("operator","incident-a","org-a");
  db.prepare("UPDATE monitoring_incidents SET status='resolved',resolved_by=?,resolved_at=2,resolution_note=? WHERE id=? AND organization_id=?").run("operator","Storage recovered","incident-a","org-a");
  const incident=db.prepare("SELECT status,resolution_note FROM monitoring_incidents WHERE id=? AND organization_id=?").get("incident-a","org-a");
  assert.equal(incident.status,"resolved");
  assert.equal(incident.resolution_note,"Storage recovered");
  db.close();
});

test("monitoring API is permission protected, bounded and audited", () => {
  const route=read("app/api/monitoring/route.ts"),authorization=read("lib/authorization.ts"),backup=read("app/api/security/backups/route.ts");
  assert.match(route,/authorize\("monitoring\.view"\)/);
  assert.match(route,/authorize\("monitoring\.manage"\)/);
  assert.match(route,/organizationWide/);
  assert.match(route,/organization_id=\?1/);
  assert.match(route,/LIMIT 30/);
  assert.match(route,/monitoring\.incident\.acknowledge/);
  assert.match(route,/monitoring\.incident\.resolve/);
  assert.match(route,/requireSameOrigin\(request\)/);
  assert.match(route,/enforceRateLimit/);
  assert.match(authorization,/monitoring\.view/);
  assert.match(authorization,/monitoring\.manage/);
  assert.match(backup,/operational_check_runs/);
  assert.match(backup,/monitoring_incidents/);
});
