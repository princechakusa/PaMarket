import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from '../src/app/App';

describe('Jobs and recruiters', () => {
  it('connects the route and combines search, status and province filters', () => {
    window.history.replaceState({}, '', '/marketplace/jobs');
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Jobs & Recruiter Governance Hub' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'UNDER REVIEW 2' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Province' }), { target: { value: 'Midlands' } });
    const table = screen.getByRole('table', { name: 'Jobs and recruiter review queue' });
    expect(within(table).getAllByRole('row')).toHaveLength(2);
    expect(within(table).getByText('AfriAid Global HR')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'Search jobs' }), { target: { value: 'no matching job' } });
    expect(screen.getByRole('status')).toHaveTextContent('No reference jobs match');
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(within(table).getAllByRole('row')).toHaveLength(6);
  });

  it('shows record-specific evidence and keeps disconnected enforcement disabled', () => {
    // JSDOM has no native modal implementation; emulate its open/close state.
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute('open', ''); } });
    Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute('open'); } });
    window.history.replaceState({}, '', '/marketplace/jobs');
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Inspect JOB-ZW-4082' }));
    let dossier = screen.getByRole('dialog');
    expect(dossier).toHaveTextContent('AfriAid Global HR');
    expect(dossier).toHaveTextContent('Whistleblower Complaints (19)');
    expect(within(dossier).getByRole('button', { name: 'WARN CANDIDATES' })).toBeDisabled();
    fireEvent.click(within(dossier).getByRole('button', { name: 'Close forensic dossier' }));
    fireEvent.click(screen.getByRole('button', { name: 'Inspect JOB-ZW-4019' }));
    dossier = screen.getByRole('dialog');
    expect(dossier).toHaveTextContent('Agritech Zimbabwe Ltd');
    expect(dossier).toHaveTextContent('Whistleblower Complaints (0)');
    expect(dossier).not.toHaveTextContent('$25 USD EcoCash');
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
  });
});
