import { describe, expect, it, vi, beforeEach } from 'vitest';

const { addMock, closeWorkerMock, closeQueueMock, WorkerMock, QueueMock } = vi.hoisted(() => {
  const addMock = vi.fn(async () => ({}));
  const closeWorkerMock = vi.fn(async () => undefined);
  const closeQueueMock = vi.fn(async () => undefined);
  const QueueMock = vi.fn(() => ({ add: addMock, close: closeQueueMock }));
  const WorkerMock = vi.fn(
    (
      _name: string,
      handler: (job: { name: string; data: { documentId: string } }) => Promise<unknown>,
    ) => {
      capturedHandler = handler;
      return {
        on: vi.fn(),
        close: closeWorkerMock,
      };
    },
  );
  return { addMock, closeWorkerMock, closeQueueMock, QueueMock, WorkerMock };
});

let capturedHandler:
  | ((job: { name: string; data: { documentId: string } }) => Promise<unknown>)
  | null = null;

vi.mock('bullmq', () => ({
  Queue: QueueMock,
  Worker: WorkerMock,
}));

import { startConsumer } from './consumer.js';
import { JobRegistry, type ProcessDocumentPayload, type ChunkDocumentPayload } from '../index.js';

const DOC_ID = '00000000-0000-4000-8000-000000000000';

function makeRegistry(overrides?: {
  processStatus?: string;
  chunkStatus?: string;
  embedStatus?: string;
}) {
  const registry = new JobRegistry();
  registry.register<ProcessDocumentPayload>('process-document', async () => {
    return (overrides?.processStatus ?? 'extracted') as never;
  });
  registry.register<ChunkDocumentPayload>('chunk-document', async () => {
    return (overrides?.chunkStatus ?? 'chunked') as never;
  });
  registry.register<{ documentId: string }>('embed-document', async () => {
    return (overrides?.embedStatus ?? 'ready') as never;
  });
  return registry;
}

describe('startConsumer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedHandler = null;
  });

  it('creates a BullMQ Worker on the documents queue', () => {
    startConsumer({ redisUrl: 'redis://localhost:6379', registry: makeRegistry() });

    expect(WorkerMock).toHaveBeenCalledWith(
      'documents',
      expect.any(Function),
      expect.objectContaining({
        connection: { host: 'localhost', port: 6379, password: undefined, db: undefined },
      }),
    );
  });

  it('chains process-document → chunk-document on extracted status', async () => {
    startConsumer({ redisUrl: 'redis://localhost:6379', registry: makeRegistry() });

    expect(capturedHandler).not.toBeNull();
    await capturedHandler!({ name: 'process-document', data: { documentId: DOC_ID } });

    expect(addMock).toHaveBeenCalledWith('chunk-document', { documentId: DOC_ID });
  });

  it('chains chunk-document → embed-document on chunked status', async () => {
    startConsumer({ redisUrl: 'redis://localhost:6379', registry: makeRegistry() });

    await capturedHandler!({ name: 'chunk-document', data: { documentId: DOC_ID } });

    expect(addMock).toHaveBeenCalledWith('embed-document', { documentId: DOC_ID });
  });

  it('does not chain when process-document fails', async () => {
    startConsumer({
      redisUrl: 'redis://localhost:6379',
      registry: makeRegistry({ processStatus: 'failed' }),
    });

    await capturedHandler!({ name: 'process-document', data: { documentId: DOC_ID } });

    expect(addMock).not.toHaveBeenCalled();
  });

  it('does not chain when chunk-document fails', async () => {
    startConsumer({
      redisUrl: 'redis://localhost:6379',
      registry: makeRegistry({ chunkStatus: 'failed' }),
    });

    await capturedHandler!({ name: 'chunk-document', data: { documentId: DOC_ID } });

    expect(addMock).not.toHaveBeenCalled();
  });

  it('embed-document does not enqueue further jobs', async () => {
    startConsumer({ redisUrl: 'redis://localhost:6379', registry: makeRegistry() });

    await capturedHandler!({ name: 'embed-document', data: { documentId: DOC_ID } });

    expect(addMock).not.toHaveBeenCalled();
  });

  it('close shuts down worker and queue', async () => {
    const handle = startConsumer({
      redisUrl: 'redis://localhost:6379',
      registry: makeRegistry(),
    });

    await handle.close();

    expect(closeWorkerMock).toHaveBeenCalled();
    expect(closeQueueMock).toHaveBeenCalled();
  });
});
