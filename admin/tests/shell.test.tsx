import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../src/app/App';
import { HoneypotField } from '../src/security/HoneypotField';
import { mockRoutes, navigationGroups } from '../src/app/navigation';

describe('Stage C admin shell', () => {
  beforeEach(() => window.history.replaceState({}, '', '/'));

  it('labels the dashboard and data as mock-only', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /good morning/i })).toBeInTheDocument();
    expect(screen.getByText(/every number and identity shown here is fictional/i)).toBeInTheDocument();
    expect(screen.getByText('Local mock')).toBeInTheDocument();
  });

  it('renders an explicitly unmigrated section route', () => {
    window.history.replaceState({}, '', '/marketplace/users');
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Users' })).toBeInTheDocument();
    expect(screen.getByText('Mock feature data only. This section is not connected to production data yet.')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/marketplace/users');
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
});
