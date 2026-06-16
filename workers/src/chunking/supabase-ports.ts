import type { SupabaseClient } from '@supabase/supabase-js';
import type { Chunk } from './chunker.js';
import type { ChunkingPorts } from './processor.js';

/**
 * Builds {@link ChunkingPorts} backed by Supabase Postgres. Reads the extracted
 * text from `document_texts`, replaces the document's chunks in `chunks`, and
 * updates the document status. The worker uses a service-role client.
 *
 * @see Docs/04-db-schema.md (chunks)
 */
export function createChunkingPorts(
  supabase: SupabaseClient,
  logger: Pick<Console, 'info' | 'error'> = console,
): ChunkingPorts {
  return {
    logger,

    async loadExtractedText(documentId: string): Promise<string | null> {
      const { data, error } = await supabase
        .from('document_texts')
        .select('content')
        .eq('document_id', documentId)
        .single();

      if (error || !data || typeof data.content !== 'string') {
        return null;
      }
      return data.content;
    },

    async deleteChunks(documentId: string): Promise<void> {
      const { error } = await supabase.from('chunks').delete().eq('document_id', documentId);
      if (error) {
        throw new Error(`Failed to clear chunks for document ${documentId}: ${error.message}`);
      }
    },

    async saveChunks(documentId: string, chunks: Chunk[]): Promise<void> {
      const rows = chunks.map((chunk) => ({
        document_id: documentId,
        content: chunk.content,
        chunk_index: chunk.metadata.chunk_index,
        page_number: chunk.metadata.page_number,
        start_offset: chunk.metadata.start_offset,
        end_offset: chunk.metadata.end_offset,
        metadata: chunk.metadata,
      }));

      const { error } = await supabase.from('chunks').insert(rows);
      if (error) {
        throw new Error(`Failed to persist chunks for document ${documentId}: ${error.message}`);
      }
    },

    async updateStatus(documentId, status): Promise<void> {
      const { error } = await supabase.from('documents').update({ status }).eq('id', documentId);
      if (error) {
        throw new Error(`Failed to update status for document ${documentId}: ${error.message}`);
      }
    },
  };
}
