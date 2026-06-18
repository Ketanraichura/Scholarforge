import { describe, expect, it, vi } from 'vitest';
import { JobRegistry, type EmbedDocumentPayload } from './index.js';
import { embedDocumentJob, type EmbeddingPorts } from './embedding/processor.js';
import type { EmbeddingProvider } from './providers/types.js';

const DOC_ID = '00000000-0000-4000-8000-000000000000';

describe('JobRegistry — embed-document', () => {
  it('dispatches embed-document to the registered handler', async () => {
    const registry = new JobRegistry();

    const mockPorts: EmbeddingPorts = {
      logger: { info: vi.fn(), error: vi.fn() },
      loadChunksWithoutEmbeddings: vi.fn(async () => [{ chunkId: 'c1', content: 'Hello' }]),
      saveEmbeddings: vi.fn(async () => {}),
      updateStatus: vi.fn(async () => {}),
    };

    const mockProvider: EmbeddingProvider = {
      name: 'mock',
      embed: vi.fn(async () => ({
        vectors: [[0.1, 0.2]],
        dimensions: 2,
        model: 'mock',
      })),
    };

    registry.register<EmbedDocumentPayload>('embed-document', async ({ documentId }) => {
      const result = await embedDocumentJob(documentId, mockProvider, mockPorts, {
        apiKey: 'test',
      });
      return result.status;
    });

    const status = await registry.dispatch({
      kind: 'embed-document',
      payload: { documentId: DOC_ID },
    });

    expect(status).toBe('ready');
    expect(mockPorts.updateStatus).toHaveBeenCalledWith(DOC_ID, 'ready');
  });
});
