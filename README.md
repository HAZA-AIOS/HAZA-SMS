# HAZA-SMS

HAZA-SMS is a multi-tenant School Management System for independent schools and school groups. Each registered school receives an isolated workspace, may operate multiple campuses, and sees only its own academic, operational, staff, student and financial records.

**Live application:** [The Mentor School SMS](https://mentor-school-sms.mussawarhussain.chatgpt.site/)

## Current capabilities

- School registration, verified identity and organization selection
- Multi-school and multi-campus data isolation
- Server-enforced roles and granular permissions
- School, campus and academic-year configuration
- Audit history, security controls and backup foundation
- Student directory, complete profiles, guardians, documents and enrollment history
- Bulk student import/export and validation
- Admission enquiry, application, assessment, approval and enrollment conversion
- Printable admission forms, admission letters and reporting
- Staff profiles, photographs, documents, qualifications and experience
- Teacher subject, class and class-teacher assignments
- Staff attendance, leave management, salary configuration and payroll foundation
- Academic years, terms, grade levels, classes, sections, subjects and curriculum mapping
- Promotion rules and enrollment-history integration
- Daily student attendance, correction requests, reports and absence alerts
- Seasonal school schedules, period definitions and class timetables
- Teacher timetables, workload summaries, conflict detection and substitutions
- Examination timetables, invigilator and room conflict checks, and school events calendar
- Fee categories, class/campus fee structures, concessions and student fee assignments

## Architecture

| Layer           | Technology                                   | Responsibility                                        |
| --------------- | -------------------------------------------- | ----------------------------------------------------- |
| Application     | React, Vinext, TypeScript                    | Server-rendered dashboard and protected workflows     |
| Styling         | Tailwind-compatible CSS and component styles | Responsive school administration interface            |
| Runtime         | Cloudflare Workers                           | API routes and server-side authorization              |
| Structured data | Cloudflare D1 + Drizzle                      | Tenant records, migrations and indexes                |
| File storage    | Cloudflare R2                                | Student/staff photos, documents and generated records |
| Identity        | Sign in with ChatGPT temporarily             | Verified user identity during development             |
| Authorization   | Application RBAC                             | Permission and campus checks on protected operations  |
| History         | D1 audit logs                                | Records sensitive views and data changes              |

## Multi-tenant security model

Every protected record is scoped by `organization_id`. Campus-specific records are additionally scoped by `campus_id`. API routes resolve the authenticated user’s active organization and campus, verify permissions server-side, and reject cross-tenant or unauthorized campus access. Sidebar visibility is only a convenience; it is not the security boundary.

Key controls include:

- Organization and campus ownership checks
- Server-side permission checks for view, create, edit, approve, export and sensitive-data actions
- Same-origin validation and rate limiting for writes
- Audited high-value actions
- Tenant-scoped D1 queries and R2 object paths
- Version-controlled migrations and indexed query paths
- Backup manifests restricted to one organization

## Timetable system

- Winter and summer schedules per campus
- Configurable school hours, breaks and working days
- Teaching-period definitions
- Class, section, subject, teacher and room assignments
- Individual teacher weekly timetables
- Teacher workload and free-period summaries
- Teacher, class and room conflict prevention
- Temporary substitute-teacher scheduling
- Campus, academic-year and schedule isolation
- Audit history for timetable changes

## Repository structure

```text
app/                 Dashboard panels and protected API routes
db/                  Drizzle schema and D1 access helpers
drizzle/             Version-controlled D1 migrations
lib/                 Authorization, security and CSV helpers
public/              School logo and public assets
tests/               Render and security-boundary tests
worker/              Cloudflare Worker entry point
.openai/hosting.json Sites bindings for D1 and R2
```

## Local development

Requirements: Node.js 22.13 or later and npm.

```bash
npm ci
npm run dev
```

Useful commands:

```bash
npm test
npm run build
npm run db:generate
```

Do not commit `.env` files, credentials, production exports or student/staff documents.

## Database migrations

The `drizzle/` directory contains the ordered D1 schema history. New database work must use a new migration, be reviewed for tenant ownership and indexes, and pass testing before deployment. Never rewrite an already-deployed migration.

## Development workflow

1. Create a focused branch for the phase or fix.
2. Implement database, API, permission and interface layers together.
3. Add or update security-boundary tests.
4. Run the complete test suite.
5. Commit and update GitHub.
6. Merge the completed phase into `main`.
7. Publish and verify the Sites deployment.

## Roadmap

The project is completing Phase 6, covering timetables and scheduling. Planned phases continue with examination timetables and calendars, fees and finance, examinations and results, learning resources, communications, parent/student portals, operational modules and reporting.

## Screenshots

Interface screenshots will be maintained under `docs/screenshots/` as stable milestones are published. The live application link above always shows the latest deployed interface.

## License

This repository is licensed under the [MIT License](LICENSE).
