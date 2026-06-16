-- ScholarForge AI — document upload support
-- Migration: 0002_documents_upload
--
-- Generated only. DO NOT run as part of scaffolding (see Sprint 0 spec).
-- Apply later with the Supabase CLI:  supabase db push
--
-- Sources of truth:
--   Docs/05-api-contracts.md  (POST /api/upload)
--   Docs/08-security.md       (Row Level Security, signed URLs)
--
-- Additive only: extends the `documents` table from 0001_init and creates a
-- private storage bucket with owner-scoped access policies.

-- documents: store the original filename alongside the storage path ----------
alter table public.documents
  add column if not exists filename text;

-- Storage bucket (private; objects are only reachable via signed URLs) --------
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- Storage RLS: a user may only touch objects under a top-level folder named
-- after their own auth uid (path layout: "<user_id>/<document_id>.pdf").
-- @see Docs/08-security.md
create policy "documents storage insert own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "documents storage select own"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "documents storage delete own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
