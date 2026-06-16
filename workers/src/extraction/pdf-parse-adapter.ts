import { PDFParse } from 'pdf-parse';
import { PAGE_DELIMITER, type ParsedPdf, type PdfTextParser } from './extractor.js';

/**
 * Adapter over pdf-parse v2 ({@link https://github.com/mehmet-kozan/pdf-parse}).
 * Uses the named `PDFParse` class API and normalises the result to per-page
 * text. The result shape is read defensively so a parser upgrade cannot crash
 * the pipeline; when per-page data is unavailable we fall back to splitting the
 * combined text on the page delimiter.
 */
export const parsePdfWithPdfParse: PdfTextParser = async (data: Uint8Array): Promise<ParsedPdf> => {
  const parser = new PDFParse({ data });
  try {
    const result = await parser.getText();
    return { pages: toPages(result) };
  } finally {
    await parser.destroy();
  }
};

/** Extracts a `string[]` of page texts from pdf-parse's TextResult, defensively. */
function toPages(result: unknown): string[] {
  if (result && typeof result === 'object') {
    const record = result as Record<string, unknown>;

    const pages = record.pages;
    if (Array.isArray(pages)) {
      const texts = pages.map((page) => pageText(page)).filter((text) => text.length > 0);
      if (texts.length > 0) {
        return texts;
      }
    }

    if (typeof record.text === 'string') {
      return record.text.split(PAGE_DELIMITER);
    }
  }
  return [];
}

/** Reads the text of a single page entry, tolerating different shapes. */
function pageText(page: unknown): string {
  if (typeof page === 'string') {
    return page;
  }
  if (page && typeof page === 'object') {
    const text = (page as Record<string, unknown>).text;
    if (typeof text === 'string') {
      return text;
    }
  }
  return '';
}
