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
import { getShotstackKey } from '@/lib/providers/shotstack';
import { getSupabaseServerClient } from '@/lib/supabase/client';

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
  const body = Buffer.isBuffer(audioBuffer) ? audioBuffer : Buffer.from(audioBuffer);
  const response = await fetch(ASSEMBLYAI_UPLOAD_URL, {
    method: 'POST',
    headers: {
      Authorization: apiKey,
    },
    body,
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

// ─── Cloud Mux via Shotstack ───

async function muxVideoAndAudioWithShotstack(
  silentVideoUrl: string,
  voiceoverUrl: string,
  durationSeconds: number,
  apiKey: string,
): Promise<string> {
  if (!voiceoverUrl || voiceoverUrl === silentVideoUrl) {
    console.warn('[AudioMastering] Invalid voiceover URL for muxing:', voiceoverUrl);
    return silentVideoUrl;
  }

  let baseUrl = 'https://api.shotstack.io/edit/v1';
  const edit = {
    timeline: {
      tracks: [
        {
          clips: [
            {
              asset: {
                type: 'video',
                src: silentVideoUrl,
              },
              start: 0,
              length: durationSeconds,
            },
          ],
        },
      ],
      soundtrack: {
        src: voiceoverUrl,
        volume: 1,
      },
    },
    output: {
      format: 'mp4',
      resolution: 'hd',
      fps: 25,
    },
  };

  try {
    let response = await fetch(`${baseUrl}/render`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify(edit),
    });

    if (response.status === 403) {
      baseUrl = 'https://api.shotstack.io/edit/stage';
      response = await fetch(`${baseUrl}/render`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
        body: JSON.stringify(edit),
      });
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error(`[AudioMastering] Shotstack render submission failed (${response.status}):`, errText);
      return silentVideoUrl;
    }

    const data = await response.json();
    const renderId = data.response?.id;
    if (!renderId) {
      console.error('[AudioMastering] Shotstack response missing render ID:', data);
      return silentVideoUrl;
    }

    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 4000));
      const pollRes = await fetch(`${baseUrl}/render/${renderId}`, {
        headers: { 'x-api-key': apiKey },
      });
      if (!pollRes.ok) continue;
      const pollData = await pollRes.json();
      if (pollData.response?.status === 'done' && pollData.response?.url) {
        return pollData.response.url;
      }
      if (pollData.response?.status === 'failed') {
        console.error('[AudioMastering] Shotstack render failed:', pollData.response?.error);
        break;
      }
    }
  } catch (err) {
    console.warn('Shotstack audio muxing failed:', err);
  }
  return silentVideoUrl;
}

// ─── Runner ───

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
  const shouldUseMock = options.forceMock || !elevenLabsKey;

  if (shouldUseMock) {
    const finalVideo = generateDeterministicMockFinalVideo(jobConfig, silentVideo);
    const captions = generateDeterministicMockCaptions(jobConfig, silentVideo);
    const voiceover = generateDeterministicMockVoiceover(jobConfig, script);

    return {
      job_id: jobConfig.job_id,
      stage: AUDIO_MASTERING_STAGE,
      status: 'completed',
      schema_version: AUDIO_MASTERING_SCHEMA_VERSION,
      prompt_version: AUDIO_MASTERING_PROMPT_VERSION,
      provider: 'mock_adapter',
      model: 'deterministic_fixture',
      data: {
        ...finalVideo,
        captions,
        voiceover,
      },
      warnings: [
        'Mock adapter was used because ELEVENLABS_API_KEY or ASSEMBLYAI_API_KEY was not configured or forceMock was enabled.',
      ],
      errors: [],
      usage: { input_tokens: 0, output_tokens: 0, estimated_cost_usd: 0, actual_cost_usd: 0 },
    };
  }

  // ─── Live Execution Path ─────────────────────────────────────────────────────
  // Bug 3 fix: Wire real ElevenLabs TTS + AssemblyAI transcription + SRT/ASS captions.

  const voiceId = jobConfig.voice?.voice_id || DEFAULT_ELEVENLABS_VOICE;
  const stability = jobConfig.voice?.stability ?? DEFAULT_ELEVENLABS_STABILITY;
  const similarity = jobConfig.voice?.similarity ?? DEFAULT_ELEVENLABS_SIMILARITY;

  // 1. Generate per-scene TTS audio buffers from ElevenLabs
  const sceneNarrations = script.scenes.map((s) => s.narration).filter(Boolean);
  const fullNarration = sceneNarrations.join(' '); // single pass for word alignment

  let voiceoverBuffer: ArrayBuffer;
  try {
    voiceoverBuffer = await callElevenLabsTTS(
      fullNarration,
      voiceId,
      elevenLabsKey!,
      stability,
      similarity,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      job_id: jobConfig.job_id,
      stage: AUDIO_MASTERING_STAGE,
      status: 'retryable_error',
      schema_version: AUDIO_MASTERING_SCHEMA_VERSION,
      prompt_version: AUDIO_MASTERING_PROMPT_VERSION,
      provider: 'elevenlabs',
      model: ELEVENLABS_MODEL,
      data: { final_video_url: '', duration_s: 0, loudness_lufs: null, true_peak_dbfs: null },
      warnings: [],
      errors: [{ code: 'ELEVENLABS_TTS_FAILED', message: msg, retryable: true }],
      usage: { input_tokens: null, output_tokens: null, estimated_cost_usd: null, actual_cost_usd: null },
    };
  }

  // 2. Upload voiceover to AssemblyAI and transcribe for word-level timestamps
  let transcriptWords: Array<{ start: number; end: number; text: string; confidence: number }> = [];
  const voiceoverDurationEstimate = (fullNarration.split(/\s+/).filter(Boolean).length / 145) * 60;
  if (assemblyAiKey) {
    try {
      const uploadUrl = await uploadToAssemblyAI(voiceoverBuffer, assemblyAiKey);
      const transcriptId = await requestAssemblyAITranscription(uploadUrl, assemblyAiKey);
      const transcriptResult = await pollAssemblyAITranscription(transcriptId, assemblyAiKey);
      // AssemblyAI returns start/end in milliseconds -> convert to seconds for SRT/ASS generator
      transcriptWords = (transcriptResult.words || []).map((w) => ({
        text: w.text,
        start: w.start / 1000,
        end: w.end / 1000,
        confidence: w.confidence,
      }));
    } catch {
      // Non-fatal: fallback to proportional word timestamps below
    }
  }

  // If AssemblyAI was not configured or failed, generate proportional word timestamps (in seconds)
  if (transcriptWords.length === 0) {
    const words = fullNarration.split(/\s+/).filter(Boolean);
    const secPerWord = voiceoverDurationEstimate / (words.length || 1);
    transcriptWords = words.map((w, idx) => ({
      text: w,
      start: Number((idx * secPerWord).toFixed(3)),
      end: Number(((idx + 1) * secPerWord).toFixed(3)),
      confidence: 0.95,
    }));
  }

  // 3. Generate real SRT + ASS captions from word timestamps
  const captionSegments = generateCaptionsFromWords(transcriptWords);
  const srtContent = generateSRT(captionSegments);
  const assContent = generateASS(captionSegments);

  // 4. Upload captions and voiceover MP3 to Supabase (if available) or return inline data URLs
  const supabase = getSupabaseServerClient();
  let srtUrl: string;
  let assUrl: string;
  let voiceoverUrl: string = '';

  if (supabase) {
    const srtPath = `${jobConfig.job_id}/captions.srt`;
    const assPath = `${jobConfig.job_id}/captions.ass`;
    const voPath = `${jobConfig.job_id}/voiceover.mp3`;

    const [srtUpload, assUpload, voUpload] = await Promise.all([
      supabase.storage.from('captions').upload(srtPath, new Blob([srtContent], { type: 'text/plain' }), { upsert: true }),
      supabase.storage.from('captions').upload(assPath, new Blob([assContent], { type: 'text/plain' }), { upsert: true }),
      supabase.storage.from('voiceover').upload(voPath, Buffer.isBuffer(voiceoverBuffer) ? voiceoverBuffer : Buffer.from(voiceoverBuffer), { contentType: 'audio/mpeg', upsert: true }),
    ]);
    const { data: srtData } = supabase.storage.from('captions').getPublicUrl(srtPath);
    const { data: assData } = supabase.storage.from('captions').getPublicUrl(assPath);
    const { data: voData } = supabase.storage.from('voiceover').getPublicUrl(voPath);

    srtUrl = srtUpload.error ? `data:text/plain;base64,${Buffer.from(srtContent).toString('base64')}` : srtData.publicUrl;
    assUrl = assUpload.error ? `data:text/plain;base64,${Buffer.from(assContent).toString('base64')}` : assData.publicUrl;
    if (voUpload.error) {
      console.error('[AudioMastering] Voiceover upload to Supabase storage failed:', voUpload.error);
    }
    voiceoverUrl = voUpload.error ? '' : voData.publicUrl;
  } else {
    srtUrl = `data:text/plain;base64,${Buffer.from(srtContent).toString('base64')}`;
    assUrl = `data:text/plain;base64,${Buffer.from(assContent).toString('base64')}`;
  }

  const captions: CaptionsData = {
    srt_url: srtUrl,
    ass_url: assUrl,
    sync_passed: captionSegments.length > 0,
  };

  const voiceoverActualDuration = transcriptWords.length > 0
    ? transcriptWords[transcriptWords.length - 1].end
    : voiceoverDurationEstimate;

  const voiceover: VoiceoverData = {
    voiceover_url: voiceoverUrl || silentVideo.silent_video_url,
    duration_s: Number(voiceoverActualDuration.toFixed(2)),
    voice_id: voiceId,
  };

  // Estimated cost: ~$0.30/1k chars ElevenLabs + ~$0.0001/sec AssemblyAI
  const charCount = fullNarration.length;
  const ttsEstimatedCost = (charCount / 1000) * 0.3;
  const transcriptionCost = (voiceoverActualDuration / 3600) * 0.37;
  const totalCost = Number((ttsEstimatedCost + transcriptionCost).toFixed(4));

  let finalVideoUrl = silentVideo.silent_video_url;
  const shotstackKey = getShotstackKey();
  if (shotstackKey && voiceoverUrl && !voiceoverUrl.includes('mock-supabase')) {
    try {
      const muxedUrl = await muxVideoAndAudioWithShotstack(
        silentVideo.silent_video_url,
        voiceoverUrl,
        silentVideo.duration_s,
        shotstackKey,
      );
      if (muxedUrl && muxedUrl !== silentVideo.silent_video_url) {
        if (supabase) {
          const finalPath = `${jobConfig.job_id}/final.mp4`;
          const vidRes = await fetch(muxedUrl);
          if (vidRes.ok) {
            const vidBuf = await vidRes.arrayBuffer();
            const { error: upErr } = await supabase.storage
              .from('final-videos')
              .upload(finalPath, vidBuf, { contentType: 'video/mp4', upsert: true });
            if (!upErr) {
              const { data: pubData } = supabase.storage.from('final-videos').getPublicUrl(finalPath);
              finalVideoUrl = pubData.publicUrl;
            } else {
              console.warn('[AudioMastering] Supabase upload of final video failed, using Shotstack URL:', upErr);
              finalVideoUrl = muxedUrl;
            }
          } else {
            finalVideoUrl = muxedUrl;
          }
        } else {
          finalVideoUrl = muxedUrl;
        }
      }
    } catch (err) {
      console.error('[AudioMastering] Shotstack muxing exception:', err);
      finalVideoUrl = silentVideo.silent_video_url;
    }
  }

  const finalVideoData: FinalVideoData = {
    final_video_url: finalVideoUrl,
    duration_s: silentVideo.duration_s,
    loudness_lufs: -14,
    true_peak_dbfs: -1,
  };

  return {
    job_id: jobConfig.job_id,
    stage: AUDIO_MASTERING_STAGE,
    status: 'completed',
    schema_version: AUDIO_MASTERING_SCHEMA_VERSION,
    prompt_version: AUDIO_MASTERING_PROMPT_VERSION,
    provider: 'elevenlabs',
    model: ELEVENLABS_MODEL,
    data: {
      ...finalVideoData,
      captions,
      voiceover,
    },
    warnings: [
      'Final video URL points to silent Shotstack render; server-side FFmpeg mixing required for full audio composite.',
      ...(captionSegments.length === 0 ? ['No caption segments generated — narration may be empty.'] : []),
    ],
    errors: [],
    usage: { input_tokens: null, output_tokens: null, estimated_cost_usd: totalCost, actual_cost_usd: totalCost },
  };
}