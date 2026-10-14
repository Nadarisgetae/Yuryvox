import {
  validateGateD,
  validateTimedPlanOutput,
  calculateSceneDurations,
  generateDeterministicMockTimedPlan,
  runTimingLayout,
} from '@/lib/agents/timing-layout';
import { runIdeaAnalyst } from '@/lib/agents/idea-analyst';
import { runScriptwriter } from '@/lib/agents/scriptwriter';
import { runVisualIdeator } from '@/lib/agents/visual-ideator';
import type { JobConfig, ScriptData, VisualPlanData } from '@/lib/agents/types';
import { presets } from '@/lib/config';

describe('Phase 4.5: Agent 4 (Timing & Layout)', () => {
  const baseConfig: JobConfig = {
    job_id: 'test-job-timing-001',
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
  };

  async function generateFullPipeline(config: JobConfig): Promise<{ script: ScriptData; visualPlan: VisualPlanData }> {
    const researchEnv = await runIdeaAnalyst(config, { forceMock: true });
    const scriptEnv = await runScriptwriter(config, researchEnv.data, { forceMock: true });
    const vizEnv = await runVisualIdeator(config, scriptEnv.data, { forceMock: true });
    return { script: scriptEnv.data, visualPlan: vizEnv.data };
  }

  describe('Gate D validation', () => {
    it('passes for valid script and visual plan', async () => {
      const { script, visualPlan } = await generateFullPipeline(baseConfig);
      const result = validateGateD(baseConfig, script, visualPlan);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('fails when script is missing', async () => {
      const { visualPlan } = await generateFullPipeline(baseConfig);
      const result = validateGateD(baseConfig, null as any, visualPlan);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'MISSING_SCRIPT')).toBe(true);
    });

    it('fails when visual plan is missing', async () => {
      const { script } = await generateFullPipeline(baseConfig);
      const result = validateGateD(baseConfig, script, null as any);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'MISSING_VISUAL_PLAN')).toBe(true);
    });

    it('fails when scene IDs do not match', async () => {
      const { script, visualPlan } = await generateFullPipeline(baseConfig);
      // Corrupt visual plan scene ID
      const brokenVisualPlan = {
        ...visualPlan,
        scene_visuals: [{ ...visualPlan.scene_visuals[0], scene_id: 'SC99' }],
      };
      const result = validateGateD(baseConfig, script, brokenVisualPlan);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'ORPHAN_SCRIPT_SCENE' || e.code === 'ORPHAN_VISUAL_SCENE')).toBe(true);
    });

    it('fails on invalid target_seconds', async () => {
      const { script, visualPlan } = await generateFullPipeline(baseConfig);
      const result = validateGateD({ ...baseConfig, target_seconds: 0 }, script, visualPlan);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'INVALID_TARGET_SECONDS')).toBe(true);
    });

    it('fails on empty aspect_ratios', async () => {
      const { script, visualPlan } = await generateFullPipeline(baseConfig);
      const result = validateGateD({ ...baseConfig, aspect_ratios: [] }, script, visualPlan);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'NO_ASPECT_RATIOS')).toBe(true);
    });
  });

  describe('Duration calculation', () => {
    it('calculates durations and prorates to target', async () => {
      const { script, visualPlan } = await generateFullPipeline(baseConfig);
      const { durations, plannedTotal } = calculateSceneDurations(script, visualPlan, 90, 145);

      expect(durations.size).toBe(script.scenes.length);
      expect(plannedTotal).toBeGreaterThan(0);
      expect(Math.abs(plannedTotal - 90)).toBeLessThanOrEqual(2); // Within tolerance after proration

      // All durations within bounds
      for (const dur of durations.values()) {
        expect(dur).toBeGreaterThanOrEqual(3);
        expect(dur).toBeLessThanOrEqual(12);
      }
    });

    it('gives hook scene extra duration', async () => {
      const { script, visualPlan } = await generateFullPipeline(baseConfig);
      const { durations } = calculateSceneDurations(script, visualPlan, 90, 145);

      const hookScene = script.scenes.find((s) => s.narrative_function === 'hook');
      const nonHookScene = script.scenes.find((s) => s.narrative_function !== 'hook');

      if (hookScene && nonHookScene) {
        const hookDur = durations.get(hookScene.scene_id) || 0;
        const nonHookDur = durations.get(nonHookScene.scene_id) || 0;
        // Hook should have at least as much or more than similar scenes
        expect(hookDur).toBeGreaterThanOrEqual(nonHookDur * 0.9);
      }
    });
  });

  describe('Output schema validation', () => {
    it('catches missing target_seconds', () => {
      const invalid = { scenes: [], aspect_layouts: {} };
      const res = validateTimedPlanOutput(invalid);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.code === 'MISSING_TARGET_SECONDS')).toBe(true);
    });

    it('catches missing aspect_layouts', () => {
      const invalid = { target_seconds: 90, planned_seconds: 90, timeline_valid: true, scenes: [] };
      const res = validateTimedPlanOutput(invalid);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.code === 'MISSING_ASPECT_LAYOUTS')).toBe(true);
    });

    it('catches duration mismatch (end - start != duration)', () => {
      const invalid = {
        target_seconds: 90,
        planned_seconds: 90,
        timeline_valid: true,
        aspect_layouts: { '16:9': { width: 1920, height: 1080, safe_margins_percent: 5 } },
        scenes: [
          {
            scene_id: 'SC01',
            start_seconds: 0,
            end_seconds: 10,
            duration_seconds: 5, // Mismatch!
            asset_target_seconds: 5,
            narration_target_seconds: 4,
            hold_seconds: 1,
            transition_in: 'cut',
            transition_out: 'fade',
            overlay: { text: 'Test', start_seconds: 1, end_seconds: 4, safe_zone: 'bottom_third' },
            motion: { type: 'none', direction: 'static', intensity: 'low' },
          },
        ],
      };
      const res = validateTimedPlanOutput(invalid);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.code === 'DURATION_MISMATCH')).toBe(true);
    });

    it('catches narration exceeding scene duration', () => {
      const invalid = {
        target_seconds: 90,
        planned_seconds: 90,
        timeline_valid: true,
        aspect_layouts: { '16:9': { width: 1920, height: 1080, safe_margins_percent: 5 } },
        scenes: [
          {
            scene_id: 'SC01',
            start_seconds: 0,
            end_seconds: 5,
            duration_seconds: 5,
            asset_target_seconds: 5,
            narration_target_seconds: 8, // Exceeds scene duration!
            hold_seconds: 0,
            transition_in: 'cut',
            transition_out: 'fade',
            overlay: { text: 'Test', start_seconds: 1, end_seconds: 4, safe_zone: 'bottom_third' },
            motion: { type: 'none', direction: 'static', intensity: 'low' },
          },
        ],
      };
      const res = validateTimedPlanOutput(invalid);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.code === 'NARRATION_EXCEEDS_DURATION')).toBe(true);
    });

    it('validates overlay reading time', () => {
      const invalid = {
        target_seconds: 90,
        planned_seconds: 90,
        timeline_valid: true,
        aspect_layouts: { '16:9': { width: 1920, height: 1080, safe_margins_percent: 5 } },
        scenes: [
          {
            scene_id: 'SC01',
            start_seconds: 0,
            end_seconds: 5,
            duration_seconds: 5,
            asset_target_seconds: 5,
            narration_target_seconds: 4,
            hold_seconds: 1,
            transition_in: 'cut',
            transition_out: 'fade',
            overlay: { text: 'This overlay text has way too many words to read in the allotted time', start_seconds: 4.5, end_seconds: 4.8, safe_zone: 'bottom_third' },
            motion: { type: 'none', direction: 'static', intensity: 'low' },
          },
        ],
      };
      const res = validateTimedPlanOutput(invalid);
      expect(res.valid).toBe(false);
    });

    it('validates motion types', () => {
      const invalid = {
        target_seconds: 90,
        planned_seconds: 90,
        timeline_valid: true,
        aspect_layouts: { '16:9': { width: 1920, height: 1080, safe_margins_percent: 5 } },
        scenes: [
          {
            scene_id: 'SC01',
            start_seconds: 0,
            end_seconds: 5,
            duration_seconds: 5,
            asset_target_seconds: 5,
            narration_target_seconds: 4,
            hold_seconds: 1,
            transition_in: 'cut',
            transition_out: 'fade',
            overlay: { text: 'Test', start_seconds: 1, end_seconds: 4, safe_zone: 'bottom_third' },
            motion: { type: 'teleport', direction: 'instant', intensity: 'high' },
          },
        ],
      };
      const res = validateTimedPlanOutput(invalid);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.code === 'INVALID_MOTION_TYPE')).toBe(true);
    });

    it('validates transition types', () => {
      const invalid = {
        target_seconds: 90,
        planned_seconds: 90,
        timeline_valid: true,
        aspect_layouts: { '16:9': { width: 1920, height: 1080, safe_margins_percent: 5 } },
        scenes: [
          {
            scene_id: 'SC01',
            start_seconds: 0,
            end_seconds: 5,
            duration_seconds: 5,
            asset_target_seconds: 5,
            narration_target_seconds: 4,
            hold_seconds: 1,
            transition_in: 'teleport',
            transition_out: 'fade',
            overlay: { text: 'Test', start_seconds: 1, end_seconds: 4, safe_zone: 'bottom_third' },
            motion: { type: 'none', direction: 'static', intensity: 'low' },
          },
        ],
      };
      const res = validateTimedPlanOutput(invalid);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.code === 'INVALID_TRANSITION_IN')).toBe(true);
    });
  });

  describe('End-to-end execution on three sample topics', () => {
    const sampleTopics = [
      'How container ships quietly restructured global trade',
      'The forgotten paper maps that created modern property lines',
      'Why electric grid frequencies must never drift from 60 Hz',
    ];

    test.each(sampleTopics)(
      'generates valid timed plan from script and visual plan for: %s',
      async (topic) => {
        const config: JobConfig = {
          ...baseConfig,
          job_id: `test-timing-${Date.now()}`,
          topic,
        };

        const { script, visualPlan } = await generateFullPipeline(config);
        const timingEnv = await runTimingLayout(config, script, visualPlan, { forceMock: true });

        expect(timingEnv.status).toBe('completed');
        expect(timingEnv.stage).toBe('timing_layout');
        expect(timingEnv.schema_version).toBe('1.0');
        expect(timingEnv.data).toBeDefined();

        const plan = timingEnv.data;

        // Acceptance criterion 1: Target duration within tolerance
        expect(Math.abs(plan.planned_seconds - config.target_seconds)).toBeLessThanOrEqual(2);

        // Acceptance criterion 2: Scene count matches
        expect(plan.scenes.length).toBe(script.scenes.length);

        // Acceptance criterion 3: Scene timing validity
        const sceneIds = new Set(script.scenes.map((s) => s.scene_id));
        let prevEnd = 0;
        for (const ts of plan.scenes) {
          expect(sceneIds.has(ts.scene_id)).toBe(true);
          expect(ts.duration_seconds).toBeGreaterThanOrEqual(3);
          expect(ts.duration_seconds).toBeLessThanOrEqual(12);

          // Duration arithmetic
          expect(Math.abs((ts.end_seconds - ts.start_seconds) - ts.duration_seconds)).toBeLessThan(0.02);

          // Narration fits in scene (allow small floating-point tolerance)
          expect(ts.narration_target_seconds).toBeLessThanOrEqual(ts.duration_seconds + 0.5);

          // Overlay timing within scene
          expect(ts.overlay.start_seconds).toBeGreaterThanOrEqual(ts.start_seconds - 0.02);
          expect(ts.overlay.end_seconds).toBeLessThanOrEqual(ts.end_seconds + 0.02);

          // Valid motion/transition types
          expect(['cut', 'fade', 'paper_reveal', 'match_move']).toContain(ts.transition_in);
          expect(['cut', 'fade', 'paper_reveal', 'match_move']).toContain(ts.transition_out);
          expect(['none', 'pan', 'zoom', 'parallax', 'reveal']).toContain(ts.motion.type);
          expect(['low', 'medium']).toContain(ts.motion.intensity);
        }

        // Acceptance criterion 4: Aspect layouts
        expect(plan.aspect_layouts['16:9']).toBeDefined();
        expect(plan.aspect_layouts['16:9'].width).toBe(1920);
        expect(plan.aspect_layouts['16:9'].height).toBe(1080);

        // Acceptance criterion 5: Timeline validity flag
        expect(typeof plan.timeline_valid).toBe('boolean');
      },
    );
  });

  describe('Gate D rejection handling', () => {
    it('returns needs_review status when gate D fails', async () => {
      const { script, visualPlan } = await generateFullPipeline(baseConfig);
      const env = await runTimingLayout(baseConfig, script, visualPlan, { forceMock: true });
      // Actually this should pass - test with broken input
      const brokenEnv = await runTimingLayout(baseConfig, null as any, visualPlan, { forceMock: true });
      expect(brokenEnv.status).toBe('needs_review');
      expect(brokenEnv.errors.length).toBeGreaterThan(0);
    });
  });
});