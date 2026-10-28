import { NextResponse } from 'next/server';
import { runPipeline, createJobRecord } from '@/lib/pipeline/orchestrator';
import { saveJob, getStorageDriver } from '@/lib/pipeline/storage';
import { presets } from '@/lib/config';
import type { JobConfig } from '@/lib/agents/types';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const baseConfig: JobConfig = {
      job_id: 'demo-container-ships-01',
      topic: 'How container ships quietly restructured global trade',
      target_seconds: 90,
      aspect_ratios: ['16:9'],
      language: 'en',
      audience: 'general audience',
      tone: 'clear, curious, evidence-led',
      visual_preset: presets.style.id,
      voice: {
        provider: presets.voice.provider,
        voice_id: '21m00Tcm4TlvDq8ikWAM',
      },
      music: presets.jobDefaults.music,
      budget_limit_usd: 15,
      approval_mode: 'script_and_visual_plan_before_paid_generation',
      provider_config_version: '1.0',
      prompt_version: '1.0',
    };

    // Demo 1: Completed 90s Standard Explainer
    const res1 = await runPipeline(baseConfig, { forceMock: true, skipApproval: true });
    res1.job.timestamps.created = new Date(Date.now() - 3600000).toISOString();
    await saveJob(res1.job);

    // Demo 2: 3-Min Featurette Awaiting Human Approval
    const config2: JobConfig = {
      ...baseConfig,
      job_id: 'demo-paper-maps-02',
      topic: 'The forgotten paper maps that created modern property lines',
      target_seconds: 180,
    };
    const res2 = await runPipeline(config2, { forceMock: true, skipApproval: false });
    res2.job.timestamps.created = new Date(Date.now() - 1800000).toISOString();
    await saveJob(res2.job);

    // Demo 3: Completed 5-Min Deep Dive
    const config3: JobConfig = {
      ...baseConfig,
      job_id: 'demo-electric-grid-03',
      topic: 'Why electric grid frequencies must never drift from 60 Hz',
      target_seconds: 300,
    };
    const res3 = await runPipeline(config3, { forceMock: true, skipApproval: true });
    res3.job.timestamps.created = new Date(Date.now() - 600000).toISOString();
    await saveJob(res3.job);

    return NextResponse.json({
      success: true,
      count: 3,
      storage: getStorageDriver(),
      jobs: [res1.job, res2.job, res3.job],
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        error: `Failed to seed demo jobs: ${message}`,
      },
      { status: 500 },
    );
  }
}
