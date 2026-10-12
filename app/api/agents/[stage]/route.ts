import { NextResponse } from 'next/server';
import { presets } from '@/lib/config';
import {
  IDEA_ANALYST_STAGE,
  IDEA_ANALYST_PROMPT_VERSION,
  IDEA_ANALYST_SCHEMA_VERSION,
  DEFAULT_OPENROUTER_MODEL,
  runIdeaAnalyst,
} from '@/lib/agents/idea-analyst';
import type { JobConfig } from '@/lib/agents/types';

export const dynamic = 'force-dynamic';

const STAGES = [
  'idea-analyst',
  'scriptwriter',
  'visual-ideator',
  'timing-layout',
  'video-generator',
  'compositor',
  'audio-mastering',
] as const;

export async function GET(_request: Request, context: { params: { stage: string } }) {
  const { stage } = context.params;
  const known = (STAGES as readonly string[]).includes(stage);

  if (!known) {
    return NextResponse.json({ error: `Unknown agent stage: ${stage}` }, { status: 404 });
  }

  if (stage === 'idea-analyst') {
    return NextResponse.json({
      status: 'ready',
      stage: IDEA_ANALYST_STAGE,
      schema_version: IDEA_ANALYST_SCHEMA_VERSION,
      prompt_version: IDEA_ANALYST_PROMPT_VERSION,
      default_model: DEFAULT_OPENROUTER_MODEL,
      description:
        'Researches topic and generates 3 distinct angles, proposal hooks, and sourced claims matching Agent Instructions v1.0.',
    });
  }

  return NextResponse.json(
    {
      status: 'not_implemented',
      stage,
      message: `Agent route stub for ${stage}. Implementation scheduled for future phase.`,
    },
    { status: 501 },
  );
}

export async function POST(request: Request, context: { params: { stage: string } }) {
  const { stage } = context.params;

  if (stage !== 'idea-analyst') {
    return NextResponse.json(
      {
        status: 'not_implemented',
        stage,
        message: `POST not implemented for ${stage}. Scheduled for future phase.`,
      },
      { status: 501 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const rawConfig = body.config || body;

  const config: JobConfig = {
    job_id: rawConfig.job_id || `job-${Date.now()}`,
    topic: typeof rawConfig.topic === 'string' ? rawConfig.topic : '',
    target_seconds:
      typeof rawConfig.target_seconds === 'number'
        ? rawConfig.target_seconds
        : presets.jobDefaults.target_seconds,
    aspect_ratios: Array.isArray(rawConfig.aspect_ratios)
      ? rawConfig.aspect_ratios
      : [...presets.jobDefaults.aspect_ratios],
    language: rawConfig.language || presets.jobDefaults.language,
    audience: rawConfig.audience || presets.jobDefaults.audience,
    tone: rawConfig.tone || presets.jobDefaults.tone,
    visual_preset: rawConfig.visual_preset || presets.jobDefaults.visual_preset,
    voice: rawConfig.voice || {
      provider: presets.voice.provider,
      voice_id: presets.voice.voice_id,
      language: presets.voice.language,
    },
    music: rawConfig.music || { ...presets.jobDefaults.music },
    budget_limit_usd:
      typeof rawConfig.budget_limit_usd === 'number'
        ? rawConfig.budget_limit_usd
        : presets.jobDefaults.budget_limit_usd,
    approval_mode: rawConfig.approval_mode || presets.jobDefaults.approval_mode,
    provider_config_version: '1.0',
    prompt_version: IDEA_ANALYST_PROMPT_VERSION,
    depth: rawConfig.depth || 'medium',
    user_sources: rawConfig.user_sources,
    seed: rawConfig.seed,
  };

  const envelope = await runIdeaAnalyst(config, {
    forceMock: body.forceMock,
  });

  const statusCode = envelope.status === 'completed' ? 200 : 400;
  return NextResponse.json(envelope, { status: statusCode });
}
