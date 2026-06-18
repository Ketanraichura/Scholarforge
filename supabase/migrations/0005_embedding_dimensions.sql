-- ScholarForge AI — configurable embedding dimensions
-- Migration: 0005_embedding_dimensions
--
-- The initial 0001_init.sql hardcoded embedding vector(1536). Different
-- providers return different sizes (DeepSeek: 1024, Gemini: 768).
-- This migration replaces the fixed column with a dynamically-sized one.
--
-- IMPORTANT: Adjust the vector(N) dimension below to match your chosen
-- embedding provider before applying this migration.
--   DeepSeek deepseek-embedding: 1024
--   Gemini   text-embedding-004: 768
--   OpenAI   text-embedding-3-small: 1536
--
-- After applying, rebuild the ivfflat index for the new dimension:
--   DROP INDEX IF EXISTS chunks_embedding_idx;
--   CREATE INDEX chunks_embedding_idx
--     ON public.chunks USING ivfflat (embedding vector_cosine_ops)
--     WITH (lists = 100);

-- Recreate the embedding column with the desired dimension.
-- This is destructive: existing embeddings are lost. Run only before
-- production data exists, or back up and restore after.
ALTER TABLE public.chunks
  DROP COLUMN IF EXISTS embedding;

ALTER TABLE public.chunks
  ADD COLUMN embedding vector(1024);

-- Rebuild the ANN index for the new dimension.
DROP INDEX IF EXISTS chunks_embedding_idx;

CREATE INDEX chunks_embedding_idx
  ON public.chunks USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
