import { NextResponse } from 'next/server';
import { runPipeline, PipelineStage } from '@/lib/pipeline/orchestrator';
import {
  getJob,
  saveJob,
  deleteJob,
  getStorageDriver,
} from '@/lib/pipeline/storage';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  context: { params: { id: string } },
) {
  try {
    const { id } = context.params;
    const job = await getJob(id);

    if (!job) {
      return NextResponse.json(
        {
          error: 'Job not found',
          job_id: id,
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      status: job.status,
      storage: getStorageDriver(),
      job,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        error: `Failed to retrieve job: ${message}`,
      },
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
  context: { params: { id: string } },
) {
  try {
    const { id } = context.params;
    const job = await getJob(id);

    if (!job) {
      return NextResponse.json(
        {
          error: 'Job not found',
          job_id: id,
        },
        { status: 404 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const action = body.action || 'resume';

    if (action === 'approve' || action === 'resume') {
      if (job.status === 'completed') {
        return NextResponse.json({
          status: 'completed',
          message: 'Job is already completed',
          job,
        });
      }

      const forceMock = body.forceMock !== undefined ? Boolean(body.forceMock) : false;
      const targetStage = body.targetStage as PipelineStage | undefined;

      const result = await runPipeline(
        job.config,
        {
          forceMock,
          skipApproval: true,
          targetStage,
          approvedAngleId: body.approvedAngleId,
          onStageStart: async (_stage, currentJob) => {
            await saveJob(currentJob);
          },
          onStageComplete: async (_stage, _envelope, currentJob) => {
            await saveJob(currentJob);
          },
        },
        job,
      );

      await saveJob(result.job);

      return NextResponse.json({
        status: result.job.status,
        storage: getStorageDriver(),
        job_id: result.job.job_id,
        job: result.job,
        error: result.error,
      });
    }

    if (action === 'retry') {
      job.status = 'in_progress';
      job.error = undefined;
      job.needs_review = false;

      const forceMock = body.forceMock !== undefined ? Boolean(body.forceMock) : false;
      const skipApproval = Boolean(body.skipApproval);

      const result = await runPipeline(
        job.config,
        {
          forceMock,
          skipApproval,
          onStageStart: async (_stage, currentJob) => {
            await saveJob(currentJob);
          },
          onStageComplete: async (_stage, _envelope, currentJob) => {
            await saveJob(currentJob);
          },
        },
        job,
      );

      await saveJob(result.job);

      return NextResponse.json({
        status: result.job.status,
        storage: getStorageDriver(),
        job_id: result.job.job_id,
        job: result.job,
        error: result.error,
      });
    }

    if (action === 'redo') {
      const STAGE_ORDER: PipelineStage[] = [
        'idea_analyst',
        'scriptwriter',
        'visual_ideator',
        'timing_layout',
        'video_generator',
        'compositor',
        'audio_mastering',
      ];

      let stageToRedo: PipelineStage = body.stage;
      if (!stageToRedo || !STAGE_ORDER.includes(stageToRedo)) {
        stageToRedo = (job.current_stage as PipelineStage) || 'idea_analyst';
      }

      const stageIdx = STAGE_ORDER.indexOf(stageToRedo);
      if (stageIdx === -1) {
        return NextResponse.json({ error: `Invalid stage to redo: ${stageToRedo}` }, { status: 400 });
      }

      // Invalidate the target stage and all downstream stages
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

      job.current_stage = stageToRedo;
      job.status = 'in_progress';
      job.error = undefined;
      job.needs_review = false;

      const forceMock = body.forceMock !== undefined ? Boolean(body.forceMock) : false;
      const skipApproval = true;

      const result = await runPipeline(
        job.config,
        {
          forceMock,
          skipApproval,
          targetStage: stageToRedo,
          stepOnly: stageToRedo !== 'audio_mastering',
          approvedAngleId: body.approvedAngleId,
          onStageStart: async (_stage, currentJob) => {
            await saveJob(currentJob);
          },
          onStageComplete: async (_stage, _envelope, currentJob) => {
            await saveJob(currentJob);
          },
        },
        job,
      );

      // If we just redid timing_layout (Stage 4) and approval mode is enabled, pause at awaiting_approval
      if (
        result.job.status === 'in_progress' &&
        result.job.timed_plan &&
        !result.job.video_assets &&
        result.job.config.approval_mode === 'script_and_visual_plan_before_paid_generation'
      ) {
        result.job.status = 'awaiting_approval';
        result.job.needs_review = true;
      }

      await saveJob(result.job);

      return NextResponse.json({
        status: result.job.status,
        storage: getStorageDriver(),
        job_id: result.job.job_id,
        stage_executed: stageToRedo,
        job: result.job,
        error: result.error,
      });
    }

    return NextResponse.json(
      {
        error: `Unknown action: "${action}". Supported actions: "approve", "resume", "retry", "redo".`,
      },
      { status: 400 },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        error: `Failed to process job action: ${message}`,
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: { id: string } },
) {
  try {
    const { id } = context.params;
    const success = await deleteJob(id);

    return NextResponse.json({
      success,
      job_id: id,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        error: `Failed to delete job: ${message}`,
      },
      { status: 500 },
    );
  }
}
