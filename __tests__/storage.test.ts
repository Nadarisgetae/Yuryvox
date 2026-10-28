import {
  saveJob,
  getJob,
  listJobs,
  updateJobStatus,
  deleteJob,
  clearInMemoryStorage,
  getStorageDriver,
  uploadAsset,
} from '@/lib/pipeline/storage';
import { createJobRecord } from '@/lib/pipeline/orchestrator';
import type { JobConfig } from '@/lib/agents/types';
import { presets } from '@/lib/config';

describe('Phase 8: Job State Persistence & Storage (lib/pipeline/storage.ts)', () => {
  const baseConfig: JobConfig = {
    job_id: 'test-storage-job-001',
    topic: 'How container ships quietly restructured global trade',
    target_seconds: 90,
    aspect_ratios: ['16:9'],
    language: 'en',
    audience: 'general audience',
    tone: 'clear, curious, evidence-led',
    visual_preset: presets.style.id,
    voice: {
      provider: presets.voice.provider,
      voice_id: '21m00Tcm4TlvDq8ikWAM',
      language: presets.voice.language,
    },
    music: presets.jobDefaults.music,
    budget_limit_usd: 15,
    approval_mode: 'script_and_visual_plan_before_paid_generation',
    provider_config_version: '1.0',
    prompt_version: '1.0',
  };

  beforeEach(() => {
    clearInMemoryStorage();
  });

  afterAll(() => {
    clearInMemoryStorage();
  });

  describe('Storage Driver Detection', () => {
    it('returns "memory" driver when Supabase environment keys are absent', () => {
      const driver = getStorageDriver();
      expect(driver).toBe('memory');
    });
  });

  describe('saveJob and getJob', () => {
    it('saves and retrieves a JobRecord cleanly', async () => {
      const record = createJobRecord(baseConfig, 'idemp-storage-test');
      await saveJob(record);

      const retrieved = await getJob(record.job_id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.job_id).toBe(record.job_id);
      expect(retrieved?.topic).toBe(record.topic);
      expect(retrieved?.status).toBe('pending');
      expect(retrieved?.idempotency_key).toBe('idemp-storage-test');
      expect(retrieved?.timestamps.created).toBe(record.timestamps.created);
    });

    it('returns null when querying a non-existent job_id', async () => {
      const notFound = await getJob('non-existent-job-xyz');
      expect(notFound).toBeNull();
    });
  });

  describe('listJobs', () => {
    it('lists jobs sorted by newest first and respects limits', async () => {
      const job1 = createJobRecord({ ...baseConfig, job_id: 'job-1', topic: 'Topic 1' });
      job1.timestamps.created = new Date('2026-10-01T10:00:00Z').toISOString();

      const job2 = createJobRecord({ ...baseConfig, job_id: 'job-2', topic: 'Topic 2' });
      job2.timestamps.created = new Date('2026-10-02T10:00:00Z').toISOString();

      const job3 = createJobRecord({ ...baseConfig, job_id: 'job-3', topic: 'Topic 3' });
      job3.timestamps.created = new Date('2026-10-03T10:00:00Z').toISOString();

      await saveJob(job1);
      await saveJob(job2);
      await saveJob(job3);

      const allJobs = await listJobs();
      expect(allJobs).toHaveLength(3);
      expect(allJobs[0].job_id).toBe('job-3');
      expect(allJobs[1].job_id).toBe('job-2');
      expect(allJobs[2].job_id).toBe('job-1');

      const limited = await listJobs(2);
      expect(limited).toHaveLength(2);
      expect(limited[0].job_id).toBe('job-3');
      expect(limited[1].job_id).toBe('job-2');
    });
  });

  describe('updateJobStatus', () => {
    it('updates status and extra fields for an existing job', async () => {
      const record = createJobRecord(baseConfig);
      await saveJob(record);

      const updated = await updateJobStatus(record.job_id, 'in_progress', {
        current_stage: 'scriptwriter',
        warnings: ['Pacing slightly tight'],
      });

      expect(updated).not.toBeNull();
      expect(updated?.status).toBe('in_progress');
      expect(updated?.current_stage).toBe('scriptwriter');
      expect(updated?.warnings).toEqual(['Pacing slightly tight']);

      const reFetched = await getJob(record.job_id);
      expect(reFetched?.status).toBe('in_progress');
      expect(reFetched?.current_stage).toBe('scriptwriter');
    });

    it('returns null when updating a non-existent job', async () => {
      const result = await updateJobStatus('does-not-exist', 'completed');
      expect(result).toBeNull();
    });
  });

  describe('deleteJob', () => {
    it('removes a job from storage', async () => {
      const record = createJobRecord(baseConfig);
      await saveJob(record);

      const deleted = await deleteJob(record.job_id);
      expect(deleted).toBe(true);

      const retrieved = await getJob(record.job_id);
      expect(retrieved).toBeNull();
    });
  });

  describe('uploadAsset', () => {
    it('returns a deterministic mock storage URL when Supabase is unconfigured', async () => {
      const asset = await uploadAsset(
        'job-123',
        'final_video.mp4',
        'fake-binary-content',
        'video/mp4',
        'final-videos',
      );

      expect(asset.publicUrl).toBe(
        'https://mock-storage.yuryvox.internal/final-videos/job-123/final_video.mp4',
      );
      expect(asset.path).toBe('job-123/final_video.mp4');
    });
  });
});
