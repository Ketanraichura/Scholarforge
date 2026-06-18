# ScholarForge AI — Next Sprint

## Sprint 6: Retrieval

### Goal

Enable semantic search over embedded document chunks. Users query, system returns ranked chunks by cosine similarity.

### Prerequisites (All Met)

- [x] PDFs uploaded and stored
- [x] Text extracted from PDFs
- [x] Text chunked into segments
- [x] Chunks embedded into vectors
- [x] Vectors stored in pgvector
- [x] ivfflat index for cosine similarity
- [x] `match_chunks` RPC function (created during Sprint 5 audit)

### Likely Tasks

1. **Search API endpoint** — `POST /api/search` or `GET /api/search?q=...&documentIds=...`
2. **Retrieval module** in workers or shared — query embedding generation + similarity search
3. **Embed the search query** using the same provider/dimensions as document chunks
4. **Call `match_chunks` RPC** with query vector, return ranked results
5. **Document-scoped search** — filter by `documentIds` parameter
6. **Cross-document search** — search across all user's documents
7. **Result formatting** — chunk content, metadata, similarity score, source citation
8. **Frontend search UI** — search input, results display
9. **Add `match_chunks` to migrations** — currently created ad-hoc, needs proper migration

### Architecture Considerations

- Query embedding must use the **same provider and dimensions** as document embedding
- Consider caching query embeddings for repeated queries
- Similarity threshold — filter out low-relevance results (e.g., distance > 0.5)
- Pagination for large result sets
- RLS enforcement — users can only search their own documents

### Database Changes

- Possibly no schema changes (existing `chunks` table has embedding + metadata)
- `match_chunks` RPC should be added to a migration file

### Testing Strategy

- Unit tests for retrieval logic (mock provider, mock ports)
- Integration test with real Supabase (local) and real embedding provider
- Verify cosine similarity ordering is correct

### Blockers / Notes

- DeepSeek embedding provider returns 404 — use Gemini for Sprint 6 verification
- Local Supabase has `vector(1024)` — ensure query embedding matches
- `match_chunks` function exists in local DB but not in migration files
