import { describe, expect, it } from 'vitest';
import { JobRegistry, type ProcessDocumentPayload } from './index.js';

describe('JobRegistry', () => {
  it('dispatches a registered handler and validates its status', async () => {
    const registry = new JobRegistry();
    registry.register<ProcessDocumentPayload>('process-document', async () => 'processing');

    const status = await registry.dispatch({
      kind: 'process-document',
      payload: { documentId: '00000000-0000-4000-8000-000000000000' },
    });

    expect(status).toBe('processing');
  });

  it('throws when no handler is registered for a job kind', async () => {
    const registry = new JobRegistry();
    await expect(
      registry.dispatch({ kind: 'process-document', payload: { documentId: 'x' } }),
    ).rejects.toThrow(/No handler registered/);
  });
});
