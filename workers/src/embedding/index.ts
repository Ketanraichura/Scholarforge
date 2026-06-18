export {
  embedDocumentJob,
  EmbeddingError,
  DEFAULT_EMBEDDING_BATCH_SIZE,
  MAX_EMBEDDING_RETRIES,
  BASE_EMBEDDING_RETRY_DELAY_MS,
  type ChunkToEmbed,
  type EmbeddingFailureReason,
  type EmbeddingPorts,
  type EmbeddingResult,
} from './processor.js';
export { createEmbeddingPorts } from './supabase-ports.js';
