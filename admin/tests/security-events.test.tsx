import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { AuthContextValue } from '../src/security/auth-context';

const reportService = vi.hoisted(() => ({ reportLoginSecurityEvent: vi.fn(async () => {}) }));
vi.mock('../src/services/security-events/report', () => reportService);

const queryService = vi.hoisted(() => ({
  listSecurityEvents: vi.fn(),
  listHoldsForEvent: vi.fn(),
  placeLegalHold: vi.fn(),
  releaseLegalHold: vi.fn(),
  PAGE_SIZE: 25,
}));
vi.mock('../src/services/security-events/query', () => queryService);

const getSupabaseClient = vi.hoisted(() => vi.fn());
vi.mock('../src/services/supabase/client', () => ({ getSupabaseClient }));

let mockAuth: AuthContextValue;
vi.mock('../src/security/auth-context', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/security/auth-context')>();
  return { ...actual, useAuth: () => mockAuth };
});

import { LoginPage } from '../src/pages/LoginPage';
import { SecurityEventsPage } from '../src/pages/security/SecurityEventsPage';
import { navigationGroups } from '../src/app/navigation';

function baseAuth(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    mode: 'live',
    status: 'anonymous',
    identity: null,
    accessToken: null,
    assuranceLevel: null,
    nextAssuranceLevel: null,
    error: null,
    signOut: vi.fn(async () => {}),
    signInWithPassword: vi.fn(async () => ({ error: null })),
    refreshAssurance: vi.fn(async () => {}),
    ...overrides,
  };
}

describe('admin login honeypot', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does not call signInWithPassword when the honeypot is filled, sends only the fixed signal, and shows the generic failure', async () => {
    const signIn = vi.fn(async () => ({ error: null }));
    mockAuth = baseAuth({ signInWithPassword: signIn });
    render(<MemoryRouter><LoginPage /></MemoryRouter>);

    fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: 'admin@example.com' } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'correct-horse-battery-staple' } });
    // The honeypot input has no accessible label a real user would use —
    // it is reached here only because the test knows its field name.
    const honeypot = document.querySelector('input[name="company_website"]') as HTMLInputElement;
    expect(honeypot).toBeTruthy();
    expect(honeypot).toHaveAttribute('tabindex', '-1');
    fireEvent.change(honeypot, { target: { value: 'https://spambot.example' } });

    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(reportService.reportLoginSecurityEvent).toHaveBeenCalledTimes(1));
    expect(signIn).not.toHaveBeenCalled();
    expect(reportService.reportLoginSecurityEvent).toHaveBeenCalledWith('admin_login_honeypot');
    // No email/password/honeypot value in the call at all — the function
    // signature itself has no such parameter, so there is nothing to leak.
    const callArgs = reportService.reportLoginSecurityEvent.mock.calls[0];
    expect(callArgs).toEqual(['admin_login_honeypot']);
    expect(JSON.stringify(callArgs)).not.toContain('spambot');
    expect(JSON.stringify(callArgs)).not.toContain('correct-horse-battery-staple');
    expect(screen.getByRole('alert').textContent).toMatch(/not accepted/i);
  });

  it('prevents a duplicate submission while the honeypot report is in flight', async () => {
    let resolveReport: () => void = () => {};
    reportService.reportLoginSecurityEvent.mockReturnValue(new Promise<void>((resolve) => { resolveReport = resolve; }));
    const signIn = vi.fn(async () => ({ error: null }));
    mockAuth = baseAuth({ signInWithPassword: signIn });
    render(<MemoryRouter><LoginPage /></MemoryRouter>);

    fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'x' } });
    const honeypot = document.querySelector('input[name="company_website"]') as HTMLInputElement;
    fireEvent.change(honeypot, { target: { value: 'filled' } });

    const button = screen.getByRole('button', { name: /sign in/i });
    fireEvent.click(button);
    fireEvent.click(button);
    resolveReport();
    await waitFor(() => expect(reportService.reportLoginSecurityEvent).toHaveBeenCalledTimes(1));
    expect(signIn).not.toHaveBeenCalled();
  });

  it('records a safe reason code (and the same generic message) for an invalid real login attempt', async () => {
    const signIn = vi.fn(async () => ({ error: 'Invalid login credentials' }));
    mockAuth = baseAuth({ signInWithPassword: signIn });
    render(<MemoryRouter><LoginPage /></MemoryRouter>);

    fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: 'admin@example.com' } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'wrong-password' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(reportService.reportLoginSecurityEvent).toHaveBeenCalledTimes(1));
    expect(reportService.reportLoginSecurityEvent).toHaveBeenCalledWith('admin_login_failed', { reasonCode: 'invalid_credentials' });
    const call = reportService.reportLoginSecurityEvent.mock.calls[0];
    expect(JSON.stringify(call)).not.toContain('wrong-password');
    expect(JSON.stringify(call)).not.toContain('admin@example.com');
    expect(screen.getByRole('alert').textContent).toMatch(/not accepted/i);
  });

  it('reports admin_login_succeeded with the fresh session token on a real successful login', async () => {
    const signIn = vi.fn(async () => ({ error: null }));
    getSupabaseClient.mockReturnValue({ auth: { getSession: async () => ({ data: { session: { access_token: 'fresh-token' } } }) } });
    mockAuth = baseAuth({ signInWithPassword: signIn });
    render(<MemoryRouter><LoginPage /></MemoryRouter>);

    fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: 'admin@example.com' } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'correct-password' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(reportService.reportLoginSecurityEvent).toHaveBeenCalledWith('admin_login_succeeded', { accessToken: 'fresh-token' }));
  });
});

describe('Security Events navigation', () => {
  it('lists Security events under Observability, gated by audit.view', () => {
    const group = navigationGroups.find((entry) => entry.label === 'Observability');
    const item = group?.items.find((entry) => entry.path === '/security/events');
    expect(item).toBeTruthy();
    expect(item?.permission).toBe('audit.view');
  });
});

describe('SecurityEventsPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('requires an aal2 session before attempting any query', () => {
    mockAuth = baseAuth({ status: 'authenticated', assuranceLevel: 'aal1', identity: { id: 'x', name: 'Test', role: 'super_admin', permissions: [] } });
    render(<MemoryRouter><SecurityEventsPage /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: /aal2 session is required/i })).toBeInTheDocument();
    expect(queryService.listSecurityEvents).not.toHaveBeenCalled();
  });

  it('shows a loading skeleton, then the loaded table', async () => {
    queryService.listSecurityEvents.mockResolvedValue({
      data: { rows: [{ id: 'e1', event_type: 'admin_login_failed', severity: 'notice', source: 'edge_function', occurred_at: new Date().toISOString(), received_at: '', actor_user_id: null, actor_role: null, actor_authenticated: false, session_id: null, assurance_level: 'aal1', target_type: null, target_id: null, action: 'login', outcome: 'failure', reason_code: 'invalid_credentials', correlation_id: null, request_path: '/login', request_method: 'POST', ip_address: null, ip_source: 'unavailable', user_agent: null, event_key: null, metadata: {}, retention_until: '', created_at: '' }], total: 1, page: 1, pageSize: 25 },
      error: null,
    });
    mockAuth = baseAuth({ status: 'authenticated', assuranceLevel: 'aal2', identity: { id: 'x', name: 'Test', role: 'admin', permissions: [] } });
    render(<MemoryRouter><SecurityEventsPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('admin_login_failed')).toBeInTheDocument());
    // admin (not super_admin) must not see the IP column at all.
    expect(screen.queryByText('IP')).not.toBeInTheDocument();
  });

  it('shows an empty state distinctly from an error state', async () => {
    queryService.listSecurityEvents.mockResolvedValue({ data: { rows: [], total: 0, page: 1, pageSize: 25 }, error: null });
    mockAuth = baseAuth({ status: 'authenticated', assuranceLevel: 'aal2', identity: { id: 'x', name: 'Test', role: 'admin', permissions: [] } });
    render(<MemoryRouter><SecurityEventsPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText(/nothing to show/i)).toBeInTheDocument());
  });

  it('shows an error state with a working retry', async () => {
    queryService.listSecurityEvents
      .mockResolvedValueOnce({ data: null, error: { code: 'request_failed', message: 'Could not reach the database.', retryable: true } })
      .mockResolvedValueOnce({ data: { rows: [], total: 0, page: 1, pageSize: 25 }, error: null });
    mockAuth = baseAuth({ status: 'authenticated', assuranceLevel: 'aal2', identity: { id: 'x', name: 'Test', role: 'admin', permissions: [] } });
    render(<MemoryRouter><SecurityEventsPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    await waitFor(() => expect(queryService.listSecurityEvents).toHaveBeenCalledTimes(2));
  });
});
