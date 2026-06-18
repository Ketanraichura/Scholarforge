import { ChatRequestSchema, ChatResponseSchema } from '@scholarforge/shared';
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const EMBEDDING_MODEL = 'gemini-embedding-001';
const LLM_MODEL = 'gemini-2.0-flash';

const SYSTEM_PROMPT = `You are a research assistant. Answer questions using ONLY the provided context.
Include citation markers like [1], [2] when referencing specific context passages.
If the context doesn't contain enough information, say so clearly.
Do not fabricate information not present in the context.`;

async function embedQuery(query: string): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');

  const dimensions = process.env.EMBEDDING_DIMENSIONS
    ? Number.parseInt(process.env.EMBEDDING_DIMENSIONS, 10)
    : undefined;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      model: `models/${EMBEDDING_MODEL}`,
      content: { parts: [{ text: query }] },
      outputDimensionality: dimensions,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Gemini embedding API error ${response.status}: ${body}`);
  }

  const data = (await response.json()) as { embedding: { values: number[] } };
  return data.embedding.values;
}

async function generateLLM(messages: Array<{ role: string; content: string }>): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');

  const model = process.env.LLM_MODEL ?? LLM_MODEL;
  const contents = messages.map((msg) => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content }],
  }));

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({ contents }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Gemini LLM API error ${response.status}: ${body}`);
  }

  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini returned empty response');
  return text;
}

function extractCitations(
  answer: string,
  chunks: Array<{ id: string; document_id: string; page_number: number; content: string }>,
): Array<{
  marker: number;
  chunkId: string;
  documentId: string;
  pageNumber: number;
  content: string;
}> {
  const markerRegex = /\[(\d+)\]/g;
  const seen = new Set<number>();
  const citations: Array<{
    marker: number;
    chunkId: string;
    documentId: string;
    pageNumber: number;
    content: string;
  }> = [];

  let match;
  while ((match = markerRegex.exec(answer)) !== null) {
    const marker = Number.parseInt(match[1]!, 10);
    if (seen.has(marker)) continue;
    seen.add(marker);

    const chunk = chunks[marker - 1];
    if (!chunk) continue;

    citations.push({
      marker,
      chunkId: chunk.id,
      documentId: chunk.document_id,
      pageNumber: chunk.page_number,
      content: chunk.content,
    });
  }

  return citations.sort((a, b) => a.marker - b.marker);
}

function buildUserPrompt(
  query: string,
  chunks: Array<{ content: string; page_number: number }>,
): string {
  const context = chunks
    .map((chunk, i) => `[${i + 1}] (Page ${chunk.page_number})\n${chunk.content}`)
    .join('\n\n');
  return `Context:\n${context}\n\nQuestion: ${query}`;
}

/**
 * POST /api/chat
 *
 * Stateless Q&A: retrieve → build prompt → generate → citations.
 * Requires an authenticated session.
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

  const parsed = ChatRequestSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues.map((i) => i.message).join(', ');
    return NextResponse.json({ error: message }, { status: 422 });
  }

  const { query, documentIds } = parsed.data;

  try {
    const embedding = await embedQuery(query);

    const { data: matches, error: rpcError } = await supabase.rpc('match_chunks', {
      query_embedding: embedding,
      match_count: 5,
      p_document_ids: documentIds,
    });

    if (rpcError) {
      return NextResponse.json({ error: rpcError.message }, { status: 502 });
    }

    const chunks = (matches ?? []) as Array<{
      id: string;
      document_id: string;
      content: string;
      metadata: Record<string, unknown>;
      chunk_index: number;
      page_number: number;
      similarity: number;
    }>;

    if (chunks.length === 0) {
      return NextResponse.json(
        ChatResponseSchema.parse({
          answer: 'No relevant documents found for your question.',
          citations: [],
        }),
      );
    }

    const userPrompt = buildUserPrompt(query, chunks);

    const answer = await generateLLM([
      { role: 'user', content: SYSTEM_PROMPT },
      {
        role: 'model',
        content:
          'I understand. I will answer based only on the provided context and include citation markers.',
      },
      { role: 'user', content: userPrompt },
    ]);

    const citations = extractCitations(answer, chunks);

    const response = ChatResponseSchema.parse({ answer, citations });
    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Chat failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
