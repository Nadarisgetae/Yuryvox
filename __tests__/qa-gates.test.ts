import { runIdeaAnalyst, validateGateA } from '@/lib/agents/idea-analyst';
import { runScriptwriter, validateGateB } from '@/lib/agents/scriptwriter';
import { runVisualIdeator, validateGateC } from '@/lib/agents/visual-ideator';
import { runTimingLayout, validateGateD } from '@/lib/agents/timing-layout';
import { runVideoGenerator, validateGateE } from '@/lib/agents/video-generator';
import { runCompositor, validateGateF } from '@/lib/agents/compositor';
import {
  runAudioMastering,
  validateGateG,
  validateFinalVideoOutput,
  validateCaptionsOutput,
  validateVoiceoverOutput,
} from '@/lib/agents/audio-mastering';
import type { JobConfig } from '@/lib/agents/types';
import { presets } from '@/lib/config';

describe('Phase 9: QA Gates & Pipeline Validation', () => {
  const baseConfig: JobConfig = {
    job_id: 'test-job-qa-001',
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

  async function generateFullPipeline(config: JobConfig) {
    const researchEnv = await runIdeaAnalyst(config, { forceMock: true });
    const scriptEnv = await runScriptwriter(config, researchEnv.data, { forceMock: true });
    const vizEnv = await runVisualIdeator(config, scriptEnv.data, { forceMock: true });
    const timingEnv = await runTimingLayout(config, scriptEnv.data, vizEnv.data, { forceMock: true });
    const videoEnv = await runVideoGenerator(config, timingEnv.data, { forceMock: true });
    const compEnv = await runCompositor(config, videoEnv.data, timingEnv.data, { forceMock: true });
    const audioEnv = await runAudioMastering(config, compEnv.data, scriptEnv.data, { forceMock: true });
    return {
      researchEnv,
      scriptEnv,
      vizEnv,
      timingEnv,
      videoEnv,
      compEnv,
      audioEnv,
    };
  }

  describe('Gates A through G Pre-flight Validation', () => {
    it('validates Gate A (Idea Analyst requirements)', () => {
      const gateA = validateGateA(baseConfig);
      expect(gateA.valid).toBe(true);
      expect(gateA.errors).toHaveLength(0);
    });

    it('validates Gate B (Scriptwriter input requirements)', async () => {
      const researchEnv = await runIdeaAnalyst(baseConfig, { forceMock: true });
      const gateB = validateGateB(baseConfig, researchEnv.data);
      expect(gateB.valid).toBe(true);
      expect(gateB.errors).toHaveLength(0);
    });

    it('validates Gate C (Visual Ideator input requirements)', async () => {
      const researchEnv = await runIdeaAnalyst(baseConfig, { forceMock: true });
      const scriptEnv = await runScriptwriter(baseConfig, researchEnv.data, { forceMock: true });
      const gateC = validateGateC(baseConfig, scriptEnv.data);
      expect(gateC.valid).toBe(true);
      expect(gateC.errors).toHaveLength(0);
    });

    it('validates Gate D (Timing & Layout input requirements)', async () => {
      const researchEnv = await runIdeaAnalyst(baseConfig, { forceMock: true });
      const scriptEnv = await runScriptwriter(baseConfig, researchEnv.data, { forceMock: true });
      const vizEnv = await runVisualIdeator(baseConfig, scriptEnv.data, { forceMock: true });
      const gateD = validateGateD(baseConfig, scriptEnv.data, vizEnv.data);
      expect(gateD.valid).toBe(true);
      expect(gateD.errors).toHaveLength(0);
    });

    it('validates Gate E (Video Generator input requirements)', async () => {
      const researchEnv = await runIdeaAnalyst(baseConfig, { forceMock: true });
      const scriptEnv = await runScriptwriter(baseConfig, researchEnv.data, { forceMock: true });
      const vizEnv = await runVisualIdeator(baseConfig, scriptEnv.data, { forceMock: true });
      const timingEnv = await runTimingLayout(baseConfig, scriptEnv.data, vizEnv.data, { forceMock: true });
      const gateE = validateGateE(baseConfig, timingEnv.data);
      expect(gateE.valid).toBe(true);
      expect(gateE.errors).toHaveLength(0);
    });

    it('validates Gate F (Compositor input requirements)', async () => {
      const researchEnv = await runIdeaAnalyst(baseConfig, { forceMock: true });
      const scriptEnv = await runScriptwriter(baseConfig, researchEnv.data, { forceMock: true });
      const vizEnv = await runVisualIdeator(baseConfig, scriptEnv.data, { forceMock: true });
      const timingEnv = await runTimingLayout(baseConfig, scriptEnv.data, vizEnv.data, { forceMock: true });
      const videoEnv = await runVideoGenerator(baseConfig, timingEnv.data, { forceMock: true });
      const gateF = validateGateF(baseConfig, videoEnv.data, timingEnv.data);
      expect(gateF.valid).toBe(true);
      expect(gateF.errors).toHaveLength(0);
    });

    it('validates Gate G (Audio Mastering input requirements)', () => {
      const gateResult = validateGateG(baseConfig, {
        silent_video_url: 'https://example.com/video.mp4',
        duration_s: 90,
      });
      expect(gateResult.valid).toBe(true);
      expect(gateResult.errors).toHaveLength(0);
    });
  });

  describe('Audio & Final Media Output Validators', () => {
    it('validates final video output schema', () => {
      const valid = {
        final_video_url: 'https://example.com/final.mp4',
        duration_s: 90,
        loudness_lufs: -14,
        true_peak_dbfs: -1,
      };
      const res = validateFinalVideoOutput(valid);
      expect(res.valid).toBe(true);
      expect(res.errors).toHaveLength(0);
    });

    it('validates captions output schema', () => {
      const valid = {
        srt_url: 'https://example.com/captions.srt',
        ass_url: 'https://example.com/captions.ass',
        sync_passed: true,
      };
      const res = validateCaptionsOutput(valid);
      expect(res.valid).toBe(true);
      expect(res.errors).toHaveLength(0);
    });

    it('validates voiceover output schema', () => {
      const valid = {
        voiceover_url: 'https://example.com/voiceover.wav',
        duration_s: 90,
        voice_id: '21m00Tcm4TlvDq8ikWAM',
      };
      const res = validateVoiceoverOutput(valid);
      expect(res.valid).toBe(true);
      expect(res.errors).toHaveLength(0);
    });
  });

  describe('End-to-End QA Pipeline Across 3 Sample Topics', () => {
    const sampleTopics = [
      'How container ships quietly restructured global trade',
      'The forgotten paper maps that created modern property lines',
      'Why electric grid frequencies must never drift from 60 Hz',
    ];

    test.each(sampleTopics)(
      'passes all pipeline QA gates for: %s',
      async (topic) => {
        const config: JobConfig = {
          ...baseConfig,
          job_id: `qa-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          topic,
        };

        const { timingEnv, compEnv, audioEnv } = await generateFullPipeline(config);

        // Stage completion
        expect(timingEnv.status).toBe('completed');
        expect(compEnv.status).toBe('completed');
        expect(audioEnv.status).toBe('completed');

        // Duration calibration QA
        expect(timingEnv.data.planned_seconds).toBeCloseTo(config.target_seconds, 1);
        expect(compEnv.data.duration_s).toBeCloseTo(config.target_seconds, 1);
        expect(audioEnv.data.duration_s).toBeCloseTo(config.target_seconds, 1);

        // Loudness QA check
        expect(audioEnv.data.loudness_lufs).toBe(-14);
        expect(audioEnv.data.true_peak_dbfs).toBe(-1);

        // Artifact URLs present
        expect(compEnv.data.silent_video_url).toContain(config.job_id);
        expect(audioEnv.data.final_video_url).toContain(config.job_id);
      },
    );
  });
});