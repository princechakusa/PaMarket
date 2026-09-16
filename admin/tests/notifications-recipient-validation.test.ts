import { describe, expect, it, vi, beforeEach } from 'vitest';

const profilesMaybeSingle = vi.fn();
const notificationsSingle = vi.fn();

function fromMock(table: string) {
  if (table === 'profiles') {
    return { select: () => ({ eq: () => ({ maybeSingle: profilesMaybeSingle }) }) };
  }
  if (table === 'notifications') {
    return { insert: () => ({ select: () => ({ single: notificationsSingle }) }) };
  }
  throw new Error(`Unexpected table in test: ${table}`);
}

const fakeClient = { from: vi.fn(fromMock) } as unknown;

vi.mock('../src/services/supabase/client', () => ({ getSupabaseClient: vi.fn(() => fakeClient) }));

import { getSupabaseClient } from '../src/services/supabase/client';
import { sendNotification } from '../src/services/platform/query';

describe('sendNotification recipient validation (A4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getSupabaseClient as ReturnType<typeof vi.fn>).mockReturnValue(fakeClient);
  });

  it('blocks sending to a nonexistent recipient and never inserts a notification', async () => {
    profilesMaybeSingle.mockResolvedValue({ data: null, error: null });
    const result = await sendNotification('00000000-0000-0000-0000-000000000000', 'Title', 'Body');
    expect(result.data).toBeNull();
    expect(result.error?.code).toBe('not_found');
    expect(notificationsSingle).not.toHaveBeenCalled();
  });

  it('sends normally when the recipient exists', async () => {
    profilesMaybeSingle.mockResolvedValue({ data: { id: 'user-1', name: 'Real User' }, error: null });
    notificationsSingle.mockResolvedValue({ data: { id: 'notif-1' }, error: null });
    const result = await sendNotification('user-1', 'Title', 'Body');
    expect(result.error).toBeNull();
    expect(result.data?.id).toBe('notif-1');
    expect(notificationsSingle).toHaveBeenCalledOnce();
  });

  it('surfaces a recipient-lookup error without attempting the insert', async () => {
    profilesMaybeSingle.mockResolvedValue({ data: null, error: { message: 'network down' } });
    const result = await sendNotification('user-1', 'Title', 'Body');
    expect(result.data).toBeNull();
    expect(notificationsSingle).not.toHaveBeenCalled();
  });
});
