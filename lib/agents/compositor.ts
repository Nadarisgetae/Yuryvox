import type {
  JobConfig,
  TimedPlanData,
  VideoAssetsData,
  StageError,
  StageEnvelope,
  StageUsage,
} from './types';
import { getShotstackKey } from '@/lib/providers/shotstack';
import { createClient } from '@supabase/supabase-js';

export const COMPOSITOR_STAGE = 'compositor' as const;
export const COMPOSITOR_SCHEMA_VERSION = '1.0' as const;
export const COMPOSITOR_PROMPT_VERSION = '1.0' as const;

export interface ShotstackTrack {
  clips: ShotstackClip[];
}

export interface ShotstackClip {
  asset: ShotstackAsset;
  start: number;
  length: number;
  effect?: string;
  transition?: ShotstackTransition;
  offset?: ShotstackOffset;
}

export interface ShotstackAsset {
  type: 'video' | 'image' | 'title';
  src?: string;
  text?: string;
  style?: string;
  size?: string;
  color?: string;
}

export interface ShotstackFont {
  family: string;
  weight: string;
  size: number;
  color: string;
  outline?: ShotstackOutline;
}

export interface ShotstackOutline {
  width: number;
  color: string;
}

export interface ShotstackStyle {
  background?: string;
}

export interface ShotstackTransition {
  in?: string;
  out?: string;
}

export interface ShotstackOffset {
  x: number;
  y: number;
}

export interface ShotstackSoundtrack {
  src: string;
  effect: 'fadeIn' | 'fadeOut' | 'none';
  volume: number;
  trim?: number;
}

export interface ShotstackEdit {
  timeline: {
    background: string;
    soundtrack?: ShotstackSoundtrack;
    tracks: ShotstackTrack[];
  };
  output: {
    format: 'mp4';
    resolution: string;
    fps: number;
  };
}

export interface ShotstackRenderResponse {
  response: {
    id: string;
    status: 'queued' | 'rendering' | 'done' | 'failed';
    url?: string;
    error?: string;
  };
}

export interface ShotstackStatusResponse {
  response: {
    id: string;
    status: 'queued' | 'rendering' | 'done' | 'failed';
    url?: string;
    error?: string;
  };
}

// ─── Gate F: Validation ───

export function validateGateF(
  jobConfig: JobConfig,
  videoAssets: { scenes: Array<{ scene_id: string; status: string; video_url?: string; image_url?: string }> },
  timedPlan: { scenes: Array<{ scene_id: string }> },
): { valid: boolean; errors: StageError[] } {
  const errors: StageError[] = [];

  if (!jobConfig.topic || typeof jobConfig.topic !== 'string' || jobConfig.topic.trim().length === 0) {
    errors.push({ code: 'MISSING_TOPIC', message: 'Compositor requires a non-empty topic', retryable: false, field: 'topic' });
  }

  if (!videoAssets || !Array.isArray(videoAssets.scenes) || videoAssets.scenes.length === 0) {
    errors.push({ code: 'MISSING_VIDEO_ASSETS', message: 'Compositor requires video assets', retryable: false });
    return { valid: false, errors };
  }

  if (!timedPlan || !Array.isArray(timedPlan.scenes) || timedPlan.scenes.length === 0) {
    errors.push({ code: 'MISSING_TIMED_PLAN', message: 'Compositor requires timed plan', retryable: false });
    return { valid: false, errors };
  }

  // Scene IDs must match
  const assetSceneIds = new Set(videoAssets.scenes.map((s) => s.scene_id));
  const timedSceneIds = new Set(timedPlan.scenes.map((s) => s.scene_id));

  for (const id of Array.from(timedSceneIds)) {
    if (!assetSceneIds.has(id)) {
      errors.push({ code: 'ORPHAN_TIMED_SCENE', message: `Timed scene ${id} missing from video assets`, retryable: false, field: `timed_plan.scenes` });
    }
  }

  for (const id of Array.from(assetSceneIds)) {
    if (!timedSceneIds.has(id)) {
      errors.push({ code: 'ORPHAN_ASSET_SCENE', message: `Asset scene ${id} not in timed plan`, retryable: false, field: `video_assets.scenes` });
    }
  }

  // Each asset scene must have either video_url (generated) or image_url (fallback)
  for (const scene of videoAssets.scenes) {
    if (scene.status === 'generated' && (!scene.video_url || scene.video_url.trim().length === 0)) {
      errors.push({ code: 'MISSING_VIDEO_URL', message: `Scene ${scene.scene_id} status=generated but missing video_url`, retryable: false, field: `video_assets.scenes.${scene.scene_id}.video_url` });
    }
    if (scene.status === 'fallback_ken_burns' && (!scene.image_url || scene.image_url.trim().length === 0)) {
      errors.push({ code: 'MISSING_IMAGE_URL', message: `Scene ${scene.scene_id} fallback requires image_url`, retryable: false, field: `video_assets.scenes.${scene.scene_id}.image_url` });
    }
  }

  return { valid: errors.length === 0, errors };
}

// ─── Output Schema Validation ───

export interface SilentVideoData {
  silent_video_url: string;
  thumbnail_url: string;
  duration_s: number;
  render_id: string;
  aspect_ratio: string;
  scene_count: number;
  fallback_scene_ids: string[];
  estimated_cost_usd: number;
  actual_cost_usd: number;
}

export type SilentVideoEnvelope = StageEnvelope<SilentVideoData>;

export function validateSilentVideoOutput(
  data: unknown,
  timedPlan?: { scenes: Array<{ scene_id: string; duration_seconds: number }> },
): { valid: boolean; errors: StageError[]; warnings: string[] } {
  const errors: StageError[] = [];
  const warnings: string[] = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: [{ code: 'INVALID_SILENT_VIDEO', message: 'Silent video data must be an object', retryable: true }], warnings: [] };
  }

  const d = data as Partial<SilentVideoData>;

  if (!d.silent_video_url || typeof d.silent_video_url !== 'string' || d.silent_video_url.trim().length === 0) {
    errors.push({ code: 'MISSING_SILENT_VIDEO_URL', message: 'silent_video must have silent_video_url', retryable: true, field: 'silent_video_url' });
  }

  if (!d.thumbnail_url || typeof d.thumbnail_url !== 'string' || d.thumbnail_url.trim().length === 0) {
    errors.push({ code: 'MISSING_THUMBNAIL_URL', message: 'silent_video must have thumbnail_url', retryable: true, field: 'thumbnail_url' });
  }

  if (typeof d.duration_s !== 'number' || d.duration_s <= 0) {
    errors.push({ code: 'INVALID_DURATION', message: 'duration_s must be > 0', retryable: true, field: 'duration_s' });
  }

  if (typeof d.scene_count !== 'number' || d.scene_count <= 0) {
    errors.push({ code: 'INVALID_SCENE_COUNT', message: 'scene_count must be > 0', retryable: true, field: 'scene_count' });
  }

  if (timedPlan && d.duration_s && timedPlan.scenes) {
    const plannedTotal = timedPlan.scenes.reduce((sum, s) => sum + (s.duration_seconds || 0), 0);
    if (Math.abs(d.duration_s - plannedTotal) > 1) {
      warnings.push(`Duration mismatch: silent video ${d.duration_s}s vs planned ${plannedTotal.toFixed(1)}s`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function estimateCompositorCost(sceneCount: number): number {
  return sceneCount * 0.02; // ~$0.02 per scene via Shotstack
}

// ─── Deterministic Mock ───

export function generateDeterministicMockSilentVideo(
  jobConfig: JobConfig,
  videoAssets: { scenes: Array<{ scene_id: string; status: string }> },
  timedPlan: { scenes: Array<{ scene_id: string; duration_seconds: number }> },
): SilentVideoData {
  const totalDuration = timedPlan.scenes.reduce((sum, s) => sum + (s.duration_seconds || 0), 0);
  const fallbackScenes = videoAssets.scenes.filter((s) => s.status === 'fallback_ken_burns').map((s) => s.scene_id);

  return {
    silent_video_url: `https://mock-supabase.example.com/${jobConfig.job_id}/silent.mp4`,
    thumbnail_url: `https://mock-supabase.example.com/${jobConfig.job_id}/thumb.jpg`,
    duration_s: Number(totalDuration.toFixed(2)),
    render_id: `mock-render-${jobConfig.job_id}`,
    aspect_ratio: jobConfig.aspect_ratios[0] || '16:9',
    scene_count: timedPlan.scenes.length,
    fallback_scene_ids: fallbackScenes,
    estimated_cost_usd: 0.02 * timedPlan.scenes.length,
    actual_cost_usd: 0,
  };
}

// ─── Shotstack Edit Builder ───

function buildShotstackEdit(
  jobConfig: JobConfig,
  videoAssets: { scenes: Array<{ scene_id: string; video_url?: string; image_url?: string; status: string }> },
  timedPlan: TimedPlanData,
  musicTrackId?: string,
): ShotstackEdit {
  const assetMap = new Map(videoAssets.scenes.map((s) => [s.scene_id, s]));
  const visualClips: ShotstackClip[] = [];
  const titleClips: ShotstackClip[] = [];
  let currentTime = 0;

  for (let i = 0; i < timedPlan.scenes.length; i++) {
    const scene = timedPlan.scenes[i];
    const isFirst = i === 0;
    const isLast = i === timedPlan.scenes.length - 1;
    const duration = scene.duration_seconds || 5;

    // Stop-motion paper collages use clean direct cuts — no blackout fade transitions
    let transitionIn: string | undefined;
    let transitionOut: string | undefined;
    if (scene.transition_in && scene.transition_in !== 'cut' && scene.transition_in !== 'none') {
      transitionIn = scene.transition_in;
    }
    if (scene.transition_out && scene.transition_out !== 'cut' && scene.transition_out !== 'none') {
      transitionOut = scene.transition_out;
    }

    // Asset: video (generated) or image (fallback + Ken Burns)
    let asset: ShotstackAsset;
    let clipEffect: string | undefined;
    const assetData = videoAssets.scenes.find((a) => a.scene_id === scene.scene_id);

    // Find any real generated image from this job to use as fallback, or use verified public Shotstack S3 asset
    const fallbackPublicImage =
      videoAssets.scenes.find((s) => s.image_url && !s.image_url.includes('mock-supabase'))?.image_url ||
      'https://shotstack-assets.s3-ap-southeast-2.amazonaws.com/images/earth.jpg';

    const hasRealVideo = Boolean(assetData?.video_url && !assetData.video_url.includes('mock-supabase'));
    const hasRealImage = Boolean(assetData?.image_url && !assetData.image_url.includes('mock-supabase'));

    if (assetData?.status === 'generated' && hasRealVideo) {
      asset = {
        type: 'video',
        src: assetData.video_url!,
      };
    } else if (hasRealImage) {
      // Ken Burns effect via Shotstack clip effect with zoomIn
      asset = {
        type: 'image',
        src: assetData.image_url!,
      };
      clipEffect = 'zoomIn';
    } else {
      // Fallback placeholder using verified public URL
      asset = {
        type: 'image',
        src: fallbackPublicImage,
      };
      clipEffect = 'zoomIn';
    }

    // Video/image clip
    const clip: ShotstackClip = {
      asset,
      start: currentTime,
      length: duration,
      effect: clipEffect,
      ...(transitionIn || transitionOut
        ? {
            transition: {
              in: transitionIn,
              out: transitionOut,
            },
          }
        : {}),
    };

    // Overlay text clip — only render if explicitly enabled (client requested clean collages without digital text overlays)
    const renderOverlays = (jobConfig as any).render_text_overlay === true;
    const timedScene = timedPlan.scenes.find((s) => s.scene_id === scene.scene_id);
    const overlayText = timedScene?.overlay?.text || '';
    if (renderOverlays && overlayText && overlayText.trim().length > 0) {
      const overlayStart = timedScene?.overlay?.start_seconds || currentTime + 0.5;
      const overlayEnd = timedScene?.overlay?.end_seconds || currentTime + duration - 0.5;
      const overlayLength = Math.max(0.5, overlayEnd - overlayStart);

      const titleClip: ShotstackClip = {
        asset: {
          type: 'title',
          text: overlayText,
          style: 'minimal',
          size: 'medium',
          color: '#FFFFFF',
        },
        start: overlayStart,
        length: overlayLength,
      };
      titleClips.push(titleClip);
    }

    visualClips.push(clip);
    currentTime += duration;
  }

  const tracks: ShotstackTrack[] = titleClips.length > 0
    ? [{ clips: titleClips }, { clips: visualClips }]
    : [{ clips: visualClips }];

  // Soundtrack
  let soundtrack: ShotstackSoundtrack | undefined;
  if (musicTrackId) {
    soundtrack = {
      src: musicTrackId,
      effect: 'fadeIn',
      volume: 0.12, // -18dB ≈ 0.12 linear
    };
  }

  // Aspect ratio resolution
  const aspectRatio = jobConfig.aspect_ratios[0] || '16:9';
  let resolution = 'hd';
  if (aspectRatio === '9:16') resolution = 'hd'; // Shotstack handles vertical
  else if (aspectRatio === '16:9') resolution = 'hd';
  else if (aspectRatio === '4:3') resolution = 'sd';
  else resolution = 'hd';

  return {
    timeline: {
      background: '#000000',
      soundtrack,
      tracks,
    },
    output: {
      format: 'mp4',
      resolution,
      fps: 25,
    },
  };
}

// ─── Shotstack API Calls ───

async function callShotstackRender(
  edit: ShotstackEdit,
  apiKey: string,
): Promise<ShotstackRenderResponse & { baseUrl: string }> {
  // Try v1 (production) first; fall back to stage (sandbox) if 403
  let baseUrl = 'https://api.shotstack.io/edit/v1';
  let response = await fetch(`${baseUrl}/render`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify(edit),
  });

  if (response.status === 403) {
    baseUrl = 'https://api.shotstack.io/edit/stage';
    response = await fetch(`${baseUrl}/render`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify(edit),
    });
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Shotstack render submit failed (${response.status}): ${text}`);
  }
  const data = await response.json();
  return { ...data, baseUrl };
}

async function pollShotstackStatus(
  renderId: string,
  apiKey: string,
  baseUrl: string = 'https://api.shotstack.io/edit/v1',
  maxAttempts: number = 60,
  intervalMs: number = 5000,
): Promise<ShotstackStatusResponse> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await fetch(`${baseUrl}/render/${renderId}`, {
      headers: { 'x-api-key': apiKey },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Shotstack status check failed (${response.status}): ${text}`);
    }

    const data = await response.json();
    const status = data.response?.status;

    if (status === 'done') return data;
    if (status === 'failed') throw new Error(`Shotstack render failed: ${data.response?.error || 'unknown'}`);

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error('Shotstack render timed out');
}

// ─── Storage Upload to Supabase ───

async function uploadToSupabase(
  jobId: string,
  assetType: 'video' | 'image',
  url: string,
): Promise<{ path: string; publicUrl: string }> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  const bucket = assetType === 'video' ? 'final-videos' : 'thumbnails';
  const ext = assetType === 'video' ? 'mp4' : 'jpg';
  const path = `${jobId}/silent.${ext}`;

  if (!supabaseUrl || !serviceKey) {
    return { path, publicUrl: url };
  }

  try {
    const supabase = createClient(supabaseUrl, serviceKey);
    const response = await fetch(url);
    if (!response.ok) return { path, publicUrl: url };
    const buffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || (assetType === 'video' ? 'video/mp4' : 'image/jpeg');

    const { error } = await supabase.storage.from(bucket).upload(path, buffer, {
      contentType,
      upsert: true,
    });

    if (error) {
      console.warn(`Upload to ${bucket}/${path} failed:`, error.message);
      return { path, publicUrl: url };
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return { path, publicUrl: data.publicUrl };
  } catch (err) {
    console.warn('Supabase storage upload error:', err);
    return { path, publicUrl: url };
  }
}

export async function runCompositor(
  jobConfig: JobConfig,
  videoAssets: VideoAssetsData,
  timedPlan: TimedPlanData,
  options: {
    forceMock?: boolean;
    shotstackApiKey?: string | null;
    musicTrackId?: string;
  } = {},
): Promise<SilentVideoEnvelope> {
  const gateF = validateGateF(jobConfig, videoAssets, timedPlan);
  if (!gateF.valid) {
    return {
      job_id: jobConfig.job_id || 'unknown',
      stage: COMPOSITOR_STAGE,
      status: 'needs_review',
      schema_version: COMPOSITOR_SCHEMA_VERSION,
      prompt_version: COMPOSITOR_PROMPT_VERSION,
      provider: 'validation',
      model: 'none',
      data: { silent_video_url: '', thumbnail_url: '', duration_s: 0, render_id: '', aspect_ratio: '', scene_count: 0, fallback_scene_ids: [], estimated_cost_usd: 0, actual_cost_usd: 0 },
      warnings: ['Gate F validation failed.'],
      errors: gateF.errors,
      usage: { input_tokens: null, output_tokens: null, estimated_cost_usd: null, actual_cost_usd: null },
    };
  }

  const apiKey = options.shotstackApiKey ?? getShotstackKey();
  const shouldUseMock = options.forceMock || !apiKey;

  const mockEstimatedCost = estimateCompositorCost(timedPlan.scenes.length);

  if (shouldUseMock) {
    const data = generateDeterministicMockSilentVideo(jobConfig, videoAssets, timedPlan);
    const validation = validateSilentVideoOutput(data, timedPlan);

    return {
      job_id: jobConfig.job_id,
      stage: COMPOSITOR_STAGE,
      status: 'completed',
      schema_version: COMPOSITOR_SCHEMA_VERSION,
      prompt_version: COMPOSITOR_PROMPT_VERSION,
      provider: 'mock_adapter',
      model: 'deterministic_fixture',
      data,
      warnings: [
        'Mock adapter was used because SHOTSTACK_API_KEY was not configured or forceMock was enabled.',
        ...validation.warnings,
      ],
      errors: [],
      usage: { input_tokens: 0, output_tokens: 0, estimated_cost_usd: 0, actual_cost_usd: 0 },
    };
  }

  // Budget check
  const realEstimatedCost = estimateCompositorCost(timedPlan.scenes.length);
  if (realEstimatedCost > jobConfig.budget_limit_usd) {
    return {
      job_id: jobConfig.job_id,
      stage: COMPOSITOR_STAGE,
      status: 'fatal_error',
      schema_version: COMPOSITOR_SCHEMA_VERSION,
      prompt_version: COMPOSITOR_PROMPT_VERSION,
      provider: 'shotstack',
      model: 'shotstack',
      data: { silent_video_url: '', thumbnail_url: '', duration_s: 0, render_id: '', aspect_ratio: '', scene_count: 0, fallback_scene_ids: [], estimated_cost_usd: realEstimatedCost, actual_cost_usd: 0 },
      warnings: [],
      errors: [{ code: 'BUDGET_EXCEEDED', message: `Estimated cost $${realEstimatedCost.toFixed(2)} exceeds budget $${jobConfig.budget_limit_usd}`, retryable: false }],
      usage: { input_tokens: null, output_tokens: null, estimated_cost_usd: realEstimatedCost, actual_cost_usd: 0 },
    };
  }

  try {
    // Build Shotstack edit
    const edit = buildShotstackEdit(jobConfig, videoAssets, timedPlan, options.musicTrackId);

    // Submit render
    const renderResponse = await callShotstackRender(edit, apiKey);
    const renderId = renderResponse.response?.id;
    if (!renderId) throw new Error('No render ID returned from Shotstack');

    // Poll for completion
    const statusResponse = await pollShotstackStatus(renderId, apiKey, renderResponse.baseUrl);
    const outputUrl = statusResponse.response?.url;
    if (!outputUrl) throw new Error('Shotstack render completed but no output URL');

    const shotstackThumbUrl = outputUrl.replace(/\.mp4$/, '_thumb.jpg');

    // Upload rendered video and thumbnail to Supabase Storage for long-term durability
    const [videoUpload, thumbUpload] = await Promise.all([
      uploadToSupabase(jobConfig.job_id, 'video', outputUrl),
      uploadToSupabase(jobConfig.job_id, 'image', shotstackThumbUrl),
    ]);

    const silentVideoUrl = videoUpload.publicUrl;
    const thumbnailUrl = thumbUpload.publicUrl;

    const totalDuration = timedPlan.scenes.reduce((sum, s) => sum + (s.duration_seconds || 0), 0);
    const fallbackScenes = videoAssets.scenes.filter((s) => s.status === 'fallback_ken_burns').map((s) => s.scene_id);

    const data: SilentVideoData = {
      silent_video_url: silentVideoUrl,
      thumbnail_url: thumbnailUrl,
      duration_s: Number(totalDuration.toFixed(2)),
      render_id: renderId,
      aspect_ratio: jobConfig.aspect_ratios[0] || '16:9',
      scene_count: timedPlan.scenes.length,
      fallback_scene_ids: fallbackScenes,
      estimated_cost_usd: Number(realEstimatedCost.toFixed(4)),
      actual_cost_usd: 0,
    };

    const validation = validateSilentVideoOutput(data, timedPlan);
    const status = validation.valid ? 'completed' : 'retryable_error';

    return {
      job_id: jobConfig.job_id,
      stage: COMPOSITOR_STAGE,
      status,
      schema_version: COMPOSITOR_SCHEMA_VERSION,
      prompt_version: COMPOSITOR_PROMPT_VERSION,
      provider: 'shotstack',
      model: 'shotstack',
      data,
      warnings: validation.warnings,
      errors: validation.errors,
      usage: {
        input_tokens: null,
        output_tokens: null,
        estimated_cost_usd: realEstimatedCost,
        actual_cost_usd: 0,
      },
    };
  } catch (error) {
    return {
      job_id: jobConfig.job_id,
      stage: COMPOSITOR_STAGE,
      status: 'retryable_error',
      schema_version: COMPOSITOR_SCHEMA_VERSION,
      prompt_version: COMPOSITOR_PROMPT_VERSION,
      provider: 'shotstack',
      model: 'shotstack',
      data: { silent_video_url: '', thumbnail_url: '', duration_s: 0, render_id: '', aspect_ratio: '', scene_count: 0, fallback_scene_ids: [], estimated_cost_usd: 0, actual_cost_usd: 0 },
      warnings: [],
      errors: [{ code: 'EXECUTION_EXCEPTION', message: error instanceof Error ? error.message : 'Unknown exception', retryable: true }],
      usage: { input_tokens: null, output_tokens: null, estimated_cost_usd: null, actual_cost_usd: null },
    };
  }
}