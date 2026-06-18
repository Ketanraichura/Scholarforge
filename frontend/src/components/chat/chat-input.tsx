'use client';

import { ChatResponseSchema, type ChatResponse } from '@scholarforge/shared';
import { useMutation } from '@tanstack/react-query';
import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

async function askQuestion(query: string, documentIds: string[]): Promise<ChatResponse> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, documentIds }),
  });

  const json: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      json && typeof json === 'object' && 'error' in json
        ? String((json as { error: unknown }).error)
        : 'Chat failed. Please try again.';
    throw new Error(message);
  }

  return ChatResponseSchema.parse(json);
}

interface ChatInputProps {
  documentIds: string[];
  onResult: (response: ChatResponse | null) => void;
  onLoading: (loading: boolean) => void;
  onError: (error: string | null) => void;
}

export function ChatInput({ documentIds, onResult, onLoading, onError }: ChatInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const mutation = useMutation({
    mutationFn: (query: string) => askQuestion(query, documentIds),
    onMutate: () => {
      onLoading(true);
      onError(null);
    },
    onSuccess: (data) => {
      onResult(data);
      onLoading(false);
    },
    onError: (error) => {
      onError(error.message);
      onLoading(false);
    },
  });

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = inputRef.current?.value?.trim();
    if (!query) return;
    mutation.mutate(query);
  }

  return (
    <form onSubmit={onSubmit} className="flex gap-2">
      <Input
        ref={inputRef}
        type="text"
        placeholder="Ask a question about your documents…"
        className="flex-1"
        disabled={mutation.isPending}
      />
      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? 'Thinking…' : 'Ask'}
      </Button>
    </form>
  );
}
