import { describe, expect, it } from 'vitest';
import {
  ChatRequestSchema,
  DocumentStatusSchema,
  MAX_UPLOAD_BYTES,
  UploadResponseSchema,
  validateUpload,
} from './index.js';

const UUID = '00000000-0000-4000-8000-000000000000';

describe('UploadResponseSchema', () => {
  it('accepts a valid uuid documentId', () => {
    const parsed = UploadResponseSchema.parse({ documentId: UUID });
    expect(parsed.documentId).toBe(UUID);
  });

  it('rejects a non-uuid documentId', () => {
    expect(() => UploadResponseSchema.parse({ documentId: 'not-a-uuid' })).toThrow();
  });
});

describe('ChatRequestSchema', () => {
  it('accepts a valid query with documentIds', () => {
    const parsed = ChatRequestSchema.parse({ query: 'What is attention?', documentIds: [UUID] });
    expect(parsed.documentIds).toHaveLength(1);
  });

  it('rejects an empty query', () => {
    expect(() => ChatRequestSchema.parse({ query: '', documentIds: [UUID] })).toThrow();
  });

  it('rejects an empty documentIds array', () => {
    expect(() => ChatRequestSchema.parse({ query: 'hi', documentIds: [] })).toThrow();
  });
});

describe('DocumentStatusSchema', () => {
  it('accepts known statuses', () => {
    expect(DocumentStatusSchema.parse('uploaded')).toBe('uploaded');
    expect(DocumentStatusSchema.parse('ready')).toBe('ready');
  });

  it('rejects unknown statuses', () => {
    expect(() => DocumentStatusSchema.parse('archived')).toThrow();
  });
});

describe('validateUpload', () => {
  const valid = {
    filename: 'paper.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 1024,
  };

  it('accepts a valid PDF under the size limit', () => {
    expect(validateUpload(valid)).toBeNull();
  });

  it('accepts an uppercase extension', () => {
    expect(validateUpload({ ...valid, filename: 'PAPER.PDF' })).toBeNull();
  });

  it('rejects an empty file', () => {
    expect(validateUpload({ ...valid, sizeBytes: 0 })).toBe('empty-file');
  });

  it('rejects an oversized file', () => {
    expect(validateUpload({ ...valid, sizeBytes: MAX_UPLOAD_BYTES + 1 })).toBe('file-too-large');
  });

  it('accepts a file exactly at the size limit', () => {
    expect(validateUpload({ ...valid, sizeBytes: MAX_UPLOAD_BYTES })).toBeNull();
  });

  it('rejects a non-PDF mime type', () => {
    expect(validateUpload({ ...valid, mimeType: 'image/png' })).toBe('invalid-mime-type');
  });

  it('rejects a non-pdf extension even with a pdf mime type', () => {
    expect(validateUpload({ ...valid, filename: 'paper.exe' })).toBe('invalid-extension');
  });
});
