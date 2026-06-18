'use client';

import type { SearchResponse } from '@scholarforge/shared';
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SearchBar } from '@/components/search/search-bar';
import { SearchResults } from '@/components/search/search-results';

export function SearchSection() {
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Search</CardTitle>
        <CardDescription>Semantic search across your documents.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <SearchBar onResults={setResults} onLoading={setLoading} onError={setError} />

        {error ? (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        ) : null}

        {loading ? <p className="text-sm text-neutral-500">Searching…</p> : null}

        {!loading && results ? <SearchResults results={results.results} /> : null}

        {!loading && !results && !error ? (
          <p className="text-sm text-neutral-400">
            Enter a query to find relevant chunks from your documents.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
