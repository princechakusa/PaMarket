import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSupabaseClient = vi.hoisted(() => vi.fn());
vi.mock('../src/services/supabase/client', () => ({ getSupabaseClient }));
vi.mock('../src/services/security-events/query', () => ({ listSecurityEvents: vi.fn() }));

import { generatePrivacySnapshot } from '../src/services/privacy-export/query';

const admin = { id: 'admin-id', name: 'DPO', email: 'dpo@example.test', role: 'super_admin' };

describe('privacy export scope', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns only subject-linked sections for a SAR and never queries platform registers', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { profiles: [{ id: 'subject-id', name: 'Subject' }], messages: [] }, error: null });
    const from = vi.fn();
    getSupabaseClient.mockReturnValue({ rpc, from });

    const result = await generatePrivacySnapshot(admin, 'subject-id');

    expect(result.error).toBeNull();
    expect(rpc).toHaveBeenCalledWith('privacy_export_subject', { p_user_id: 'subject-id' });
    expect(from).not.toHaveBeenCalled();
    expect(result.data?.sections.map((section) => section.id)).toEqual(['subject-profiles', 'subject-messages']);
    expect(result.data?.sections[1].caveats).toEqual(['No matching records.']);
  });

  it('rejects a non-Super Admin before invoking the SAR RPC', async () => {
    const rpc = vi.fn();
    getSupabaseClient.mockReturnValue({ rpc, from: vi.fn() });

    const result = await generatePrivacySnapshot({ ...admin, role: 'admin' }, 'subject-id');

    expect(result.error?.code).toBe('forbidden');
    expect(rpc).not.toHaveBeenCalled();
  });
});
