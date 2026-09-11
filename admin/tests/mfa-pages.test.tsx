import { StrictMode } from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { createMemoryRouter, MemoryRouter, RouterProvider } from 'react-router-dom';
import type { AuthContextValue } from '../src/security/auth-context';

// Values that must never reach console.* anywhere in this file's flows.
// Deliberately fake — this test never talks to a real Supabase project.
const FAKE_SECRET = 'FAKETESTSECRETNOTREAL234567';
const RAW_FAKE_SVG = '<svg data-fake="not-a-real-qr"></svg>';
// Matches what the INSTALLED @supabase/auth-js client actually returns —
// verified directly in node_modules/@supabase/auth-js/dist/module/
// GoTrueClient.js, whose enroll() already does
// `data.totp.qr_code = \`data:image/svg+xml;utf-8,${data.totp.qr_code}\``
// before this app ever sees it.
const FAKE_QR = `data:image/svg+xml;utf-8,${RAW_FAKE_SVG}`;
const FAKE_URI = 'otpauth://totp/fake?secret=' + FAKE_SECRET;
const VALID_CODE = '654321';

const mfaService = vi.hoisted(() => ({
  enrollTotpFactor: vi.fn(),
  challengeAndVerifyTotp: vi.fn(),
  unenrollFactor: vi.fn(),
  listMfaFactors: vi.fn(),
}));
vi.mock('../src/services/supabase/mfa', () => mfaService);

let mockAuth: AuthContextValue;
vi.mock('../src/security/auth-context', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/security/auth-context')>();
  return { ...actual, useAuth: () => mockAuth };
});

import { LoginPage } from '../src/pages/LoginPage';
import { MfaChallengePage } from '../src/pages/MfaChallengePage';
import { SecuritySettingsPage } from '../src/pages/security/SecuritySettingsPage';
import { MfaEnrollPage } from '../src/pages/security/MfaEnrollPage';

function baseAuth(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    mode: 'live',
    status: 'anonymous',
    identity: null,
    accessToken: null,
    assuranceLevel: null,
    nextAssuranceLevel: null,
    error: null,
    signOut: vi.fn(),
    signInWithPassword: vi.fn(async () => ({ error: null })),
    refreshAssurance: vi.fn(async () => {}),
    ...overrides,
  };
}

function renderAt(path: string, page: React.ReactElement) {
  const router = createMemoryRouter(
    [
      { path: '/login', element: page.type === LoginPage ? page : <LoginPage /> },
      { path: '/mfa/challenge', element: page.type === MfaChallengePage ? page : <MfaChallengePage /> },
      { path: '/', element: <p>landed-on-dashboard</p> },
      { path: '/settings/security', element: <p>landed-on-security-settings</p> },
    ],
    { initialEntries: [path] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

describe('LoginPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows a mock-mode notice and no form when not live', () => {
    mockAuth = baseAuth({ mode: 'mock', status: 'anonymous' });
    renderAt('/login', <LoginPage />);
    expect(screen.getByText(/sign-in is not available/i)).toBeInTheDocument();
    expect(document.querySelector('form')).toBeNull();
  });

  it('renders the sign-in form when anonymous and live', () => {
    mockAuth = baseAuth({ mode: 'live', status: 'anonymous' });
    renderAt('/login', <LoginPage />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it('shows the configuration error instead of a non-functional form when live config is missing', () => {
    mockAuth = baseAuth({
      mode: 'live',
      status: 'configuration_error',
      error: 'Live admin mode requires the configured variables.',
    });
    renderAt('/login', <LoginPage />);
    expect(screen.getByRole('heading', { name: /live mode is not configured/i })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(/requires the configured variables/i);
    expect(document.querySelector('form')).toBeNull();
  });

  it('calls signInWithPassword on submit and blocks duplicate submission', async () => {
    let resolveSignIn: (value: { error: string | null }) => void = () => {};
    const signIn = vi.fn(() => new Promise<{ error: string | null }>((resolve) => { resolveSignIn = resolve; }));
    mockAuth = baseAuth({ status: 'anonymous', signInWithPassword: signIn });
    renderAt('/login', <LoginPage />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'admin@example.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'correct-password' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    fireEvent.click(screen.getByRole('button', { name: /signing in/i })); // second click while pending
    expect(signIn).toHaveBeenCalledTimes(1);
    resolveSignIn({ error: null });
    await waitFor(() => expect(signIn).toHaveBeenCalledTimes(1));
  });

  it('redirects to the sanitized returnTo when already authenticated, never to an external URL', () => {
    mockAuth = baseAuth({ status: 'authenticated' });
    renderAt('/login?returnTo=https%3A%2F%2Fevil.example%2Fsteal', <LoginPage />);
    expect(screen.getByText('landed-on-dashboard')).toBeInTheDocument();
  });

  it('redirects to /mfa/challenge when a second factor is still required', () => {
    mfaService.listMfaFactors.mockResolvedValue({ data: { all: [] }, error: null });
    mockAuth = baseAuth({ status: 'mfa_required' });
    renderAt('/login', <LoginPage />);
    expect(screen.queryByLabelText(/^email$/i)).not.toBeInTheDocument();
  });
});

describe('MfaChallengePage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('redirects to /login when anonymous (never shows the code form)', () => {
    mockAuth = baseAuth({ status: 'anonymous' });
    renderAt('/mfa/challenge', <MfaChallengePage />);
    // The router above sends anonymous straight to /login's own render.
    expect(screen.queryByLabelText(/authentication code/i)).not.toBeInTheDocument();
  });

  it('redirects to returnTo once already authenticated', () => {
    mockAuth = baseAuth({ status: 'authenticated' });
    renderAt('/mfa/challenge?returnTo=%2Fsettings%2Fsecurity', <MfaChallengePage />);
    expect(screen.getByText('landed-on-security-settings')).toBeInTheDocument();
  });

  it('lists verified TOTP factors and challenges the selected one', async () => {
    mfaService.listMfaFactors.mockResolvedValue({ data: { all: [{ id: 'f1', factor_type: 'totp', status: 'verified', friendly_name: 'Phone', created_at: '', updated_at: '' }] }, error: null });
    mfaService.challengeAndVerifyTotp.mockResolvedValue({ data: { factorId: 'f1' }, error: null });
    mockAuth = baseAuth({ status: 'mfa_required' });
    renderAt('/mfa/challenge', <MfaChallengePage />);
    await waitFor(() => expect(screen.getByLabelText(/authentication code/i)).not.toBeDisabled());
    fireEvent.change(screen.getByLabelText(/authentication code/i), { target: { value: VALID_CODE } });
    fireEvent.click(screen.getByRole('button', { name: /verify/i }));
    await waitFor(() => expect(mfaService.challengeAndVerifyTotp).toHaveBeenCalledWith('f1', VALID_CODE));
    expect(mockAuth.refreshAssurance).toHaveBeenCalledTimes(1);
  });

  it('shows a safe, generic error for an invalid code and never echoes the code', async () => {
    mfaService.listMfaFactors.mockResolvedValue({ data: { all: [{ id: 'f1', factor_type: 'totp', status: 'verified', friendly_name: 'Phone', created_at: '', updated_at: '' }] }, error: null });
    mfaService.challengeAndVerifyTotp.mockResolvedValue({ data: null, error: { code: 'request_failed', message: 'Invalid TOTP code entered for factor f1' } });
    mockAuth = baseAuth({ status: 'mfa_required' });
    renderAt('/mfa/challenge', <MfaChallengePage />);
    await waitFor(() => expect(screen.getByLabelText(/authentication code/i)).not.toBeDisabled());
    fireEvent.change(screen.getByLabelText(/authentication code/i), { target: { value: '000000' } });
    fireEvent.click(screen.getByRole('button', { name: /verify/i }));
    const alertText = await screen.findByRole('alert');
    expect(alertText.textContent).not.toMatch(/000000/);
    expect(alertText.textContent).not.toMatch(/Invalid TOTP code entered for factor/);
    expect(alertText.textContent).toMatch(/not accepted/i);
  });

  it('blocks a duplicate submission while a challenge is already in flight', async () => {
    mfaService.listMfaFactors.mockResolvedValue({ data: { all: [{ id: 'f1', factor_type: 'totp', status: 'verified', friendly_name: 'Phone', created_at: '', updated_at: '' }] }, error: null });
    let resolveVerify: (value: unknown) => void = () => {};
    mfaService.challengeAndVerifyTotp.mockReturnValue(new Promise((resolve) => { resolveVerify = resolve; }));
    mockAuth = baseAuth({ status: 'mfa_required' });
    renderAt('/mfa/challenge', <MfaChallengePage />);
    await waitFor(() => expect(screen.getByLabelText(/authentication code/i)).not.toBeDisabled());
    fireEvent.change(screen.getByLabelText(/authentication code/i), { target: { value: VALID_CODE } });
    fireEvent.click(screen.getByRole('button', { name: /verify/i }));
    fireEvent.click(screen.getByRole('button', { name: /verifying/i }));
    expect(mfaService.challengeAndVerifyTotp).toHaveBeenCalledTimes(1);
    resolveVerify({ data: { factorId: 'f1' }, error: null });
  });

  it('never prints the OTP code or a TOTP secret to the console across the whole flow', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mfaService.listMfaFactors.mockResolvedValue({ data: { all: [{ id: 'f1', factor_type: 'totp', status: 'verified', friendly_name: 'Phone', created_at: '', updated_at: '' }] }, error: null });
    mfaService.challengeAndVerifyTotp.mockResolvedValue({ data: { factorId: 'f1' }, error: null });
    mockAuth = baseAuth({ status: 'mfa_required' });
    renderAt('/mfa/challenge', <MfaChallengePage />);
    await waitFor(() => expect(screen.getByLabelText(/authentication code/i)).not.toBeDisabled());
    fireEvent.change(screen.getByLabelText(/authentication code/i), { target: { value: VALID_CODE } });
    fireEvent.click(screen.getByRole('button', { name: /verify/i }));
    await waitFor(() => expect(mfaService.challengeAndVerifyTotp).toHaveBeenCalled());
    for (const spy of [logSpy, warnSpy, errorSpy]) {
      for (const call of spy.mock.calls) expect(call.join(' ')).not.toContain(VALID_CODE);
    }
    logSpy.mockRestore(); warnSpy.mockRestore(); errorSpy.mockRestore();
  });
});

describe('SecuritySettingsPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows loading, then verified and unverified factors separately', async () => {
    mfaService.listMfaFactors.mockResolvedValue({
      data: { all: [
        { id: 'v1', factor_type: 'totp', status: 'verified', friendly_name: 'Phone', created_at: new Date().toISOString(), updated_at: '' },
        { id: 'u1', factor_type: 'totp', status: 'unverified', friendly_name: 'Tablet', created_at: new Date().toISOString(), updated_at: '' },
      ] },
      error: null,
    });
    mockAuth = baseAuth({ status: 'authenticated', assuranceLevel: 'aal2' });
    render(<MemoryRouter><SecuritySettingsPage /></MemoryRouter>);
    expect(screen.getAllByText(/loading/i).length).toBeGreaterThan(0);
    await waitFor(() => expect(screen.getByText('Phone')).toBeInTheDocument());
    expect(screen.getByText('Tablet')).toBeInTheDocument();
    expect(screen.getAllByText(/verified/i).length).toBeGreaterThan(0);
  });

  it('requires a confirm click before removing a factor, and blocks a second click while removing', async () => {
    mfaService.listMfaFactors.mockResolvedValue({ data: { all: [{ id: 'v1', factor_type: 'totp', status: 'verified', friendly_name: 'Phone', created_at: new Date().toISOString(), updated_at: '' }] }, error: null });
    let resolveUnenroll: (value: unknown) => void = () => {};
    mfaService.unenrollFactor.mockReturnValue(new Promise((resolve) => { resolveUnenroll = resolve; }));
    mockAuth = baseAuth({ status: 'authenticated', assuranceLevel: 'aal2' });
    render(<MemoryRouter><SecuritySettingsPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('Phone')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /^remove$/i }));
    expect(mfaService.unenrollFactor).not.toHaveBeenCalled(); // confirm dialog required first
    fireEvent.click(screen.getByRole('button', { name: /confirm remove/i }));
    fireEvent.click(screen.getByRole('button', { name: /removing/i }));
    expect(mfaService.unenrollFactor).toHaveBeenCalledTimes(1);
    resolveUnenroll({ data: { factorId: 'v1' }, error: null });
  });
});

describe('MfaEnrollPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('starts enrollment, shows the QR/secret via a plain <img>, verifies, and reaches "done"', async () => {
    mfaService.enrollTotpFactor.mockResolvedValue({ data: { id: 'f1', friendlyName: 'Test', totp: { qrCode: FAKE_QR, secret: FAKE_SECRET, uri: FAKE_URI } }, error: null });
    mfaService.challengeAndVerifyTotp.mockResolvedValue({ data: { factorId: 'f1' }, error: null });
    mockAuth = baseAuth({ status: 'authenticated', assuranceLevel: 'aal2' });
    render(<MemoryRouter><MfaEnrollPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /start enrollment/i }));
    const img = await screen.findByAltText(/authenticator qr code/i);
    expect(img.tagName).toBe('IMG');
    // Exactly the value the installed client returned — no re-prefixing,
    // no double `data:image/svg+xml` in the src.
    expect(img.getAttribute('src')).toBe(FAKE_QR);
    expect((img.getAttribute('src')?.match(/data:image\/svg\+xml/g) ?? []).length).toBe(1);
    expect(screen.getByText(FAKE_SECRET)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/verification code/i), { target: { value: VALID_CODE } });
    fireEvent.click(screen.getByRole('button', { name: /verify and finish/i }));
    await waitFor(() => expect(screen.getByText(/authenticator verified/i)).toBeInTheDocument());
    expect(mockAuth.refreshAssurance).toHaveBeenCalledTimes(1);
  });

  it('also renders correctly if a future/older client returns raw, unprefixed SVG', async () => {
    mfaService.enrollTotpFactor.mockResolvedValue({ data: { id: 'f1', friendlyName: 'Test', totp: { qrCode: RAW_FAKE_SVG, secret: FAKE_SECRET, uri: FAKE_URI } }, error: null });
    mockAuth = baseAuth({ status: 'authenticated' });
    render(<MemoryRouter><MfaEnrollPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /start enrollment/i }));
    const img = await screen.findByAltText(/authenticator qr code/i);
    expect(img.getAttribute('src')).toBe(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(RAW_FAKE_SVG)}`);
  });

  it('shows a safe error and keeps the setup key available when the QR value is unsafe', async () => {
    mfaService.enrollTotpFactor.mockResolvedValue({ data: { id: 'f1', friendlyName: 'Test', totp: { qrCode: 'javascript:alert(document.cookie)', secret: FAKE_SECRET, uri: FAKE_URI } }, error: null });
    mockAuth = baseAuth({ status: 'authenticated' });
    render(<MemoryRouter><MfaEnrollPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /start enrollment/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.queryByAltText(/authenticator qr code/i)).not.toBeInTheDocument();
    expect(screen.getByRole('alert').textContent).toMatch(/could not be displayed safely/i);
    // The manual fallback must still be usable even though the QR was rejected.
    expect(screen.getByText(FAKE_SECRET)).toBeInTheDocument();
    expect(screen.getByLabelText(/verification code/i)).not.toBeDisabled();
  });

  it('React StrictMode double-rendering/double-effect does not create two unverified factors', async () => {
    mfaService.enrollTotpFactor.mockResolvedValue({ data: { id: 'f1', friendlyName: 'Test', totp: { qrCode: FAKE_QR, secret: FAKE_SECRET, uri: FAKE_URI } }, error: null });
    mockAuth = baseAuth({ status: 'authenticated' });
    render(
      <StrictMode>
        <MemoryRouter><MfaEnrollPage /></MemoryRouter>
      </StrictMode>,
    );
    // enroll() is only ever fired by an explicit user click, never inside a
    // useEffect — StrictMode's double-invocation of effects on mount has
    // nothing to double, and the click itself is still guarded.
    expect(mfaService.enrollTotpFactor).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /start enrollment/i }));
    await screen.findByAltText(/authenticator qr code/i);
    expect(mfaService.enrollTotpFactor).toHaveBeenCalledTimes(1);
  });

  it('cleans up the unverified factor when enrollment is cancelled', async () => {
    mfaService.enrollTotpFactor.mockResolvedValue({ data: { id: 'f1', friendlyName: 'Test', totp: { qrCode: FAKE_QR, secret: FAKE_SECRET, uri: FAKE_URI } }, error: null });
    mfaService.unenrollFactor.mockResolvedValue({ data: { factorId: 'f1' }, error: null });
    mockAuth = baseAuth({ status: 'authenticated', assuranceLevel: 'aal1' });
    render(<MemoryRouter><MfaEnrollPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /start enrollment/i }));
    await waitFor(() => expect(screen.getByText(FAKE_SECRET)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /cancel enrollment/i }));
    await waitFor(() => expect(mfaService.unenrollFactor).toHaveBeenCalledWith('f1'));
    await waitFor(() => expect(screen.getByRole('button', { name: /start enrollment/i })).toBeInTheDocument());
    expect(screen.queryByText(FAKE_SECRET)).not.toBeInTheDocument();
  });

  it('recovers to a usable state after an enrollment API failure', async () => {
    mfaService.enrollTotpFactor.mockResolvedValue({ data: null, error: { code: 'request_failed', message: 'enroll failed' } });
    mockAuth = baseAuth({ status: 'authenticated' });
    render(<MemoryRouter><MfaEnrollPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /start enrollment/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /start enrollment/i })).toBeInTheDocument();
  });

  it('never prints the QR payload or setup secret to the console', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mfaService.enrollTotpFactor.mockResolvedValue({ data: { id: 'f1', friendlyName: 'Test', totp: { qrCode: FAKE_QR, secret: FAKE_SECRET, uri: FAKE_URI } }, error: null });
    mockAuth = baseAuth({ status: 'authenticated' });
    render(<MemoryRouter><MfaEnrollPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /start enrollment/i }));
    await waitFor(() => expect(screen.getByText(FAKE_SECRET)).toBeInTheDocument());
    for (const spy of [logSpy, errorSpy]) {
      for (const call of spy.mock.calls) {
        const joined = call.join(' ');
        expect(joined).not.toContain(FAKE_SECRET);
        expect(joined).not.toContain(FAKE_URI);
        expect(joined).not.toContain(FAKE_QR);
      }
    }
    logSpy.mockRestore(); errorSpy.mockRestore();
  });

  it('shows the mock-mode notice instead of attempting enrollment', () => {
    mockAuth = baseAuth({ mode: 'mock', status: 'authenticated' });
    render(<MemoryRouter><MfaEnrollPage /></MemoryRouter>);
    expect(screen.getByText(/enrollment is not available/i)).toBeInTheDocument();
    expect(mfaService.enrollTotpFactor).not.toHaveBeenCalled();
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});
