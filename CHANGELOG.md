# Changelog

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
