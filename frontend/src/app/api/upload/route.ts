import { UploadResponseSchema, UPLOAD_ERROR_MESSAGES } from '@scholarforge/shared';
import { NextResponse, type NextRequest } from 'next/server';
import { defaultDocumentQueue } from '@/lib/documents/queue';
import { UploadError, uploadDocument } from '@/lib/documents/upload';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/upload
 *
 * Accepts a multipart form with a single `file` field (PDF, <= 20 MB). Requires
 * an authenticated session; stores the file in a private bucket and persists a
 * document row owned by the caller.
 *
 * @see Docs/05-api-contracts.md, Docs/08-security.md
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Expected multipart form data.' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing "file" field.' }, { status: 400 });
  }

  try {
    const { documentId } = await uploadDocument({ supabase, userId: user.id, file });

    // Enqueue extraction asynchronously; the upload response must not wait for
    // (or fail because of) downstream processing.
    await defaultDocumentQueue
      .enqueue({ kind: 'process-document', documentId })
      .catch((queueError: unknown) => {
        console.error(`[upload] failed to enqueue processing for ${documentId}`, queueError);
      });

    const body = UploadResponseSchema.parse({ documentId });
    return NextResponse.json(body, { status: 201 });
  } catch (error) {
    if (error instanceof UploadError) {
      // Validation failures are client errors (422); storage/persist are 502.
      const isValidation = error.reason in UPLOAD_ERROR_MESSAGES;
      return NextResponse.json(
        { error: error.message, reason: error.reason },
        { status: isValidation ? 422 : 502 },
      );
    }
    return NextResponse.json({ error: 'Unexpected error during upload.' }, { status: 500 });
  }
}
