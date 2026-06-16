'use client';

import { UPLOAD_ERROR_MESSAGES, UploadResponseSchema, validateUpload } from '@scholarforge/shared';
import { useMutation } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

async function uploadFile(file: File): Promise<string> {
  // Pre-flight check so obviously-invalid files never hit the network.
  const validationError = validateUpload({
    filename: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
  });
  if (validationError) {
    throw new Error(UPLOAD_ERROR_MESSAGES[validationError]);
  }

  const body = new FormData();
  body.append('file', file);

  const response = await fetch('/api/upload', { method: 'POST', body });
  const json: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      json && typeof json === 'object' && 'error' in json
        ? String((json as { error: unknown }).error)
        : 'Upload failed. Please try again.';
    throw new Error(message);
  }

  return UploadResponseSchema.parse(json).documentId;
}

export function UploadForm() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedName, setSelectedName] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: uploadFile,
    onSuccess: () => {
      setSelectedName(null);
      if (inputRef.current) inputRef.current.value = '';
    },
  });

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = inputRef.current?.files?.[0];
    if (!file) return;
    mutation.mutate(file);
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Upload a document</CardTitle>
        <CardDescription>PDF only, up to 20 MB.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="file">PDF file</Label>
            <Input
              id="file"
              name="file"
              type="file"
              accept="application/pdf,.pdf"
              ref={inputRef}
              disabled={mutation.isPending}
              onChange={(event) => setSelectedName(event.target.files?.[0]?.name ?? null)}
            />
          </div>

          {mutation.isError ? (
            <p role="alert" className="text-sm text-red-600">
              {mutation.error.message}
            </p>
          ) : null}

          {mutation.isSuccess ? (
            <p role="status" className="text-sm text-green-600">
              Uploaded successfully.
            </p>
          ) : null}

          <Button type="submit" className="w-full" disabled={mutation.isPending || !selectedName}>
            {mutation.isPending ? 'Uploading…' : 'Upload'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
