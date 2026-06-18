import type { SupabaseClient } from '@supabase/supabase-js';
import type { EmbeddingProvider, EmbeddingConfig } from '../providers/types.js';
import type { RetrievalPorts, RawChunkResult } from './retriever.js';

/**
 * Builds {@link RetrievalPorts} backed by Supabase Postgres. Embeds the query
 * via the same provider used for document chunks, then calls the match_chunks
 * RPC for cosine similarity search.
 *
 * @see .ai/sprint-6-retrieval.md
 */
export function createRetrievalPorts(
  supabase: SupabaseClient,
  provider: EmbeddingProvider,
  config: EmbeddingConfig,
  logger: Pick<Console, 'info' | 'error'> = console,
): RetrievalPorts {
  return {
    logger,

    async embedQuery(text: string): Promise<number[]> {
      const result = await provider.embed([text], config);
      return result.vectors[0]!;
    },

    async matchChunks(
      embedding: number[],
      count: number,
      documentIds?: string[],
    ): Promise<RawChunkResult[]> {
      const { data, error } = await supabase.rpc('match_chunks', {
        query_embedding: embedding,
        match_count: count,
        p_document_ids: documentIds ?? null,
      });

      if (error) {
        throw new Error(`match_chunks RPC failed: ${error.message}`);
      }

      return (data ?? []) as RawChunkResult[];
    },
  };
}
