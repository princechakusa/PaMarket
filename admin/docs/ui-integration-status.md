# Admin UI integration status

Updated 13 September 2026. This tracks UI implementation separately from live operational integration.

| Main page | Route | Current status |
| --- | --- | --- |
| Operations Dashboard | `/` | UI implemented; reference metrics with limited live security event integration |
| Listings Queue | `/marketplace/listings` | UI implemented; reference data |
| Verifications | `/marketplace/verifications` | UI implemented; reference data |
| Reports & Disputes | `/trust/reports` | UI implemented; reference data |
| User Directory | `/marketplace/users` | UI implemented; reference data, search, combined filters, visible-row selection and account-specific dossier |
| Shop Orders | `/orders` | UI implemented; reference data |
| Jobs & Recruiters | `/marketplace/jobs` | UI implemented; reference data, search, combined filters and account-specific forensic dialog |
| Vehicle Rentals | `/rentals` | Placeholder |
| Security & Honeypot | `/security/events` | Functional security event page exists |
| Roles & Permissions | `/security/permissions` | Placeholder |
| Errors & Health | `/observability/errors` | UI implemented; reference telemetry, combined filters and record-specific trace inspection |
| General Settings | `/settings/general` | UI implemented; reference policy data, validated local drafts, discard and JSON draft export |

Two of the twelve supplied main pages still need UI implementation: Vehicle Rentals and Roles & Permissions. Additional admin subpages are outside this twelve-page count. Security Settings and authentication/MFA have separate existing implementations.

The Jobs and User Directory routes use the existing session and permission guards (`listings.view` and `users.view`). Their styles load through the admin entry point and their navigation entries already exist. They make no operational data requests. Identity verification, exports, candidate notifications, sanctions, escrow operations, session termination and account changes remain disabled until the corresponding authorized backend integrations are implemented. Sample audit or session evidence is shown only for the reference account to which it belongs.

General Settings uses the existing `settings.view` route guard. Its edits are temporary local drafts and its JSON download is explicitly labelled as a reference draft, not a production backup. Rate feeds, policy persistence, hardware signing and emergency freezes remain disconnected. Section links navigate to existing admin routes; taxonomy, notification settings and legal content are still placeholders.

Errors & Health uses the existing `errors.view` route guard. Incident filters and trace inspection operate on reference data. Sentry ingestion, infrastructure telemetry, cache purge, failover, database actions, retries and acknowledgements remain disconnected and disabled.

Validation: admin production build and ESLint passed. The full suite passed 95 tests before the new filter test hit the five-second shell-render timeout; that test then passed in isolation with a 15-second timeout, bringing verified coverage to 96 tests. The production build retains a bundle-size warning for the main JavaScript chunk.
