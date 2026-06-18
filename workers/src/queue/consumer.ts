/**
 * BullMQ worker consumer for the document processing pipeline.
 *
 * Listens on the `documents` queue and dispatches jobs through the
 * {@link JobRegistry}. After each pipeline stage completes successfully,
 * the consumer chains the next step:
 *
 *   process-document → chunk-document → embed-document
 *
 * @see workers/src/index.ts — JobRegistry with registered handlers
 * @see frontend/src/lib/documents/queue.ts — producer that enqueues jobs
 */

import { Queue, Worker, type Job, type ConnectionOptions } from 'bullmq';
import type { JobRegistry, JobKind } from '../index.js';

const QUEUE_NAME = 'documents';

export interface ConsumerOptions {
  redisUrl: string;
  registry: JobRegistry;
  logger?: Pick<Console, 'info' | 'error'>;
}

export interface ConsumerHandle {
  worker: Worker;
  queue: Queue;
  /** Gracefully shut down the consumer and its Redis connection. */
  close: () => Promise<void>;
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

/**
 * Starts a BullMQ worker that processes document pipeline jobs. The worker
 * remains running until {@link ConsumerHandle.close} is called.
 */
export function startConsumer(options: ConsumerOptions): ConsumerHandle {
  const { redisUrl, registry, logger = console } = options;
  const connection = parseRedisUrl(redisUrl);

  const queue = new Queue(QUEUE_NAME, { connection });

  const worker = new Worker(
    QUEUE_NAME,
    async (job: Job<{ documentId: string }, unknown, string>) => {
      logger.info(`[consumer] processing ${job.name} for document ${job.data.documentId}`);

      const status = await registry.dispatch({
        kind: job.name as JobKind,
        payload: { documentId: job.data.documentId },
      });

      // Chain: enqueue next pipeline step on expected intermediate status.
      if (job.name === 'process-document' && status === 'extracted') {
        await queue.add('chunk-document', { documentId: job.data.documentId });
      } else if (job.name === 'chunk-document' && status === 'chunked') {
        await queue.add('embed-document', { documentId: job.data.documentId });
      }

      logger.info(
        `[consumer] completed ${job.name} for document ${job.data.documentId} → ${status}`,
      );
      return status;
    },
    {
      connection,
      lockDuration: 30_000,
      stalledInterval: 15_000,
    },
  );

  worker.on('failed', (job, error) => {
    logger.error(`[consumer] ${job?.name} failed for document ${job?.data.documentId}`, error);
  });

  worker.on('error', (error) => {
    logger.error('[consumer] worker error', error);
  });

  return {
    worker,
    queue,
    async close() {
      await worker.close();
      await queue.close();
    },
  };
}
