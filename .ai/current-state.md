# ScholarForge AI — Current State

**Date:** Sprint 6B Complete
**Version:** 0.1.0

## Sprint Status

| Sprint | Name                | Status      |
| ------ | ------------------- | ----------- |
| 0      | Scaffold            | ✅ Complete |
| 1      | Authentication      | ✅ Complete |
| 2      | Upload Pipeline     | ✅ Complete |
| 3      | PDF Extraction      | ✅ Complete |
| 4      | Chunking            | ✅ Complete |
| 5      | Embeddings Pipeline | ✅ Complete |
| 6A     | Retrieval Backend   | ✅ Complete |
| 6B     | Search UI           | ✅ Complete |
| 7      | Chat                | Not started |
| 8      | Knowledge Graph     | Not started |

## What Exists

### Frontend

- Landing page, login, signup pages
- Protected dashboard with upload form + search
- Supabase auth (email/password) with middleware
- PDF upload with client-side validation → Supabase Storage
- Semantic search UI (search bar + results with similarity scores)
- TanStack Query integration
- Sentry monitoring (inert without DSN)
- shadcn-style UI components

### Workers

- Full extraction pipeline (pdf-parse adapter, retry with exponential backoff)
- Recursive text chunking (1000 chars, 200 overlap, page-aware)
- Embedding pipeline with provider abstraction
- Gemini provider (active, verified end-to-end)
- DeepSeek provider (implemented, API returns 404 — not verified)
- Configurable dimensions via env
- Retrieval module (query embedding + match_chunks RPC)

### Database

- 6 migrations applied (schema, upload, extraction, chunking, embedding dimensions, retrieval)
- Tables: users, documents, document_texts, chunks, chats, messages
- pgvector with ivfflat index for cosine similarity
- `match_chunks` RPC function for similarity search
- RLS policies on all tables

### Shared

- Zod schemas for DocumentStatus, ChunkMetadata, UploadResponse, ChatRequest
- Zod schemas for SearchRequest, SearchResult, SearchResponse
- Upload validation logic (20MB limit, PDF only)

## What's Working End-to-End

```
Upload PDF → Extract text → Chunk → Embed (Gemini 1024d) → Store vector
Query → Embed query → match_chunks RPC → Return ranked results
```

Verified with real execution:

- Real PDF uploaded to Supabase Storage
- Real extraction via pdf-parse (2 pages)
- Real chunks created (2 chunks per page)
- Real Gemini API call (`gemini-embedding-001`)
- Real 1024-dim vectors stored in pgvector
- Real cosine similarity query returns results

## What's Stubbed / Placeholder

- **Queue transport** — `DocumentQueue` is a no-op log. Real queue (BullMQ/Redis) not implemented.
- **JobRegistry** — in-memory handler map. Not connected to a real queue.
- **Chat** — not started (Sprint 7)
- **Knowledge Graph** — not started (Sprint 8)
- **Worker env validation** — no Zod schema (manual parsing in `env.ts`)

## Test Coverage

| Package          | Tests   | Pass   |
| ---------------- | ------- | ------ |
| backend (shared) | 18      | ✅     |
| frontend         | 26      | ✅     |
| workers          | 66      | ✅     |
| **Total**        | **110** | **✅** |

E2E tests (Playwright) exist but not run in CI audit.

## Infrastructure

- **Local:** Supabase CLI (Docker), `supabase start` on port 54321
- **Remote:** Supabase project `fkbdjwvjsolmrxnjscwj` (production, migrations not applied for 0005)
- **CI:** GitHub Actions, Node 22, 4 parallel jobs

## Known Issues

1. **Remote DB migration 0005 not applied** — remote Supabase still has `vector(1536)`. Local has `vector(1024)`.
2. **DeepSeek API returns 404** — embedding endpoint may have changed. Provider code is correct but unverified.
3. **Gemini returns 3072d by default** — must pass `outputDimensionality: 1024` to match DB column.

## Environment

```
EMBEDDING_PROVIDER=gemini
EMBEDDING_DIMENSIONS=1024
DEEPSEEK_API_KEY=sk-...
GEMINI_API_KEY=AQ...
NEXT_PUBLIC_SUPABASE_URL=https://fkbdjwvjsolmrxnjscwj.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```
