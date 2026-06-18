import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Citation } from '@scholarforge/shared';
import { ChatAnswer } from './chat-answer';

const sampleCitations: Citation[] = [
  {
    marker: 1,
    chunkId: '00000000-0000-4000-8000-000000000001',
    documentId: '00000000-0000-4000-8000-000000000002',
    pageNumber: 3,
    content: 'Machine learning is a subset of artificial intelligence.',
  },
  {
    marker: 2,
    chunkId: '00000000-0000-4000-8000-000000000003',
    documentId: '00000000-0000-4000-8000-000000000002',
    pageNumber: 7,
    content: 'Deep learning uses neural networks.',
  },
];

describe('ChatAnswer', () => {
  it('renders the answer text', () => {
    render(<ChatAnswer answer="The answer is 42." citations={[]} />);
    expect(screen.getByText('The answer is 42.')).toBeInTheDocument();
  });

  it('renders citation sources when present', () => {
    render(<ChatAnswer answer="Answer [1][2]" citations={sampleCitations} />);
    expect(screen.getByText(/sources/i)).toBeInTheDocument();
    expect(screen.getByText(/\[1\] page 3/i)).toBeInTheDocument();
    expect(screen.getByText(/\[2\] page 7/i)).toBeInTheDocument();
    expect(screen.getByText(/machine learning is a subset/i)).toBeInTheDocument();
    expect(screen.getByText(/deep learning uses neural networks/i)).toBeInTheDocument();
  });

  it('does not render sources section when citations are empty', () => {
    const { container } = render(<ChatAnswer answer="No citations." citations={[]} />);
    expect(screen.getByText('No citations.')).toBeInTheDocument();
    expect(container.querySelector('h4')).not.toBeInTheDocument();
  });
});
