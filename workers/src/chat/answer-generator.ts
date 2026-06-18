import type { SearchResult } from '@scholarforge/shared';
import type { LLMProvider, LLMConfig } from '../providers/llm-types.js';
import type { RetrievalPorts } from '../retrieval/retriever.js';
import { retrieve } from '../retrieval/retriever.js';
import { extractCitations, type Citation } from './citations.js';

/**
 * Chat orchestrator (Sprint 7). Stateless Q&A:
 * retrieve chunks → build prompt → generate answer → extract citations.
 */

export interface ChatPorts {
  retrieval: RetrievalPorts;
  logger?: Pick<Console, 'info' | 'error'>;
}

export interface ChatOptions {
  limit?: number;
}

export interface ChatResult {
  answer: string;
  citations: Citation[];
  chunksUsed: number;
}

const SYSTEM_PROMPT = `You are a research assistant. Answer questions using ONLY the provided context.
Include citation markers like [1], [2] when referencing specific context passages.
If the context doesn't contain enough information, say so clearly.
Do not fabricate information not present in the context.`;

function buildUserPrompt(query: string, chunks: SearchResult[]): string {
  const context = chunks
    .map((chunk, i) => `[${i + 1}] (Page ${chunk.pageNumber})\n${chunk.content}`)
    .join('\n\n');

  return `Context:\n${context}\n\nQuestion: ${query}`;
}

/**
 * Generates a grounded answer with citations for a user question.
 */
export async function generateAnswer(
  query: string,
  documentIds: string[],
  ports: ChatPorts,
  llmProvider: LLMProvider,
  llmConfig: LLMConfig,
  options?: ChatOptions,
): Promise<ChatResult> {
  const logger = ports.logger ?? console;
  const limit = options?.limit ?? 5;

  const retrieval = await retrieve(query, ports.retrieval, { limit, documentIds });

  if (retrieval.results.length === 0) {
    return {
      answer: 'No relevant documents found for your question.',
      citations: [],
      chunksUsed: 0,
    };
  }

  const userPrompt = buildUserPrompt(query, retrieval.results);

  const llmResult = await llmProvider.generate(
    [
      { role: 'user', content: SYSTEM_PROMPT },
      {
        role: 'model',
        content:
          'I understand. I will answer based only on the provided context and include citation markers.',
      },
      { role: 'user', content: userPrompt },
    ],
    llmConfig,
  );

  const citations = extractCitations(llmResult.content, retrieval.results);

  logger.info(
    `[chat] answer generated (${citations.length} citations, ${retrieval.results.length} chunks used)`,
  );

  return {
    answer: llmResult.content,
    citations,
    chunksUsed: retrieval.results.length,
  };
}
