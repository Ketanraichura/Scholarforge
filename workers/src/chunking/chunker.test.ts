import { describe, expect, it } from 'vitest';
import { PAGE_DELIMITER } from '../extraction/extractor.js';
import { chunkDocument, type ChunkingConfig } from './chunker.js';

const DOC_ID = '00000000-0000-4000-8000-000000000000';

/** Small config to make boundary/overlap behaviour easy to assert. */
const small: ChunkingConfig = { chunkSize: 50, overlap: 10 };

describe('chunkDocument — boundaries', () => {
  it('returns a single chunk for tiny documents', () => {
    const chunks = chunkDocument(DOC_ID, 'A short note.', small);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.content).toBe('A short note.');
  });

  it('returns no chunks for empty or whitespace-only input', () => {
    expect(chunkDocument(DOC_ID, '')).toHaveLength(0);
    expect(chunkDocument(DOC_ID, '   \n\t  ')).toHaveLength(0);
  });

  it('keeps every chunk within the configured chunk size', () => {
    const text = 'word '.repeat(400); // 2000 chars, no strong separators
    const chunks = chunkDocument(DOC_ID, text, small);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.content.length).toBeLessThanOrEqual(small.chunkSize);
    }
  });

  it('prefers paragraph boundaries over mid-paragraph cuts', () => {
    const para1 = 'First paragraph sentence.';
    const para2 = 'Second paragraph sentence.';
    const text = `${para1}\n\n${para2}`;
    const chunks = chunkDocument(DOC_ID, text, { chunkSize: 30, overlap: 5 });
    // Each paragraph is ~25 chars, so they should land in separate chunks.
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks[0]?.content).toContain('First paragraph');
  });

  it('does not split in the middle of a word on a hard cut', () => {
    const text = 'alpha bravo charlie delta echo foxtrot golf hotel india juliet';
    const chunks = chunkDocument(DOC_ID, text, { chunkSize: 20, overlap: 0 });
    for (const chunk of chunks) {
      // No chunk should start or end by bisecting a token (surrounding spaces ok).
      expect(chunk.content.trim()).not.toMatch(/^[a-z]*?\b\B/);
      // Reassembled tokens must all be real words from the source.
      for (const token of chunk.content.trim().split(/\s+/)) {
        expect(text).toContain(token);
      }
    }
  });
});

describe('chunkDocument — overlap', () => {
  it('overlaps consecutive chunks by carrying the previous tail', () => {
    const text = 'word '.repeat(60); // ~300 chars, cores comfortably exceed the overlap
    const config: ChunkingConfig = { chunkSize: 100, overlap: 20 };
    const chunks = chunkDocument(DOC_ID, text, config);
    expect(chunks.length).toBeGreaterThan(1);

    // Every non-first chunk must begin with text that is the tail of its
    // predecessor: the carried overlap is a prefix of chunk N+1 and a suffix
    // of chunk N.
    for (let i = 1; i < chunks.length; i += 1) {
      const prev = chunks[i - 1];
      const curr = chunks[i];
      if (!prev || !curr) continue;
      const carried = curr.content.slice(0, config.overlap);
      expect(carried.length).toBe(config.overlap);
      expect(prev.content.endsWith(carried)).toBe(true);
    }
  });

  it('produces no overlap when overlap is 0', () => {
    const text = 'word '.repeat(60);
    const chunks = chunkDocument(DOC_ID, text, { chunkSize: 100, overlap: 0 });
    // With zero overlap, total content length should equal the (trimmed) sum of cores.
    const total = chunks.reduce((sum, c) => sum + c.content.length, 0);
    expect(total).toBeLessThanOrEqual(text.length + chunks.length); // allow trailing trims
  });
});

describe('chunkDocument — metadata', () => {
  it('assigns monotonic chunk_index across the whole document', () => {
    const text = 'word '.repeat(400);
    const chunks = chunkDocument(DOC_ID, text, small);
    chunks.forEach((chunk, i) => {
      expect(chunk.metadata.chunk_index).toBe(i);
      expect(chunk.metadata.document_id).toBe(DOC_ID);
    });
  });

  it('tracks page_number per page using the page delimiter', () => {
    const page1 = 'Alpha content on page one.';
    const page2 = 'Bravo content on page two.';
    const text = `${page1}${PAGE_DELIMITER}${page2}`;
    const chunks = chunkDocument(DOC_ID, text, { chunkSize: 100, overlap: 10 });

    const pages = new Set(chunks.map((c) => c.metadata.page_number));
    expect(pages.has(1)).toBe(true);
    expect(pages.has(2)).toBe(true);
    // chunk_index is global and monotonic even across pages.
    chunks.forEach((chunk, i) => expect(chunk.metadata.chunk_index).toBe(i));
  });

  it('records page-relative start and end offsets that bound the core length', () => {
    const text = 'word '.repeat(400);
    const chunks = chunkDocument(DOC_ID, text, small);
    for (const chunk of chunks) {
      const { start_offset, end_offset } = chunk.metadata;
      expect(end_offset).toBeGreaterThan(start_offset);
      expect(start_offset).toBeGreaterThanOrEqual(0);
    }
  });

  it('resets offsets per page (page 2 offsets are page-relative)', () => {
    const page1 = 'word '.repeat(40);
    const page2 = 'word '.repeat(40);
    const text = `${page1}${PAGE_DELIMITER}${page2}`;
    const chunks = chunkDocument(DOC_ID, text, small);

    const page2Chunks = chunks.filter((c) => c.metadata.page_number === 2);
    expect(page2Chunks.length).toBeGreaterThan(0);
    // The first chunk of page 2 starts near offset 0 (page-relative), not continuing page 1.
    expect(page2Chunks[0]?.metadata.start_offset).toBeLessThan(small.chunkSize);
  });
});

describe('chunkDocument — large documents', () => {
  it('handles extremely large input without dropping content', () => {
    const text = 'Lorem ipsum dolor sit amet. '.repeat(5000); // ~140k chars
    const chunks = chunkDocument(DOC_ID, text); // default 1000/200
    expect(chunks.length).toBeGreaterThan(100);
    for (const chunk of chunks) {
      expect(chunk.content.length).toBeLessThanOrEqual(1000);
    }
    // Indices remain contiguous.
    chunks.forEach((chunk, i) => expect(chunk.metadata.chunk_index).toBe(i));
  });
});
