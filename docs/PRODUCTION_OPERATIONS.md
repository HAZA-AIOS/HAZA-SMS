# Phase 15 — Production Monitoring and Operations

## Operating model

The protected **Monitoring** workspace is available to school principals, school administrators and authorized auditors. Operators with `monitoring.manage` can run service checks, create incidents, acknowledge ownership and resolve incidents with a required resolution note. Read-only auditors can review the same history without changing it.

Every service check records application, D1 database and R2 file-storage status, response times, capacity measurements, the operator and timestamp. The page refreshes every 60 seconds while visible. A degraded check automatically creates one critical platform incident when no unresolved platform incident already exists.

## Capacity and backup monitoring

The dashboard reports two school-scoped planning measurements:

- **D1 logical data** is the serialized byte size of the latest completed organization recovery snapshot. It measures the school data represented by that snapshot; it is not the allocated size of the shared Cloudflare D1 database.
- **Tracked R2 storage** is the total recorded byte size of the organization's storage assets, subscription receipts and completed backup objects. Temporary multipart-upload fragments and objects not registered by the application are excluded.

Authorized operators can configure internal D1 and R2 operating budgets and a warning threshold from 50–95 percent. A service check records a capacity snapshot. Crossing either threshold opens one high-severity capacity incident and sends an in-app notification; returning below both thresholds resolves that capacity incident automatically.

New backups record size, SHA-256 checksum, integrity status and verification time. On dashboard refresh, the latest completed backup is checked against its current R2 object size and SHA-256 custom metadata. This detects missing or mismatched stored-object metadata; it does not replace a supervised restore drill.

## Application performance monitoring

While an authorized monitoring administrator uses the dashboard, same-origin API calls record the normalized route, module, method, response status and end-to-end browser duration. Identifiers and query strings are removed before storage. Samples are organization-scoped, limited to monitoring-authorized sessions and retained for 30 days.

The Operations Command Centre summarizes the latest 24 hours, bounded to 2,000 recent samples, with average, p50 and p95 response time, failed requests, slow requests, two-hour trends and slow modules. The slow-response threshold is configurable from 200–10,000 milliseconds. This application telemetry does not claim CPU, memory or network-edge metrics that Sites does not expose.

Phase 16 automation and alert thresholds are documented in `PRODUCTION_AUTOMATION.md`.

## Daily checks

1. Open **Monitoring** and review platform status, active incidents and the latest recovery snapshot.
2. Run a service check at the start of the operating day and after every deployment.
3. Review p95 response time, failed requests and the slow-module list.
4. Investigate failed protected operations in Security & Audit.
5. Confirm the latest completed backup is less than 24 hours old and reports verified integrity.
6. Review D1 and R2 operating-budget percentages.
7. Resolve incidents only after a successful verification check and record the corrective action.

## Incident response

| Severity | Meaning | Required response |
| --- | --- | --- |
| Critical | Sign-in, database, storage, isolation or data-loss risk | Stop affected data entry, acknowledge immediately and begin rollback/recovery |
| High | Major workflow unavailable with no safe workaround | Assign an owner and restore service during the current operating window |
| Medium | Partial degradation with a safe workaround | Track, schedule correction and verify after release |
| Low | Minor operational defect | Record and include in routine maintenance |

### Response sequence

1. **Detect:** reproduce the issue and run a service check.
2. **Contain:** pause affected workflows when continued use could lose or corrupt data.
3. **Acknowledge:** record operational ownership in the incident register.
4. **Recover:** redeploy the last known-good version or follow the supervised restore procedure in `PRODUCTION_ROLLOUT.md`.
5. **Verify:** rerun the service check and smoke-test the affected school workflow.
6. **Resolve:** add a resolution note describing the action and verification result.

## Data protection and retention

Monitoring rows are isolated by `organization_id`; API reads and writes require server-side permissions and organization-wide scope. Incident changes, service checks and threshold changes also write to the audit log. Monitoring tables are included in organization snapshots. The dashboard displays at most 100 filtered checks, 100 incidents, 30 capacity snapshots, 10 backups and 2,000 recent performance samples to keep reads bounded. Performance samples older than 30 days are removed during ingestion; longer-term aggregates belong to Phase 17.

## Deployment validation

After publishing, confirm the public landing page, sign-in and dashboard access. Then open **Monitoring**, run a service check and verify application, database and storage report ready. If any service is degraded, keep the generated incident open until the affected service and critical workflow both pass.
