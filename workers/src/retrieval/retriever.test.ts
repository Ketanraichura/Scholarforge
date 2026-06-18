import { describe, expect, it, vi } from 'vitest';
import { retrieve, type RetrievalPorts, type RawChunkResult } from './retriever.js';

const silentLogger = { info: vi.fn(), error: vi.fn() };

function fakeRawChunk(overrides: Partial<RawChunkResult> = {}): RawChunkResult {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    document_id: '00000000-0000-4000-8000-000000000002',
    content: 'sample chunk content',
    metadata: { page_number: 1 },
    chunk_index: 0,
    page_number: 1,
    similarity: 0.85,
    ...overrides,
  };
}

interface HarnessOptions {
  rawChunks?: RawChunkResult[];
  embedVector?: number[];
}

function harness(opts: HarnessOptions = {}) {
  const embedVector = opts.embedVector ?? [0.1, 0.2, 0.3];
  const rawChunks = opts.rawChunks ?? [fakeRawChunk()];

  const ports: RetrievalPorts = {
    logger: silentLogger,
    embedQuery: vi.fn(async () => embedVector),
    matchChunks: vi.fn(async () => rawChunks),
  };

  return { ports };
}

describe('retrieve', () => {
  it('embeds query and returns formatted results', async () => {
    const { ports } = harness();

    const result = await retrieve('what is machine learning', ports);

    expect(result.query).toBe('what is machine learning');
    expect(result.results).toHaveLength(1);
    expect(result.results[0]).toEqual({
      chunkId: '00000000-0000-4000-8000-000000000001',
      documentId: '00000000-0000-4000-8000-000000000002',
      content: 'sample chunk content',
      metadata: { page_number: 1 },
      similarity: 0.85,
      chunkIndex: 0,
      pageNumber: 1,
    });
  });

  it('passes embedding to matchChunks with default limit', async () => {
    const { ports } = harness({ embedVector: [0.5, 0.6, 0.7] });

    await retrieve('test query', ports);

    expect(ports.matchChunks).toHaveBeenCalledWith([0.5, 0.6, 0.7], 10, undefined);
  });

  it('passes custom limit and documentIds', async () => {
    const { ports } = harness();

    await retrieve('test', ports, { limit: 5, documentIds: ['doc-1', 'doc-2'] });

    expect(ports.matchChunks).toHaveBeenCalledWith(expect.any(Array), 5, ['doc-1', 'doc-2']);
  });

  it('returns empty results when no chunks match', async () => {
    const { ports } = harness({ rawChunks: [] });

    const result = await retrieve('unrelated query', ports);

    expect(result.results).toEqual([]);
  });

  it('returns multiple results in order', async () => {
    const rawChunks = [
      fakeRawChunk({ id: 'c1', similarity: 0.9, chunk_index: 0 }),
      fakeRawChunk({ id: 'c2', similarity: 0.7, chunk_index: 1 }),
      fakeRawChunk({ id: 'c3', similarity: 0.5, chunk_index: 2 }),
    ];
    const { ports } = harness({ rawChunks });

    const result = await retrieve('query', ports);

    expect(result.results).toHaveLength(3);
    expect(result.results[0]!.chunkId).toBe('c1');
    expect(result.results[1]!.chunkId).toBe('c2');
    expect(result.results[2]!.chunkId).toBe('c3');
  });

  it('propagates embedQuery errors', async () => {
    const { ports } = harness();
    ports.embedQuery = vi.fn(async () => {
      throw new Error('embedding provider down');
    });

    await expect(retrieve('test', ports)).rejects.toThrow('embedding provider down');
  });

  it('propagates matchChunks errors', async () => {
    const { ports } = harness();
    ports.matchChunks = vi.fn(async () => {
      throw new Error('match_chunks RPC failed');
    });

    await expect(retrieve('test', ports)).rejects.toThrow('match_chunks RPC failed');
  });
});
