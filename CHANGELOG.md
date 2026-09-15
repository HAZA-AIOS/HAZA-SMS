# Changelog

## 0.15.0 — 2026-09-15

- Add the protected Phase 15 Operations Command Centre with minute-by-minute refresh.
- Record operator-triggered application, D1 and R2 checks with response times.
- Add tenant-isolated incident creation, acknowledgement and resolution workflows.
- Automatically open a critical incident when a production service check is degraded.
- Add monitoring permissions, audit events, backup coverage and an operational response runbook.

## 0.14.4 — 2026-09-15

- Introduce one reusable purple authentication shell based on the approved sign-in design.
- Restyle plan selection, school registration, multi-school selection and subscription payment screens to match sign-in.
- Replace the legacy blue-and-white registration presentation with translucent purple controls, cards and responsive layouts.

## 0.14.3 — 2026-09-14

- Route “Register your school” to a dedicated plan-selection and registration page.
- Add a private seven-day demo workspace for new schools.
- Add monthly Rs. 5,000 and yearly Rs. 50,000 subscription plans.
- Block protected dashboards and APIs when a school has no active trial or approved subscription.
- Add manual bank, JazzCash and Easypaisa receipt upload with platform-administrator approval.
- Preserve existing schools with a grandfathered active legacy subscription.

## 0.14.2 — 2026-09-14

- Add a responsive branded email sign-in gateway based on the supplied visual reference.
- Preserve the original The Mentor School logo and clarify passwordless email authentication.
- Route new schools into the existing owner registration workflow after verified sign-in.
- Hide dashboard modules and home actions that are not available to the signed-in role.
- Add regression coverage for the authentication experience and role-filtered navigation.

## 0.14.1 — 2026-09-12

- Make strict TypeScript checking and linting release gates, and repair outstanding errors without disabling strict mode.
- Restore the academic-terms schema declaration to match the existing database migration.
- Bound health probes to five seconds, check database and storage independently, and retain partial results in the Release Control Centre.
- Handle timed-out, empty and invalid health responses with actionable messages.
- Expand organization snapshots to cover public content, promotion history, number sequences, bank accounts and permission links.
- Record snapshot scope, row counts and SHA-256 checksum, and verify stored size and checksum metadata before reporting completion.
- Add executable health and backup regression tests and a GitHub verification workflow.
- No database migration or changes to existing school data.

## 0.14.0 — Previous release

- Introduce Phase 14 Release Control Centre and rollout checklist.
- Improve public PDF thumbnail loading and scroll reveals.
