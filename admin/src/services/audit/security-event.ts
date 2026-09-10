export type SecurityEventResult = 'success' | 'failure' | 'blocked' | 'suspicious';
export type MfaAssurance = 'aal1' | 'aal2' | 'unknown';

/**
 * Read model for a future server-generated security evidence record.
 * The browser must never be allowed to insert this record or supply its
 * identity, network, assurance, rate-limit, or result fields as fact.
 */
export type SecurityEvidenceRecord = {
  id: string;
  occurredAt: string;
  authenticatedUserId: string | null;
  adminRole: string | null;
  action: string;
  target: { entityType: string; entityId: string | null };
  network: { ipAddress: string | null; userAgent: string | null };
  source: { route: string | null; actionSource: string; edgeFunction: string | null; rpc: string | null };
  result: SecurityEventResult;
  requestId: string;
  correlationId: string;
  mfaAssurance: MfaAssurance;
  abuseSignals: {
    honeypotTriggered: boolean;
    timeToSubmitMs: number | null;
    rateLimited: boolean;
    rateLimitRule: string | null;
  };
  adminReason: string | null;
  auditLogId: string | null;
};

/** The only evidence-related values a future admin UI may suggest. */
export type SecurityEvidenceHint = {
  correlationId: string;
  route: string;
  actionSource: string;
  adminReason?: string;
};
