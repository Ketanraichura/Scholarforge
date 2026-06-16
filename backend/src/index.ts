import { z } from 'zod';

/**
 * Shared API contracts for ScholarForge AI.
 *
 * These Zod schemas are the single source of truth for request/response shapes
 * exchanged between the Next.js API routes and the worker processes. Validate at
 * every trust boundary; never trust unvalidated input (see Docs/06-coding-rules.md
 * and Docs/05-api-contracts.md).
 */

/** Lifecycle status of an uploaded document as it moves through the pipeline. */
export const DocumentStatusSchema = z.enum(['uploaded', 'processing', 'ready', 'failed']);
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
 * `POST /api/chat` request body.
 * @see Docs/05-api-contracts.md
 */
export const ChatRequestSchema = z.object({
  query: z.string().min(1, 'query must not be empty'),
  documentIds: z.array(z.string().uuid()).min(1, 'at least one documentId is required'),
});
export type ChatRequest = z.infer<typeof ChatRequestSchema>;
