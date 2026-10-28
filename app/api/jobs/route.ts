import { NextResponse } from 'next/server';
import { presets } from '@/lib/config';
import type { JobConfig } from '@/lib/agents/types';
import {
  createJobRecord,
  runPipeline,
  PipelineStage,
} from '@/lib/pipeline/orchestrator';
import {
  saveJob,
  listJobs,
  getStorageDriver,
} from '@/lib/pipeline/storage';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : 50;

    const jobs = await listJobs(isNaN(limit) ? 50 : limit);

    return NextResponse.json({
      status: 'ready',
      storage: getStorageDriver(),
      jobs,
      count: jobs.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        status: 'error',
        message: `Failed to retrieve jobs: ${message}`,
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const rawConfig = body.config || body;

    const topic = typeof rawConfig.topic === 'string' ? rawConfig.topic.trim() : '';
    if (!topic) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Job creation requires a non-empty "topic" field.',
        },
        { status: 400 },
      );
    }

    const config: JobConfig = {
      job_id: rawConfig.job_id || `job-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      topic,
      target_seconds:
        typeof rawConfig.target_seconds === 'number'
          ? rawConfig.target_seconds
          : presets.jobDefaults.target_seconds,
      aspect_ratios: Array.isArray(rawConfig.aspect_ratios) && rawConfig.aspect_ratios.length > 0
        ? rawConfig.aspect_ratios
        : [...presets.jobDefaults.aspect_ratios],
      language: rawConfig.language || presets.jobDefaults.language,
      audience: rawConfig.audience || presets.jobDefaults.audience,
      tone: rawConfig.tone || presets.jobDefaults.tone,
      visual_preset: rawConfig.visual_preset || presets.jobDefaults.visual_preset,
      voice: {
        provider: rawConfig.voice?.provider || presets.voice.provider,
        voice_id: rawConfig.voice?.voice_id || presets.voice.voice_id || '21m00Tcm4TlvDq8ikWAM',
        language: rawConfig.voice?.language || presets.voice.language,
        stability: rawConfig.voice?.stability ?? presets.voice.stability,
        similarity: rawConfig.voice?.similarity ?? presets.voice.similarity,
      },
      music: {
        enabled: rawConfig.music?.enabled ?? presets.jobDefaults.music.enabled,
        track_id: rawConfig.music?.track_id || presets.jobDefaults.music.track_id,
      },
      budget_limit_usd:
        typeof rawConfig.budget_limit_usd === 'number'
          ? rawConfig.budget_limit_usd
          : presets.jobDefaults.budget_limit_usd,
      approval_mode: rawConfig.approval_mode || presets.jobDefaults.approval_mode,
      provider_config_version: '1.0',
      prompt_version: '1.0',
      depth: rawConfig.depth || 'medium',
      user_sources: rawConfig.user_sources,
      seed: typeof rawConfig.seed === 'number' ? rawConfig.seed : undefined,
    };

    const idempotencyKey =
      typeof body.idempotency_key === 'string' ? body.idempotency_key : undefined;

    // Create and save initial pending record
    const jobRecord = createJobRecord(config, idempotencyKey);
    await saveJob(jobRecord);

    const autoRun = body.auto_run !== false;

    if (!autoRun) {
      return NextResponse.json(
        {
          status: 'pending',
          storage: getStorageDriver(),
          job_id: jobRecord.job_id,
          job: jobRecord,
        },
        { status: 201 },
      );
    }

    // Run pipeline
    const targetStage = body.targetStage as PipelineStage | undefined;
    const forceMock = body.forceMock !== undefined ? Boolean(body.forceMock) : false;
    const skipApproval = Boolean(body.skipApproval);
    const isBackground = body.background === true || body.sync === false;

    if (isBackground) {
      jobRecord.status = 'in_progress';
      await saveJob(jobRecord);

      void runPipeline(
        config,
        {
          forceMock,
          skipApproval,
          targetStage,
          approvedAngleId: body.approvedAngleId,
          onStageStart: async (_stage, currentJob) => {
            await saveJob(currentJob);
          },
          onStageComplete: async (_stage, _envelope, currentJob) => {
            await saveJob(currentJob);
          },
        },
        jobRecord,
      )
        .then(async (result) => {
          await saveJob(result.job);
        })
        .catch(async (err) => {
          jobRecord.status = 'failed';
          jobRecord.error = {
            code: 'BACKGROUND_PIPELINE_ERROR',
            message: err instanceof Error ? err.message : String(err),
            retryable: true,
          };
          await saveJob(jobRecord);
        });

      return NextResponse.json(
        {
          status: 'in_progress',
          storage: getStorageDriver(),
          job_id: jobRecord.job_id,
          job: jobRecord,
          message:
            'Job execution started in background. Poll /api/jobs/[id] or step with /api/jobs/[id]/step.',
        },
        { status: 202 },
      );
    }

    const result = await runPipeline(
      config,
      {
        forceMock,
        skipApproval,
        targetStage,
        approvedAngleId: body.approvedAngleId,
        onStageStart: async (_stage, currentJob) => {
          await saveJob(currentJob);
        },
        onStageComplete: async (_stage, _envelope, currentJob) => {
          await saveJob(currentJob);
        },
      },
      jobRecord,
    );

    await saveJob(result.job);

    return NextResponse.json(
      {
        status: result.job.status,
        storage: getStorageDriver(),
        job_id: result.job.job_id,
        job: result.job,
        error: result.error,
      },
      { status: 201 },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        status: 'error',
        message: `Internal server error creating job: ${message}`,
      },
      { status: 500 },
    );
  }
}