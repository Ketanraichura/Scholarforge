-- ScholarForge AI — initial schema
-- Migration: 0001_init
--
-- Generated only. DO NOT run as part of scaffolding (see task spec).
-- Apply later with the Supabase CLI:  supabase db push
--
-- Sources of truth:
--   Docs/04-db-schema.md  (documents, chunks)
--   Docs/01-prd.md        (users, chats, messages required by core features)
--   Docs/08-security.md   (Row Level Security)
--   Docs/14-references.md  (pgvector)
--
-- This is a superset of Docs/04-db-schema.md: the two documented tables are kept
-- compatible, and the additional PRD-required tables are added.

-- Extensions -----------------------------------------------------------------
create extension if not exists "pgcrypto"; -- gen_random_uuid()
create extension if not exists "vector"; -- pgvector

-- users ----------------------------------------------------------------------
-- Mirrors auth.users (Supabase Auth owns identity); this is the app-level
-- profile row keyed by the same id.
create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  display_name text,
  created_at timestamptz not null default now()
);

-- documents ------------------------------------------------------------------
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  title text,
  storage_path text,
  status text not null default 'uploaded'
    check (status in ('uploaded', 'processing', 'ready', 'failed')),
  created_at timestamptz not null default now()
);
create index if not exists documents_user_id_idx on public.documents (user_id);

-- chunks ---------------------------------------------------------------------
-- `embedding` is nullable: populated by the embeddings worker in a later sprint.
-- Dimension 1536 is a placeholder for the chosen embedding model.
create table if not exists public.chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  embedding vector(1536),
  created_at timestamptz not null default now()
);
create index if not exists chunks_document_id_idx on public.chunks (document_id);
-- Approximate nearest-neighbour index for cosine similarity search.
create index if not exists chunks_embedding_idx
  on public.chunks using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- chats ----------------------------------------------------------------------
create table if not exists public.chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  title text,
  created_at timestamptz not null default now()
);
create index if not exists chats_user_id_idx on public.chats (user_id);

-- messages -------------------------------------------------------------------
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats (id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  citations jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists messages_chat_id_idx on public.messages (chat_id);

-- Row Level Security ---------------------------------------------------------
-- Enable RLS on every table (Docs/08-security.md). Policies restrict each row to
-- its owning user; messages are scoped through their parent chat.
alter table public.users enable row level security;
alter table public.documents enable row level security;
alter table public.chunks enable row level security;
alter table public.chats enable row level security;
alter table public.messages enable row level security;

create policy "users select own" on public.users
  for select using (auth.uid() = id);
create policy "users update own" on public.users
  for update using (auth.uid() = id);

create policy "documents owner all" on public.documents
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "chunks via document owner" on public.chunks
  for all using (
    exists (
      select 1 from public.documents d
      where d.id = chunks.document_id and d.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.documents d
      where d.id = chunks.document_id and d.user_id = auth.uid()
    )
  );

create policy "chats owner all" on public.chats
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "messages via chat owner" on public.messages
  for all using (
    exists (
      select 1 from public.chats c
      where c.id = messages.chat_id and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.chats c
      where c.id = messages.chat_id and c.user_id = auth.uid()
    )
  );
