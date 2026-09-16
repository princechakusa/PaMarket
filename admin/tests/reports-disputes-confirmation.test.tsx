import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { AuthContextValue } from '../src/security/auth-context';

let mockAuth: AuthContextValue;
vi.mock('../src/security/auth-context', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/security/auth-context')>();
  return { ...actual, useAuth: () => mockAuth };
});

const trustSafety = vi.hoisted(() => ({
  listReports: vi.fn(),
  updateReportStatus: vi.fn(),
  listAppeals: vi.fn(),
  updateAppealStatus: vi.fn(),
}));
vi.mock('../src/services/trust-safety/query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/services/trust-safety/query')>();
  return { ...actual, ...trustSafety };
});

import { ReportsDisputesPage, DECISION_CONFIRM_TEXT } from '../src/pages/ReportsDisputesPage';

function baseAuth(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    mode: 'live',
    status: 'authenticated',
    identity: { id: 'admin-1', permissions: [] } as any,
    accessToken: 'token',
    assuranceLevel: 'aal1',
    nextAssuranceLevel: null,
    error: null,
    signOut: vi.fn(),
    signInWithPassword: vi.fn(async () => ({ error: null })),
    refreshAssurance: vi.fn(async () => {}),
    ...overrides,
  } as AuthContextValue;
}

const REPORT_ROW = { id: 'rep-1', target_type: 'listing', target_id: 'listing-1', reason: 'spam', severity: 'low', status: 'open', created_at: Date.now() };
const APPEAL_ROW = { id: 'app-1', entity: 'listing', entity_id: 'listing-2', reason: 'incorrect removal', status: 'open', created_at: '2026-09-01T00:00:00Z', decided_at: null };

async function selectFirstReport() {
  await waitFor(() => screen.getByRole('table', { name: 'Reports' }));
  fireEvent.click(screen.getByText('spam'));
}

async function selectFirstAppeal() {
  fireEvent.click(screen.getByRole('button', { name: 'Appeals' }));
  await waitFor(() => screen.getByRole('table', { name: 'Appeals' }));
  fireEvent.click(screen.getByText('incorrect removal'));
}

describe('ReportsDisputesPage confirmation (A5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth = baseAuth();
    trustSafety.listReports.mockResolvedValue({ data: { rows: [REPORT_ROW], total: 1, page: 1, pageSize: 20 }, error: null });
    trustSafety.listAppeals.mockResolvedValue({ data: { rows: [APPEAL_ROW], total: 1, page: 1, pageSize: 20 }, error: null });
    trustSafety.updateReportStatus.mockResolvedValue({ data: { id: 'rep-1' }, error: null });
    trustSafety.updateAppealStatus.mockResolvedValue({ data: { id: 'app-1', notified: true }, error: null });
  });
  afterEach(() => vi.restoreAllMocks());

  it('declares confirmation text for exactly the four high-impact decisions, never Reopen', () => {
    expect(Object.keys(DECISION_CONFIRM_TEXT).sort()).toEqual(['approved', 'dismissed', 'rejected', 'resolved']);
  });

  it('Resolve: cancelling the confirmation prevents the mutation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<ReportsDisputesPage />);
    await selectFirstReport();
    fireEvent.click(await screen.findByRole('button', { name: 'Resolve' }));
    expect(trustSafety.updateReportStatus).not.toHaveBeenCalled();
  });

  it('Resolve: confirming proceeds with the mutation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<ReportsDisputesPage />);
    await selectFirstReport();
    fireEvent.click(await screen.findByRole('button', { name: 'Resolve' }));
    await waitFor(() => expect(trustSafety.updateReportStatus).toHaveBeenCalledWith('rep-1', 'resolved'));
  });

  it('Dismiss: cancelling the confirmation prevents the mutation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<ReportsDisputesPage />);
    await selectFirstReport();
    fireEvent.click(await screen.findByRole('button', { name: 'Dismiss' }));
    expect(trustSafety.updateReportStatus).not.toHaveBeenCalled();
  });

  it('Dismiss: confirming proceeds with the mutation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<ReportsDisputesPage />);
    await selectFirstReport();
    fireEvent.click(await screen.findByRole('button', { name: 'Dismiss' }));
    await waitFor(() => expect(trustSafety.updateReportStatus).toHaveBeenCalledWith('rep-1', 'dismissed'));
  });

  it('Approve appeal: cancelling the confirmation prevents the mutation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<ReportsDisputesPage />);
    await selectFirstAppeal();
    fireEvent.click(await screen.findByRole('button', { name: 'Approve appeal' }));
    expect(trustSafety.updateAppealStatus).not.toHaveBeenCalled();
  });

  it('Approve appeal: confirming proceeds with the mutation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<ReportsDisputesPage />);
    await selectFirstAppeal();
    fireEvent.click(await screen.findByRole('button', { name: 'Approve appeal' }));
    await waitFor(() => expect(trustSafety.updateAppealStatus).toHaveBeenCalledWith('app-1', 'approved'));
  });

  it('Reject appeal: cancelling the confirmation prevents the mutation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<ReportsDisputesPage />);
    await selectFirstAppeal();
    fireEvent.click(await screen.findByRole('button', { name: 'Reject appeal' }));
    expect(trustSafety.updateAppealStatus).not.toHaveBeenCalled();
  });

  it('Reject appeal: confirming proceeds with the mutation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<ReportsDisputesPage />);
    await selectFirstAppeal();
    fireEvent.click(await screen.findByRole('button', { name: 'Reject appeal' }));
    await waitFor(() => expect(trustSafety.updateAppealStatus).toHaveBeenCalledWith('app-1', 'rejected'));
  });

  it('Reopen never prompts for confirmation (existing reversal behavior preserved)', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    render(<ReportsDisputesPage />);
    await selectFirstReport();
    fireEvent.click(await screen.findByRole('button', { name: 'Reopen' }));
    expect(confirmSpy).not.toHaveBeenCalled();
    await waitFor(() => expect(trustSafety.updateReportStatus).toHaveBeenCalledWith('rep-1', 'open'));
  });
});
