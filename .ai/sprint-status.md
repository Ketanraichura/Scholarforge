# ScholarForge AI — Sprint Status

## Completed Sprints

### Sprint 0: Scaffold ✅

- Monorepo setup (npm workspaces)
- TypeScript strict mode across all packages
- ESLint + Prettier + commitlint
- Husky pre-commit hooks
- CI pipeline (GitHub Actions)
- Supabase project and initial migration
- Vitest configured for all packages

### Sprint 1: Authentication ✅

- Supabase Auth (email/password)
- Login/signup pages with forms
- Auth middleware (route protection)
- Server actions for login/signup/logout
- Session refresh via Supabase SSR

### Sprint 2: Upload Pipeline ✅

- PDF upload form with client-side validation
- `POST /api/upload` route handler
- Supabase Storage (private bucket, user-scoped paths)
- Document record creation
- Queue stub (fire-and-forget logging)
- Signed URL generation for document access

### Sprint 3: PDF Extraction ✅

- `pdf-parse` v2 adapter
- Pure extraction function (`extractPdfText`)
- Orchestrator with `ProcessorPorts` DI
- Retry with exponential backoff (3 retries, 500ms base)
- Status transitions: `processing → extracted | failed`
- Error classification (empty, corrupt, no-text)

### Sprint 4: Chunking ✅

- Recursive text chunker (separators: headings → paragraphs → lines → sentences → words → hard cut)
- Page-aware splitting (respects `\f` page delimiters)
- Greedy packing with configurable overlap
- `ChunkingPorts` DI pattern
- Idempotent: delete + re-insert on re-processing
- Unique index on `(document_id, chunk_index)`

### Sprint 5: Embeddings Pipeline ✅

- `EmbeddingProvider` abstraction
- Gemini provider (`gemini-embedding-001`, `x-goog-api-key` header, `outputDimensionality`)
- DeepSeek provider (`deepseek-embedding`, OpenAI-compatible endpoint)
- `EmbeddingPorts` DI pattern
- Retry with exponential backoff (transient errors only)
- Configurable dimensions via `EMBEDDING_DIMENSIONS` env
- Idempotent: loads only chunks WHERE embedding IS NULL
- `match_chunks` RPC function for cosine similarity
- **Verified end-to-end with real Gemini API call**

### Sprint 6A: Retrieval Backend ✅

- `match_chunks` RPC function in migration `0006_retrieval.sql`
- RPC accepts `p_document_ids uuid[]` for scoped/cross-document search
- `SearchRequest`, `SearchResult`, `SearchResponse` Zod schemas in shared
- Retrieval orchestrator (`retrieve()`) with `RetrievalPorts` DI pattern
- Supabase retrieval ports (embed query + call RPC)
- 10 new unit tests (retriever + supabase-ports)

### Sprint 6B: Search UI ✅

- `POST /api/search` route handler (embeds query via Gemini, calls match_chunks RPC)
- `SearchBar` component (input + submit, useMutation)
- `SearchResults` component (chunk content, page number, similarity score)
- `SearchSection` wrapper (loading, empty, error, results states)
- Dashboard integration (search below upload form)
- 6 new component tests

### Sprint 7: Answer Generation ✅

- `LLMProvider` abstraction for text generation
- Gemini LLM provider (`gemini-2.0-flash`, `generateContent` API)
- Citation extractor (parse `[1][2]` markers → map to retrieved chunks)
- Stateless chat orchestrator: retrieve → prompt → generate → cite
- `POST /api/chat` route handler
- Chat UI (input, answer with inline citations, source cards)
- Dashboard integration (chat below search, shown when documents exist)
- `Citation`, `ChatResponse` Zod schemas in shared
- 21 new tests (LLM provider, citations, answer generator, chat components)

## Upcoming Sprints

### Sprint 8: Deployment (Not Started)

- Vercel deployment (frontend)
- Railway/Render deployment (workers)
- Production Supabase configuration
- Monitoring (Sentry) and analytics (PostHog)
