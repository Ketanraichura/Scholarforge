'use client';

import type { ChatResponse } from '@scholarforge/shared';
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChatInput } from '@/components/chat/chat-input';
import { ChatAnswer } from '@/components/chat/chat-answer';

interface ChatSectionProps {
  documentIds: string[];
}

export function ChatSection({ documentIds }: ChatSectionProps) {
  const [result, setResult] = useState<ChatResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ask a Question</CardTitle>
        <CardDescription>Get grounded answers from your documents.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ChatInput
          documentIds={documentIds}
          onResult={setResult}
          onLoading={setLoading}
          onError={setError}
        />

        {error ? (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        ) : null}

        {loading ? (
          <p className="text-sm text-neutral-500">Retrieving and generating answer…</p>
        ) : null}

        {!loading && result ? (
          <ChatAnswer answer={result.answer} citations={result.citations} />
        ) : null}

        {!loading && !result && !error ? (
          <p className="text-sm text-neutral-400">
            Ask a question to get an answer grounded in your uploaded documents.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
