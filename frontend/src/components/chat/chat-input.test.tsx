import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatInput } from './chat-input';

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

const DOC_IDS = ['00000000-0000-4000-8000-000000000000'];
const noop = vi.fn();

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ChatInput', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('renders an input and an ask button', () => {
    renderWithClient(
      <ChatInput documentIds={DOC_IDS} onResult={noop} onLoading={noop} onError={noop} />,
    );
    expect(screen.getByPlaceholderText(/ask a question/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ask/i })).toBeInTheDocument();
  });

  it('calls /api/chat on form submit and passes result to onResult', async () => {
    const mockResponse = {
      answer: 'The answer is 42 [1].',
      citations: [
        {
          marker: 1,
          chunkId: '00000000-0000-4000-8000-000000000001',
          documentId: '00000000-0000-4000-8000-000000000000',
          pageNumber: 1,
          content: 'The answer to everything.',
        },
      ],
    };

    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const onResult = vi.fn();
    renderWithClient(
      <ChatInput documentIds={DOC_IDS} onResult={onResult} onLoading={noop} onError={noop} />,
    );

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText(/ask a question/i), 'What is 42?');
    await user.click(screen.getByRole('button', { name: /ask/i }));

    await waitFor(() => expect(onResult).toHaveBeenCalledWith(mockResponse));
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/chat',
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
    renderWithClient(
      <ChatInput documentIds={DOC_IDS} onResult={noop} onLoading={noop} onError={onError} />,
    );

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText(/ask a question/i), 'test');
    await user.click(screen.getByRole('button', { name: /ask/i }));

    await waitFor(() => expect(onError).toHaveBeenCalledWith('Unauthorized'));
  });
});
