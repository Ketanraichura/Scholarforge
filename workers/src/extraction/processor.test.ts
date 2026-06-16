import type { DocumentStatus } from '@scholarforge/shared';
import { describe, expect, it, vi } from 'vitest';
import { PAGE_DELIMITER, type PdfTextParser } from './extractor.js';
import { processDocument, type ProcessorPorts } from './processor.js';

const DOC_ID = '00000000-0000-4000-8000-000000000000';
const silentLogger = { info: vi.fn(), error: vi.fn() };

interface HarnessOptions {
  parsePdf: PdfTextParser;
  pdfBytes?: Uint8Array;
}

/** Builds processor ports backed by in-memory fakes and records status transitions. */
function harness(opts: HarnessOptions) {
  const statuses: DocumentStatus[] = [];
  const saved: Array<{ documentId: string; text: string; pageCount: number }> = [];

  const ports: ProcessorPorts = {
    parsePdf: opts.parsePdf,
    logger: silentLogger,
    sleep: async () => {},
    downloadPdf: vi.fn(async () => opts.pdfBytes ?? new Uint8Array([1, 2, 3])),
    updateStatus: vi.fn(async (_documentId: string, status: DocumentStatus) => {
      statuses.push(status);
    }),
    saveExtractedText: vi.fn(async (input) => {
      saved.push(input);
    }),
  };

  return { ports, statuses, saved };
}

describe('processDocument', () => {
  it('upload -> extraction: transitions processing -> extracted and persists text', async () => {
    const parse: PdfTextParser = async () => ({ pages: ['Hello', 'World'] });
    const { ports, statuses, saved } = harness({ parsePdf: parse });

    const result = await processDocument(DOC_ID, ports);

    expect(statuses).toEqual(['processing', 'extracted']);
    expect(result).toEqual({ documentId: DOC_ID, status: 'extracted', pageCount: 2 });
    expect(saved).toHaveLength(1);
    expect(saved[0]?.text).toBe(`Hello${PAGE_DELIMITER}World`);
  });

  it('failed extraction (no-text PDF): transitions processing -> failed without retry', async () => {
    const parse: PdfTextParser = async () => ({ pages: ['  '] });
    const { ports, statuses, saved } = harness({ parsePdf: parse });

    const result = await processDocument(DOC_ID, ports);

    expect(statuses).toEqual(['processing', 'failed']);
    expect(result.status).toBe('failed');
    expect(result.reason).toBe('no-text-content');
    expect(saved).toHaveLength(0);
    // No-text is terminal: download happens once (no retries).
    expect(ports.downloadPdf).toHaveBeenCalledTimes(1);
  });

  it('empty PDF: transitions processing -> failed with empty-pdf reason', async () => {
    const parse: PdfTextParser = async () => ({ pages: ['x'] });
    const { ports, statuses } = harness({ parsePdf: parse, pdfBytes: new Uint8Array(0) });

    const result = await processDocument(DOC_ID, ports);

    expect(statuses).toEqual(['processing', 'failed']);
    expect(result.reason).toBe('empty-pdf');
  });

  it('retry behavior: retries corrupt PDFs then succeeds', async () => {
    let attempts = 0;
    const parse: PdfTextParser = async () => {
      attempts += 1;
      if (attempts < 3) throw new Error('corrupt stream');
      return { pages: ['Recovered text'] };
    };
    const { ports, statuses } = harness({ parsePdf: parse });

    const result = await processDocument(DOC_ID, ports);

    expect(result.status).toBe('extracted');
    expect(attempts).toBe(3);
    expect(ports.downloadPdf).toHaveBeenCalledTimes(3);
    expect(statuses).toEqual(['processing', 'extracted']);
  });

  it('retry behavior: gives up after max retries on persistent corruption', async () => {
    const parse: PdfTextParser = async () => {
      throw new Error('always corrupt');
    };
    const { ports, statuses } = harness({ parsePdf: parse });

    const result = await processDocument(DOC_ID, ports);

    expect(result.status).toBe('failed');
    expect(result.reason).toBe('corrupt-pdf');
    // 1 initial attempt + 3 retries = 4 downloads.
    expect(ports.downloadPdf).toHaveBeenCalledTimes(4);
    expect(statuses).toEqual(['processing', 'failed']);
  });

  it('logs failures with the document id', async () => {
    const error = vi.fn();
    const parse: PdfTextParser = async () => ({ pages: [''] });
    const { ports } = harness({ parsePdf: parse });
    ports.logger = { info: vi.fn(), error };

    await processDocument(DOC_ID, ports);

    expect(error).toHaveBeenCalledWith(expect.stringContaining(DOC_ID));
  });
});
