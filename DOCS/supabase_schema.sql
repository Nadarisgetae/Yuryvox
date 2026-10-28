-- ==============================================================================
-- Yuryvox Supabase Database & Storage Setup
-- Schema Version: 1.0
-- Canonical Table: jobs (matching Appendix B of Yuryvox Masterplan)
-- ==============================================================================

-- 1. Create jobs table
CREATE TABLE IF NOT EXISTS public.jobs (
  job_id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL,
  topic TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  current_stage TEXT,
  target_seconds INTEGER NOT NULL DEFAULT 90,
  aspects TEXT[] NOT NULL DEFAULT '{"16:9"}',
  voice JSONB NOT NULL DEFAULT '{}'::jsonb,
  music JSONB NOT NULL DEFAULT '{}'::jsonb,
  caption_style JSONB,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  research JSONB,
  script JSONB,
  visual_plan JSONB,
  timed_plan JSONB,
  video_assets JSONB,
  silent_video JSONB,
  final_video JSONB,
  captions JSONB,
  thumbnail JSONB,
  cost JSONB NOT NULL DEFAULT '{
    "idea_analyst_usd": 0,
    "scriptwriter_usd": 0,
    "visual_ideator_usd": 0,
    "timing_layout_usd": 0,
    "video_gen_usd": 0,
    "compositor_usd": 0,
    "audio_mastering_usd": 0,
    "storage_usd": 0,
    "total_usd": 0
  }'::jsonb,
  timestamps JSONB NOT NULL DEFAULT '{}'::jsonb,
  seed BIGINT NOT NULL DEFAULT 0,
  needs_review BOOLEAN NOT NULL DEFAULT FALSE,
  warnings TEXT[] NOT NULL DEFAULT '{}',
  error JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Indexes for efficient lookup
CREATE INDEX IF NOT EXISTS idx_jobs_status ON public.jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON public.jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_idempotency_key ON public.jobs(idempotency_key);

-- 3. Automatic updated_at trigger
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_jobs_updated_at ON public.jobs;
CREATE TRIGGER set_jobs_updated_at
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- Allow anonymous read and write access for development (adjust for production auth policies if required)
DROP POLICY IF EXISTS "Allow public read access to jobs" ON public.jobs;
CREATE POLICY "Allow public read access to jobs"
  ON public.jobs FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Allow service and anon write access to jobs" ON public.jobs;
CREATE POLICY "Allow service and anon write access to jobs"
  ON public.jobs FOR ALL
  USING (true)
  WITH CHECK (true);

-- 5. Create Storage Buckets (if Supabase Storage extension is active)
-- Buckets: final-videos, video-clips, thumbnails, captions, voiceover
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('final-videos', 'final-videos', true),
  ('video-clips', 'video-clips', true),
  ('thumbnails', 'thumbnails', true),
  ('captions', 'captions', true),
  ('voiceover', 'voiceover', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: Public read access
DROP POLICY IF EXISTS "Allow public read access on buckets" ON storage.objects;
CREATE POLICY "Allow public read access on buckets"
  ON storage.objects FOR SELECT
  USING (bucket_id IN ('final-videos', 'video-clips', 'thumbnails', 'captions', 'voiceover'));

-- Storage RLS: Service role and anon upload
DROP POLICY IF EXISTS "Allow uploads to buckets" ON storage.objects;
CREATE POLICY "Allow uploads to buckets"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id IN ('final-videos', 'video-clips', 'thumbnails', 'captions', 'voiceover'));
