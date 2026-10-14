import {
  calculateDuration,
  calculateTargetWordCount,
  countWords,
  validateGateB,
  validateScriptOutput,
  runScriptwriter,
  buildScriptwriterPrompt,
} from '@/lib/agents/scriptwriter';
import { runIdeaAnalyst } from '@/lib/agents/idea-analyst';
import type { JobConfig } from '@/lib/agents/types';
import { presets } from '@/lib/config';

describe('Phase 3: Agent 2 (Scriptwriter)', () => {
  const baseConfig: JobConfig = {
    job_id: 'test-job-script-001',
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

  describe('Pacing and duration calculations', () => {
    it('correctly calculates words and durations at 145 wpm', () => {
      expect(calculateTargetWordCount(90, 145)).toBe(218);
      expect(calculateTargetWordCount(60, 145)).toBe(145);
      expect(calculateDuration(145, 145)).toBe(60);
      expect(countWords('This is a four word test')).toBe(6);
      expect(countWords('   ')).toBe(0);
    });
  });

  describe('Gate B validation', () => {
    it('fails when research data is missing', () => {
      const result = validateGateB(baseConfig, null as any);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'MISSING_RESEARCH_DATA')).toBe(true);
    });

    it('fails when research has no angles', () => {
      const result = validateGateB(baseConfig, {
        angles: [],
        claims: [{ claim_id: 'C1', claim: 'text', claim_type: 'fact', support_status: 'supported', source_ids: [], evidence_summary: '', caveat: null }],
        hooks: [],
        sources: [],
        recommended_angle_id: '',
        research_gaps: [],
        sensitivity_flags: [],
        recommended_narrative: '',
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'NO_RESEARCH_ANGLES')).toBe(true);
    });

    it('fails when research has no claims', () => {
      const result = validateGateB(baseConfig, {
        angles: [{ angle_id: 'A1', title: 'T', central_question: 'Q', summary: 'S', strengths: [], evidence_gaps: [] }],
        claims: [],
        hooks: [],
        sources: [],
        recommended_angle_id: 'A1',
        research_gaps: [],
        sensitivity_flags: [],
        recommended_narrative: '',
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'NO_RESEARCH_CLAIMS')).toBe(true);
    });
  });

  describe('Output schema validation', () => {
    it('catches missing scenes', () => {
      const invalid = { title: 'Test', central_thesis: 'Thesis', scenes: [] };
      const res = validateScriptOutput(invalid);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.code === 'MISSING_SCENES')).toBe(true);
    });

    it('catches invalid narrative function', () => {
      const invalid = {
        title: 'Test',
        central_thesis: 'Thesis',
        scenes: [
          {
            scene_id: 'SC01',
            narration: 'Hello world',
            narrative_function: 'dance_break' as any,
          },
        ],
      };
      const res = validateScriptOutput(invalid);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.code === 'INVALID_NARRATIVE_FUNCTION')).toBe(true);
    });
  });

  describe('Prompt builder', () => {
    it('creates prompt containing angle, target word count, and claim IDs', async () => {
      const researchEnv = await runIdeaAnalyst(baseConfig, { forceMock: true });
      const { systemPrompt, userPrompt } = buildScriptwriterPrompt(baseConfig, researchEnv.data);

      expect(systemPrompt).toContain('Vox-style archival-collage explainer');
      expect(systemPrompt).toContain('Target word count: Exactly 218 words');
      expect(userPrompt).toContain(baseConfig.topic);
      expect(userPrompt).toContain('C1');
    });
  });

  describe('End-to-end execution on three sample topics', () => {
    const sampleTopics = [
      'How container ships quietly restructured global trade',
      'The forgotten paper maps that created modern property lines',
      'Why electric grid frequencies must never drift from 60 Hz',
    ];

    test.each(sampleTopics)('generates valid script from research for: %s', async (topic) => {
      const config: JobConfig = {
        ...baseConfig,
        job_id: `test-script-${Date.now()}`,
        topic,
      };

      // 1. Generate Research (Agent 1)
      const researchEnv = await runIdeaAnalyst(config, { forceMock: true });
      expect(researchEnv.status).toBe('completed');

      // 2. Generate Script (Agent 2)
      const scriptEnv = await runScriptwriter(config, researchEnv.data, { forceMock: true });

      expect(scriptEnv.status).toBe('completed');
      expect(scriptEnv.stage).toBe('scriptwriter');
      expect(scriptEnv.schema_version).toBe('1.0');
      expect(scriptEnv.data).toBeDefined();

      const scriptData = scriptEnv.data;

      // Acceptance criterion 1: Central thesis and narrative arc
      expect(scriptData.title.length).toBeGreaterThan(5);
      expect(scriptData.central_thesis.length).toBeGreaterThan(10);
      expect(scriptData.logline.length).toBeGreaterThan(10);

      // Acceptance criterion 2: Script length and scene count
      expect(scriptData.scenes.length).toBeGreaterThanOrEqual(5);
      expect(scriptData.estimated_word_count).toBeGreaterThan(50);
      expect(typeof scriptData.runtime_deviation_seconds).toBe('number');

      // Acceptance criterion 3: Scene structure & narrative functions
      const narrativeFunctions = scriptData.scenes.map((s) => s.narrative_function);
      expect(narrativeFunctions).toContain('hook');
      expect(narrativeFunctions).toContain('explanation');
      expect(narrativeFunctions).toContain('evidence');
      expect(narrativeFunctions).toContain('payoff');

      // Acceptance criterion 4: Claim traceability
      const researchClaimIds = new Set(researchEnv.data.claims.map((c) => c.claim_id));
      for (const scene of scriptData.scenes) {
        expect(scene.scene_id).toMatch(/^SC\d+$/);
        expect(scene.narration.length).toBeGreaterThan(10);
        expect(scene.on_screen_text_suggestion.length).toBeGreaterThan(0);
        expect(scene.visual_concept.length).toBeGreaterThan(10);

        // All cited claims must exist in research
        for (const cid of scene.claim_ids) {
          expect(researchClaimIds.has(cid)).toBe(true);
        }
      }

      // Acceptance criterion 1: Script length within 5% of target word count
      const targetWords = calculateTargetWordCount(config.target_seconds);
      const pctDiff =
        Math.abs(scriptData.estimated_word_count - targetWords) / targetWords;
      expect(pctDiff).toBeLessThanOrEqual(0.05);

      // Acceptance criterion 2: Scenes within 10-60 words (4-8s shot rule: 10-19 words target, allow up to 60)
      for (const scene of scriptData.scenes) {
        const words = countWords(scene.narration);
        expect(words).toBeGreaterThanOrEqual(10);
        expect(words).toBeLessThanOrEqual(60);
      }
    });
  });
});
