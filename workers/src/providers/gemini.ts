import type { EmbeddingConfig, EmbeddingProvider, EmbeddingResult } from './types.js';

const DEFAULT_MODEL = 'gemini-embedding-001';
const DEFAULT_BATCH_SIZE = 100;

interface GeminiEmbeddingResponse {
  embedding: { values: number[] };
  model: string;
}

/**
 * Google Gemini embedding provider.
 *
 * Default model: gemini-embedding-001 (768d default, flexible 128-3072).
 * Batch size: configurable, defaults to 100 (Gemini per-request limit).
 * Auth: x-goog-api-key header.
 *
 * @see https://ai.google.dev/api/embeddings
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
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent`;
            const response = await fetch(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': config.apiKey,
              },
              body: JSON.stringify({
                model: `models/${model}`,
                content: { parts: [{ text }] },
                outputDimensionality: config.dimensions,
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
          const embedding = result.embedding;
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
