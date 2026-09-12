# Admin UI integration status

Updated 12 September 2026. This tracks UI implementation separately from live operational integration.

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
| Errors & Health | `/observability/errors` | Placeholder |
| General Settings | `/settings/general` | Placeholder |

Four of the twelve supplied main pages still need UI implementation. Additional admin subpages are outside this twelve-page count. Security Settings and authentication/MFA have separate existing implementations.

The Jobs and User Directory routes use the existing session and permission guards (`listings.view` and `users.view`). Their styles load through the admin entry point and their navigation entries already exist. They make no operational data requests. Identity verification, exports, candidate notifications, sanctions, escrow operations, session termination and account changes remain disabled until the corresponding authorized backend integrations are implemented. Sample audit or session evidence is shown only for the reference account to which it belongs.

Validation: admin production build, ESLint, and the full 92-test suite passed. The production build retains a bundle-size warning for the main JavaScript chunk.
