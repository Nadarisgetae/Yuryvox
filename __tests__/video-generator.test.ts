import {
  validateGateE,
  validateVideoAssetsOutput,
  generateDeterministicMockVideoAssets,
  runVideoGenerator,
  estimateSceneCost,
  deterministicSeed,
} from '@/lib/agents/video-generator';
import {
  runIdeaAnalyst,
} from '@/lib/agents/idea-analyst';
import { runScriptwriter } from '@/lib/agents/scriptwriter';
import { runVisualIdeator } from '@/lib/agents/visual-ideator';
import { runTimingLayout } from '@/lib/agents/timing-layout';
import type { JobConfig, TimedPlanData } from '@/lib/agents/types';
import { presets } from '@/lib/config';

describe('Phase 5: Agent 5 (Video Generator)', () => {
  const baseConfig: JobConfig = {
    job_id: 'test-job-video-001',
    topic: 'How container ships quietly restructured global trade',
    target_seconds: 90,
    aspect_ratios: ['16:9'],
    language: 'en',
    audience: 'general audience',
    tone: 'clear, curious, evidence-led',
    visual_preset: presets.style.id,
    voice: presets.voice,
    music: presets.jobDefaults.music,
    budget_limit_usd: 15,
    approval_mode: 'script_and_visual_plan_before_paid_generation',
    provider_config_version: '1.0',
    prompt_version: '1.0',
    seed: 42,
  };

  async function generateFullPipeline(config: JobConfig): Promise<{ timedPlan: TimedPlanData }> {
    const researchEnv = await runIdeaAnalyst(config, { forceMock: true });
    const scriptEnv = await runScriptwriter(config, researchEnv.data, { forceMock: true });
    const vizEnv = await runVisualIdeator(config, scriptEnv.data, { forceMock: true });
    const timingEnv = await runTimingLayout(config, scriptEnv.data, vizEnv.data, { forceMock: true });
    return { timedPlan: timingEnv.data };
  }

  describe('Gate E validation', () => {
    it('passes for valid timed plan', async () => {
      const { timedPlan } = await generateFullPipeline(baseConfig);
      const result = validateGateE(baseConfig, timedPlan);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('fails when timed plan is missing', async () => {
      const result = validateGateE(baseConfig, null as any);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'MISSING_TIMED_PLAN')).toBe(true);
    });

    it('fails when timeline is invalid', async () => {
      const { timedPlan } = await generateFullPipeline(baseConfig);
      const brokenPlan = { ...timedPlan, timeline_valid: false };
      const result = validateGateE(baseConfig, brokenPlan);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'INVALID_TIMELINE')).toBe(true);
    });

    it('fails on negative budget', async () => {
      const { timedPlan } = await generateFullPipeline(baseConfig);
      const result = validateGateE({ ...baseConfig, budget_limit_usd: -1 }, timedPlan);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'INVALID_BUDGET')).toBe(true);
    });
  });

  describe('Deterministic seed', () => {
    it('produces same seed for same inputs', () => {
      expect(deterministicSeed(42, 'SC01')).toBe(deterministicSeed(42, 'SC01'));
      expect(deterministicSeed(42, 'SC01')).not.toBe(deterministicSeed(42, 'SC02'));
      expect(deterministicSeed(100, 'SC01')).not.toBe(deterministicSeed(42, 'SC01'));
    });
  });

  describe('Cost estimation', () => {
    it('calculates cost based on duration', () => {
      // 4s = 1 image + 1 clip (6s) = 0.003 + 0.05 = 0.053
      expect(estimateSceneCost(4)).toBeCloseTo(0.053, 3);
      // 6s = 1 image + 1 clip (6s) = 0.003 + 0.05 = 0.053
      expect(estimateSceneCost(6)).toBeCloseTo(0.053, 3);
      // 8s = 1 image + 2 clips = 0.003 + 0.10 = 0.103
      expect(estimateSceneCost(8)).toBeCloseTo(0.103, 3);
      // 12s = 1 image + 2 clips = 0.003 + 0.10 = 0.103
      expect(estimateSceneCost(12)).toBeCloseTo(0.103, 3);
    });
  });

  describe('Output schema validation', () => {
    const validAssets = {
      style_preset: 'archival_collage_explainer',
      scenes: [
        {
          scene_id: 'SC01',
          image_url: 'https://example.com/img.png',
          video_url: 'https://example.com/vid.mp4',
          duration_s: 5,
          seed: 12345,
          generation_cost_usd: 0.05,
          status: 'generated' as const,
        },
      ],
      total_estimated_cost_usd: 0.05,
      total_actual_cost_usd: 0.05,
      failed_scene_ids: [],
      warnings: [],
    };

    it('passes for valid assets', () => {
      const res = validateVideoAssetsOutput(validAssets);
      expect(res.valid).toBe(true);
    });

    it('catches missing style_preset', () => {
      const invalid = { ...validAssets, style_preset: undefined };
      const res = validateVideoAssetsOutput(invalid);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.code === 'MISSING_STYLE_PRESET')).toBe(true);
    });

    it('catches missing scenes', () => {
      const invalid = { ...validAssets, scenes: [] };
      const res = validateVideoAssetsOutput(invalid);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.code === 'MISSING_SCENES')).toBe(true);
    });

    it('catches generated scene missing video_url', () => {
      const invalid = {
        ...validAssets,
        scenes: [{ ...validAssets.scenes[0], video_url: '', status: 'generated' as const }],
      };
      const res = validateVideoAssetsOutput(invalid);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.code === 'MISSING_VIDEO_URL')).toBe(true);
    });

    it('catches fallback scene missing image_url', () => {
      const invalid = {
        ...validAssets,
        scenes: [{ ...validAssets.scenes[0], image_url: '', status: 'fallback_ken_burns' as const }],
      };
      const res = validateVideoAssetsOutput(invalid);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.code === 'MISSING_IMAGE_URL_FOR_FALLBACK')).toBe(true);
    });
  });

  describe('Mock generator', () => {
    it('generates deterministic assets matching timed plan', async () => {
      const { timedPlan } = await generateFullPipeline(baseConfig);
      const assets = generateDeterministicMockVideoAssets(baseConfig, timedPlan);

      expect(assets.style_preset).toBe('archival_collage_explainer');
      expect(assets.scenes.length).toBe(timedPlan.scenes.length);
      expect(assets.total_estimated_cost_usd).toBeGreaterThan(0);

      for (const scene of assets.scenes) {
        expect(scene.scene_id).toBeTruthy();
        expect(scene.image_url).toContain(baseConfig.job_id);
        expect(scene.video_url).toContain(baseConfig.job_id);
        expect(scene.duration_s).toBeGreaterThan(0);
        expect(scene.seed).toBeGreaterThan(0);
        expect(scene.generation_cost_usd).toBeGreaterThan(0);
        expect(scene.status).toBe('generated');
      }

      // Deterministic: same inputs = same seeds
      const assets2 = generateDeterministicMockVideoAssets(baseConfig, timedPlan);
      for (let i = 0; i < assets.scenes.length; i++) {
        expect(assets.scenes[i].seed).toBe(assets2.scenes[i].seed);
      }
    });
  });

  describe('End-to-end execution on three sample topics', () => {
    const sampleTopics = [
      'How container ships quietly restructured global trade',
      'The forgotten paper maps that created modern property lines',
      'Why electric grid frequencies must never drift from 60 Hz',
    ];

    test.each(sampleTopics)(
      'generates valid video assets from timed plan for: %s',
      async (topic) => {
        const config: JobConfig = {
          ...baseConfig,
          job_id: `test-video-${Date.now()}`,
          topic,
        };

        const { timedPlan } = await generateFullPipeline(config);
        const videoEnv = await runVideoGenerator(config, timedPlan, { forceMock: true });

        expect(videoEnv.status).toBe('completed');
        expect(videoEnv.stage).toBe('video_generator');
        expect(videoEnv.schema_version).toBe('1.0');
        expect(videoEnv.data).toBeDefined();

        const assets = videoEnv.data;

        // Acceptance criteria
        expect(assets.style_preset).toBe('archival_collage_explainer');
        expect(assets.scenes.length).toBe(timedPlan.scenes.length);
        expect(assets.total_estimated_cost_usd).toBeLessThan(config.budget_limit_usd);

        const timedSceneIds = new Set(timedPlan.scenes.map((s) => s.scene_id));
        for (const scene of assets.scenes) {
          expect(timedSceneIds.has(scene.scene_id)).toBe(true);
          expect(scene.image_url).toContain(config.job_id);
          expect(scene.video_url).toContain(config.job_id);
          expect(scene.duration_s).toBeGreaterThan(0);
          expect(scene.seed).toBeGreaterThan(0);
          expect(scene.generation_cost_usd).toBeGreaterThan(0);
          expect(scene.status).toBe('generated');
        }

        // Total cost within budget
        expect(assets.total_estimated_cost_usd).toBeLessThan(config.budget_limit_usd);
      },
    );
  });

  describe('Gate E rejection handling', () => {
    it('returns needs_review when gate E fails', async () => {
      const env = await runVideoGenerator(baseConfig, null as any, { forceMock: true });
      expect(env.status).toBe('needs_review');
      expect(env.errors.length).toBeGreaterThan(0);
    });
  });
});