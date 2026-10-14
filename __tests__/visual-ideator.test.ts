import {
  validateGateC,
  validateVisualPlanOutput,
  buildVisualIdeatorPrompt,
  runVisualIdeator,
} from '@/lib/agents/visual-ideator';
import { runIdeaAnalyst } from '@/lib/agents/idea-analyst';
import { runScriptwriter } from '@/lib/agents/scriptwriter';
import type { JobConfig, ScriptData } from '@/lib/agents/types';
import { presets } from '@/lib/config';

describe('Phase 4: Agent 3 (Visual Ideator)', () => {
  const baseConfig: JobConfig = {
    job_id: 'test-job-viz-001',
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

  async function generateValidScript(config: JobConfig): Promise<ScriptData> {
    const researchEnv = await runIdeaAnalyst(config, { forceMock: true });
    const scriptEnv = await runScriptwriter(config, researchEnv.data, { forceMock: true });
    return scriptEnv.data;
  }

  describe('Gate C validation', () => {
    it('passes for valid script data', async () => {
      const script = await generateValidScript(baseConfig);
      const result = validateGateC(baseConfig, script);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('fails when script is missing', () => {
      const result = validateGateC(baseConfig, null as any);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'MISSING_SCRIPT')).toBe(true);
    });

    it('fails when script has no scenes', async () => {
      const script = await generateValidScript(baseConfig);
      const result = validateGateC(baseConfig, { ...script, scenes: [] });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'NO_SCENES')).toBe(true);
    });
  });

  describe('Output schema validation', () => {
    it('catches missing style_preset', () => {
      const res = validateVisualPlanOutput({ scene_visuals: [] });
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.code === 'MISSING_STYLE_PRESET')).toBe(true);
    });

    it('catches missing scene_visuals', () => {
      const res = validateVisualPlanOutput({ style_preset: 'test' });
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.code === 'MISSING_SCENE_VISUALS')).toBe(true);
    });

    it('catches invalid visual_type', () => {
      const invalid = {
        style_preset: 'test',
        global_art_direction: { palette: ['red'], texture: 'paper', typography_direction: 'clean' },
        scene_visuals: [
          {
            scene_id: 'SC01',
            narrative_purpose: 'test',
            visual_type: 'hologram',
            image_prompt: 'test prompt that is long enough to pass',
            fallback_visual: 'test',
            asset_rights_requirement: 'generated',
            factual_anchor_claim_ids: [],
            composition: { background: 'b', focal_subject: 'f', supporting_elements: [], foreground_layers: [], negative_space: 'n' },
            video_motion_prompt: 'test',
            overlay_text: 'test',
            motion_direction: 'none',
            transition_intent: 'test',
            continuity_tags: [],
          },
        ],
      };
      const res = validateVisualPlanOutput(invalid);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.code === 'INVALID_VISUAL_TYPE')).toBe(true);
    });

    it('catches invalid motion_direction', () => {
      const invalid = {
        style_preset: 'test',
        global_art_direction: { palette: ['red'], texture: 'paper', typography_direction: 'clean' },
        scene_visuals: [
          {
            scene_id: 'SC01',
            narrative_purpose: 'test',
            visual_type: 'archival_collage',
            image_prompt: 'test prompt long enough to pass validation check here',
            fallback_visual: 'test',
            asset_rights_requirement: 'generated',
            factual_anchor_claim_ids: [],
            composition: { background: 'b', focal_subject: 'f', supporting_elements: [], foreground_layers: [], negative_space: 'n' },
            video_motion_prompt: 'test',
            overlay_text: 'test',
            motion_direction: 'teleport',
            transition_intent: 'test',
            continuity_tags: [],
          },
        ],
      };
      const res = validateVisualPlanOutput(invalid);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.code === 'INVALID_MOTION_TYPE')).toBe(true);
    });
  });

  describe('Prompt builder', () => {
    it('creates prompt containing topic, style preset, and archival collage direction', async () => {
      const script = await generateValidScript(baseConfig);
      const { systemPrompt, userPrompt } = buildVisualIdeatorPrompt(baseConfig, script);

      expect(systemPrompt).toContain('Vox-style archival-collage');
      expect(systemPrompt).toContain('archival_collage_explainer');
      expect(systemPrompt).toContain('Never fabricate evidence');
      expect(userPrompt).toContain(baseConfig.topic);
      expect(userPrompt).toContain(script.scenes[0].scene_id);
    });
  });

  describe('End-to-end execution on three sample topics', () => {
    const sampleTopics = [
      'How container ships quietly restructured global trade',
      'The forgotten paper maps that created modern property lines',
      'Why electric grid frequencies must never drift from 60 Hz',
    ];

    test.each(sampleTopics)(
      'generates valid visual plan from script for: %s',
      async (topic) => {
        const config: JobConfig = {
          ...baseConfig,
          job_id: `test-viz-${Date.now()}`,
          topic,
        };

        const researchEnv = await runIdeaAnalyst(config, { forceMock: true });
        expect(researchEnv.status).toBe('completed');

        const scriptEnv = await runScriptwriter(config, researchEnv.data, { forceMock: true });
        expect(scriptEnv.status).toBe('completed');

        const vizEnv = await runVisualIdeator(config, scriptEnv.data, { forceMock: true });
        expect(vizEnv.status).toBe('completed');
        expect(vizEnv.stage).toBe('visual_ideator');
        expect(vizEnv.schema_version).toBe('1.0');
        expect(vizEnv.data).toBeDefined();

        const plan = vizEnv.data;

        // Acceptance criteria
        expect(plan.style_preset).toBe(baseConfig.visual_preset);
        expect(plan.scene_visuals.length).toBe(scriptEnv.data.scenes.length);

        const sceneIds = new Set(scriptEnv.data.scenes.map((s) => s.scene_id));
        for (const sv of plan.scene_visuals) {
          expect(sv.scene_id).toBeTruthy();
          expect(sceneIds.has(sv.scene_id)).toBe(true);
          expect(sv.narrative_purpose.length).toBeGreaterThan(5);
          expect(sv.visual_type).toBeTruthy();
          expect(sv.image_prompt.length).toBeGreaterThan(20);
          expect(sv.video_motion_prompt.length).toBeGreaterThan(10);
          expect(sv.overlay_text.length).toBeGreaterThan(0);
          expect(sv.fallback_visual.length).toBeGreaterThan(10);
          expect(sv.asset_rights_requirement).toBeTruthy();
          expect(sv.composition.background.length).toBeGreaterThan(0);
          expect(sv.composition.focal_subject.length).toBeGreaterThan(0);
        }

        const allowedTypes = ['archival_collage', 'map', 'timeline', 'diagram', 'chart', 'illustration', 'photo', 'motion_graphic'];
        for (const sv of plan.scene_visuals) {
          expect(allowedTypes).toContain(sv.visual_type);
        }

        const allowedMotions = ['none', 'pan', 'zoom', 'parallax', 'reveal'];
        for (const sv of plan.scene_visuals) {
          expect(allowedMotions).toContain(sv.motion_direction);
        }

        for (const sv of plan.scene_visuals) {
          const words = sv.overlay_text.trim().split(/\s+/).filter(Boolean).length;
          expect(words).toBeLessThanOrEqual(6);
        }

        expect(plan.global_art_direction.palette.length).toBeGreaterThan(0);
        expect(plan.global_art_direction.texture.length).toBeGreaterThan(0);
        expect(plan.global_art_direction.typography_direction.length).toBeGreaterThan(0);
        expect(Array.isArray(plan.review_flags)).toBe(true);
        expect(Array.isArray(plan.global_exclusions)).toBe(true);
      },
    );
  });

  describe('Gate C rejection handling', () => {
    it('returns needs_review status when gate C fails', async () => {
      const env = await runVisualIdeator(baseConfig, null as any, { forceMock: true });
      expect(env.status).toBe('needs_review');
      expect(env.errors.length).toBeGreaterThan(0);
    });
  });
});
