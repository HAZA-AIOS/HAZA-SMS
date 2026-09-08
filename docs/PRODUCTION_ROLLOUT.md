# Phase 14 — Production Readiness and Rollout

## Release gates

1. Production build completes from the reviewed `main` revision.
2. All security, tenant-isolation and regression tests pass.
3. `/api/health` reports `ready` for the application, D1 and R2 bindings.
4. The administrator creates and verifies a current recovery snapshot.
5. Critical workflows are smoke-tested: sign-in, campus selection, students, attendance, fees, examinations, Analytics, Downloads and News & Events.
6. Audit history shows no unexplained failed or denied sensitive operations.

## Controlled rollout

- Publish during a low-activity school window.
- Keep the previously successful production version available for rollback.
- Verify the public landing page and authenticated dashboard immediately after publishing.
- Monitor health and audit outcomes during the first operational day.
- Record any release-blocking issue before allowing new feature work.

## Rollback procedure

1. Stop non-essential data-entry activity.
2. Redeploy the last known-good saved production version.
3. Verify public access, sign-in, D1 connectivity and protected file access.
4. Confirm whether any migration was applied; never rewrite an applied migration.
5. Restore data only from a verified organization-scoped snapshot and through a supervised administrator process.
6. Document the incident, affected window, corrective action and verification result.

## Operational ownership

- School leadership approves the rollout window.
- The system administrator confirms health, backup and audit gates.
- Module owners smoke-test their critical workflows.
- Any critical security, isolation, data-loss or sign-in failure blocks release completion.
