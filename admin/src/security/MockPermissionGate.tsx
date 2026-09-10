import type { ReactNode } from 'react';
import { useMockAdmin } from '../app/providers';
import { ForbiddenState } from '../pages/UnavailablePage';

export function MockPermissionGate({ permission, children }: { permission: string; children: ReactNode }) {
  const admin = useMockAdmin();
  return admin.permissions.includes(permission) ? children : <ForbiddenState requestedPermission={permission} />;
}
