-- ScholarForge AI — document chunking support
-- Migration: 0004_document_chunking
--
-- Generated only. DO NOT run as part of this sprint.
-- Apply later with the Supabase CLI:  supabase db push
--
-- Sources of truth:
--   Docs/03-architecture.md  (Chunking -> Embeddings)
--   Docs/04-db-schema.md     (chunks)
--
-- Additive only: extends the `chunks` table (from 0001) with per-chunk metadata
-- columns and an idempotency guard, and widens the `documents.status` check to
-- include the pipeline statuses introduced in Sprints 3-4.

-- documents.status: allow the full pipeline lifecycle -------------------------
-- 0001 created a CHECK limited to ('uploaded','processing','ready','failed').
-- Replace it so 'extracted' (Sprint 3) and 'chunked' (Sprint 4) are valid.
alter table public.documents
  drop constraint if exists documents_status_check;

alter table public.documents
  add constraint documents_status_check
  check (status in ('uploaded', 'processing', 'extracted', 'chunked', 'ready', 'failed'));

-- chunks: per-chunk metadata columns -----------------------------------------
-- The full metadata object is also stored in the existing `metadata` JSONB
-- column; these typed columns make ordering and idempotency efficient.
alter table public.chunks
  add column if not exists chunk_index integer;

alter table public.chunks
  add column if not exists page_number integer;

alter table public.chunks
  add column if not exists start_offset integer;

alter table public.chunks
  add column if not exists end_offset integer;

-- Idempotency: a document may have at most one chunk per chunk_index, so
-- re-processing (delete + re-insert) cannot create duplicates.
create unique index if not exists chunks_document_id_chunk_index_key
  on public.chunks (document_id, chunk_index);
