import { describe, expect, it, vi } from 'vitest';
import { withRetry } from './retry.js';

const noSleep = async (): Promise<void> => {};

describe('withRetry', () => {
  it('returns immediately on first success', async () => {
    const fn = vi.fn(async () => 'ok');
    const result = await withRetry(fn, {
      maxRetries: 3,
      baseDelayMs: 100,
      isRetryable: () => true,
      sleep: noSleep,
    });

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries up to maxRetries then succeeds', async () => {
    let calls = 0;
    const fn = vi.fn(async () => {
      calls += 1;
      if (calls < 3) throw new Error('transient');
      return 'recovered';
    });

    const result = await withRetry(fn, {
      maxRetries: 3,
      baseDelayMs: 100,
      isRetryable: () => true,
      sleep: noSleep,
    });

    expect(result).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('uses exponential backoff delays', async () => {
    const delays: number[] = [];
    const fn = vi.fn(async () => {
      throw new Error('always');
    });

    await withRetry(fn, {
      maxRetries: 3,
      baseDelayMs: 500,
      isRetryable: () => true,
      sleep: async (ms) => {
        delays.push(ms);
      },
    }).catch(() => undefined);

    // attempts = 4 (1 + 3 retries); 3 backoff sleeps: 500, 1000, 2000.
    expect(delays).toEqual([500, 1000, 2000]);
    expect(fn).toHaveBeenCalledTimes(4);
  });

  it('does not retry a non-retryable error', async () => {
    const fn = vi.fn(async () => {
      throw new Error('fatal');
    });

    await expect(
      withRetry(fn, {
        maxRetries: 3,
        baseDelayMs: 100,
        isRetryable: () => false,
        sleep: noSleep,
      }),
    ).rejects.toThrow('fatal');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('rethrows the last error after exhausting retries', async () => {
    const fn = vi.fn(async () => {
      throw new Error('still failing');
    });

    await expect(
      withRetry(fn, {
        maxRetries: 2,
        baseDelayMs: 10,
        isRetryable: () => true,
        sleep: noSleep,
      }),
    ).rejects.toThrow('still failing');
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
