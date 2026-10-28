import { GET as getJobs, POST as createJob } from '@/app/api/jobs/route';
import {
  GET as getJobById,
  POST as mutateJobById,
  DELETE as deleteJobById,
} from '@/app/api/jobs/[id]/route';
import { clearInMemoryStorage } from '@/lib/pipeline/storage';

describe('Phase 8: Job API Routes (/api/jobs and /api/jobs/[id])', () => {
  beforeEach(() => {
    clearInMemoryStorage();
  });

  afterAll(() => {
    clearInMemoryStorage();
  });

  describe('GET /api/jobs', () => {
    it('returns empty list when no jobs exist', async () => {
      const request = new Request('http://localhost:3000/api/jobs');
      const response = await getJobs(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.status).toBe('ready');
      expect(json.jobs).toEqual([]);
      expect(json.count).toBe(0);
    });

    it('returns list of jobs ordered newest first', async () => {
      // Create two jobs with distinct timestamps
      const res1 = await createJob(
        new Request('http://localhost:3000/api/jobs', {
          method: 'POST',
          body: JSON.stringify({ topic: 'Topic 1', auto_run: false }),
        }),
      );
      const json1 = await res1.json();

      await new Promise((resolve) => setTimeout(resolve, 15));

      const res2 = await createJob(
        new Request('http://localhost:3000/api/jobs', {
          method: 'POST',
          body: JSON.stringify({ topic: 'Topic 2', auto_run: false }),
        }),
      );
      const json2 = await res2.json();

      const request = new Request('http://localhost:3000/api/jobs?limit=10');
      const response = await getJobs(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.count).toBe(2);
      expect(json.jobs).toHaveLength(2);
      expect(json.jobs[0].job_id).toBe(json2.job_id);
      expect(json.jobs[1].job_id).toBe(json1.job_id);
    });
  });

  describe('POST /api/jobs', () => {
    it('rejects job creation if topic is missing', async () => {
      const request = new Request('http://localhost:3000/api/jobs', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const response = await createJob(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.status).toBe('error');
      expect(json.message).toContain('non-empty "topic" field');
    });

    it('creates job in pending state without execution when auto_run is false', async () => {
      const request = new Request('http://localhost:3000/api/jobs', {
        method: 'POST',
        body: JSON.stringify({
          topic: 'How container ships quietly restructured global trade',
          auto_run: false,
        }),
      });

      const response = await createJob(request);
      const json = await response.json();

      expect(response.status).toBe(201);
      expect(json.status).toBe('pending');
      expect(json.job_id).toBeDefined();
      expect(json.job.status).toBe('pending');
      expect(json.job.topic).toBe('How container ships quietly restructured global trade');
      expect(json.job.research).toBeUndefined();
    });

    it('pauses at approval gate when approval_mode is enabled and skipApproval is false', async () => {
      const request = new Request('http://localhost:3000/api/jobs', {
        method: 'POST',
        body: JSON.stringify({
          topic: 'How container ships quietly restructured global trade',
          approval_mode: 'script_and_visual_plan_before_paid_generation',
          skipApproval: false,
          forceMock: true,
        }),
      });

      const response = await createJob(request);
      const json = await response.json();

      expect(response.status).toBe(201);
      expect(json.status).toBe('awaiting_approval');
      expect(json.job.timed_plan).toBeDefined();
      expect(json.job.video_assets).toBeUndefined();
      expect(json.job.needs_review).toBe(true);
    });

    it('runs end-to-end pipeline when skipApproval is true', async () => {
      const request = new Request('http://localhost:3000/api/jobs', {
        method: 'POST',
        body: JSON.stringify({
          topic: 'Why electric grid frequencies must never drift from 60 Hz',
          skipApproval: true,
          forceMock: true,
        }),
      });

      const response = await createJob(request);
      const json = await response.json();

      expect(response.status).toBe(201);
      expect(json.status).toBe('completed');
      expect(json.job.final_video).toBeDefined();
      expect(json.job.captions).toBeDefined();
      expect(json.job.thumbnail?.url).toBeDefined();
    });
  });

  describe('GET /api/jobs/[id]', () => {
    it('returns 404 for non-existent job', async () => {
      const request = new Request('http://localhost:3000/api/jobs/unknown-id');
      const response = await getJobById(request, { params: { id: 'unknown-id' } });
      const json = await response.json();

      expect(response.status).toBe(404);
      expect(json.error).toBe('Job not found');
    });

    it('returns job state for existing job', async () => {
      const createRes = await createJob(
        new Request('http://localhost:3000/api/jobs', {
          method: 'POST',
          body: JSON.stringify({ topic: 'Sample topic', auto_run: false }),
        }),
      );
      const createJson = await createRes.json();
      const jobId = createJson.job_id;

      const request = new Request(`http://localhost:3000/api/jobs/${jobId}`);
      const response = await getJobById(request, { params: { id: jobId } });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.job.job_id).toBe(jobId);
      expect(json.job.topic).toBe('Sample topic');
    });
  });

  describe('POST /api/jobs/[id] (Action handling)', () => {
    it('approves and completes pipeline from awaiting_approval state', async () => {
      // 1. Create job that pauses at approval gate
      const createRes = await createJob(
        new Request('http://localhost:3000/api/jobs', {
          method: 'POST',
          body: JSON.stringify({
            topic: 'The forgotten paper maps that created modern property lines',
            approval_mode: 'script_and_visual_plan_before_paid_generation',
            skipApproval: false,
            forceMock: true,
          }),
        }),
      );
      const { job_id, status } = await createRes.json();
      expect(status).toBe('awaiting_approval');

      // 2. POST /api/jobs/[id] with action: 'approve'
      const approveRes = await mutateJobById(
        new Request(`http://localhost:3000/api/jobs/${job_id}`, {
          method: 'POST',
          body: JSON.stringify({ action: 'approve', forceMock: true }),
        }),
        { params: { id: job_id } },
      );
      const approveJson = await approveRes.json();

      expect(approveRes.status).toBe(200);
      expect(approveJson.status).toBe('completed');
      expect(approveJson.job.video_assets).toBeDefined();
      expect(approveJson.job.silent_video).toBeDefined();
      expect(approveJson.job.final_video).toBeDefined();
    });

    it('handles idempotent approve requests when job is already completed', async () => {
      const createRes = await createJob(
        new Request('http://localhost:3000/api/jobs', {
          method: 'POST',
          body: JSON.stringify({
            topic: 'Completed topic',
            skipApproval: true,
            forceMock: true,
          }),
        }),
      );
      const { job_id } = await createRes.json();

      const secondApprove = await mutateJobById(
        new Request(`http://localhost:3000/api/jobs/${job_id}`, {
          method: 'POST',
          body: JSON.stringify({ action: 'approve' }),
        }),
        { params: { id: job_id } },
      );
      const secondJson = await secondApprove.json();

      expect(secondApprove.status).toBe(200);
      expect(secondJson.status).toBe('completed');
      expect(secondJson.message).toBe('Job is already completed');
    });

    it('rejects unsupported actions with 400', async () => {
      const createRes = await createJob(
        new Request('http://localhost:3000/api/jobs', {
          method: 'POST',
          body: JSON.stringify({ topic: 'Some topic', auto_run: false }),
        }),
      );
      const { job_id } = await createRes.json();

      const actionRes = await mutateJobById(
        new Request(`http://localhost:3000/api/jobs/${job_id}`, {
          method: 'POST',
          body: JSON.stringify({ action: 'unsupported_action' }),
        }),
        { params: { id: job_id } },
      );
      const actionJson = await actionRes.json();

      expect(actionRes.status).toBe(400);
      expect(actionJson.error).toContain('Unknown action');
    });

    it('successfully redoes a completed stage and invalidates downstream outputs', async () => {
      // 1. Create a job paused at approval gate (Stages 1-4 completed)
      const createRes = await createJob(
        new Request('http://localhost:3000/api/jobs', {
          method: 'POST',
          body: JSON.stringify({
            topic: 'Redo Stage Test Pipeline',
            approval_mode: 'script_and_visual_plan_before_paid_generation',
            skipApproval: false,
            forceMock: true,
          }),
        }),
      );
      const { job_id, status } = await createRes.json();
      expect(status).toBe('awaiting_approval');

      // 2. Redo stage 2 (scriptwriter)
      const redoRes = await mutateJobById(
        new Request(`http://localhost:3000/api/jobs/${job_id}`, {
          method: 'POST',
          body: JSON.stringify({ action: 'redo', stage: 'scriptwriter', forceMock: true }),
        }),
        { params: { id: job_id } },
      );
      const redoJson = await redoRes.json();

      expect(redoRes.status).toBe(200);
      expect(redoJson.job.script).toBeDefined();
      // Downstream stages must be invalidated
      expect(redoJson.job.visual_plan).toBeUndefined();
      expect(redoJson.job.timed_plan).toBeUndefined();
      expect(redoJson.job.video_assets).toBeUndefined();
      expect(redoJson.job.current_stage).toBe('scriptwriter');

      // 3. Redo stage 4 (timing_layout) after advancing back
      const step3 = await mutateJobById(
        new Request(`http://localhost:3000/api/jobs/${job_id}`, {
          method: 'POST',
          body: JSON.stringify({ action: 'redo', stage: 'timing_layout', forceMock: true }),
        }),
        { params: { id: job_id } },
      );
      const step3Json = await step3.json();
      expect(step3.status).toBe(200);
      expect(step3Json.job.timed_plan).toBeDefined();
      expect(step3Json.job.status).toBe('awaiting_approval');
    });
  });

  describe('DELETE /api/jobs/[id]', () => {
    it('deletes job successfully', async () => {
      const createRes = await createJob(
        new Request('http://localhost:3000/api/jobs', {
          method: 'POST',
          body: JSON.stringify({ topic: 'Delete me', auto_run: false }),
        }),
      );
      const { job_id } = await createRes.json();

      const deleteRes = await deleteJobById(
        new Request(`http://localhost:3000/api/jobs/${job_id}`),
        { params: { id: job_id } },
      );
      const deleteJson = await deleteRes.json();

      expect(deleteRes.status).toBe(200);
      expect(deleteJson.success).toBe(true);

      // Verify it's gone
      const getRes = await getJobById(
        new Request(`http://localhost:3000/api/jobs/${job_id}`),
        { params: { id: job_id } },
      );
      expect(getRes.status).toBe(404);
    });
  });
});
