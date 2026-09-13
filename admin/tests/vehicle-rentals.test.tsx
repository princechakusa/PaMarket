import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../src/app/App';

describe('Vehicle rentals',()=>{
  beforeEach(()=>window.history.replaceState({},'','/rentals'));
  it('combines fleet filters and resets an empty result',()=>{
    render(<App/>);
    expect(screen.getByRole('heading',{name:'Rental Car Operators & Fleet Verification Queue'})).toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox',{name:'Fleet province'}),{target:{value:'Bulawayo'}});
    fireEvent.change(screen.getByRole('combobox',{name:'Vehicle class'}),{target:{value:'4X4 Safari / Overland'}});
    const table=screen.getByRole('table',{name:'Rental operator verification queue'});
    expect(within(table).getAllByRole('row')).toHaveLength(2);
    expect(within(table).getByText('Matopos Overland Rentals')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox',{name:'Fleet risk'}),{target:{value:'Critical'}});
    expect(screen.getByRole('status')).toHaveTextContent('No reference fleet operators');
    fireEvent.click(screen.getByRole('button',{name:'Clear filters'}));
    expect(within(table).getAllByRole('row')).toHaveLength(6);
  },15_000);
  it('shows the selected fleet only and disables enforcement',()=>{
    render(<App/>);
    const inspector=screen.getByRole('region',{name:'Fleet incident inspector'});
    expect(inspector).toHaveTextContent('AFK-9022-ZW');
    expect(within(inspector).getByRole('button',{name:/Trigger Engine Kill-Switch/})).toBeDisabled();
    fireEvent.click(screen.getByRole('button',{name:'Inspect RNT-8812'}));
    expect(inspector).toHaveTextContent('ZimDrive Safari & Fleet');
    expect(inspector).toHaveTextContent('NO ACTIVE ALERT');
    expect(inspector).not.toHaveTextContent('AFK-9022-ZW');
  });
});
