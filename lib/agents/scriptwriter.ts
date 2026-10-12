import type {
  JobConfig,
  ResearchData,
  ScriptData,
  ScriptEnvelope,
  StageError,
} from './types';
import { getOpenRouterKey } from '@/lib/providers/openrouter';

export const SCRIPTWRITER_STAGE = 'scriptwriter' as const;
export const SCRIPTWRITER_SCHEMA_VERSION = '1.0' as const;
export const SCRIPTWRITER_PROMPT_VERSION = '1.0' as const;
export const DEFAULT_PACING_WPM = 145;
export const DEFAULT_SCRIPTWRITER_MODEL = 'mistralai/mixtral-8x7b-instruct' as const;

export function countWords(text: string): number {
  if (!text || typeof text !== 'string') return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function calculateTargetWordCount(targetSeconds: number, pacingWpm: number = DEFAULT_PACING_WPM): number {
  return Math.round((targetSeconds * pacingWpm) / 60);
}

export function calculateDuration(wordCount: number, pacingWpm: number = DEFAULT_PACING_WPM): number {
  return Math.round((wordCount / pacingWpm) * 60);
}

export function validateGateB(
  jobConfig: JobConfig,
  research: ResearchData,
): {
  valid: boolean;
  errors: StageError[];
} {
  const errors: StageError[] = [];

  if (!research || typeof research !== 'object') {
    errors.push({
      code: 'MISSING_RESEARCH_DATA',
      message: 'Scriptwriter requires validated research data',
      retryable: false,
    });
    return { valid: false, errors };
  }

  if (!Array.isArray(research.angles) || research.angles.length === 0) {
    errors.push({
      code: 'NO_RESEARCH_ANGLES',
      message: 'Research data must contain at least one narrative angle',
      retryable: false,
      field: 'research.angles',
    });
  }

  if (!Array.isArray(research.claims) || research.claims.length === 0) {
    errors.push({
      code: 'NO_RESEARCH_CLAIMS',
      message: 'Research data must contain factual claims to write from',
      retryable: false,
      field: 'research.claims',
    });
  }

  if (typeof jobConfig.target_seconds !== 'number' || jobConfig.target_seconds <= 0) {
    errors.push({
      code: 'INVALID_RUNTIME',
      message: 'target_seconds must be a positive number',
      retryable: false,
      field: 'target_seconds',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateScriptOutput(
  data: unknown,
  research?: ResearchData,
  pacingWpm: number = DEFAULT_PACING_WPM,
): {
  valid: boolean;
  errors: StageError[];
  warnings: string[];
} {
  const errors: StageError[] = [];
  const warnings: string[] = [];

  if (!data || typeof data !== 'object') {
    return {
      valid: false,
      errors: [
        {
          code: 'INVALID_SCRIPT_DATA',
          message: 'Script data must be an object',
          retryable: true,
        },
      ],
      warnings: [],
    };
  }

  const d = data as Partial<ScriptData>;

  if (!d.title || typeof d.title !== 'string') {
    errors.push({
      code: 'MISSING_TITLE',
      message: 'Script must have a title',
      retryable: true,
      field: 'title',
    });
  }

  if (!d.central_thesis || typeof d.central_thesis !== 'string') {
    errors.push({
      code: 'MISSING_CENTRAL_THESIS',
      message: 'Script must have a clear central thesis',
      retryable: true,
      field: 'central_thesis',
    });
  }

  if (!Array.isArray(d.scenes) || d.scenes.length === 0) {
    errors.push({
      code: 'MISSING_SCENES',
      message: 'Script must be divided into at least one scene',
      retryable: true,
      field: 'scenes',
    });
    return { valid: false, errors, warnings };
  }

  const allowedFunctions = new Set([
    'hook',
    'context',
    'explanation',
    'evidence',
    'transition',
    'payoff',
  ]);

  const researchClaimIds = research?.claims ? new Set(research.claims.map((c) => c.claim_id)) : null;

  d.scenes.forEach((scene, index) => {
    if (!scene.scene_id) {
      errors.push({
        code: 'MISSING_SCENE_ID',
        message: `Scene at index ${index} is missing scene_id`,
        retryable: true,
        field: `scenes[${index}].scene_id`,
      });
    }

    if (!scene.narration || typeof scene.narration !== 'string') {
      errors.push({
        code: 'MISSING_NARRATION',
        message: `Scene ${scene.scene_id || index} has empty narration`,
        retryable: true,
        field: `scenes[${index}].narration`,
      });
    }

    if (!allowedFunctions.has(scene.narrative_function)) {
      errors.push({
        code: 'INVALID_NARRATIVE_FUNCTION',
        message: `Scene ${scene.scene_id || index} has invalid narrative_function: ${scene.narrative_function}`,
        retryable: true,
        field: `scenes[${index}].narrative_function`,
      });
    }

    // Check on-screen text length (should be concise, max 4-6 words)
    if (scene.on_screen_text_suggestion) {
      const words = countWords(scene.on_screen_text_suggestion);
      if (words > 6) {
        warnings.push(
          `Scene ${scene.scene_id || index} on-screen text has ${words} words (recommended: max 4).`,
        );
      }
    }

    // Traceability: claims must exist in research
    if (researchClaimIds && Array.isArray(scene.claim_ids)) {
      for (const cid of scene.claim_ids) {
        if (!researchClaimIds.has(cid)) {
          warnings.push(`Scene ${scene.scene_id} references claim ${cid} not found in research.`);
        }
      }
    }

    // Pacing check: warn if a scene has excessive word density for an explainer shot
    if (scene.narration) {
      const words = countWords(scene.narration);
      if (words > 35) {
        warnings.push(
          `Scene ${scene.scene_id} narration has ${words} words. Consider splitting into shorter shots (10-19 words at ${pacingWpm} wpm).`,
        );
      }
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function buildScriptwriterPrompt(
  jobConfig: JobConfig,
  research: ResearchData,
  approvedAngleId?: string,
  pacingWpm: number = DEFAULT_PACING_WPM,
): {
  systemPrompt: string;
  userPrompt: string;
} {
  const angleId = approvedAngleId || research.recommended_angle_id;
  const angle = research.angles.find((a) => a.angle_id === angleId) || research.angles[0];
  const targetWords = calculateTargetWordCount(jobConfig.target_seconds, pacingWpm);

  const systemPrompt = `You are a senior scriptwriter for a Vox-style archival-collage explainer video.
Follow these non-negotiable rules:
1. Return ONLY a valid JSON object matching the requested schema. No markdown formatting, no code fences, no commentary.
2. Spoken delivery: Write clear, conversational, retention-optimized narration for an explainer video. Not an academic essay.
3. Target word count: Exactly ${targetWords} words (${jobConfig.target_seconds} seconds at ${pacingWpm} wpm).
4. Scene timing rule: Split narration into scenes representing 4-8 second visual shots (~10-19 spoken words per scene). Do NOT place 30+ words in a short scene.
5. Factual integrity: Use ONLY claims from the provided research. Map every factual sentence to its claim_id (e.g. ["C1", "C2"]). Never invent statistics or quotes.
6. On-screen text: Provide concise text overlay suggestions (maximum 4 words) per scene.
7. Narrative progression: Hook -> Context -> Explanation -> Evidence -> Transition -> Payoff.

Output JSON Schema:
{
  "title": "string",
  "logline": "string",
  "central_thesis": "string",
  "estimated_word_count": 0,
  "target_word_count": ${targetWords},
  "estimated_duration_seconds": ${jobConfig.target_seconds},
  "runtime_deviation_seconds": 0,
  "script": "full combined narration text",
  "scenes": [
    {
      "scene_id": "SC01",
      "narration": "spoken text for this scene",
      "narrative_function": "hook|context|explanation|evidence|transition|payoff",
      "claim_ids": ["C1"],
      "on_screen_text_suggestion": "Max 4 words",
      "visual_concept": "tactile archival description of what viewer sees",
      "pronunciation_notes": [],
      "sensitivity_flags": []
    }
  ],
  "unresolved_claims": [],
  "editorial_notes": ["string"]
}`;

  const userPrompt = `Topic: "${jobConfig.topic}"
Approved Angle: "${angle.title}" (${angle.central_question})
Angle Summary: "${angle.summary}"
Audience: ${jobConfig.audience}
Tone: ${jobConfig.tone}
Language: ${jobConfig.language}
Target Words: ${targetWords} words (${jobConfig.target_seconds}s at ${pacingWpm} wpm)

Available Research Claims to cite:
${JSON.stringify(
  research.claims.map((c) => ({
    claim_id: c.claim_id,
    claim: c.claim,
    support_status: c.support_status,
  })),
  null,
  2,
)}

Hooks proposed by researcher:
${JSON.stringify(research.hooks.map((h) => h.text))}

Write the full explainer script and scene breakdown.`;

  return { systemPrompt, userPrompt };
}

export function generateDeterministicMockScript(
  jobConfig: JobConfig,
  research: ResearchData,
  approvedAngleId?: string,
  pacingWpm: number = DEFAULT_PACING_WPM,
): ScriptData {
  const angleId = approvedAngleId || research.recommended_angle_id;
  const angle = research.angles.find((a) => a.angle_id === angleId) || research.angles[0];
  const targetWords = calculateTargetWordCount(jobConfig.target_seconds, pacingWpm);

  const selectedHook =
    research.hooks?.[0]?.text ||
    `If you look closely at how ${jobConfig.topic} actually works, the answer traces back to a quiet decision made decades ago.`;

  const claim1 = research.claims[0];
  const claim2 = research.claims[1] || claim1;
  const claim3 = research.claims[2] || claim1;
  const claim4 = research.claims[3] || claim2;

  const scenes = [
    {
      scene_id: 'SC01',
      narration: selectedHook,
      narrative_function: 'hook' as const,
      claim_ids: claim1 ? [claim1.claim_id] : [],
      on_screen_text_suggestion: 'The Hidden System',
      visual_concept: `Aged desk surface with warm spotlight; a worn file folder containing archival documents on ${jobConfig.topic} slides into view.`,
      pronunciation_notes: [],
      sensitivity_flags: [],
      word_count: countWords(selectedHook),
      estimated_seconds: calculateDuration(countWords(selectedHook), pacingWpm),
    },
    {
      scene_id: 'SC02',
      narration: `At first glance, it seems like modern convenience or individual choices dictate the entire system.`,
      narrative_function: 'context' as const,
      claim_ids: claim1 ? [claim1.claim_id] : [],
      on_screen_text_suggestion: 'First Glance',
      visual_concept: 'Archival black-and-white photographs of daily life, pinned alongside early planning diagrams.',
      pronunciation_notes: [],
      sensitivity_flags: [],
      word_count: countWords(
        'At first glance, it seems like modern convenience or individual choices dictate the entire system.',
      ),
      estimated_seconds: calculateDuration(15, pacingWpm),
    },
    {
      scene_id: 'SC03',
      narration: `In reality, underlying physical path-dependencies codified decades ago shape nearly every outcome we see today.`,
      narrative_function: 'explanation' as const,
      claim_ids: claim1 && claim2 ? [claim1.claim_id, claim2.claim_id] : [],
      on_screen_text_suggestion: 'Path Dependencies',
      visual_concept: 'Hand-drawn schematic map unfolding with red ink highlighting key structural junctions.',
      pronunciation_notes: [],
      sensitivity_flags: [],
      word_count: countWords(
        'In reality, underlying physical path-dependencies codified decades ago shape nearly every outcome we see today.',
      ),
      estimated_seconds: calculateDuration(16, pacingWpm),
    },
    {
      scene_id: 'SC04',
      narration: `During mid-century regulatory consolidations, planners locked in rigid technical standards that still govern the network.`,
      narrative_function: 'evidence' as const,
      claim_ids: claim2 ? [claim2.claim_id] : [],
      on_screen_text_suggestion: '1950s Mandates',
      visual_concept: 'Typed legislative memorandum with official stamps and paperclips revealed in layers.',
      pronunciation_notes: [],
      sensitivity_flags: [],
      word_count: countWords(
        'During mid-century regulatory consolidations, planners locked in rigid technical standards that still govern the network.',
      ),
      estimated_seconds: calculateDuration(15, pacingWpm),
    },
    {
      scene_id: 'SC05',
      narration: `When modern volume surges, these legacy friction points create the bottlenecks that cost billions every year.`,
      narrative_function: 'explanation' as const,
      claim_ids: claim3 ? [claim3.claim_id] : [],
      on_screen_text_suggestion: 'Friction Points',
      visual_concept: 'Flowchart diagram showing capacity limits, accented with tactile paper arrows and charcoal textures.',
      pronunciation_notes: [],
      sensitivity_flags: [],
      word_count: countWords(
        'When modern volume surges, these legacy friction points create the bottlenecks that cost billions every year.',
      ),
      estimated_seconds: calculateDuration(16, pacingWpm),
    },
    {
      scene_id: 'SC06',
      narration: `Surveys show public perception dramatically underestimates the scale of ongoing maintenance operations.`,
      narrative_function: 'evidence' as const,
      claim_ids: claim4 ? [claim4.claim_id] : [],
      on_screen_text_suggestion: 'Hidden Ledger',
      visual_concept: 'Balance sheet excerpt with a magnifying lens focusing on recurring capital expenditure items.',
      pronunciation_notes: [],
      sensitivity_flags: [],
      word_count: countWords(
        'Surveys show public perception dramatically underestimates the scale of ongoing maintenance operations.',
      ),
      estimated_seconds: calculateDuration(14, pacingWpm),
    },
    {
      scene_id: 'SC07',
      narration: `The lesson is clear: we aren't just using modern technology—we are living inside the blueprints of the past.`,
      narrative_function: 'payoff' as const,
      claim_ids: claim1 ? [claim1.claim_id] : [],
      on_screen_text_suggestion: 'The Living Blueprint',
      visual_concept: 'Wide overhead shot pulling back as individual documents assemble into a complete blueprint grid.',
      pronunciation_notes: [],
      sensitivity_flags: [],
      word_count: countWords(
        "The lesson is clear: we aren't just using modern technology—we are living inside the blueprints of the past.",
      ),
      estimated_seconds: calculateDuration(16, pacingWpm),
    },
  ];

  const fullScript = scenes.map((s) => s.narration).join(' ');
  const estimatedWordCount = countWords(fullScript);
  const estimatedDurationSeconds = calculateDuration(estimatedWordCount, pacingWpm);

  return {
    title: angle.title,
    logline: angle.summary,
    central_thesis: angle.central_question,
    estimated_word_count: estimatedWordCount,
    target_word_count: targetWords,
    estimated_duration_seconds: estimatedDurationSeconds,
    runtime_deviation_seconds: estimatedDurationSeconds - jobConfig.target_seconds,
    script: fullScript,
    scenes,
    unresolved_claims: [],
    editorial_notes: [
      `Script generated using pacing standard of ${pacingWpm} words per minute.`,
      `Final scene timing will be calibrated during audio synthesis in Agent 7.`,
    ],
  };
}

export async function runScriptwriter(
  jobConfig: JobConfig,
  research: ResearchData,
  options: {
    forceMock?: boolean;
    openRouterKey?: string | null;
    model?: string;
    approvedAngleId?: string;
    pacingWpm?: number;
  } = {},
): Promise<ScriptEnvelope> {
  const pacingWpm = options.pacingWpm || DEFAULT_PACING_WPM;

  const gateB = validateGateB(jobConfig, research);
  if (!gateB.valid) {
    return {
      job_id: jobConfig.job_id || 'unknown',
      stage: SCRIPTWRITER_STAGE,
      status: 'needs_review',
      schema_version: SCRIPTWRITER_SCHEMA_VERSION,
      prompt_version: SCRIPTWRITER_PROMPT_VERSION,
      provider: 'validation',
      model: 'none',
      data: {} as ScriptData,
      warnings: ['Gate B validation failed.'],
      errors: gateB.errors,
      usage: {
        input_tokens: null,
        output_tokens: null,
        estimated_cost_usd: null,
        actual_cost_usd: null,
      },
    };
  }

  const apiKey = options.openRouterKey ?? getOpenRouterKey();
  const shouldUseMock = options.forceMock || !apiKey;
  const model = options.model || DEFAULT_SCRIPTWRITER_MODEL;

  if (shouldUseMock) {
    const data = generateDeterministicMockScript(
      jobConfig,
      research,
      options.approvedAngleId,
      pacingWpm,
    );
    const validation = validateScriptOutput(data, research, pacingWpm);

    return {
      job_id: jobConfig.job_id,
      stage: SCRIPTWRITER_STAGE,
      status: 'completed',
      schema_version: SCRIPTWRITER_SCHEMA_VERSION,
      prompt_version: SCRIPTWRITER_PROMPT_VERSION,
      provider: 'mock_adapter',
      model: 'deterministic_fixture',
      data,
      warnings: [
        'Mock adapter was used because OPENROUTER_API_KEY was not configured or forceMock was enabled.',
        ...validation.warnings,
      ],
      errors: [],
      usage: {
        input_tokens: 0,
        output_tokens: 0,
        estimated_cost_usd: 0,
        actual_cost_usd: 0,
      },
    };
  }

  const { systemPrompt, userPrompt } = buildScriptwriterPrompt(
    jobConfig,
    research,
    options.approvedAngleId,
    pacingWpm,
  );

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://github.com/yuryvox',
        'X-Title': 'Yuryvox Video Pipeline',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 2000,
        seed: jobConfig.seed,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return {
        job_id: jobConfig.job_id,
        stage: SCRIPTWRITER_STAGE,
        status: response.status >= 500 ? 'retryable_error' : 'fatal_error',
        schema_version: SCRIPTWRITER_SCHEMA_VERSION,
        prompt_version: SCRIPTWRITER_PROMPT_VERSION,
        provider: 'openrouter',
        model,
        data: {} as ScriptData,
        warnings: [],
        errors: [
          {
            code: 'OPENROUTER_API_ERROR',
            message: `OpenRouter returned status ${response.status}`,
            retryable: response.status >= 500,
            details: [errText],
          },
        ],
        usage: {
          input_tokens: null,
          output_tokens: null,
          estimated_cost_usd: null,
          actual_cost_usd: null,
        },
      };
    }

    const json = await response.json();
    const content = json.choices?.[0]?.message?.content || '';
    const cleanContent = content.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    const parsedData = JSON.parse(cleanContent) as ScriptData;

    const validation = validateScriptOutput(parsedData, research, pacingWpm);
    if (!validation.valid) {
      return {
        job_id: jobConfig.job_id,
        stage: SCRIPTWRITER_STAGE,
        status: 'retryable_error',
        schema_version: SCRIPTWRITER_SCHEMA_VERSION,
        prompt_version: SCRIPTWRITER_PROMPT_VERSION,
        provider: 'openrouter',
        model,
        data: parsedData,
        warnings: validation.warnings,
        errors: validation.errors,
        usage: {
          input_tokens: json.usage?.prompt_tokens ?? null,
          output_tokens: json.usage?.completion_tokens ?? null,
          estimated_cost_usd: 0.003,
          actual_cost_usd: 0,
        },
      };
    }

    return {
      job_id: jobConfig.job_id,
      stage: SCRIPTWRITER_STAGE,
      status: 'completed',
      schema_version: SCRIPTWRITER_SCHEMA_VERSION,
      prompt_version: SCRIPTWRITER_PROMPT_VERSION,
      provider: 'openrouter',
      model,
      data: parsedData,
      warnings: validation.warnings,
      errors: [],
      usage: {
        input_tokens: json.usage?.prompt_tokens ?? null,
        output_tokens: json.usage?.completion_tokens ?? null,
        estimated_cost_usd: 0.003,
        actual_cost_usd: 0,
      },
    };
  } catch (error) {
    return {
      job_id: jobConfig.job_id,
      stage: SCRIPTWRITER_STAGE,
      status: 'retryable_error',
      schema_version: SCRIPTWRITER_SCHEMA_VERSION,
      prompt_version: SCRIPTWRITER_PROMPT_VERSION,
      provider: 'openrouter',
      model,
      data: {} as ScriptData,
      warnings: [],
      errors: [
        {
          code: 'EXECUTION_EXCEPTION',
          message: error instanceof Error ? error.message : 'Unknown exception',
          retryable: true,
        },
      ],
      usage: {
        input_tokens: null,
        output_tokens: null,
        estimated_cost_usd: null,
        actual_cost_usd: null,
      },
    };
  }
}
