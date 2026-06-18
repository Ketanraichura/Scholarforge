# Sprint 6: Retrieval — Complete

## 6A: Retrieval Backend ✅

### What Was Built

- Migration `0006_retrieval.sql` — `match_chunks` RPC function with `p_document_ids uuid[]`
- `SearchRequest`, `SearchResult`, `SearchResponse` Zod schemas in shared
- Retrieval orchestrator (`retrieve()`) with `RetrievalPorts` DI pattern
- Supabase retrieval ports (embed query + call RPC)
- 10 unit tests

### Files Created

| File                                           | Purpose                         |
| ---------------------------------------------- | ------------------------------- |
| `supabase/migrations/0006_retrieval.sql`       | match_chunks RPC function       |
| `workers/src/retrieval/retriever.ts`           | Retrieval orchestrator          |
| `workers/src/retrieval/supabase-ports.ts`      | Supabase-backed retrieval ports |
| `workers/src/retrieval/index.ts`               | Barrel export                   |
| `workers/src/retrieval/retriever.test.ts`      | 7 tests                         |
| `workers/src/retrieval/supabase-ports.test.ts` | 3 tests                         |

### Files Modified

| File                   | Change                                                    |
| ---------------------- | --------------------------------------------------------- |
| `backend/src/index.ts` | Added SearchRequest, SearchResult, SearchResponse schemas |

---

## 6B: Search UI ✅

### What Was Built

- `POST /api/search` route handler (embeds query via Gemini, calls match_chunks RPC)
- `SearchBar` component (input + submit, useMutation)
- `SearchResults` component (chunk content, page number, similarity score)
- `SearchSection` wrapper (loading, empty, error, results states)
- Dashboard integration (search below upload form)
- 6 component tests

### Files Created

| File                                                     | Purpose                   |
| -------------------------------------------------------- | ------------------------- |
| `frontend/src/app/api/search/route.ts`                   | POST /api/search endpoint |
| `frontend/src/components/search/search-bar.tsx`          | Search input component    |
| `frontend/src/components/search/search-results.tsx`      | Results display           |
| `frontend/src/components/search/search-section.tsx`      | Stateful wrapper          |
| `frontend/src/components/search/search-bar.test.tsx`     | 3 tests                   |
| `frontend/src/components/search/search-results.test.tsx` | 3 tests                   |

### Files Modified

| File                                  | Change              |
| ------------------------------------- | ------------------- |
| `frontend/src/app/dashboard/page.tsx` | Added SearchSection |

---

## Verification Results

| Check     | Result      |
| --------- | ----------- |
| Lint      | clean       |
| Typecheck | clean       |
| Tests     | 110 passing |
| Build     | clean       |
