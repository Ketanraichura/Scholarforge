import type { SearchResult } from '@scholarforge/shared';

/**
 * A citation extracted from an LLM response, mapped to a retrieved chunk.
 */
export interface Citation {
  marker: number;
  chunkId: string;
  documentId: string;
  pageNumber: number;
  content: string;
}

/**
 * Parses citation markers [1], [2], etc. from LLM output and maps them
 * to the corresponding retrieved chunks.
 *
 * Only markers that correspond to actual retrieved chunks are returned.
 * Markers are deduplicated and sorted by marker number.
 */
export function extractCitations(answer: string, chunks: SearchResult[]): Citation[] {
  const markerRegex = /\[(\d+)\]/g;
  const seen = new Set<number>();
  const citations: Citation[] = [];

  let match;
  while ((match = markerRegex.exec(answer)) !== null) {
    const marker = Number.parseInt(match[1]!, 10);
    if (seen.has(marker)) continue;
    seen.add(marker);

    const chunk = chunks[marker - 1];
    if (!chunk) continue;

    citations.push({
      marker,
      chunkId: chunk.chunkId,
      documentId: chunk.documentId,
      pageNumber: chunk.pageNumber,
      content: chunk.content,
    });
  }

  return citations.sort((a, b) => a.marker - b.marker);
}
