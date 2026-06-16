import type { DocumentStatus } from '@scholarforge/shared';
import {
  DEFAULT_CHUNKING_CONFIG,
  chunkDocument,
  type Chunk,
  type ChunkingConfig,
} from './chunker.js';

/**
 * Chunking orchestrator (Sprint 4). Loads a document's extracted text, splits it
 * into chunks, and persists them — transitioning the document:
 *
 *   extracted -> (load text + chunk + persist) -> chunked
 *                                              \-> failed
 *
 * Idempotent: existing chunks for the document are removed before new ones are
 * written, so re-processing never creates duplicates. Side-effecting
 * collaborators are injected via {@link ChunkingPorts} for unit testing.
 *
 * @see Docs/03-architecture.md
 */

export type ChunkingFailureReason = 'no-extracted-text' | 'empty-document' | 'chunking-failed';

export class ChunkingError extends Error {
  readonly reason: ChunkingFailureReason;

  constructor(reason: ChunkingFailureReason, message?: string) {
    super(message ?? reason);
    this.name = 'ChunkingError';
    this.reason = reason;
  }
}

export interface ChunkingPorts {
  /** Loads the extracted text for a document, or null if none is stored. */
  loadExtractedText: (documentId: string) => Promise<string | null>;
  /** Removes any existing chunks for the document (idempotency guard). */
  deleteChunks: (documentId: string) => Promise<void>;
  /** Persists the chunks for the document. */
  saveChunks: (documentId: string, chunks: Chunk[]) => Promise<void>;
  /** Updates the document's lifecycle status. */
  updateStatus: (documentId: string, status: DocumentStatus) => Promise<void>;
  /** Structured logger; failures are logged with the document id. */
  logger?: Pick<Console, 'info' | 'error'>;
  /** Chunking configuration (defaults to 1000/200). */
  config?: ChunkingConfig;
}

export interface ChunkingResult {
  documentId: string;
  status: Extract<DocumentStatus, 'chunked' | 'failed'>;
  chunkCount?: number;
  reason?: string;
}

/**
 * Chunks one document end-to-end. Expected failures (no text / empty document)
 * mark the document `failed` and return a result rather than throwing.
 */
export async function chunkDocumentJob(
  documentId: string,
  ports: ChunkingPorts,
): Promise<ChunkingResult> {
  const logger = ports.logger ?? console;
  const config = ports.config ?? DEFAULT_CHUNKING_CONFIG;

  try {
    const text = await ports.loadExtractedText(documentId);
    if (text === null) {
      throw new ChunkingError('no-extracted-text', 'No extracted text found for document.');
    }

    const chunks = chunkDocument(documentId, text, config);
    if (chunks.length === 0) {
      throw new ChunkingError('empty-document', 'Document produced no chunks.');
    }

    // Idempotency: clear any prior chunks before inserting the fresh set.
    await ports.deleteChunks(documentId);
    await ports.saveChunks(documentId, chunks);
    await ports.updateStatus(documentId, 'chunked');

    logger.info(`[chunking] document ${documentId} chunked (${chunks.length} chunks)`);
    return { documentId, status: 'chunked', chunkCount: chunks.length };
  } catch (error) {
    const reason = error instanceof ChunkingError ? error.reason : 'chunking-failed';
    const message = error instanceof Error ? error.message : String(error);

    // Log failures with the document id.
    logger.error(`[chunking] document ${documentId} failed: ${reason} — ${message}`);

    await ports.updateStatus(documentId, 'failed');
    return { documentId, status: 'failed', reason };
  }
}
