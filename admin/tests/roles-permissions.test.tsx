import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../src/app/App';
import { rolePermissions } from '../src/security/permissions';

describe('Roles and permissions',()=>{
 beforeEach(()=>window.history.replaceState({},'','/security/permissions'));
 it('renders directly from the application role permission map',()=>{
  render(<App/>);
  expect(screen.getByRole('heading',{name:'Staff Roles, Permissions & Access Governance'})).toBeInTheDocument();
  expect(screen.getByText('REFERENCE STAFF DATA')).toBeInTheDocument();
  expect(screen.getByText('SELECTED ROLE').closest('div')).toHaveTextContent(`${rolePermissions.super_admin.length} permissions defined in application code`);
  fireEvent.click(screen.getByRole('button',{name:/Support Agent/}));
  expect(screen.getByText('SELECTED ROLE').closest('div')).toHaveTextContent(`${rolePermissions.support.length} permissions defined in application code`);
  const matrix=screen.getByText('RBAC Permission Matrix by Marketplace Domain').closest('section')!;
  expect(within(matrix).getByText('Users · View').closest('span')).toHaveClass('allowed');
  expect(within(matrix).getByText('Orders · Manage').closest('span')).toHaveClass('restricted');
 },15_000);
 it('switches staff with the role and never leaks another operator’s details',()=>{
  render(<App/>);
  fireEvent.click(screen.getByRole('button',{name:/Finance & Escrow/}));
  const staffTable=screen.getByRole('table',{name:'Assigned administrative staff'});
  expect(within(staffTable).getByText('Tafadzwa Dube')).toBeInTheDocument();
  expect(within(staffTable).queryByText('Tinashe Moyo')).not.toBeInTheDocument();
  const inspector=screen.getByRole('complementary',{name:'Selected operator'});
  expect(inspector).toHaveTextContent('Tafadzwa Dube');
  expect(inspector).toHaveTextContent('Finance Terminal');
  expect(inspector).not.toHaveTextContent('Harare Ops Terminal');
  expect(screen.getByRole('button',{name:'PROVISION OPERATOR'})).toBeDisabled();
  expect(screen.getAllByRole('button',{name:'REVOKE'})[0]).toBeDisabled();
 });
 it('filters only staff assigned to the selected role',()=>{
  render(<App/>);
  fireEvent.change(screen.getByRole('textbox',{name:'Search assigned staff'}),{target:{value:'Bulawayo'}});
  expect(screen.getByRole('table',{name:'Assigned administrative staff'})).toHaveTextContent('Chipo Kanyemba');
  fireEvent.change(screen.getByRole('textbox',{name:'Search assigned staff'}),{target:{value:'Mutare'}});
  expect(screen.getByRole('status')).toHaveTextContent('No reference staff');
 });
});
