import type {
  JobConfig,
  TimedPlanData,
  VisualPlanData,
  VideoAssetsData,
  VideoAssetsEnvelope,
  VideoAssetScene,
  StageError,
  StageEnvelope,
  StageUsage,
} from './types';
import { getFalKey } from '@/lib/providers/fal';
import { createClient } from '@supabase/supabase-js';

export const VIDEO_GENERATOR_STAGE = 'video_generator' as const;
export const VIDEO_GENERATOR_SCHEMA_VERSION = '1.0' as const;
export const VIDEO_GENERATOR_PROMPT_VERSION = '1.0' as const;
export const DEFAULT_FAL_IMAGE_MODEL = 'fal-ai/flux/schnell' as const;
export const DEFAULT_FAL_VIDEO_MODEL_PRIMARY = 'fal-ai/kling-video/v1.6/standard/image-to-video' as const;
export const DEFAULT_FAL_VIDEO_MODEL_FALLBACK = 'fal-ai/minimax/video-01/image-to-video' as const;

export const IMAGE_GEN_COST_USD = 0.003;
export const VIDEO_GEN_COST_USD_PER_6SEC = 0.05; // Kling v1.6 ~$0.05 per 6s clip
export { deterministicSeed, estimateSceneCost };

export interface FalImageResponse {
  images: Array<{ url: string; width: number; height: number }>;
  seed?: number;
}

export interface FalVideoResponse {
  video: { url: string; width: number; height: number; duration: number };
  seed?: number;
}

export interface SupabaseUploadResult {
  path: string;
  publicUrl: string;
}

// ─── Gate E: Validation ───

export function validateGateE(
  jobConfig: JobConfig,
  timedPlan: TimedPlanData,
): { valid: boolean; errors: StageError[] } {
  const errors: StageError[] = [];

  if (!jobConfig.topic || typeof jobConfig.topic !== 'string' || jobConfig.topic.trim().length === 0) {
    errors.push({ code: 'MISSING_TOPIC', message: 'Video Generator requires a non-empty topic', retryable: false, field: 'topic' });
  }

  if (!timedPlan || typeof timedPlan !== 'object') {
    errors.push({ code: 'MISSING_TIMED_PLAN', message: 'Video Generator requires validated timed plan data', retryable: false });
    return { valid: false, errors };
  }

  if (!Array.isArray(timedPlan.scenes) || timedPlan.scenes.length === 0) {
    errors.push({ code: 'NO_TIMED_SCENES', message: 'Timed plan must contain at least one scene', retryable: false, field: 'timed_plan.scenes' });
  }

  if (!timedPlan.timeline_valid) {
    errors.push({ code: 'INVALID_TIMELINE', message: 'Timed plan timeline is invalid', retryable: false, field: 'timed_plan.timeline_valid' });
  }

  if (typeof jobConfig.budget_limit_usd !== 'number' || jobConfig.budget_limit_usd < 0) {
    errors.push({ code: 'INVALID_BUDGET', message: 'budget_limit_usd must be non-negative', retryable: false, field: 'budget_limit_usd' });
  }

  return { valid: errors.length === 0, errors };
}

// ─── Output Schema Validation ───

export function validateVideoAssetsOutput(
  data: unknown,
  timedPlan?: TimedPlanData,
): { valid: boolean; errors: StageError[]; warnings: string[] } {
  const errors: StageError[] = [];
  const warnings: string[] = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: [{ code: 'INVALID_VIDEO_ASSETS', message: 'Video assets data must be an object', retryable: true }], warnings: [] };
  }

  const d = data as Partial<VideoAssetsData>;

  if (!d.style_preset || typeof d.style_preset !== 'string') {
    errors.push({ code: 'MISSING_STYLE_PRESET', message: 'video_assets must have style_preset', retryable: true, field: 'style_preset' });
  }

  if (!Array.isArray(d.scenes) || d.scenes.length === 0) {
    errors.push({ code: 'MISSING_SCENES', message: 'video_assets must contain scenes array', retryable: true, field: 'scenes' });
    return { valid: false, errors, warnings };
  }

  const timedSceneIds = new Set(timedPlan?.scenes.map((s) => s.scene_id) || []);

  for (const scene of d.scenes) {
    if (!scene.scene_id) {
      errors.push({ code: 'MISSING_SCENE_ID', message: 'Every video asset scene must have scene_id', retryable: true, field: 'scenes[].scene_id' });
    }

    if (timedSceneIds.size > 0 && !timedSceneIds.has(scene.scene_id)) {
      errors.push({ code: 'ORPHAN_VIDEO_SCENE', message: `Video asset scene ${scene.scene_id} not in timed plan`, retryable: false, field: `scenes.${scene.scene_id}` });
    }

    if (scene.status === 'generated') {
      if (!scene.video_url || typeof scene.video_url !== 'string' || scene.video_url.trim().length === 0) {
        errors.push({ code: 'MISSING_VIDEO_URL', message: `Scene ${scene.scene_id} status=generated but missing video_url`, retryable: true, field: `scenes.${scene.scene_id}.video_url` });
      }
      if (!scene.image_url || typeof scene.image_url !== 'string' || scene.image_url.trim().length === 0) {
        errors.push({ code: 'MISSING_IMAGE_URL', message: `Scene ${scene.scene_id} status=generated but missing image_url`, retryable: true, field: `scenes.${scene.scene_id}.image_url` });
      }
      if (typeof scene.duration_s !== 'number' || scene.duration_s <= 0) {
        errors.push({ code: 'INVALID_DURATION', message: `Scene ${scene.scene_id} duration_s must be > 0`, retryable: true, field: `scenes.${scene.scene_id}.duration_s` });
      }
      if (typeof scene.generation_cost_usd !== 'number' || scene.generation_cost_usd < 0) {
        errors.push({ code: 'INVALID_COST', message: `Scene ${scene.scene_id} generation_cost_usd must be >= 0`, retryable: true, field: `scenes.${scene.scene_id}.generation_cost_usd` });
      }
    } else if (scene.status === 'fallback_ken_burns') {
      if (!scene.image_url || typeof scene.image_url !== 'string' || scene.image_url.trim().length === 0) {
        errors.push({ code: 'MISSING_IMAGE_URL_FOR_FALLBACK', message: `Scene ${scene.scene_id} fallback requires image_url`, retryable: true, field: `scenes.${scene.scene_id}.image_url` });
      }
    }

    if (scene.seed !== undefined && (typeof scene.seed !== 'number' || !Number.isInteger(scene.seed))) {
      warnings.push(`Scene ${scene.scene_id} seed should be an integer`);
    }
  }

  if (typeof d.total_estimated_cost_usd !== 'number' || d.total_estimated_cost_usd < 0) {
    errors.push({ code: 'MISSING_TOTAL_COST', message: 'video_assets must have total_estimated_cost_usd >= 0', retryable: true, field: 'total_estimated_cost_usd' });
  }

  if (d.failed_scene_ids && d.failed_scene_ids.length > 0) {
    warnings.push(`${d.failed_scene_ids.length} scene(s) failed generation`);
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ─── Deterministic Seed ───

function deterministicSeed(jobSeed: number | undefined, sceneId: string): number {
  const base = jobSeed || 12345;
  let hash = 0;
  for (let i = 0; i < sceneId.length; i++) {
    hash = ((hash << 5) - hash) + sceneId.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(base + hash);
}

// ─── Mock Storage Upload ───

async function mockUploadToSupabase(
  jobId: string,
  sceneId: string,
  assetType: 'image' | 'video',
  mockUrl: string,
): Promise<SupabaseUploadResult> {
  // In mock mode, just return a deterministic "stored" URL
  const path = `${jobId}/${sceneId}.${assetType === 'image' ? 'png' : 'mp4'}`;
  return {
    path,
    publicUrl: `https://mock-supabase.example.com/${path}`,
  };
}

async function uploadToSupabase(
  jobId: string,
  sceneId: string,
  assetType: 'image' | 'video',
  url: string,
): Promise<SupabaseUploadResult> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'video-clips';

  if (!supabaseUrl || !serviceKey) {
    const ext = assetType === 'image' ? 'png' : 'mp4';
    return { path: `${jobId}/${sceneId}.${ext}`, publicUrl: url };
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const ext = assetType === 'image' ? 'png' : 'mp4';
  const path = `${jobId}/${sceneId}.${ext}`;

  // Fetch the asset
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch asset from ${url}: ${response.status}`);
  }
  const buffer = await response.arrayBuffer();
  const contentType = response.headers.get('content-type') || (assetType === 'image' ? 'image/png' : 'video/mp4');

  // Upload to Supabase Storage
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, buffer, {
      contentType,
      upsert: true,
    });

  if (error) {
    console.warn(`Supabase storage upload failed for ${path}, using direct CDN URL:`, error.message);
    return { path, publicUrl: url };
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return { path, publicUrl: data.publicUrl };
}

// ─── Fal.ai API Calls ───

async function callFalImageGenerate(
  prompt: string,
  seed: number,
  aspectRatio: string = '16:9',
  apiKey: string,
): Promise<FalImageResponse> {
  const response = await fetch('https://fal.run/fal-ai/flux/schnell', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Key ${apiKey}`,
    },
    body: JSON.stringify({
      prompt,
      seed,
      aspect_ratio: aspectRatio,
      num_images: 1,
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Fal.ai image generation failed (${response.status}): ${text}`);
  }

  return response.json();
}

async function callFalVideoGenerateKling(
  imageUrl: string,
  motionPrompt: string,
  apiKey: string,
  clipDuration: '5' | '10' = '5',
  aspectRatio: string = '16:9',
): Promise<FalVideoResponse> {
  // Kling v1.6 image-to-video — produces genuine stop-motion paper collage clips
  const response = await fetch(`https://fal.run/${DEFAULT_FAL_VIDEO_MODEL_PRIMARY}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Key ${apiKey}`,
    },
    body: JSON.stringify({
      image_url: imageUrl,
      prompt: motionPrompt,
      duration: clipDuration,
      aspect_ratio: aspectRatio,
    }),
    signal: AbortSignal.timeout(150_000),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Kling v1.6 video generation failed (${response.status}): ${text}`);
  }

  const data = await response.json();
  // Kling returns { video: { url, width, height, duration } }
  return data as FalVideoResponse;
}

async function callFalVideoGenerateMinimax(
  imageUrl: string,
  motionPrompt: string,
  apiKey: string,
): Promise<FalVideoResponse> {
  // Minimax Video-01 image-to-video — fallback when Kling is unavailable
  const response = await fetch(`https://fal.run/${DEFAULT_FAL_VIDEO_MODEL_FALLBACK}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Key ${apiKey}`,
    },
    body: JSON.stringify({
      image_url: imageUrl,
      prompt: motionPrompt,
    }),
    signal: AbortSignal.timeout(150_000),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Minimax video generation failed (${response.status}): ${text}`);
  }

  const data = await response.json();
  return data as FalVideoResponse;
}

// ─── Cost Calculation ───

function estimateSceneCost(durationSeconds: number): number {
  const imageCost = IMAGE_GEN_COST_USD;
  // Kling v1.6 charges per 6s clip; scenes longer than 6s need multiple clips
  const videoClipsNeeded = Math.ceil(durationSeconds / 6);
  const videoCost = videoClipsNeeded * VIDEO_GEN_COST_USD_PER_6SEC;
  return imageCost + videoCost;
}

// ─── Mock Generator ───

export function generateDeterministicMockVideoAssets(
  jobConfig: JobConfig,
  timedPlan: TimedPlanData,
): VideoAssetsData {
  const scenes: VideoAssetScene[] = timedPlan.scenes.map((scene) => {
    const seed = deterministicSeed(jobConfig.seed, scene.scene_id);
    const estimatedCost = estimateSceneCost(scene.duration_seconds);

    return {
      scene_id: scene.scene_id,
      image_url: `https://mock-supabase.example.com/${jobConfig.job_id}/${scene.scene_id}.png`,
      video_url: `https://mock-supabase.example.com/${jobConfig.job_id}/${scene.scene_id}.mp4`,
      duration_s: scene.duration_seconds,
      seed,
      generation_cost_usd: Number(estimatedCost.toFixed(4)),
      status: 'generated' as const,
    };
  });

  const totalCost = scenes.reduce((sum, s) => sum + s.generation_cost_usd, 0);

  return {
    style_preset: 'archival_collage_explainer',
    scenes,
    total_estimated_cost_usd: Number(totalCost.toFixed(4)),
    total_actual_cost_usd: 0,
    failed_scene_ids: [],
    warnings: ['Mock adapter used - no actual Fal.ai calls made'],
  };
}

// ─── Runner ───

async function mapConcurrent<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIdx = 0;
  async function worker() {
    while (nextIdx < items.length) {
      const idx = nextIdx++;
      results[idx] = await fn(items[idx], idx);
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

export interface VideoGeneratorOptions {
  forceMock?: boolean;
  falApiKey?: string | null;
  visualPlan?: VisualPlanData | null;
  existingAssets?: VideoAssetsData | null;
  onSceneProgress?: (scene: VideoAssetScene, completed: number, total: number) => Promise<void> | void;
  concurrency?: number;
}

export async function runVideoGenerator(
  jobConfig: JobConfig,
  timedPlan: TimedPlanData,
  options: VideoGeneratorOptions = {},
): Promise<VideoAssetsEnvelope> {
  const gateE = validateGateE(jobConfig, timedPlan);
  if (!gateE.valid) {
    return {
      job_id: jobConfig.job_id || 'unknown',
      stage: VIDEO_GENERATOR_STAGE,
      status: 'needs_review',
      schema_version: VIDEO_GENERATOR_SCHEMA_VERSION,
      prompt_version: VIDEO_GENERATOR_PROMPT_VERSION,
      provider: 'validation',
      model: 'none',
      data: { style_preset: 'archival_collage_explainer', scenes: [], total_estimated_cost_usd: 0, total_actual_cost_usd: 0, failed_scene_ids: [], warnings: [] },
      warnings: ['Gate E validation failed.'],
      errors: gateE.errors,
      usage: { input_tokens: null, output_tokens: null, estimated_cost_usd: null, actual_cost_usd: null },
    };
  }

  const apiKey = options.falApiKey ?? getFalKey();
  const shouldUseMock = options.forceMock || !apiKey;

  if (shouldUseMock) {
    const data = generateDeterministicMockVideoAssets(jobConfig, timedPlan);
    const validation = validateVideoAssetsOutput(data, timedPlan);

    return {
      job_id: jobConfig.job_id,
      stage: VIDEO_GENERATOR_STAGE,
      status: 'completed',
      schema_version: VIDEO_GENERATOR_SCHEMA_VERSION,
      prompt_version: VIDEO_GENERATOR_PROMPT_VERSION,
      provider: 'mock_adapter',
      model: 'deterministic_fixture',
      data,
      warnings: [
        'Mock adapter was used because FAL_API_KEY was not configured or forceMock was enabled.',
        ...validation.warnings,
      ],
      errors: [],
      usage: { input_tokens: 0, output_tokens: 0, estimated_cost_usd: 0, actual_cost_usd: 0 },
    };
  }

  // Real Fal.ai implementation
  const totalEstimatedCost = timedPlan.scenes.reduce(
    (sum, s) => sum + estimateSceneCost(s.duration_seconds),
    0,
  );

  if (totalEstimatedCost > jobConfig.budget_limit_usd) {
    return {
      job_id: jobConfig.job_id,
      stage: VIDEO_GENERATOR_STAGE,
      status: 'fatal_error',
      schema_version: VIDEO_GENERATOR_SCHEMA_VERSION,
      prompt_version: VIDEO_GENERATOR_PROMPT_VERSION,
      provider: 'fal',
      model: DEFAULT_FAL_IMAGE_MODEL,
      data: { style_preset: 'archival_collage_explainer', scenes: [], total_estimated_cost_usd: totalEstimatedCost, total_actual_cost_usd: 0, failed_scene_ids: [], warnings: [] },
      warnings: [],
      errors: [{ code: 'BUDGET_EXCEEDED', message: `Estimated cost $${totalEstimatedCost.toFixed(2)} exceeds budget $${jobConfig.budget_limit_usd}`, retryable: false }],
      usage: { input_tokens: null, output_tokens: null, estimated_cost_usd: totalEstimatedCost, actual_cost_usd: 0 },
    };
  }

  const warnings: string[] = [];
  const concurrency = Math.max(1, Math.min(options.concurrency || 2, 4));
  const totalScenes = timedPlan.scenes.length;
  let completedCount = 0;

  const scenes = await mapConcurrent(timedPlan.scenes, concurrency, async (scene) => {
    // Check if scene was already generated in a prior partial run
    const existing = options.existingAssets?.scenes?.find(
      (s) => s.scene_id === scene.scene_id && (s.status === 'generated' || s.video_url || s.image_url),
    );
    if (existing && !existing.image_url.includes('mock-supabase')) {
      completedCount++;
      if (options.onSceneProgress) {
        await options.onSceneProgress(existing, completedCount, totalScenes);
      }
      return existing;
    }

    const seed = deterministicSeed(jobConfig.seed, scene.scene_id);
    const sceneVisual = options.visualPlan?.scene_visuals?.find((sv) => sv.scene_id === scene.scene_id);
    const duration = Math.round(scene.duration_seconds || 6);
    const assemblyEnd = Math.max(2, Math.round(duration * 0.65));
    const klingDuration: '5' | '10' = duration > 7 ? '10' : '5';
    const aspectRatio = Object.keys(timedPlan.aspect_layouts)[0] || '16:9';

    const defaultStopMotionPrompt =
      `Transform the provided image into a ${duration}-second premium documentary stop-motion paper collage animation. ` +
      `Preserve the final composition of the provided image exactly. Do not redesign, reposition, or resize any element. ` +
      `The provided image is the finished frame that the animation builds toward. ` +
      `CAMERA STRICT: completely locked. No zoom, no pan, no tilt, no rotation, no dolly, no shake, no cuts, no transitions. ` +
      `0 to ${assemblyEnd} seconds - BUILD-ON ASSEMBLY: frame opens on the empty background paper surface only. ` +
      `Elements enter one by one back to front in narrative order: background scraps settle first, hero cutout slides in with paper drag and settle, ` +
      `supporting cutouts drop on with a 2-frame stamp settle, tape presses down, stamps slap on, red string draws between pins last. ` +
      `Choppy 12fps stop-motion feel on twos, never smooth CGI. ` +
      `${assemblyEnd} to ${duration} seconds - LIVING PAPER POSTER: everything holds position. ` +
      `Only subtle life remains: paper corners lift a millimeter, shadows breathe, zero position drift.`;

    let motionPrompt = (sceneVisual?.video_motion_prompt && sceneVisual.video_motion_prompt.includes('stop-motion'))
      ? sceneVisual.video_motion_prompt
      : defaultStopMotionPrompt;
    if (motionPrompt.length > 900) {
      motionPrompt = motionPrompt.substring(0, 900).trim();
    }

    const basePrompt = (sceneVisual?.image_prompt && (sceneVisual.image_prompt.includes('halftone') || sceneVisual.image_prompt.includes('kraft paper')))
      ? sceneVisual.image_prompt
      : (
        `Macro documentary studio photograph of a physical handmade stop-motion paper collage on aged cream kraft paper with subtle fold creases: Scene ${scene.scene_id}. ` +
        (sceneVisual?.composition?.focal_subject ? `Focal subject: ${sceneVisual.composition.focal_subject}, rendered as a hand-torn newsprint paper cutout with visible halftone print dot matrix. ` : '') +
        `Layered tactile elements: strips of crinkled semi-transparent masking tape, rubber stamps, red wax crayon circle, brass pins with red string, dried coffee ring stain. ` +
        `Physical paper cutouts with soft natural drop shadows underneath each elevated layer, visible torn deckle edges. Overhead 45-degree soft studio lighting. No digital CGI, no 3D computer render, no glossy illustration.`
      );

    // Enforce anti-spelling-mistake directive and Flux Schnell model limits (clamped to 800 chars)
    const antiTextDirective = ' Pure visual imagery, zero legible words, no text lettering, no fake headlines, no misspelled alphabets.';
    let imagePrompt = basePrompt.includes('zero legible words')
      ? basePrompt
      : `${basePrompt}${antiTextDirective}`;
    if (imagePrompt.length > 800) {
      imagePrompt = imagePrompt.substring(0, 800).trim();
    }

    let finalImageUrl = '';
    let finalVideoUrl = '';
    let isVideoGenerated = false;
    let sceneCost = IMAGE_GEN_COST_USD;

    try {
      // 1. Generate image with Fal Flux Schnell
      const imageResult = await callFalImageGenerate(imagePrompt, seed, aspectRatio, apiKey);
      const falImageUrl = imageResult.images[0]?.url;
      if (!falImageUrl) throw new Error(`No image URL returned from Fal.ai for scene ${scene.scene_id}`);

      // Upload image to Supabase Storage
      try {
        const imageUpload = await uploadToSupabase(jobConfig.job_id, scene.scene_id, 'image', falImageUrl);
        finalImageUrl = imageUpload.publicUrl;
      } catch {
        finalImageUrl = falImageUrl;
      }

      // 2. Attempt video generation: Kling v1.6 primary → Minimax fallback → Ken Burns last resort
      try {
        const videoResult = await callFalVideoGenerateKling(finalImageUrl, motionPrompt, apiKey, klingDuration, aspectRatio);
        const falVideoUrl = videoResult.video?.url;
        if (falVideoUrl) {
          try {
            const videoUpload = await uploadToSupabase(jobConfig.job_id, scene.scene_id, 'video', falVideoUrl);
            finalVideoUrl = videoUpload.publicUrl;
          } catch {
            finalVideoUrl = falVideoUrl;
          }
          isVideoGenerated = true;
          sceneCost = estimateSceneCost(scene.duration_seconds);
        }
      } catch (klingErr) {
        warnings.push(`Scene ${scene.scene_id} Kling v1.6 failed, trying Minimax: ${klingErr instanceof Error ? klingErr.message : String(klingErr)}`);
        // Secondary fallback: Minimax Video-01
        try {
          const videoResult = await callFalVideoGenerateMinimax(finalImageUrl, motionPrompt, apiKey);
          const falVideoUrl = videoResult.video?.url;
          if (falVideoUrl) {
            try {
              const videoUpload = await uploadToSupabase(jobConfig.job_id, scene.scene_id, 'video', falVideoUrl);
              finalVideoUrl = videoUpload.publicUrl;
            } catch {
              finalVideoUrl = falVideoUrl;
            }
            isVideoGenerated = true;
            sceneCost = estimateSceneCost(scene.duration_seconds);
          }
        } catch (_minimaxErr) {
          // Last resort: Ken Burns pan/zoom on the real generated Flux image
          isVideoGenerated = false;
          finalVideoUrl = '';
          warnings.push(`Scene ${scene.scene_id} both video models failed — using Ken Burns fallback on real Fal image`);
        }
      }

      const sceneResult: VideoAssetScene = {
        scene_id: scene.scene_id,
        image_url: finalImageUrl,
        video_url: finalVideoUrl,
        duration_s: scene.duration_seconds,
        seed,
        generation_cost_usd: Number(sceneCost.toFixed(4)),
        status: isVideoGenerated ? 'generated' : 'fallback_ken_burns',
      };

      completedCount++;
      if (options.onSceneProgress) {
        await options.onSceneProgress(sceneResult, completedCount, totalScenes);
      }
      return sceneResult;
    } catch (error) {
      // Complete scene failure fallback
      const fallbackUrl = `https://mock-supabase.example.com/${jobConfig.job_id}/${scene.scene_id}.png`;
      const fallbackScene: VideoAssetScene = {
        scene_id: scene.scene_id,
        image_url: fallbackUrl,
        video_url: '',
        duration_s: scene.duration_seconds,
        seed,
        generation_cost_usd: 0,
        status: 'fallback_ken_burns',
      };
      warnings.push(`Scene ${scene.scene_id} image generation failed: ${error instanceof Error ? error.message : String(error)}`);

      completedCount++;
      if (options.onSceneProgress) {
        await options.onSceneProgress(fallbackScene, completedCount, totalScenes);
      }
      return fallbackScene;
    }
  });

  const totalActualCost = Number(scenes.reduce((sum, s) => sum + s.generation_cost_usd, 0).toFixed(4));

  const data: VideoAssetsData = {
    style_preset: 'archival_collage_explainer',
    scenes,
    total_estimated_cost_usd: Number(totalEstimatedCost.toFixed(4)),
    total_actual_cost_usd: Number(totalActualCost.toFixed(4)),
    failed_scene_ids: scenes.filter((s) => s.status === 'fallback_ken_burns' && s.image_url.includes('mock-supabase')).map((s) => s.scene_id),
    warnings,
  };

  const validation = validateVideoAssetsOutput(data, timedPlan);
  const status = validation.valid ? 'completed' : 'retryable_error';

  return {
    job_id: jobConfig.job_id,
    stage: VIDEO_GENERATOR_STAGE,
    status,
    schema_version: VIDEO_GENERATOR_SCHEMA_VERSION,
    prompt_version: VIDEO_GENERATOR_PROMPT_VERSION,
    provider: 'fal',
    model: `${DEFAULT_FAL_IMAGE_MODEL}+${DEFAULT_FAL_VIDEO_MODEL_PRIMARY}(fallback:${DEFAULT_FAL_VIDEO_MODEL_FALLBACK})`,
    data,
    warnings: validation.warnings,
    errors: validation.errors,
    usage: {
      input_tokens: null,
      output_tokens: null,
      estimated_cost_usd: totalEstimatedCost,
      actual_cost_usd: totalActualCost,
    },
  };
}