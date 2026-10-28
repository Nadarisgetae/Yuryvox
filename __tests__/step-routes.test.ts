import { POST as createJob } from '@/app/api/jobs/route';
import {
  GET as getNextStep,
  POST as executeNextStep,
} from '@/app/api/jobs/[id]/step/route';
import {
  determineNextStage,
  runNextStage,
  createJobRecord,
} from '@/lib/pipeline/orchestrator';
import { clearInMemoryStorage, getJob } from '@/lib/pipeline/storage';
import { presets } from '@/lib/config';

describe('Phase 8: Async Background & Stage Stepping (/api/jobs/[id]/step)', () => {
  beforeEach(() => {
    clearInMemoryStorage();
  });

  afterAll(() => {
    clearInMemoryStorage();
  });

  describe('determineNextStage helper', () => {
    it('accurately identifies stages sequentially from fresh to completed', () => {
      const record = createJobRecord({
        job_id: 'test-step-job',
        topic: 'How container ships quietly restructured global trade',
        target_seconds: 90,
        aspect_ratios: ['16:9'],
        language: 'en',
        audience: 'general audience',
        tone: 'clear, curious',
        visual_preset: presets.style.id,
        voice: {
          provider: presets.voice.provider,
          voice_id: '21m00Tcm4TlvDq8ikWAM',
        },
        music: presets.jobDefaults.music,
        budget_limit_usd: 15,
        approval_mode: 'script_and_visual_plan_before_paid_generation',
        provider_config_version: '1.0',
        prompt_version: '1.0',
      });

      // Stage 1: idea_analyst
      let next = determineNextStage(record);
      expect(next.nextStage).toBe('idea_analyst');
      expect(next.isCompleted).toBe(false);

      // Add dummy research
      record.research = {} as any;
      next = determineNextStage(record);
      expect(next.nextStage).toBe('scriptwriter');

      // Add dummy script
      record.script = {} as any;
      next = determineNextStage(record);
      expect(next.nextStage).toBe('visual_ideator');

      // Add dummy visual_plan
      record.visual_plan = {} as any;
      next = determineNextStage(record);
      expect(next.nextStage).toBe('timing_layout');

      // Add dummy timed_plan
      record.timed_plan = {} as any;
      next = determineNextStage(record);
      expect(next.nextStage).toBe('video_generator');
      expect(next.awaitingApproval).toBe(true);

      // With skipApproval
      next = determineNextStage(record, { skipApproval: true });
      expect(next.nextStage).toBe('video_generator');
      expect(next.awaitingApproval).toBe(false);

      // Add dummy video_assets
      record.video_assets = {} as any;
      next = determineNextStage(record);
      expect(next.nextStage).toBe('compositor');

      // Add dummy silent_video
      record.silent_video = {} as any;
      next = determineNextStage(record);
      expect(next.nextStage).toBe('audio_mastering');

      // Add dummy final_video
      record.final_video = {} as any;
      next = determineNextStage(record);
      expect(next.nextStage).toBeNull();
      expect(next.isCompleted).toBe(true);
    });
  });

  describe('Atomic Stage Stepping via /api/jobs/[id]/step', () => {
    it('progresses through stages one by one without serverless timeouts', async () => {
      // 1. Create a job without running it
      const createRes = await createJob(
        new Request('http://localhost:3000/api/jobs', {
          method: 'POST',
          body: JSON.stringify({
            topic: 'Why electric grid frequencies must never drift from 60 Hz',
            auto_run: false,
          }),
        }),
      );
      const { job_id } = await createRes.json();

      // Verify GET /api/jobs/[id]/step
      const getStepRes = await getNextStep(
        new Request(`http://localhost:3000/api/jobs/${job_id}/step`),
        { params: { id: job_id } },
      );
      const getStepJson = await getStepRes.json();
      expect(getStepJson.next_stage).toBe('idea_analyst');
      expect(getStepJson.is_completed).toBe(false);

      // Step 1: Idea Analyst
      const step1Res = await executeNextStep(
        new Request(`http://localhost:3000/api/jobs/${job_id}/step`, {
          method: 'POST',
          body: JSON.stringify({ forceMock: true }),
        }),
        { params: { id: job_id } },
      );
      const step1 = await step1Res.json();
      expect(step1.stage_executed).toBe('idea_analyst');
      expect(step1.status).toBe('in_progress');
      expect(step1.job.research).toBeDefined();

      // Step 2: Scriptwriter
      const step2Res = await executeNextStep(
        new Request(`http://localhost:3000/api/jobs/${job_id}/step`, {
          method: 'POST',
          body: JSON.stringify({ forceMock: true }),
        }),
        { params: { id: job_id } },
      );
      const step2 = await step2Res.json();
      expect(step2.stage_executed).toBe('scriptwriter');
      expect(step2.job.script).toBeDefined();

      // Step 3: Visual Ideator
      const step3Res = await executeNextStep(
        new Request(`http://localhost:3000/api/jobs/${job_id}/step`, {
          method: 'POST',
          body: JSON.stringify({ forceMock: true }),
        }),
        { params: { id: job_id } },
      );
      const step3 = await step3Res.json();
      expect(step3.stage_executed).toBe('visual_ideator');
      expect(step3.job.visual_plan).toBeDefined();

      // Step 4: Timing & Layout
      const step4Res = await executeNextStep(
        new Request(`http://localhost:3000/api/jobs/${job_id}/step`, {
          method: 'POST',
          body: JSON.stringify({ forceMock: true }),
        }),
        { params: { id: job_id } },
      );
      const step4 = await step4Res.json();
      expect(step4.stage_executed).toBe('timing_layout');
      expect(step4.job.timed_plan).toBeDefined();

      // Step 5: Approval Pause
      const step5Res = await executeNextStep(
        new Request(`http://localhost:3000/api/jobs/${job_id}/step`, {
          method: 'POST',
          body: JSON.stringify({ forceMock: true, skipApproval: false }),
        }),
        { params: { id: job_id } },
      );
      const step5 = await step5Res.json();
      expect(step5.status).toBe('awaiting_approval');

      // Step 6: Video Generator with skipApproval
      const step6Res = await executeNextStep(
        new Request(`http://localhost:3000/api/jobs/${job_id}/step`, {
          method: 'POST',
          body: JSON.stringify({ forceMock: true, skipApproval: true }),
        }),
        { params: { id: job_id } },
      );
      const step6 = await step6Res.json();
      expect(step6.stage_executed).toBe('video_generator');
      expect(step6.job.video_assets).toBeDefined();

      // Step 7: Compositor
      const step7Res = await executeNextStep(
        new Request(`http://localhost:3000/api/jobs/${job_id}/step`, {
          method: 'POST',
          body: JSON.stringify({ forceMock: true }),
        }),
        { params: { id: job_id } },
      );
      const step7 = await step7Res.json();
      expect(step7.stage_executed).toBe('compositor');
      expect(step7.job.silent_video).toBeDefined();

      // Step 8: Audio Mastering (Final Stage)
      const step8Res = await executeNextStep(
        new Request(`http://localhost:3000/api/jobs/${job_id}/step`, {
          method: 'POST',
          body: JSON.stringify({ forceMock: true }),
        }),
        { params: { id: job_id } },
      );
      const step8 = await step8Res.json();
      expect(step8.stage_executed).toBe('audio_mastering');
      expect(step8.status).toBe('completed');
      expect(step8.job.final_video).toBeDefined();

      // Step 9: Already completed
      const step9Res = await executeNextStep(
        new Request(`http://localhost:3000/api/jobs/${job_id}/step`, {
          method: 'POST',
          body: JSON.stringify({ forceMock: true }),
        }),
        { params: { id: job_id } },
      );
      const step9 = await step9Res.json();
      expect(step9.status).toBe('completed');
    });
  });

  describe('Async Background Job Submission', () => {
    it('returns 202 Accepted immediately when background: true is requested', async () => {
      const response = await createJob(
        new Request('http://localhost:3000/api/jobs', {
          method: 'POST',
          body: JSON.stringify({
            topic: 'The forgotten paper maps that created modern property lines',
            background: true,
            forceMock: true,
            skipApproval: true,
          }),
        }),
      );

      const json = await response.json();
      expect(response.status).toBe(202);
      expect(json.status).toBe('in_progress');
      expect(json.job_id).toBeDefined();
      expect(json.message).toContain('background');

      // Verify the job exists in storage
      const stored = await getJob(json.job_id);
      expect(stored).not.toBeNull();
    });
  });
});
