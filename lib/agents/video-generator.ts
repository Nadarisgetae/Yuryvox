import type {
  JobConfig,
  TimedPlanData,
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
export const DEFAULT_FAL_VIDEO_MODEL = 'fal-ai/stable-video-diffusion' as const;

export const IMAGE_GEN_COST_USD = 0.003;
export const VIDEO_GEN_COST_USD_PER_4SEC = 0.04;
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
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'video-clips';

  if (!supabaseUrl || !serviceKey) {
    throw new Error('Supabase credentials not configured for storage upload');
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const path = `${jobId}/${sceneId}.${assetType === 'image' ? 'png' : 'mp4'}`;

  // Fetch the asset
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch asset from ${url}: ${response.status}`);
  }
  const buffer = await response.arrayBuffer();

  // Upload to Supabase Storage
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, buffer, {
      contentType: assetType === 'image' ? 'image/png' : 'video/mp4',
      upsert: true,
    });

  if (error) {
    throw new Error(`Supabase upload failed: ${error.message}`);
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
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Fal.ai image generation failed (${response.status}): ${text}`);
  }

  return response.json();
}

async function callFalVideoGenerate(
  imageUrl: string,
  motionPrompt: string,
  duration: number,
  seed: number,
  apiKey: string,
): Promise<FalVideoResponse> {
  const response = await fetch('https://fal.run/fal-ai/stable-video-diffusion', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Key ${apiKey}`,
    },
    body: JSON.stringify({
      image_url: imageUrl,
      motion_bucket_id: 127,
      fps: 25,
      frames: Math.round(duration * 25),
      seed,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Fal.ai video generation failed (${response.status}): ${text}`);
  }

  return response.json();
}

// ─── Cost Calculation ───

function estimateSceneCost(durationSeconds: number): number {
  const imageCost = IMAGE_GEN_COST_USD;
  const videoClipsNeeded = Math.ceil(durationSeconds / 4);
  const videoCost = videoClipsNeeded * VIDEO_GEN_COST_USD_PER_4SEC;
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

export async function runVideoGenerator(
  jobConfig: JobConfig,
  timedPlan: TimedPlanData,
  options: {
    forceMock?: boolean;
    falApiKey?: string | null;
  } = {},
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

  const scenes: VideoAssetScene[] = [];
  let totalActualCost = 0;

  for (const scene of timedPlan.scenes) {
    const seed = deterministicSeed(jobConfig.seed, scene.scene_id);
    const visualScene = timedPlan.scenes.find((s) => s.scene_id === scene.scene_id);
    const imagePrompt = visualScene?.overlay?.text || `Archival collage scene: ${scene.scene_id}`;
    const motionPrompt = visualScene?.motion?.direction || 'slow zoom in';
    const aspectRatio = Object.keys(timedPlan.aspect_layouts)[0] || '16:9';

    try {
      // 1. Generate image
      const imageResult = await callFalImageGenerate(imagePrompt, seed, aspectRatio, apiKey);
      const imageUrl = imageResult.images[0]?.url;
      if (!imageUrl) throw new Error('No image URL returned from Fal.ai');

      // 2. Generate video from image
      const videoResult = await callFalVideoGenerate(imageUrl, motionPrompt, scene.duration_seconds, seed, apiKey);
      const videoUrl = videoResult.video?.url;
      if (!videoUrl) throw new Error('No video URL returned from Fal.ai');

      // 3. Upload to Supabase Storage for durability
      const [imageUpload, videoUpload] = await Promise.all([
        uploadToSupabase(jobConfig.job_id, scene.scene_id, 'image', imageUrl),
        uploadToSupabase(jobConfig.job_id, scene.scene_id, 'video', videoUrl),
      ]);

      const sceneCost = estimateSceneCost(scene.duration_seconds);
      totalActualCost += sceneCost;

      scenes.push({
        scene_id: scene.scene_id,
        image_url: imageUpload.publicUrl,
        video_url: videoUpload.publicUrl,
        duration_s: scene.duration_seconds,
        seed,
        generation_cost_usd: Number(sceneCost.toFixed(4)),
        status: 'generated',
      });
    } catch (error) {
      // Fallback: Ken Burns on image (will be handled by Shotstack in Agent 6)
      scenes.push({
        scene_id: scene.scene_id,
        image_url: `https://fal-cdn.example.com/${jobConfig.job_id}/${scene.scene_id}.png`,
        video_url: '', // Will be generated via Ken Burns in Shotstack
        duration_s: scene.duration_seconds,
        seed,
        generation_cost_usd: IMAGE_GEN_COST_USD,
        status: 'fallback_ken_burns',
      });
      totalActualCost += IMAGE_GEN_COST_USD;
    }
  }

  const data: VideoAssetsData = {
    style_preset: 'archival_collage_explainer',
    scenes,
    total_estimated_cost_usd: Number(totalEstimatedCost.toFixed(4)),
    total_actual_cost_usd: Number(totalActualCost.toFixed(4)),
    failed_scene_ids: scenes.filter((s) => s.status === 'fallback_ken_burns').map((s) => s.scene_id),
    warnings: [],
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
    model: `${DEFAULT_FAL_IMAGE_MODEL}+${DEFAULT_FAL_VIDEO_MODEL}`,
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