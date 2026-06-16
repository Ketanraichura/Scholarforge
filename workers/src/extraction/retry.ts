/** Configuration for {@link withRetry}. */
export interface RetryOptions {
  /** Maximum number of *retries* after the first attempt (so attempts = maxRetries + 1). */
  maxRetries: number;
  /** Base delay in milliseconds; the delay for retry n is baseDelayMs * 2^(n-1). */
  baseDelayMs: number;
  /** Decides whether a thrown error should trigger another attempt. */
  isRetryable: (error: unknown) => boolean;
  /** Sleep implementation; injectable so tests run without real timers. */
  sleep?: (ms: number) => Promise<void>;
  /** Optional hook invoked before each retry (for logging). */
  onRetry?: (info: { attempt: number; delayMs: number; error: unknown }) => void;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Runs `fn`, retrying on retryable errors with exponential backoff.
 *
 * Backoff delays: baseDelayMs, 2x, 4x, ... A non-retryable error is rethrown
 * immediately. After exhausting retries, the last error is rethrown.
 */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T> {
  const { maxRetries, baseDelayMs, isRetryable, sleep = defaultSleep, onRetry } = options;

  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const hasRetriesLeft = attempt < maxRetries;
      if (!hasRetriesLeft || !isRetryable(error)) {
        throw error;
      }
      const delayMs = baseDelayMs * 2 ** attempt;
      onRetry?.({ attempt: attempt + 1, delayMs, error });
      await sleep(delayMs);
    }
  }

  // Unreachable in practice; the loop either returns or throws.
  throw lastError;
}
