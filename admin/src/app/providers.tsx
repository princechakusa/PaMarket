import { createContext, useContext, type ReactNode } from 'react';

export type MockAdmin = { name: string; email: string; role: 'admin'; permissions: string[] };
const mockAdmin: MockAdmin = {
  name: 'Tariro Moyo', email: 'admin.preview@pamarket.invalid', role: 'admin',
  permissions: ['users.view', 'listings.moderate', 'verifications.manage', 'reports.manage', 'businesses.view'],
};
const AdminContext = createContext<MockAdmin>(mockAdmin);
export function AppProviders({ children }: { children: ReactNode }) { return <AdminContext.Provider value={mockAdmin}>{children}</AdminContext.Provider>; }
// This hook intentionally shares the provider's private mock context in Stage B.
// eslint-disable-next-line react-refresh/only-export-components
export function useMockAdmin() { return useContext(AdminContext); }
