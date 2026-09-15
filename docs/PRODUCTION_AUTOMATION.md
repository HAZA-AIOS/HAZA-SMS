# Phase 16 — Operational Automation and Service Alerts

## Automation model

Authorized administrators can enable service checks from **Dashboard → Monitoring** and choose a 5, 15, 30 or 60 minute interval. A lightweight heartbeat runs while an authorized dashboard session is open. The server atomically claims each due interval, so concurrent browser sessions do not duplicate checks.

This release deliberately uses dashboard-session automation because the current Sites hosting surface does not expose a project-owned scheduled-trigger configuration. It does not claim unattended 24-hour monitoring when no authorized dashboard is open. A future external scheduler can call a dedicated authenticated heartbeat without changing the incident model.

## Alert rules

- Operators choose a threshold of one, two or three consecutive failed automated checks.
- A threshold breach opens one critical platform incident; further failed checks do not create duplicates.
- A successful automated check resolves the platform incident when recovery alerts are enabled.
- Service and recovery events create in-app notifications for active organization members with `monitoring.view`.
- Notification reads are isolated by organization and user.
- Manual service checks continue to open an incident immediately when degraded.

## Operator workflow

1. Open **Monitoring** and enable automated checks.
2. Select the interval and failure threshold appropriate to the operating window.
3. Keep an administrator dashboard session active during school operations.
4. Watch the notification bell for service or recovery alerts.
5. Acknowledge incidents, pause risky data entry and follow `PRODUCTION_OPERATIONS.md`.
6. Confirm a successful service check before closing an incident manually.

## Security and resilience

Automation policy changes require `monitoring.manage`, same-origin validation and rate limiting. Heartbeats require `monitoring.view` plus organization-wide scope. Due intervals use an atomic conditional update. Checks, policy changes, alert creation and automatic recovery are audited. Policy and check rows are tenant-scoped and included in organization backups.

## Alert delivery

Phase 16 delivers alerts inside HAZA-SMS through the dashboard bell. Email, SMS and WhatsApp delivery are not enabled because no approved outbound provider or verified sender has been configured. Those channels must remain disabled until credentials, consent, delivery limits and escalation ownership are defined.
