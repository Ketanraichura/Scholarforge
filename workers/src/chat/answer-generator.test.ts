import { describe, expect, it, vi } from 'vitest';
import { generateAnswer, type ChatPorts } from './answer-generator.js';
import type { LLMProvider, LLMConfig } from '../providers/llm-types.js';
import type { RetrievalPorts, RawChunkResult } from '../retrieval/retriever.js';

const silentLogger = { info: vi.fn(), error: vi.fn() };

const DOC_ID = '00000000-0000-4000-8000-000000000002';

function fakeRawChunk(overrides: Partial<RawChunkResult> = {}): RawChunkResult {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    document_id: DOC_ID,
    content: 'machine learning is a subset of AI',
    metadata: {},
    chunk_index: 0,
    page_number: 3,
    similarity: 0.9,
    ...overrides,
  };
}

function fakeLLM(answer: string): LLMProvider {
  return {
    name: 'fake',
    generate: vi.fn(async () => ({ content: answer, model: 'fake' })),
  };
}

function harness(opts: { chunks?: RawChunkResult[]; llmAnswer?: string } = {}) {
  const chunks = opts.chunks ?? [fakeRawChunk()];
  const llmAnswer = opts.llmAnswer ?? 'The answer is [1].';

  const retrievalPorts: RetrievalPorts = {
    logger: silentLogger,
    embedQuery: vi.fn(async () => [0.1, 0.2]),
    matchChunks: vi.fn(async () => chunks),
  };

  const ports: ChatPorts = { retrieval: retrievalPorts, logger: silentLogger };
  const llmProvider = fakeLLM(llmAnswer);
  const llmConfig: LLMConfig = { apiKey: 'test-key' };

  return { ports, llmProvider, llmConfig, retrievalPorts };
}

describe('generateAnswer', () => {
  it('retrieves chunks, generates answer, and extracts citations', async () => {
    const { ports, llmProvider, llmConfig } = harness({
      llmAnswer: 'Machine learning [1] is important.',
    });

    const result = await generateAnswer('What is ML?', [DOC_ID], ports, llmProvider, llmConfig);

    expect(result.answer).toBe('Machine learning [1] is important.');
    expect(result.citations).toHaveLength(1);
    expect(result.citations[0]!.marker).toBe(1);
    expect(result.citations[0]!.pageNumber).toBe(3);
    expect(result.chunksUsed).toBe(1);
  });

  it('calls retrieval with correct query and documentIds', async () => {
    const { ports, retrievalPorts, llmProvider, llmConfig } = harness();

    await generateAnswer('test query', ['doc1', 'doc2'], ports, llmProvider, llmConfig);

    expect(retrievalPorts.embedQuery).toHaveBeenCalledWith('test query');
    expect(retrievalPorts.matchChunks).toHaveBeenCalledWith(expect.any(Array), 5, ['doc1', 'doc2']);
  });

  it('returns no-citations message when no chunks found', async () => {
    const { ports, llmProvider, llmConfig } = harness({ chunks: [] });

    const result = await generateAnswer('query', [DOC_ID], ports, llmProvider, llmConfig);

    expect(result.answer).toBe('No relevant documents found for your question.');
    expect(result.citations).toEqual([]);
    expect(result.chunksUsed).toBe(0);
    expect(llmProvider.generate).not.toHaveBeenCalled();
  });

  it('passes system prompt and user prompt to LLM', async () => {
    const { ports, llmProvider, llmConfig } = harness();

    await generateAnswer('query', [DOC_ID], ports, llmProvider, llmConfig);

    const calls = (llmProvider.generate as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const messages = calls[0] as Array<{ role: string; content: string }>;
    expect(messages).toHaveLength(3);
    expect(messages[0]!.role).toBe('user');
    expect(messages[0]!.content).toContain('research assistant');
    expect(messages[1]!.role).toBe('model');
    expect(messages[2]!.role).toBe('user');
    expect(messages[2]!.content).toContain('Question: query');
  });

  it('propagates LLM errors', async () => {
    const { ports, llmConfig } = harness();
    const failingLLM: LLMProvider = {
      name: 'failing',
      generate: vi.fn(async () => {
        throw new Error('LLM API down');
      }),
    };

    await expect(generateAnswer('query', [DOC_ID], ports, failingLLM, llmConfig)).rejects.toThrow(
      'LLM API down',
    );
  });

  it('propagates retrieval errors', async () => {
    const llmProvider = fakeLLM('answer');
    const retrievalPorts: RetrievalPorts = {
      logger: silentLogger,
      embedQuery: vi.fn(async () => {
        throw new Error('embedding failed');
      }),
      matchChunks: vi.fn(async () => []),
    };
    const ports: ChatPorts = { retrieval: retrievalPorts, logger: silentLogger };

    await expect(
      generateAnswer('query', [DOC_ID], ports, llmProvider, { apiKey: 'test' }),
    ).rejects.toThrow('embedding failed');
  });
});
