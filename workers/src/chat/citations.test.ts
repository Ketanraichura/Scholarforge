import { describe, expect, it } from 'vitest';
import { extractCitations } from './citations.js';
import type { SearchResult } from '@scholarforge/shared';

const DOC_ID = '00000000-0000-4000-8000-000000000002';

function fakeChunk(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    chunkId: '00000000-0000-4000-8000-000000000001',
    documentId: DOC_ID,
    content: 'sample content',
    metadata: {},
    similarity: 0.9,
    chunkIndex: 0,
    pageNumber: 1,
    ...overrides,
  };
}

describe('extractCitations', () => {
  it('extracts a single citation marker', () => {
    const chunks = [fakeChunk({ chunkId: 'c1', pageNumber: 3 })];
    const answer = 'The answer is 42 [1].';

    const citations = extractCitations(answer, chunks);

    expect(citations).toHaveLength(1);
    expect(citations[0]).toEqual({
      marker: 1,
      chunkId: 'c1',
      documentId: DOC_ID,
      pageNumber: 3,
      content: 'sample content',
    });
  });

  it('extracts multiple citation markers in order', () => {
    const chunks = [
      fakeChunk({ chunkId: 'c1', pageNumber: 1 }),
      fakeChunk({ chunkId: 'c2', pageNumber: 5 }),
      fakeChunk({ chunkId: 'c3', pageNumber: 9 }),
    ];
    const answer = 'First [3] then [1] and also [2].';

    const citations = extractCitations(answer, chunks);

    expect(citations).toHaveLength(3);
    expect(citations[0]!.marker).toBe(1);
    expect(citations[1]!.marker).toBe(2);
    expect(citations[2]!.marker).toBe(3);
  });

  it('deduplicates repeated markers', () => {
    const chunks = [fakeChunk({ chunkId: 'c1' })];
    const answer = 'As shown [1] in the text [1] above.';

    const citations = extractCitations(answer, chunks);

    expect(citations).toHaveLength(1);
  });

  it('ignores markers that exceed chunk count', () => {
    const chunks = [fakeChunk()];
    const answer = 'Reference [1] and [99].';

    const citations = extractCitations(answer, chunks);

    expect(citations).toHaveLength(1);
    expect(citations[0]!.marker).toBe(1);
  });

  it('returns empty array when no markers found', () => {
    const chunks = [fakeChunk()];
    const answer = 'No citations here.';

    const citations = extractCitations(answer, chunks);

    expect(citations).toEqual([]);
  });
});
