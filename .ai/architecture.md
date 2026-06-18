# ScholarForge AI — Architecture

## Overview

AI-native research workspace. Upload PDFs, extract text, chunk into segments, embed into vectors, retrieve semantically, answer questions with citations.

**Monorepo** — npm workspaces, Node >= 20.11.0, TypeScript strict.

## Packages

| Package                                | Purpose                                                                                                       |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `backend/` (`@scholarforge/shared`)    | Zod schemas, API contracts, validation. Single source of truth for types shared between frontend and workers. |
| `frontend/` (`@scholarforge/frontend`) | Next.js 15 App Router. Auth, upload, dashboard, search, chat.                                                 |
| `workers/` (`@scholarforge/workers`)   | Background document processing pipeline + retrieval + chat modules.                                           |
| `supabase/`                            | SQL migrations, project config.                                                                               |

## Data Flow

```
Upload Pipeline:
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

Search Pipeline:
  Query → POST /api/search → Embed query → match_chunks RPC → Return ranked results

Chat Pipeline:
  Question → POST /api/chat → Retrieve chunks → Build prompt → Gemini generateContent → Answer + citations
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
RetrievalPorts    — retrieval (embedQuery, matchChunks)
LLMProvider       — { name, generate(messages, config) → { content, model } }
ChatPorts         — chat (retrieval ports + logger)
```

### Error Handling

Custom error classes with typed `reason` discriminants:

- `ExtractionError` — `empty-pdf | corrupt-pdf | no-text-content`
- `ChunkingError` — `no-extracted-text | empty-document | chunking-failed`
- `EmbeddingError` — `no-chunks | no-text-to-embed | embedding-failed | storage-failed`

Expected failures mark documents `failed` and return result objects. Only unexpected programmer errors propagate.

## Database

Supabase Postgres with pgvector extension.

| Table            | Purpose                                                       |
| ---------------- | ------------------------------------------------------------- |
| `users`          | App profiles (FK to auth.users)                               |
| `documents`      | Uploaded PDFs with status lifecycle                           |
| `document_texts` | Extracted text per document                                   |
| `chunks`         | Text chunks with metadata and embedding vectors               |
| `chats`          | Chat sessions (reserved for future multi-turn)                |
| `messages`       | Chat messages with citations (reserved for future multi-turn) |

**Document status lifecycle:** `uploaded → processing → extracted → chunked → ready | failed`

**RLS:** Owner-scoped policies on all tables. Service role bypasses RLS for workers.

## Providers

### Embedding Providers

| Provider | Model                  | Default Dims            | Auth                    | Batch Size |
| -------- | ---------------------- | ----------------------- | ----------------------- | ---------- |
| DeepSeek | `deepseek-embedding`   | 1024                    | Bearer token            | 64         |
| Gemini   | `gemini-embedding-001` | 768 (flexible 128-3072) | `x-goog-api-key` header | 100        |

### LLM Providers

| Provider | Model              | Auth                    |
| -------- | ------------------ | ----------------------- |
| Gemini   | `gemini-2.0-flash` | `x-goog-api-key` header |

## Testing Strategy

- **Unit tests** (Vitest) — all worker modules, pure functions, port-injected orchestrators
- **Component tests** (Vitest + Testing Library) — React components
- **E2E tests** (Playwright) — auth flow, route protection
- **Verification:** `npm run lint && npm run typecheck && npm run test && npm run build`

## CI/CD

GitHub Actions: 4 parallel jobs (lint, typecheck, test, build) on push/PR to main. Node 22.
