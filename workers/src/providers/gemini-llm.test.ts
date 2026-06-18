import { describe, expect, it, vi, afterEach } from 'vitest';
import { createGeminiLLMProvider } from './gemini-llm.js';

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

describe('createGeminiLLMProvider', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns generated text from Gemini response', async () => {
    globalThis.fetch = mockFetch([
      {
        ok: true,
        status: 200,
        body: {
          candidates: [{ content: { parts: [{ text: 'The answer is 42.' }] } }],
          model: 'gemini-2.0-flash',
        },
      },
    ]);

    const provider = createGeminiLLMProvider();
    const result = await provider.generate([{ role: 'user', content: 'What is the answer?' }], {
      apiKey: 'test-key',
    });

    expect(result.content).toBe('The answer is 42.');
    expect(result.model).toBe('gemini-2.0-flash');
  });

  it('sends correct request format with messages', async () => {
    const fetchMock = mockFetch([
      {
        ok: true,
        status: 200,
        body: { candidates: [{ content: { parts: [{ text: 'ok' }] } }] },
      },
    ]);
    globalThis.fetch = fetchMock;

    const provider = createGeminiLLMProvider();
    await provider.generate(
      [
        { role: 'user', content: 'System prompt' },
        { role: 'model', content: 'Acknowledged' },
        { role: 'user', content: 'Question' },
      ],
      { apiKey: 'test-key', model: 'gemini-1.5-flash' },
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const callBody = JSON.parse(
      (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![1].body as string,
    );
    expect(callBody.contents).toHaveLength(3);
    expect(callBody.contents[0].role).toBe('user');
    expect(callBody.contents[1].role).toBe('model');
    expect(callBody.contents[2].role).toBe('user');
  });

  it('throws on API error', async () => {
    globalThis.fetch = mockFetch([{ ok: false, status: 403, body: 'forbidden' }]);

    const provider = createGeminiLLMProvider();
    await expect(
      provider.generate([{ role: 'user', content: 'test' }], { apiKey: 'test-key' }),
    ).rejects.toThrow(/Gemini LLM API error 403/);
  });

  it('throws on empty response', async () => {
    globalThis.fetch = mockFetch([{ ok: true, status: 200, body: { candidates: [] } }]);

    const provider = createGeminiLLMProvider();
    await expect(
      provider.generate([{ role: 'user', content: 'test' }], { apiKey: 'test-key' }),
    ).rejects.toThrow('Gemini returned empty response');
  });
});
