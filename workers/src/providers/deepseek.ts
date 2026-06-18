import type { EmbeddingConfig, EmbeddingProvider, EmbeddingResult } from './types.js';

const DEFAULT_MODEL = 'deepseek-embedding';
const DEFAULT_BATCH_SIZE = 64;

interface DeepSeekEmbeddingResponse {
  data: Array<{ embedding: number[]; index: number }>;
  model: string;
  usage: { prompt_tokens: number; total_tokens: number };
}

/**
 * DeepSeek embedding provider. Uses the OpenAI-compatible /v1/embeddings endpoint.
 *
 * Default dimensions: 1024 (deepseek-embedding).
 * Batch size: configurable, defaults to 64.
 */
export function createDeepSeekProvider(): EmbeddingProvider {
  return {
    name: 'deepseek',

    async embed(texts: string[], config: EmbeddingConfig): Promise<EmbeddingResult> {
      const model = config.model ?? DEFAULT_MODEL;
      const batchSize = config.batchSize ?? DEFAULT_BATCH_SIZE;
      const allVectors: number[][] = [];

      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        const response = await fetch('https://api.deepseek.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify({ input: batch, model }),
        });

        if (!response.ok) {
          const body = await response.text().catch(() => '');
          throw new Error(`DeepSeek embedding API error ${response.status}: ${body}`);
        }

        const result: DeepSeekEmbeddingResponse =
          (await response.json()) as DeepSeekEmbeddingResponse;
        const sorted = [...result.data].sort((a, b) => a.index - b.index);
        for (const item of sorted) {
          allVectors.push(item.embedding);
        }
      }

      const dimensions = allVectors[0]?.length ?? 0;
      return { vectors: allVectors, dimensions, model };
    },
  };
}
