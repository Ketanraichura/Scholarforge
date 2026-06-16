import {
  UPLOAD_ERROR_MESSAGES,
  validateUpload,
  type UploadValidationError,
} from '@scholarforge/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

const STORAGE_BUCKET = 'documents';

/** A storage-layer or persistence failure during upload. */
export type UploadFailureReason = UploadValidationError | 'storage-failed' | 'persist-failed';

export class UploadError extends Error {
  readonly reason: UploadFailureReason;

  constructor(reason: UploadFailureReason, message?: string) {
    super(message ?? messageFor(reason));
    this.name = 'UploadError';
    this.reason = reason;
  }
}

function messageFor(reason: UploadFailureReason): string {
  if (reason === 'storage-failed') return 'Failed to store the file. Please try again.';
  if (reason === 'persist-failed') return 'Failed to save the document. Please try again.';
  return UPLOAD_ERROR_MESSAGES[reason];
}

export interface UploadDocumentParams {
  supabase: SupabaseClient;
  userId: string;
  file: File;
  /** Generates the document id; injectable for deterministic tests. */
  generateId?: () => string;
}

export interface UploadedDocument {
  documentId: string;
  storagePath: string;
}

/**
 * Validates, stores, and persists a single PDF upload for a user.
 *
 * - Authoritative validation of MIME type, extension, and size (never trusts the
 *   client; see Docs/08-security.md).
 * - Stores the object under "<userId>/<documentId>.pdf" in a private bucket so
 *   ownership is enforced both by the path layout and storage RLS.
 * - Persists a row in `public.documents` with status 'uploaded'.
 *
 * Throws {@link UploadError} with a stable reason on any failure.
 */
export async function uploadDocument({
  supabase,
  userId,
  file,
  generateId = () => crypto.randomUUID(),
}: UploadDocumentParams): Promise<UploadedDocument> {
  const validationError = validateUpload({
    filename: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
  });
  if (validationError) {
    throw new UploadError(validationError);
  }

  const documentId = generateId();
  const storagePath = `${userId}/${documentId}.pdf`;

  const { error: storageError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, file, {
      contentType: 'application/pdf',
      upsert: false,
    });

  if (storageError) {
    throw new UploadError('storage-failed', storageError.message);
  }

  const { error: insertError } = await supabase.from('documents').insert({
    id: documentId,
    user_id: userId,
    filename: file.name,
    storage_path: storagePath,
    status: 'uploaded',
  });

  if (insertError) {
    // Best-effort cleanup so a failed insert does not orphan the stored object.
    await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
    throw new UploadError('persist-failed', insertError.message);
  }

  return { documentId, storagePath };
}

/**
 * Creates a short-lived signed URL for an owned document. Ownership is verified
 * against `public.documents` (and enforced again by storage RLS) so users can
 * never read another user's files. Returns `null` if the document is not owned.
 */
export async function createSignedUrlForDocument(params: {
  supabase: SupabaseClient;
  userId: string;
  documentId: string;
  expiresInSeconds?: number;
}): Promise<string | null> {
  const { supabase, userId, documentId, expiresInSeconds = 60 } = params;

  const { data: document, error } = await supabase
    .from('documents')
    .select('storage_path, user_id')
    .eq('id', documentId)
    .single();

  if (error || !document || document.user_id !== userId) {
    return null;
  }

  const { data: signed, error: signError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(document.storage_path, expiresInSeconds);

  if (signError || !signed) {
    return null;
  }

  return signed.signedUrl;
}
