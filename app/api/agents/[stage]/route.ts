import { NextResponse } from 'next/server';
import { presets } from '@/lib/config';
import {
  IDEA_ANALYST_STAGE,
  IDEA_ANALYST_PROMPT_VERSION,
  IDEA_ANALYST_SCHEMA_VERSION,
  DEFAULT_OPENROUTER_MODEL as DEFAULT_IDEA_MODEL,
  runIdeaAnalyst,
} from '@/lib/agents/idea-analyst';
import {
  SCRIPTWRITER_STAGE,
  SCRIPTWRITER_PROMPT_VERSION,
  SCRIPTWRITER_SCHEMA_VERSION,
  DEFAULT_SCRIPTWRITER_MODEL,
  DEFAULT_PACING_WPM,
  runScriptwriter,
} from '@/lib/agents/scriptwriter';
import {
  VISUAL_IDEATOR_STAGE,
  VISUAL_IDEATOR_PROMPT_VERSION,
  VISUAL_IDEATOR_SCHEMA_VERSION,
  DEFAULT_VISUAL_IDEATOR_MODEL,
  runVisualIdeator,
} from '@/lib/agents/visual-ideator';
import {
  TIMING_LAYOUT_STAGE,
  TIMING_LAYOUT_PROMPT_VERSION,
  TIMING_LAYOUT_SCHEMA_VERSION,
  runTimingLayout,
} from '@/lib/agents/timing-layout';
import {
  VIDEO_GENERATOR_STAGE,
  VIDEO_GENERATOR_PROMPT_VERSION,
  VIDEO_GENERATOR_SCHEMA_VERSION,
  runVideoGenerator,
} from '@/lib/agents/video-generator';
import {
  COMPOSITOR_STAGE,
  COMPOSITOR_PROMPT_VERSION,
  COMPOSITOR_SCHEMA_VERSION,
  runCompositor,
} from '@/lib/agents/compositor';
import {
  AUDIO_MASTERING_STAGE,
  AUDIO_MASTERING_PROMPT_VERSION,
  AUDIO_MASTERING_SCHEMA_VERSION,
  runAudioMastering,
} from '@/lib/agents/audio-mastering';
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
      default_model: DEFAULT_IDEA_MODEL,
      description:
        'Researches topic and generates 3 distinct angles, proposal hooks, and sourced claims matching Agent Instructions v1.0.',
    });
  }

  if (stage === 'scriptwriter') {
    return NextResponse.json({
      status: 'ready',
      stage: SCRIPTWRITER_STAGE,
      schema_version: SCRIPTWRITER_SCHEMA_VERSION,
      prompt_version: SCRIPTWRITER_PROMPT_VERSION,
      default_model: DEFAULT_SCRIPTWRITER_MODEL,
      pacing_wpm: DEFAULT_PACING_WPM,
      description:
        'Turns research into a retention-optimized Vox-style explainer script with scene breakdown and pacing calibration.',
    });
  }

  if (stage === 'visual-ideator') {
    return NextResponse.json({
      status: 'ready',
      stage: VISUAL_IDEATOR_STAGE,
      schema_version: VISUAL_IDEATOR_SCHEMA_VERSION,
      prompt_version: VISUAL_IDEATOR_PROMPT_VERSION,
      default_model: DEFAULT_VISUAL_IDEATOR_MODEL,
      description:
        'Converts each approved script scene into a visually precise, style-consistent production plan.',
    });
  }

  if (stage === 'timing-layout') {
    return NextResponse.json({
      status: 'ready',
      stage: TIMING_LAYOUT_STAGE,
      schema_version: TIMING_LAYOUT_SCHEMA_VERSION,
      prompt_version: TIMING_LAYOUT_PROMPT_VERSION,
      description:
        'Assigns precise durations, layout, and audio cues using deterministic rule-based logic.',
    });
  }

  if (stage === 'video-generator') {
    return NextResponse.json({
      status: 'ready',
      stage: VIDEO_GENERATOR_STAGE,
      schema_version: VIDEO_GENERATOR_SCHEMA_VERSION,
      prompt_version: VIDEO_GENERATOR_PROMPT_VERSION,
      description:
        'Generates video clips via Fal.ai (Flux Schnell + Stable Video Diffusion) with Supabase Storage persistence and Ken Burns fallback.',
    });
  }

  if (stage === 'compositor') {
    return NextResponse.json({
      status: 'ready',
      stage: COMPOSITOR_STAGE,
      schema_version: COMPOSITOR_SCHEMA_VERSION,
      prompt_version: COMPOSITOR_PROMPT_VERSION,
      description:
        'Stitches video clips via Shotstack API with transitions, overlays, Ken Burns fallback, and music bed.',
    });
  }

  if (stage === 'audio-mastering') {
    return NextResponse.json({
      status: 'ready',
      stage: AUDIO_MASTERING_STAGE,
      schema_version: AUDIO_MASTERING_SCHEMA_VERSION,
      prompt_version: AUDIO_MASTERING_PROMPT_VERSION,
      description:
        'Generates voiceover via ElevenLabs, captions via AssemblyAI, mixes audio, and produces final MP4.',
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

  if (
    stage !== 'idea-analyst' &&
    stage !== 'scriptwriter' &&
    stage !== 'visual-ideator' &&
    stage !== 'timing-layout' &&
    stage !== 'video-generator' &&
    stage !== 'compositor' &&
    stage !== 'audio-mastering'
  ) {
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
    prompt_version:
      stage === 'scriptwriter'
        ? SCRIPTWRITER_PROMPT_VERSION
        : stage === 'visual-ideator'
        ? VISUAL_IDEATOR_PROMPT_VERSION
        : stage === 'timing-layout'
        ? TIMING_LAYOUT_PROMPT_VERSION
        : stage === 'video-generator'
        ? VIDEO_GENERATOR_PROMPT_VERSION
        : stage === 'compositor'
        ? COMPOSITOR_PROMPT_VERSION
        : stage === 'audio-mastering'
        ? AUDIO_MASTERING_PROMPT_VERSION
        : IDEA_ANALYST_PROMPT_VERSION,
    depth: rawConfig.depth || 'medium',
    user_sources: rawConfig.user_sources,
    seed: rawConfig.seed,
  };

  if (stage === 'idea-analyst') {
    const envelope = await runIdeaAnalyst(config, {
      forceMock: body.forceMock,
    });
    const statusCode = envelope.status === 'completed' ? 200 : 400;
    return NextResponse.json(envelope, { status: statusCode });
  }

  if (stage === 'scriptwriter') {
    if (!body.research) {
      return NextResponse.json(
        {
          job_id: config.job_id,
          stage: SCRIPTWRITER_STAGE,
          status: 'needs_review',
          schema_version: SCRIPTWRITER_SCHEMA_VERSION,
          prompt_version: SCRIPTWRITER_PROMPT_VERSION,
          provider: 'validation',
          model: 'none',
          data: null,
          warnings: ['Missing required research payload for script generation.'],
          errors: [
            {
              code: 'MISSING_RESEARCH',
              message: 'POST /api/agents/scriptwriter requires a "research" object.',
              retryable: false,
              field: 'research',
            },
          ],
          usage: {
            input_tokens: null,
            output_tokens: null,
            estimated_cost_usd: null,
            actual_cost_usd: null,
          },
        },
        { status: 400 },
      );
    }

    const envelope = await runScriptwriter(config, body.research, {
      forceMock: body.forceMock,
      approvedAngleId: body.approvedAngleId,
      pacingWpm: body.pacingWpm,
    });

    const statusCode = envelope.status === 'completed' ? 200 : 400;
    return NextResponse.json(envelope, { status: statusCode });
  }

  if (stage === 'visual-ideator') {
    if (!body.script) {
      return NextResponse.json(
        {
          job_id: config.job_id,
          stage: VISUAL_IDEATOR_STAGE,
          status: 'needs_review',
          schema_version: VISUAL_IDEATOR_SCHEMA_VERSION,
          prompt_version: VISUAL_IDEATOR_PROMPT_VERSION,
          provider: 'validation',
          model: 'none',
          data: null,
          warnings: ['Missing required script payload for visual plan generation.'],
          errors: [
            {
              code: 'MISSING_SCRIPT',
              message: 'POST /api/agents/visual-ideator requires a "script" object.',
              retryable: false,
              field: 'script',
            },
          ],
          usage: {
            input_tokens: null,
            output_tokens: null,
            estimated_cost_usd: null,
            actual_cost_usd: null,
          },
        },
        { status: 400 },
      );
    }

    const envelope = await runVisualIdeator(config, body.script, {
      forceMock: body.forceMock,
      openRouterKey: body.openRouterKey,
      model: body.model,
    });

    const statusCode = envelope.status === 'completed' ? 200 : 400;
    return NextResponse.json(envelope, { status: statusCode });
  }

  if (stage === 'timing-layout') {
    if (!body.script || !body.visualPlan) {
      return NextResponse.json(
        {
          job_id: config.job_id,
          stage: TIMING_LAYOUT_STAGE,
          status: 'needs_review',
          schema_version: TIMING_LAYOUT_SCHEMA_VERSION,
          prompt_version: TIMING_LAYOUT_PROMPT_VERSION,
          provider: 'validation',
          model: 'none',
          data: null,
          warnings: ['Missing required script and/or visualPlan payload for timing & layout.'],
          errors: [
            {
              code: 'MISSING_INPUT',
              message: 'POST /api/agents/timing-layout requires both "script" and "visualPlan" objects.',
              retryable: false,
              field: 'script,visualPlan',
            },
          ],
          usage: {
            input_tokens: null,
            output_tokens: null,
            estimated_cost_usd: null,
            actual_cost_usd: null,
          },
        },
        { status: 400 },
      );
    }

    const envelope = await runTimingLayout(config, body.script, body.visualPlan, {
      forceMock: body.forceMock,
    });

    const statusCode = envelope.status === 'completed' ? 200 : 400;
    return NextResponse.json(envelope, { status: statusCode });
  }

  if (stage === 'video-generator') {
    if (!body.timedPlan) {
      return NextResponse.json(
        {
          job_id: config.job_id,
          stage: VIDEO_GENERATOR_STAGE,
          status: 'needs_review',
          schema_version: VIDEO_GENERATOR_SCHEMA_VERSION,
          prompt_version: VIDEO_GENERATOR_PROMPT_VERSION,
          provider: 'validation',
          model: 'none',
          data: null,
          warnings: ['Missing required timedPlan payload for video generation.'],
          errors: [
            {
              code: 'MISSING_TIMED_PLAN',
              message: 'POST /api/agents/video-generator requires a "timedPlan" object.',
              retryable: false,
              field: 'timedPlan',
            },
          ],
          usage: {
            input_tokens: null,
            output_tokens: null,
            estimated_cost_usd: null,
            actual_cost_usd: null,
          },
        },
        { status: 400 },
      );
    }

    const envelope = await runVideoGenerator(config, body.timedPlan, {
      forceMock: body.forceMock,
      falApiKey: body.falApiKey,
    });

    const statusCode = envelope.status === 'completed' ? 200 : 400;
    return NextResponse.json(envelope, { status: statusCode });
  }

  if (stage === 'compositor') {
    if (!body.videoAssets || !body.timedPlan) {
      return NextResponse.json(
        {
          job_id: config.job_id,
          stage: COMPOSITOR_STAGE,
          status: 'needs_review',
          schema_version: COMPOSITOR_SCHEMA_VERSION,
          prompt_version: COMPOSITOR_PROMPT_VERSION,
          provider: 'validation',
          model: 'none',
          data: null,
          warnings: ['Missing required videoAssets and/or timedPlan payload for compositing.'],
          errors: [
            {
              code: 'MISSING_INPUT',
              message: 'POST /api/agents/compositor requires both "videoAssets" and "timedPlan" objects.',
              retryable: false,
              field: 'videoAssets,timedPlan',
            },
          ],
          usage: {
            input_tokens: null,
            output_tokens: null,
            estimated_cost_usd: null,
            actual_cost_usd: null,
          },
        },
        { status: 400 },
      );
    }

    const envelope = await runCompositor(config, body.videoAssets, body.timedPlan, {
      forceMock: body.forceMock,
      shotstackApiKey: body.shotstackApiKey,
      musicTrackId: body.musicTrackId,
    });

    const statusCode = envelope.status === 'completed' ? 200 : 400;
    return NextResponse.json(envelope, { status: statusCode });
  }

  if (stage === 'audio-mastering') {
    if (!body.silentVideo || !body.script) {
      return NextResponse.json(
        {
          job_id: config.job_id,
          stage: AUDIO_MASTERING_STAGE,
          status: 'needs_review',
          schema_version: AUDIO_MASTERING_SCHEMA_VERSION,
          prompt_version: AUDIO_MASTERING_PROMPT_VERSION,
          provider: 'validation',
          model: 'none',
          data: null,
          warnings: ['Missing required silentVideo and/or script payload for audio mastering.'],
          errors: [
            {
              code: 'MISSING_INPUT',
              message: 'POST /api/agents/audio-mastering requires both "silentVideo" and "script" objects.',
              retryable: false,
              field: 'silentVideo,script',
            },
          ],
          usage: {
            input_tokens: null,
            output_tokens: null,
            estimated_cost_usd: null,
            actual_cost_usd: null,
          },
        },
        { status: 400 },
      );
    }

    const envelope = await runAudioMastering(config, body.silentVideo, body.script, {
      forceMock: body.forceMock,
      elevenLabsKey: body.elevenLabsKey,
      assemblyAiKey: body.assemblyAiKey,
    });

    const statusCode = envelope.status === 'completed' ? 200 : 400;
    return NextResponse.json(envelope, { status: statusCode });
  }

  return NextResponse.json({ error: 'Unhandled stage' }, { status: 500 });
}