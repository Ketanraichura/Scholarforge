import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

const { addMock, QueueMock } = vi.hoisted(() => {
  const addMock = vi.fn(async () => ({}));
  const QueueMock = vi.fn(() => ({ add: addMock }));
  return { addMock, QueueMock };
});

vi.mock('bullmq', () => ({
  Queue: QueueMock,
}));

import { defaultDocumentQueue, _resetQueueForTesting } from './queue';

const DOC_ID = '00000000-0000-4000-8000-000000000000';

describe('defaultDocumentQueue (BullMQ)', () => {
  const originalEnv = process.env.REDIS_URL;

  beforeEach(() => {
    vi.clearAllMocks();
    _resetQueueForTesting();
    process.env.REDIS_URL = 'redis://localhost:6379';
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.REDIS_URL;
    } else {
      process.env.REDIS_URL = originalEnv;
    }
  });

  it('creates a BullMQ Queue with parsed connection options', async () => {
    await defaultDocumentQueue.enqueue({ kind: 'process-document', documentId: DOC_ID });

    expect(QueueMock).toHaveBeenCalledWith(
      'documents',
      expect.objectContaining({
        connection: { host: 'localhost', port: 6379, password: undefined, db: undefined },
      }),
    );
  });

  it('adds a process-document job with the document id', async () => {
    await defaultDocumentQueue.enqueue({ kind: 'process-document', documentId: DOC_ID });

    expect(addMock).toHaveBeenCalledWith('process-document', { documentId: DOC_ID });
  });

  it('parses password from the Redis URL', async () => {
    process.env.REDIS_URL = 'redis://:secret@redis.example.com:6380';

    await defaultDocumentQueue.enqueue({ kind: 'process-document', documentId: DOC_ID });

    expect(QueueMock).toHaveBeenCalledWith(
      'documents',
      expect.objectContaining({
        connection: expect.objectContaining({
          host: 'redis.example.com',
          port: 6380,
          password: 'secret',
        }),
      }),
    );
  });

  it('parses database number from the Redis URL path', async () => {
    process.env.REDIS_URL = 'redis://localhost:6379/3';

    await defaultDocumentQueue.enqueue({ kind: 'process-document', documentId: DOC_ID });

    expect(QueueMock).toHaveBeenCalledWith(
      'documents',
      expect.objectContaining({
        connection: expect.objectContaining({ db: 3 }),
      }),
    );
  });

  it('throws when REDIS_URL is not set', async () => {
    delete process.env.REDIS_URL;

    await expect(
      defaultDocumentQueue.enqueue({ kind: 'process-document', documentId: DOC_ID }),
    ).rejects.toThrow('REDIS_URL');
  });
});
