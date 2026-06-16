import { z } from 'zod';

/**
 * Shared API contracts for ScholarForge AI.
 *
 * These Zod schemas are the single source of truth for request/response shapes
 * exchanged between the Next.js API routes and the worker processes. Validate at
 * every trust boundary; never trust unvalidated input (see Docs/06-coding-rules.md
 * and Docs/05-api-contracts.md).
 */

/**
 * Lifecycle status of an uploaded document as it moves through the pipeline.
 *
 * Extraction stage (Sprint 3): uploaded -> processing -> extracted | failed.
 * `ready` is reserved for later stages (embeddings/indexing).
 *
 * @see Docs/03-architecture.md
 */
export const DocumentStatusSchema = z.enum([
  'uploaded',
  'processing',
  'extracted',
  'ready',
  'failed',
]);
export type DocumentStatus = z.infer<typeof DocumentStatusSchema>;

/**
 * `POST /api/upload` response.
 * @see Docs/05-api-contracts.md
 */
export const UploadResponseSchema = z.object({
  documentId: z.string().uuid(),
});
export type UploadResponse = z.infer<typeof UploadResponseSchema>;

/**
 * PDF upload constraints. Shared between the client (pre-flight checks) and the
 * server (authoritative validation) so both enforce identical rules.
 * @see Docs/08-security.md (input sanitization)
 */
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20 MB
export const ALLOWED_UPLOAD_MIME_TYPE = 'application/pdf';
export const ALLOWED_UPLOAD_EXTENSION = '.pdf';

/** Result of validating an upload candidate (filename + mime + size). */
export interface UploadValidationInput {
  filename: string;
  mimeType: string;
  sizeBytes: number;
}

export type UploadValidationError =
  | 'empty-file'
  | 'file-too-large'
  | 'invalid-mime-type'
  | 'invalid-extension';

/**
 * Validates an upload candidate against the MIME type, extension, and size
 * rules. Returns `null` when valid, otherwise a stable error code. Pure and
 * dependency-free so it can run in the browser and on the server.
 */
export function validateUpload(input: UploadValidationInput): UploadValidationError | null {
  if (input.sizeBytes <= 0) {
    return 'empty-file';
  }
  if (input.sizeBytes > MAX_UPLOAD_BYTES) {
    return 'file-too-large';
  }
  if (input.mimeType !== ALLOWED_UPLOAD_MIME_TYPE) {
    return 'invalid-mime-type';
  }
  if (!input.filename.toLowerCase().endsWith(ALLOWED_UPLOAD_EXTENSION)) {
    return 'invalid-extension';
  }
  return null;
}

/** Human-readable messages for each upload validation error code. */
export const UPLOAD_ERROR_MESSAGES: Record<UploadValidationError, string> = {
  'empty-file': 'The file is empty.',
  'file-too-large': 'File exceeds the 20 MB limit.',
  'invalid-mime-type': 'Only PDF files are allowed.',
  'invalid-extension': 'File must have a .pdf extension.',
};

/**
 * `POST /api/chat` request body.
 * @see Docs/05-api-contracts.md
 */
export const ChatRequestSchema = z.object({
  query: z.string().min(1, 'query must not be empty'),
  documentIds: z.array(z.string().uuid()).min(1, 'at least one documentId is required'),
});
export type ChatRequest = z.infer<typeof ChatRequestSchema>;
