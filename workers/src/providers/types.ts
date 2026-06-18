/**
 * Configuration for an embedding provider.
 * Dimensions are always provided by the provider — never hardcoded.
 */
export interface EmbeddingConfig {
  apiKey: string;
  dimensions?: number;
  model?: string;
  batchSize?: number;
}

/**
 * Result returned by an embedding provider.
 */
export interface EmbeddingResult {
  vectors: number[][];
  dimensions: number;
  model: string;
}

/**
 * Provider abstraction for text embedding generation.
 * Each provider implements this interface to allow swapping backends.
 */
export interface EmbeddingProvider {
  readonly name: string;
  embed(texts: string[], config: EmbeddingConfig): Promise<EmbeddingResult>;
}
