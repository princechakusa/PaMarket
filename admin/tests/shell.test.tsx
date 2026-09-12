import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../src/app/App';
import { HoneypotField } from '../src/security/HoneypotField';
import { mockRoutes, navigationGroups, opsNavigationGroups } from '../src/app/navigation';

describe('Stage C admin shell', () => {
  beforeEach(() => window.history.replaceState({}, '', '/'));

  it('renders the approved enterprise ops dashboard and identifies reference data', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /operational queue matrix/i })).toBeInTheDocument();
    expect(screen.getByText('REFERENCE DATA MODE')).toBeInTheDocument();
    expect(screen.getByText('PREVIEW · LOCAL')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /security & honeypot/i })).toHaveAttribute('href', '/security/events');
    expect(screen.getByRole('button', { name: /emergency freeze/i })).toBeDisabled();
  });

  it('renders an explicitly unmigrated section route', () => {
    window.history.replaceState({}, '', '/marketplace/users');
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Users' })).toBeInTheDocument();
    expect(screen.getByText('Mock feature data only. This section is not connected to production data yet.')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/marketplace/users');
  });

  it('renders the listings moderation reference and opens its forensic dossier', () => {
    window.history.replaceState({}, '', '/marketplace/listings');
    render(<App />);
    expect(screen.getByRole('table', { name: 'Pending Listings Moderation Grid' })).toBeInTheDocument();
    expect(screen.getByText('REFERENCE CASE DATA')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Approve' })[0]).toBeDisabled();
    fireEvent.click(screen.getAllByTitle('Inspect Full Dossier')[0]);
    expect(screen.getByRole('complementary', { name: 'Forensic dossier' })).toBeInTheDocument();
  });

  it('renders real Zimbabwe province geometry without claiming live download data', () => {
    render(<App />);
    expect(screen.getByRole('img', { name: /Zimbabwe provincial activity map/ }).querySelectorAll('path')).toHaveLength(10);
    expect(screen.getByText('DOWNLOAD TELEMETRY: NOT CONNECTED')).toBeInTheDocument();
  });

  it('renders the business verification queue and switches the inspected dossier', () => {
    window.history.replaceState({}, '', '/marketplace/verifications');
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Business Verification & KYC Queue' })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Business verification dossiers' })).toBeInTheDocument();
    expect(screen.getByText('REFERENCE DOSSIERS')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Borrowdale Auto Exchange'));
    expect(screen.getByRole('complementary', { name: 'Forensic KYC Inspector' })).toHaveTextContent('Borrowdale Auto Exchange');
    expect(screen.getByRole('button', { name: /Authorize & Issue Merchant Badge/i })).toBeDisabled();
  });

  it('keeps the honeypot placeholder out of keyboard navigation', () => {
    const { container } = render(<HoneypotField />);
    const input = container.querySelector('input');
    expect(input).toHaveAttribute('tabindex', '-1');
    expect(input).toHaveAttribute('autocomplete', 'off');
  });

  it('shows only safe fields on the protected connection check', () => {
    window.history.replaceState({}, '', '/security');
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Connection check' })).toBeInTheDocument();
    expect(screen.getByText('mock')).toBeInTheDocument();
    expect(screen.queryByText(/access token|refresh token|service role/i)).not.toBeInTheDocument();
  });

  it('defines the complete Stage A navigation surface without duplicate routes', () => {
    expect(navigationGroups).toHaveLength(13);
    expect(mockRoutes).toHaveLength(55);
    expect(new Set(mockRoutes.map((route) => route.path)).size).toBe(55);
  });

  it('links visibly to the real security settings route and exposes its active state', () => {
    const securityItem = navigationGroups
      .find((group) => group.label === 'Security')
      ?.items.find((item) => item.label === 'Security settings');
    expect(securityItem).toEqual({
      label: 'Security settings',
      path: '/settings/security',
      permission: 'security.view',
    });

    const compactSecurityItem = opsNavigationGroups.flatMap((group) => group.items).find((item) => item.path === '/settings/security');
    expect(compactSecurityItem?.label).toBe('Security Settings');
    window.history.replaceState({}, '', '/settings/security');
    render(<App />);
    const link = screen.getByRole('link', { name: /security settings/i });
    expect(link).toHaveAttribute('href', '/settings/security');
    expect(link).toHaveAttribute('aria-current', 'page');
  });
});
