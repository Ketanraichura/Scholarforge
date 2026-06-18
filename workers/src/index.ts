import { DocumentStatusSchema, type DocumentStatus } from '@scholarforge/shared';

/**
 * Worker job kinds. Concrete handlers are registered by the worker entrypoint:
 * `process-document` runs PDF text extraction (Sprint 3), `chunk-document`
 * splits extracted text into chunks (Sprint 4), and `embed-document` generates
 * embeddings for chunks (Sprint 5).
 *
 * @see Docs/03-architecture.md (Queue -> Workers)
 */
export type JobKind = 'process-document' | 'chunk-document' | 'embed-document';

export interface Job<TPayload> {
  readonly kind: JobKind;
  readonly payload: TPayload;
}

export interface ProcessDocumentPayload {
  readonly documentId: string;
}

export interface ChunkDocumentPayload {
  readonly documentId: string;
}

export interface EmbedDocumentPayload {
  readonly documentId: string;
}

/** A handler transforms a job into a resulting document status. */
export type JobHandler<TPayload> = (payload: TPayload) => Promise<DocumentStatus>;

/**
 * Minimal in-memory handler registry. Concrete handlers are registered by the
 * worker entrypoint; the registry itself contains no AI logic.
 */
export class JobRegistry {
  readonly #handlers = new Map<JobKind, JobHandler<unknown>>();

  register<TPayload>(kind: JobKind, handler: JobHandler<TPayload>): void {
    this.#handlers.set(kind, handler as JobHandler<unknown>);
  }

  async dispatch<TPayload>(job: Job<TPayload>): Promise<DocumentStatus> {
    const handler = this.#handlers.get(job.kind);
    if (!handler) {
      throw new Error(`No handler registered for job kind "${job.kind}"`);
    }
    const status = await handler(job.payload);
    return DocumentStatusSchema.parse(status);
  }
}
