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
  pacing_wpm?: number;
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

// ─── Agent 3: Visual Ideator types ───

export type VisualType =
  | 'archival_collage'
  | 'map'
  | 'timeline'
  | 'diagram'
  | 'chart'
  | 'illustration'
  | 'photo'
  | 'motion_graphic';

export type MotionType = 'none' | 'pan' | 'zoom' | 'parallax' | 'reveal';
export type TransitionType = 'cut' | 'fade' | 'paper_reveal' | 'match_move';
export type AssetRightsRequirement =
  | 'generated'
  | 'licensed'
  | 'user_provided'
  | 'verified_public_domain';

export type MotionIntensity = 'low' | 'medium';

export interface Composition {
  background: string;
  focal_subject: string;
  supporting_elements: string[];
  foreground_layers: string[];
  negative_space: string;
}

export interface SceneVisual {
  scene_id: string;
  narrative_purpose: string;
  visual_type: VisualType;
  factual_anchor_claim_ids: string[];
  composition: Composition;
  image_prompt: string;
  video_motion_prompt: string;
  overlay_text: string;
  motion_direction: MotionType;
  transition_intent: string;
  fallback_visual: string;
  asset_rights_requirement: AssetRightsRequirement;
  continuity_tags: string[];
}

export interface GlobalArtDirection {
  palette: string[];
  texture: string;
  typography_direction: string;
  continuity_rules: string[];
  avoid: string[];
}

export interface VisualPlanData {
  style_preset: string;
  global_art_direction: GlobalArtDirection;
  scene_visuals: SceneVisual[];
  global_exclusions: string[];
  review_flags: string[];
}

export type VisualPlanEnvelope = StageEnvelope<VisualPlanData>;

// ─── Agent 4: Timing & Layout types ───

// TransitionType, MotionType, MotionIntensity imported from Agent 3 section above
export type SafeZone = 'bottom_third' | 'bottom_center' | 'center';

export interface AspectLayout {
  width: number;
  height: number;
  safe_margins_percent: number;
}

export interface OverlaySpec {
  text: string;
  start_seconds: number;
  end_seconds: number;
  safe_zone: SafeZone;
}

export interface MotionSpec {
  type: MotionType;
  direction: string;
  intensity: MotionIntensity;
}

export interface TimedScene {
  scene_id: string;
  start_seconds: number;
  end_seconds: number;
  duration_seconds: number;
  asset_target_seconds: number;
  narration_target_seconds: number;
  hold_seconds: number;
  transition_in: TransitionType;
  transition_out: TransitionType;
  overlay: OverlaySpec;
  motion: MotionSpec;
}

export interface TimedPlanData {
  target_seconds: number;
  planned_seconds: number;
  timeline_valid: boolean;
  aspect_layouts: Record<string, AspectLayout>;
  scenes: TimedScene[];
  validation_errors: string[];
  warnings: string[];
}

export type TimedPlanEnvelope = StageEnvelope<TimedPlanData>;

// ─── Agent 5: Video Generator types ───

export type VideoAssetStatus = 'generated' | 'failed' | 'fallback_ken_burns';

export interface VideoAssetScene {
  scene_id: string;
  image_url: string;
  video_url: string;
  duration_s: number;
  seed: number;
  generation_cost_usd: number;
  status: VideoAssetStatus;
}

export interface VideoAssetsData {
  style_preset: string;
  scenes: VideoAssetScene[];
  total_estimated_cost_usd: number;
  total_actual_cost_usd: number;
  failed_scene_ids: string[];
  warnings: string[];
}

export type VideoAssetsEnvelope = StageEnvelope<VideoAssetsData>;
