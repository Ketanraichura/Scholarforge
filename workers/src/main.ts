import { JobRegistry, type ChunkDocumentPayload, type ProcessDocumentPayload } from './index.js';
import { processDocument, type ProcessorPorts } from './extraction/index.js';
import { chunkDocumentJob, type ChunkingPorts } from './chunking/index.js';

/**
 * Worker entrypoint. Registers the pipeline handlers against the job registry:
 * extraction (Sprint 3) and chunking (Sprint 4). A queue/storage integration
 * (pulling jobs and constructing Supabase-backed ports) is wired up by the
 * deployment; this module only composes the in-process pieces.
 *
 * @see Docs/03-architecture.md (Queue -> Workers -> PDF Extraction -> Chunking)
 */
export function createRegistry(ports: {
  extraction: ProcessorPorts;
  chunking: ChunkingPorts;
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

  return registry;
}

function main(): void {
  console.log('[workers] document-processing worker ready; awaiting queue integration');
}

main();
