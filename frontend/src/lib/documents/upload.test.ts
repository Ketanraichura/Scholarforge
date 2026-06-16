import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UploadError, createSignedUrlForDocument, uploadDocument } from './upload';

/** Casts an in-memory fake to the SupabaseClient surface used by the code under test. */
const asClient = (fake: unknown): SupabaseClient => fake as unknown as SupabaseClient;

/** Minimal typed builder for a fake Supabase client used by these tests. */
interface FakeOptions {
  uploadError?: { message: string } | null;
  insertError?: { message: string } | null;
  removeSpy?: ReturnType<typeof vi.fn>;
}

function makeFile(name: string, type: string, size: number): File {
  const file = new File(['x'], name, { type });
  // Force a deterministic size without allocating real bytes.
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

function fakeSupabase(opts: FakeOptions = {}) {
  const upload = vi.fn(async () => ({ error: opts.uploadError ?? null }));
  const remove = opts.removeSpy ?? vi.fn(async () => ({ error: null }));
  const insert = vi.fn(async () => ({ error: opts.insertError ?? null }));

  return {
    storage: {
      from: vi.fn(() => ({ upload, remove })),
    },
    from: vi.fn(() => ({ insert })),
    // Exposed for assertions.
    _upload: upload,
    _remove: remove,
    _insert: insert,
  };
}

const USER_ID = 'user-123';
const DOC_ID = '00000000-0000-4000-8000-000000000000';
const generateId = () => DOC_ID;

afterEach(() => {
  vi.restoreAllMocks();
});

describe('uploadDocument', () => {
  it('uploads a valid PDF and persists metadata under the owner path', async () => {
    const supabase = fakeSupabase();
    const file = makeFile('paper.pdf', 'application/pdf', 1024);

    const result = await uploadDocument({
      supabase: asClient(supabase),
      userId: USER_ID,
      file,
      generateId,
    });

    expect(result).toEqual({ documentId: DOC_ID, storagePath: `${USER_ID}/${DOC_ID}.pdf` });
    expect(supabase._upload).toHaveBeenCalledWith(
      `${USER_ID}/${DOC_ID}.pdf`,
      file,
      expect.objectContaining({ contentType: 'application/pdf', upsert: false }),
    );
    expect(supabase._insert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: DOC_ID,
        user_id: USER_ID,
        filename: 'paper.pdf',
        storage_path: `${USER_ID}/${DOC_ID}.pdf`,
        status: 'uploaded',
      }),
    );
  });

  it('rejects an oversized file before any storage call', async () => {
    const supabase = fakeSupabase();
    const file = makeFile('big.pdf', 'application/pdf', 21 * 1024 * 1024);

    await expect(
      uploadDocument({ supabase: asClient(supabase), userId: USER_ID, file, generateId }),
    ).rejects.toMatchObject({ reason: 'file-too-large' });
    expect(supabase._upload).not.toHaveBeenCalled();
  });

  it('rejects an invalid (non-PDF) file by mime type', async () => {
    const supabase = fakeSupabase();
    const file = makeFile('fake.pdf', 'image/png', 1024);

    await expect(
      uploadDocument({ supabase: asClient(supabase), userId: USER_ID, file, generateId }),
    ).rejects.toMatchObject({ reason: 'invalid-mime-type' });
  });

  it('rejects a non-pdf extension', async () => {
    const supabase = fakeSupabase();
    const file = makeFile('script.exe', 'application/pdf', 1024);

    await expect(
      uploadDocument({ supabase: asClient(supabase), userId: USER_ID, file, generateId }),
    ).rejects.toMatchObject({ reason: 'invalid-extension' });
  });

  it('surfaces a storage failure as UploadError', async () => {
    const supabase = fakeSupabase({ uploadError: { message: 'bucket unavailable' } });
    const file = makeFile('paper.pdf', 'application/pdf', 1024);

    await expect(
      uploadDocument({ supabase: asClient(supabase), userId: USER_ID, file, generateId }),
    ).rejects.toMatchObject({ reason: 'storage-failed' });
    expect(supabase._insert).not.toHaveBeenCalled();
  });

  it('treats a duplicate upload (upsert:false conflict) as a storage failure', async () => {
    // Supabase returns an error when an object already exists and upsert is false.
    const supabase = fakeSupabase({ uploadError: { message: 'The resource already exists' } });
    const file = makeFile('paper.pdf', 'application/pdf', 1024);

    await expect(
      uploadDocument({ supabase: asClient(supabase), userId: USER_ID, file, generateId }),
    ).rejects.toBeInstanceOf(UploadError);
  });

  it('cleans up the stored object when metadata persistence fails', async () => {
    const removeSpy = vi.fn(async () => ({ error: null }));
    const supabase = fakeSupabase({ insertError: { message: 'insert failed' }, removeSpy });
    const file = makeFile('paper.pdf', 'application/pdf', 1024);

    await expect(
      uploadDocument({ supabase: asClient(supabase), userId: USER_ID, file, generateId }),
    ).rejects.toMatchObject({ reason: 'persist-failed' });
    expect(removeSpy).toHaveBeenCalledWith([`${USER_ID}/${DOC_ID}.pdf`]);
  });
});

describe('createSignedUrlForDocument', () => {
  function signingClient(params: {
    document: { storage_path: string; user_id: string } | null;
    selectError?: { message: string } | null;
    signedUrl?: string | null;
    signError?: { message: string } | null;
  }) {
    const createSignedUrl = vi.fn(async () => ({
      data:
        params.signedUrl === undefined
          ? { signedUrl: 'https://signed.example/doc' }
          : params.signedUrl
            ? { signedUrl: params.signedUrl }
            : null,
      error: params.signError ?? null,
    }));
    return {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(async () => ({
              data: params.document,
              error: params.selectError ?? null,
            })),
          })),
        })),
      })),
      storage: { from: vi.fn(() => ({ createSignedUrl })) },
      _createSignedUrl: createSignedUrl,
    };
  }

  it('returns a signed URL for an owned document', async () => {
    const supabase = signingClient({
      document: { storage_path: `${USER_ID}/${DOC_ID}.pdf`, user_id: USER_ID },
      signedUrl: 'https://signed.example/doc',
    });

    const url = await createSignedUrlForDocument({
      supabase: asClient(supabase),
      userId: USER_ID,
      documentId: DOC_ID,
    });

    expect(url).toBe('https://signed.example/doc');
    expect(supabase._createSignedUrl).toHaveBeenCalledWith(`${USER_ID}/${DOC_ID}.pdf`, 60);
  });

  it('returns null for a document owned by another user', async () => {
    const supabase = signingClient({
      document: { storage_path: `other/${DOC_ID}.pdf`, user_id: 'someone-else' },
    });

    const url = await createSignedUrlForDocument({
      supabase: asClient(supabase),
      userId: USER_ID,
      documentId: DOC_ID,
    });

    expect(url).toBeNull();
    expect(supabase._createSignedUrl).not.toHaveBeenCalled();
  });

  it('returns null when the document does not exist', async () => {
    const supabase = signingClient({ document: null, selectError: { message: 'not found' } });

    const url = await createSignedUrlForDocument({
      supabase: asClient(supabase),
      userId: USER_ID,
      documentId: DOC_ID,
    });

    expect(url).toBeNull();
  });
});
