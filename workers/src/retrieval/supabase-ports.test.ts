import { describe, expect, it, vi } from 'vitest';
import type { EmbeddingProvider, EmbeddingConfig } from '../providers/types.js';
import { createRetrievalPorts } from './supabase-ports.js';

const config: EmbeddingConfig = { apiKey: 'test-key', dimensions: 1024 };

function fakeProvider(vectors: number[][] = [[0.1, 0.2, 0.3]]): EmbeddingProvider {
  return {
    name: 'fake',
    embed: vi.fn(async () => ({
      vectors,
      dimensions: vectors[0]?.length ?? 0,
      model: 'fake-model',
    })) as EmbeddingProvider['embed'],
  };
}

interface FakeSupabaseOptions {
  rpcData?: unknown[];
  rpcError?: { message: string } | null;
}

function fakeSupabase(opts: FakeSupabaseOptions = {}) {
  const rpc = vi.fn(async () => ({
    data: opts.rpcData ?? [],
    error: opts.rpcError ?? null,
  }));

  const supabase = { rpc } as never;
  return { supabase, rpc };
}

describe('createRetrievalPorts', () => {
  it('embedQuery returns the first vector from the provider', async () => {
    const provider = fakeProvider([[0.5, 0.6, 0.7]]);
    const { supabase } = fakeSupabase();
    const ports = createRetrievalPorts(supabase, provider, config);

    const vector = await ports.embedQuery('what is deep learning');

    expect(vector).toEqual([0.5, 0.6, 0.7]);
    expect(provider.embed).toHaveBeenCalledWith(['what is deep learning'], config);
  });

  it('matchChunks calls RPC with correct params', async () => {
    const provider = fakeProvider();
    const rpcData = [
      {
        id: 'c1',
        document_id: 'd1',
        content: 'text',
        metadata: {},
        chunk_index: 0,
        page_number: 1,
        similarity: 0.9,
      },
    ];
    const { supabase, rpc } = fakeSupabase({ rpcData });
    const ports = createRetrievalPorts(supabase, provider, config);

    const results = await ports.matchChunks([0.1, 0.2], 5, ['d1']);

    expect(rpc).toHaveBeenCalledWith('match_chunks', {
      query_embedding: [0.1, 0.2],
      match_count: 5,
      p_document_ids: ['d1'],
    });
    expect(results).toEqual(rpcData);
  });

  it('matchChunks passes null for documentIds when undefined', async () => {
    const provider = fakeProvider();
    const { supabase, rpc } = fakeSupabase();
    const ports = createRetrievalPorts(supabase, provider, config);

    await ports.matchChunks([0.1], 10);

    expect(rpc).toHaveBeenCalledWith('match_chunks', {
      query_embedding: [0.1],
      match_count: 10,
      p_document_ids: null,
    });
  });
});
