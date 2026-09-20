import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSupabaseClient = vi.hoisted(() => vi.fn());
vi.mock('../src/services/supabase/client', () => ({ getSupabaseClient }));

import { archiveBusiness, restoreBusiness, suspendBusiness } from '../src/services/businesses/query';
import { hasPermission } from '../src/security/permissions';

function businessUpdate(result: { data: { id: string } | null; error: null | { message: string } }) {
  const query = {
    update: vi.fn(), eq: vi.fn(), is: vi.fn(), select: vi.fn(), maybeSingle: vi.fn().mockResolvedValue(result),
  };
  query.update.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.is.mockReturnValue(query);
  query.select.mockReturnValue(query);
  const from = vi.fn().mockReturnValue(query);
  getSupabaseClient.mockReturnValue({ from });
  return { from, query };
}

describe('business lifecycle actions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('suspends only a current active, non-archived business', async () => {
    const { query } = businessUpdate({ data: { id: 'business-1' }, error: null });
    expect((await suspendBusiness('business-1')).error).toBeNull();
    expect(query.update).toHaveBeenCalledWith({ status: 'suspended' });
    expect(query.eq).toHaveBeenCalledWith('status', 'active');
    expect(query.is).toHaveBeenCalledWith('deleted_at', null);
  });

  it('restores only a suspended, non-archived business', async () => {
    const { query } = businessUpdate({ data: { id: 'business-1' }, error: null });
    expect((await restoreBusiness('business-1')).error).toBeNull();
    expect(query.update).toHaveBeenCalledWith({ status: 'active' });
    expect(query.eq).toHaveBeenCalledWith('status', 'suspended');
  });

  it('requires a reason and treats zero updated rows as an unsuccessful archive', async () => {
    const { query } = businessUpdate({ data: null, error: null });
    expect((await archiveBusiness('business-1', '  ')).error?.code).toBe('reason_required');
    expect(query.update).not.toHaveBeenCalled();
    expect((await archiveBusiness('business-1', 'Fraud review')).error?.code).toBe('not_found');
    expect(query.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'suspended', deletion_reason: 'Fraud review' }));
  });

  it('keeps deletion permission exclusive to Super Admin', () => {
    expect(hasPermission('super_admin', 'businesses.delete')).toBe(true);
    expect(hasPermission('admin', 'businesses.delete')).toBe(false);
    expect(hasPermission('support', 'businesses.delete')).toBe(false);
  });
});
