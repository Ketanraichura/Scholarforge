import type { DocumentStatus } from '@scholarforge/shared';
import { describe, expect, it, vi } from 'vitest';
import type { Chunk } from './chunker.js';
import { chunkDocumentJob, type ChunkingPorts } from './processor.js';

const DOC_ID = '00000000-0000-4000-8000-000000000000';
const silentLogger = { info: vi.fn(), error: vi.fn() };

interface HarnessOptions {
  text: string | null;
}

/** In-memory chunking ports that record status transitions and persisted chunks. */
function harness(opts: HarnessOptions) {
  const statuses: DocumentStatus[] = [];
  const store = new Map<string, Chunk[]>();

  const ports: ChunkingPorts = {
    logger: silentLogger,
    loadExtractedText: vi.fn(async () => opts.text),
    deleteChunks: vi.fn(async (documentId: string) => {
      store.delete(documentId);
    }),
    saveChunks: vi.fn(async (documentId: string, chunks: Chunk[]) => {
      store.set(documentId, chunks);
    }),
    updateStatus: vi.fn(async (_documentId: string, status: DocumentStatus) => {
      statuses.push(status);
    }),
  };

  return { ports, statuses, store };
}

describe('chunkDocumentJob', () => {
  it('extraction -> chunking: transitions to chunked and persists chunks', async () => {
    const { ports, statuses, store } = harness({ text: 'word '.repeat(400) });

    const result = await chunkDocumentJob(DOC_ID, ports);

    expect(result.status).toBe('chunked');
    expect(result.chunkCount).toBeGreaterThan(1);
    expect(statuses).toEqual(['chunked']);
    expect(store.get(DOC_ID)?.length).toBe(result.chunkCount);
  });

  it('clears existing chunks before inserting (idempotent reprocessing)', async () => {
    const { ports } = harness({ text: 'word '.repeat(400) });

    await chunkDocumentJob(DOC_ID, ports);
    await chunkDocumentJob(DOC_ID, ports);

    // deleteChunks runs on every successful run, before saveChunks.
    expect(ports.deleteChunks).toHaveBeenCalledTimes(2);
    expect(ports.saveChunks).toHaveBeenCalledTimes(2);
  });

  it('reprocessing the same document produces the same chunk count (no duplicates)', async () => {
    const { ports, store } = harness({ text: 'word '.repeat(400) });

    const first = await chunkDocumentJob(DOC_ID, ports);
    const afterFirst = store.get(DOC_ID)?.length;
    const second = await chunkDocumentJob(DOC_ID, ports);
    const afterSecond = store.get(DOC_ID)?.length;

    expect(first.chunkCount).toBe(second.chunkCount);
    expect(afterFirst).toBe(afterSecond);
  });

  it('empty document: transitions to failed without saving chunks', async () => {
    const { ports, statuses } = harness({ text: '   \n\f  \n  ' });

    const result = await chunkDocumentJob(DOC_ID, ports);

    expect(result.status).toBe('failed');
    expect(result.reason).toBe('empty-document');
    expect(statuses).toEqual(['failed']);
    expect(ports.saveChunks).not.toHaveBeenCalled();
  });

  it('missing extracted text: transitions to failed with no-extracted-text', async () => {
    const { ports } = harness({ text: null });

    const result = await chunkDocumentJob(DOC_ID, ports);

    expect(result.status).toBe('failed');
    expect(result.reason).toBe('no-extracted-text');
    expect(ports.saveChunks).not.toHaveBeenCalled();
  });

  it('marks failed and logs with the document id when persistence throws', async () => {
    const error = vi.fn();
    const { ports } = harness({ text: 'word '.repeat(400) });
    ports.logger = { info: vi.fn(), error };
    ports.saveChunks = vi.fn(async () => {
      throw new Error('insert exploded');
    });

    const result = await chunkDocumentJob(DOC_ID, ports);

    expect(result.status).toBe('failed');
    expect(result.reason).toBe('chunking-failed');
    expect(error).toHaveBeenCalledWith(expect.stringContaining(DOC_ID));
  });

  it('persisted chunks carry correct, monotonic metadata', async () => {
    const { ports, store } = harness({ text: 'word '.repeat(400) });

    await chunkDocumentJob(DOC_ID, ports);
    const chunks = store.get(DOC_ID) ?? [];

    chunks.forEach((chunk, i) => {
      expect(chunk.metadata.document_id).toBe(DOC_ID);
      expect(chunk.metadata.chunk_index).toBe(i);
      expect(chunk.metadata.page_number).toBeGreaterThanOrEqual(1);
    });
  });
});
