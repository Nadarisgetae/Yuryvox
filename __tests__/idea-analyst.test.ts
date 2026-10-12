import {
  validateGateA,
  validateResearchOutput,
  runIdeaAnalyst,
  buildIdeaAnalystPrompt,
} from '@/lib/agents/idea-analyst';
import type { JobConfig } from '@/lib/agents/types';
import { presets } from '@/lib/config';

describe('Phase 2: Agent 1 (Idea Analyst)', () => {
  const baseConfig: JobConfig = {
    job_id: 'test-job-001',
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

  describe('Gate A validation', () => {
    it('passes for a valid complete job config', () => {
      const result = validateGateA(baseConfig);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects empty topic', () => {
      const result = validateGateA({ ...baseConfig, topic: '   ' });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'MISSING_TOPIC')).toBe(true);
    });

    it('rejects invalid target_seconds', () => {
      const result = validateGateA({ ...baseConfig, target_seconds: 0 });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'INVALID_TARGET_SECONDS')).toBe(true);
    });

    it('rejects empty aspect_ratios', () => {
      const result = validateGateA({ ...baseConfig, aspect_ratios: [] });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'INVALID_ASPECT_RATIOS')).toBe(true);
    });

    it('rejects negative budget', () => {
      const result = validateGateA({ ...baseConfig, budget_limit_usd: -5 });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'INVALID_BUDGET')).toBe(true);
    });
  });

  describe('Prompt building', () => {
    it('constructs prompt with topic, schema, and strict truth constraints', () => {
      const { systemPrompt, userPrompt } = buildIdeaAnalystPrompt(baseConfig);
      expect(systemPrompt).toContain('Vox-style archival-collage explainer');
      expect(systemPrompt).toContain('Never invent citations');
      expect(userPrompt).toContain(baseConfig.topic);
      expect(userPrompt).toContain('90 seconds');
    });
  });

  describe('Output schema validation', () => {
    it('detects missing angles', () => {
      const invalid = { angles: [] };
      const res = validateResearchOutput(invalid);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.code === 'MISSING_ANGLES')).toBe(true);
    });

    it('detects mismatched recommended_angle_id', () => {
      const invalid = {
        angles: [{ angle_id: 'A1', title: 'T', central_question: 'Q', summary: 'S' }],
        recommended_angle_id: 'A999',
        claims: [{ claim_id: 'C1', claim: 'Claim', support_status: 'supported' }],
        hooks: [],
        sources: [],
      };
      const res = validateResearchOutput(invalid);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.code === 'INVALID_RECOMMENDED_ANGLE')).toBe(true);
    });
  });

  describe('Three sample topics execution (Mock / Deterministic)', () => {
    const sampleTopics = [
      'How container ships quietly restructured global trade',
      'The forgotten paper maps that created modern property lines',
      'Why electric grid frequencies must never drift from 60 Hz',
    ];

    test.each(sampleTopics)('produces compliant research envelope for: %s', async (topic) => {
      const config: JobConfig = {
        ...baseConfig,
        job_id: `test-topic-${Date.now()}`,
        topic,
      };

      const envelope = await runIdeaAnalyst(config, { forceMock: true });

      expect(envelope.status).toBe('completed');
      expect(envelope.stage).toBe('idea_analyst');
      expect(envelope.schema_version).toBe('1.0');
      expect(envelope.data).toBeDefined();

      const research = envelope.data;

      // Acceptance criterion 1: 3 distinct angles with central questions
      expect(research.angles).toHaveLength(3);
      const angleIds = research.angles.map((a) => a.angle_id);
      expect(angleIds).toEqual(['A1', 'A2', 'A3']);
      expect(research.angles.every((a) => a.central_question.length > 10)).toBe(true);

      // Acceptance criterion 2: Recommended angle exists
      expect(angleIds).toContain(research.recommended_angle_id);

      // Acceptance criterion 3: Hooks are proposals with valid types
      expect(research.hooks.length).toBeGreaterThanOrEqual(3);
      for (const hook of research.hooks) {
        expect(['question', 'surprising_fact', 'contradiction', 'story']).toContain(hook.type);
        expect(hook.supporting_claim_ids.length).toBeGreaterThan(0);
      }

      // Acceptance criterion 4: Claims have claim_id, claim text, and explicit support_status
      expect(research.claims.length).toBeGreaterThanOrEqual(4);
      const claimIds = new Set(research.claims.map((c) => c.claim_id));
      for (const claim of research.claims) {
        expect(claim.claim_id).toMatch(/^C\d+$/);
        expect(claim.claim.length).toBeGreaterThan(15);
        expect([
          'supported',
          'partially_supported',
          'unsupported',
          'conflicting',
          'source_unavailable',
        ]).toContain(claim.support_status);
      }

      // Acceptance criterion 5: Hooks map to existing claim IDs
      for (const hook of research.hooks) {
        for (const cid of hook.supporting_claim_ids) {
          expect(claimIds.has(cid)).toBe(true);
        }
      }

      // Acceptance criterion 6: Sources have valid URLs or documented status
      expect(research.sources.length).toBeGreaterThanOrEqual(2);
      for (const source of research.sources) {
        expect(source.source_id).toMatch(/^S\d+$/);
        expect(source.url.startsWith('http') || source.url === 'source_unavailable').toBe(true);
      }

      // Acceptance criterion 7: Research gaps explicit
      expect(research.research_gaps.length).toBeGreaterThan(0);
    });
  });

  describe('Gate A rejection handling', () => {
    it('returns needs_input status when gate A fails', async () => {
      const invalidConfig = { ...baseConfig, topic: '' };
      const envelope = await runIdeaAnalyst(invalidConfig);
      expect(envelope.status).toBe('needs_input');
      expect(envelope.errors.length).toBeGreaterThan(0);
    });
  });
});
