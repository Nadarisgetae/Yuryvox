import { getSupabaseServerClient } from '@/lib/supabase/client';
import type {
  JobRecord,
  PipelineStatus,
  PipelineStage,
} from '@/lib/pipeline/orchestrator';

// In-memory fallback store using globalThis for persistent state across Next.js dev server reloads
const globalStoreKey = Symbol.for('__yuryvox_in_memory_job_store__');

interface GlobalWithJobStore {
  [globalStoreKey]?: Map<string, JobRecord>;
}

const globalScope = globalThis as unknown as GlobalWithJobStore;
if (!globalScope[globalStoreKey]) {
  globalScope[globalStoreKey] = new Map<string, JobRecord>();
}

const memoryStore = globalScope[globalStoreKey]!;

/**
 * Determine the active storage driver.
 * Returns 'supabase' if credentials are configured, otherwise 'memory'.
 */
export function getStorageDriver(): 'supabase' | 'memory' {
  const supabase = getSupabaseServerClient();
  return supabase ? 'supabase' : 'memory';
}

/**
 * Check if the active storage is durable (Supabase) vs ephemeral (memory).
 */
export function isDurableStorage(): boolean {
  return getStorageDriver() === 'supabase';
}

/**
 * Save or update a JobRecord in durable storage.
 * Automatically mirrors to in-memory store for instant zero-latency lookups.
 */
export async function saveJob(job: JobRecord): Promise<void> {
  // Always update memory store
  memoryStore.set(job.job_id, JSON.parse(JSON.stringify(job)));

  const supabase = getSupabaseServerClient();
  if (!supabase) return;

  try {
    const row = {
      job_id: job.job_id,
      idempotency_key: job.idempotency_key,
      topic: job.topic,
      status: job.status,
      current_stage: job.current_stage || null,
      target_seconds: job.target_seconds,
      aspects: job.aspects,
      voice: job.voice,
      music: job.music,
      caption_style: job.caption_style || null,
      config: job.config,
      research: job.research || null,
      script: job.script || null,
      visual_plan: job.visual_plan || null,
      timed_plan: job.timed_plan || null,
      video_assets: job.video_assets || null,
      silent_video: job.silent_video || null,
      final_video: job.final_video || null,
      captions: job.captions || null,
      thumbnail: job.thumbnail || null,
      cost: job.cost,
      timestamps: job.timestamps,
      seed: job.seed,
      needs_review: job.needs_review,
      warnings: job.warnings || [],
      error: job.error || null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('jobs').upsert(row, { onConflict: 'job_id' });
    if (error) {
      console.warn(`[storage] Supabase upsert error for job ${job.job_id}: ${error.message}`);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[storage] Supabase connection failed for job ${job.job_id}: ${message}`);
  }
}

/**
 * Retrieve a JobRecord by job_id.
 * Checks Supabase if configured, falling back to in-memory store.
 */
export async function getJob(jobId: string): Promise<JobRecord | null> {
  const supabase = getSupabaseServerClient();

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('job_id', jobId)
        .maybeSingle();

      if (!error && data) {
        const job = data as JobRecord;
        // Keep memory store synced
        memoryStore.set(jobId, job);
        return job;
      }
    } catch {
      // Fallback to memory store below
    }
  }

  const cached = memoryStore.get(jobId);
  return cached ? JSON.parse(JSON.stringify(cached)) : null;
}

/**
 * List jobs with optional limit, sorted newest first.
 */
export async function listJobs(limit = 50): Promise<JobRecord[]> {
  const supabase = getSupabaseServerClient();

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (!error && Array.isArray(data)) {
        return data as JobRecord[];
      }
    } catch {
      // Fallback to memory store below
    }
  }

  // Memory store fallback: sort by timestamps.created descending
  const jobs = Array.from(memoryStore.values());
  jobs.sort((a, b) => {
    const timeA = new Date(a.timestamps.created).getTime() || 0;
    const timeB = new Date(b.timestamps.created).getTime() || 0;
    return timeB - timeA;
  });

  return jobs.slice(0, limit).map((j) => JSON.parse(JSON.stringify(j)));
}

/**
 * Update the status (and optional fields) of an existing job.
 */
export async function updateJobStatus(
  jobId: string,
  status: PipelineStatus,
  extra: Partial<JobRecord> = {},
): Promise<JobRecord | null> {
  const existing = await getJob(jobId);
  if (!existing) return null;

  const updated: JobRecord = {
    ...existing,
    ...extra,
    status,
  };

  await saveJob(updated);
  return updated;
}

/**
 * Delete a job by job_id.
 */
export async function deleteJob(jobId: string): Promise<boolean> {
  memoryStore.delete(jobId);

  const supabase = getSupabaseServerClient();
  if (supabase) {
    try {
      const { error } = await supabase.from('jobs').delete().eq('job_id', jobId);
      return !error;
    } catch {
      return false;
    }
  }

  return true;
}

/**
 * Clear the in-memory fallback store (primarily for unit test isolation).
 */
export function clearInMemoryStorage(): void {
  memoryStore.clear();
}

/**
 * Upload an asset to Supabase Storage if configured, or return a deterministic mock URL.
 */
export async function uploadAsset(
  jobId: string,
  filename: string,
  content: Buffer | Uint8Array | Blob | string,
  contentType = 'application/octet-stream',
  bucket = 'final-videos',
): Promise<{ publicUrl: string; path: string }> {
  const storagePath = `${jobId}/${filename}`;
  const supabase = getSupabaseServerClient();

  if (supabase) {
    try {
      const { error } = await supabase.storage
        .from(bucket)
        .upload(storagePath, content, {
          upsert: true,
          contentType,
        });

      if (!error) {
        const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath);
        if (data?.publicUrl) {
          return { publicUrl: data.publicUrl, path: storagePath };
        }
      }
    } catch {
      // Fallback to deterministic mock URL
    }
  }

  // Deterministic mock asset URL
  return {
    publicUrl: `https://mock-storage.yuryvox.internal/${bucket}/${storagePath}`,
    path: storagePath,
  };
}
