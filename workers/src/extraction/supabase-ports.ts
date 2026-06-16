import type { DocumentStatus } from '@scholarforge/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { parsePdfWithPdfParse } from './pdf-parse-adapter.js';
import type { ProcessorPorts } from './processor.js';

const STORAGE_BUCKET = 'documents';

/**
 * Builds {@link ProcessorPorts} backed by Supabase storage + Postgres. The
 * worker uses a service-role client so it can read storage objects and update
 * rows across users; ownership is still encoded in the storage path layout.
 */
export function createSupabasePorts(
  supabase: SupabaseClient,
  logger: Pick<Console, 'info' | 'error'> = console,
): ProcessorPorts {
  return {
    parsePdf: parsePdfWithPdfParse,
    logger,

    async downloadPdf(documentId: string): Promise<Uint8Array> {
      const { data: document, error } = await supabase
        .from('documents')
        .select('storage_path')
        .eq('id', documentId)
        .single();

      if (error || !document?.storage_path) {
        throw new Error(`Could not resolve storage path for document ${documentId}`);
      }

      const { data: blob, error: downloadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .download(document.storage_path);

      if (downloadError || !blob) {
        throw new Error(`Failed to download document ${documentId} from storage`);
      }

      return new Uint8Array(await blob.arrayBuffer());
    },

    async updateStatus(documentId: string, status: DocumentStatus): Promise<void> {
      const patch: Record<string, unknown> = { status };
      if (status === 'failed') {
        // Track attempts so operators can see retry exhaustion.
        const { data } = await supabase
          .from('documents')
          .select('retry_count')
          .eq('id', documentId)
          .single();
        const current = typeof data?.retry_count === 'number' ? data.retry_count : 0;
        patch.retry_count = current + 1;
      }

      const { error } = await supabase.from('documents').update(patch).eq('id', documentId);
      if (error) {
        throw new Error(`Failed to update status for document ${documentId}: ${error.message}`);
      }
    },

    async saveExtractedText(input): Promise<void> {
      const { error } = await supabase.from('document_texts').upsert({
        document_id: input.documentId,
        content: input.text,
        page_count: input.pageCount,
      });
      if (error) {
        throw new Error(
          `Failed to persist extracted text for document ${input.documentId}: ${error.message}`,
        );
      }
    },
  };
}
