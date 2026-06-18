import type { EmbeddingConfig, EmbeddingProvider, EmbeddingResult } from './types.js';

const DEFAULT_MODEL = 'text-embedding-004';
const DEFAULT_BATCH_SIZE = 100;

interface GeminiEmbeddingResponse {
  embeddings: Array<{ values: number[] }>;
  model: string;
}

/**
 * Google Gemini embedding provider fallback.
 *
 * Default dimensions: 768 (text-embedding-004).
 * Batch size: configurable, defaults to 100 (Gemini limit).
 *
 * @see https://ai.google.dev/api/rest/v1beta/models/embedContent
 */
export function createGeminiProvider(): EmbeddingProvider {
  return {
    name: 'gemini',

    async embed(texts: string[], config: EmbeddingConfig): Promise<EmbeddingResult> {
      const model = config.model ?? DEFAULT_MODEL;
      const batchSize = config.batchSize ?? DEFAULT_BATCH_SIZE;
      const allVectors: number[][] = [];

      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        const responses = await Promise.all(
          batch.map(async (text) => {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${config.apiKey}`;
            const response = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                model: `models/${model}`,
                content: { parts: [{ text }] },
                taskType: 'RETRIEVAL_DOCUMENT',
              }),
            });

            if (!response.ok) {
              const body = await response.text().catch(() => '');
              throw new Error(`Gemini embedding API error ${response.status}: ${body}`);
            }

            return (await response.json()) as GeminiEmbeddingResponse;
          }),
        );

        for (const result of responses) {
          const embedding = result.embeddings[0];
          if (embedding) {
            allVectors.push(embedding.values);
          }
        }
      }

      const dimensions = allVectors[0]?.length ?? 0;
      return { vectors: allVectors, dimensions, model };
    },
  };
}
