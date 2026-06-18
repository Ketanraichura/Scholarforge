import type { SearchResult } from '@scholarforge/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface SearchResultsProps {
  results: SearchResult[];
}

export function SearchResults({ results }: SearchResultsProps) {
  if (results.length === 0) {
    return <p className="text-sm text-neutral-500">No results found. Try a different query.</p>;
  }

  return (
    <div className="space-y-3">
      {results.map((result) => (
        <Card key={result.chunkId}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Page {result.pageNumber} —{' '}
              <span className="text-neutral-500">
                {(result.similarity * 100).toFixed(1)}% match
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-neutral-700 whitespace-pre-wrap">{result.content}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
