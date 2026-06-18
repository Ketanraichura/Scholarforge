import { describe, expect, it, vi, afterEach } from 'vitest';
import { createDeepSeekProvider } from './deepseek.js';

function mockFetch(responses: Array<{ ok: boolean; status: number; body: unknown }>) {
  let callIndex = 0;
  return vi.fn(async () => {
    const resp = responses[callIndex] ?? responses.at(-1);
    callIndex += 1;
    if (!resp) throw new Error('No mock response configured');
    return {
      ok: resp.ok,
      status: resp.status,
      text: vi.fn(async () =>
        typeof resp.body === 'string' ? resp.body : JSON.stringify(resp.body),
      ),
      json: vi.fn(async () => resp.body),
    };
  }) as unknown as typeof fetch;
}

describe('createDeepSeekProvider', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns vectors with correct dimensions', async () => {
    globalThis.fetch = mockFetch([
      {
        ok: true,
        status: 200,
        body: {
          data: [
            { embedding: [0.1, 0.2, 0.3], index: 0 },
            { embedding: [0.4, 0.5, 0.6], index: 1 },
          ],
          model: 'deepseek-embedding',
          usage: { prompt_tokens: 10, total_tokens: 10 },
        },
      },
    ]);

    const provider = createDeepSeekProvider();
    const result = await provider.embed(['hello', 'world'], { apiKey: 'test-key' });

    expect(result.vectors).toEqual([
      [0.1, 0.2, 0.3],
      [0.4, 0.5, 0.6],
    ]);
    expect(result.dimensions).toBe(3);
    expect(result.model).toBe('deepseek-embedding');
  });

  it('batches texts correctly', async () => {
    const fetchMock = mockFetch([
      {
        ok: true,
        status: 200,
        body: {
          data: [{ embedding: [0.1], index: 0 }],
          model: 'deepseek-embedding',
          usage: { prompt_tokens: 5, total_tokens: 5 },
        },
      },
      {
        ok: true,
        status: 200,
        body: {
          data: [{ embedding: [0.2], index: 0 }],
          model: 'deepseek-embedding',
          usage: { prompt_tokens: 5, total_tokens: 5 },
        },
      },
    ]);
    globalThis.fetch = fetchMock;

    const provider = createDeepSeekProvider();
    const result = await provider.embed(['a', 'b'], {
      apiKey: 'test-key',
      batchSize: 1,
    });

    expect(result.vectors).toEqual([[0.1], [0.2]]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('throws on API error', async () => {
    globalThis.fetch = mockFetch([{ ok: false, status: 429, body: 'rate limited' }]);

    const provider = createDeepSeekProvider();
    await expect(provider.embed(['hello'], { apiKey: 'test-key' })).rejects.toThrow(
      /DeepSeek embedding API error 429/,
    );
  });

  it('sorts responses by index', async () => {
    globalThis.fetch = mockFetch([
      {
        ok: true,
        status: 200,
        body: {
          data: [
            { embedding: [0.3], index: 1 },
            { embedding: [0.1], index: 0 },
          ],
          model: 'deepseek-embedding',
          usage: { prompt_tokens: 10, total_tokens: 10 },
        },
      },
    ]);

    const provider = createDeepSeekProvider();
    const result = await provider.embed(['a', 'b'], { apiKey: 'test-key' });

    expect(result.vectors).toEqual([[0.1], [0.3]]);
  });
});
