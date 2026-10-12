export type StageStatus =
  | 'completed'
  | 'needs_input'
  | 'needs_review'
  | 'blocked'
  | 'retryable_error'
  | 'fatal_error';

export interface StageError {
  code: string;
  message: string;
  retryable: boolean;
  field?: string;
  details?: unknown[];
}

export interface StageUsage {
  input_tokens: number | null;
  output_tokens: number | null;
  estimated_cost_usd: number | null;
  actual_cost_usd: number | null;
}

export interface StageEnvelope<T> {
  job_id: string;
  stage: string;
  status: StageStatus;
  schema_version: string;
  prompt_version: string;
  provider: string;
  model: string;
  data: T;
  warnings: string[];
  errors: StageError[];
  usage: StageUsage;
}

export interface JobConfig {
  job_id: string;
  topic: string;
  target_seconds: number;
  aspect_ratios: string[];
  language: string;
  audience: string;
  tone: string;
  visual_preset: string;
  voice: {
    provider: string;
    voice_id: string;
    language?: string;
    stability?: number;
    similarity?: number;
  };
  music: {
    enabled: boolean;
    track_id?: string;
  };
  budget_limit_usd: number;
  approval_mode: string;
  provider_config_version: string;
  prompt_version: string;
  depth?: 'shallow' | 'medium' | 'deep';
  user_sources?: Array<{
    title?: string;
    url?: string;
    text?: string;
  }>;
  seed?: number;
}

export interface Angle {
  angle_id: string;
  title: string;
  central_question: string;
  summary: string;
  strengths: string[];
  evidence_gaps: string[];
}

export interface Hook {
  text: string;
  type: 'question' | 'surprising_fact' | 'contradiction' | 'story';
  fact_dependent: boolean;
  supporting_claim_ids: string[];
}

export interface Claim {
  claim_id: string;
  claim: string;
  claim_type: 'fact' | 'inference' | 'opinion' | 'uncertain';
  support_status:
    | 'supported'
    | 'partially_supported'
    | 'unsupported'
    | 'conflicting'
    | 'source_unavailable';
  source_ids: string[];
  evidence_summary: string;
  caveat: string | null;
}

export interface SourceRecord {
  source_id: string;
  title: string;
  publisher: string;
  url: string;
  published_at: string | null;
  retrieved_at: string | null;
  source_type: 'primary' | 'secondary' | 'reference' | 'user_provided';
  relevant_excerpt_or_summary: string;
}

export interface ResearchData {
  angles: Angle[];
  recommended_angle_id: string;
  hooks: Hook[];
  claims: Claim[];
  sources: SourceRecord[];
  research_gaps: string[];
  sensitivity_flags: string[];
  recommended_narrative: string;
}

export type ResearchEnvelope = StageEnvelope<ResearchData>;

export type NarrativeFunction =
  | 'hook'
  | 'context'
  | 'explanation'
  | 'evidence'
  | 'transition'
  | 'payoff';

export interface Scene {
  scene_id: string;
  narration: string;
  narrative_function: NarrativeFunction;
  claim_ids: string[];
  on_screen_text_suggestion: string;
  visual_concept: string;
  pronunciation_notes?: string[];
  sensitivity_flags?: string[];
  estimated_seconds?: number;
  word_count?: number;
}

export interface ScriptData {
  title: string;
  logline: string;
  central_thesis: string;
  estimated_word_count: number;
  target_word_count: number;
  estimated_duration_seconds: number;
  runtime_deviation_seconds: number;
  script: string;
  scenes: Scene[];
  unresolved_claims: string[];
  editorial_notes: string[];
}

export type ScriptEnvelope = StageEnvelope<ScriptData>;
