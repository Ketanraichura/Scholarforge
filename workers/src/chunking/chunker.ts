import { CHUNK_OVERLAP, CHUNK_SIZE, type ChunkMetadata } from '@scholarforge/shared';
import { PAGE_DELIMITER } from '../extraction/extractor.js';

/**
 * Recursive text chunker (Sprint 4).
 *
 * Produces overlapping, embedding-sized chunks while respecting natural text
 * boundaries. Pure and dependency-free so it is fully unit-testable.
 *
 * Strategy:
 *   1. Split the document into pages (page boundaries come from extraction,
 *      joined with {@link PAGE_DELIMITER}).
 *   2. Within each page, recursively split on the strongest available separator
 *      that yields pieces within the core budget: headings -> paragraphs ->
 *      lines -> sentences -> words -> hard character cut (backing off to
 *      whitespace so words are not split mid-token).
 *   3. Greedily pack pieces into a "core" of up to (chunkSize - overlap)
 *      characters.
 *   4. Prepend up to `overlap` characters carried from the previous chunk's
 *      tail so context is preserved across boundaries.
 *
 * With the default config this yields chunks of at most `chunkSize` (1000)
 * characters that overlap their predecessor by up to `overlap` (200) characters
 * — the widely-used convention where overlap is counted within the chunk size.
 *
 * Offsets (start_offset/end_offset) are page-relative indices into the page's
 * text and describe the chunk's core span (excluding carried-in overlap).
 *
 * @see Docs/03-architecture.md (Chunking -> Embeddings)
 */

export interface ChunkingConfig {
  chunkSize: number;
  overlap: number;
}

export const DEFAULT_CHUNKING_CONFIG: ChunkingConfig = {
  chunkSize: CHUNK_SIZE,
  overlap: CHUNK_OVERLAP,
};

export interface Chunk {
  content: string;
  metadata: ChunkMetadata;
}

/** Ordered separators, strongest (most semantic) first. */
const SEPARATORS: readonly string[] = [
  '\n## ', // markdown-style headings
  '\n# ',
  '\n\n', // paragraphs
  '\n', // lines
  '. ', // sentences
  '? ',
  '! ',
  '; ',
  ' ', // words
  '', // characters (hard cut)
];

/** A located text fragment within a page (offsets are page-relative). */
interface Fragment {
  text: string;
  start: number;
}

/**
 * Splits a document's full text (pages joined by {@link PAGE_DELIMITER}) into
 * metadata-rich chunks. Returns an empty array for empty/whitespace-only input.
 */
export function chunkDocument(
  documentId: string,
  fullText: string,
  config: ChunkingConfig = DEFAULT_CHUNKING_CONFIG,
): Chunk[] {
  const coreBudget = Math.max(1, config.chunkSize - config.overlap);
  const pages = fullText.split(PAGE_DELIMITER);
  const chunks: Chunk[] = [];
  let chunkIndex = 0;

  pages.forEach((pageText, pageZeroBased) => {
    const pageNumber = pageZeroBased + 1;
    if (pageText.trim().length === 0) {
      return; // skip blank pages entirely
    }

    const fragments = recursiveSplit(pageText, 0, coreBudget, 0);
    const packed = packFragments(fragments, coreBudget, config.overlap);

    for (const piece of packed) {
      chunks.push({
        content: piece.text,
        metadata: {
          document_id: documentId,
          page_number: pageNumber,
          chunk_index: chunkIndex,
          start_offset: piece.start,
          end_offset: piece.start + piece.coreLength,
        },
      });
      chunkIndex += 1;
    }
  });

  return chunks;
}

/**
 * Recursively splits `text` into fragments no larger than `maxSize`, trying
 * separators from `sepIndex` onward in priority order. Each recursion advances
 * to a strictly weaker separator, which guarantees progress and termination
 * (a piece can never re-split on the same separator that produced it).
 * Returns located fragments (page-relative start).
 */
function recursiveSplit(
  text: string,
  baseOffset: number,
  maxSize: number,
  sepIndex: number,
): Fragment[] {
  if (text.length <= maxSize) {
    return text.trim().length === 0 ? [] : [{ text, start: baseOffset }];
  }

  for (let i = sepIndex; i < SEPARATORS.length; i += 1) {
    const separator = SEPARATORS[i] ?? '';
    if (separator === '') {
      // Last resort: hard cut, backing off to whitespace to avoid mid-word cuts.
      return hardCut(text, baseOffset, maxSize);
    }
    if (!text.includes(separator)) {
      continue;
    }

    const pieces = splitKeepingSeparator(text, separator);
    if (pieces.length === 1) {
      continue;
    }

    const result: Fragment[] = [];
    let cursor = baseOffset;
    for (const piece of pieces) {
      if (piece.length === 0) {
        continue;
      }
      if (piece.length > maxSize) {
        // Recurse with the next (weaker) separator to guarantee progress.
        result.push(...recursiveSplit(piece, cursor, maxSize, i + 1));
      } else if (piece.trim().length > 0) {
        result.push({ text: piece, start: cursor });
      }
      cursor += piece.length;
    }
    return result;
  }

  return hardCut(text, baseOffset, maxSize);
}

/** Splits on a separator while keeping the separator attached to each piece. */
function splitKeepingSeparator(text: string, separator: string): string[] {
  const parts = text.split(separator);
  const pieces: string[] = [];
  for (let i = 0; i < parts.length; i += 1) {
    const isLast = i === parts.length - 1;
    pieces.push(isLast ? (parts[i] ?? '') : (parts[i] ?? '') + separator);
  }
  return pieces;
}

/** Hard-cuts oversized text into maxSize windows, preferring whitespace breaks. */
function hardCut(text: string, baseOffset: number, maxSize: number): Fragment[] {
  const fragments: Fragment[] = [];
  let index = 0;

  while (index < text.length) {
    let end = Math.min(index + maxSize, text.length);

    if (end < text.length) {
      const window = text.slice(index, end);
      const lastSpace = window.lastIndexOf(' ');
      if (lastSpace > 0) {
        end = index + lastSpace + 1;
      }
    }

    const slice = text.slice(index, end);
    if (slice.trim().length > 0) {
      fragments.push({ text: slice, start: baseOffset + index });
    }
    index = end;
  }

  return fragments;
}

interface PackedChunk {
  text: string;
  start: number;
  /** Length of the chunk's core span, excluding any carried-in overlap. */
  coreLength: number;
}

/**
 * Greedily packs fragments into a core of up to `coreBudget` characters, then
 * prepends up to `overlap` characters from the previous chunk's tail.
 */
function packFragments(fragments: Fragment[], coreBudget: number, overlap: number): PackedChunk[] {
  const chunks: PackedChunk[] = [];

  let buffer = '';
  let bufferStart = fragments[0]?.start ?? 0;

  const flush = (): void => {
    if (buffer.trim().length === 0) {
      buffer = '';
      return;
    }
    const overlapText = overlap > 0 ? tailOverlap(chunks, overlap) : '';
    chunks.push({
      text: overlapText + buffer,
      start: bufferStart,
      coreLength: buffer.length,
    });
    buffer = '';
  };

  for (const fragment of fragments) {
    if (buffer.length === 0) {
      bufferStart = fragment.start;
      buffer = fragment.text;
      continue;
    }

    if (buffer.length + fragment.text.length <= coreBudget) {
      buffer += fragment.text;
    } else {
      flush();
      bufferStart = fragment.start;
      buffer = fragment.text;
    }
  }
  flush();

  return chunks;
}

/** Returns up to `overlap` trailing characters of the previous chunk's core. */
function tailOverlap(chunks: PackedChunk[], overlap: number): string {
  const previous = chunks[chunks.length - 1];
  if (!previous) {
    return '';
  }
  const core = previous.text.slice(previous.text.length - previous.coreLength);
  return core.length <= overlap ? core : core.slice(core.length - overlap);
}
