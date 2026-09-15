import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { moduleFromRoute, normalizeApiRoute, percentile, summarizePerformance } from "../lib/monitoring-analytics.ts";

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
  assert.match(route,/LIMIT 100/);
  assert.match(route,/monitoring\.incident\.acknowledge/);
  assert.match(route,/monitoring\.incident\.resolve/);
  assert.match(route,/requireSameOrigin\(request\)/);
  assert.match(route,/enforceRateLimit/);
  assert.match(authorization,/monitoring\.view/);
  assert.match(authorization,/monitoring\.manage/);
  assert.match(backup,/operational_check_runs/);
  assert.match(backup,/monitoring_incidents/);
});

test("automation policy is tenant scoped and each due interval is claimed once",()=>{
  const db=new DatabaseSync(":memory:");
  for(const file of readdirSync(new URL("../drizzle/",import.meta.url)).filter(file=>file.endsWith(".sql")).sort())db.exec(read(`drizzle/${file}`));
  db.exec("INSERT INTO organizations(id,name,slug) VALUES('org-a','A','a'),('org-b','B','b'); INSERT INTO users(id,email,display_name,status) VALUES('operator','ops@example.invalid','Operator','active');");
  db.prepare("INSERT INTO operational_automation_policies(id,organization_id,enabled,interval_minutes,failure_threshold,notify_recovery,updated_by) VALUES(?,?,?,?,?,?,?)").run("policy-a","org-a",1,15,2,1,"operator");
  const first=db.prepare("UPDATE operational_automation_policies SET last_evaluated_at=? WHERE organization_id=? AND enabled=1 AND (last_evaluated_at IS NULL OR last_evaluated_at<=?)").run(1000000,"org-a",100000);
  const second=db.prepare("UPDATE operational_automation_policies SET last_evaluated_at=? WHERE organization_id=? AND enabled=1 AND (last_evaluated_at IS NULL OR last_evaluated_at<=?)").run(1000001,"org-a",100001);
  assert.equal(first.changes,1);assert.equal(second.changes,0);
  assert.equal(db.prepare("SELECT count(*) value FROM operational_automation_policies WHERE organization_id=?").get("org-b").value,0);
  db.close();
});

test("automation creates deduplicated alerts and dashboard notifications",()=>{
  const automation=read("lib/monitoring.ts"),heartbeat=read("app/api/monitoring/automation/route.ts"),notifications=read("app/api/notifications/route.ts"),shell=read("app/DashboardShell.tsx"),backup=read("app/api/security/backups/route.ts");
  assert.match(automation,/triggerType:"scheduled"/);
  assert.match(automation,/failure_threshold/);
  assert.match(automation,/source=\?2 AND status!='resolved' LIMIT 1/);
  assert.match(automation,/monitoring\.service\.degraded/);
  assert.match(automation,/monitoring\.service\.recovered/);
  assert.match(heartbeat,/authorize\("monitoring\.view"\)/);
  assert.match(heartbeat,/requireSameOrigin\(request\)/);
  assert.match(notifications,/organization_id=\?1 AND user_id=\?2/);
  assert.match(shell,/\/api\/monitoring\/automation/);
  assert.match(shell,/Mark all read/);
  assert.match(backup,/operational_automation_policies/);
});

test("capacity and performance telemetry remain tenant isolated",()=>{
  const db=new DatabaseSync(":memory:");
  for(const file of readdirSync(new URL("../drizzle/",import.meta.url)).filter(file=>file.endsWith(".sql")).sort())db.exec(read(`drizzle/${file}`));
  db.exec("INSERT INTO organizations(id,name,slug) VALUES('org-a','A','a'),('org-b','B','b'); INSERT INTO users(id,email,display_name,status) VALUES('operator','ops@example.invalid','Operator','active');");
  db.prepare("INSERT INTO operational_monitoring_settings(id,organization_id,database_budget_bytes,storage_budget_bytes,capacity_warning_percent,slow_request_threshold_ms,updated_by) VALUES(?,?,?,?,?,?,?)").run("settings-a","org-a",1000,2000,80,750,"operator");
  db.prepare("INSERT INTO capacity_snapshots(id,organization_id,database_logical_bytes,storage_bytes,storage_object_count,database_budget_bytes,storage_budget_bytes,warning_percent,triggered_by) VALUES(?,?,?,?,?,?,?,?,?)").run("capacity-a","org-a",500,1000,4,1000,2000,80,"operator");
  db.prepare("INSERT INTO api_performance_samples(id,organization_id,user_id,route,module,method,status_code,duration_ms,is_slow) VALUES(?,?,?,?,?,?,?,?,?)").run("sample-a","org-a","operator","/api/students/:id","students","GET",503,900,1);
  assert.equal(db.prepare("SELECT count(*) value FROM capacity_snapshots WHERE organization_id=?").get("org-b").value,0);
  assert.equal(db.prepare("SELECT count(*) value FROM api_performance_samples WHERE organization_id=?").get("org-b").value,0);
  assert.match(db.prepare("EXPLAIN QUERY PLAN SELECT * FROM api_performance_samples WHERE organization_id=? AND created_at>?").get("org-a",0).detail,/api_performance_samples_org_created_idx/);
  db.close();
});

test("performance analytics normalize identifiers and calculate percentiles",()=>{
  assert.equal(normalizeApiRoute("/api/students/8c40c2f2-e9f2-4ea0-a5fe-13ab4c6eb182?tab=profile"),"/api/students/:id");
  assert.equal(normalizeApiRoute("/api/monitoring/performance"),null);
  assert.equal(moduleFromRoute("/api/student-attendance/reports"),"student-attendance");
  assert.equal(percentile([400,100,200,300],.5),200);
  const summary=summarizePerformance([
    {route:"/api/students",module:"students",method:"GET",status_code:200,duration_ms:100,is_slow:0,created_at:Date.now()},
    {route:"/api/students/:id",module:"students",method:"GET",status_code:500,duration_ms:900,is_slow:1,created_at:Date.now()},
  ]);
  assert.equal(summary.averageMs,500);assert.equal(summary.p95Ms,900);assert.equal(summary.failed,1);assert.equal(summary.modules[0].slow,1);
});

test("completion sprint records API performance, capacity warnings and backup verification",()=>{
  const route=read("app/api/monitoring/route.ts"),performance=read("app/api/monitoring/performance/route.ts"),monitoring=read("lib/monitoring.ts"),dashboard=read("app/DashboardShell.tsx"),panel=read("app/ProductionReadinessPanel.tsx"),backup=read("app/api/security/backups/route.ts");
  assert.match(performance,/authorize\("monitoring\.view"\)/);assert.match(performance,/organizationId/);assert.match(performance,/api_performance_samples/);assert.match(performance,/requireSameOrigin/);
  assert.match(dashboard,/\/api\/monitoring\/performance/);assert.match(dashboard,/performance\.now/);
  assert.match(route,/LIMIT 2000/);assert.match(route,/summarizePerformance/);assert.match(route,/update_monitoring_settings/);assert.match(route,/BUCKET\.head/);
  assert.match(monitoring,/capacity_snapshots/);assert.match(monitoring,/source='capacity'/);assert.match(monitoring,/monitoring\.capacity\.warning/);
  assert.match(backup,/checksum_sha256/);assert.match(backup,/integrity_status='verified'/);assert.match(backup,/api_performance_samples/);
  assert.match(panel,/Capacity monitoring/);assert.match(panel,/API performance/);assert.match(panel,/Monitoring history/);
});
