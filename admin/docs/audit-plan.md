# Admin audit foundation

Stage C does not write audit rows. The existing browser-written audit pattern cannot prove who performed an operation, whether the operation succeeded, or whether a client altered the claimed before/after state.

## Actions that require an audit record

Audit every privileged mutation: role and permission changes; MFA or security-policy changes; moderation and verification decisions; user assistance affecting an account; report and support-ticket resolution; order status, refund, or fulfilment changes; content, legal, and taxonomy drafts or publication; advertising changes; AMOS runs, approvals, publication, and credential changes; rental approvals and configuration; error resolution; settings changes; session revocation; exports of sensitive data.

Read access should be audited when it reveals unusually sensitive records, performs a bulk export, or accesses integration configuration. Routine navigation does not need a row.

## Evidence envelope

Each server-generated security event should record:

- authenticated user ID and the admin role loaded from the database;
- stable action name, target entity type and target ID;
- server timestamp, request ID, and correlation ID;
- IP address when available from a trusted proxy boundary and a minimized user agent;
- route and action source;
- one result from `success`, `failure`, `blocked`, or `suspicious`;
- MFA assurance derived from the verified JWT (`aal1`, `aal2`, or `unknown`);
- whether the honeypot triggered, without its contents;
- time-to-submit derived from a server-issued or signed start marker;
- rate-limit decision and the rule that made it;
- Edge Function and/or RPC involved;
- a bounded admin-provided reason when the action requires one; and
- the connected domain audit-log ID, when one exists.

The TypeScript read model is in `src/services/audit/security-event.ts`. It is not a browser insert contract. Actor, network, result, assurance, abuse signals, and timestamps must be derived or verified server-side.

## Server-attributed design

A trusted database function or JWT-verifying Edge Function should perform the business change and write its audit row in the same authoritative operation where possible. It derives actor ID from the verified JWT, loads the current profile role on the server, and records the action only after authorization. The browser must not supply actor email, actor role, IP address, user agent, success, or authoritative before/after state.

The frontend may attach only a validated reason, route/action source, and a random correlation ID. The server uses that correlation ID to connect the request, domain mutation, provider call, and audit result without accepting it as identity. For external providers, use a server-generated operation ID and idempotency key. IP addresses must come from the trusted Edge/proxy boundary rather than a browser-supplied forwarding header.

Each record should distinguish `started`, `succeeded`, `failed`, and `partially_succeeded`. Store a safe error code and affected object identifiers. If a database mutation and its audit entry cannot share a transaction, record the durable attempt first and reconcile incomplete operations server-side.

The legal/security evidence envelope uses the normalized terminal results `success`, `failure`, `blocked`, and `suspicious`. A linked domain audit record may keep finer workflow states such as `started` or `partially_succeeded`.

## Storage and access controls

Use a dedicated append-only security-event table rather than permitting browser writes to `admin_audit_logs`. Enable and force RLS. Revoke browser `INSERT`, `UPDATE`, `DELETE`, and `TRUNCATE`; inserts should come only from a narrowly scoped trusted function. Populate IDs, timestamps, actor role, MFA assurance, and request result on that trusted path. Reject updates and deletes with a defensive trigger or privilege boundary, including for ordinary admin roles.

Only `admin` and `super_admin` may read evidence rows through an explicit policy. Specialist roles receive no access. Evidence export must use a JWT-verifying server endpoint that reloads `profiles.role`, requires `super_admin`, requires the approved MFA assurance, records the export itself, applies bounded filters, and returns a checksum-bearing manifest. The browser permission for that operation is `audit.export`; it is a navigation aid rather than the authority.

Connect each event to `admin_audit_logs` using an immutable audit ID where possible. Add database-generated identifiers and timestamps, narrow service credentials, backup protection, restricted operational access, and integrity checks on export. Consider batch hashes or signed export manifests for later tamper detection. Do not claim full immutability while database owners retain administrative access.

## Retention and legal holds

Default retention is 24 months from the server timestamp. A scheduled server job should delete or irreversibly anonymize expired records and record aggregate deletion counts. An authorized legal hold suspends deletion only for the identified case scope and has an owner, reason, start date, review date, and release date. Exported case evidence follows the case retention decision rather than silently extending the live table's retention.

Review the 24-month period with counsel before production because jurisdiction, incident type, and contractual duties may require a different period. Any approved change must be versioned and must apply prospectively with a documented migration decision.

## Failure isolation

Security logging must not break normal customer-facing behavior. Public and mobile request paths should emit through a bounded asynchronous outbox or best-effort server sink, use short timeouts, and never retry inline without a strict cap. Failed events go to a monitored dead-letter path or failure counter without returning internal logging errors to the user.

Sensitive admin mutations should write their domain audit record in the same transaction when feasible, or first create a durable operation/outbox record. If that privileged evidence path is unavailable, return a controlled admin-operation error rather than completing an untraceable sensitive change. This fail-closed rule applies to the admin mutation, not to normal marketplace use.

## Data exclusions

Never log passwords, OTP codes, MFA/TOTP secrets, access or refresh tokens, cookies, service-role or API keys, private signed URLs, raw authorization headers, payment-card data, hidden honeypot contents, message bodies, support attachments, raw request/response bodies, or unnecessary personal data. Redact provider errors before persistence. Reasons must have length limits and secret-pattern rejection and must not become a place to paste credentials.

The deployed `admin_audit_logs` insert policy currently allows an authenticated admin-team browser to provide nullable actor fields and before/after JSON. Treat those rows as operational notes until a server-attributed path and stricter grants are approved.
