# Stage C role and permission model

This is the target authorization contract for the rebuilt admin. It does not change production roles or database policies. The browser may use it to hide routes and actions, but Supabase RLS or a server-side function must enforce the same permission for every live operation.

Authorization comes from `public.profiles.role` for the authenticated user. User metadata, route visibility, and cached browser state are not authorization sources. An unknown, missing, or unqueryable role fails closed.

## Roles

| Role | Intended scope |
| --- | --- |
| `super_admin` | Full platform control. The only role allowed to manage admin roles, MFA policy, security settings, and integration credentials. |
| `admin` | Broad day-to-day operations, publishing, settings, and incident response. It explicitly excludes admin-role management, MFA policy, security changes, and integration credentials. |
| `moderator` | Listing, verification, moderation, review, and report workflows only. |
| `support` | User assistance, support tickets, reports, and chats only. |
| `finance` | Read-only monetization, advertising, billing, and revenue views only. |

The current production role names and this target model are different concerns. Stage C does not promote accounts or grant production privileges.

## Permission catalogue

| Area | View or entry permissions | Sensitive action permissions |
| --- | --- | --- |
| Overview | `dashboard.view` | None in Stage C |
| Users | `users.view` | `users.assist` for account-assistance workflows |
| Listings and marketplace | `listings.view` | `listings.moderate`, `verifications.manage` |
| Trust and support | `reports.view`, `chats.view` | `reports.manage`, `moderation.manage`, `reviews.moderate`, `support.manage` |
| Businesses | `businesses.view` | A future business mutation permission must be added before migration |
| Shop orders | `orders.view` | `orders.manage` for status, refund, or fulfilment changes |
| General content | `content.view` | `content.edit`, then `content.publish` as a separate release action |
| Legal policies | `legal.view` | `legal.edit`, then `legal.publish` as a separate release action |
| Taxonomy | `taxonomy.view` | `taxonomy.manage`, then `taxonomy.publish` for production activation |
| Monetization | `monetization.view`, `revenue.view`, `ads.view`, `billing.view` | `ads.manage`; future refund or financial-write permissions must be separate |
| AMOS | `amos.view` | `amos.run`, `amos.publish`, `integrations.manage` |
| Rentals | `rentals.view` | `rentals.moderate`, `rentals.manage` |
| Observability | `analytics.view`, `audit.view`, `errors.view`, `operations.view` | `errors.resolve`; `audit.export` for legal/security evidence export |
| Security | `security.view` | `security.manage`, `admins.manage`, `mfa_policy.manage` |
| Settings | `settings.view` | `settings.manage` |

## Role grants

`super_admin` receives every permission. `admin` receives the operational catalogue except `integrations.manage`, `security.manage`, `admins.manage`, `mfa_policy.manage`, and `audit.export`. This lets an administrator operate approved product areas without silently inheriting owner-level controls or legal-evidence export.

`moderator` receives `dashboard.view`, `listings.view`, `listings.moderate`, `verifications.manage`, `reports.view`, `reports.manage`, `moderation.manage`, and `reviews.moderate`.

`support` receives `dashboard.view`, `users.view`, `users.assist`, `reports.view`, `reports.manage`, `chats.view`, and `support.manage`.

`finance` receives `dashboard.view`, `monetization.view`, `revenue.view`, `ads.view`, and `billing.view`. It receives no mutation permission.

The executable map is in `src/security/permissions.ts`; tests require it to match these rules.

## Route map

| Route group | Required permission(s) |
| --- | --- |
| `/` | `dashboard.view` |
| `/marketplace/users` | `users.view` |
| `/marketplace/listings`, jobs, services, property, vehicle sales | `listings.view` |
| `/marketplace/verifications` | `verifications.manage` |
| `/trust/reports` | `reports.view` |
| `/trust/moderation`, `/trust/inbox` | `moderation.manage` |
| `/trust/reviews` | `reviews.moderate` |
| `/trust/contacts`, `/trust/support` | `support.manage` |
| `/trust/chats` | `chats.view` |
| `/businesses` | `businesses.view` |
| `/orders` | `orders.view` |
| `/content/legal` | `legal.view` |
| Other `/content/*` | `content.view` |
| `/taxonomy` | `taxonomy.view` |
| `/monetization/ads` | `ads.view` |
| `/monetization/finance` | `revenue.view` |
| `/monetization/play-billing` | `billing.view` |
| `/amos/audit` | `audit.view` |
| `/amos/analytics` | `analytics.view` |
| Other `/amos/*` | `amos.view` |
| Rental approvals, reports, and reviews | `rentals.moderate` |
| Rental featured and lookups | `rentals.manage` |
| Rental analytics and audit | `analytics.view` and `audit.view`, respectively |
| Other `/rentals/*` | `rentals.view` |
| `/observability/analytics`, audit, errors, operations | `analytics.view`, `audit.view`, `errors.view`, `operations.view`, respectively |
| `/security*` | `security.view` |
| Settings maintenance | `settings.manage` |
| Other `/settings/*` | `settings.view` |

Each future feature migration must add action checks for its sensitive operations. A route permission alone never authorizes a mutation.

## Sensitive action rules

Publishing content or legal text requires the matching `*.publish` permission after a distinct review step. Taxonomy activation requires `taxonomy.publish`. Changing an order requires `orders.manage`. Starting AMOS work requires `amos.run`; releasing it requires `amos.publish`; changing provider credentials requires `integrations.manage`. Rental approval and enforcement require `rentals.moderate`, while configuration requires `rentals.manage`. Resolving or suppressing an error requires `errors.resolve`.

Admin-role changes require `admins.manage`; MFA rules require `mfa_policy.manage`; security configuration requires `security.manage`; legal/security evidence export requires `audit.export`. These permissions, plus `integrations.manage`, belong only to `super_admin`.
