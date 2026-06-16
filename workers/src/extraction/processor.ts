import type { DocumentStatus } from '@scholarforge/shared';
import { ExtractionError, extractPdfText, type PdfTextParser } from './extractor.js';
import { withRetry } from './retry.js';

/**
 * Document processing orchestrator. Coordinates the extraction pipeline for a
 * single document:
 *
 *   processing -> (download + extract w/ retry) -> persist text -> extracted
 *                                                \-> failed (on unrecoverable error)
 *
 * All side-effecting collaborators are injected via {@link ProcessorPorts} so the
 * orchestrator is unit-testable without Supabase or a real PDF parser.
 *
 * @see Docs/03-architecture.md
 */

export const MAX_EXTRACTION_RETRIES = 3;
export const BASE_RETRY_DELAY_MS = 500;

/** Persistence + storage + logging boundary for the processor. */
export interface ProcessorPorts {
  /** Loads the raw PDF bytes for a document from storage. */
  downloadPdf: (documentId: string) => Promise<Uint8Array>;
  /** Updates the document's lifecycle status. */
  updateStatus: (documentId: string, status: DocumentStatus) => Promise<void>;
  /** Persists the extracted text + page count for a document. */
  saveExtractedText: (input: {
    documentId: string;
    text: string;
    pageCount: number;
  }) => Promise<void>;
  /** Parses PDF bytes into per-page text (pdf-parse adapter). */
  parsePdf: PdfTextParser;
  /** Structured logger; failures are logged with the document id. */
  logger?: Pick<Console, 'info' | 'error'>;
  /** Injectable sleep so retry backoff is instant in tests. */
  sleep?: (ms: number) => Promise<void>;
}

export interface ProcessResult {
  documentId: string;
  status: Extract<DocumentStatus, 'extracted' | 'failed'>;
  pageCount?: number;
  reason?: string;
}

/**
 * Processes one document end-to-end. Never throws for expected extraction
 * failures: instead it marks the document `failed` and returns a result. Only
 * truly unexpected programmer errors propagate.
 */
export async function processDocument(
  documentId: string,
  ports: ProcessorPorts,
): Promise<ProcessResult> {
  const logger = ports.logger ?? console;

  await ports.updateStatus(documentId, 'processing');

  try {
    const extracted = await withRetry(
      async () => {
        const data = await ports.downloadPdf(documentId);
        return extractPdfText(data, ports.parsePdf);
      },
      {
        maxRetries: MAX_EXTRACTION_RETRIES,
        baseDelayMs: BASE_RETRY_DELAY_MS,
        sleep: ports.sleep,
        // Only transient/corrupt failures retry; empty & no-text are terminal.
        isRetryable: (error) => !(error instanceof ExtractionError) || error.retryable,
        onRetry: ({ attempt, delayMs, error }) => {
          const message = error instanceof Error ? error.message : String(error);
          logger.info(
            `[extraction] retry ${attempt}/${MAX_EXTRACTION_RETRIES} for document ${documentId} ` +
              `in ${delayMs}ms: ${message}`,
          );
        },
      },
    );

    await ports.saveExtractedText({
      documentId,
      text: extracted.text,
      pageCount: extracted.pageCount,
    });
    await ports.updateStatus(documentId, 'extracted');

    logger.info(`[extraction] document ${documentId} extracted (${extracted.pageCount} pages)`);
    return { documentId, status: 'extracted', pageCount: extracted.pageCount };
  } catch (error) {
    const reason = error instanceof ExtractionError ? error.reason : 'extraction-failed';
    const message = error instanceof Error ? error.message : String(error);

    // Log failures with the document id (Sprint 3 requirement).
    logger.error(`[extraction] document ${documentId} failed: ${reason} — ${message}`);

    await ports.updateStatus(documentId, 'failed');
    return { documentId, status: 'failed', reason };
  }
}
