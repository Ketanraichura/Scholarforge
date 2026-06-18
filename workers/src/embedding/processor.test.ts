import type { DocumentStatus } from '@scholarforge/shared';
import { describe, expect, it, vi } from 'vitest';
import type { EmbeddingProvider } from '../providers/types.js';
import { embedDocumentJob, type EmbeddingPorts } from './processor.js';

const DOC_ID = '00000000-0000-4000-8000-000000000000';
const silentLogger = { info: vi.fn(), error: vi.fn() };

function fakeProvider(vectors: number[][]): EmbeddingProvider {
  return {
    name: 'fake',
    embed: vi.fn(async () => ({
      vectors,
      dimensions: vectors[0]?.length ?? 0,
      model: 'fake-model',
    })) as EmbeddingProvider['embed'],
  };
}

interface HarnessOptions {
  chunks: Array<{ chunkId: string; content: string }>;
}

function harness(opts: HarnessOptions) {
  const statuses: DocumentStatus[] = [];
  const savedEmbeddings: Array<{ chunkId: string; vector: number[] }> = [];

  const ports: EmbeddingPorts = {
    logger: silentLogger,
    loadChunksWithoutEmbeddings: vi.fn(async () => opts.chunks),
    saveEmbeddings: vi.fn(async (embeddings) => {
      savedEmbeddings.push(...embeddings);
    }),
    updateStatus: vi.fn(async (_documentId, status) => {
      statuses.push(status);
    }),
  };

  return { ports, statuses, savedEmbeddings };
}

const providerConfig = { apiKey: 'test-key', dimensions: 128 };

describe('embedDocumentJob', () => {
  it('transitions to ready and persists embeddings', async () => {
    const chunks = [
      { chunkId: 'c1', content: 'Hello world' },
      { chunkId: 'c2', content: 'Foo bar' },
    ];
    const vectors = [
      [0.1, 0.2, 0.3],
      [0.4, 0.5, 0.6],
    ];
    const provider = fakeProvider(vectors);
    const { ports, statuses, savedEmbeddings } = harness({ chunks });

    const result = await embedDocumentJob(DOC_ID, provider, ports, providerConfig);

    expect(result.status).toBe('ready');
    expect(result.chunkCount).toBe(2);
    expect(result.dimensions).toBe(3);
    expect(statuses).toEqual(['ready']);
    expect(savedEmbeddings).toEqual([
      { chunkId: 'c1', vector: [0.1, 0.2, 0.3] },
      { chunkId: 'c2', vector: [0.4, 0.5, 0.6] },
    ]);
  });

  it('skips chunks that already have embeddings (idempotent)', async () => {
    const chunks = [
      { chunkId: 'c1', content: 'Hello world' },
      { chunkId: 'c2', content: 'Foo bar' },
    ];
    const vectors = [[0.1, 0.2]];
    const provider = fakeProvider(vectors);
    const { ports } = harness({ chunks });

    await embedDocumentJob(DOC_ID, provider, ports, providerConfig);
    await embedDocumentJob(DOC_ID, provider, ports, providerConfig);

    // loadChunksWithoutEmbeddings returns only unembedded chunks each time
    expect(ports.loadChunksWithoutEmbeddings).toHaveBeenCalledTimes(2);
    // Provider called once per job (with only unembedded chunks)
    expect(provider.embed).toHaveBeenCalledTimes(2);
  });

  it('transitions to failed when no chunks exist', async () => {
    const provider = fakeProvider([]);
    const { ports, statuses } = harness({ chunks: [] });

    const result = await embedDocumentJob(DOC_ID, provider, ports, providerConfig);

    expect(result.status).toBe('failed');
    expect(result.reason).toBe('no-chunks');
    expect(statuses).toEqual(['failed']);
  });

  it('retries on transient errors and succeeds', async () => {
    const chunks = [{ chunkId: 'c1', content: 'Hello' }];
    let callCount = 0;
    const provider: EmbeddingProvider = {
      name: 'flaky',
      embed: vi.fn(async () => {
        callCount += 1;
        if (callCount === 1) {
          throw new Error('503 Service Unavailable');
        }
        return { vectors: [[0.1]], dimensions: 1, model: 'flaky' };
      }),
    };

    const sleepFn = vi.fn(async () => undefined);
    const { ports } = harness({ chunks });

    const result = await embedDocumentJob(DOC_ID, provider, ports, providerConfig, {
      sleep: sleepFn,
    });

    expect(result.status).toBe('ready');
    expect(provider.embed).toHaveBeenCalledTimes(2);
    expect(sleepFn).toHaveBeenCalledTimes(1);
  });

  it('does not retry on non-retryable errors', async () => {
    const chunks = [{ chunkId: 'c1', content: 'Hello' }];
    const provider: EmbeddingProvider = {
      name: 'bad-request',
      embed: vi.fn(async () => {
        throw new Error('400 Bad Request: invalid input');
      }),
    };

    const sleepFn = vi.fn(async () => undefined);
    const { ports } = harness({ chunks });

    const result = await embedDocumentJob(DOC_ID, provider, ports, providerConfig, {
      sleep: sleepFn,
    });

    expect(result.status).toBe('failed');
    expect(result.reason).toBe('embedding-failed');
    expect(provider.embed).toHaveBeenCalledTimes(1);
    expect(sleepFn).not.toHaveBeenCalled();
  });

  it('marks failed and logs when persistence throws', async () => {
    const chunks = [{ chunkId: 'c1', content: 'Hello' }];
    const vectors = [[0.1]];
    const provider = fakeProvider(vectors);
    const errorFn = vi.fn();
    const { ports } = harness({ chunks });
    ports.logger = { info: vi.fn(), error: errorFn };
    ports.saveEmbeddings = vi.fn(async () => {
      throw new Error('db write failed');
    });

    const result = await embedDocumentJob(DOC_ID, provider, ports, providerConfig);

    expect(result.status).toBe('failed');
    expect(result.reason).toBe('embedding-failed');
    expect(errorFn).toHaveBeenCalledWith(expect.stringContaining(DOC_ID));
  });

  it('returns correct dimensions from provider', async () => {
    const chunks = [{ chunkId: 'c1', content: 'Hello' }];
    const vector = new Array(1024).fill(0.5);
    const provider = fakeProvider([vector]);
    const { ports } = harness({ chunks });

    const result = await embedDocumentJob(DOC_ID, provider, ports, providerConfig);

    expect(result.dimensions).toBe(1024);
  });
});
