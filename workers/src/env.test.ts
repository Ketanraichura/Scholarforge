import { describe, expect, it } from 'vitest';
import { createEmbeddingRuntime, parseEnv } from './env.js';

/**
 * Tests for worker env parsing. Each test explicitly sets EMBEDDING_PROVIDER
 * to avoid interference from .env files on disk.
 */
describe('workers env', () => {
  it('requires DEEPSEEK_API_KEY when DeepSeek is explicitly selected', () => {
    expect(() => parseEnv({ EMBEDDING_PROVIDER: 'deepseek', DEEPSEEK_API_KEY: '' })).toThrow(
      /DEEPSEEK_API_KEY/,
    );
  });

  it('parses a valid DeepSeek environment', () => {
    const env = parseEnv({ EMBEDDING_PROVIDER: 'deepseek', DEEPSEEK_API_KEY: 'deepseek-key' });
    expect(env.EMBEDDING_PROVIDER).toBe('deepseek');
    expect(env.DEEPSEEK_API_KEY).toBe('deepseek-key');
  });

  it('maps DEEPSEEK_API_KEY to embeddingConfig.apiKey', () => {
    const runtime = createEmbeddingRuntime({
      EMBEDDING_PROVIDER: 'deepseek',
      DEEPSEEK_API_KEY: 'deepseek-key',
    });
    expect(runtime.embeddingProvider.name).toBe('deepseek');
    expect(runtime.embeddingConfig.apiKey).toBe('deepseek-key');
  });

  it('requires GEMINI_API_KEY when Gemini is selected', () => {
    expect(() => parseEnv({ EMBEDDING_PROVIDER: 'gemini', GEMINI_API_KEY: '' })).toThrow(
      /GEMINI_API_KEY/,
    );
  });

  it('builds the Gemini runtime when selected', () => {
    const runtime = createEmbeddingRuntime({
      EMBEDDING_PROVIDER: 'gemini',
      GEMINI_API_KEY: 'gemini-key',
    });
    expect(runtime.embeddingProvider.name).toBe('gemini');
    expect(runtime.embeddingConfig.apiKey).toBe('gemini-key');
  });

  it('rejects unknown providers', () => {
    expect(() =>
      parseEnv({
        EMBEDDING_PROVIDER: 'openai',
        DEEPSEEK_API_KEY: 'deepseek-key',
      }),
    ).toThrow(/EMBEDDING_PROVIDER/);
  });

  it('treats blank api keys as missing', () => {
    expect(() => parseEnv({ EMBEDDING_PROVIDER: 'deepseek', DEEPSEEK_API_KEY: '   ' })).toThrow(
      /DEEPSEEK_API_KEY/,
    );
  });
});
