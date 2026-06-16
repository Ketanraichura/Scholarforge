/**
 * Processing-queue boundary for document extraction.
 *
 * Uploads must return fast (Docs Sprint 3: "Upload API must remain fast"), so
 * the API only *enqueues* a processing job and never runs extraction inline.
 * The concrete transport (e.g. a hosted queue consumed by the workers package)
 * is provided by the deployment; this module defines the contract and a default
 * implementation that records intent without blocking the request.
 */

export interface ProcessDocumentJob {
  kind: 'process-document';
  documentId: string;
}

export interface DocumentQueue {
  enqueue: (job: ProcessDocumentJob) => Promise<void>;
}

/**
 * Default queue: logs the job and resolves immediately. It is intentionally
 * side-effect-light so the upload request stays fast and never fails because of
 * downstream processing. Swap this out with a real transport in deployment.
 */
export const defaultDocumentQueue: DocumentQueue = {
  async enqueue(job: ProcessDocumentJob): Promise<void> {
    console.info(`[queue] enqueued ${job.kind} for document ${job.documentId}`);
  },
};
