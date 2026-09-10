import type { ReactNode } from 'react';
import { useAuth } from './auth-context';
import type { Permission } from './permissions';
import { ForbiddenState } from '../pages/UnavailablePage';

export function RequirePermission({ permission, children }: { permission: Permission; children: ReactNode }) {
  const { identity } = useAuth();
  return identity?.permissions.includes(permission) ? children : <ForbiddenState requestedPermission={permission} />;
}
