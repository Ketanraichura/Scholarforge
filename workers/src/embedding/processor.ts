import type { DocumentStatus } from '@scholarforge/shared';
import type { EmbeddingProvider, EmbeddingConfig } from '../providers/types.js';
import { withRetry, type RetryOptions } from '../extraction/retry.js';

/**
 * Embedding orchestrator (Sprint 5). Loads a document's chunks, generates
 * embeddings via a provider, and persists the vectors — transitioning:
 *
 *   chunked -> (load chunks + embed + store) -> ready
 *                                            \-> failed
 *
 * Idempotent: only chunks without embeddings are processed. If the job is
 * re-run, already-embedded chunks are skipped.
 *
 * @see Docs/03-architecture.md
 */

export type EmbeddingFailureReason =
  | 'no-chunks'
  | 'no-text-to-embed'
  | 'embedding-failed'
  | 'storage-failed';

export class EmbeddingError extends Error {
  readonly reason: EmbeddingFailureReason;

  constructor(reason: EmbeddingFailureReason, message?: string) {
    super(message ?? reason);
    this.name = 'EmbeddingError';
    this.reason = reason;
  }
}

export interface ChunkToEmbed {
  chunkId: string;
  content: string;
}

export interface EmbeddingPorts {
  /** Loads chunks that do not yet have embeddings. */
  loadChunksWithoutEmbeddings: (documentId: string) => Promise<ChunkToEmbed[]>;
  /** Persists embeddings for chunks (chunkId -> vector). */
  saveEmbeddings: (embeddings: Array<{ chunkId: string; vector: number[] }>) => Promise<void>;
  /** Updates the document's lifecycle status. */
  updateStatus: (documentId: string, status: DocumentStatus) => Promise<void>;
  /** Structured logger. */
  logger?: Pick<Console, 'info' | 'error'>;
}

export interface EmbeddingResult {
  documentId: string;
  status: Extract<DocumentStatus, 'ready' | 'failed'>;
  chunkCount?: number;
  dimensions?: number;
  reason?: string;
}

export const DEFAULT_EMBEDDING_BATCH_SIZE = 64;
export const MAX_EMBEDDING_RETRIES = 3;
export const BASE_EMBEDDING_RETRY_DELAY_MS = 1000;

/**
 * Embeds all chunks for one document end-to-end.
 */
export async function embedDocumentJob(
  documentId: string,
  provider: EmbeddingProvider,
  ports: EmbeddingPorts,
  providerConfig: EmbeddingConfig,
  retryOptions?: Partial<Pick<RetryOptions, 'sleep'>>,
): Promise<EmbeddingResult> {
  const logger = ports.logger ?? console;

  try {
    const chunks = await ports.loadChunksWithoutEmbeddings(documentId);
    if (chunks.length === 0) {
      throw new EmbeddingError('no-chunks', 'No unembedded chunks found for document.');
    }

    const texts = chunks.map((c) => c.content);
    if (texts.every((t) => t.trim().length === 0)) {
      throw new EmbeddingError('no-text-to-embed', 'All chunks are empty.');
    }

    const allVectors = await embedWithRetry(provider, texts, providerConfig, logger, retryOptions);

    if (allVectors.length !== chunks.length) {
      throw new EmbeddingError(
        'embedding-failed',
        `Expected ${chunks.length} vectors, got ${allVectors.length}.`,
      );
    }

    const embeddings = chunks.map((chunk, i) => ({
      chunkId: chunk.chunkId,
      vector: allVectors[i]!,
    }));

    await ports.saveEmbeddings(embeddings);
    await ports.updateStatus(documentId, 'ready');

    const dimensions = allVectors[0]?.length ?? 0;
    logger.info(
      `[embedding] document ${documentId} embedded (${chunks.length} chunks, ${dimensions}d)`,
    );
    return { documentId, status: 'ready', chunkCount: chunks.length, dimensions };
  } catch (error) {
    const reason = error instanceof EmbeddingError ? error.reason : 'embedding-failed';
    const message = error instanceof Error ? error.message : String(error);

    logger.error(`[embedding] document ${documentId} failed: ${reason} — ${message}`);
    await ports.updateStatus(documentId, 'failed');
    return { documentId, status: 'failed', reason };
  }
}

/**
 * Generates embeddings with retry + exponential backoff.
 * Only retryable errors (rate limits, server errors, network) are retried.
 */
async function embedWithRetry(
  provider: EmbeddingProvider,
  texts: string[],
  config: EmbeddingConfig,
  logger: Pick<Console, 'info' | 'error'>,
  retryOptions?: Partial<Pick<RetryOptions, 'sleep'>>,
): Promise<number[][]> {
  return withRetry(
    async () => {
      const result = await provider.embed(texts, config);
      return result.vectors;
    },
    {
      maxRetries: MAX_EMBEDDING_RETRIES,
      baseDelayMs: BASE_EMBEDDING_RETRY_DELAY_MS,
      sleep: retryOptions?.sleep,
      isRetryable: (error) => {
        if (error instanceof Error) {
          const msg = error.message.toLowerCase();
          if (msg.includes('429') || msg.includes('rate limit')) return true;
          if (msg.includes('500') || msg.includes('502') || msg.includes('503')) return true;
          if (msg.includes('econnreset') || msg.includes('etimedout') || msg.includes('fetch'))
            return true;
        }
        return false;
      },
      onRetry: ({ attempt, delayMs, error }) => {
        const message = error instanceof Error ? error.message : String(error);
        logger.info(
          `[embedding] retry ${attempt}/${MAX_EMBEDDING_RETRIES} in ${delayMs}ms: ${message}`,
        );
      },
    },
  );
}
