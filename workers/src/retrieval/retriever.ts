import type { SearchResult } from '@scholarforge/shared';

/**
 * Retrieval orchestrator (Sprint 6A). Embeds a query string, finds the most
 * similar chunks via cosine distance, and returns ranked results.
 *
 * @see .ai/sprint-6-retrieval.md
 */

export interface RetrievalPorts {
  /** Embeds a single query string into a vector. */
  embedQuery: (text: string) => Promise<number[]>;
  /** Calls the match_chunks RPC and returns raw results. */
  matchChunks: (
    embedding: number[],
    count: number,
    documentIds?: string[],
  ) => Promise<RawChunkResult[]>;
  /** Structured logger. */
  logger?: Pick<Console, 'info' | 'error'>;
}

export interface RawChunkResult {
  id: string;
  document_id: string;
  content: string;
  metadata: Record<string, unknown>;
  chunk_index: number;
  page_number: number;
  similarity: number;
}

export interface RetrievalOptions {
  limit?: number;
  documentIds?: string[];
}

export interface RetrievalResult {
  results: SearchResult[];
  query: string;
}

const DEFAULT_LIMIT = 10;

/**
 * Embeds a query and retrieves the top K most similar chunks.
 */
export async function retrieve(
  query: string,
  ports: RetrievalPorts,
  options?: RetrievalOptions,
): Promise<RetrievalResult> {
  const logger = ports.logger ?? console;
  const limit = options?.limit ?? DEFAULT_LIMIT;
  const documentIds = options?.documentIds;

  const embedding = await ports.embedQuery(query);
  const raw = await ports.matchChunks(embedding, limit, documentIds);

  const results: SearchResult[] = raw.map((row) => ({
    chunkId: row.id,
    documentId: row.document_id,
    content: row.content,
    metadata: row.metadata,
    similarity: row.similarity,
    chunkIndex: row.chunk_index,
    pageNumber: row.page_number,
  }));

  logger.info(`[retrieval] query returned ${results.length} results (limit: ${limit})`);

  return { results, query };
}
