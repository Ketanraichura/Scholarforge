# ScholarForge AI — Decisions

## Architecture Decisions

### 1. Ports & Adapters (Hexagonal) Architecture

**Decision:** All worker modules use dependency-injected ports for side effects.
**Why:** Enables unit testing without real infrastructure. Each orchestrator defines a `*Ports` interface; concrete implementations are in separate `supabase-ports.ts` files.
**Trade-off:** More files and boilerplate, but testability is worth it.

### 2. Provider Abstraction for Embeddings

**Decision:** `EmbeddingProvider` interface with `embed(texts, config)` method.
**Why:** Future providers may have different APIs, batch sizes, dimensions. Swapping providers requires only implementing the interface.
**Evidence:** DeepSeek uses OpenAI-compatible batch endpoint. Gemini uses per-text parallel calls with `outputDimensionality`. Same interface, different implementations.

### 3. Configurable Embedding Dimensions

**Decision:** Dimensions are never hardcoded. Provider returns actual dimensions. `EMBEDDING_DIMENSIONS` env var controls `outputDimensionality`.
**Why:** Different providers return different vector sizes (DeepSeek: 1024, Gemini: 768 default / 3072 max). The DB column must match.
**Evidence:** Migration `0005` changed `vector(1536)` to `vector(1024)`. Gemini defaults to 3072d without `outputDimensionality`.

### 4. Idempotent Processing

**Decision:** All pipeline stages are idempotent. Re-processing a document produces the same result.
**Why:** Workers may retry or re-process documents. Duplicate chunks or embeddings would corrupt the database.
**Evidence:** Chunking deletes before inserting. Embedding loads only `WHERE embedding IS NULL`.

### 5. Error Classification with Typed Reasons

**Decision:** Custom error classes with `reason` discriminants (`ExtractionError`, `ChunkingError`, `EmbeddingError`).
**Why:** Different errors need different handling (retry vs. fail-fast). Typed reasons enable structured logging and status reporting.
**Trade-off:** More error classes, but clearer error handling logic.

### 6. No Real Queue Transport

**Decision:** `DocumentQueue` is a stub. `JobRegistry` is in-memory.
**Why:** Premature to add BullMQ/Redis before the pipeline is verified. Queue integration is Sprint 8 deployment work.
**Trade-off:** Pipeline can't be triggered by real uploads yet. Must run workers directly for testing.

### 7. Zod Schemas as Single Source of Truth

**Decision:** `@scholarforge/shared` defines all API contracts and types via Zod.
**Why:** Validates at every trust boundary. Browser and server share identical schemas.
**Trade-off:** Extra dependency (Zod), but type safety + runtime validation is worth it.

## Provider Decisions

### 8. Gemini as Primary Provider (Sprint 5)

**Decision:** Use Gemini (`gemini-embedding-001`) for Sprint 5 verification.
**Why:** DeepSeek embedding API returned HTTP 404 during audit. Gemini worked on first real API call.
**Action:** Set `EMBEDDING_PROVIDER=gemini` in root `.env`.

### 9. Gemini API Authentication via Header

**Decision:** Use `x-goog-api-key` header instead of `?key=` query parameter.
**Why:** Google's current documentation uses header-based auth. Query parameter auth may be deprecated.
**Source:** https://ai.google.dev/api/embeddings

### 10. Gemini Response Format

**Decision:** Parse `response.embedding.values` (singular `embedding`), not `response.embeddings[0].values`.
**Why:** The actual Gemini API response format uses singular `embedding`, not plural `embeddings`.
**Evidence:** Debugged during Sprint 5 audit. API returned `{ "embedding": { "values": [...] } }`.

## Testing Decisions

### 11. All Tests Use Port Injection

**Decision:** No test makes real API calls or connects to real databases.
**Why:** Tests must be fast, deterministic, and CI-friendly.
**Pattern:** Build fake ports with `vi.fn()` mocks, verify call sequences and arguments.

### 12. Env Tests Must Be Explicit

**Decision:** All env tests explicitly set `EMBEDDING_PROVIDER` to avoid `.env` file leakage.
**Why:** The worker's `env.ts` loads `.env` files from disk. Tests that don't set the provider inherit the `.env` value.
**Evidence:** Fixed during Sprint 5 — tests failed because root `.env` had `EMBEDDING_PROVIDER=gemini`.

## Database Decisions

### 13. Migration 0005: vector(1024)

**Decision:** Replace `vector(1536)` with `vector(1024)` for DeepSeek/Gemini compatibility.
**Why:** 1536 was a placeholder. Real providers return 1024 (DeepSeek) or configurable (Gemini).
**Note:** Destructive migration — drops and recreates the embedding column.

### 14. match_chunks RPC Function

**Decision:** Create `match_chunks(query_embedding, match_count, p_document_id)` for similarity search.
**Why:** PostgREST can't do cosine distance sorting efficiently. RPC function pushes computation to Postgres.
**Status:** Created ad-hoc during Sprint 5 audit. Not yet in migration files.
