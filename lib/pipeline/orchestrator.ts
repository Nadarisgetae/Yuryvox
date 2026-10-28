import type {
  JobConfig,
  StageError,
  ResearchEnvelope,
  ScriptEnvelope,
  VisualPlanEnvelope,
  TimedPlanEnvelope,
  VideoAssetsEnvelope,
  SilentVideoEnvelope,
  FinalVideoEnvelope,
  ResearchData,
  ScriptData,
  VisualPlanData,
  TimedPlanData,
  VideoAssetsData,
  SilentVideoData,
  FinalVideoData,
  CaptionsData,
} from '@/lib/agents/types';
import { presets } from '@/lib/config';
import { runIdeaAnalyst, validateGateA } from '@/lib/agents/idea-analyst';
import { runScriptwriter, validateGateB } from '@/lib/agents/scriptwriter';
import { runVisualIdeator, validateGateC } from '@/lib/agents/visual-ideator';
import { runTimingLayout, validateGateD } from '@/lib/agents/timing-layout';
import { runVideoGenerator, validateGateE } from '@/lib/agents/video-generator';
import { runCompositor, validateGateF } from '@/lib/agents/compositor';
import { runAudioMastering, validateGateG } from '@/lib/agents/audio-mastering';

export type PipelineStage =
  | 'idea_analyst'
  | 'scriptwriter'
  | 'visual_ideator'
  | 'timing_layout'
  | 'video_generator'
  | 'compositor'
  | 'audio_mastering';

export type PipelineStatus =
  | 'pending'
  | 'in_progress'
  | 'awaiting_approval'
  | 'completed'
  | 'failed'
  | 'needs_review';

export interface JobCostBreakdown {
  idea_analyst_usd: number;
  scriptwriter_usd: number;
  visual_ideator_usd: number;
  timing_layout_usd: number;
  video_gen_usd: number;
  compositor_usd: number;
  audio_mastering_usd: number;
  storage_usd: number;
  total_usd: number;
}

export interface JobTimestamps {
  created: string;
  idea_analyst?: string;
  scriptwriter?: string;
  visual_ideator?: string;
  timing_layout?: string;
  video_generator?: string;
  compositor?: string;
  audio_mastering?: string;
  completed?: string;
  failed?: string;
}

export interface JobRecord {
  job_id: string;
  idempotency_key: string;
  topic: string;
  target_seconds: number;
  aspects: string[];
  voice: {
    provider: string;
    voice_id: string;
    stability?: number;
    similarity?: number;
    language?: string;
  };
  music: {
    enabled: boolean;
    track_id?: string;
    level_db?: number;
  };
  caption_style?: {
    font: string;
    size: number;
    color: string;
    outline: number;
    position: string;
  };
  config: JobConfig;
  status: PipelineStatus;
  current_stage?: PipelineStage;
  research?: ResearchData;
  script?: ScriptData;
  visual_plan?: VisualPlanData;
  timed_plan?: TimedPlanData;
  video_assets?: VideoAssetsData;
  silent_video?: SilentVideoData;
  final_video?: FinalVideoData;
  captions?: CaptionsData;
  thumbnail?: { url: string };
  cost: JobCostBreakdown;
  timestamps: JobTimestamps;
  seed: number;
  needs_review: boolean;
  error?: StageError;
  warnings: string[];
}

export interface OrchestratorOptions {
  forceMock?: boolean;
  targetStage?: PipelineStage;
  stepOnly?: boolean;
  skipApproval?: boolean;
  resumeFrom?: PipelineStage;
  approvedAngleId?: string;
  pacingWpm?: number;
  openRouterKey?: string | null;
  falApiKey?: string | null;
  shotstackApiKey?: string | null;
  elevenLabsKey?: string | null;
  assemblyAiKey?: string | null;
  onStageStart?: (stage: PipelineStage, job: JobRecord) => void | Promise<void>;
  onStageComplete?: (stage: PipelineStage, envelope: unknown, job: JobRecord) => void | Promise<void>;
}

export interface PipelineResult {
  success: boolean;
  job: JobRecord;
  envelopes: {
    research?: ResearchEnvelope;
    script?: ScriptEnvelope;
    visual_plan?: VisualPlanEnvelope;
    timed_plan?: TimedPlanEnvelope;
    video_assets?: VideoAssetsEnvelope;
    silent_video?: SilentVideoEnvelope;
    final_video?: FinalVideoEnvelope;
  };
  error?: StageError;
}

/**
 * Initialize a new, clean JobRecord matching Appendix B specification.
 */
export function createJobRecord(config: JobConfig, idempotencyKey?: string): JobRecord {
  const seed = config.seed ?? Math.floor(Math.random() * 1000000);
  const now = new Date().toISOString();

  return {
    job_id: config.job_id,
    idempotency_key: idempotencyKey || config.job_id,
    topic: config.topic,
    target_seconds: config.target_seconds,
    aspects: [...config.aspect_ratios],
    voice: {
      provider: config.voice.provider || presets.voice.provider,
      voice_id: config.voice.voice_id || presets.voice.voice_id || '21m00Tcm4TlvDq8ikWAM',
      stability: config.voice.stability ?? presets.voice.stability,
      similarity: config.voice.similarity ?? presets.voice.similarity,
      language: config.voice.language || presets.voice.language,
    },
    music: {
      enabled: config.music?.enabled ?? presets.jobDefaults.music.enabled,
      track_id: config.music?.track_id || presets.jobDefaults.music.track_id,
      level_db: -18,
    },
    caption_style: {
      font: 'Inter',
      size: 48,
      color: '#FFFFFF',
      outline: 2,
      position: 'bottom_center',
    },
    config: {
      ...config,
      voice: {
        provider: config.voice.provider || presets.voice.provider,
        voice_id: config.voice.voice_id || presets.voice.voice_id || '21m00Tcm4TlvDq8ikWAM',
        language: config.voice.language || presets.voice.language,
        stability: config.voice.stability ?? presets.voice.stability,
        similarity: config.voice.similarity ?? presets.voice.similarity,
      },
    },
    status: 'pending',
    cost: {
      idea_analyst_usd: 0,
      scriptwriter_usd: 0,
      visual_ideator_usd: 0,
      timing_layout_usd: 0,
      video_gen_usd: 0,
      compositor_usd: 0,
      audio_mastering_usd: 0,
      storage_usd: 0,
      total_usd: 0,
    },
    timestamps: {
      created: now,
    },
    seed,
    needs_review: false,
    warnings: [],
  };
}

/**
 * Execute the 7-stage agent pipeline sequentially.
 */
export async function runPipeline(
  config: JobConfig,
  options: OrchestratorOptions = {},
  existingJob?: JobRecord,
): Promise<PipelineResult> {
  const job = existingJob ? { ...existingJob } : createJobRecord(config);
  const envelopes: PipelineResult['envelopes'] = {};

  const STAGES_ORDER: PipelineStage[] = [
    'idea_analyst',
    'scriptwriter',
    'visual_ideator',
    'timing_layout',
    'video_generator',
    'compositor',
    'audio_mastering',
  ];

  // Helper to calculate total costs
  const recalculateTotalCost = () => {
    job.cost.total_usd = Number(
      (
        job.cost.idea_analyst_usd +
        job.cost.scriptwriter_usd +
        job.cost.visual_ideator_usd +
        job.cost.timing_layout_usd +
        job.cost.video_gen_usd +
        job.cost.compositor_usd +
        job.cost.audio_mastering_usd +
        job.cost.storage_usd
      ).toFixed(4),
    );
  };

  try {
    // ══════════════════════════════════════════════════════════
    // STAGE 1: IDEA ANALYST
    // ══════════════════════════════════════════════════════════
    if (!job.research) {
      job.current_stage = 'idea_analyst';
      job.status = 'in_progress';
      job.timestamps.idea_analyst = new Date().toISOString();
      if (options.onStageStart) await options.onStageStart('idea_analyst', job);

      const gateA = validateGateA(job.config);
      if (!gateA.valid) {
        job.status = 'needs_review';
        job.error = gateA.errors[0];
        job.needs_review = true;
        return { success: false, job, envelopes, error: gateA.errors[0] };
      }

      const researchEnv = await runIdeaAnalyst(job.config, {
        forceMock: options.forceMock,
        openRouterKey: options.openRouterKey,
      });

      envelopes.research = researchEnv;
      if (researchEnv.status !== 'completed' && researchEnv.status !== 'needs_input') {
        job.status = 'failed';
        job.error = researchEnv.errors[0];
        return { success: false, job, envelopes, error: researchEnv.errors[0] };
      }

      job.research = researchEnv.data;
      job.cost.idea_analyst_usd = researchEnv.usage?.actual_cost_usd ?? researchEnv.usage?.estimated_cost_usd ?? 0.002;
      recalculateTotalCost();
      if (researchEnv.warnings.length > 0) job.warnings.push(...researchEnv.warnings);
      if (options.onStageComplete) await options.onStageComplete('idea_analyst', researchEnv, job);

      if (options.targetStage === 'idea_analyst') {
        job.status = options.stepOnly ? 'in_progress' : 'completed';
        return { success: true, job, envelopes };
      }
    }

    // ══════════════════════════════════════════════════════════
    // STAGE 2: SCRIPTWRITER
    // ══════════════════════════════════════════════════════════
    if (!job.script) {
      job.current_stage = 'scriptwriter';
      job.timestamps.scriptwriter = new Date().toISOString();
      if (options.onStageStart) await options.onStageStart('scriptwriter', job);

      const gateB = validateGateB(job.config, job.research!);
      if (!gateB.valid) {
        job.status = 'needs_review';
        job.error = gateB.errors[0];
        job.needs_review = true;
        return { success: false, job, envelopes, error: gateB.errors[0] };
      }

      const scriptEnv = await runScriptwriter(job.config, job.research!, {
        forceMock: options.forceMock,
        approvedAngleId: options.approvedAngleId,
        pacingWpm: options.pacingWpm,
        openRouterKey: options.openRouterKey,
      });

      envelopes.script = scriptEnv;
      if (scriptEnv.status !== 'completed') {
        job.status = 'failed';
        job.error = scriptEnv.errors[0];
        return { success: false, job, envelopes, error: scriptEnv.errors[0] };
      }

      job.script = scriptEnv.data;
      job.cost.scriptwriter_usd = scriptEnv.usage?.actual_cost_usd ?? scriptEnv.usage?.estimated_cost_usd ?? 0.003;
      recalculateTotalCost();
      if (scriptEnv.warnings.length > 0) job.warnings.push(...scriptEnv.warnings);
      if (options.onStageComplete) await options.onStageComplete('scriptwriter', scriptEnv, job);

      if (options.targetStage === 'scriptwriter') {
        job.status = options.stepOnly ? 'in_progress' : 'completed';
        return { success: true, job, envelopes };
      }
    }

    // ══════════════════════════════════════════════════════════
    // STAGE 3: VISUAL IDEATOR
    // ══════════════════════════════════════════════════════════
    if (!job.visual_plan) {
      job.current_stage = 'visual_ideator';
      job.timestamps.visual_ideator = new Date().toISOString();
      if (options.onStageStart) await options.onStageStart('visual_ideator', job);

      const gateC = validateGateC(job.config, job.script!);
      if (!gateC.valid) {
        job.status = 'needs_review';
        job.error = gateC.errors[0];
        job.needs_review = true;
        return { success: false, job, envelopes, error: gateC.errors[0] };
      }

      const visualEnv = await runVisualIdeator(job.config, job.script!, {
        forceMock: options.forceMock,
        openRouterKey: options.openRouterKey,
      });

      envelopes.visual_plan = visualEnv;
      if (visualEnv.status !== 'completed') {
        job.status = 'failed';
        job.error = visualEnv.errors[0];
        return { success: false, job, envelopes, error: visualEnv.errors[0] };
      }

      job.visual_plan = visualEnv.data;
      job.cost.visual_ideator_usd = visualEnv.usage?.actual_cost_usd ?? visualEnv.usage?.estimated_cost_usd ?? 0.002;
      recalculateTotalCost();
      if (visualEnv.warnings.length > 0) job.warnings.push(...visualEnv.warnings);
      if (options.onStageComplete) await options.onStageComplete('visual_ideator', visualEnv, job);

      if (options.targetStage === 'visual_ideator') {
        job.status = options.stepOnly ? 'in_progress' : 'completed';
        return { success: true, job, envelopes };
      }
    }

    // ══════════════════════════════════════════════════════════
    // STAGE 4: TIMING & LAYOUT
    // ══════════════════════════════════════════════════════════
    if (!job.timed_plan) {
      job.current_stage = 'timing_layout';
      job.timestamps.timing_layout = new Date().toISOString();
      if (options.onStageStart) await options.onStageStart('timing_layout', job);

      const gateD = validateGateD(job.config, job.script!, job.visual_plan!);
      if (!gateD.valid) {
        job.status = 'needs_review';
        job.error = gateD.errors[0];
        job.needs_review = true;
        return { success: false, job, envelopes, error: gateD.errors[0] };
      }

      const timedEnv = await runTimingLayout(job.config, job.script!, job.visual_plan!, {
        forceMock: options.forceMock,
      });

      envelopes.timed_plan = timedEnv;
      if (timedEnv.status !== 'completed') {
        job.status = 'failed';
        job.error = timedEnv.errors[0];
        return { success: false, job, envelopes, error: timedEnv.errors[0] };
      }

      job.timed_plan = timedEnv.data;
      job.cost.timing_layout_usd = 0; // Rule-based, zero API cost
      recalculateTotalCost();
      if (timedEnv.warnings.length > 0) job.warnings.push(...timedEnv.warnings);
      if (options.onStageComplete) await options.onStageComplete('timing_layout', timedEnv, job);

      if (options.targetStage === 'timing_layout') {
        job.status = options.stepOnly ? 'in_progress' : 'completed';
        return { success: true, job, envelopes };
      }
    }

    // ══════════════════════════════════════════════════════════
    // HUMAN-IN-THE-LOOP APPROVAL GATE (Before paid generation)
    // ══════════════════════════════════════════════════════════
    if (
      job.config.approval_mode === 'script_and_visual_plan_before_paid_generation' &&
      !options.skipApproval &&
      !job.video_assets
    ) {
      job.status = 'awaiting_approval';
      job.needs_review = true;
      job.warnings.push(
        'Pipeline paused at approval gate: Script and Visual Plan ready for human review before paid generation.',
      );
      return { success: true, job, envelopes };
    }

    // ══════════════════════════════════════════════════════════
    // STAGE 5: VIDEO GENERATOR
    // ══════════════════════════════════════════════════════════
    if (!job.video_assets) {
      job.current_stage = 'video_generator';
      job.status = 'in_progress';
      job.timestamps.video_generator = new Date().toISOString();
      if (options.onStageStart) await options.onStageStart('video_generator', job);

      // Self-heal: If timed_plan has timeline_valid: false, reconcile with updated timing layout rules
      if (job.timed_plan && !job.timed_plan.timeline_valid && job.script && job.visual_plan) {
        const timedEnv = await runTimingLayout(job.config, job.script, job.visual_plan, {
          forceMock: options.forceMock,
        });
        if (timedEnv.status === 'completed' && timedEnv.data.timeline_valid) {
          job.timed_plan = timedEnv.data;
        }
      }

      const gateE = validateGateE(job.config, job.timed_plan!);
      if (!gateE.valid) {
        job.status = 'needs_review';
        job.error = gateE.errors[0];
        job.needs_review = true;
        return { success: false, job, envelopes, error: gateE.errors[0] };
      }

      const videoAssetsEnv = await runVideoGenerator(job.config, job.timed_plan!, {
        forceMock: options.forceMock,
        falApiKey: options.falApiKey,
        visualPlan: job.visual_plan ?? null,
        existingAssets: job.video_assets ?? null,
        onSceneProgress: async (scene) => {
          if (!job.video_assets) {
            job.video_assets = {
              style_preset: job.config.visual_preset || 'archival_collage_explainer',
              scenes: [],
              total_estimated_cost_usd: 0,
              total_actual_cost_usd: 0,
              failed_scene_ids: [],
              warnings: [],
            };
          }
          const existingIdx = job.video_assets.scenes.findIndex((s) => s.scene_id === scene.scene_id);
          if (existingIdx >= 0) {
            job.video_assets.scenes[existingIdx] = scene;
          } else {
            job.video_assets.scenes.push(scene);
          }
          job.video_assets.total_actual_cost_usd = Number(
            job.video_assets.scenes.reduce((sum, s) => sum + s.generation_cost_usd, 0).toFixed(4),
          );
          job.cost.video_gen_usd = job.video_assets.total_actual_cost_usd;
          recalculateTotalCost();
          if (options.onStageStart) await options.onStageStart('video_generator', job);
        },
      });

      envelopes.video_assets = videoAssetsEnv;
      if (videoAssetsEnv.status !== 'completed') {
        job.status = 'failed';
        job.error = videoAssetsEnv.errors[0];
        return { success: false, job, envelopes, error: videoAssetsEnv.errors[0] };
      }

      job.video_assets = videoAssetsEnv.data;
      job.cost.video_gen_usd =
        videoAssetsEnv.usage?.actual_cost_usd ??
        videoAssetsEnv.data.total_actual_cost_usd ??
        videoAssetsEnv.data.total_estimated_cost_usd ??
        0.065;
      recalculateTotalCost();
      if (videoAssetsEnv.warnings.length > 0) job.warnings.push(...videoAssetsEnv.warnings);
      if (options.onStageComplete) await options.onStageComplete('video_generator', videoAssetsEnv, job);

      if (options.targetStage === 'video_generator') {
        job.status = options.stepOnly ? 'in_progress' : 'completed';
        return { success: true, job, envelopes };
      }
    }

    // ══════════════════════════════════════════════════════════
    // STAGE 6: COMPOSITOR
    // ══════════════════════════════════════════════════════════
    if (!job.silent_video) {
      job.current_stage = 'compositor';
      job.timestamps.compositor = new Date().toISOString();
      if (options.onStageStart) await options.onStageStart('compositor', job);

      const gateF = validateGateF(job.config, job.video_assets!, job.timed_plan!);
      if (!gateF.valid) {
        job.status = 'needs_review';
        job.error = gateF.errors[0];
        job.needs_review = true;
        return { success: false, job, envelopes, error: gateF.errors[0] };
      }

      const compositorEnv = await runCompositor(job.config, job.video_assets!, job.timed_plan!, {
        forceMock: options.forceMock,
        shotstackApiKey: options.shotstackApiKey,
        musicTrackId: job.config.music?.track_id,
      });

      envelopes.silent_video = compositorEnv;
      if (compositorEnv.status !== 'completed') {
        job.status = 'failed';
        job.error = compositorEnv.errors[0];
        return { success: false, job, envelopes, error: compositorEnv.errors[0] };
      }

      job.silent_video = compositorEnv.data;
      job.thumbnail = { url: compositorEnv.data.thumbnail_url };
      job.cost.compositor_usd =
        compositorEnv.usage?.actual_cost_usd ?? compositorEnv.data.actual_cost_usd ?? 0.05;
      recalculateTotalCost();
      if (compositorEnv.warnings.length > 0) job.warnings.push(...compositorEnv.warnings);
      if (options.onStageComplete) await options.onStageComplete('compositor', compositorEnv, job);

      if (options.targetStage === 'compositor') {
        job.status = options.stepOnly ? 'in_progress' : 'completed';
        return { success: true, job, envelopes };
      }
    }

    // ══════════════════════════════════════════════════════════
    // STAGE 7: AUDIO MASTERING
    // ══════════════════════════════════════════════════════════
    if (!job.final_video) {
      job.current_stage = 'audio_mastering';
      job.timestamps.audio_mastering = new Date().toISOString();
      if (options.onStageStart) await options.onStageStart('audio_mastering', job);

      const gateG = validateGateG(job.config, job.silent_video!);
      if (!gateG.valid) {
        job.status = 'needs_review';
        job.error = gateG.errors[0];
        job.needs_review = true;
        return { success: false, job, envelopes, error: gateG.errors[0] };
      }

      const audioEnv = await runAudioMastering(job.config, job.silent_video!, job.script!, {
        forceMock: options.forceMock,
        elevenLabsKey: options.elevenLabsKey,
        assemblyAiKey: options.assemblyAiKey,
      });

      envelopes.final_video = audioEnv;
      if (audioEnv.status !== 'completed') {
        job.status = 'failed';
        job.error = audioEnv.errors[0];
        return { success: false, job, envelopes, error: audioEnv.errors[0] };
      }

      job.final_video = audioEnv.data;
      job.captions = audioEnv.data.captions || {
        srt_url: `https://mock-supabase.example.com/${job.job_id}/captions.srt`,
        ass_url: `https://mock-supabase.example.com/${job.job_id}/captions.ass`,
        sync_passed: true,
      };
      job.cost.audio_mastering_usd = audioEnv.usage?.actual_cost_usd ?? 0.05;
      recalculateTotalCost();
      if (audioEnv.warnings.length > 0) job.warnings.push(...audioEnv.warnings);
      if (options.onStageComplete) await options.onStageComplete('audio_mastering', audioEnv, job);
    }

    // ══════════════════════════════════════════════════════════
    // PIPELINE COMPLETION
    // ══════════════════════════════════════════════════════════
    job.status = 'completed';
    job.timestamps.completed = new Date().toISOString();
    job.needs_review = false;
    recalculateTotalCost();

    return {
      success: true,
      job,
      envelopes,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const fatalError: StageError = {
      code: 'PIPELINE_ERROR',
      message: errorMsg,
      retryable: true,
    };

    job.status = 'failed';
    job.error = fatalError;
    job.timestamps.failed = new Date().toISOString();

    return {
      success: false,
      job,
      envelopes,
      error: fatalError,
    };
  }
}

/**
 * Identify the single next pending stage and approval requirements for a job.
 */
export function determineNextStage(
  job: JobRecord,
  options?: Pick<OrchestratorOptions, 'skipApproval'>,
): {
  nextStage: PipelineStage | null;
  awaitingApproval: boolean;
  isCompleted: boolean;
} {
  if (!job.research) {
    return { nextStage: 'idea_analyst', awaitingApproval: false, isCompleted: false };
  }
  if (!job.script) {
    return { nextStage: 'scriptwriter', awaitingApproval: false, isCompleted: false };
  }
  if (!job.visual_plan) {
    return { nextStage: 'visual_ideator', awaitingApproval: false, isCompleted: false };
  }
  if (!job.timed_plan) {
    return { nextStage: 'timing_layout', awaitingApproval: false, isCompleted: false };
  }
  if (!job.video_assets) {
    const needsApproval =
      job.config.approval_mode === 'script_and_visual_plan_before_paid_generation' &&
      !options?.skipApproval;
    return {
      nextStage: 'video_generator',
      awaitingApproval: needsApproval,
      isCompleted: false,
    };
  }
  if (!job.silent_video) {
    return { nextStage: 'compositor', awaitingApproval: false, isCompleted: false };
  }
  if (!job.final_video) {
    return { nextStage: 'audio_mastering', awaitingApproval: false, isCompleted: false };
  }
  return { nextStage: null, awaitingApproval: false, isCompleted: true };
}

/**
 * Execute only the single next pending stage of the pipeline.
 * Designed for serverless step progression, client polling loops, and background stepping.
 */
export async function runNextStage(
  job: JobRecord,
  options: OrchestratorOptions = {},
): Promise<PipelineResult & { stageRun?: PipelineStage }> {
  // If user requested a specific stage to run or re-run, invalidate it and all downstream stages
  if (options.targetStage) {
    const STAGE_ORDER: PipelineStage[] = [
      'idea_analyst',
      'scriptwriter',
      'visual_ideator',
      'timing_layout',
      'video_generator',
      'compositor',
      'audio_mastering',
    ];
    const stageIdx = STAGE_ORDER.indexOf(options.targetStage);
    if (stageIdx !== -1) {
      if (stageIdx <= 0) job.research = undefined;
      if (stageIdx <= 1) job.script = undefined;
      if (stageIdx <= 2) job.visual_plan = undefined;
      if (stageIdx <= 3) job.timed_plan = undefined;
      if (stageIdx <= 4) job.video_assets = undefined;
      if (stageIdx <= 5) {
        job.silent_video = undefined;
        job.thumbnail = undefined;
      }
      if (stageIdx <= 6) {
        job.final_video = undefined;
        job.captions = undefined;
      }
      job.current_stage = options.targetStage;
      job.status = 'in_progress';
      job.error = undefined;
      job.needs_review = false;

      const isFinalStage = options.targetStage === 'audio_mastering';
      const result = await runPipeline(
        job.config,
        {
          ...options,
          targetStage: options.targetStage,
          stepOnly: !isFinalStage,
          skipApproval: true,
        },
        job,
      );

      return {
        ...result,
        stageRun: options.targetStage,
      };
    }
  }

  const nextInfo = determineNextStage(job, options);

  if (nextInfo.isCompleted) {
    job.status = 'completed';
    return { success: true, job, envelopes: {} };
  }

  if (nextInfo.awaitingApproval) {
    job.status = 'awaiting_approval';
    job.needs_review = true;
    job.warnings.push(
      'Pipeline paused at approval gate: Script and Visual Plan ready for human review before paid generation.',
    );
    return { success: true, job, envelopes: {} };
  }

  if (!nextInfo.nextStage) {
    job.status = 'completed';
    return { success: true, job, envelopes: {} };
  }

  const stageToRun = (options.targetStage as PipelineStage | undefined) || nextInfo.nextStage;
  const isFinalStage = stageToRun === 'audio_mastering';

  const result = await runPipeline(
    job.config,
    {
      ...options,
      targetStage: stageToRun,
      stepOnly: !isFinalStage,
      skipApproval: options.skipApproval || !nextInfo.awaitingApproval,
    },
    job,
  );

  return {
    ...result,
    stageRun: stageToRun,
  };
}
