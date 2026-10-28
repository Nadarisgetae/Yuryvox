import { createJobRecord, runPipeline, PipelineStage } from '@/lib/pipeline/orchestrator';
import type { JobConfig } from '@/lib/agents/types';
import { presets } from '@/lib/config';

describe('Phase 8: Pipeline Orchestrator (lib/pipeline/orchestrator.ts)', () => {
  const baseConfig: JobConfig = {
    job_id: 'test-orchestrator-job-001',
    topic: 'How container ships quietly restructured global trade',
    target_seconds: 90,
    aspect_ratios: ['16:9'],
    language: 'en',
    audience: 'general audience',
    tone: 'clear, curious, evidence-led',
    visual_preset: presets.style.id,
    voice: {
      provider: presets.voice.provider,
      voice_id: presets.voice.voice_id || '21m00Tcm4TlvDq8ikWAM',
      language: presets.voice.language,
    },
    music: presets.jobDefaults.music,
    budget_limit_usd: 15,
    approval_mode: 'script_and_visual_plan_before_paid_generation',
    provider_config_version: '1.0',
    prompt_version: '1.0',
  };

  describe('createJobRecord', () => {
    it('creates an initialized JobRecord matching canonical schema', () => {
      const record = createJobRecord(baseConfig, 'idemp-key-123');

      expect(record.job_id).toBe(baseConfig.job_id);
      expect(record.idempotency_key).toBe('idemp-key-123');
      expect(record.topic).toBe(baseConfig.topic);
      expect(record.target_seconds).toBe(90);
      expect(record.aspects).toEqual(['16:9']);
      expect(record.status).toBe('pending');
      expect(record.cost.total_usd).toBe(0);
      expect(record.timestamps.created).toBeDefined();
      expect(record.voice.voice_id).toBe('21m00Tcm4TlvDq8ikWAM');
      expect(record.needs_review).toBe(false);
      expect(record.warnings).toEqual([]);
    });

    it('defaults idempotency_key to job_id if not provided', () => {
      const record = createJobRecord(baseConfig);
      expect(record.idempotency_key).toBe(baseConfig.job_id);
    });
  });

  describe('runPipeline End-to-End Mock Execution', () => {
    it('executes all 7 stages sequentially when skipApproval is true', async () => {
      const startedStages: PipelineStage[] = [];
      const completedStages: PipelineStage[] = [];

      const result = await runPipeline(baseConfig, {
        forceMock: true,
        skipApproval: true,
        onStageStart: (stage) => {
          startedStages.push(stage);
        },
        onStageComplete: (stage) => {
          completedStages.push(stage);
        },
      });

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();

      // All 7 stages started and completed
      const expectedStages: PipelineStage[] = [
        'idea_analyst',
        'scriptwriter',
        'visual_ideator',
        'timing_layout',
        'video_generator',
        'compositor',
        'audio_mastering',
      ];
      expect(startedStages).toEqual(expectedStages);
      expect(completedStages).toEqual(expectedStages);

      // Job record state
      const { job } = result;
      expect(job.status).toBe('completed');
      expect(job.research).toBeDefined();
      expect(job.script).toBeDefined();
      expect(job.visual_plan).toBeDefined();
      expect(job.timed_plan).toBeDefined();
      expect(job.video_assets).toBeDefined();
      expect(job.silent_video).toBeDefined();
      expect(job.final_video).toBeDefined();
      expect(job.captions).toBeDefined();
      expect(job.thumbnail?.url).toBeDefined();

      // Envelopes collected
      expect(result.envelopes.research).toBeDefined();
      expect(result.envelopes.script).toBeDefined();
      expect(result.envelopes.visual_plan).toBeDefined();
      expect(result.envelopes.timed_plan).toBeDefined();
      expect(result.envelopes.video_assets).toBeDefined();
      expect(result.envelopes.silent_video).toBeDefined();
      expect(result.envelopes.final_video).toBeDefined();

      // Cost aggregation (Zero external API spend in mock mode)
      expect(job.cost.idea_analyst_usd).toBe(0);
      expect(job.cost.scriptwriter_usd).toBe(0);
      expect(job.cost.visual_ideator_usd).toBe(0);
      expect(job.cost.video_gen_usd).toBe(0);
      expect(job.cost.compositor_usd).toBe(0);
      expect(job.cost.audio_mastering_usd).toBe(0);
      expect(job.cost.total_usd).toBe(0);

      // Timestamps
      expect(job.timestamps.idea_analyst).toBeDefined();
      expect(job.timestamps.scriptwriter).toBeDefined();
      expect(job.timestamps.visual_ideator).toBeDefined();
      expect(job.timestamps.timing_layout).toBeDefined();
      expect(job.timestamps.video_generator).toBeDefined();
      expect(job.timestamps.compositor).toBeDefined();
      expect(job.timestamps.audio_mastering).toBeDefined();
      expect(job.timestamps.completed).toBeDefined();
    });

    it('pauses at approval gate when approval_mode is enabled and skipApproval is false', async () => {
      const config: JobConfig = {
        ...baseConfig,
        job_id: 'test-approval-gate-job',
        approval_mode: 'script_and_visual_plan_before_paid_generation',
      };

      // Initial run: should pause before Stage 5 (video_generator)
      const firstRun = await runPipeline(config, {
        forceMock: true,
        skipApproval: false,
      });

      expect(firstRun.success).toBe(true);
      expect(firstRun.job.status).toBe('awaiting_approval');
      expect(firstRun.job.needs_review).toBe(true);
      expect(firstRun.job.timed_plan).toBeDefined();
      expect(firstRun.job.video_assets).toBeUndefined();
      expect(firstRun.job.final_video).toBeUndefined();

      // Resume run: pass existingJob with skipApproval: true
      const secondRun = await runPipeline(
        config,
        {
          forceMock: true,
          skipApproval: true,
        },
        firstRun.job,
      );

      expect(secondRun.success).toBe(true);
      expect(secondRun.job.status).toBe('completed');
      expect(secondRun.job.video_assets).toBeDefined();
      expect(secondRun.job.silent_video).toBeDefined();
      expect(secondRun.job.final_video).toBeDefined();
    });

    it('stops at targetStage when targetStage is specified', async () => {
      const result = await runPipeline(baseConfig, {
        forceMock: true,
        targetStage: 'scriptwriter',
      });

      expect(result.success).toBe(true);
      expect(result.job.status).toBe('completed');
      expect(result.job.research).toBeDefined();
      expect(result.job.script).toBeDefined();
      expect(result.job.visual_plan).toBeUndefined();
      expect(result.job.video_assets).toBeUndefined();
    });

    it('rejects pipeline execution if pre-flight Gate A fails due to missing topic', async () => {
      const invalidConfig: JobConfig = {
        ...baseConfig,
        job_id: 'test-invalid-config',
        topic: '', // Missing topic
      };

      const result = await runPipeline(invalidConfig, { forceMock: true });

      expect(result.success).toBe(false);
      expect(result.job.status).toBe('needs_review');
      expect(result.job.needs_review).toBe(true);
      expect(result.error?.code).toBe('MISSING_TOPIC');
    });

    it('rejects pipeline execution if pre-flight Gate A fails due to invalid target_seconds', async () => {
      const invalidConfig: JobConfig = {
        ...baseConfig,
        job_id: 'test-invalid-config-seconds',
        target_seconds: -10, // Invalid target seconds
      };

      const result = await runPipeline(invalidConfig, { forceMock: true });

      expect(result.success).toBe(false);
      expect(result.job.status).toBe('needs_review');
      expect(result.job.needs_review).toBe(true);
      expect(result.error?.code).toBe('INVALID_TARGET_SECONDS');
    });
  });

  describe('End-to-End Orchestrator Pipeline Across 3 Reference Topics', () => {
    const referenceTopics = [
      'How container ships quietly restructured global trade',
      'The forgotten paper maps that created modern property lines',
      'Why electric grid frequencies must never drift from 60 Hz',
    ];

    test.each(referenceTopics)(
      'orchestrates complete pipeline in mock mode for: %s',
      async (topic) => {
        const config: JobConfig = {
          ...baseConfig,
          job_id: `orch-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          topic,
        };

        const result = await runPipeline(config, {
          forceMock: true,
          skipApproval: true,
        });

        expect(result.success).toBe(true);
        expect(result.job.status).toBe('completed');
        expect(result.job.final_video?.final_video_url).toContain(config.job_id);
        expect(result.job.final_video?.duration_s).toBeCloseTo(config.target_seconds, 1);
        expect(result.job.cost.total_usd).toBe(0); // Zero external API spend during mock testing
      },
    );

    it('successfully orchestrates 20-minute long-form documentary (1200 seconds)', async () => {
      const longConfig: JobConfig = {
        ...baseConfig,
        job_id: 'orch-20min-documentary-001',
        topic: 'How container ships quietly restructured global trade',
        target_seconds: 1200, // 20 minutes
      };

      const result = await runPipeline(longConfig, {
        forceMock: true,
        skipApproval: true,
      });

      expect(result.success).toBe(true);
      expect(result.job.status).toBe('completed');
      expect(result.job.target_seconds).toBe(1200);
      expect(result.job.final_video?.duration_s).toBeCloseTo(1200, 0);
      expect(result.job.script?.estimated_word_count).toBeGreaterThanOrEqual(2700);
      expect(result.job.timed_plan?.scenes.length).toBeGreaterThanOrEqual(140);
    });
  });
});
