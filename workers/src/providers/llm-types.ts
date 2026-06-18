/**
 * Configuration for an LLM provider (text generation).
 */
export interface LLMConfig {
  apiKey: string;
  model?: string;
  maxOutputTokens?: number;
  temperature?: number;
}

/**
 * A single message in a conversation.
 */
export interface LLMMessage {
  role: 'user' | 'model';
  content: string;
}

/**
 * Result returned by an LLM provider.
 */
export interface LLMResult {
  content: string;
  model: string;
}

/**
 * Provider abstraction for text generation.
 */
export interface LLMProvider {
  readonly name: string;
  generate(messages: LLMMessage[], config: LLMConfig): Promise<LLMResult>;
}
