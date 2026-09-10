export type NormalizedError = { code: string; message: string; retryable: boolean };

export function normalizeError(error: unknown): NormalizedError {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return { code: 'request_cancelled', message: 'The request was cancelled.', retryable: true };
  }
  if (error instanceof Error) {
    const timedOut = /timeout|timed out/i.test(error.message);
    return { code: timedOut ? 'request_timeout' : 'request_failed', message: error.message || 'Request failed.', retryable: true };
  }
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return { code: 'request_failed', message: String(error.message), retryable: true };
  }
  return { code: 'unknown_error', message: 'An unexpected error occurred.', retryable: false };
}
