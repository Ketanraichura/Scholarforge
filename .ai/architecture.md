# ScholarForge AI — Architecture

## Overview

AI-native research workspace. Upload PDFs, extract text, chunk into segments, embed into vectors, retrieve semantically, chat with citations.

**Monorepo** — npm workspaces, Node >= 20.11.0, TypeScript strict.

## Packages

| Package                                | Purpose                                                                                                       |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `backend/` (`@scholarforge/shared`)    | Zod schemas, API contracts, validation. Single source of truth for types shared between frontend and workers. |
| `frontend/` (`@scholarforge/frontend`) | Next.js 15 App Router. Auth, upload, dashboard.                                                               |
| `workers/` (`@scholarforge/workers`)   | Background document processing pipeline.                                                                      |
| `supabase/`                            | SQL migrations, project config.                                                                               |

## Data Flow

```
User → Next.js → POST /api/upload → Storage + DB row
                                        ↓
                                    Queue (stub)
                                        ↓
                              Extraction (pdf-parse)
                                        ↓
                              Chunking (recursive splitter)
                                        ↓
                              Embedding (Gemini / DeepSeek)
                                        ↓
                                    pgvector
                                        ↓
                              Retrieval (Sprint 6)
                                        ↓
                                    LLM → Chat
```

## Worker Architecture

Workers use **Ports & Adapters** (hexagonal) pattern:

1. **Core logic is pure** — no side effects, fully unit-testable
2. **Orchestrators define Ports interfaces** — dependency injection boundary
3. **Concrete implementations in separate files** — `createSupabasePorts(client)`
4. **Tests inject fake ports** — `vi.fn()` mocks, no real Supabase/API calls

### Pipeline Stages

| Stage      | Input          | Output                                  | Status Transitions                 |
| ---------- | -------------- | --------------------------------------- | ---------------------------------- |
| Extraction | PDF bytes      | `ExtractedDocument { text, pageCount }` | `processing → extracted \| failed` |
| Chunking   | Extracted text | `Chunk[]` with metadata                 | `extracted → chunked \| failed`    |
| Embedding  | Chunk texts    | `number[][]` vectors                    | `chunked → ready \| failed`        |

### Key Interfaces

```
ProcessorPorts    — extraction (download, save text, update status)
ChunkingPorts     — chunking (load text, delete/save chunks, update status)
EmbeddingPorts    — embedding (load unembedded chunks, save vectors, update status)
EmbeddingProvider — { name, embed(texts, config) → { vectors, dimensions, model } }
```

### Error Handling

Custom error classes with typed `reason` discriminants:

- `ExtractionError` — `empty-pdf | corrupt-pdf | no-text-content`
- `ChunkingError` — `no-extracted-text | empty-document | chunking-failed`
- `EmbeddingError` — `no-chunks | no-text-to-embed | embedding-failed | storage-failed`

Expected failures mark documents `failed` and return result objects. Only unexpected programmer errors propagate.

## Database

Supabase Postgres with pgvector extension.

| Table            | Purpose                                         |
| ---------------- | ----------------------------------------------- |
| `users`          | App profiles (FK to auth.users)                 |
| `documents`      | Uploaded PDFs with status lifecycle             |
| `document_texts` | Extracted text per document                     |
| `chunks`         | Text chunks with metadata and embedding vectors |
| `chats`          | Chat sessions (Sprint 6)                        |
| `messages`       | Chat messages with citations (Sprint 6)         |

**Document status lifecycle:** `uploaded → processing → extracted → chunked → ready | failed`

**RLS:** Owner-scoped policies on all tables. Service role bypasses RLS for workers.

## Embedding Providers

| Provider | Model                  | Default Dims            | Auth                    | Batch Size |
| -------- | ---------------------- | ----------------------- | ----------------------- | ---------- |
| DeepSeek | `deepseek-embedding`   | 1024                    | Bearer token            | 64         |
| Gemini   | `gemini-embedding-001` | 768 (flexible 128-3072) | `x-goog-api-key` header | 100        |

Provider is selected via `EMBEDDING_PROVIDER` env var. Dimensions are configurable via `EMBEDDING_DIMENSIONS`.

## Testing Strategy

- **Unit tests** (Vitest) — all worker modules, pure functions, port-injected orchestrators
- **Component tests** (Vitest + Testing Library) — React components
- **E2E tests** (Playwright) — auth flow, route protection
- **Verification:** `npm run lint && npm run typecheck && npm run test && npm run build`

## CI/CD

GitHub Actions: 4 parallel jobs (lint, typecheck, test, build) on push/PR to main. Node 22.
