/**
 * Processing-queue boundary for document extraction.
 *
 * Uploads must return fast (Docs Sprint 3: "Upload API must remain fast"), so
 * the API only *enqueues* a processing job and never runs extraction inline.
 * The concrete transport (BullMQ + Redis) is provided by the deployment; this
 * module defines the contract and a default implementation backed by BullMQ.
 *
 * @see workers/src/queue/consumer.ts — consumer that dequeues and processes jobs
 */

import { Queue, type ConnectionOptions } from 'bullmq';

export interface ProcessDocumentJob {
  kind: 'process-document';
  documentId: string;
}

export interface DocumentQueue {
  enqueue: (job: ProcessDocumentJob) => Promise<void>;
}

const QUEUE_NAME = 'documents';

let _queue: Queue | null = null;

/** Resets the cached queue singleton. Exported for testing only. */
export function _resetQueueForTesting(): void {
  _queue = null;
}

function parseRedisUrl(url: string): ConnectionOptions {
  const parsed = new URL(url);
  const dbPath = parsed.pathname.slice(1);
  return {
    host: parsed.hostname,
    port: Number.parseInt(parsed.port || '6379', 10),
    password: parsed.password || undefined,
    db: dbPath.length > 0 ? Number.parseInt(dbPath, 10) : undefined,
  };
}

function getQueue(): Queue {
  if (!_queue) {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) throw new Error('REDIS_URL environment variable is required');
    _queue = new Queue(QUEUE_NAME, {
      connection: parseRedisUrl(redisUrl),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      },
    });
  }
  return _queue;
}

/**
 * BullMQ-backed document queue. Enqueues a processing job that triggers the
 * extraction → chunking → embedding pipeline in the workers process.
 *
 * Uses a module-level singleton so the Redis connection is reused across warm
 * serverless invocations. The connection is garbage collected on cold starts.
 */
export const defaultDocumentQueue: DocumentQueue = {
  async enqueue(job) {
    const queue = getQueue();
    await queue.add(job.kind, { documentId: job.documentId });
  },
};
