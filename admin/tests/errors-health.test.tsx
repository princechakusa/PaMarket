import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../src/app/App';

describe('Errors and health', () => {
  beforeEach(() => window.history.replaceState({}, '', '/observability/errors'));
  it('connects the route and combines severity and subsystem filters', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Errors & Health' })).toBeInTheDocument();
    expect(screen.getByText('REFERENCE OBSERVABILITY DATA')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: 'Incident severity' }), { target: { value: 'P2 MEDIUM' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Incident subsystem' }), { target: { value: 'KYC/OCR' } });
    const table = screen.getByRole('table', { name: 'System incident queue' });
    expect(within(table).getAllByRole('row')).toHaveLength(2);
    expect(within(table).getByText(/OCR Failure/)).toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: 'Incident subsystem' }), { target: { value: 'SECURITY' } });
    expect(screen.getByRole('status')).toHaveTextContent('No reference incidents');
  }, 15_000);
  it('switches the inspected trace and keeps mitigation disconnected', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Inspect ERR-4085' }));
    const inspector = screen.getByRole('region', { name: 'Exception trace inspector' });
    expect(inspector).toHaveTextContent('TARGET: #ERR-4085');
    expect(inspector).toHaveTextContent('OCRConfidenceError');
    expect(inspector).not.toHaveTextContent('196.220.101.44');
    expect(within(inspector).getByRole('button', { name: 'FORCE FAILOVER' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'PURGE EDGE CACHE' })).toBeDisabled();
  });
});
