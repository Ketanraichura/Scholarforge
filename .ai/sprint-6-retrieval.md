# Sprint 6: Retrieval

## 6A: Retrieval Backend

### Goal

Enable semantic search backend. Query → embed → `match_chunks` RPC → return top K results.

### Scope

- Migration: `match_chunks` RPC function
- Shared schemas: SearchRequest/SearchResult/SearchResponse
- Retrieval module in workers (orchestrator + Supabase ports)
- Unit tests

### Out of Scope

- Frontend UI (Sprint 6B)
- Similarity threshold filtering — return top K, inspect quality first
- Caching query embeddings
- Chat/conversation (Sprint 7)

---

## Task Breakdown

### Phase 1: Database

**Task 1.1** — Create migration `0006_retrieval.sql`

- `match_chunks(query_embedding vector(1024), match_count int, p_document_ids uuid[])` RPC
- `p_document_ids` is nullable — `NULL` = cross-document search
- Returns `table(id, document_id, content, metadata, chunk_index, page_number, similarity)`
- Uses `<=>` cosine distance, orders ascending (most similar first)

### Phase 2: Shared Schemas

**Task 2.1** — Add search schemas to `backend/src/index.ts`

- `SearchRequestSchema` — `{ query: string, documentIds?: string[], limit?: number }`
- `SearchResultSchema` — `{ chunkId, documentId, content, metadata, similarity, chunkIndex, pageNumber }`
- `SearchResponseSchema` — `{ results: SearchResult[], query: string }`

### Phase 3: Retrieval Module (workers)

**Task 3.1** — Create `workers/src/retrieval/retriever.ts`

- `RetrievalPorts` interface: `embedQuery`, `matchChunks`
- `retrieve()` orchestrator: embed query → call RPC → format results

**Task 3.2** — Create `workers/src/retrieval/supabase-ports.ts`

- `createRetrievalPorts(supabase, provider, config)`
- `embedQuery`: single-text embed via provider
- `matchChunks`: Supabase RPC call

**Task 3.3** — Create `workers/src/retrieval/index.ts` barrel export

### Phase 4: Testing

**Task 4.1** — `workers/src/retrieval/retriever.test.ts` (7 tests)
**Task 4.2** — `workers/src/retrieval/supabase-ports.test.ts` (3 tests)

---

## Database Changes

| Change        | File                                     |
| ------------- | ---------------------------------------- |
| New migration | `supabase/migrations/0006_retrieval.sql` |

```sql
create or replace function public.match_chunks(
  query_embedding vector(1024),
  match_count int default 10,
  p_document_ids uuid[] default null
)
returns table (
  id uuid,
  document_id uuid,
  content text,
  metadata jsonb,
  chunk_index int,
  page_number int,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    c.id, c.document_id, c.content, c.metadata,
    c.chunk_index, c.page_number,
    1 - (c.embedding <=> query_embedding) as similarity
  from public.chunks c
  where c.embedding is not null
    and (p_document_ids is null or c.document_id = any(p_document_ids))
  order by c.embedding <=> query_embedding
  limit match_count;
end;
$$;
```

---

## API Changes

None in 6A. API route added in 6B.

---

## Files to Create/Modify

| Action | File                                           |
| ------ | ---------------------------------------------- |
| Create | `supabase/migrations/0006_retrieval.sql`       |
| Edit   | `backend/src/index.ts` — add Search\* schemas  |
| Create | `workers/src/retrieval/retriever.ts`           |
| Create | `workers/src/retrieval/supabase-ports.ts`      |
| Create | `workers/src/retrieval/index.ts`               |
| Create | `workers/src/retrieval/retriever.test.ts`      |
| Create | `workers/src/retrieval/supabase-ports.test.ts` |

**Total:** 7 files (5 new, 2 edits)

---

## Test Plan

| File                     | Tests | Strategy                                |
| ------------------------ | ----- | --------------------------------------- |
| `retriever.test.ts`      | 7     | Mock ports, verify embed → RPC → format |
| `supabase-ports.test.ts` | 3     | Mock provider + mock Supabase           |

---

## Execution Order

1. Migration + shared schemas
2. Retrieval module + barrel export
3. Tests
4. `npm run lint && npm run typecheck && npm run test && npm run build`

---

# Sprint 6B: Search UI (Not Started)

- `POST /api/search` route
- Search bar + results components
- Dashboard integration
