# Security event location evidence

The React Admin sends production security signals through `pamarket-admin-security-proxy.chakusaprince.workers.dev`. The Worker reads its own `request.cf` location and `CF-Connecting-IP`, signs the observation with its Cloudflare secret, and forwards the original event to the existing Supabase `record-security-event` function. Supabase verifies the signature and a two-minute timestamp window before storing location under `security_events.metadata.network_location`. Direct calls to Supabase remain accepted without location; caller-supplied location headers are rejected.

The existing `get_security_event` RPC removes `network_location` for non-Super Admin callers, matching its IP restriction. Event exports require Super Admin and AAL2 and record an export receipt. Location coordinates are an **approximate IP database result**, never GPS or proof of a person's physical location. User-agent-based device descriptions are estimates. The browser can report a failed login or honeypot signal, but it cannot attest to Supabase Auth's password decision.

The Worker private signing key is a Cloudflare secret named `CF_GEO_SIGNING_KEY`. The matching public key is in `supabase/functions/record-security-event/index.ts`. Rotate them together; deploy the verifier before switching the Worker key. No private key belongs in this repository or an export.

Supabase Auth database audit logging was enabled in the live dashboard (`audit_log_disable_postgres=false`), so future supported Auth events can be retained in `auth.audit_log_entries`. A controlled failed sign-in with a random nonexistent address did **not** produce a database audit row. Do not describe that table as a complete failed-login ledger. The browser signal remains best-effort and source-labelled; provider Auth logs remain a separate investigation source. Existing absent history cannot be reconstructed.

Camera access requires an explicit browser permission grant from the visitor. An administrator cannot remotely override a refusal; no covert camera capture is implemented.
