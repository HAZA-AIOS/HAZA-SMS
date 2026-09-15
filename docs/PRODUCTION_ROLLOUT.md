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

## Release 0.14.1 evidence

Run `npm ci`, then `npm run verify` with Node 22.13 or newer. This gate runs strict TypeScript checking, linting, the production build, and the full regression suite. GitHub runs the same command for pull requests and pushes to main. Keep strict mode enabled; a build alone is not sufficient verification.

The health endpoint tests database and file storage independently, returns 503 when either fails or exceeds five seconds, and never includes exception details. The Release Control Centre retains partial health results and offers retry after network or response failures.

Snapshot version 2 includes all organization-scoped operational tables except transient rate limits and backup-run history, plus scoped relationship tables. The manifest records row counts and explicitly excludes file bytes and shared platform identity records. A SHA-256 checksum is saved with the backup-run manifest and R2 metadata; stored size and checksum metadata must match before the run is marked completed. This verifies storage acknowledgement, not a full restore drill.

Snapshots are sequential table reads. Create them while data entry is paused for a consistent recovery point. Uploaded file bytes remain in R2 and need their own retention/recovery protection. Existing platform users, identities, permission definitions and system roles are prerequisites for supervised recovery; do not treat this snapshot as a complete standalone platform backup.

### Operational handover still required

- Sign in as the school administrator and open Monitoring → Operations Command Centre.
- Run the live service check and create a current snapshot under Audit, Security & Recovery.
- Verify its checksum and perform a supervised restore drill in an isolated environment, including protected file access. Never test a restore over production data.
- Check sign-in, campus selection and the critical workflows listed above with the intended school roles.
- Record the checker, timestamp and outcome in the release handover record. Do not mark these manual gates complete from source tests alone.

The automated release checks do not prove live authentication, a current production snapshot, successful restore, or the first-day monitoring period. Keep these gates in Review until operational evidence exists.
