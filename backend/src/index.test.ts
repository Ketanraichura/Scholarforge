import { describe, expect, it } from 'vitest';
import { ChatRequestSchema, DocumentStatusSchema, UploadResponseSchema } from './index.js';

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
