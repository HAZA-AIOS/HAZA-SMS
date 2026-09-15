# Phase 15 — Production Monitoring and Operations

## Operating model

The protected **Monitoring** workspace is available to school principals, school administrators and authorized auditors. Operators with `monitoring.manage` can run service checks, create incidents, acknowledge ownership and resolve incidents with a required resolution note. Read-only auditors can review the same history without changing it.

Every service check records application, D1 database and R2 file-storage status, response times, the operator and timestamp. The page refreshes every 60 seconds while visible. A degraded check automatically creates one critical platform incident when no unresolved platform incident already exists.

## Daily checks

1. Open **Monitoring** and review platform status, active incidents and the latest recovery snapshot.
2. Run a service check at the start of the operating day and after every deployment.
3. Investigate failed protected operations in Security & Audit.
4. Confirm the latest completed backup is less than 24 hours old.
5. Resolve incidents only after a successful verification check and record the corrective action.

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

Monitoring rows are isolated by `organization_id`; API reads and writes require server-side permissions and organization-wide scope. Incident changes and service checks also write to the audit log. Monitoring tables are included in organization snapshots. The dashboard displays the latest 30 checks and 100 incidents to keep reads bounded; longer retention can be managed under a future archival policy.

## Deployment validation

After publishing, confirm the public landing page, sign-in and dashboard access. Then open **Monitoring**, run a service check and verify application, database and storage report ready. If any service is degraded, keep the generated incident open until the affected service and critical workflow both pass.
