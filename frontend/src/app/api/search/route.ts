import { SearchRequestSchema, SearchResponseSchema } from '@scholarforge/shared';
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const GEMINI_MODEL = 'gemini-embedding-001';

async function embedQuery(query: string): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');

  const dimensions = process.env.EMBEDDING_DIMENSIONS
    ? Number.parseInt(process.env.EMBEDDING_DIMENSIONS, 10)
    : undefined;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:embedContent`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      model: `models/${GEMINI_MODEL}`,
      content: { parts: [{ text: query }] },
      outputDimensionality: dimensions,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Gemini embedding API error ${response.status}: ${body}`);
  }

  const data = (await response.json()) as {
    embedding: { values: number[] };
  };

  return data.embedding.values;
}

/**
 * POST /api/search
 *
 * Embeds a query, finds the most similar chunks via cosine distance, and
 * returns ranked results. Requires an authenticated session.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const parsed = SearchRequestSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues.map((i) => i.message).join(', ');
    return NextResponse.json({ error: message }, { status: 422 });
  }

  const { query, documentIds, limit } = parsed.data;

  try {
    const embedding = await embedQuery(query);

    const { data: matches, error: rpcError } = await supabase.rpc('match_chunks', {
      query_embedding: embedding,
      match_count: limit,
      p_document_ids: documentIds ?? null,
    });

    if (rpcError) {
      return NextResponse.json({ error: rpcError.message }, { status: 502 });
    }

    const results = (matches ?? []).map(
      (row: {
        id: string;
        document_id: string;
        content: string;
        metadata: Record<string, unknown>;
        chunk_index: number;
        page_number: number;
        similarity: number;
      }) => ({
        chunkId: row.id,
        documentId: row.document_id,
        content: row.content,
        metadata: row.metadata,
        similarity: row.similarity,
        chunkIndex: row.chunk_index,
        pageNumber: row.page_number,
      }),
    );

    const body = SearchResponseSchema.parse({ results, query });
    return NextResponse.json(body);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Search failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
