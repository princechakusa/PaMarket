import { normalizeError, type NormalizedError } from '../errors/normalize-error';
import { getSupabaseClient } from '../supabase/client';

export type EdgeResult<T> = { data: T; error: null } | { data: null; error: NormalizedError };
type InvokeOptions = { body?: string | Record<string, unknown>; signal?: AbortSignal; timeoutMs?: number };

export async function invokeAdminFunction<T>(name: string, accessToken: string, options: InvokeOptions = {}): Promise<EdgeResult<T>> {
  const client = getSupabaseClient();
  if (!client) return { data: null, error: { code: 'client_unavailable', message: 'Live Supabase is not configured.', retryable: false } };
  if (!accessToken) return { data: null, error: { code: 'session_required', message: 'An authenticated session is required.', retryable: false } };

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort('timeout'), options.timeoutMs ?? 15_000);
  const abort = () => controller.abort(options.signal?.reason);
  options.signal?.addEventListener('abort', abort, { once: true });

  try {
    const { data, error } = await client.functions.invoke<T>(name, {
      body: options.body,
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: controller.signal,
    });
    if (error) return { data: null, error: normalizeError(error) };
    if (data === null) return { data: null, error: { code: 'empty_response', message: 'The function returned no data.', retryable: false } };
    return { data, error: null };
  } catch (error) {
    const normalized = controller.signal.aborted && controller.signal.reason === 'timeout'
      ? { code: 'request_timeout', message: 'The request timed out.', retryable: true }
      : normalizeError(error);
    return { data: null, error: normalized };
  } finally {
    window.clearTimeout(timeout);
    options.signal?.removeEventListener('abort', abort);
  }
}
