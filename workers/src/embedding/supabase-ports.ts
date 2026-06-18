import type { SupabaseClient } from '@supabase/supabase-js';
import type { ChunkToEmbed, EmbeddingPorts } from './processor.js';

/**
 * Builds {@link EmbeddingPorts} backed by Supabase Postgres. Reads unembedded
 * chunks, persists embeddings, and updates document status. The worker uses a
 * service-role client.
 *
 * @see Docs/04-db-schema.md (chunks.embedding)
 */
export function createEmbeddingPorts(
  supabase: SupabaseClient,
  logger: Pick<Console, 'info' | 'error'> = console,
): EmbeddingPorts {
  return {
    logger,

    async loadChunksWithoutEmbeddings(documentId: string): Promise<ChunkToEmbed[]> {
      const { data, error } = await supabase
        .from('chunks')
        .select('id, content')
        .eq('document_id', documentId)
        .is('embedding', null)
        .order('chunk_index', { ascending: true });

      if (error) {
        throw new Error(
          `Failed to load unembedded chunks for document ${documentId}: ${error.message}`,
        );
      }

      return (data ?? []).map((row: { id: string; content: string }) => ({
        chunkId: row.id,
        content: row.content,
      }));
    },

    async saveEmbeddings(embeddings: Array<{ chunkId: string; vector: number[] }>): Promise<void> {
      // Update each chunk's embedding individually to avoid large bulk payloads.
      const updates = embeddings.map(async ({ chunkId, vector }) => {
        const { error } = await supabase
          .from('chunks')
          .update({ embedding: vector })
          .eq('id', chunkId);

        if (error) {
          throw new Error(`Failed to save embedding for chunk ${chunkId}: ${error.message}`);
        }
      });

      await Promise.all(updates);
    },

    async updateStatus(documentId: string, status): Promise<void> {
      const { error } = await supabase.from('documents').update({ status }).eq('id', documentId);
      if (error) {
        throw new Error(`Failed to update status for document ${documentId}: ${error.message}`);
      }
    },
  };
}
