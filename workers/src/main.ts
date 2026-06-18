import {
  JobRegistry,
  type ChunkDocumentPayload,
  type EmbedDocumentPayload,
  type ProcessDocumentPayload,
} from './index.js';
import { processDocument, type ProcessorPorts } from './extraction/index.js';
import { chunkDocumentJob, type ChunkingPorts } from './chunking/index.js';
import { embedDocumentJob, type EmbeddingPorts } from './embedding/index.js';
import type { EmbeddingProvider, EmbeddingConfig } from './providers/types.js';

/**
 * Worker entrypoint. Registers the pipeline handlers against the job registry:
 * extraction (Sprint 3), chunking (Sprint 4), and embeddings (Sprint 5).
 * A queue/storage integration (pulling jobs and constructing Supabase-backed
 * ports) is wired up by the deployment; this module only composes the
 * in-process pieces.
 *
 * @see Docs/03-architecture.md (Queue -> Workers -> PDF Extraction -> Chunking -> Embeddings)
 */
export function createRegistry(ports: {
  extraction: ProcessorPorts;
  chunking: ChunkingPorts;
  embedding: EmbeddingPorts;
  embeddingProvider: EmbeddingProvider;
  embeddingConfig: EmbeddingConfig;
}): JobRegistry {
  const registry = new JobRegistry();

  registry.register<ProcessDocumentPayload>('process-document', async ({ documentId }) => {
    const result = await processDocument(documentId, ports.extraction);
    return result.status;
  });

  registry.register<ChunkDocumentPayload>('chunk-document', async ({ documentId }) => {
    const result = await chunkDocumentJob(documentId, ports.chunking);
    return result.status;
  });

  registry.register<EmbedDocumentPayload>('embed-document', async ({ documentId }) => {
    const result = await embedDocumentJob(
      documentId,
      ports.embeddingProvider,
      ports.embedding,
      ports.embeddingConfig,
    );
    return result.status;
  });

  return registry;
}

function main(): void {
  console.log('[workers] document-processing worker ready; awaiting queue integration');
}

main();
