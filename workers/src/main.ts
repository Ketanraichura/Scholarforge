import { JobRegistry, type ProcessDocumentPayload } from './index.js';
import { processDocument, type ProcessorPorts } from './extraction/index.js';

/**
 * Worker entrypoint. Registers the document-processing handler against the job
 * registry. A queue/storage integration (e.g. pulling jobs and constructing
 * Supabase-backed ports) is wired up by the deployment; this module only
 * composes the in-process pieces.
 *
 * @see Docs/03-architecture.md (Queue -> Workers -> PDF Extraction)
 */
export function createRegistry(ports: ProcessorPorts): JobRegistry {
  const registry = new JobRegistry();

  registry.register<ProcessDocumentPayload>('process-document', async ({ documentId }) => {
    const result = await processDocument(documentId, ports);
    return result.status;
  });

  return registry;
}

function main(): void {
  console.log('[workers] document-processing worker ready; awaiting queue integration');
}

main();
