import type { LLMConfig, LLMMessage, LLMProvider, LLMResult } from './llm-types.js';

const DEFAULT_MODEL = 'gemini-2.0-flash';

interface GeminiGenerateResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  model?: string;
}

/**
 * Google Gemini LLM provider for text generation.
 *
 * Default model: gemini-2.0-flash (fast, cheap, good for RAG).
 * Auth: x-goog-api-key header.
 *
 * @see https://ai.google.dev/api/generate-content
 */
export function createGeminiLLMProvider(): LLMProvider {
  return {
    name: 'gemini',

    async generate(messages: LLMMessage[], config: LLMConfig): Promise<LLMResult> {
      const model = config.model ?? DEFAULT_MODEL;

      const contents = messages.map((msg) => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }],
      }));

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': config.apiKey,
        },
        body: JSON.stringify({
          contents,
          generationConfig: {
            maxOutputTokens: config.maxOutputTokens,
            temperature: config.temperature,
          },
        }),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`Gemini LLM API error ${response.status}: ${body}`);
      }

      const data = (await response.json()) as GeminiGenerateResponse;
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!text) {
        throw new Error('Gemini returned empty response');
      }

      return { content: text, model: data.model ?? model };
    },
  };
}
