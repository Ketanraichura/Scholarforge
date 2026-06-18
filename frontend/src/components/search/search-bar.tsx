'use client';

import { SearchResponseSchema, type SearchResponse } from '@scholarforge/shared';
import { useMutation } from '@tanstack/react-query';
import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

async function searchQuery(query: string): Promise<SearchResponse> {
  const response = await fetch('/api/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });

  const json: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      json && typeof json === 'object' && 'error' in json
        ? String((json as { error: unknown }).error)
        : 'Search failed. Please try again.';
    throw new Error(message);
  }

  return SearchResponseSchema.parse(json);
}

interface SearchBarProps {
  onResults: (response: SearchResponse | null) => void;
  onLoading: (loading: boolean) => void;
  onError: (error: string | null) => void;
}

export function SearchBar({ onResults, onLoading, onError }: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const mutation = useMutation({
    mutationFn: searchQuery,
    onMutate: () => {
      onLoading(true);
      onError(null);
    },
    onSuccess: (data) => {
      onResults(data);
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
        type="search"
        placeholder="Search your documents…"
        className="flex-1"
        disabled={mutation.isPending}
      />
      <Button type="submit" variant="outline" disabled={mutation.isPending}>
        {mutation.isPending ? 'Searching…' : 'Search'}
      </Button>
    </form>
  );
}
