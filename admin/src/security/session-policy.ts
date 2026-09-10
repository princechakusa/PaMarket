export const sessionPolicy = {
  authStorageKey: 'pamarket.admin.v2.auth',
  idleWarningMinutes: 25,
  idleExpiryMinutes: 30,
  revalidateRoleOnAuthChange: true,
  mfaEnforcement: 'documented-only',
} as const;

// The timeout values describe the future server-backed lifecycle. Stage C
// observes Supabase auth changes but does not invent a client-only security
// boundary or claim that the legacy admin_sessions table revokes JWTs.
