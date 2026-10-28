import type {
  JobConfig,
  ScriptData,
  VisualPlanData,
  Scene,
  SceneVisual,
  StageError,
  StageEnvelope,
  MotionType,
  MotionIntensity,
} from './types';

export const TIMING_LAYOUT_STAGE = 'timing_layout' as const;
export const TIMING_LAYOUT_SCHEMA_VERSION = '1.0' as const;
export const TIMING_LAYOUT_PROMPT_VERSION = '1.0' as const;

export const DEFAULT_PACING_WPM = 145;
export const MIN_SCENE_DURATION = 3;
export const MAX_SCENE_DURATION = 12;
export const HOOK_EXTRA_PERCENT = 0.10;
export const TRANSITION_SILENCE = 0.3;
export const OVERLAY_FADE = 0.5;
export const OVERLAY_READ_TIME_PER_WORD = 0.15;
export const MIN_OVERLAY_DURATION = 2;
export const TARGET_TOLERANCE = 2;

export type TransitionType = 'cut' | 'fade' | 'paper_reveal' | 'match_move';
// MotionType, MotionIntensity imported from types
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

// ─── Gate D: Validation ───

export function validateGateD(
  jobConfig: JobConfig,
  script: ScriptData,
  visualPlan: VisualPlanData,
): {
  valid: boolean;
  errors: StageError[];
} {
  const errors: StageError[] = [];

  if (!jobConfig.topic || typeof jobConfig.topic !== 'string' || jobConfig.topic.trim().length === 0) {
    errors.push({ code: 'MISSING_TOPIC', message: 'Timing & Layout requires a non-empty topic', retryable: false, field: 'topic' });
  }

  if (!script || typeof script !== 'object') {
    errors.push({ code: 'MISSING_SCRIPT', message: 'Timing & Layout requires validated script data', retryable: false });
    return { valid: false, errors };
  }

  if (!Array.isArray(script.scenes) || script.scenes.length === 0) {
    errors.push({ code: 'NO_SCENES', message: 'Script must contain at least one scene', retryable: false, field: 'script.scenes' });
    return { valid: false, errors };
  }

  if (!visualPlan || typeof visualPlan !== 'object') {
    errors.push({ code: 'MISSING_VISUAL_PLAN', message: 'Timing & Layout requires validated visual plan data', retryable: false });
    return { valid: false, errors };
  }

  if (!Array.isArray(visualPlan.scene_visuals) || visualPlan.scene_visuals.length === 0) {
    errors.push({ code: 'NO_VISUAL_SCENES', message: 'Visual plan must contain scene_visuals', retryable: false, field: 'visual_plan.scene_visuals' });
  }

  // Scene IDs must match between script and visual plan
  const scriptSceneIds = new Set(script.scenes.map((s) => s.scene_id));
  const visualSceneIds = new Set(visualPlan.scene_visuals.map((sv) => sv.scene_id));

  for (const id of Array.from(scriptSceneIds)) {
    if (!visualSceneIds.has(id)) {
      errors.push({ code: 'ORPHAN_SCRIPT_SCENE', message: `Script scene ${id} missing from visual plan`, retryable: false, field: `script.scenes.${id}` });
    }
  }

  for (const id of Array.from(visualSceneIds)) {
    if (!scriptSceneIds.has(id)) {
      errors.push({ code: 'ORPHAN_VISUAL_SCENE', message: `Visual scene ${id} not in script`, retryable: false, field: `visual_plan.scene_visuals.${id}` });
    }
  }

  if (!jobConfig.target_seconds || typeof jobConfig.target_seconds !== 'number' || jobConfig.target_seconds <= 0) {
    errors.push({ code: 'INVALID_TARGET_SECONDS', message: 'target_seconds must be a positive number', retryable: false, field: 'target_seconds' });
  }

  if (!Array.isArray(jobConfig.aspect_ratios) || jobConfig.aspect_ratios.length === 0) {
    errors.push({ code: 'NO_ASPECT_RATIOS', message: 'At least one aspect_ratio required', retryable: false, field: 'aspect_ratios' });
  }

  return { valid: errors.length === 0, errors };
}

// ─── Output Schema Validation ───

const ALLOWED_TRANSITIONS: TransitionType[] = ['cut', 'fade', 'paper_reveal', 'match_move'];
const ALLOWED_MOTIONS: MotionType[] = ['none', 'pan', 'zoom', 'parallax', 'reveal'];
const ALLOWED_INTENSITIES: MotionIntensity[] = ['low', 'medium'];
const ALLOWED_SAFE_ZONES: SafeZone[] = ['bottom_third', 'bottom_center', 'center'];
const DURATION_TOLERANCE = 0.01; // seconds

export function validateTimedPlanOutput(
  data: unknown,
  script?: ScriptData,
  visualPlan?: VisualPlanData,
): {
  valid: boolean;
  errors: StageError[];
  warnings: string[];
} {
  const errors: StageError[] = [];
  const warnings: string[] = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: [{ code: 'INVALID_TIMED_PLAN', message: 'Timed plan data must be an object', retryable: true }], warnings: [] };
  }

  const d = data as Partial<TimedPlanData>;

  if (typeof d.target_seconds !== 'number' || d.target_seconds <= 0) {
    errors.push({ code: 'MISSING_TARGET_SECONDS', message: 'timed_plan must have target_seconds', retryable: true, field: 'target_seconds' });
  }

  if (typeof d.planned_seconds !== 'number' || d.planned_seconds < 0) {
    errors.push({ code: 'MISSING_PLANNED_SECONDS', message: 'timed_plan must have planned_seconds', retryable: true, field: 'planned_seconds' });
  }

  if (typeof d.timeline_valid !== 'boolean') {
    errors.push({ code: 'MISSING_TIMELINE_VALID', message: 'timed_plan must have timeline_valid boolean', retryable: true, field: 'timeline_valid' });
  }

  if (!d.aspect_layouts || typeof d.aspect_layouts !== 'object' || Object.keys(d.aspect_layouts).length === 0) {
    errors.push({ code: 'MISSING_ASPECT_LAYOUTS', message: 'timed_plan must have aspect_layouts', retryable: true, field: 'aspect_layouts' });
  } else {
    for (const [ratio, layout] of Object.entries(d.aspect_layouts)) {
      if (typeof layout.width !== 'number' || layout.width <= 0) {
        errors.push({ code: 'INVALID_LAYOUT_WIDTH', message: `Layout ${ratio} width must be positive`, retryable: true, field: `aspect_layouts.${ratio}.width` });
      }
      if (typeof layout.height !== 'number' || layout.height <= 0) {
        errors.push({ code: 'INVALID_LAYOUT_HEIGHT', message: `Layout ${ratio} height must be positive`, retryable: true, field: `aspect_layouts.${ratio}.height` });
      }
      if (typeof layout.safe_margins_percent !== 'number' || layout.safe_margins_percent < 0 || layout.safe_margins_percent > 20) {
        errors.push({ code: 'INVALID_SAFE_MARGINS', message: `Layout ${ratio} safe_margins_percent must be 0-20`, retryable: true, field: `aspect_layouts.${ratio}.safe_margins_percent` });
      }
    }
  }

  if (!Array.isArray(d.scenes) || d.scenes.length === 0) {
    errors.push({ code: 'MISSING_TIMED_SCENES', message: 'timed_plan must contain scenes array', retryable: true, field: 'scenes' });
    return { valid: false, errors, warnings };
  }

  const scriptSceneIds = new Set(script?.scenes.map((s) => s.scene_id) || []);
  const visualSceneIds = new Set(visualPlan?.scene_visuals.map((sv) => sv.scene_id) || []);
  const timedSceneIds = new Set<string>();

  let prevEnd = 0;

  for (let i = 0; i < (d.scenes || []).length; i++) {
    const ts = d.scenes[i];

    if (!ts.scene_id) {
      errors.push({ code: 'MISSING_TIMED_SCENE_ID', message: `Scene at index ${i} missing scene_id`, retryable: true, field: `scenes[${i}].scene_id` });
    } else if (timedSceneIds.has(ts.scene_id)) {
      errors.push({ code: 'DUPLICATE_TIMED_SCENE_ID', message: `Duplicate scene_id: ${ts.scene_id}`, retryable: true, field: `scenes[${i}].scene_id` });
    } else {
      timedSceneIds.add(ts.scene_id);
    }

    // Traceability
    if (script && !scriptSceneIds.has(ts.scene_id)) {
      errors.push({ code: 'ORPHAN_TIMED_SCENE', message: `Timed scene ${ts.scene_id} not in script`, retryable: false, field: `scenes[${i}].scene_id` });
    }
    if (visualPlan && !visualSceneIds.has(ts.scene_id)) {
      errors.push({ code: 'ORPHAN_TIMED_SCENE', message: `Timed scene ${ts.scene_id} not in visual plan`, retryable: false, field: `scenes[${i}].scene_id` });
    }

    // Duration arithmetic
    if (typeof ts.start_seconds !== 'number' || ts.start_seconds < 0) {
      errors.push({ code: 'INVALID_START', message: `Scene ${ts.scene_id} start_seconds must be >= 0`, retryable: true, field: `scenes[${i}].start_seconds` });
    }
    if (typeof ts.end_seconds !== 'number' || ts.end_seconds <= 0) {
      errors.push({ code: 'INVALID_END', message: `Scene ${ts.scene_id} end_seconds must be > 0`, retryable: true, field: `scenes[${i}].end_seconds` });
    }
    if (typeof ts.duration_seconds !== 'number' || ts.duration_seconds <= 0) {
      errors.push({ code: 'INVALID_DURATION', message: `Scene ${ts.scene_id} duration_seconds must be > 0`, retryable: true, field: `scenes[${i}].duration_seconds` });
    } else {
      const calcDur = ts.end_seconds - ts.start_seconds;
      if (Math.abs(calcDur - ts.duration_seconds) > DURATION_TOLERANCE) {
        errors.push({ code: 'DURATION_MISMATCH', message: `Scene ${ts.scene_id} duration mismatch: end-start=${calcDur.toFixed(2)} vs duration=${ts.duration_seconds}`, retryable: true, field: `scenes[${i}].duration_seconds` });
      }
    }

    // Duration bounds
    if (ts.duration_seconds < MIN_SCENE_DURATION || ts.duration_seconds > MAX_SCENE_DURATION) {
      warnings.push(`Scene ${ts.scene_id} duration ${ts.duration_seconds}s outside recommended range [${MIN_SCENE_DURATION}, ${MAX_SCENE_DURATION}]`);
    }

    // Timing continuity (no gaps/overlaps)
    if (i > 0 && Math.abs(ts.start_seconds - prevEnd) > DURATION_TOLERANCE) {
      warnings.push(`Gap/overlap between scenes: prev end=${prevEnd.toFixed(2)}, curr start=${ts.start_seconds.toFixed(2)}`);
    }
    prevEnd = ts.end_seconds;

    // Asset target / narration target
    if (typeof ts.asset_target_seconds !== 'number' || ts.asset_target_seconds <= 0) {
      errors.push({ code: 'INVALID_ASSET_TARGET', message: `Scene ${ts.scene_id} asset_target_seconds must be > 0`, retryable: true, field: `scenes[${i}].asset_target_seconds` });
    }
    if (typeof ts.narration_target_seconds !== 'number' || ts.narration_target_seconds <= 0) {
      errors.push({ code: 'INVALID_NARRATION_TARGET', message: `Scene ${ts.scene_id} narration_target_seconds must be > 0`, retryable: true, field: `scenes[${i}].narration_target_seconds` });
    }

    if (ts.narration_target_seconds > ts.duration_seconds + DURATION_TOLERANCE) {
      errors.push({ code: 'NARRATION_EXCEEDS_DURATION', message: `Scene ${ts.scene_id} narration (${ts.narration_target_seconds}s) exceeds scene duration (${ts.duration_seconds}s)`, retryable: true, field: `scenes[${i}]` });
    }

    // Hold seconds
    if (typeof ts.hold_seconds !== 'number' || ts.hold_seconds < 0) {
      errors.push({ code: 'INVALID_HOLD', message: `Scene ${ts.scene_id} hold_seconds must be >= 0`, retryable: true, field: `scenes[${i}].hold_seconds` });
    }

    // Transitions
    if (!ALLOWED_TRANSITIONS.includes(ts.transition_in)) {
      errors.push({ code: 'INVALID_TRANSITION_IN', message: `Scene ${ts.scene_id} invalid transition_in: ${ts.transition_in}`, retryable: true, field: `scenes[${i}].transition_in` });
    }
    if (!ALLOWED_TRANSITIONS.includes(ts.transition_out)) {
      errors.push({ code: 'INVALID_TRANSITION_OUT', message: `Scene ${ts.scene_id} invalid transition_out: ${ts.transition_out}`, retryable: true, field: `scenes[${i}].transition_out` });
    }

    // Overlay
    if (!ts.overlay || typeof ts.overlay.text !== 'string' || ts.overlay.text.trim().length === 0) {
      errors.push({ code: 'MISSING_OVERLAY_TEXT', message: `Scene ${ts.scene_id} overlay text required`, retryable: true, field: `scenes[${i}].overlay.text` });
    }
    if (typeof ts.overlay.start_seconds !== 'number' || ts.overlay.start_seconds < 0) {
      errors.push({ code: 'INVALID_OVERLAY_START', message: `Scene ${ts.scene_id} overlay start_seconds >= 0`, retryable: true, field: `scenes[${i}].overlay.start_seconds` });
    }
    if (typeof ts.overlay.end_seconds !== 'number' || ts.overlay.end_seconds <= 0) {
      errors.push({ code: 'INVALID_OVERLAY_END', message: `Scene ${ts.scene_id} overlay end_seconds > 0`, retryable: true, field: `scenes[${i}].overlay.end_seconds` });
    }
    if (ts.overlay.end_seconds <= ts.overlay.start_seconds) {
      errors.push({ code: 'INVALID_OVERLAY_DURATION', message: `Scene ${ts.scene_id} overlay end must be after start`, retryable: true, field: `scenes[${i}].overlay` });
    }
    if (!ALLOWED_SAFE_ZONES.includes(ts.overlay.safe_zone)) {
      errors.push({ code: 'INVALID_SAFE_ZONE', message: `Scene ${ts.scene_id} invalid safe_zone: ${ts.overlay.safe_zone}`, retryable: true, field: `scenes[${i}].overlay.safe_zone` });
    }

    // Overlay must fit within scene
    if (ts.overlay.start_seconds < ts.start_seconds - DURATION_TOLERANCE) {
      warnings.push(`Scene ${ts.scene_id} overlay starts before scene`);
    }
    if (ts.overlay.end_seconds > ts.end_seconds + DURATION_TOLERANCE) {
      warnings.push(`Scene ${ts.scene_id} overlay ends after scene`);
    }

    // Overlay reading time check
    const overlayWords = ts.overlay.text.trim().split(/\s+/).filter(Boolean).length;
    const minOverlayDur = Math.max(MIN_OVERLAY_DURATION, overlayWords * OVERLAY_READ_TIME_PER_WORD);
    const overlayDur = ts.overlay.end_seconds - ts.overlay.start_seconds;
    if (overlayDur < minOverlayDur - DURATION_TOLERANCE) {
      warnings.push(`Scene ${ts.scene_id} overlay duration ${overlayDur.toFixed(1)}s may be too short for ${overlayWords} words (min ${minOverlayDur.toFixed(1)}s)`);
    }

    // Motion
    if (!ts.motion || !ALLOWED_MOTIONS.includes(ts.motion.type)) {
      errors.push({ code: 'INVALID_MOTION_TYPE', message: `Scene ${ts.scene_id} invalid motion type: ${ts.motion?.type}`, retryable: true, field: `scenes[${i}].motion.type` });
    }
    if (!ALLOWED_INTENSITIES.includes(ts.motion.intensity)) {
      errors.push({ code: 'INVALID_MOTION_INTENSITY', message: `Scene ${ts.scene_id} invalid intensity: ${ts.motion.intensity}`, retryable: true, field: `scenes[${i}].motion.intensity` });
    }
    if (!ts.motion.direction || typeof ts.motion.direction !== 'string' || ts.motion.direction.trim().length === 0) {
      errors.push({ code: 'MISSING_MOTION_DIRECTION', message: `Scene ${ts.scene_id} motion direction required`, retryable: true, field: `scenes[${i}].motion.direction` });
    }
  }

  // Total timeline check
  const effectiveTolerance = typeof d.target_seconds === 'number'
    ? Math.max(TARGET_TOLERANCE, d.target_seconds * 0.03)
    : TARGET_TOLERANCE;
  if (typeof d.planned_seconds === 'number' && typeof d.target_seconds === 'number') {
    const diff = Math.abs(d.planned_seconds - d.target_seconds);
    if (diff > effectiveTolerance) {
      warnings.push(`Total planned duration ${d.planned_seconds}s deviates from target ${d.target_seconds}s by ${diff}s (tolerance ${effectiveTolerance}s)`);
    }
  }

  if (!Array.isArray(d.validation_errors)) {
    errors.push({ code: 'MISSING_VALIDATION_ERRORS', message: 'timed_plan must have validation_errors array', retryable: true, field: 'validation_errors' });
  }
  if (!Array.isArray(d.warnings)) {
    errors.push({ code: 'MISSING_WARNINGS', message: 'timed_plan must have warnings array', retryable: true, field: 'warnings' });
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ─── Duration Calculation ───

export function calculateSceneDurations(
  script: ScriptData,
  visualPlan: VisualPlanData,
  targetSeconds: number,
  pacingWpm: number = DEFAULT_PACING_WPM,
): { durations: Map<string, number>; plannedTotal: number } {
  // Calculate narration duration per scene
  const sceneDurations = new Map<string, number>();
  const wordCounts = new Map<string, number>();

  for (const scene of script.scenes) {
    const wordCount = scene.word_count || scene.narration.trim().split(/\s+/).filter(Boolean).length;
    wordCounts.set(scene.scene_id, wordCount);
    const dur = (wordCount / pacingWpm) * 60;
    sceneDurations.set(scene.scene_id, dur);
  }

  // Clamp to bounds
  for (const [id, dur] of Array.from(sceneDurations.entries())) {
    sceneDurations.set(id, Math.max(MIN_SCENE_DURATION, Math.min(MAX_SCENE_DURATION, dur)));
  }

  // Hook bonus
  const hookScene = script.scenes.find((s) => s.narrative_function === 'hook');
  if (hookScene) {
    const current = sceneDurations.get(hookScene.scene_id) || MIN_SCENE_DURATION;
    sceneDurations.set(hookScene.scene_id, Math.min(MAX_SCENE_DURATION, current * (1 + HOOK_EXTRA_PERCENT)));
  }

  // Prorate to target
  const rawTotal = Array.from(sceneDurations.values()).reduce((a, b) => a + b, 0);
  if (rawTotal > 0) {
    const factor = targetSeconds / rawTotal;
    for (const [id, dur] of Array.from(sceneDurations.entries())) {
      const adjusted = dur * factor;
      sceneDurations.set(id, Math.max(MIN_SCENE_DURATION, Math.min(MAX_SCENE_DURATION, adjusted)));
    }

    // Iterative redistribution pass to spread any deficit or surplus to scenes with headroom
    for (let pass = 0; pass < 10; pass++) {
      const currentTotal = Array.from(sceneDurations.values()).reduce((a, b) => a + b, 0);
      const diff = targetSeconds - currentTotal;
      if (Math.abs(diff) <= 0.05) break;

      const adjustable = Array.from(sceneDurations.entries()).filter(
        ([, d]) => (diff > 0 ? d < MAX_SCENE_DURATION : d > MIN_SCENE_DURATION)
      );
      if (adjustable.length === 0) break;

      const delta = diff / adjustable.length;
      for (const [id, d] of adjustable) {
        const nextDur = Math.max(MIN_SCENE_DURATION, Math.min(MAX_SCENE_DURATION, d + delta));
        sceneDurations.set(id, Number(nextDur.toFixed(2)));
      }
    }
  }

  const plannedTotal = Number(Array.from(sceneDurations.values()).reduce((a, b) => a + b, 0).toFixed(2));
  return { durations: sceneDurations, plannedTotal };
}

// ─── Layout Calculations ───

function getAspectLayouts(aspectRatios: string[]): Record<string, AspectLayout> {
  const layouts: Record<string, AspectLayout> = {};
  for (const ratio of aspectRatios) {
    if (ratio === '16:9') {
      layouts[ratio] = { width: 1920, height: 1080, safe_margins_percent: 5 };
    } else if (ratio === '9:16') {
      layouts[ratio] = { width: 1080, height: 1920, safe_margins_percent: 5 };
    } else if (ratio === '4:3') {
      layouts[ratio] = { width: 1440, height: 1080, safe_margins_percent: 5 };
    } else if (ratio === '1:1') {
      layouts[ratio] = { width: 1080, height: 1080, safe_margins_percent: 5 };
    } else {
      layouts[ratio] = { width: 1920, height: 1080, safe_margins_percent: 5 };
    }
  }
  return layouts;
}

function selectTransition(_functionName: string, _isFirst: boolean, _isLast: boolean): TransitionType {
  // Client requirement: clean straight cuts between stop-motion scenes (no blackout fade)
  return 'cut';
}

function selectMotionDirection(visualType: string): { type: MotionType; direction: string; intensity: MotionIntensity } {
  switch (visualType) {
    case 'archival_collage': return { type: 'parallax', direction: 'slow pull back', intensity: 'low' };
    case 'photo': return { type: 'zoom', direction: 'slow zoom in', intensity: 'low' };
    case 'diagram': return { type: 'reveal', direction: 'left to right reveal', intensity: 'medium' };
    case 'chart': return { type: 'none', direction: 'static', intensity: 'low' };
    case 'map': return { type: 'pan', direction: 'slow pan right', intensity: 'low' };
    case 'timeline': return { type: 'reveal', direction: 'progressive reveal', intensity: 'low' };
    case 'illustration': return { type: 'parallax', direction: 'gentle parallax', intensity: 'low' };
    case 'motion_graphic': return { type: 'reveal', direction: 'animated build', intensity: 'medium' };
    default: return { type: 'none', direction: 'static', intensity: 'low' };
  }
}

function getSafeZone(visualType: string): SafeZone {
  if (['chart', 'diagram', 'timeline'].includes(visualType)) return 'bottom_center';
  return 'bottom_third';
}

// ─── Mock Generator ───

export function generateDeterministicMockTimedPlan(
  jobConfig: JobConfig,
  script: ScriptData,
  visualPlan: VisualPlanData,
): TimedPlanData {
  const pacingWpm = jobConfig.pacing_wpm || DEFAULT_PACING_WPM;
  const { durations, plannedTotal } = calculateSceneDurations(script, visualPlan, jobConfig.target_seconds, pacingWpm);

  const aspectLayouts = getAspectLayouts(jobConfig.aspect_ratios);
  const visualSceneMap = new Map(visualPlan.scene_visuals.map((sv) => [sv.scene_id, sv]));

  const scenes: TimedScene[] = [];
  let currentTime = 0;

  for (let i = 0; i < script.scenes.length; i++) {
    const scene = script.scenes[i];
    const visualScene = visualSceneMap.get(scene.scene_id);
    const duration = durations.get(scene.scene_id) || 5;
    const start = currentTime;
    const end = start + duration;

    const isFirst = i === 0;
    const isLast = i === script.scenes.length - 1;
    const transitionIn = isFirst ? 'cut' : selectTransition(scene.narrative_function, isFirst, false);
    const transitionOut = selectTransition(scene.narrative_function, false, isLast);

    const visualType = visualScene?.visual_type || 'archival_collage';
    const motion = selectMotionDirection(visualType);
    const safeZone = getSafeZone(visualType);
    const overlayText = visualScene?.overlay_text || '';

    // Overlay timing: fade in after 0.5s, hold for reading, fade out before end
    const overlayStart = Math.max(0.5, start + 0.5);
    const overlayEnd = Math.min(end - 0.5, end - OVERLAY_FADE);
    const words = overlayText.trim().split(/\s+/).filter(Boolean).length;
    const minOverlayDur = Math.max(MIN_OVERLAY_DURATION, words * OVERLAY_READ_TIME_PER_WORD);
    const overlayEndAdjusted = Math.min(overlayEnd, overlayStart + Math.max(overlayEnd - overlayStart, minOverlayDur));

    scenes.push({
      scene_id: scene.scene_id,
      start_seconds: Number(start.toFixed(2)),
      end_seconds: Number(end.toFixed(2)),
      duration_seconds: Number(duration.toFixed(2)),
      asset_target_seconds: Number(duration.toFixed(2)),
      narration_target_seconds: Number(((scene.word_count || scene.narration.split(/\s+/).filter(Boolean).length) / pacingWpm * 60).toFixed(2)),
      hold_seconds: Number(Math.max(0, duration - (scene.word_count || 15) / pacingWpm * 60 - TRANSITION_SILENCE).toFixed(2)),
      transition_in: isFirst ? 'cut' : transitionIn,
      transition_out: transitionOut,
      overlay: {
        text: overlayText,
        start_seconds: Number(overlayStart.toFixed(2)),
        end_seconds: Number(overlayEndAdjusted.toFixed(2)),
        safe_zone: getSafeZone(visualType),
      },
      motion: motion,
    });

    currentTime = end;
  }

  // Calculate total
  const totalPlanned = Number(scenes.reduce((sum, s) => sum + s.duration_seconds, 0).toFixed(2));
  const effectiveTolerance = Math.max(TARGET_TOLERANCE, jobConfig.target_seconds * 0.03);
  const timelineValid = Math.abs(totalPlanned - jobConfig.target_seconds) <= effectiveTolerance;

  return {
    target_seconds: jobConfig.target_seconds,
    planned_seconds: totalPlanned,
    timeline_valid: timelineValid,
    aspect_layouts: getAspectLayouts(jobConfig.aspect_ratios),
    scenes,
    validation_errors: [],
    warnings: timelineValid ? [] : [`Total duration ${totalPlanned.toFixed(1)}s deviates from target ${jobConfig.target_seconds}s by >${effectiveTolerance.toFixed(1)}s`],
  };
}

// ─── Runner ───

export async function runTimingLayout(
  jobConfig: JobConfig,
  script: ScriptData,
  visualPlan: VisualPlanData,
  options: { forceMock?: boolean } = {},
): Promise<TimedPlanEnvelope> {
  const gateD = validateGateD(jobConfig, script, visualPlan);
  if (!gateD.valid) {
    return {
      job_id: jobConfig.job_id || 'unknown',
      stage: TIMING_LAYOUT_STAGE,
      status: 'needs_review',
      schema_version: TIMING_LAYOUT_SCHEMA_VERSION,
      prompt_version: TIMING_LAYOUT_PROMPT_VERSION,
      provider: 'validation',
      model: 'none',
      data: {
        target_seconds: jobConfig.target_seconds,
        planned_seconds: 0,
        timeline_valid: false,
        aspect_layouts: getAspectLayouts(jobConfig.aspect_ratios),
        scenes: [],
        validation_errors: gateD.errors.map((e) => e.message),
        warnings: [],
      },
      warnings: ['Gate D validation failed.'],
      errors: gateD.errors,
      usage: { input_tokens: null, output_tokens: null, estimated_cost_usd: 0, actual_cost_usd: 0 },
    };
  }

  if (options.forceMock) {
    const data = generateDeterministicMockTimedPlan(jobConfig, script, visualPlan);
    const validation = validateTimedPlanOutput(data, script, visualPlan);

    return {
      job_id: jobConfig.job_id,
      stage: TIMING_LAYOUT_STAGE,
      status: 'completed',
      schema_version: TIMING_LAYOUT_SCHEMA_VERSION,
      prompt_version: TIMING_LAYOUT_PROMPT_VERSION,
      provider: 'deterministic',
      model: 'rule_based',
      data,
      warnings: validation.warnings,
      errors: [],
      usage: { input_tokens: 0, output_tokens: 0, estimated_cost_usd: 0, actual_cost_usd: 0 },
    };
  }

  // Rule-based only - no LLM
  const data = generateDeterministicMockTimedPlan(jobConfig, script, visualPlan);
  const validation = validateTimedPlanOutput(data, script, visualPlan);

  return {
    job_id: jobConfig.job_id,
    stage: TIMING_LAYOUT_STAGE,
    status: 'completed',
    schema_version: TIMING_LAYOUT_SCHEMA_VERSION,
    prompt_version: TIMING_LAYOUT_PROMPT_VERSION,
    provider: 'deterministic',
    model: 'rule_based',
    data,
    warnings: validation.warnings,
    errors: [],
    usage: { input_tokens: 0, output_tokens: 0, estimated_cost_usd: 0, actual_cost_usd: 0 },
  };
}