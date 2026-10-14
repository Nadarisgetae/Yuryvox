import {
  validateGateF,
  validateSilentVideoOutput,
  generateDeterministicMockSilentVideo,
  estimateCompositorCost,
  runCompositor,
} from '@/lib/agents/compositor';
import {
  runIdeaAnalyst,
} from '@/lib/agents/idea-analyst';
import { runScriptwriter } from '@/lib/agents/scriptwriter';
import { runVisualIdeator } from '@/lib/agents/visual-ideator';
import { runTimingLayout } from '@/lib/agents/timing-layout';
import { runVideoGenerator } from '@/lib/agents/video-generator';
import type { JobConfig, TimedPlanData, VideoAssetsData } from '@/lib/agents/types';
import { presets } from '@/lib/config';

describe('Phase 6: Agent 6 (Compositor)', () => {
  const baseConfig: JobConfig = {
    job_id: 'test-job-comp-001',
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

  async function generateFullPipeline(config: JobConfig): Promise<{ timedPlan: TimedPlanData; videoAssets: VideoAssetsData }> {
    const researchEnv = await runIdeaAnalyst(config, { forceMock: true });
    const scriptEnv = await runScriptwriter(config, researchEnv.data, { forceMock: true });
    const vizEnv = await runVisualIdeator(config, scriptEnv.data, { forceMock: true });
    const timingEnv = await runTimingLayout(config, scriptEnv.data, vizEnv.data, { forceMock: true });
    const videoEnv = await runVideoGenerator(config, timingEnv.data, { forceMock: true });
    return { timedPlan: timingEnv.data, videoAssets: videoEnv.data };
  }

  describe('Gate F validation', () => {
    it('passes for valid video assets and timed plan', async () => {
      const { timedPlan, videoAssets } = await generateFullPipeline(baseConfig);
      const result = validateGateF(baseConfig, videoAssets, timedPlan);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('fails when video assets missing', async () => {
      const { timedPlan } = await generateFullPipeline(baseConfig);
      const result = validateGateF(baseConfig, null as any, timedPlan);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'MISSING_VIDEO_ASSETS')).toBe(true);
    });

    it('fails when timed plan missing', async () => {
      const { videoAssets } = await generateFullPipeline(baseConfig);
      const result = validateGateF(baseConfig, videoAssets, null as any);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'MISSING_TIMED_PLAN')).toBe(true);
    });

    it('fails when scene IDs do not match', async () => {
      const { timedPlan, videoAssets } = await generateFullPipeline(baseConfig);
      const brokenAssets = { ...videoAssets, scenes: [{ ...videoAssets.scenes[0], scene_id: 'SC99' }] };
      const result = validateGateF(baseConfig, brokenAssets, timedPlan);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'ORPHAN_TIMED_SCENE' || e.code === 'ORPHAN_ASSET_SCENE')).toBe(true);
    });

    it('fails when generated scene missing video_url', async () => {
      const { timedPlan, videoAssets } = await generateFullPipeline(baseConfig);
      const brokenAssets = {
        ...videoAssets,
        scenes: [{ ...videoAssets.scenes[0], video_url: '', status: 'generated' as const }],
      };
      const result = validateGateF(baseConfig, brokenAssets, timedPlan);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'MISSING_VIDEO_URL')).toBe(true);
    });

    it('fails when fallback scene missing image_url', async () => {
      const { timedPlan, videoAssets } = await generateFullPipeline(baseConfig);
      const brokenAssets = {
        ...videoAssets,
        scenes: [{ ...videoAssets.scenes[0], image_url: '', status: 'fallback_ken_burns' as const }],
      };
      const result = validateGateF(baseConfig, brokenAssets, timedPlan);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'MISSING_IMAGE_URL')).toBe(true);
    });
  });

  describe('Output schema validation', () => {
    it('passes for valid silent video', () => {
      const valid = {
        silent_video_url: 'https://example.com/silent.mp4',
        thumbnail_url: 'https://example.com/thumb.jpg',
        duration_s: 90,
        render_id: 'render-123',
        aspect_ratio: '16:9',
        scene_count: 8,
        fallback_scene_ids: [],
        estimated_cost_usd: 0.16,
        actual_cost_usd: 0.15,
      };
      const res = validateSilentVideoOutput(valid);
      expect(res.valid).toBe(true);
    });

    it('catches missing silent_video_url', () => {
      const invalid = { thumbnail_url: 'https://example.com/thumb.jpg', duration_s: 90, render_id: 'r1', aspect_ratio: '16:9', scene_count: 8, fallback_scene_ids: [], estimated_cost_usd: 0.16, actual_cost_usd: 0.15 };
      const res = validateSilentVideoOutput(invalid);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.code === 'MISSING_SILENT_VIDEO_URL')).toBe(true);
    });

    it('catches missing thumbnail_url', () => {
      const invalid = { silent_video_url: 'https://example.com/silent.mp4', duration_s: 90, render_id: 'r1', aspect_ratio: '16:9', scene_count: 8, fallback_scene_ids: [], estimated_cost_usd: 0.16, actual_cost_usd: 0.15 };
      const res = validateSilentVideoOutput(invalid);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.code === 'MISSING_THUMBNAIL_URL')).toBe(true);
    });

    it('catches duration mismatch warning', () => {
      const timedPlan = { scenes: [{ scene_id: 'SC01', duration_seconds: 10 }] };
      const data = { silent_video_url: 'url', thumbnail_url: 'url', duration_s: 50, render_id: 'r1', aspect_ratio: '16:9', scene_count: 1, fallback_scene_ids: [], estimated_cost_usd: 0.02, actual_cost_usd: 0.02 };
      const res = validateSilentVideoOutput(data, timedPlan);
      expect(res.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('Cost estimation', () => {
    it('calculates cost per scene', () => {
      expect(estimateCompositorCost(1)).toBe(0.02);
      expect(estimateCompositorCost(8)).toBe(0.16);
      expect(estimateCompositorCost(15)).toBe(0.30);
    });
  });

  describe('Mock generator', () => {
    it('generates deterministic silent video matching timed plan', async () => {
      const { timedPlan, videoAssets } = await generateFullPipeline(baseConfig);
      const silent = generateDeterministicMockSilentVideo(baseConfig, videoAssets, timedPlan);

      expect(silent.silent_video_url).toContain(baseConfig.job_id);
      expect(silent.thumbnail_url).toContain(baseConfig.job_id);
      expect(silent.duration_s).toBeCloseTo(timedPlan.scenes.reduce((sum, s) => sum + (s.duration_seconds || 0), 0), 1);
      expect(silent.render_id).toContain(baseConfig.job_id);
      expect(silent.aspect_ratio).toBe('16:9');
      expect(silent.scene_count).toBe(timedPlan.scenes.length);
      expect(silent.estimated_cost_usd).toBeGreaterThan(0);

      // Deterministic
      const silent2 = generateDeterministicMockSilentVideo(baseConfig, videoAssets, timedPlan);
      expect(silent.render_id).toBe(silent2.render_id);
    });
  });

  describe('End-to-end execution on three sample topics', () => {
    const sampleTopics = [
      'How container ships quietly restructured global trade',
      'The forgotten paper maps that created modern property lines',
      'Why electric grid frequencies must never drift from 60 Hz',
    ];

    test.each(sampleTopics)(
      'generates valid silent video from video assets and timed plan for: %s',
      async (topic) => {
        const config: JobConfig = {
          ...baseConfig,
          job_id: `test-comp-${Date.now()}`,
          topic,
        };

        const { timedPlan, videoAssets } = await generateFullPipeline(config);
        const compEnv = await runCompositor(config, videoAssets, timedPlan, { forceMock: true });

        expect(compEnv.status).toBe('completed');
        expect(compEnv.stage).toBe('compositor');
        expect(compEnv.schema_version).toBe('1.0');
        expect(compEnv.data).toBeDefined();

        const silent = compEnv.data;

        // Acceptance criteria
        expect(silent.silent_video_url).toContain(config.job_id);
        expect(silent.thumbnail_url).toContain(config.job_id);
        expect(silent.duration_s).toBeCloseTo(timedPlan.scenes.reduce((sum, s) => sum + (s.duration_seconds || 0), 0), 1);
        expect(silent.render_id).toContain(config.job_id);
        expect(silent.aspect_ratio).toBe('16:9');
        expect(silent.scene_count).toBe(timedPlan.scenes.length);
        expect(silent.estimated_cost_usd).toBeLessThan(config.budget_limit_usd);

        const fallbackScenes = videoAssets.scenes.filter((s) => s.status === 'fallback_ken_burns').map((s) => s.scene_id);
        expect(silent.fallback_scene_ids).toEqual(fallbackScenes);
      },
    );
  });

  describe('Gate F rejection handling', () => {
    it('returns needs_review when gate F fails', async () => {
      const { timedPlan, videoAssets } = await generateFullPipeline(baseConfig);
      const env = await runCompositor(baseConfig, null as any, timedPlan, { forceMock: true });
      expect(env.status).toBe('needs_review');
      expect(env.errors.length).toBeGreaterThan(0);
    });
  });
});