import type {
  JobConfig,
  ResearchData,
  ResearchEnvelope,
  StageError,
} from './types';
import { getOpenRouterKey } from '@/lib/providers/openrouter';

export const IDEA_ANALYST_STAGE = 'idea_analyst' as const;
export const IDEA_ANALYST_SCHEMA_VERSION = '1.0' as const;
export const IDEA_ANALYST_PROMPT_VERSION = '1.0' as const;
export const DEFAULT_OPENROUTER_MODEL = 'google/gemini-2.5-flash' as const;

export function validateGateA(config: Partial<JobConfig>): {
  valid: boolean;
  errors: StageError[];
} {
  const errors: StageError[] = [];

  if (!config.job_id || typeof config.job_id !== 'string') {
    errors.push({
      code: 'INVALID_JOB_ID',
      message: 'job_id must be a non-empty string',
      retryable: false,
      field: 'job_id',
    });
  }

  if (!config.topic || typeof config.topic !== 'string' || config.topic.trim().length === 0) {
    errors.push({
      code: 'MISSING_TOPIC',
      message: 'Topic must be a non-empty string',
      retryable: false,
      field: 'topic',
    });
  }

  if (typeof config.target_seconds !== 'number' || config.target_seconds <= 0) {
    errors.push({
      code: 'INVALID_TARGET_SECONDS',
      message: 'target_seconds must be a positive number',
      retryable: false,
      field: 'target_seconds',
    });
  }

  if (!Array.isArray(config.aspect_ratios) || config.aspect_ratios.length === 0) {
    errors.push({
      code: 'INVALID_ASPECT_RATIOS',
      message: 'aspect_ratios must contain at least one aspect ratio',
      retryable: false,
      field: 'aspect_ratios',
    });
  }

  if (typeof config.budget_limit_usd !== 'number' || config.budget_limit_usd < 0) {
    errors.push({
      code: 'INVALID_BUDGET',
      message: 'budget_limit_usd must be a non-negative number',
      retryable: false,
      field: 'budget_limit_usd',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateResearchOutput(data: unknown): {
  valid: boolean;
  errors: StageError[];
} {
  const errors: StageError[] = [];

  if (!data || typeof data !== 'object') {
    return {
      valid: false,
      errors: [
        {
          code: 'INVALID_RESEARCH_DATA',
          message: 'Research output data must be an object',
          retryable: true,
        },
      ],
    };
  }

  const d = data as Partial<ResearchData>;

  if (!Array.isArray(d.angles) || d.angles.length === 0) {
    errors.push({
      code: 'MISSING_ANGLES',
      message: 'Output must include at least one angle (ideally three)',
      retryable: true,
      field: 'angles',
    });
  } else {
    const angleIds = new Set(d.angles.map((a) => a.angle_id));
    if (!d.recommended_angle_id || !angleIds.has(d.recommended_angle_id)) {
      errors.push({
        code: 'INVALID_RECOMMENDED_ANGLE',
        message: 'recommended_angle_id must match an existing angle_id',
        retryable: true,
        field: 'recommended_angle_id',
      });
    }
  }

  if (!Array.isArray(d.claims) || d.claims.length === 0) {
    errors.push({
      code: 'MISSING_CLAIMS',
      message: 'Research output must contain factual claims with claim_ids',
      retryable: true,
      field: 'claims',
    });
  } else {
    for (const c of d.claims) {
      if (!c.claim_id || !c.claim) {
        errors.push({
          code: 'MALFORMED_CLAIM',
          message: 'Every claim must have a claim_id and claim text',
          retryable: true,
          field: 'claims',
        });
        break;
      }
      if (!c.support_status) {
        errors.push({
          code: 'MISSING_SUPPORT_STATUS',
          message: `Claim ${c.claim_id} is missing support_status`,
          retryable: true,
          field: `claims.${c.claim_id}.support_status`,
        });
      }
    }
  }

  if (!Array.isArray(d.hooks)) {
    errors.push({
      code: 'MISSING_HOOKS',
      message: 'hooks must be an array of proposal hooks',
      retryable: true,
      field: 'hooks',
    });
  }

  if (!Array.isArray(d.sources)) {
    errors.push({
      code: 'MISSING_SOURCES',
      message: 'sources must be an array',
      retryable: true,
      field: 'sources',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function buildIdeaAnalystPrompt(config: JobConfig): {
  systemPrompt: string;
  userPrompt: string;
} {
  const systemPrompt = `You are a senior investigative researcher producing research for a Vox-style archival-collage explainer video.
Follow these non-negotiable rules:
1. Return ONLY a valid JSON object matching the requested schema. No markdown formatting, no code fences, no commentary.
2. Never invent citations, fake URLs, or simulated search results. If a source URL is not verified, set support_status to "source_unavailable" or "unsupported".
3. Distinguish verified facts from inference, opinion, and speculation.
4. Provide exactly 3 distinct narrative angles with clear central questions. Recommend the strongest one.
5. Provide at least 3 proposal hooks that are curiosity-driven without misleading clickbait.
6. Provide at least 4 detailed claims tagged with claim_id (e.g. C1, C2) and support_status.

Output JSON Schema:
{
  "angles": [
    {
      "angle_id": "A1",
      "title": "string",
      "central_question": "string",
      "summary": "string",
      "strengths": ["string"],
      "evidence_gaps": ["string"]
    }
  ],
  "recommended_angle_id": "A1",
  "hooks": [
    {
      "text": "string",
      "type": "question|surprising_fact|contradiction|story",
      "fact_dependent": true,
      "supporting_claim_ids": ["C1"]
    }
  ],
  "claims": [
    {
      "claim_id": "C1",
      "claim": "string",
      "claim_type": "fact|inference|opinion|uncertain",
      "support_status": "supported|partially_supported|unsupported|conflicting|source_unavailable",
      "source_ids": ["S1"],
      "evidence_summary": "string",
      "caveat": null
    }
  ],
  "sources": [
    {
      "source_id": "S1",
      "title": "string",
      "publisher": "string",
      "url": "https://...",
      "published_at": null,
      "retrieved_at": null,
      "source_type": "primary|secondary|reference|user_provided",
      "relevant_excerpt_or_summary": "string"
    }
  ],
  "research_gaps": ["string"],
  "sensitivity_flags": ["string"],
  "recommended_narrative": "string"
}`;

  const userPrompt = `Topic: "${config.topic}"
Target Runtime: ${config.target_seconds} seconds
Audience: ${config.audience}
Tone: ${config.tone}
Language: ${config.language}
Research Depth: ${config.depth || 'medium'}
${
  config.user_sources && config.user_sources.length > 0
    ? `User-provided sources: ${JSON.stringify(config.user_sources)}`
    : 'No external user sources provided. Web search not connected. Rely on trained knowledge with honest support_status flags.'
}`;

  return { systemPrompt, userPrompt };
}

export function generateDeterministicMockResearch(config: JobConfig): ResearchData {
  const t = config.topic.trim();
  const cleanTitle = t.charAt(0).toUpperCase() + t.slice(1);

  return {
    angles: [
      {
        angle_id: 'A1',
        title: `The Hidden Infrastructure Behind ${cleanTitle}`,
        central_question: `What unseen systems and historical choices made ${cleanTitle} what it is today?`,
        summary: `An evidence-led breakdown examining how ${cleanTitle} evolved through physical infrastructure and policy decisions.`,
        strengths: [
          'Directly fits tactile archival-collage visual evidence',
          'Clear cause-and-effect narrative arc',
        ],
        evidence_gaps: ['Requires precise timeline dates and municipal/institutional records'],
      },
      {
        angle_id: 'A2',
        title: `The Economic Incentive Trap of ${cleanTitle}`,
        central_question: `Who pays, who profits, and why is ${cleanTitle} structured this way?`,
        summary: `Explores the financial balance sheet, market distortions, and hidden costs surrounding ${cleanTitle}.`,
        strengths: ['Strong quantitative charts and data diagram opportunities', 'High viewer curiosity'],
        evidence_gaps: ['Comparative historical data across different regions needed'],
      },
      {
        angle_id: 'A3',
        title: `The Unintended Consequences of Regulating ${cleanTitle}`,
        central_question: `How did well-meaning attempts to solve ${cleanTitle} create new dilemmas?`,
        summary: `A nuanced critique showing how historical interventions produced paradoxes and modern challenges.`,
        strengths: ['Compelling counter-intuitive story twists', 'Rich archival paper trail of past debates'],
        evidence_gaps: ['Need to ensure balanced perspectives on policy impacts'],
      },
    ],
    recommended_angle_id: 'A1',
    hooks: [
      {
        text: `If you look closely at how ${cleanTitle} actually works, the single biggest factor isn't what most people think.`,
        type: 'contradiction',
        fact_dependent: false,
        supporting_claim_ids: ['C1'],
      },
      {
        text: `Why does ${cleanTitle} look the way it does? The answer traces back to a quiet decision made decades ago.`,
        type: 'question',
        fact_dependent: true,
        supporting_claim_ids: ['C2'],
      },
      {
        text: `To understand the modern crisis in ${cleanTitle}, you first have to understand a paper map drawn in the twentieth century.`,
        type: 'story',
        fact_dependent: true,
        supporting_claim_ids: ['C2', 'C3'],
      },
    ],
    claims: [
      {
        claim_id: 'C1',
        claim: `${cleanTitle} is primarily shaped by underlying institutional standards and physical path-dependencies rather than individual choices.`,
        claim_type: 'fact',
        support_status: 'supported',
        source_ids: ['S1'],
        evidence_summary: 'Historical documentation and standard industry engineering records demonstrate structural path-dependency.',
        caveat: null,
      },
      {
        claim_id: 'C2',
        claim: `Major turning points in ${cleanTitle} were codified during major regulatory consolidations in the mid-20th century.`,
        claim_type: 'fact',
        support_status: 'supported',
        source_ids: ['S1', 'S2'],
        evidence_summary: 'Primary legislative records and historical planning manuals confirm the key timeline milestones.',
        caveat: 'Specific dates vary slightly by jurisdiction.',
      },
      {
        claim_id: 'C3',
        claim: `Current efficiency bottlenecks in ${cleanTitle} stem directly from legacy infrastructure mismatch.`,
        claim_type: 'inference',
        support_status: 'partially_supported',
        source_ids: ['S2'],
        evidence_summary: 'Empirical studies show substantial friction when modern demands meet legacy constraints.',
        caveat: 'Awaiting updated current-year benchmark figures.',
      },
      {
        claim_id: 'C4',
        claim: `Public perception of ${cleanTitle} significantly underestimates the true economic scale of maintenance operations.`,
        claim_type: 'opinion',
        support_status: 'supported',
        source_ids: ['S2'],
        evidence_summary: 'Public opinion surveys contrast sharply with audited municipal capital expenditure accounts.',
        caveat: null,
      },
    ],
    sources: [
      {
        source_id: 'S1',
        title: `Historical Analysis and Archival Documentation on ${cleanTitle}`,
        publisher: 'Public Records & Historical Archives',
        url: 'https://archive.org/details/historical-records',
        published_at: '2020-01-15',
        retrieved_at: new Date().toISOString().split('T')[0],
        source_type: 'secondary',
        relevant_excerpt_or_summary: `Comprehensive overview of the origin points, regulatory development, and physical maps of ${cleanTitle}.`,
      },
      {
        source_id: 'S2',
        title: `Economic and Structural Overview: ${cleanTitle}`,
        publisher: 'Journal of Policy Analysis',
        url: 'https://doi.org/10.1000/policy-review',
        published_at: '2022-06-10',
        retrieved_at: new Date().toISOString().split('T')[0],
        source_type: 'secondary',
        relevant_excerpt_or_summary: `Statistical breakdown of resource allocations, infrastructure costs, and system inefficiencies in ${cleanTitle}.`,
      },
    ],
    research_gaps: [
      'Real-time live search API not connected in Phase 2; claims are based on curated reference models and historical frameworks.',
    ],
    sensitivity_flags: [],
    recommended_narrative: `Focus on Angle A1: Start with a hook examining the physical paradox of ${cleanTitle}, reveal the archival map/documents from S1 that established the initial framework, trace the development through C1 and C2, and conclude with the modern implications of C3.`,
  };
}

export async function runIdeaAnalyst(
  config: JobConfig,
  options: {
    forceMock?: boolean;
    openRouterKey?: string | null;
    model?: string;
  } = {},
): Promise<ResearchEnvelope> {
  const gateA = validateGateA(config);
  if (!gateA.valid) {
    return {
      job_id: config.job_id || 'unknown',
      stage: IDEA_ANALYST_STAGE,
      status: 'needs_input',
      schema_version: IDEA_ANALYST_SCHEMA_VERSION,
      prompt_version: IDEA_ANALYST_PROMPT_VERSION,
      provider: 'validation',
      model: 'none',
      data: {} as ResearchData,
      warnings: ['Gate A validation failed.'],
      errors: gateA.errors,
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
  const model = options.model || DEFAULT_OPENROUTER_MODEL;

  if (shouldUseMock) {
    const data = generateDeterministicMockResearch(config);
    return {
      job_id: config.job_id,
      stage: IDEA_ANALYST_STAGE,
      status: 'completed',
      schema_version: IDEA_ANALYST_SCHEMA_VERSION,
      prompt_version: IDEA_ANALYST_PROMPT_VERSION,
      provider: 'mock_adapter',
      model: 'deterministic_fixture',
      data,
      warnings: [
        'Mock adapter was used because OPENROUTER_API_KEY was not configured or forceMock was enabled.',
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

  const { systemPrompt, userPrompt } = buildIdeaAnalystPrompt(config);

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
        response_format: { type: 'json_object' },
        temperature: 0.2,
        max_tokens: 4000,
        seed: config.seed,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return {
        job_id: config.job_id,
        stage: IDEA_ANALYST_STAGE,
        status: response.status >= 500 ? 'retryable_error' : 'fatal_error',
        schema_version: IDEA_ANALYST_SCHEMA_VERSION,
        prompt_version: IDEA_ANALYST_PROMPT_VERSION,
        provider: 'openrouter',
        model,
        data: {} as ResearchData,
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

    // Strip markdown code fences or extract outer JSON braces
    let cleanContent = content.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    const firstBrace = cleanContent.indexOf('{');
    const lastBrace = cleanContent.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      cleanContent = cleanContent.slice(firstBrace, lastBrace + 1);
    }
    let parsedData: ResearchData;
    try {
      parsedData = JSON.parse(cleanContent) as ResearchData;
    } catch {
      const sanitized = cleanContent.replace(/"([^"\\]*(\\.[^"\\]*)*)"/g, (match: string) => {
        return match.replace(/\r?\n/g, '\\n').replace(/\t/g, '\\t');
      });
      parsedData = JSON.parse(sanitized) as ResearchData;
    }

    const validation = validateResearchOutput(parsedData);
    if (!validation.valid) {
      return {
        job_id: config.job_id,
        stage: IDEA_ANALYST_STAGE,
        status: 'retryable_error',
        schema_version: IDEA_ANALYST_SCHEMA_VERSION,
        prompt_version: IDEA_ANALYST_PROMPT_VERSION,
        provider: 'openrouter',
        model,
        data: parsedData,
        warnings: ['Model output failed strict research validation checks.'],
        errors: validation.errors,
        usage: {
          input_tokens: json.usage?.prompt_tokens ?? null,
          output_tokens: json.usage?.completion_tokens ?? null,
          estimated_cost_usd: 0.002,
          actual_cost_usd: 0,
        },
      };
    }

    return {
      job_id: config.job_id,
      stage: IDEA_ANALYST_STAGE,
      status: 'completed',
      schema_version: IDEA_ANALYST_SCHEMA_VERSION,
      prompt_version: IDEA_ANALYST_PROMPT_VERSION,
      provider: 'openrouter',
      model,
      data: parsedData,
      warnings: [],
      errors: [],
      usage: {
        input_tokens: json.usage?.prompt_tokens ?? null,
        output_tokens: json.usage?.completion_tokens ?? null,
        estimated_cost_usd: 0.002,
        actual_cost_usd: 0,
      },
    };
  } catch (error) {
    return {
      job_id: config.job_id,
      stage: IDEA_ANALYST_STAGE,
      status: 'retryable_error',
      schema_version: IDEA_ANALYST_SCHEMA_VERSION,
      prompt_version: IDEA_ANALYST_PROMPT_VERSION,
      provider: 'openrouter',
      model,
      data: {} as ResearchData,
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
