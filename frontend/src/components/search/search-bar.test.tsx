import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SearchBar } from './search-bar';

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

const noop = vi.fn();

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SearchBar', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('renders an input and a search button', () => {
    renderWithClient(<SearchBar onResults={noop} onLoading={noop} onError={noop} />);
    expect(screen.getByPlaceholderText(/search your documents/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument();
  });

  it('calls /api/search on form submit and passes results to onResults', async () => {
    const mockResponse = {
      results: [
        {
          chunkId: '00000000-0000-4000-8000-000000000001',
          documentId: '00000000-0000-4000-8000-000000000002',
          content: 'chunk text',
          metadata: {},
          similarity: 0.9,
          chunkIndex: 0,
          pageNumber: 1,
        },
      ],
      query: 'test query',
    };

    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const onResults = vi.fn();
    renderWithClient(<SearchBar onResults={onResults} onLoading={noop} onError={noop} />);

    const user = userEvent.setup();
    const input = screen.getByPlaceholderText(/search your documents/i);
    await user.type(input, 'test query');
    await user.click(screen.getByRole('button', { name: /search/i }));

    await waitFor(() => expect(onResults).toHaveBeenCalledWith(mockResponse));
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/search',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('calls onError when the API returns an error', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const onError = vi.fn();
    renderWithClient(<SearchBar onResults={noop} onLoading={noop} onError={onError} />);

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText(/search your documents/i), 'test');
    await user.click(screen.getByRole('button', { name: /search/i }));

    await waitFor(() => expect(onError).toHaveBeenCalledWith('Unauthorized'));
  });
});
