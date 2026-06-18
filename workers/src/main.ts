import { createClient } from '@supabase/supabase-js';
import {
  JobRegistry,
  type ChunkDocumentPayload,
  type EmbedDocumentPayload,
  type ProcessDocumentPayload,
} from './index.js';
import { processDocument, type ProcessorPorts } from './extraction/index.js';
import { chunkDocumentJob, type ChunkingPorts } from './chunking/index.js';
import { embedDocumentJob, type EmbeddingPorts } from './embedding/index.js';
import { createSupabasePorts as createExtractionPorts } from './extraction/supabase-ports.js';
import { createChunkingPorts } from './chunking/supabase-ports.js';
import { createEmbeddingPorts } from './embedding/supabase-ports.js';
import { createEmbeddingRuntime } from './env.js';
import type { EmbeddingProvider, EmbeddingConfig } from './providers/types.js';
import { startConsumer } from './queue/consumer.js';

/**
 * Worker entrypoint. Registers the pipeline handlers against the job registry:
 * extraction (Sprint 3), chunking (Sprint 4), and embeddings (Sprint 5).
 * Starts a BullMQ consumer that dequeues jobs and chains pipeline steps.
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

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} environment variable is required`);
  return value;
}

async function main(): Promise<void> {
  const { embeddingProvider, embeddingConfig } = createEmbeddingRuntime();

  const supabaseUrl = requireEnv('SUPABASE_URL');
  const supabaseServiceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const redisUrl = requireEnv('REDIS_URL');

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const registry = createRegistry({
    extraction: createExtractionPorts(supabase),
    chunking: createChunkingPorts(supabase),
    embedding: createEmbeddingPorts(supabase),
    embeddingProvider,
    embeddingConfig,
  });

  const consumer = startConsumer({ redisUrl, registry });

  console.log(`[workers] consumer started (embedding: ${embeddingProvider.name})`);

  const shutdown = async () => {
    console.log('[workers] shutting down...');
    await consumer.close();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((error) => {
  console.error('[workers] fatal startup error', error);
  process.exit(1);
});
