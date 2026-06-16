-- ScholarForge AI — document text extraction support
-- Migration: 0003_document_extraction
--
-- Generated only. DO NOT run as part of this sprint.
-- Apply later with the Supabase CLI:  supabase db push
--
-- Sources of truth:
--   Docs/03-architecture.md  (PDF Extraction -> Chunking)
--   Docs/04-db-schema.md     (documents, chunks)
--
-- Additive only: stores extracted text + page count and adds retry bookkeeping
-- to documents. Page boundaries are preserved inside `content` using a form-feed
-- (U+000C) delimiter between pages.

-- documents: retry bookkeeping + failure reason --------------------------------
alter table public.documents
  add column if not exists retry_count integer not null default 0;

alter table public.documents
  add column if not exists failure_reason text;

-- document_texts: one row of extracted text per document ----------------------
create table if not exists public.document_texts (
  document_id uuid primary key references public.documents (id) on delete cascade,
  content text not null,
  page_count integer not null default 0,
  created_at timestamptz not null default now()
);

-- Row Level Security: extracted text is readable only by the document's owner.
-- @see Docs/08-security.md
alter table public.document_texts enable row level security;

create policy "document_texts via document owner" on public.document_texts
  for all using (
    exists (
      select 1 from public.documents d
      where d.id = document_texts.document_id and d.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.documents d
      where d.id = document_texts.document_id and d.user_id = auth.uid()
    )
  );
