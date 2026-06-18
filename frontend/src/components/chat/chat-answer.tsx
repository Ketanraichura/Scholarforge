import type { Citation } from '@scholarforge/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ChatAnswerProps {
  answer: string;
  citations: Citation[];
}

export function ChatAnswer({ answer, citations }: ChatAnswerProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-neutral-700 whitespace-pre-wrap">{answer}</p>
        </CardContent>
      </Card>

      {citations.length > 0 ? (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-neutral-500">Sources</h4>
          <div className="space-y-2">
            {citations.map((cit) => (
              <Card key={cit.marker}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-medium text-neutral-500">
                    [{cit.marker}] Page {cit.pageNumber}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-neutral-600 line-clamp-3">{cit.content}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
