import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../src/app/App';

describe('User directory', () => {
  beforeEach(() => window.history.replaceState({}, '', '/marketplace/users'));
  it('filters by identity, tier, state and province and resets empty results', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'User Directory & Identity Management' })).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'Search users' }), { target: { value: '08-1188391' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'KYC tier' }), { target: { value: '2' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Enforcement state' }), { target: { value: 'Watchlist' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Province' }), { target: { value: 'Bulawayo' } });
    const table = screen.getByRole('table', { name: 'User identity registry' });
    expect(within(table).getAllByRole('row')).toHaveLength(2);
    expect(within(table).getByText('Chipo Sibanda')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: 'Province' }), { target: { value: 'Harare' } });
    expect(screen.getByRole('status')).toHaveTextContent('No reference accounts match');
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(within(table).getAllByRole('row')).toHaveLength(6);
  });
  it('updates the dossier without reusing another account’s evidence', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Dossier for Chipo Sibanda' }));
    const dossier = screen.getByRole('complementary', { name: 'Entity dossier' });
    for (const value of ['PAM-4109-BYO', 'Chipo Sibanda', '08-1188391-M-08', 'UNREGISTERED', '$820.00', '$400 disputed']) expect(dossier).toHaveTextContent(value);
    expect(dossier).not.toHaveTextContent('MacBook');
    expect(dossier).not.toHaveTextContent('Biometrics Verified');
    expect(within(dossier).getByRole('button', { name: 'BAN & SUSPEND' })).toBeDisabled();
    expect(within(dossier).getByRole('button', { name: 'RESET 2FA TOKEN' })).toBeDisabled();
  });
  it('selects only visible accounts and preserves selections across filters', () => {
    render(<App />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Province' }), { target: { value: 'Harare' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select all visible users' }));
    expect(screen.getByText('2 selected · 2 visible')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: 'Province' }), { target: { value: 'Bulawayo' } });
    expect(screen.getByRole('checkbox', { name: 'Select Chipo Sibanda' })).not.toBeChecked();
    expect(screen.getByText('2 selected · 0 visible')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reset user filters' }));
    expect(screen.getByRole('checkbox', { name: 'Select all visible users' })).toBePartiallyChecked();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select all visible users' }));
    expect(screen.getByText('5 selected · 5 visible')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select all visible users' }));
    expect(screen.getByText('0 selected · 0 visible')).toBeInTheDocument();
  });
});
