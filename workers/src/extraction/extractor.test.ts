import { describe, expect, it, vi } from 'vitest';
import {
  ExtractionError,
  PAGE_DELIMITER,
  extractPdfText,
  type PdfTextParser,
} from './extractor.js';

const bytes = (n: number): Uint8Array => new Uint8Array(n).fill(1);

describe('extractPdfText', () => {
  it('extracts text from a valid PDF and preserves page boundaries', async () => {
    const parse: PdfTextParser = async () => ({ pages: ['Page one.', 'Page two.'] });

    const result = await extractPdfText(bytes(10), parse);

    expect(result.pageCount).toBe(2);
    expect(result.text).toBe(`Page one.${PAGE_DELIMITER}Page two.`);
  });

  it('rejects an empty PDF (zero bytes) without calling the parser', async () => {
    const parse = vi.fn<PdfTextParser>(async () => ({ pages: ['x'] }));

    await expect(extractPdfText(new Uint8Array(0), parse)).rejects.toMatchObject({
      reason: 'empty-pdf',
    });
    expect(parse).not.toHaveBeenCalled();
  });

  it('classifies a parser throw as a corrupt (retryable) PDF', async () => {
    const parse: PdfTextParser = async () => {
      throw new Error('Invalid PDF structure');
    };

    const error = await extractPdfText(bytes(10), parse).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ExtractionError);
    expect((error as ExtractionError).reason).toBe('corrupt-pdf');
    expect((error as ExtractionError).retryable).toBe(true);
  });

  it('classifies a no-text (scanned/image) PDF as terminal', async () => {
    const parse: PdfTextParser = async () => ({ pages: ['   ', '\n\t'] });

    const error = await extractPdfText(bytes(10), parse).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ExtractionError);
    expect((error as ExtractionError).reason).toBe('no-text-content');
    expect((error as ExtractionError).retryable).toBe(false);
  });
});
