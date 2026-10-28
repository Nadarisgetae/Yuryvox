import type {
  JobConfig,
  ScriptData,
  VisualPlanData,
  VisualPlanEnvelope,
  SceneVisual,
  GlobalArtDirection,
  Composition,
  VisualType,
  MotionType,
  StageError,
  Claim,
  SourceRecord,
} from './types';
import { getOpenRouterKey } from '@/lib/providers/openrouter';

export const VISUAL_IDEATOR_STAGE = 'visual_ideator' as const;
export const VISUAL_IDEATOR_SCHEMA_VERSION = '1.0' as const;
export const VISUAL_IDEATOR_PROMPT_VERSION = '1.0' as const;
export const DEFAULT_VISUAL_IDEATOR_MODEL = 'google/gemini-2.5-flash' as const;

export const COLLAGE_STYLE_BLOCK =
  'hand-cut documentary paper collage on aged newsprint and archival map surfaces, black and white halftone photograph cutouts with rough scissor-cut edges and offset accent strokes, torn paper edges, masking tape fragments, typewriter caption strips, rubber stamp marks, red string and brass pins where the story calls for connections, desaturated archival palette of tan, ink black, and halftone gray with ONE hot red signal accent and a restrained mustard yellow secondary, visible print grain and paper fiber, matte, flat even documentary lighting with soft cutout drop shadows.';

export const COLLAGE_PROMPT_CLOSER =
  'Every element must appear physically hand-cut and layered from real paper, with visible cutout edges, halftone print texture, and soft shadow separation between layers. The composition stays clean, minimal, and editorial with generous negative space. NOT digital illustration, NOT cartoon, NOT 3D render, NOT glossy, no gradients, no clutter, no watermark, no logos, no text beyond the specified label. Premium documentary collage aesthetic, 16:9, ultra-detailed, 8K.';

const ARCHIVAL_COLLAGE_PALETTE = ['warm ivory', 'cream', 'faded beige', 'charcoal', 'muted ochre', 'selective red'];
const ARCHIVAL_COLLAGE_TEXTURE = 'aged paper and restrained archival wear';

const ALLOWED_VISUAL_TYPES: Record<string, string> = {
  archival_collage: 'tactile paper textures, documents, stamps, tape, annotations on aged paper',
  map: 'archival map with muted colors, faded ink, paper texture, selective red highlights',
  timeline: 'horizontal timeline with dated markers on aged paper, tactile paper elements',
  diagram: 'clean diagram on warm ivory background, hand-drawn style, charcoal lines',
  chart: 'archival chart with tactile paper, muted colors, clear data visualization',
  illustration: 'flat vector illustration matching Vox archival collage style, warm palette',
  photo: 'archival photograph with paper texture overlay, warm ivory tone',
  motion_graphic: 'clean motion graphic element, compositor-rendered typography, high contrast',
};

const ALLOWED_MOTIONS = ['none', 'pan', 'zoom', 'parallax', 'reveal'];

// Archival element pool for deterministic variation
const ARCHIVAL_ELEMENTS = [
  'aged paper documents with subtle wear',
  'hand-drawn schematic on tracing paper',
  'vintage photographs with sepia tone',
  'paper cut-outs with tape edges',
  'typed memorandum on onion skin paper',
  'handwritten marginalia and annotations',
  'vintage ledger pages with columnar entries',
  'stamped official forms with paper texture',
  'folded maps with crease shadows and selective red highlights',
  'paper tabs, binder clips, and tactile paper elements',
];

export function validateGateC(
  jobConfig: JobConfig,
  script: ScriptData,
): {
  valid: boolean;
  errors: StageError[];
} {
  const errors: StageError[] = [];

  if (!jobConfig.topic || typeof jobConfig.topic !== 'string' || jobConfig.topic.trim().length === 0) {
    errors.push({
      code: 'MISSING_TOPIC',
      message: 'Visual Ideator requires a non-empty topic',
      retryable: false,
      field: 'topic',
    });
  }

  if (!script || typeof script !== 'object') {
    errors.push({
      code: 'MISSING_SCRIPT',
      message: 'Visual Ideator requires validated script data',
      retryable: false,
    });
    return { valid: false, errors };
  }

  if (!Array.isArray(script.scenes) || script.scenes.length === 0) {
    errors.push({
      code: 'NO_SCENES',
      message: 'Script must contain at least one scene for visual planning',
      retryable: false,
      field: 'script.scenes',
    });
  }

  if (script.scenes) {
    for (const scene of script.scenes) {
      if (!scene.scene_id) {
        errors.push({
          code: 'MISSING_SCENE_ID',
          message: 'Every scene must have a scene_id',
          retryable: false,
          field: 'script.scenes[].scene_id',
        });
      }
    }
  }

  if (!jobConfig.visual_preset || typeof jobConfig.visual_preset !== 'string') {
    errors.push({
      code: 'MISSING_VISUAL_PRESET',
      message: 'Visual Ideator requires a visual_preset in job config',
      retryable: false,
      field: 'visual_preset',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function buildGlobalArtDirection(preset: string): GlobalArtDirection {
  return {
    palette: ARCHIVAL_COLLAGE_PALETTE,
    texture: ARCHIVAL_COLLAGE_TEXTURE,
    typography_direction: 'high-contrast, clean, compositor-rendered',
    continuity_rules: [
      'Maintain consistent paper texture across all archival collage scenes',
      'Use selective red accents sparingly for emphasis only',
      'Keep warm ivory/cream backgrounds consistent',
      'Apply uniform drop shadow depth across all layers',
    ],
    avoid: [
      'generic stock photography',
      'clip-art style illustrations',
      'bright neon colors',
      'exact imitation of living artists',
      'essential typography baked into image generation',
    ],
  };
}

function selectVisualType(narrativeFunction: string): VisualType {
  switch (narrativeFunction) {
    case 'hook':
      return 'archival_collage';
    case 'context':
      return 'photo';
    case 'explanation':
      return 'diagram';
    case 'evidence':
      return Math.random() > 0.5 ? 'chart' : 'diagram';
    case 'transition':
      return 'motion_graphic';
    case 'payoff':
      return 'archival_collage';
    default:
      return 'archival_collage';
  }
}

function deterministicChoice(index: number, arr: string[]): string {
  return arr[Math.abs(index) % arr.length];
}

function truncatePrompt(text: string, maxLen: number = 500): string {
  if (text.length <= maxLen) return text;
  return text.substring(0, maxLen - 3) + '...';
}

function truncateOverlay(text: string): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 4) return words.join(' ');
  return words.slice(0, 4).join(' ');
}

function selectMotionDirection(visualType: VisualType): MotionType {
  switch (visualType) {
    case 'archival_collage':
      return 'parallax';
    case 'map':
      return 'pan';
    case 'timeline':
      return 'reveal';
    case 'diagram':
      return 'zoom';
    case 'chart':
      return 'none';
    case 'illustration':
      return 'parallax';
    case 'photo':
      return 'zoom';
    case 'motion_graphic':
      return 'pan';
    default:
      return 'none';
  }
}

export function validateVisualPlanOutput(
  data: unknown,
  script?: ScriptData,
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
      errors: [{ code: 'INVALID_VISUAL_PLAN', message: 'Visual plan data must be an object', retryable: true }],
      warnings: [],
    };
  }

  const d = data as Partial<VisualPlanData>;

  if (!d.style_preset || typeof d.style_preset !== 'string') {
    errors.push({ code: 'MISSING_STYLE_PRESET', message: 'visual_plan must have style_preset', retryable: true, field: 'style_preset' });
  }

  if (!d.global_art_direction || !Array.isArray(d.global_art_direction.palette) || d.global_art_direction.palette.length === 0) {
    errors.push({ code: 'MISSING_ART_DIRECTION', message: 'global_art_direction with palette required', retryable: true, field: 'global_art_direction' });
  }

  if (!Array.isArray(d.scene_visuals) || d.scene_visuals.length === 0) {
    errors.push({ code: 'MISSING_SCENE_VISUALS', message: 'visual_plan must contain scene_visuals', retryable: true, field: 'scene_visuals' });
    return { valid: false, errors, warnings };
  }

  const sceneIds = new Set(
    script?.scenes.map((s) => s.scene_id) || d.scene_visuals.map((sv) => sv.scene_id)
  );

  for (const sv of d.scene_visuals) {
    if (!sv.scene_id) {
      errors.push({ code: 'MISSING_SCENE_ID', message: 'Every scene_visual must have scene_id', retryable: true, field: 'scene_visuals[].scene_id' });
    }

    if (!sv.image_prompt || sv.image_prompt.length < 20) {
      errors.push({ code: 'PROMPT_TOO_SHORT', message: `Scene ${sv.scene_id} image_prompt too short`, retryable: true, field: `scene_visuals.${sv.scene_id}.image_prompt` });
    }

    if (!ALLOWED_VISUAL_TYPES[sv.visual_type as string]) {
      errors.push({ code: 'INVALID_VISUAL_TYPE', message: `Invalid visual_type: ${sv.visual_type}`, retryable: true, field: `scene_visuals.${sv.scene_id}.visual_type` });
    }

    if (sv.motion_direction && !ALLOWED_MOTIONS.includes(sv.motion_direction)) {
      errors.push({ code: 'INVALID_MOTION_TYPE', message: `Invalid motion_direction: ${sv.motion_direction}`, retryable: true, field: `scene_visuals.${sv.scene_id}.motion_direction` });
    }

    if (sv.overlay_text && countWords(sv.overlay_text) > 6) {
      warnings.push(`Scene ${sv.scene_id} overlay text has ${countWords(sv.overlay_text)} words (recommended: max 4).`);
    }

    if (sv.image_prompt && sv.image_prompt.length > 1000) {
      warnings.push(`Scene ${sv.scene_id} image_prompt exceeds 1000 chars (${sv.image_prompt.length}).`);
    }

    if (script && !sceneIds.has(sv.scene_id)) {
      errors.push({ code: 'ORPHAN_SCENE_VISUAL', message: `Scene visual ${sv.scene_id} not in script scenes`, retryable: false, field: `scene_visuals.${sv.scene_id}` });
    }

    if (sv.factual_anchor_claim_ids && sv.factual_anchor_claim_ids.length === 0) {
      warnings.push(`Scene ${sv.scene_id} has no factual anchor claim IDs — ensure purely illustrative or add claims.`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

function countWords(text: string): number {
  if (!text || typeof text !== 'string') return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function buildVisualIdeatorPrompt(
  jobConfig: JobConfig,
  script: ScriptData,
): {
  systemPrompt: string;
  userPrompt: string;
} {
  const systemPrompt = `You are an elite art director and paper collage engineer for a premium Vox-style archival-collage documentary.
Follow these non-negotiable rules:
1. Return ONLY a valid JSON object matching the requested schema. No markdown formatting, no code fences, no commentary.
2. Match the archival_collage_explainer visual preset: authentic macro photograph of physical handmade paper cutouts on aged cream paper, fold creases, black-and-white halftone newsprint clippings, crinkled semi-translucent masking tape strips, weathered ink rubber stamps, red wax crayon circles, brass pushpins with red twine, faint coffee cup ring stains, and physical paper relief with soft cast drop shadows underneath.
3. 70/30 HERO COMPOSITION RULE (CRITICAL):
   - Every scene must feature ONE dominant hero element at about 70% of visual weight (e.g. an archival object, historical b&w cutout, contour map fragment, or technical schematic).
   - At most 2 to 3 supporting tactile elements (e.g. masking tape, brass pin with red twine, or rubber stamp).
   - Generous negative space around all elements. Never illustrate every single word; visualize the core idea behind the words.
4. RECURRING SUBJECT LAW & BLACK CENSOR BAR:
   - If a person, object, vehicle, or location recurs across multiple scenes, describe it with IDENTICAL wording every single time it appears so the video reads as one unified documentary film.
   - For real historical figures: always specify a black censor bar across the eyes in high-contrast b&w halftone print cutout style to preserve investigative documentary realism and prevent AI facial artifacts.
5. ANTI-SPELLING-MISTAKES & PURE VISUAL STORYTELLING:
   - AI diffusion models frequently generate garbled letters, misspelled words, and pseudo-lettering slop when asked to draw text.
   - ALWAYS USE LESS WORDS AND MORE PHYSICAL IMAGES. Visual storytelling must be 100% visual: use iconic archival b&w photographic cutouts, tangible paper silhouette shapes, geographic map landmasses, technical schematics with abstract hatch marks, blank aged ledger textures, and physical artifacts.
   - NEVER request readable headlines, long quotes, document sentences, or text labels inside image_prompt.
   - If a numeral is indispensable, limit strictly to a clean 4-digit year (e.g. '1941'). All titles, statistics, and captions will be added by the downstream compositor, never baked into the generated image.
6. DETAILED PROMPT CRAFTSMANSHIP & MODEL LIMITS:
   - For image_prompt: Write dense, sensory macro documentary studio photography prompts (100mm macro lens, f/4 aperture, sharp paper fiber edges, 45-degree soft diffused tabletop lighting, natural drop shadows). Keep length strictly between 350 and 700 characters (never exceed 800 characters) to prevent Flux Schnell token truncation.
   - For video_motion_prompt: Follow the stop-motion paper assembly formula: locked camera (no zoom, pan, tilt, shake, cuts, or transitions). 0 to 65% duration paper pieces slide or drop into place one at a time with subtle bounce and soft shadows, tape presses down, stamps slap on, red string connects pins last (choppy 12fps stop-motion feel). Remaining duration holds finished frame matching image exactly. Keep length strictly between 350 and 600 characters for Kling v1.6.
7. Never fabricate evidence documents, fake labels, or unsupported historical details.
8. Provide fallback visuals for failed clip generation (Ken Burns on keyframe).
9. Maintain visual continuity across scenes while varying treatment when a different format explains the idea more clearly.

Output JSON Schema:
${JSON.stringify({
    style_preset: 'archival_collage_explainer',
    global_art_direction: {
      palette: ['warm ivory', 'cream', 'faded beige', 'charcoal', 'muted ochre', 'selective red'],
      texture: 'string',
      typography_direction: 'string',
      continuity_rules: [],
      avoid: [],
    },
    scene_visuals: [
      {
        scene_id: 'SC01',
        narrative_purpose: 'string',
        visual_type: 'archival_collage|map|timeline|diagram|chart|illustration|photo|motion_graphic',
        factual_anchor_claim_ids: [],
        composition: {
          background: 'string',
          focal_subject: 'string',
          supporting_elements: [],
          foreground_layers: [],
          negative_space: 'string',
        },
        image_prompt: 'string',
        video_motion_prompt: 'string',
        overlay_text: 'Max 4 words',
        motion_direction: 'none|pan|zoom|parallax|reveal',
        transition_intent: 'string',
        fallback_visual: 'string',
        asset_rights_requirement: 'generated|licensed|user_provided|verified_public_domain',
        continuity_tags: [],
      },
    ],
    global_exclusions: [],
    review_flags: [],
  }, null, 2)}`;

  const userPrompt = `Topic: "${jobConfig.topic}"
Visual Style: ${jobConfig.visual_preset}
Audience: ${jobConfig.audience}
Tone: ${jobConfig.tone}

Approved Script:
${JSON.stringify(script, null, 2)}

For each scene, produce the visual plan JSON including: narrative purpose, visual type, composition, image prompt, motion prompt, overlay text, transition intent, fallback visual, and rights requirements.`;

  return { systemPrompt, userPrompt };
}

function buildComposition(scene: {
  narrative_function: string;
  narration: string;
  visual_concept?: string;
  on_screen_text_suggestion: string;
  claim_ids: string[];
}, topic: string, visualType: VisualType, index: number): Composition {
  const typeDesc = ALLOWED_VISUAL_TYPES[visualType as string] || 'archival collage elements';
  const archivalElement = deterministicChoice(index, ARCHIVAL_ELEMENTS);

  return {
    background: `Warm ivory/cream aged paper background, tactile kraft paper with fold creases. ${typeDesc}.`,
    focal_subject: scene.visual_concept || `Key archival element: ${archivalElement} illustrating ${topic}.`,
    supporting_elements: [
      `Contextual archival materials: ${archivalElement} with black-and-white halftone print`,
      'Strips of crinkled semi-transparent masking tape and rubber ink stamps',
      'Red wax crayon circle and red twine pinned between brass pushpins',
      'Layered physical paper elements with natural drop shadow depth',
    ],
    foreground_layers: [
      'Top-layer torn paper cutouts with soft cast drop shadows',
      'Adhesive tape strip and dried coffee ring mark',
    ],
    negative_space: 'Natural paper border with 5% safe margins, uncluttered tactile craft arrangement.',
  };
}

function buildImagePrompt(scene: {
  narrative_function: string;
  narration: string;
  visual_concept?: string;
  on_screen_text_suggestion: string;
  claim_ids: string[];
}, topic: string, visualType: VisualType, artDir: GlobalArtDirection, index: number): string {
  const archivalElement = deterministicChoice(index, ARCHIVAL_ELEMENTS);
  let subject = scene.visual_concept;
  if (!subject) {
    const cleaned = scene.narration.replace(/[^\w\s-]/g, '').trim().split(/\s+/).slice(0, 8).join(' ');
    subject = cleaned ? `archival visual artifact of ${cleaned}` : `historical artifact representing ${topic}`;
  }

  return truncatePrompt(
    `Macro documentary studio photograph of a physical handmade stop-motion paper collage on aged cream kraft paper with subtle fold creases. ` +
    `Focal hero element (70% visual weight): ${subject}, rendered as a hand-torn black-and-white halftone photograph cutout with rough scissor-cut edges and ${archivalElement}. ` +
    `Supporting tactile elements: strips of crinkled semi-transparent masking tape, weathered red rubber date stamps, red wax crayon highlight circle, brass pins with red cotton string, dried coffee mug ring mark. ` +
    `Physical paper relief with soft natural drop shadows underneath each elevated layer, visible torn deckle edges with white paper fibers. ` +
    `Overhead 45-degree diffused tabletop lighting, generous negative space. Pure visual imagery only, zero legible words, no text lettering, no fake headlines, no misspelled alphabets. ` +
    `NOT digital illustration, NOT 3D render, no glossy gradients. Premium documentary collage aesthetic, 16:9, ultra-detailed.`,
    800
  );
}

export function generateThumbnailPrompts(
  jobConfig: JobConfig,
  script: ScriptData,
): string[] {
  const topic = jobConfig.topic || 'Documentary Investigation';
  const hookWords = script.scenes[0]?.on_screen_text_suggestion || 'THE TRUTH';
  const cleanHook = hookWords.toUpperCase().slice(0, 20);

  return [
    truncatePrompt(
      `Dominant hero cutout (70% visual weight): High-contrast black and white halftone photograph cutout of key subject from "${topic}" with rough scissor-cut edges and hot red offset accent stroke, black censor bar across the eyes, set on aged torn newsprint that bleeds off the frame. ` +
      `Huge condensed bold all-caps headline on a hot red highlight bar: "${cleanHook}". Second smaller weathered stamp-box label: "CLASSIFIED". ` +
      `One rough red wax marker circle around the hero element. Desaturated tan and carbon ink palette with hot signal red accents, extreme poster-scale contrast, built for mobile readability at 200 pixels. ` +
      `Every element physically hand-cut from paper with soft shadow separation. NOT digital illustration, NOT 3D render, no logos, 16:9, 8K.`,
      800
    ),
    truncatePrompt(
      `Dominant hero cutout (70% visual weight): Macro archival folding map with bold red boundary lines and b&w halftone photographic evidence cutout illustrating "${topic}", rough scissor-cut edges, set on scorched aged ledger paper bleeding off frame. ` +
      `Huge condensed bold headline on a mustard yellow highlight bar: "EXPOSED". Second stamp-box label: "RESTRICTED". ` +
      `Red cotton twine connecting two brass pushpins across the evidence. High contrast, desaturated archival tan and ink black with hot red accents, poster-scale impact built to read at 200 pixels wide. ` +
      `Physical paper collage relief with real drop shadows. NOT digital illustration, NOT cartoon, 16:9, ultra-detailed.`,
      800
    ),
    truncatePrompt(
      `Dominant hero cutout (70% visual weight): Black and white halftone photograph cutout of primary artifact from "${topic}" with black censor bar and rough deckle torn edges, resting on aged newsprint with coffee ring stains. ` +
      `Huge condensed bold torn-label headline in carbon black on aged cream: "VANISHED". Second red rubber stamp mark: "UNSOLVED". ` +
      `A single bold red wax crayon arrow pointing directly at the central artifact. Maximum contrast, minimal negative space, extreme mobile thumbnail readability. ` +
      `Hand-cut layered paper collage aesthetic with tangible depth and soft drop shadows. NOT 3D render, NOT glossy, 16:9, 8K.`,
      800
    ),
  ];
}

function buildVideoMotionPrompt(scene: {
  narrative_function: string;
  narration: string;
}, motionDirection: MotionType, topic: string): string {
  return (
    `Animate the provided image as a 6-second stop-motion paper collage clip. The provided image is the final frame. ` +
    `Keep every element exactly as shown. Do not add, remove, redesign, resize, or move anything from its final position. ` +
    `Camera: completely locked. No zoom, pan, tilt, shake, cuts, or transitions. ` +
    `0 to 4 seconds: start on bare background paper surface only. Then the paper pieces slide or drop into place one at a time, ` +
    `back to front, with hero element first. Each piece lands with a small paper bounce and soft shadow. ` +
    `Tape presses down, stamps slap on, and red string draws from pin to pin last. Use a choppy, hand-made 12fps stop-motion feel, not smooth CGI motion. ` +
    `4 to 6 seconds: hold the finished frame, matching the provided image exactly. Only slight life remains: ` +
    `a paper corner lifts a millimeter and the shadows breathe. Nothing moves position.`
  );
}

function buildFallbackVisual(visualType: VisualType): string {
  return `Ken Burns pan/zoom on static ${visualType} image with warm ivory background and paper texture overlay. ` +
    `If video generation fails, compositor applies gentle zoom to the keyframe with fade transition.`;
}

function buildOverlayText(scene: {
  on_screen_text_suggestion: string;
  narrative_function: string;
}): string {
  let overlay = truncateOverlay(scene.on_screen_text_suggestion);
  if (!overlay) {
    const defaults: Record<string, string> = {
      hook: 'The Hidden Truth',
      context: 'The Setup',
      explanation: 'How It Works',
      evidence: 'The Evidence',
      transition: 'Shifting Gears',
      payoff: 'Key Takeaway',
    };
    overlay = defaults[scene.narrative_function] || 'Archival Detail';
  }
  return overlay;
}

function buildGlobalExclusions(): string[] {
  return [
    'No unverified historical document reproductions',
    'No fake labels, dates, or quotes in visual elements',
    'No legible text, fake headlines, or words rendered in generated images (compositor adds all typography)',
    'No AI-slop pseudo-lettering, misspelled labels, or garbled alphabets',
    'No exact imitation of living artists',
    'No corporate logos without licensing',
    'No essential data or statistics in generated images (render via compositor)',
  ];
}

function buildReviewFlags(scriptScenes: ScriptData['scenes'], claims: Claim[]): string[] {
  const flags: string[] = [];

  for (const scene of scriptScenes) {
    for (const cid of scene.claim_ids) {
      const claim = claims.find((c) => c.claim_id === cid);
      if (claim && claim.support_status !== 'supported') {
        flags.push(
          `Scene ${scene.scene_id} references claim ${cid} with support_status "${claim.support_status}". Mark as illustrative or verify before publishing.`
        );
      }
    }
  }

  const scenesWithoutClaims = scriptScenes.filter((s) => s.claim_ids.length === 0);
  if (scenesWithoutClaims.length > 0) {
    flags.push(
      `${scenesWithoutClaims.length} scene(s) lack explicit claim references — verify factual content is illustrative.`
    );
  }

  return flags.slice(0, 5);
}

export function generateDeterministicMockVisualPlan(
  jobConfig: JobConfig,
  script: ScriptData,
): VisualPlanData {
  const artDir = buildGlobalArtDirection(jobConfig.visual_preset);
  const claims: Claim[] = [];

  const sceneVisuals: SceneVisual[] = script.scenes.map((scene, index): SceneVisual => {
    const visualType = selectVisualType(scene.narrative_function);
    const motionDirection = selectMotionDirection(visualType);
    const composition = buildComposition(scene, jobConfig.topic, visualType, index);
    const imagePrompt = buildImagePrompt(scene, jobConfig.topic, visualType, artDir, index);
    const videoMotionPrompt = buildVideoMotionPrompt(scene, motionDirection, jobConfig.topic);
    const overlayText = buildOverlayText(scene);

    return {
      scene_id: scene.scene_id,
      narrative_purpose: `${scene.narrative_function}: ${scene.on_screen_text_suggestion || 'supporting evidence'}`,
      visual_type: visualType,
      factual_anchor_claim_ids: scene.claim_ids.length > 0 ? scene.claim_ids : [],
      composition,
      image_prompt: imagePrompt,
      video_motion_prompt: videoMotionPrompt,
      overlay_text: overlayText,
      motion_direction: motionDirection,
      transition_intent: scene.narrative_function === 'payoff' ? 'fade' : 'paper_reveal',
      fallback_visual: buildFallbackVisual(visualType),
      asset_rights_requirement: 'generated',
      continuity_tags: ['archival_collage', 'warm_ivory', `sc${scene.scene_id.toLowerCase()}`],
    };
  });

  return {
    style_preset: jobConfig.visual_preset,
    global_art_direction: artDir,
    scene_visuals: sceneVisuals,
    global_exclusions: buildGlobalExclusions(),
    review_flags: buildReviewFlags(script.scenes, claims),
  };
}

export async function runVisualIdeator(
  jobConfig: JobConfig,
  script: ScriptData,
  options: {
    forceMock?: boolean;
    openRouterKey?: string | null;
    model?: string;
  } = {},
): Promise<VisualPlanEnvelope> {
  const gateC = validateGateC(jobConfig, script);
  if (!gateC.valid) {
    return {
      job_id: jobConfig.job_id || 'unknown',
      stage: VISUAL_IDEATOR_STAGE,
      status: 'needs_review',
      schema_version: VISUAL_IDEATOR_SCHEMA_VERSION,
      prompt_version: VISUAL_IDEATOR_PROMPT_VERSION,
      provider: 'validation',
      model: 'none',
      data: {
        style_preset: jobConfig.visual_preset,
        global_art_direction: buildGlobalArtDirection(jobConfig.visual_preset),
        scene_visuals: [],
        global_exclusions: [],
        review_flags: [],
      },
      warnings: ['Gate C validation failed.'],
      errors: gateC.errors,
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
  const model = options.model || DEFAULT_VISUAL_IDEATOR_MODEL;

  if (shouldUseMock) {
    const data = generateDeterministicMockVisualPlan(jobConfig, script);
    const validation = validateVisualPlanOutput(data, script);

    return {
      job_id: jobConfig.job_id,
      stage: VISUAL_IDEATOR_STAGE,
      status: 'completed',
      schema_version: VISUAL_IDEATOR_SCHEMA_VERSION,
      prompt_version: VISUAL_IDEATOR_PROMPT_VERSION,
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

  const { systemPrompt, userPrompt } = buildVisualIdeatorPrompt(jobConfig, script);

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
        temperature: 0.3,
        max_tokens: 8192,
        seed: jobConfig.seed,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return {
        job_id: jobConfig.job_id,
        stage: VISUAL_IDEATOR_STAGE,
        status: response.status >= 500 ? 'retryable_error' : 'fatal_error',
        schema_version: VISUAL_IDEATOR_SCHEMA_VERSION,
        prompt_version: VISUAL_IDEATOR_PROMPT_VERSION,
        provider: 'openrouter',
        model,
        data: {
          style_preset: jobConfig.visual_preset,
          global_art_direction: buildGlobalArtDirection(jobConfig.visual_preset),
          scene_visuals: [],
          global_exclusions: [],
          review_flags: [],
        },
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
    let cleanContent = content.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    const firstBrace = cleanContent.indexOf('{');
    const lastBrace = cleanContent.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      cleanContent = cleanContent.slice(firstBrace, lastBrace + 1);
    }
    let parsedData: VisualPlanData;
    try {
      parsedData = JSON.parse(cleanContent) as VisualPlanData;
    } catch {
      try {
        const flattened = cleanContent
          .replace(/,\s*([\]}])/g, '$1')
          .replace(/"([^"\\]*(\\.[^"\\]*)*)"/g, (match: string) => {
            return match.replace(/\r?\n/g, '\\n').replace(/\t/g, '\\t');
          });
        parsedData = JSON.parse(flattened) as VisualPlanData;
      } catch {
        const mockFallback = generateDeterministicMockVisualPlan(jobConfig, script);
        const sceneVisuals: SceneVisual[] = [];
        for (const scene of script.scenes) {
          const imgMatch = cleanContent.match(new RegExp(`"${scene.scene_id}"[\\s\\S]*?"image_prompt"\\s*:\\s*"([^"]+)"`));
          const fallback = mockFallback.scene_visuals.find((s) => s.scene_id === scene.scene_id) || mockFallback.scene_visuals[0];
          sceneVisuals.push({
            ...fallback,
            scene_id: scene.scene_id,
            image_prompt: imgMatch ? imgMatch[1] : fallback.image_prompt,
            overlay_text: scene.on_screen_text_suggestion || fallback.overlay_text,
          });
        }
        parsedData = {
          style_preset: jobConfig.visual_preset,
          global_art_direction: mockFallback.global_art_direction,
          scene_visuals: sceneVisuals.length > 0 ? sceneVisuals : mockFallback.scene_visuals,
          global_exclusions: mockFallback.global_exclusions,
          review_flags: [],
        };
      }
    }
    const validation = validateVisualPlanOutput(parsedData, script);

    return {
      job_id: jobConfig.job_id,
      stage: VISUAL_IDEATOR_STAGE,
      status: validation.valid ? 'completed' : 'retryable_error',
      schema_version: VISUAL_IDEATOR_SCHEMA_VERSION,
      prompt_version: VISUAL_IDEATOR_PROMPT_VERSION,
      provider: 'openrouter',
      model,
      data: parsedData,
      warnings: validation.warnings,
      errors: validation.errors,
      usage: {
        input_tokens: json.usage?.prompt_tokens ?? null,
        output_tokens: json.usage?.completion_tokens ?? null,
        estimated_cost_usd: 0.005,
        actual_cost_usd: 0,
      },
    };
  } catch (error) {
    return {
      job_id: jobConfig.job_id,
      stage: VISUAL_IDEATOR_STAGE,
      status: 'retryable_error',
      schema_version: VISUAL_IDEATOR_SCHEMA_VERSION,
      prompt_version: VISUAL_IDEATOR_PROMPT_VERSION,
      provider: 'openrouter',
      model,
      data: {
        style_preset: jobConfig.visual_preset,
        global_art_direction: buildGlobalArtDirection(jobConfig.visual_preset),
        scene_visuals: [],
        global_exclusions: [],
        review_flags: [],
      },
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
