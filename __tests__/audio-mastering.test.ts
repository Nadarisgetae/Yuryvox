import {
  validateGateG,
  validateFinalVideoOutput,
  validateCaptionsOutput,
  validateVoiceoverOutput,
  generateDeterministicMockFinalVideo,
  generateDeterministicMockCaptions,
  generateDeterministicMockVoiceover,
  runAudioMastering,
} from '@/lib/agents/audio-mastering';
import {
  runIdeaAnalyst,
} from '@/lib/agents/idea-analyst';
import { runScriptwriter } from '@/lib/agents/scriptwriter';
import { runVisualIdeator } from '@/lib/agents/visual-ideator';
import { runTimingLayout } from '@/lib/agents/timing-layout';
import { runVideoGenerator } from '@/lib/agents/video-generator';
import { runCompositor } from '@/lib/agents/compositor';
import type { JobConfig, SilentVideoData } from '@/lib/agents/types';
import { presets } from '@/lib/config';

describe('Phase 7: Agent 7 (Audio Mastering)', () => {
  const baseConfig: JobConfig = {
    job_id: 'test-job-audio-001',
    topic: 'How container ships quietly restructured global trade',
    target_seconds: 90,
    aspect_ratios: ['16:9'],
    language: 'en',
    audience: 'general audience',
    tone: 'clear, curious, evidence-led',
    visual_preset: presets.style.id,
    voice: {
      provider: 'elevenlabs',
      voice_id: '21m00Tcm4TlvDq8ikWAM',
      language: 'en',
    },
    music: { enabled: true, track_id: 'ambient-001' },
    budget_limit_usd: 15,
    approval_mode: 'script_and_visual_plan_before_paid_generation',
    provider_config_version: '1.0',
    prompt_version: '1.0',
    seed: 42,
  };

  async function generateFullPipeline(config: JobConfig): Promise<{ silentVideo: { silent_video_url: string; duration_s: number }; script: { scenes: Array<{ narration: string }> } }> {
    const researchEnv = await runIdeaAnalyst(config, { forceMock: true });
    const scriptEnv = await runScriptwriter(config, researchEnv.data, { forceMock: true });
    const vizEnv = await runVisualIdeator(config, scriptEnv.data, { forceMock: true });
    const timingEnv = await runTimingLayout(config, scriptEnv.data, vizEnv.data, { forceMock: true });
    const videoEnv = await runVideoGenerator(config, timingEnv.data, { forceMock: true });
    const compEnv = await runCompositor(config, videoEnv.data, timingEnv.data, { forceMock: true });
    return { silentVideo: compEnv.data, script: { scenes: scriptEnv.data.scenes } };
  }

  describe('Gate G validation', () => {
    it('passes for valid silent video and voice config', async () => {
      const { silentVideo } = await generateFullPipeline(baseConfig);
      const result = validateGateG(baseConfig, silentVideo);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('fails when silent video missing', () => {
      const result = validateGateG(baseConfig, null as any);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'MISSING_SILENT_VIDEO')).toBe(true);
    });

    it('fails when voice_id missing', () => {
      const silentVideo = { silent_video_url: 'https://example.com/silent.mp4', duration_s: 90 };
      const config = { ...baseConfig, voice: { provider: 'elevenlabs', voice_id: '', language: 'en' } };
      const result = validateGateG(config, silentVideo);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'MISSING_VOICE_ID')).toBe(true);
    });
  });

  describe('Output schema validation', () => {
    it('validates final video output', () => {
      const valid = {
        final_video_url: 'https://example.com/final.mp4',
        duration_s: 90,
        loudness_lufs: -14,
        true_peak_dbfs: -1,
      };
      const res = validateFinalVideoOutput(valid);
      expect(res.valid).toBe(true);
    });

    it('catches missing final_video_url', () => {
      const res = validateFinalVideoOutput({ duration_s: 90, loudness_lufs: -14 });
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.code === 'MISSING_FINAL_VIDEO_URL')).toBe(true);
    });

    it('validates captions output', () => {
      const valid = {
        srt_url: 'https://example.com/captions.srt',
        ass_url: 'https://example.com/captions.ass',
        sync_passed: true,
      };
      const res = validateCaptionsOutput(valid);
      expect(res.valid).toBe(true);
    });

    it('catches missing srt_url', () => {
      const res = validateCaptionsOutput({ ass_url: 'url', sync_passed: true });
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.code === 'MISSING_SRT_URL')).toBe(true);
    });

    it('validates voiceover output', () => {
      const valid = {
        voiceover_url: 'https://example.com/voiceover.wav',
        duration_s: 90,
        voice_id: '21m00Tcm4TlvDq8ikWAM',
      };
      const res = validateVoiceoverOutput(valid);
      expect(res.valid).toBe(true);
    });

    it('catches missing voice_id', () => {
      const res = validateVoiceoverOutput({ voiceover_url: 'url', duration_s: 90, voice_id: '' });
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.code === 'MISSING_VOICE_ID')).toBe(true);
    });
  });

  describe('Mock generators', () => {
    it('generates deterministic final video', async () => {
      const { silentVideo } = await generateFullPipeline(baseConfig);
      const finalVideo = generateDeterministicMockFinalVideo(baseConfig, silentVideo);

      expect(finalVideo.final_video_url).toContain(baseConfig.job_id);
      expect(finalVideo.duration_s).toBe(silentVideo.duration_s);
      expect(finalVideo.loudness_lufs).toBe(-14);
      expect(finalVideo.true_peak_dbfs).toBe(-1);

      // Deterministic
      const finalVideo2 = generateDeterministicMockFinalVideo(baseConfig, silentVideo);
      expect(finalVideo.final_video_url).toBe(finalVideo2.final_video_url);
    });

    it('generates deterministic captions', async () => {
      const { silentVideo } = await generateFullPipeline(baseConfig);
      const captions = generateDeterministicMockCaptions(baseConfig, silentVideo);

      expect(captions.srt_url).toContain(baseConfig.job_id);
      expect(captions.ass_url).toContain(baseConfig.job_id);
      expect(captions.sync_passed).toBe(true);
    });

    it('generates deterministic voiceover', async () => {
      const { script } = await generateFullPipeline(baseConfig);
      const voiceover = generateDeterministicMockVoiceover(baseConfig, script);

      expect(voiceover.voiceover_url).toContain(baseConfig.job_id);
      expect(voiceover.duration_s).toBeGreaterThan(0);
      expect(voiceover.voice_id).toBe(baseConfig.voice.voice_id);
    });
  });

  describe('End-to-end execution on three sample topics', () => {
    const sampleTopics = [
      'How container ships quietly restructured global trade',
      'The forgotten paper maps that created modern property lines',
      'Why electric grid frequencies must never drift from 60 Hz',
    ];

    test.each(sampleTopics)(
      'generates final video from silent video for: %s',
      async (topic) => {
        const config: JobConfig = {
          ...baseConfig,
          job_id: `test-audio-${Date.now()}`,
          topic,
        };

        const { silentVideo, script } = await generateFullPipeline(config);
        const audioEnv = await runAudioMastering(config, silentVideo, script, { forceMock: true });

        expect(audioEnv.status).toBe('completed');
        expect(audioEnv.stage).toBe('audio_mastering');
        expect(audioEnv.schema_version).toBe('1.0');
        expect(audioEnv.data).toBeDefined();

        const finalVideo = audioEnv.data;

        // Acceptance criteria
        expect(finalVideo.final_video_url).toContain(config.job_id);
        expect(finalVideo.duration_s).toBeCloseTo(silentVideo.duration_s, 1);
        expect(finalVideo.loudness_lufs).toBe(-14);
        expect(finalVideo.true_peak_dbfs).toBe(-1);
      },
    );
  });

  describe('Gate G rejection handling', () => {
    it('returns needs_review when gate G fails', async () => {
      const env = await runAudioMastering(baseConfig, null as any, { scenes: [] }, { forceMock: true });
      expect(env.status).toBe('needs_review');
      expect(env.errors.length).toBeGreaterThan(0);
    });
  });
});

// Helper: generate full pipeline for testing
async function generateFullPipeline(config: JobConfig): Promise<{ silentVideo: { silent_video_url: string; duration_s: number }; script: { scenes: Array<{ narration: string }> } }> {
  const { runIdeaAnalyst } = await import('@/lib/agents/idea-analyst');
  const { runScriptwriter } = await import('@/lib/agents/scriptwriter');
  const { runVisualIdeator } = await import('@/lib/agents/visual-ideator');
  const { runTimingLayout } = await import('@/lib/agents/timing-layout');
  const { runVideoGenerator } = await import('@/lib/agents/video-generator');
  const { runCompositor } = await import('@/lib/agents/compositor');

  const researchEnv = await runIdeaAnalyst(config, { forceMock: true });
  const scriptEnv = await runScriptwriter(config, researchEnv.data, { forceMock: true });
  const vizEnv = await runVisualIdeator(config, scriptEnv.data, { forceMock: true });
  const timingEnv = await runTimingLayout(config, scriptEnv.data, vizEnv.data, { forceMock: true });
  const videoEnv = await runVideoGenerator(config, timingEnv.data, { forceMock: true });
  const compEnv = await runCompositor(config, videoEnv.data, timingEnv.data, { forceMock: true });
  return { silentVideo: compEnv.data, script: { scenes: scriptEnv.data.scenes } };
}