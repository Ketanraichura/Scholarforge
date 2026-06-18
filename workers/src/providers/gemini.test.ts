import { describe, expect, it, vi, afterEach } from 'vitest';
import { createGeminiProvider } from './gemini.js';

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

describe('createGeminiProvider', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns vectors with correct dimensions', async () => {
    globalThis.fetch = mockFetch([
      {
        ok: true,
        status: 200,
        body: { embedding: { values: [0.1, 0.2, 0.3] } },
      },
      {
        ok: true,
        status: 200,
        body: { embedding: { values: [0.4, 0.5, 0.6] } },
      },
    ]);

    const provider = createGeminiProvider();
    const result = await provider.embed(['hello', 'world'], { apiKey: 'test-key' });

    expect(result.vectors).toEqual([
      [0.1, 0.2, 0.3],
      [0.4, 0.5, 0.6],
    ]);
    expect(result.dimensions).toBe(3);
    expect(result.model).toBe('gemini-embedding-001');
  });

  it('batches texts and calls API for each text', async () => {
    const fetchMock = mockFetch([
      {
        ok: true,
        status: 200,
        body: { embedding: { values: [0.1] } },
      },
      {
        ok: true,
        status: 200,
        body: { embedding: { values: [0.2] } },
      },
      {
        ok: true,
        status: 200,
        body: { embedding: { values: [0.3] } },
      },
    ]);
    globalThis.fetch = fetchMock;

    const provider = createGeminiProvider();
    const result = await provider.embed(['a', 'b', 'c'], {
      apiKey: 'test-key',
      batchSize: 2,
    });

    expect(result.vectors).toEqual([[0.1], [0.2], [0.3]]);
    // Batch 1: ['a', 'b'] -> 2 calls, Batch 2: ['c'] -> 1 call
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('throws on API error', async () => {
    globalThis.fetch = mockFetch([{ ok: false, status: 403, body: 'forbidden' }]);

    const provider = createGeminiProvider();
    await expect(provider.embed(['hello'], { apiKey: 'test-key' })).rejects.toThrow(
      /Gemini embedding API error 403/,
    );
  });
});
