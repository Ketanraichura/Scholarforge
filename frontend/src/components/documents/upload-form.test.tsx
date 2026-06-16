import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UploadForm } from './upload-form';

function renderWithClient() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <UploadForm />
    </QueryClientProvider>,
  );
}

function pdf(name = 'paper.pdf', size = 1024): File {
  const file = new File(['x'], name, { type: 'application/pdf' });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('UploadForm', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('disables the submit button until a file is selected', () => {
    renderWithClient();
    expect(screen.getByRole('button', { name: /upload/i })).toBeDisabled();
  });

  it('uploads a valid PDF and shows a success message', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ documentId: '00000000-0000-4000-8000-000000000000' }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        }),
    );
    vi.stubGlobal('fetch', fetchMock);

    renderWithClient();
    const user = userEvent.setup();

    await user.upload(screen.getByLabelText(/pdf file/i), pdf());
    await user.click(screen.getByRole('button', { name: /upload/i }));

    expect(await screen.findByRole('status')).toHaveTextContent(/uploaded successfully/i);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/upload',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('shows a validation error without calling the API for a non-PDF', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    renderWithClient();
    const user = userEvent.setup();

    const png = new File(['x'], 'image.png', { type: 'image/png' });
    Object.defineProperty(png, 'size', { value: 1024 });

    // fireEvent bypasses the picker's accept filter, simulating a client that
    // submits a non-PDF — exactly the case the component's validation must catch.
    const input = screen.getByLabelText(/pdf file/i);
    fireEvent.change(input, { target: { files: [png] } });
    await user.click(screen.getByRole('button', { name: /upload/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/only pdf files are allowed/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('surfaces a server error (e.g. unauthorized) as an alert', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }),
    );
    vi.stubGlobal('fetch', fetchMock);

    renderWithClient();
    const user = userEvent.setup();

    await user.upload(screen.getByLabelText(/pdf file/i), pdf());
    await user.click(screen.getByRole('button', { name: /upload/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/unauthorized/i));
  });
});
