import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/app/App';

describe('General settings', () => {
  beforeEach(() => window.history.replaceState({}, '', '/settings/general'));
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
  it('connects settings navigation and validates and discards local edits', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'General Settings & Policy Engine' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Security & Session Policies' })).toHaveAttribute('href', '/settings/security');
    const rate = screen.getByRole('spinbutton', { name: 'Target ZiG Override Rate' });
    fireEvent.change(rate, { target: { value: '-1' } });
    expect(rate).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('button', { name: 'Export Draft (.JSON)' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Discard Changes' }));
    expect(rate).toHaveValue(26.854);
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Dual-Approval Ceiling' }), { target: { value: '1' } });
    expect(screen.getByRole('alert')).toHaveTextContent('at least the unverified limit');
    fireEvent.click(screen.getByRole('button', { name: 'Discard Changes' }));
    expect(screen.getByRole('button', { name: 'Export Draft (.JSON)' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Save & Sign with Hardware Token (AAL2)' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Engage Escrow Freeze Protocol' })).toBeDisabled();
  });
  it('exports the current draft with an explicit non-production marker', async () => {
    vi.useFakeTimers();
    const blobs: BlobPart[][] = [];
    const NativeBlob = Blob;
    vi.stubGlobal('Blob', class extends NativeBlob { constructor(parts: BlobPart[], options?: BlobPropertyBag) { super(parts, options); blobs.push(parts); } });
    const create = vi.fn(() => 'blob:policy-test');
    vi.stubGlobal('URL', class extends URL { static createObjectURL = create; static revokeObjectURL = vi.fn(); });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    render(<App />);
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Target ZiG Override Rate' }), { target: { value: '27' } });
    fireEvent.click(screen.getByRole('switch', { name: 'Platform Read-Only Mode' }));
    fireEvent.click(screen.getByRole('button', { name: 'Export Draft (.JSON)' }));
    expect(click).toHaveBeenCalledOnce();
    expect(JSON.parse(String(blobs[0][0]))).toMatchObject({ mode: 'reference-draft', productionApplied: false, settings: { zig: '27', readOnly: true } });
    expect(screen.getByRole('status')).toHaveTextContent('No production policy was changed');
    vi.runAllTimers();
  });
});
