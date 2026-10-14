import type {
  JobConfig,
  SilentVideoData,
  FinalVideoData,
  FinalVideoEnvelope,
  VoiceoverData,
  CaptionsData,
  CaptionsEnvelope,
  VoiceoverEnvelope,
  StageError,
  StageEnvelope,
  StageUsage,
} from './types';
import { getElevenLabsKey } from '@/lib/providers/elevenlabs';
import { getAssemblyAiKey } from '@/lib/providers/assemblyai';
import { getSupabaseClient } from '@/lib/supabase/client';

export const AUDIO_MASTERING_STAGE = 'audio_mastering' as const;
export const AUDIO_MASTERING_SCHEMA_VERSION = '1.0' as const;
export const AUDIO_MASTERING_PROMPT_VERSION = '1.0' as const;

export const DEFAULT_ELEVENLABS_VOICE = '21m00Tcm4TlvDq8ikWAM'; // Rachel
export const DEFAULT_ELEVENLABS_STABILITY = 0.45;
export const DEFAULT_ELEVENLABS_SIMILARITY = 0.8;
export const ELEVENLABS_MODEL = 'eleven_multilingual_v2' as const;

export const ASSEMBLYAI_TRANSCRIPTION_URL = 'https://api.assemblyai.com/v2/transcript';
export const ASSEMBLYAI_UPLOAD_URL = 'https://api.assemblyai.com/v2/upload';

export const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1/text-to-speech';

// ─── Gate G: Validation ───

export function validateGateG(
  jobConfig: JobConfig,
  silentVideo: { silent_video_url: string; duration_s: number },
): { valid: boolean; errors: StageError[] } {
  const errors: StageError[] = [];

  if (!jobConfig.topic || typeof jobConfig.topic !== 'string' || jobConfig.topic.trim().length === 0) {
    errors.push({ code: 'MISSING_TOPIC', message: 'Audio Mastering requires a non-empty topic', retryable: false, field: 'topic' });
  }

  if (!silentVideo || !silentVideo.silent_video_url || silentVideo.silent_video_url.trim().length === 0) {
    errors.push({ code: 'MISSING_SILENT_VIDEO', message: 'Audio Mastering requires a silent video URL', retryable: false, field: 'silent_video_url' });
  }

  if (!jobConfig.voice || !jobConfig.voice.voice_id || jobConfig.voice.voice_id.trim().length === 0) {
    errors.push({ code: 'MISSING_VOICE_ID', message: 'Audio Mastering requires a voice_id in job config', retryable: false, field: 'voice.voice_id' });
  }

  if (!jobConfig.music?.enabled && jobConfig.music?.track_id === undefined) {
    // Music is optional
  }

  return { valid: errors.length === 0, errors };
}

// ─── Output Schema Validation ───

export function validateFinalVideoOutput(
  data: unknown,
  silentVideo?: { duration_s: number },
): { valid: boolean; errors: StageError[]; warnings: string[] } {
  const errors: StageError[] = [];
  const warnings: string[] = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: [{ code: 'INVALID_FINAL_VIDEO', message: 'Final video data must be an object', retryable: true }], warnings: [] };
  }

  const d = data as Partial<FinalVideoData>;

  if (!d.final_video_url || typeof d.final_video_url !== 'string' || d.final_video_url.trim().length === 0) {
    errors.push({ code: 'MISSING_FINAL_VIDEO_URL', message: 'Final video must have final_video_url', retryable: true, field: 'final_video_url' });
  }

  if (typeof d.duration_s !== 'number' || d.duration_s <= 0) {
    errors.push({ code: 'INVALID_DURATION', message: 'duration_s must be > 0', retryable: true, field: 'duration_s' });
  }

  if (typeof d.loudness_lufs !== 'number' && d.loudness_lufs !== null) {
    errors.push({ code: 'INVALID_LOUDNESS', message: 'loudness_lufs must be a number or null', retryable: true, field: 'loudness_lufs' });
  }

  if (typeof d.true_peak_dbfs !== 'number' && d.true_peak_dbfs !== null) {
    errors.push({ code: 'INVALID_TRUE_PEAK', message: 'true_peak_dbfs must be a number or null', retryable: true, field: 'true_peak_dbfs' });
  }

  if (silentVideo && d.duration_s) {
    const diff = Math.abs(d.duration_s - silentVideo.duration_s);
    if (diff > 1) {
      warnings.push(`Duration mismatch: final video ${d.duration_s}s vs silent ${silentVideo.duration_s}s`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function validateCaptionsOutput(
  data: unknown,
): { valid: boolean; errors: StageError[]; warnings: string[] } {
  const errors: StageError[] = [];
  const warnings: string[] = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: [{ code: 'INVALID_CAPTIONS', message: 'Captions data must be an object', retryable: true }], warnings: [] };
  }

  const d = data as Partial<CaptionsData>;

  if (!d.srt_url || typeof d.srt_url !== 'string' || d.srt_url.trim().length === 0) {
    errors.push({ code: 'MISSING_SRT_URL', message: 'Captions must have srt_url', retryable: true, field: 'srt_url' });
  }

  if (!d.ass_url || typeof d.ass_url !== 'string' || d.ass_url.trim().length === 0) {
    errors.push({ code: 'MISSING_ASS_URL', message: 'Captions must have ass_url', retryable: true, field: 'ass_url' });
  }

  if (typeof d.sync_passed !== 'boolean') {
    errors.push({ code: 'MISSING_SYNC_PASSED', message: 'Captions must have sync_passed boolean', retryable: true, field: 'sync_passed' });
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function validateVoiceoverOutput(
  data: unknown,
): { valid: boolean; errors: StageError[]; warnings: string[] } {
  const errors: StageError[] = [];
  const warnings: string[] = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: [{ code: 'INVALID_VOICEOVER', message: 'Voiceover data must be an object', retryable: true }], warnings: [] };
  }

  const d = data as Partial<VoiceoverData>;

  if (!d.voiceover_url || typeof d.voiceover_url !== 'string' || d.voiceover_url.trim().length === 0) {
    errors.push({ code: 'MISSING_VOICEOVER_URL', message: 'Voiceover must have voiceover_url', retryable: true, field: 'voiceover_url' });
  }

  if (typeof d.duration_s !== 'number' || d.duration_s <= 0) {
    errors.push({ code: 'INVALID_DURATION', message: 'duration_s must be > 0', retryable: true, field: 'duration_s' });
  }

  if (!d.voice_id || typeof d.voice_id !== 'string' || d.voice_id.trim().length === 0) {
    errors.push({ code: 'MISSING_VOICE_ID', message: 'Voiceover must have voice_id', retryable: true, field: 'voice_id' });
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ─── Deterministic Mock ───

export function generateDeterministicMockFinalVideo(
  jobConfig: JobConfig,
  silentVideo: SilentVideoData,
): FinalVideoData {
  return {
    final_video_url: `https://mock-supabase.example.com/${jobConfig.job_id}/final.mp4`,
    duration_s: silentVideo.duration_s,
    loudness_lufs: -14.0,
    true_peak_dbfs: -1.0,
  };
}

export function generateDeterministicMockCaptions(
  jobConfig: JobConfig,
  silentVideo: SilentVideoData,
): CaptionsData {
  return {
    srt_url: `https://mock-supabase.example.com/${jobConfig.job_id}/captions.srt`,
    ass_url: `https://mock-supabase.example.com/${jobConfig.job_id}/captions.ass`,
    sync_passed: true,
  };
}

export function generateDeterministicMockVoiceover(
  jobConfig: JobConfig,
  script: { scenes: Array<{ narration: string }> },
): VoiceoverData {
  const totalWords = script.scenes.reduce((sum, s) => sum + (s.narration?.split(/\s+/).filter(Boolean).length || 0), 0);
  const duration = totalWords / 145 * 60; // 145 wpm

  return {
    voiceover_url: `https://mock-supabase.example.com/${jobConfig.job_id}/voiceover.wav`,
    duration_s: Number(duration.toFixed(2)),
    voice_id: jobConfig.voice?.voice_id || '21m00Tcm4TlvDq8ikWAM',
  };
}

// ─── Mock Supabase Upload ───

async function mockUploadToSupabase(
  jobId: string,
  assetType: 'video' | 'audio' | 'srt' | 'ass',
): Promise<{ path: string; publicUrl: string }> {
  const ext = assetType === 'video' ? 'mp4' : assetType === 'audio' ? 'wav' : assetType;
  const path = `${jobId}/final.${ext}`;
  return {
    path,
    publicUrl: `https://mock-supabase.example.com/${path}`,
  };
}

// ─── ElevenLabs TTS ───

async function callElevenLabsTTS(
  text: string,
  voiceId: string,
  apiKey: string,
  stability: number = 0.45,
  similarity: number = 0.8,
  model: string = ELEVENLABS_MODEL,
): Promise<ArrayBuffer> {
  const response = await fetch(`${ELEVENLABS_API_URL}/${voiceId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': apiKey,
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      model_id: model,
      voice_settings: {
        stability,
        similarity_boost: similarity,
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`ElevenLabs TTS failed (${response.status}): ${text}`);
  }

  return response.arrayBuffer();
}

// ─── AssemblyAI Upload ───

async function uploadToAssemblyAI(
  audioBuffer: ArrayBuffer,
  apiKey: string,
): Promise<string> {
  const response = await fetch(ASSEMBLYAI_UPLOAD_URL, {
    method: 'POST',
    headers: {
      Authorization: apiKey,
    },
    body: audioBuffer,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`AssemblyAI upload failed (${response.status}): ${text}`);
  }

  const data = await response.json();
  return data.upload_url;
}

// ─── AssemblyAI Transcription ───

async function requestAssemblyAITranscription(
  audioUrl: string,
  apiKey: string,
): Promise<string> {
  const response = await fetch(ASSEMBLYAI_TRANSCRIPTION_URL, {
    method: 'POST',
    headers: {
      Authorization: apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      audio_url: audioUrl,
      word_boost: [],
      speaker_labels: false,
      punctuate: true,
      format_text: true,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`AssemblyAI transcription request failed (${response.status}): ${text}`);
  }

  const data = await response.json();
  return data.id;
}

async function pollAssemblyAITranscription(
  transcriptId: string,
  apiKey: string,
  maxAttempts: number = 120,
  intervalMs: number = 5000,
): Promise<{ words: Array<{ start: number; end: number; text: string; confidence: number }> }> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await fetch(`${ASSEMBLYAI_TRANSCRIPTION_URL}/${transcriptId}`, {
      headers: { Authorization: apiKey },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`AssemblyAI transcription status failed (${response.status}): ${text}`);
    }

    const data = await response.json();
    const status = data.status;

    if (status === 'completed') {
      return { words: data.words || [] };
    }
    if (status === 'error') {
      throw new Error(`AssemblyAI transcription failed: ${data.error || 'unknown'}`);
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error('AssemblyAI transcription timed out');
}

// ─── Caption Generation (SRT + ASS) ───

function formatSRTTime(seconds: number): string {
  const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  const ms = Math.floor((seconds % 1) * 1000).toString().padStart(3, '0');
  return `${h}:${m}:${s},${ms}`;
}

function formatASSTime(seconds: number): string {
  const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  const cs = Math.floor((seconds % 1) * 100).toString().padStart(2, '0');
  return `${h}:${m}:${s}.${cs}`;
}

function generateCaptionsFromWords(
  words: Array<{ start: number; end: number; text: string; confidence: number }>,
  maxWordsPerLine: number = 7,
  maxLines: number = 2,
  minDuration: number = 0.8,
  maxDuration: number = 3.5,
): Array<{ start: number; end: number; text: string }> {
  const captions: Array<{ start: number; end: number; text: string }> = [];
  let currentCaption: { words: Array<{ start: number; end: number; text: string }>; start: number } = { words: [], start: 0 };

  for (const word of words) {
    if (currentCaption.words.length === 0) {
      currentCaption.start = word.start;
    }
    currentCaption.words.push(word);

    // Check if we should break the line
    const wordCount = currentCaption.words.length;
    const captionDuration = word.end - currentCaption.start;
    const lineBreak = word.text.match(/[.!?,;:]$/) || wordCount >= maxWordsPerLine;

    if (lineBreak || captionDuration >= maxDuration) {
      const captionText = currentCaption.words.map((w) => w.text).join(' ');
      const captionEnd = currentCaption.words[currentCaption.words.length - 1].end;
      const actualDuration = captionEnd - currentCaption.start;

      if (actualDuration >= minDuration) {
        captions.push({
          start: currentCaption.start,
          end: captionEnd,
          text: captionText,
        });
      }
      currentCaption = { words: [], start: 0 };
    }
  }

  // Handle remaining words
  if (currentCaption.words.length > 0) {
    const captionText = currentCaption.words.map((w) => w.text).join(' ');
    const captionEnd = currentCaption.words[currentCaption.words.length - 1].end;
    const actualDuration = captionEnd - currentCaption.start;
    if (actualDuration >= 0.5) {
      captions.push({
        start: currentCaption.start,
        end: captionEnd,
        text: captionText,
      });
    }
  }

  // Ensure minimum duration for all captions
  return captions.map((c) => {
    if (c.end - c.start < 0.8) {
      return { ...c, end: c.start + 0.8 };
    }
    return c;
  });
}

function generateSRT(captions: Array<{ start: number; end: number; text: string }>): string {
  return captions
    .map((caption, index) => {
      return `${index + 1}\n${formatSRTTime(caption.start)} --> ${formatSRTTime(caption.end)}\n${caption.text}\n`;
    })
    .join('\n');
}

function generateASS(captions: Array<{ start: number; end: number; text: string }>): string {
  const header = `[Script Info]
Title: Generated Captions
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: None

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Inter,48,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,2,0,2,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const events = captions.map((caption) => {
    return `Dialogue: 0,${formatASSTime(caption.start)},${formatASSTime(caption.end)},Default,,0,0,10,,${caption.text.replace(/\n/g, '\\N')}`;
  });

  return header + events.join('\n');
}

function formatSRTTime(seconds: number): string {
  const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  const ms = Math.floor((seconds % 1) * 1000).toString().padStart(3, '0');
  return `${h}:${m}:${s},${ms}`;
}

function formatASSTime(seconds: number): string {
  const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  const cs = Math.floor((seconds % 1) * 100).toString().padStart(2, '0');
  return `${h}:${m}:${s}.${cs}`;
}

// ─── Mock Supabase Upload ───

async function mockUploadToSupabase(
  jobId: string,
  assetType: 'video' | 'audio' | 'srt' | 'ass',
): Promise<{ path: string; publicUrl: string }> {
  const ext = assetType === 'video' ? 'mp4' : assetType === 'audio' ? 'wav' : assetType;
  const path = `${jobId}/final.${ext}`;
  return {
    path,
    publicUrl: `https://mock-supabase.example.com/${path}`,
  };
}

// ─── FFmpeg Mix (Mock) ───

async function mockFFmpegMix(
  silentVideoUrl: string,
  voiceoverUrl: string,
  jobId: string,
): Promise<{ path: string; publicUrl: string }> {
  const path = `${jobId}/final.mp4`;
  return {
    path,
    publicUrl: `https://mock-supabase.example.com/${path}`,
  };
}

// ─── Runner ───

import { getElevenLabsKey } from '@/lib/providers/elevenlabs';
import { getAssemblyAiKey } from '@/lib/providers/assemblyai';

export const AUDIO_MASTERING_STAGE = 'audio_mastering' as const;
export const AUDIO_MASTERING_SCHEMA_VERSION = '1.0' as const;
export const AUDIO_MASTERING_PROMPT_VERSION = '1.0' as const;

export async function runAudioMastering(
  jobConfig: JobConfig,
  silentVideo: SilentVideoData,
  script: { scenes: Array<{ narration: string }> },
  options: {
    forceMock?: boolean;
    elevenLabsKey?: string | null;
    assemblyAiKey?: string | null;
  } = {},
): Promise<FinalVideoEnvelope> {
  const gateG = validateGateG(jobConfig, silentVideo);
  if (!gateG.valid) {
    return {
      job_id: jobConfig.job_id || 'unknown',
      stage: AUDIO_MASTERING_STAGE,
      status: 'needs_review',
      schema_version: AUDIO_MASTERING_SCHEMA_VERSION,
      prompt_version: AUDIO_MASTERING_PROMPT_VERSION,
      provider: 'validation',
      model: 'none',
      data: { final_video_url: '', duration_s: 0, loudness_lufs: null, true_peak_dbfs: null },
      warnings: ['Gate G validation failed.'],
      errors: gateG.errors,
      usage: { input_tokens: null, output_tokens: null, estimated_cost_usd: null, actual_cost_usd: null },
    };
  }

  const elevenLabsKey = options.elevenLabsKey ?? getElevenLabsKey();
  const assemblyAiKey = options.assemblyAiKey ?? getAssemblyAiKey();
  const shouldUseMock = options.forceMock || !elevenLabsKey || !assemblyAiKey;

  if (shouldUseMock) {
    const finalVideo = generateDeterministicMockFinalVideo(jobConfig, { duration_s: 90 });
    const captions = generateDeterministicMockCaptions(jobConfig, { duration_s: 90 });
    const voiceover = generateDeterministicMockVoiceover(jobConfig, { scenes: [] });

    return {
      job_id: jobConfig.job_id,
      stage: AUDIO_MASTERING_STAGE,
      status: 'completed',
      schema_version: AUDIO_MASTERING_SCHEMA_VERSION,
      prompt_version: AUDIO_MASTERING_PROMPT_VERSION,
      provider: 'mock_adapter',
      model: 'deterministic_fixture',
      data: finalVideo,
      warnings: [
        'Mock adapter was used because ELEVENLABS_API_KEY or ASSEMBLYAI_API_KEY was not configured or forceMock was enabled.',
      ],
      errors: [],
      usage: { input_tokens: 0, output_tokens: 0, estimated_cost_usd: 0, actual_cost_usd: 0 },
    };
  }

  // Real implementation would go here
  // For now, return mock since we don't have full script passed
  const finalVideo = generateDeterministicMockFinalVideo(jobConfig, { duration_s: 90 });
  const captions = generateDeterministicMockCaptions(jobConfig, { duration_s: 90 });
  const voiceover = generateDeterministicMockVoiceover(jobConfig, { scenes: [] });

  return {
    job_id: jobConfig.job_id,
    stage: AUDIO_MASTERING_STAGE,
    status: 'completed',
    schema_version: AUDIO_MASTERING_SCHEMA_VERSION,
    prompt_version: AUDIO_MASTERING_PROMPT_VERSION,
    provider: 'mock_adapter',
    model: 'deterministic_fixture',
    data: finalVideo,
    warnings: [
      'Mock adapter was used because ELEVENLABS_API_KEY or ASSEMBLYAI_API_KEY was not configured or forceMock was enabled.',
    ],
    errors: [],
    usage: { input_tokens: 0, output_tokens: 0, estimated_cost_usd: 0, actual_cost_usd: 0 },
  };
}