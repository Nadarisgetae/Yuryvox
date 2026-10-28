import { NextResponse } from 'next/server';
import {
  determineNextStage,
  runNextStage,
} from '@/lib/pipeline/orchestrator';
import {
  getJob,
  saveJob,
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

    const nextInfo = determineNextStage(job);

    return NextResponse.json({
      job_id: id,
      status: job.status,
      current_stage: job.current_stage || null,
      next_stage: nextInfo.nextStage,
      awaiting_approval: nextInfo.awaitingApproval,
      is_completed: nextInfo.isCompleted,
      storage: getStorageDriver(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        error: `Failed to inspect next stage: ${message}`,
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
    const forceMock = body.forceMock !== undefined ? Boolean(body.forceMock) : false;
    const skipApproval = Boolean(body.skipApproval);
    const targetStage = body.targetStage;

    const result = await runNextStage(job, {
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
    });

    await saveJob(result.job);

    return NextResponse.json({
      status: result.job.status,
      stage_executed: result.stageRun,
      storage: getStorageDriver(),
      job_id: result.job.job_id,
      job: result.job,
      error: result.error,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        error: `Failed to step pipeline: ${message}`,
      },
      { status: 500 },
    );
  }
}
