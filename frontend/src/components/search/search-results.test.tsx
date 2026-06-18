import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { SearchResult } from '@scholarforge/shared';
import { SearchResults } from './search-results';

const sampleResults: SearchResult[] = [
  {
    chunkId: '00000000-0000-4000-8000-000000000001',
    documentId: '00000000-0000-4000-8000-000000000002',
    content: 'Machine learning is a subset of artificial intelligence.',
    metadata: {},
    similarity: 0.923,
    chunkIndex: 0,
    pageNumber: 1,
  },
  {
    chunkId: '00000000-0000-4000-8000-000000000003',
    documentId: '00000000-0000-4000-8000-000000000002',
    content: 'Deep learning uses neural networks with many layers.',
    metadata: {},
    similarity: 0.817,
    chunkIndex: 1,
    pageNumber: 2,
  },
];

describe('SearchResults', () => {
  it('shows empty state when results are empty', () => {
    render(<SearchResults results={[]} />);
    expect(screen.getByText(/no results found/i)).toBeInTheDocument();
  });

  it('renders result cards with content, page number, and similarity', () => {
    render(<SearchResults results={sampleResults} />);

    expect(screen.getByText(/machine learning is a subset/i)).toBeInTheDocument();
    expect(screen.getByText(/deep learning uses neural networks/i)).toBeInTheDocument();
    expect(screen.getByText(/page 1/i)).toBeInTheDocument();
    expect(screen.getByText(/page 2/i)).toBeInTheDocument();
    expect(screen.getByText(/92\.3% match/i)).toBeInTheDocument();
    expect(screen.getByText(/81\.7% match/i)).toBeInTheDocument();
  });

  it('renders correct number of cards', () => {
    const { container } = render(<SearchResults results={sampleResults} />);
    const cards = container.querySelectorAll('[class*="rounded-xl"]');
    expect(cards.length).toBeGreaterThanOrEqual(2);
  });
});
