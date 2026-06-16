import { JobRegistry, type ProcessDocumentPayload } from './index.js';

/**
 * Worker entrypoint. For now it only wires up the registry and logs readiness;
 * no queue is consumed and no documents are processed (that arrives in later
 * sprints). Running this process is safe and side-effect free.
 */
function createRegistry(): JobRegistry {
  const registry = new JobRegistry();

  // Placeholder handler: marks the document as "processing" without doing any
  // extraction/embedding work. Real pipeline logic is added in a later sprint.
  registry.register<ProcessDocumentPayload>('process-document', async () => 'processing');

  return registry;
}

function main(): void {
  createRegistry();
  console.log('[workers] registry initialised; awaiting queue integration');
}

main();

export { createRegistry };
