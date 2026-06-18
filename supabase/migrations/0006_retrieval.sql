-- ScholarForge AI — retrieval (Sprint 6A)
-- Migration: 0006_retrieval
--
-- Adds the match_chunks RPC function for semantic similarity search.
-- Accepts a query embedding and optional document ID filter, returns
-- the top K most similar chunks ordered by cosine distance.

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
    c.id,
    c.document_id,
    c.content,
    c.metadata,
    c.chunk_index,
    c.page_number,
    1 - (c.embedding <=> query_embedding) as similarity
  from public.chunks c
  where c.embedding is not null
    and (p_document_ids is null or c.document_id = any(p_document_ids))
  order by c.embedding <=> query_embedding
  limit match_count;
end;
$$;
