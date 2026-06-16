/**
 * PDF text extraction core. Pure and dependency-injected: the actual pdf-parse
 * call is passed in as {@link PdfTextParser}, so this module is fully testable
 * without real PDFs or the pdf-parse library.
 *
 * @see Docs/03-architecture.md (PDF Extraction -> Chunking)
 */

/** Normalised result of parsing a PDF's text content. */
export interface ParsedPdf {
  /** Per-page text, preserving page boundaries where the parser provides them. */
  pages: string[];
}

/** Adapter over a PDF text parser (e.g. pdf-parse). */
export type PdfTextParser = (data: Uint8Array) => Promise<ParsedPdf>;

/** Why an extraction could not produce usable text. */
export type ExtractionFailureReason = 'empty-pdf' | 'no-text-content' | 'corrupt-pdf';

export class ExtractionError extends Error {
  readonly reason: ExtractionFailureReason;
  /** Corrupt PDFs are worth retrying (transient parser/IO issues); others are not. */
  readonly retryable: boolean;

  constructor(reason: ExtractionFailureReason, message?: string) {
    super(message ?? reason);
    this.name = 'ExtractionError';
    this.reason = reason;
    this.retryable = reason === 'corrupt-pdf';
  }
}

/** Joins page text with a form-feed delimiter so page boundaries survive storage. */
export const PAGE_DELIMITER = '\f';

export interface ExtractedDocument {
  /** Full document text with pages joined by {@link PAGE_DELIMITER}. */
  text: string;
  pageCount: number;
}

/**
 * Extracts and validates text from a PDF buffer.
 *
 * - Empty buffer            -> ExtractionError('empty-pdf')
 * - Parser throws           -> ExtractionError('corrupt-pdf', retryable)
 * - Parsed but no real text -> ExtractionError('no-text-content')  (scanned/image PDFs)
 * - Otherwise               -> joined text + page count
 */
export async function extractPdfText(
  data: Uint8Array,
  parse: PdfTextParser,
): Promise<ExtractedDocument> {
  if (data.byteLength === 0) {
    throw new ExtractionError('empty-pdf', 'PDF file is empty.');
  }

  let parsed: ParsedPdf;
  try {
    parsed = await parse(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to parse PDF.';
    throw new ExtractionError('corrupt-pdf', message);
  }

  const pages = parsed.pages.map((page) => page.trim());
  const hasText = pages.some((page) => page.length > 0);
  if (!hasText) {
    // No extractable text: typically a scanned/image-only PDF (OCR not in scope).
    throw new ExtractionError('no-text-content', 'PDF contains no extractable text.');
  }

  return {
    text: pages.join(PAGE_DELIMITER),
    pageCount: pages.length,
  };
}
