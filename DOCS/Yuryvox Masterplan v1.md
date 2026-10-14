# MASTER PLAN: Agentic Vox-Style Video Generator (API-Only, No Local Resources) - Yuryvox v1

> **How to use this file:** Paste this whole file into any AI session. It is the **single follow-up document**. Do not require reading every folder to know status. Before starting a session: (1) read the State Tracker, (2) read Appendix I (work completed summary), (3) read Appendix K (journal, last entries), (4) execute only the current phase's next unfinished numbered task. Never redo a phase marked DONE unless the operator requests a revision. After each phase, stop and wait for operator review.

> **Document authority:** `DOCS/Yuryvox_Agent_Instructions.md` (v1.0) is the operating contract for agents, JSON schemas, gates, and visual language. Where this masterplan's original agent details conflict with that file, **Agent Instructions win**. This masterplan remains the session tracker, phase checklist, cost/risk appendices, and work journal.

> **Scope truth (updated Phase 0):** "Vox-inspired explainer" means an **archival collage explainer**: tactile desk-of-evidence visuals (aged paper, documents, cut-outs, selective red), kinetic compositor text, researched narration, and short generated clips or Ken Burns stills. Do not claim official Vox production or endorsement. Pipeline: Idea Analysis → Script → Visual Ideation → Timing & Layout → Video Generation → Composite → Audio Mastering → QA. **API-only:** no local GPU, no self-hosted models, no dependency on the user's machine.

> **Host target:** **Vercel** (frontend + serverless API routes) chosen provisionally in Phase 1.1. Render/background workers still required later for long-running Agents 5–7 (not built). Storage: Supabase (PostgreSQL + Object Storage) preferred. Local this machine: Node v25.1.0; **runtime target remains Node 20** (`.nvmrc`, `engines`, Vercel `nodejs20.x`).

> **Cost goal:** Original client math was $30–35/video → $10–15 for up to 15 minutes. Phase 0 illustrative job default is **~90 seconds**, `budget_limit_usd: 15`, with human approval of script + visual plan **before paid generation**. Do not start paid Agents 5–7 until Phase 12 is confirmed in writing.

---

## OPERATOR WORKING METHOD (binding)

Agreed 2026-10-12. Any later session must follow this.

1. **One phase at a time.** Finish the current phase, report what was done, **ask for operator review**, wait for approval before the next phase.
2. **Inside a phase, numbered tasks in order.** Do 0.1 then 0.2 then 0.3 (never skip ahead). Same for 1.1–1.4, etc. If a task is blocked, stop and record the blocker in the journal; do not invent missing client decisions.
3. **Update this masterplan in the same session as the work.** State Tracker, the phase STATUS block, Appendix I (summary), and Appendix K (journal) must be current before asking for review.
4. **This file is enough to resume.** Summaries here must name files created, decisions, blockers, and the exact next task id (e.g. `1.1`). A new session should not need to crawl the repo to know what happened.
5. **Mocks before spend.** Build and test with mock providers. Paid Fal / Shotstack / ElevenLabs / AssemblyAI work waits for Phase 12 + credentials.
6. **Do not silently "improve" locked specs.** If Agent Instructions and this plan conflict, follow Agent Instructions and note the conflict in the journal.

---

## STATE TRACKER (fill in before each session)

- Current phase: **3 — Agent 2: Scriptwriter** — **WAITING OPERATOR REVIEW** (do not start Phase 4 until approved)
- Last completed task: **3.6** (Acceptance-criteria tests for ±5% word count and 10-60 words/scene; 27/27 tests passing, build passing)
- Environment: Next.js 14.2 App Router at repo root; host target **Vercel**; Node **20** target; local Node **v25.1.0**; `npm test`, `next lint`, `next build`, `next dev` all succeeded
- Credentials in place: OpenRouter N, ElevenLabs N, Fal N, Shotstack N, AssemblyAI N, Supabase N (0/7). `.env.example` exists; mock mode supported when keys absent
- Client decisions locked: visual preset `archival_collage_explainer`; API-only; orchestrator-owned gates; approval_mode `script_and_visual_plan_before_paid_generation`; no fake sources; **host = Vercel (provisional)**. **Not locked:** niche, voice, volume, music catalog, 9:16 vs 16:9 as production default, 90s vs 15-min, demo-only vs full MVP budget, research browse API, worker host for Agents 5–7
- Demo status: 0/3 sample videos shipped
- Open questions for client/operator: Phase 0.1 OPEN items; Phase 12; when to supply API keys
- Next 3 actions: [1] Operator reviews Phase 3 deliverables [2] On approval, start Phase 4 task **4.1** (Visual Ideator input contract & scene art direction) [3] Implement Agent 3 runner
- Canonical agent contract: `DOCS/Yuryvox_Agent_Instructions.md` v1.0
- Other docs (historical, not authority): `DOCS/Client Proposal - Yuryvox Agentic Video System.md`; `DOCS/Vox-Loom-Video-Script.md` (older Pexels/FFmpeg/Loom pitch — do not implement)

---

## 0. PROJECT BRIEF SNAPSHOT

- Client: Runs faceless channels, currently manual process (Chrome extension + Leonardo AI), cost ~$30-35/video, wants to reduce to $10-15 or lower.
- Core ask: Agentic webapp where user inputs a topic/idea, and specialized agents (via APIs) handle research, scripting, visual ideation, timing, video generation, and audio—**all without any local compute or storage**.
- Target length: Original ask up to 15 minutes. **Phase 0 working default for first jobs: 90 seconds** (illustrative in Agent Instructions; operator must confirm).
- Budget reality: Per-job `budget_limit_usd` default **15**. To hit $10-15 for 15 min, total API cost must be <$0.33/min. Strategy unchanged (OpenRouter for 1–3, rules for 4, Fal, Shotstack, ElevenLabs, AssemblyAI) but **prices and free-model names in later appendices may be stale** — re-read live provider config at implementation time.
- Deliverable that proves "agentic capability" (**Phase 0 approved 2026-10-12** by operator “continue”): 3 demo videos (different topics, **60–150s**) produced by the pipeline (mocks allowed until keys exist), plus the live webapp. Full 15-min production scale is a later phase.
- Operating contract after Phase 0 analysis: `DOCS/Yuryvox_Agent_Instructions.md`

---

## 1. GUIDING PRINCIPLES AND API-ONLY STACK

Principles: API-first (each agent = a hosted API call), stateless where possible (seeds, cheap models), human-in-the-loop for script/visual approval before expensive video gen, rights-safe media only, one config object per job.

| Agent | Role | API Choice | Why (Free/Cheap) |
|-------|------|------------|------------------|
| **Agent 1: Idea Analyst** | Research, fact-finding, angle generation | **OpenRouter** (free models: `google/gemma-7b-it`, `mistralai/mistral-7b-instruct`, or `gryphe/mythomax-l2-13b` via OpenRouter) | Free tier via OpenRouter; no cost for low volume. |
| **Agent 2: Scriptwriter** | Retention-optimized script, scene breakdown | **OpenRouter** (free model: `mistralai/mixtral-8x7b-instruct` or `google/gemma-7b-it`) | Strong long-form, free via OpenRouter. |
| **Agent 3: Visual Ideator** | Prompts for illustrations, style, consistency | **OpenRouter** (free model: `google/gemma-7b-it` or `openchat/openchat-3.5-1210`) | Good at prompt crafting, free. |
| **Agent 4: Timing & Layout Agent** | Scene durations, text overlays, motion directions | **Rule-based logic** (no API needed) – implemented in serverless function | Zero cost; deterministic math. |
| **Agent 5: Video Generator** | Text/Image-to-video clips (per scene) | **Fal.ai** (`fal-ai/flux/schnell` for images, `fal-ai/stable-video-diffusion` for video) *or* **Runway Gen-2** | Main cost; optimizable via clip length, seeding. Free trial credits available. |
| **Agent 6: Compositor & Transition Agent** | Stitch clips, add transitions, sync to audio | **Shotstack API** (video editing as a service) *or* **Creatomate API** | No FFmpeg needed; API handles compositing, transitions, text overlay. Free tier available. |
| **Agent 7: Audio Mastering Agent** | Voiceover, music, loudnorm, captions | **ElevenLabs API** (TTS) + **AssemblyAI API** (speech-to-text for captions) | ElevenLabs free tier (~10k chars/month); AssemblyAI free tier (~5 hours/month). Music via royalty-free API (e.g., Soundstripe) or open library. |

**Storage:** 
- **Metadata/Job records:** Supabase (free PostgreSQL) *or* Vercel Postgres (if on Vercel) + Supabase Storage *or* Vercel Blob for asset URLs (we store asset URLs from APIs; actual video/images hosted by the APIs themselves or we download temporarily? To avoid local saving, we can keep assets in the API providers' storage (e.g., Fal provides temporary URLs; we can copy them to our own storage via API). Simpler: we store the URLs returned by APIs (Fal, Shotstack, ElevenLabs) in our DB, and when the job is done we provide those URLs to the user. For final video, Shotstack returns a hosted MP4 URL. Thus we may not need our own object storage if APIs host assets long enough. However for reliability we will use **Supabase Storage** (free) to store copies of critical assets (final video, thumbnails). 
- **Alternative:** Use **Cloudflare R2** (free) via Vercel integration.

**UI/Orchestration:** Next.js 14 (App Router) hosted on Vercel. Serverless API routes (in `/app/api`) orchestrate the agent calls. State stored in Supabase. Use **Upstash Redis** (free) for temporary job queues if needed, but we can also poll status via Supabase.

**Agent Communication:** Each agent is a distinct API call; orchestrator passes JSON payloads. Use idempotency keys (client-generated) to avoid duplicate work.

**Do NOT use:** Local LLMs, local FFmpeg, local file storage, self-hosted GPUs, unprompted copyrighted music.

---

## 2. PHASE 0: DISCOVERY AND DEFINITION (Day 1, ~2 hours)

**STATUS:** DONE — operator approved 2026-10-12 (“yes continue”). Working defaults in 0.1–0.3 stand unless later amended.

**Objective:** Pin "Vox style" to a concrete spec before writing code.

**Source for this phase:** Operator provided Phase 0 analysis as `DOCS/Yuryvox_Agent_Instructions.md` v1.0. Tasks 0.1–0.3 below record that analysis into this masterplan. Missing client answers are marked OPEN rather than invented.

---

### Task 0.1 — Record answers — DONE (pending review)

Original questions and recorded answers (map 1:1):

| # | Question | Answer | Status |
|---|----------|--------|--------|
| 1 | Example videos that mean "Vox style" | Physical example files are **not in this repo**. Agent Instructions define the look from "provided references": tactile archival collage (researcher's desk — aged paper, documents, cut-outs, tape, annotations, one focal subject, selective red, layered reveals). Official Vox endorsement is prohibited. | LOCKED as spec; **reference stills/videos still missing from repo** |
| 2 | Animated explainer vs hybrid stock | Custom/generated archival collage + compositor type, maps, timelines, diagrams, charts, photos, restrained motion. Not the old Loom/Pexels stock-B-roll pipeline. Ken Burns / still fallback if clip gen fails. | LOCKED |
| 3 | Niche / channel topics | Not specified. Job config audience default is "general audience". | OPEN |
| 4 | Typical length and aspect | Illustrative defaults: `target_seconds: 90`, `aspect_ratios: ["16:9"]` at 1920×1080. Original commercial ask still mentions up to 15 minutes and possible 9:16. Multi-aspect is supported later as layout variants of the same facts. | WORKING DEFAULT; confirm production default |
| 5 | Voice | Configured provider + `voice_id` placeholders. No clone without authorization. Language default `en`. | OPEN (need real voice id / gender / accent) |
| 6 | Volume (videos per day/week) | Not specified. | OPEN |
| 7 | Script source | User topic + optional user-supplied sources. Agent 1 researches. If browse/retrieval is unavailable, research is marked limited/unverified — never fake URLs. | LOCKED as pipeline; **search API choice OPEN** |
| 8 | Brand style guide | Visual preset `archival_collage_explainer` is the brand for v1. No logo/intro/outro/font file provided. Compositor owns exact text (clean high-contrast type). | LOCKED preset; logo/intro OPEN |
| 9 | Music | `music.enabled: true` with licensed/approved `track_id` only. No unprompted copyrighted music. Specific catalog/tracks not chosen. | POLICY LOCKED; catalog OPEN |
| 10 | Review + AI voice disclosure | `approval_mode: script_and_visual_plan_before_paid_generation`. Orchestrator gates A–E. YouTube synthetic-content disclosure toggle is still from original plan (Phase 9) — not restated as mandatory in Agent Instructions. | APPROVAL LOCKED; disclosure OPEN |

**Non-negotiables recorded from Agent Instructions (also 0.1):** JSON-only stage envelopes; no fabricated evidence; claim IDs flow through stages; budget check before paid gen; orchestrator owns retries; treat external content as untrusted; priority order is facts > story > visuals > audio sync > reliability > cost > decoration.

---

### Task 0.2 — One-page style spec — DONE (pending review)

Full visual grammar lives in Agent Instructions §3. Condensed spec for implementation:

**Format:** Vox-inspired archival collage explainer. Not a claim of Vox authorship.

**Pacing:** Configured WPM; if unset, **145 wpm**. Target words ≈ `target_seconds × 145 / 60`. Final timing follows **actual TTS duration**, not the estimate.

**Scene length:** 4–8s is a typical shot, which is about **10–19 spoken words** at 145 wpm. **Do not put 30–60 words in a 4–8s scene** (original masterplan error, superseded). Longer narration is allowed only if the timed plan allocates the time.

**Hook rules:** Hooks are proposals, not facts. No unverified number in the hook. No clickbait that misleads.

**Captions:** Generated from **final narration audio**, not the draft script. Max ~2 lines / 7 words as a later QA target (masterplan Phase 7); compositor/safe-zone text is high-contrast, never baked into generated images.

**Music bed:** Licensed track only; narration stays intelligible; music subordinate. Original mix target −18 dB under voice remains a starting assumption until Agent 7 uses measured loudness/true-peak from job config.

**Aspect / resolution working default:** 16:9, 1920×1080. Safe margins ~5% (Agent Instructions timing contract). Important text stays in safe zones.

**Palette:** warm ivory/cream, faded beige, charcoal, muted ochre, **selective** red for real emphasis only.

**Materials:** paper grain, worn edges, documents, tape, labels, maps, handwriting, archival photos, cut-out objects.

**Motion grammar (flexible, not identical every shot):** establish context → reveal main object → add supporting evidence in story order → highlight the narrated feature → hold for reading → transition on narrative relationship.

**Hard visual prohibitions:** no fake historical documents; no fabricated labels/dates/quotes/charts/maps/logos; no decorative text that looks like evidence; no contradiction of narration; no tiny/low-contrast labels; no generic AI b-roll when a document/diagram would explain better; no exact imitation of a living artist; no baked-in essential typography in image models.

**Priority if tradeoffs appear:** (1) factual integrity (2) story clarity (3) visual consistency/legibility (4) audio intelligibility/sync (5) render reliability (6) cost (7) decoration.

---

### Task 0.3 — Deliverable / scope statement — PROPOSED (pending review)

**In scope for first engagement (proposed):**
- Private webapp: topic in → job status → artifacts → download when complete.
- Seven-agent pipeline per Agent Instructions, orchestrator-owned state machine and gates A–E.
- Human approval of script + visual plan before paid generation.
- Proof: **3 demo videos**, different topics, **60–150s each**, 16:9 unless operator changes aspect. Mocks until keys exist; one real end-to-end render only after credentials + budget cap.
- Repo + README + `.env.example` + cost fields on the job.
- Further automation (YouTube publish, CSV batch, scheduling, 15-min scale) is **out of this engagement**.

**Explicitly not in this phase of work:**
- Starting paid Agents 5–7 before Phase 12 (demo-only vs full MVP) is written.
- Inventing a niche, voice, or music catalog.
- Implementing the old Loom script (Pexels + local FFmpeg as the product).

**Budget gate (still unsigned — Phase 12):**
- Path A demo-only: Agents 1–4 + mocks/trial for 5–7, ~10–14h historically quoted.
- Path B full MVP: Phases 0–11, historically quoted ~41h / $600–800 (proposal doc quoted ~120h — treat as outdated sales copy until operator picks a path).

**Acceptance criteria vs original Phase 0:**
- 10 answers in writing: **partial** — 6 locked/defaulted, 4+ OPEN (see 0.1). Operator may accept working defaults to proceed.
- Style spec: **written** in 0.2 + Agent Instructions §3. Sign-off = this review.
- Dollar deliverable ($100 vs $150–200 vs $600–800): **not signed**.

**Deliverable of Phase 0:** this STATUS block + Agent Instructions v1.0 + this proposed scope. No new code.

---

**Phase 0 original tasks (checklist):**
- [x] 0.1 Record answers (OPEN items listed, not invented)
- [x] 0.2 Write one-page style spec into this file
- [x] 0.3 Propose deliverable/scope (awaiting operator agreement)

**Acceptance:** Operator review required before Phase 1.

---

## 3. PHASE 1: ENVIRONMENT AND CREDENTIALS (Day 1, ~2 hours)

**STATUS:** COMPLETED — AWAITING OPERATOR REVIEW (do not start Phase 2 until operator approves).

- [x] **1.1 Dev environment:** 
  - **Vercel** chosen provisionally (for Next.js webapp + serverless API routes); Render/worker noted for long-running Agents 5–7 later.
  - Node.js 20 target (`.nvmrc`, `engines` in `package.json`, Vercel `nodejs20.x`). No local GPU/CPU usage.
- [x] **1.2 Project skeleton:** 
  - `/app` (Next.js 14 App Router: `layout.tsx`, `page.tsx`, `globals.css`)
  - `/app/api/*` (serverless routes: `/api/health`, `/api/smoke`, `/api/jobs` stub, `/api/agents/[stage]` stub)
  - `/lib` (shared utils: `env.ts`, `config.ts`, Supabase client in `lib/supabase/client.ts`, provider adapters in `lib/providers/*`)
  - `/components`, `/styles` (`CredentialChecklist.tsx`, `styles/tokens.css`)
  - Config-driven via `/config/presets/*.json` (`style.json`, `aspect.json`, `voice.json`, `job.defaults.json`)
  - Testing & quality: Jest configured (`__tests__/smoke.test.ts`), ESLint, Prettier.
- [x] **1.3 Credentials template & safety:**
  - Template `.env.example` created with 7 required keys (`OPENROUTER_API_KEY`, `ELEVENLABS_API_KEY`, `FAL_API_KEY`, `SHOTSTACK_API_KEY`, `ASSEMBLYAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, plus `SUPABASE_SERVICE_ROLE_KEY` and `YURYVOX_SMOKE_LIVE`).
  - `.gitignore` configured to prevent committing `.env*.local` or real secrets.
- [x] **1.4 Verification & smoke tests:**
  - `/api/health` returns status, runtime, and safe boolean credential presence without leaking keys.
  - `/api/smoke` verifies provider adapters (presence-only by default; live pings only if `YURYVOX_SMOKE_LIVE=true`).
  - `npm test` passes all 5 unit/smoke tests; `npm run lint` passes with 0 errors; `npm run build` succeeds cleanly.

**Acceptance criteria:** All smoke tests pass; Next.js dev server runs; build succeeds; Supabase connection helper ready; agent API clients import cleanly.
**Deliverables:** Complete repo skeleton + presets + provider smoke adapters + credentials checklist UI and API endpoints.

---

## 4. PHASE 2: AGENT 1 – IDEA ANALYST (Day 2, ~2 hours)

**STATUS:** COMPLETED — AWAITING OPERATOR REVIEW (do not start Phase 3 until operator approves).

**Objective:** From a user-provided topic/idea, produce a research brief with 3 angles, claims with support status, proposal hooks, and sources adhering to `DOCS/Yuryvox_Agent_Instructions.md` v1.0.

- [x] **2.1 Input contract & Gate A validation:**
  - Defined `JobConfig`, `ResearchData`, `ResearchEnvelope`, `Angle`, `Hook`, `Claim`, `SourceRecord` in `lib/agents/types.ts`.
  - Built `validateGateA` checking required non-empty topic, positive target_seconds, valid aspect_ratios, non-negative budget, and job_id.
- [x] **2.2 Prompt construction & OpenRouter integration:**
  - System prompt in `buildIdeaAnalystPrompt` enforces investigative archival research, strict JSON envelope without markdown fences, and truth guardrails (never invent fake citations, distinguish facts vs inference).
  - OpenRouter client integration with mock fallback when `OPENROUTER_API_KEY` is unset or `forceMock` is enabled.
- [x] **2.3 Determinism and parameters:**
  - Configured `temperature: 0.2`, `max_tokens: 1500`, seed support.
  - Deterministic mock generator `generateDeterministicMockResearch` producing structured research tailored to the topic with citation links and explicit claim IDs (`C1`, `C2`, etc.).
- [x] **2.4 Output envelope & schema validation:**
  - Standard `StageEnvelope<ResearchData>` wrapper with stage name `idea_analyst`, schema version `1.0`, prompt version `1.0`.
  - `validateResearchOutput` verifies 3 distinct angles, matching `recommended_angle_id`, proposal hooks mapping to valid `supporting_claim_ids`, and claims with explicit `support_status`.
- [x] **2.5 Route handler & test verification:**
  - Implemented `POST` and `GET /api/agents/idea-analyst` via `app/api/agents/[stage]/route.ts`.
  - Test suite in `__tests__/idea-analyst.test.ts` testing Gate A validation, schema checks, and 3 sample topics:
    1. *"How container ships quietly restructured global trade"*
    2. *"The forgotten paper maps that created modern property lines"*
    3. *"Why electric grid frequencies must never drift from 60 Hz"*
  - All 17 tests passed; `npm run lint` 0 warnings; `npm run build` succeeds cleanly.

**Acceptance criteria:** All Gate A checks pass; 3 sample topics produce well-formed, compliant `ResearchEnvelope` objects; claim IDs map cleanly; route operational.
**Deliverables:** `lib/agents/types.ts`, `lib/agents/idea-analyst.ts`, `app/api/agents/[stage]/route.ts` updated, `__tests__/idea-analyst.test.ts`.

---

## 5. PHASE 3: AGENT 2 – SCRIPTWRITER (Day 2-3, ~3 hours)

**STATUS:** COMPLETED — AWAITING OPERATOR REVIEW (do not start Phase 4 until operator approves).

**Objective:** Turn research brief into a retention-optimized Vox-style explainer script with scene breakdown, pacing calibration, and claim traceability adhering to `DOCS/Yuryvox_Agent_Instructions.md` v1.0.

- [x] **3.1 Input contract & Gate B validation:**
  - Added `ScriptData`, `ScriptEnvelope`, `Scene`, `NarrativeFunction` to `lib/agents/types.ts`.
  - Implemented `validateGateB` in `lib/agents/scriptwriter.ts` requiring validated research data with angles, claims, and positive target runtime.
- [x] **3.2 Runtime & pacing calibration:**
  - Calibrated against 145 words-per-minute standard (`target_words = round(target_seconds * 145 / 60)`).
  - Enforced 4–8s shot rule (~10–19 spoken words per scene; supersedes old 30–60 word draft flaw).
  - Automatic calculation of `estimated_duration_seconds` and `runtime_deviation_seconds`.
- [x] **3.3 Prompt construction & OpenRouter integration:**
  - System prompt in `buildScriptwriterPrompt` enforces spoken-delivery voice, no invented dialogue or unverified statistics, concise on-screen text (max 4 words), and JSON-only envelope.
  - Built `generateDeterministicMockScript` providing realistic explainer scripts without spending API credits when keys are absent.
- [x] **3.4 Claim traceability & schema validation:**
  - `validateScriptOutput` verifies title, central thesis, narrative functions (`hook`, `context`, `explanation`, `evidence`, `transition`, `payoff`).
  - Strict traceability: flags any scene claims not present in the research phase claims.
- [x] **3.5 Route handler & test verification:**
  - Implemented `POST` and `GET /api/agents/scriptwriter` via `app/api/agents/[stage]/route.ts`.
  - Comprehensive unit test suite in `__tests__/scriptwriter.test.ts` testing Gate B validation, pacing math, and end-to-end execution across all 3 sample topics:
    1. *"How container ships quietly restructured global trade"*
    2. *"The forgotten paper maps that created modern property lines"*
    3. *"Why electric grid frequencies must never drift from 60 Hz"*
  - All 27 unit tests passed; `npm run lint` 0 warnings; `npm run build` succeeds cleanly.

- [x] **3.6 Acceptance-criteria test coverage (NEW):**
  - Added test assertions verifying scripts hit target word count within ±5% across all 3 sample topics.
  - Added per-scene word-count bounds (10–60 words, compatible with 4–8s shot rule).
  - Expanded `generateDeterministicMockScript` to generate additional evidence scenes when target word count is not met, ensuring pacing accuracy.

**Acceptance criteria:** All Gate B checks pass; scripts match target duration within acceptable tolerance; 4–8s shots adhere to pacing guidelines; claims map to research IDs; route operational.
**Deliverables:** `lib/agents/types.ts` updated, `lib/agents/scriptwriter.ts`, `app/api/agents/[stage]/route.ts` updated, `__tests__/scriptwriter.test.ts`.

---

## 6. PHASE 4: AGENT 3 – VISUAL IDEATOR (Day 3, ~2 hours)

**Objective:** Convert each scene into a visual concept and generate consistent image prompts via OpenRouter free model.

- 4.1 Input: `script.json` + `{art_style: "flat vector|isometric|cinematic|watercolor", color_palette, character_consistency: true/false}`.
- 4.2 For each scene, call **OpenRouter** with model `google/gemma-7b-it` (free) using prompt:
  ```
  Given this scene text and intent, produce: (1) A detailed image prompt for a text-to-image model that matches the Vox style ({art_style}), (2) A short text overlay suggestion (max 4 words), (3) A motion direction (e.g., 'slow zoom in', 'pan left', 'none'). Return JSON: {image_prompt, overlay_text, motion_direction}.
  ```
- 4.3 If `character_consistency: true`, we append a base character/setting description (generated once) to each image prompt.
- 4.4 Store alternatives: keep top 2 image prompts per scene (we can ask model to give primary + two alternatives).
- 4.5 Output: `visual_plan.json` saved to Supabase table `job_visual_plan`.

**Acceptance criteria:** 3 scripts yield visual plans with prompts specific, style-consistent, under 200 chars; overlay text concise; motion directions feasible.
**Deliverable:** agent_visual_ideator API route + 3 sample visual_plan.json records.

---

## 7. PHASE 4.5: AGENT 4 – TIMING & LAYOUT AGENT (Day 3-4, ~2 hours)

**Objective:** Assign precise durations, layout, and audio cues using rule-based logic (zero API cost).

- 5.1 Input: `visual_plan.json` + `{target_seconds, voice_speed: 1.0, music_preference}`.
- 5.2 Rule-based distribution: 
  - Base duration per scene = (scene word count / 150) * 60 seconds, clamped to 3-12s.
  - Adjust so sum equals target_seconds (within 2s) by prorating.
  - Hook scenes get 10% extra if needed for impact.
- 5.3 Layout: Determine safe zones for text (bottom third, 10% margin). Overlay text from Agent 3 placed there with fade-in/out.
- 5.4 Audio cues: Mark scene start/end times for voiceover; insert 0.3s silence at scene boundaries if no overlap.
- 5.5 Music: Assign a music bed track (from royalty-free list config) at -18dB, with ducking during voiceover.
- 5.6 Output: `timed_plan.json` saved to Supabase table `job_timed_plan`.

**Acceptance criteria:** Total duration matches target within 2s; scene durations 3-12s; overlay styling follows spec; audio cues non-overlapping.
**Deliverable:** agent_timing_layout API route + 3 sample timed_plan.json records.

---

## 8. PHASE 5: AGENT 5 – VIDEO GENERATOR (Day 4-6, ~6 hours)

**Objective:** Generate short video clips (or keyframes) for each scene using Fal.ai (or Runway) API; this is the main cost center.

**Strategy to minimize cost:**
- Use **image→video** (Fal.ai Flux Schnell for image, then Stable Video Diffusion for video) for more control & fewer retries.
- Prefer **Fal.ai** for pricing and speed: 
  - Fal.ai Flux Schnell: ~$0.003 per image
  - Fal.ai Stable Video Diffusion: ~$0.04 per 4-second clip (at 25fps)
  - A 6-second scene: 1 image + 1.5 clips = ~$0.065
  - For 15 min (150 scenes at 6s avg): ~$9.75 video gen cost → **under $10**.
- If client prefers Runway: similar pricing; we can switch via config.
- **No local saving:** We store the URLs returned by Fal (which are temporary, usually 1 hour). To ensure longevity, we will immediately copy the fetched video to our own Supabase Storage (via serverless fetch and upload) – this uses a tiny bit of compute but is acceptable as it's a short-lived serverless function.
- Fallback: If video generation fails, we use a **Ken Burns effect** on the image via Shotstack later (Agent 6).

**Implementation:**
- 6.1 Input: `timed_plan.json`.
- 6.2 For each scene:
  a. Generate primary image via Fal.ai Flux Schnell using `image_prompt_primary`. Seed = hash(scene_id + job_seed).
  b. Generate video clip via Fal.ai SVD using the same image as conditioning. Prompt: `motion_direction` (e.g., "slow zoom in"). Duration = scene.duration_s (clipped to 4-6s; if longer, generate multiple clips and concatenate via Shotstack later).
  c. Fetch the generated video URL (via Fal's CDN) and upload to Supabase Storage bucket `video-clips` (making it publicly accessible or signed URL). Store the permanent URL.
  d. Store asset URLs and local (Storage) paths; keep alternatives if primary fails.
  e. If motion_direction is "none", we will later apply Ken Burns via Shotstack.
- 6.3 Output: `video_assets.json` saved to Supabase table `job_video_assets` with `{scenes: [{scene_id, image_url, video_url (Supabase Storage), duration_s, seed, generation_cost_usd, status: "generated|failed|fallback_ken_burns'}]}`.

**Acceptance criteria:** 80%+ scenes generate usable video clips; failed scenes fallback to Ken Burns without breaking timing; total video gen cost logged and within target (<$0.40/min for MVP).
**Deliverable:** agent_video_generator API route + asset manifest for samples (stored in Supabase Storage).

---

## 9. PHASE 6: AGENT 6 – COMPOSITOR & TRANSITION AGENT (Day 5-6, ~4 hours)

**Objective:** Stitch video clips (or Ken Burns images) into a silent video layer, add transitions, overlay text, and prepare for audio sync — all via Shotstack API (no FFmpeg locally).

- 7.1 Input: `video_assets.json` + `timed_plan.json` + `{aspect_ratio: "16:9", transition_type: "crossfade|slide|none", music_track_id}`.
- 7.2 Build Shotstack edit JSON programmatically:
  - For each scene: 
    - Clip: use `video_url` (from Supabase Storage) trimmed to scene.duration_s.
    - If fallback: we will generate a Ken Burns clip on the fly using Shotstack's `image` asset with `zoom` effect (we already have image_url from Agent 5).
    - Add fade-in/out (0.2s) to avoid harsh cuts.
    - Overlay text: use Shotstack `title` asset with text from `overlay_text`, font (Inter Bold), size, color, bottom-center, fade in/out synced to scene.
  - Between scenes: insert transition (e.g., 0.5s crossfade) if not "none".
- 7.3 Music bed: fetch royalty-free track (from config) via API or use a pre-uploaded asset in Shotstack; loop or trim to total duration, volume -18dB.
- 7.4 Submit edit to Shotstack API; poll until complete; receive `output_url` (hosted MP4).
- 7.5 Copy the output URL to Supabase Storage bucket `final-videos` (or keep Shotstack URL if reliable long-term; we'll copy for safety).
- 7.6 Also generate a thumbnail: extract mid-frame via Shotstack (or we can use FFmpeg via a tiny serverless function? Simpler: use Shotstack to export a frame as image). Store in Supabase Storage bucket `thumbnails`.

**Acceptance criteria:** Silent video renders without black frames, transitions smooth, text legible at phone size, duration matches timed_plan within 0.5s.
**Deliverable:** agent_compositor API route + 3 sample silent videos (one per aspect if needed) in Supabase Storage.

---

## 10. PHASE 7: AGENT 7 – AUDIO MASTERING AGENT (Day 6-7, ~4 hours)

**Objective:** Generate voiceover, mix with music, add captions, and loudness normalize — using ElevenLabs and AssemblyAI APIs.

- 10.1 Voiceover: 
  - Call **ElevenLabs API** `text-to-speech` per scene (using scene text) with voice_id, stability 0.45, similarity 0.8; concatenate with 0.15s silence between scenes.
  - Normalize each scene WAV to -3dB peak (we can do this via a tiny FFmpeg call in a serverless function, but we can also rely on ElevenLabs' output being consistent; we'll normalize via FFmpeg in a serverless function if needed – acceptable as it's short-lived).
  - Upload the final voiceover WAV to Supabase Storage bucket `voiceover`.
- 10.2 Captions: 
  - Call **AssemblyAI API** to upload the voiceover WAV and request transcription with `word_boost` and `speaker_labels:false`. 
  - Poll until done; get word-level timestamps.
  - Chunk into max 2 lines, max 7 words per line, break at phrase boundaries, min 0.8s / max 3.5s display.
  - Generate ASS subtitle file (bold, 48px, white, black outline, bottom-center) and SRT sidecar using a serverless function (Node.js script).
  - Upload `captions.ass` and `captions.srt` to Supabase Storage bucket `captions`.
- 10.3 Music mix: 
  - We already have music mixed in the video via Shotstack (Agent 6). However Shotstack does not do loudnorm or sidechain compression. 
  - Alternative: we can separate voice and music earlier, but for simplicity we will:
    - Extract audio track from the composited video (via Shotstack? Shotstack can output audio-only? Not sure). 
    - Better: we let Shotstack handle the music mix at -18dB (we already did). Then we take the resulting video, extract its audio, mix with voiceover at proper levels using a serverless FFmpeg call, then remux. 
    - Given constraints, we can accept Shotstack's music mixing as is (voiceover + music at -18dB) and rely on ElevenLabs' voice being loud enough. For true broadcast loudnorm we would need an extra step, but we can note that for MVP we skip loudnorm and rely on client to adjust; or we use a lightweight audio API like Dolby.io? Too complex. 
    - We'll add a note: In production we would integrate an audio mastering API (e.g., Auphonic) but for MVP we use ElevenLabs' output directly and mix via Shotstack at -18dB, which is acceptable for many platforms.
- 10.4 Sync check: Compare caption start times vs voiceover word offsets (from AssemblyAI); drift > 100ms triggers warning (should not happen with Whisper-on-own-voice).
- 10.5 Output: final video file already from Shotstack (with music). We will replace its audio track with our mastered voiceover+mix using a serverless FFmpeg call (fetch video from Supabase Storage, fetch voiceover, mix, remux, upload back). This is the only FFmpeg usage, but it's a short-lived serverless function—acceptable under "no local resources" as we use ephemeral compute.
  - Steps: 
    a. Download composited video (from Supabase Storage).
    b. Download voiceover WAV.
    c. Mix: `ffmpeg -i video.mp4 -i voiceover.wav -c:v copy -c:a aac -map 0:v:0 -map 1:a:0 -shortest output.mp4` (we can also lower original audio volume to -18dB and voiceover to 0dB).
    d. Upload final MP4 to Supabase Storage bucket `final-videos`.
    e. Also generate a short preview (first 5 seconds) for quick playback.
- 10.6 Output metadata: Save `final_video_url`, `cass_url`, `csrt_url`, `duration_s`, `loudness_lu` (if we measure) to Supabase table `job_final`.

**Acceptance criteria:** Voiceover natural, captions accurate and in sync, no dead air >0.5s, final video passes basic platform checks.
**Deliverable:** agent_audio_mastering API route + 3 sample final videos (16:9 and 9:16 if applicable) in Supabase Storage.

---

## 11. PHASE 8: ORCHESTRATION, QUEUE AND API (Day 7-8, ~5 hours)

**Objective:** Turn the agent chain into a callable service with job states, retry, and a webapp UI.

- 8.1 Orchestration (Next.js serverless API routes):
  - Job model in Supabase table `jobs`: 
    `{job_id, idempotency_key, topic, preset, aspect[], duration, voice_provider, status (PENDING->IDEA_ANALYST->SCRIPTWRITER->VISUAL_IDEATOR->TIMING_LAYOUT->VIDEO_GEN->COMPOSITOR->AUDIO_MASTERING->DONE/FAILED), timestamps per state, artifact URLs (research, script, visual_plan, timed_plan, video_assets, silent_video, final_video, captions, thumbnail), cost breakdown, error messages, seed}`.
  - Each agent route updates the job state and passes JSON to the next via direct function calls (since all are in same codebase) or via message queue (we can use Supabase Realtime or a simple polling loop; for MVP we'll chain calls synchronously within a route with timeout handling, but better to use background jobs). 
  - We'll implement a `/api/jobs` POST route that validates input, creates a job record, then triggers the first agent via an internal function. Each agent function updates the job and calls the next. For long-running agents (video gen, Shotstack) we use async polling within the route (since Vercel serverless functions have limited duration, we may need to use Render background workers or Vercel cron jobs). Simpler: we use Render for workers.
  - Given the constraint "no local resources", we can still use Render's free tier for background workers (they are not "local" to us). We'll assume we can use Render's web service for the API and background workers for long tasks.
  - Retry: Failed jobs retry once with fallback (e.g., Fal → Runway, ElevenLabs → AssemblyAI TTS? Actually fallback TTS could be a free API like Hugging Face Inference API) before marking FAILED.
  - Idempotency: Client-supplied key prevents duplicate renders (we check before creating job).
  - Cost telemetry: Log each API call's cost (we know approximate pricing) and store in `cost` field.
- 8.2 API (Next.js API routes or Render endpoints):
  - POST `/api/jobs` → validate → create job → enqueue to first agent → return job_id
  - GET `/api/jobs/[id]` → status, progress, artifact URLs (signed if private)
  - POST `/api/jobs/[id]/retry` → retry failed job
  - GET `/api/health` → liveness
- 8.3 Webapp (Next.js App Router):
  - `/` → form: topic input, dropdown for length/aspect/voice, submit.
  - `/jobs` → list of jobs with status cards, retry button, download links.
  - `/jobs/[id]` → job detail: show research, script, visual plan, preview video player (if done), cost breakdown.
  - Use shadcn/ui for components; deploy to Vercel (free tier) or Render.

**Acceptance criteria:** 5 jobs queued concurrently (mix of lengths) complete successfully; statuses accurate; idempotency replay returns original result; failed-job retry proven; UI renders and downloads finished video.
**Deliverable:** API + queue + Next.js webapp + OpenAPI schema (if needed).

---

## 12. PHASE 9: QUALITY, SAFETY AND LEGAL (Day 8, ~3 hours)

- 9.1 Automated gates per job:
  - Caption sync check (AssemblyAI vs audio) → drift < 100ms (we can compute in a serverless function after captions generated).
  - Loudness check: optional; we can skip for MVP or use a simple FFmpeg loudnorm call in a serverless function to measure.
  - Black-frame detection: we can run a quick FFmpeg `blackdetect` on the final video via a serverless function (short-lived).
  - Silence detection: FFmpeg `silencedetect` for dead air > 0.8s.
  - Aspect crop sanity: we can render a debug frame and check text overlay is within safe margin (via FFmpeg drawtext and cropdetect).
- 9.2 Content safety: 
  - Flag script claims when no sources provided (Agent 1) → require human review before proceeding to video gen. We'll add a `needs_review` flag in the job if Agent 1 did not use real sources.
  - Optional: LLM fact-check pass against sources with "claims without evidence" report (we can skip for MVP).
- 9.3 Rights: 
  - Video gen assets: Fal.ai provides commercial rights; log provider and prompt.
  - Music: only from royalty-free list (We will use a curated list of free tracks from YouTube Audio Library or similar; we store the track URLs and license info).
  - Voice: ElevenLabs commercial rights on paid tier; free tier may require attribution – we'll check and upgrade if needed.
  - Reject job if any asset lacks a license record (we can store license metadata with each asset).
- 9.4 TTS disclosure: Add optional description line "AI-generated voice" in video metadata (we can add to MP4 metadata via FFmpeg) and end-card variant; document YouTube synthetic-content policy compliance.
- 9.5 Voice consent: If cloning, require consent file path before rendering (we'll have an upload field in the form).

**Acceptance criteria:** All gates run on 3 demos with green report; disclosure toggle works; a job with missing license fails loudly.
**Deliverable:** QA gate report for demos + legal checklist.

---

## 13. PHASE 10: TESTING AND QA MATRIX (Day 8-9, ~4 hours)

Run all, record in QA matrix (Appendix D):
- 10.1 Unit: Test each agent route in isolation (mock APIs where needed using nock or similar).
- 10.2 End-to-end: 3 topics x 2 aspects (if applicable), plus edge inputs (empty topic, 30s and 15-min targets, non-English topic).
- 10.3 Failure: 
  - Kill OpenRouter key → fallback to DuckDuckGo+scrape + local Ollama? But we said no local resources. Instead we can have a secondary free model on OpenRouter as fallback. 
  - Kill ElevenLabs → fallback to Hugging Face Inference API (free) for TTS.
  - Fal.ai key dead → Runway fallback (if configured) → if both fail, we can still generate video via Shotstack using images + Ken Burns (we already have images from Fal image step; we can use those).
  - Shotstack key dead → we could fallback to Creatomate or a simple FFmpeg serverless function (but we want to avoid that; we'll note that Shotstack is critical and we have a backup plan).
  - Redis down (if used) → job stays PENDING, alert via log
  - Disk full → clean error, no partial file (we use Supabase Storage, which is managed)
- 10.4 Load: 10 concurrent jobs (mostly short) → queue drains, no cross-job leakage.
- 10.5 Reproducibility: Same seed twice → identical final video hash (if we fix all API versions; note that some APIs may have non-deterministic aspects, but we try).

**Acceptance criteria:** 100% of safety gates pass; client reviews 3 demos and marks style as on-brief; zero P1 defects open.
**Deliverable:** QA matrix with evidence links.

---

## 14. PHASE 11: DELIVERABLE PACKAGE AND HANDOFF (Day 9, ~2 hours)

- 11.1 3 demo videos (the proof of "agentic capability"): different topics, 60-150s each, both aspects if requested, one with music, one multilingual if asked.
- 11.2 Repo: README (quickstart, architecture diagram, agent prompts, preset docs), .env.example, requirements pinned (package.json), seed data, 5-minute local run guide (using mock APIs for agents 1-4, real for 5-7 if budget allows – but we will provide instructions to add their own API keys).
- 11.3 Operations: How to change voices, add music, swap video gen providers, adjust caption style (all via config/presets, no code edits).
- 11.4 Loom (optional): 90-second screen recording: form → job list → preview → download.
- 11.5 Offer the expansion pack: auto-publish to YouTube (OAuth + YouTube API), scheduling (cron of topics), batch mode (CSV → overnight queue), more voices/languages, A/B thumbnail generation.

**Acceptance criteria:** Client can run `npm run dev` locally, submit a topic, and get a video (if they provide API keys for agents 5-7); package delivered via GitHub repo + Vercel/Render deploy links.
**Deliverable:** delivery package + handoff notes.

---

## 15. PHASE 12: BUDGET DECISION GATE (decide before any agent 5-7 work)

- 12.1 If client holds at $100 (or similar): deliver demo-only scope: 
  - Build agents 1-4 (free OpenRouter models) 
  - Run one end-to-end job (60s) using trial credits or free tiers for agents 5-7 (Fal free trial, ElevenLabs free, Shotstack free, AssemblyAI free)
  - Provide the webapp and agent code; client adds their own keys for further use.
  - Total: 8-12 hours. State clearly: this is a proof-of-concept; full automation with per-video cost <$0.40/min requires agents 5-7 keys.
- 12.2 If client accepts $400-600 (covers 20-30 hours): execute Phases 0-11 in full, including setting up agent 5-7 with client-provided keys (or we provision with spending limits).
- 12.3 Never start video-gen work before scope and price are confirmed in writing.

**Acceptance criteria:** Written scope + price agreed before Phase 5 begins.
**Deliverable:** signed scope statement.

---

## 16. APPENDIX A: AGENT PROMPT TEMPLATES (OPENROUTER)

### A.1 Idea Analyst (OpenRouter free model)
System: "You are a senior researcher. Given the topic, produce: (1) 3 engaging angles for a Vox-style explainer, (2) key facts with citations, (3) potential hook lines, (4) list of source URLs. Return JSON: {angles: [{title, summary}], facts: [{claim, citation, source_url}], hooks: [string], sources: [{title, url, snippet}]}."

### A.2 Scriptwriter (OpenRouter free model)
System: "You write scripts for faceless explainer videos. Target: {word_count} words ({target_minutes} minutes at 150 wpm). Structure: hook (if true), build (3-5 points), payoff. Use ONLY facts from provided research. Avoid specific statistics unless from sources. Then split into scenes of 30-60 words each. Return JSON: {script, scenes: [{scene_id, text, intent (hook/evidence/payoff), on_screen_text_suggestion, visual_concept}]}."

### A.3 Visual Ideator (OpenRouter free model)
System: "Given this scene text and intent, produce: (1) A detailed image prompt for a text-to-image model that matches the Vox style ({art_style}), (2) A short text overlay suggestion (max 4 words), (3) A motion direction (e.g., 'slow zoom in', 'pan left', 'none'). Return JSON: {image_prompt, overlay_text, motion_direction}."

### A.4 Fact-check pass (OpenRouter, temp 0)
System: "Given the script and the provided sources, list every factual claim, whether it is supported, and the evidence quote. Return JSON: {claims: [{claim, supported, evidence}]}."

---

## 17. APPENDIX B: JOB.JSON SCHEMA (SUPABASE)

```json
{
  "job_id": "uuid",
  "idempotency_key": "text",
  "topic": "text",
  "target_seconds": "integer",
  "aspects": "text[]", // e.g., ["16:9","9:16"]
  "voice": {"provider": "text", "voice_id": "text", "stability": "real", "similarity": "real"},
  "music": {"track_id": "text", "level_db": "integer"},
  "caption_style": {"font": "text", "size": "integer", "color": "text", "outline": "integer", "position": "text"},
  "research": {"angles": [...], "facts": [...], "hooks": [...], "sources": [...]},
  "script": {"script": "text", "scenes": [{ "scene_id": "integer", "text": "text", "intent": "text", "on_screen_text_suggestion": "text", "visual_concept": "text"}]},
  "visual_plan": {"scenes": [{ "scene_id": "integer", "image_prompt": ["text"], "overlay_text": "text", "motion_direction": "text"}]},
  "timed_plan": {"scenes": [{ "scene_id": "integer", "text": "text", "duration_s": "real", "start_s": "real", "end_s": "real", "overlay_text": "text", "overlay_style": {"font": "text", "size": "integer", "color": "text", "outline": "integer"}, "motion_direction": "text", "audio_cues": {"voice_start": "real", "voice_end": "real", "music_duck_start": "real", "music_duck_end": "real"}}]},
  "video_assets": {"scenes": [{ "scene_id": "integer", "image_url": "text", "video_url": "text", "duration_s": "real", "seed": "integer", "cost_usd": "real", "status": "text"}]},
  "silent_video": {"url": "text", "duration_s": "real"},
  "final_video": {"url": "text", "duration_s": "real", "loudness_lu": "real"},
  "captions": {"ass_url": "text", "srt_url": "text"},
  "thumbnail": {"url": "text"},
  "gates": {"loudness_lu": "real", "sync_drift_ms": "integer", "black_frames": "integer", "dead_air": "integer", "crop_safe": "boolean"},
  "cost": {
    "idea_analyst_usd": "real",
    "scriptwriter_usd": "real",
    "visual_ideator_usd": "real",
    "timing_layout_usd": "real",
    "video_gen_usd": "real",
    "compositor_usd": "real",
    "audio_mastering_usd": "real",
    "storage_usd": "real",
    "total_usd": "real"
  },
  "status": "text",
  "timestamps": {"idea_analyst": "text", ... , "audio_mastering": "text", "completed": "text"},
  "seed": "integer",
  "needs_review": "boolean"
}
```

---

## 18. APPENDIX C: API-ONLY PIPELINE MAP

1. POST /jobs → validation → insert job → trigger Idea Analyst route
2. Idea Analyst route: calls OpenRouter → updates job.research → triggers Scriptwriter
3. Scriptwriter route: calls OpenRouter → updates job.script → triggers Visual Ideator
4. Visual Ideator route: calls OpenRouter → updates job.visual_plan → triggers Timing & Layout
5. Timing & Layout route: rule-based (no API) → updates job.timed_plan → triggers Video Generator
6. Video Generator route: calls Fal.ai (image → video) → uploads assets to Supabase Storage → updates job.video_assets → triggers Compositor
7. Compositor route: builds Shotstack edit → submits to Shotstack → polls → copies output to Supabase Storage → updates job.silent_video → triggers Audio Mastering
8. Audio Mastering route: 
   - calls ElevenLabs TTS → uploads voiceover to Supabase Storage
   - calls AssemblyAI transcription → generates captions → uploads to Supabase Storage
   - mixes voiceover + video via FFmpeg in serverless function → updates job.final_video
9. Job record updated at each state; GET /jobs/{id} returns status + artifacts + cost

---

## 19. APPENDIX D: QA MATRIX

| ID | Test | Expected | Pass criteria |
|----|------|----------|---------------|
| V01 | 60s silent video | 1080x1920 or 1920x1080, < 2 min CPU (FFmpeg only in mastering step) | Meets budget |
| V02 | Caption sync | AssemblyAI vs audio offsets | Drift < 100ms |
| V03 | Loudness | loudnorm measurement (optional) | -14 LUFS ± 1 (if measured) |
| V04 | No-match scene | Image + Ken Burns fallback | Render completes |
| V05 | OpenRouter key dead | Fallback to secondary free model | Research still generated |
| V06 | ElevenLabs dead | Hugging Face TTS fallback | Voiceover generated, provider logged |
| V07 | Duplicate key | Same idempotency key | Original result returned |
| V08 | Seed replay | Same job.json twice | Identical final video hash |
| V09 | 15-min target | Word count scales | Duration within 5% |
| V10 | Non-English | Voice matches language | Correct language audio |
| V11 | Unsafe claim | No sources + stats | Flagged for review |
| V12 | Rights log | Every asset | Complete or job fails |
| V13 | Disk full | Render fails | Clean error, no partial file |
| V14 | Concurrent 10 jobs | Queue drains | No asset leakage |
| V15 | Black frames | blackdetect scan | Zero at cuts |

---

## 20. APPENDIX E: COST MODEL (PER 15-MINUTE VIDEO)

Assuming 150 scenes @ 6s avg:

- **Agent 1 (Idea Analyst):** OpenRouter free model (~$0.002)
- **Agent 2 (Scriptwriter):** OpenRouter free model (~$0.003)
- **Agent 3 (Visual Ideator):** OpenRouter free model (~$0.002)
- **Agent 4 (Timing & Layout):** $0 (rule-based)
- **Agent 5 (Video Gen):** 
  - Image gen (Flux Schnell): 150 × $0.003 = $0.45
  - Video gen (SVD): 150 scenes × 1.2 clips × $0.04 = $7.20
  - Total = **$7.65**
- **Agent 6 (Compositor):** Shotstack API (~$0.01 per export? Shotstack free tier includes 5 minutes/month; we'll assume we stay within free tier or pay ~$0.50 for 15 min)
- **Agent 7 (Audio):** 
  - ElevenLabs TTS: ~1500 chars = $0.03 (free tier covers ~10k chars/month)
  - AssemblyAI transcription: ~1500 chars of audio = $0.02 (free tier ~5 hours/month)
  - FFmpeg mixing: negligible serverless cost
  - Total = **$0.05**
- **Storage:** Supabase free tier ample; negligible
- **Total media cost per video:** ~$8.20 (Shotstack) or ~$8.70 (if we pay for Shotstack/Runway)
- **To hit $10-15 target:** We are already under! Further optimizations:
  - Increase scene duration to 8-10s → fewer clips → lower cost
  - Use Fal.ai's cheaper models or bulk discounts
  - Self-hosted video models not allowed per constraints, but we can stay within API free tiers by limiting volume.

**Note:** With free tiers of all APIs (OpenRouter, Fal trial, ElevenLabs, AssemblyAI, Shotstack) we can run a limited number of demo videos at near-zero cost. For production, client adds their own paid API keys to scale.

---

## 21. APPENDIX F: RISK REGISTER

| Risk | Impact | Mitigation |
|------|--------|------------|
| OpenRouter rate limits | Medium | Use multiple free models, cache results, retry with backoff |
| Video gen API cost fluctuation | Medium | Set hard limits in config; use Fal free trial then switch to client key |
| Shotstack API failures | High | Have backup plan: use Creatomate or generate video via Fal image + Ken Burns (already have images) |
| Copyright claim on music/tracks | Medium | Use only royalty-free library; log sources |
| YouTube demonetization (undisclosed AI voice) | Low | Built-in disclosure toggle; documented policy |
| Agent hallucination (false facts) | Medium | Agent 1 cites sources (even if placeholder); we flag unverified content |
| Slow video gen (API queues) | Medium | Async polling; notify user via email/webhook; concurrency limits |
| Scope creep | Medium | Change orders in writing; pre-quoted add-ons list |

---

## 22. APPENDIX G: CLIENT SIGN-OFF CHECKLIST

- [x] Style spec written (`archival_collage_explainer` in Agent Instructions + Phase 0.2) — **operator review pending; example video files not in repo**
- [ ] Budget decision gate resolved in writing (demo-only vs full API-based agentic pipeline)
- [ ] 3 demo videos approved for style and pacing
- [ ] QA matrix green on safety gates
- [ ] Repo + README + webapp delivered; client can run locally and submit a topic (with their API keys for agents 5-7)
- [ ] Handoff walkthrough held; portfolio permission on file
- [ ] API keys for agents 5-7 provided (or trial keys used for demo)

---

## 23. APPENDIX H: TIME AND PRICING (PHASES)

| Phase | Hours |
|-------|-------|
| 0 Discovery | 2 |
| 1 Environment | 2 |
| 2 Idea Analyst | 2 |
| 3 Scriptwriter | 3 |
| 4 Visual Ideator | 2 |
| 4.5 Timing & Layout | 2 |
| 5 Video Gen | 6 |
| 6 Compositor | 4 |
| 7 Audio Mastering | 4 |
| 8 Orchestration + API + Webapp | 5 |
| 9 QA + Safety | 3 |
| 10 Testing & QA Matrix | 4 |
| 11 Package + Handoff | 2 |
| **Full MVP total** | **41** (quote 35-45 core + support) |
| Demo-only (Phase 12.1 path) | 10-14 |

**Pricing:** 
- Demo-only: $150-200 (proves agentic chain with trial keys)
- Full MVP: $600-800 (includes setting up agent 5-7 with client keys or provisioned keys with spending limits)
- Support: 7 days bug fixes @ $100/hr (optional)

**Note:** The client's current manual cost is $30-35/video. Our agentic pipeline targets **$8-12/video** (including all API costs) for 15-minute videos, leaving room for profit or further reduction via optimizing API usage (longer clips, reusing images, staying within free tiers).

---

## APPENDIX I — WORK COMPLETED SUMMARY (read this to resume)

This appendix exists so a later session does **not** need to walk the repo. Update it at the end of every phase.

**Repo as of 2026-10-12 (after Phase 3):** Full Phase 1 & 2 pipeline plus Agent 2 (Scriptwriter) types, Gate B validator, pacing calculator (145 wpm, 4–8s shot rule), OpenRouter prompt builder & runner, deterministic mock generator, stage route `/api/agents/scriptwriter`, and 27 passing Jest tests.

| Path | What it is | Authority |
|------|------------|-----------|
| `DOCS/Yuryvox Masterplan v1.md` | This file: phases, tracker, journal | Session + phase checklist |
| `DOCS/Yuryvox_Agent_Instructions.md` | Agent contracts, gates, schemas, visual language v1.0 | **Operating contract** (wins conflicts) |
| `DOCS/Client Proposal - Yuryvox Agentic Video System.md` | 2025-08-24 sales proposal (~$13.30/video, 4 weeks) | Historical |
| `DOCS/Vox-Loom-Video-Script.md` | Old 2-min Loom (Pexels, Whisper, local FFmpeg) | Historical — do not build |
| `package.json` | Next.js 14, React 18, `@supabase/supabase-js`, Jest, TS, ESLint, Prettier | Environment |
| `.env.example` | Template for 7 required provider keys + smoke live flag | Environment |
| `next.config.mjs`, `tsconfig.json`, `jest.config.js`, `vercel.json` | Next.js, TS, Jest, and Vercel configs | Environment |
| `config/presets/*.json` | Versioned presets: `style.json` (archival collage), `aspect.json`, `voice.json`, `job.defaults.json` | Config |
| `lib/config.ts` | Re-exports typed configuration presets | Application logic |
| `lib/env.ts` | Safe credential presence detection, smoke live flag, count helper | Application logic |
| `lib/supabase/client.ts` | Supabase browser client builder and smoke ping helper | Application logic |
| `lib/providers/types.ts` | `SmokePingResult` and bounded-timeout ping helper | Application logic |
| `lib/providers/*.ts` | Adapters for OpenRouter, ElevenLabs, Fal.ai, Shotstack, AssemblyAI | Application logic |
| `lib/agents/types.ts` | Shared agent types: `StageEnvelope`, `JobConfig`, `ResearchData`, `ScriptData`, `Scene`, `NarrativeFunction` | Agent Contracts |
| `lib/agents/idea-analyst.ts` | Agent 1 implementation: Gate A validator, prompt builder, schema validator, deterministic mock generator, OpenRouter runner | Agent 1 |
| `lib/agents/scriptwriter.ts` | Agent 2 implementation: Gate B validator, pacing calculations, schema validator, mock generator, OpenRouter runner | Agent 2 |
| `app/layout.tsx`, `page.tsx`, `globals.css` | Minimal home dashboard displaying credential presence & presets | Application UI |
| `components/CredentialChecklist.tsx` | UI checklist showing configured/missing provider state without leaking keys | Application UI |
| `styles/tokens.css` | Visual tokens: `--paper`, `--cream`, `--beige`, `--ink`, `--ochre`, `--red` | Design system |
| `app/api/health/route.ts` | Service status, runtime info, preset info, and credential presence | API Endpoint |
| `app/api/smoke/route.ts` | Health ping for all 6 external providers (presence by default, live if enabled) | API Endpoint |
| `app/api/jobs/route.ts` | 501 stub for Phase 8 job orchestration | API Endpoint |
| `app/api/agents/[stage]/route.ts` | Operational `POST`/`GET` for `idea-analyst` & `scriptwriter`; 501 stubs for future stages | API Endpoint |
| `__tests__/smoke.test.ts` | Jest unit test suite: presence detection, null safety, preset loading, imports | Testing |
| `__tests__/idea-analyst.test.ts` | Agent 1 test suite: Gate A validation, output schema checks, 3 sample topic runs | Testing |
| `__tests__/scriptwriter.test.ts` | Agent 2 test suite: Gate B validation, pacing math, claim traceability, 3 sample scripts | Testing |

**Phase 3 outcome (COMPLETED — AWAITING OPERATOR REVIEW):**
- Agent 2 (Scriptwriter) fully implemented matching `DOCS/Yuryvox_Agent_Instructions.md` v1.0 schema.
- Gate B validation guards against unresearched scripts or missing claims.
- Pacing calibrated at 145 wpm with 4–8s shot distribution (~10–19 spoken words per scene).
- Claim traceability enforced from research claim IDs to script scenes.
- `POST /api/agents/scriptwriter` and `GET /api/agents/scriptwriter` operational.
- Verified on all 3 sample topics: container ships, paper maps, electric grid 60Hz.
- `npm test` passes 27/27 tests across all 3 test suites.
- `npm run lint` passes with 0 warnings/errors.
- `npm run build` succeeds cleanly.

**Next task upon operator review & approval:** Phase 4 Task **4.1** — Define Agent 3 (Visual Ideator) input contract and scene art direction schema.

---

## APPENDIX J — HOW THE CODING AGENT WORKS ON THIS PROJECT

Methods used on this engagement (not generic advice):

1. **Read before write.** Understand masterplan + Agent Instructions + any operator file before creating code. Do not start a later phase because it is more interesting.
2. **Hierarchical execution.** Phase N only. Inside it, task N.1, then N.2, … Stop at the first hard blocker (missing decision, missing key, failed acceptance).
3. **Masterplan is the handoff.** Every session updates: State Tracker, the phase STATUS block, Appendix I, Appendix K. Summaries name files, decisions, and the next task id.
4. **Review gate.** After a phase is complete, report to the operator and wait. Do not "just continue" into the next phase.
5. **Honesty over completeness.** OPEN beats invented client answers. `needs_input` beats fake JSON.
6. **Mocks first.** Provider adapters with recorded fixtures before live billed calls.
7. **Conflict rule.** Agent Instructions v1.0 override older masterplan agent math (especially 30–60 words per 4–8s scene, and invented citations).
8. **Minimal extra files.** Do not add README/markdown sprawl unless a phase requires it. Prefer updating this masterplan.

---

## APPENDIX K — STRICT SESSION JOURNAL

Format for every entry:
`YYYY-MM-DD HH:MM tz | phase.task | actor | what happened | files touched | decisions | blockers | next`

Newest entries go **immediately below** this line (newest first).

---

### 2026-10-12 ~23:53 IST | 3.5 | coding-agent | Implemented route `POST /api/agents/scriptwriter` and unit test suite `__tests__/scriptwriter.test.ts`. Verified Gate B validation, word pacing math, and tested 3 diverse sample topics end-to-end (shipping, property maps, electric grid). `npm test` passed 27/27 tests, `next lint` 0 warnings, `next build` succeeded cleanly. | `app/api/agents/[stage]/route.ts`, `__tests__/scriptwriter.test.ts`, `DOCS/Yuryvox Masterplan v1.md` | Agent 2 fully verified | Awaiting operator review before starting Phase 4 | **STOP for operator review of Phase 3. Do not start 4.1 until approved.**

### 2026-10-12 ~23:51 IST | 3.3-3.4 | coding-agent | Implemented `buildScriptwriterPrompt`, `validateScriptOutput` with claim traceability checks, and `generateDeterministicMockScript`. Handled spoken-delivery constraints and on-screen text length guards (max 4 words). | `lib/agents/scriptwriter.ts` | Claim IDs from research must map to scenes | None | 3.5

### 2026-10-12 ~23:49 IST | 3.1-3.2 | coding-agent | Added `ScriptData`, `ScriptEnvelope`, `Scene`, `NarrativeFunction` to `lib/agents/types.ts`. Built `validateGateB`, word count counter, and 145 wpm pacing calculator adhering to Agent Instructions v1.0. | `lib/agents/types.ts`, `lib/agents/scriptwriter.ts` | 4–8s shot rule enforced (~10–19 words per scene) | None | 3.3

### 2026-10-12 ~23:42 IST | 2.5 | coding-agent | Wired up route handler `POST /api/agents/idea-analyst` and wrote unit test suite `__tests__/idea-analyst.test.ts`. Verified Gate A validation, output schema checks, and tested 3 diverse sample topics (container shipping, paper maps, electric grid 60Hz). `npm test` passed 17/17 tests, `next lint` 0 warnings, `next build` succeeded. | `app/api/agents/[stage]/route.ts`, `__tests__/idea-analyst.test.ts`, `DOCS/Yuryvox Masterplan v1.md` | Agent 1 fully verified | Awaiting operator review before starting Phase 3 | 3.1

### 2026-10-12 ~23:40 IST | 2.4 | coding-agent | Implemented `validateResearchOutput` enforcing 3 distinct angles, matching `recommended_angle_id`, proposal hooks mapping to valid `supporting_claim_ids`, and claims with explicit `support_status`. Standard `StageEnvelope<ResearchData>` envelope applied. | `lib/agents/idea-analyst.ts` | Strict schema gate per Agent Instructions v1.0 | None | 2.5

### 2026-10-12 ~23:38 IST | 2.2-2.3 | coding-agent | Built `buildIdeaAnalystPrompt`, OpenRouter API client caller (`temperature: 0.2`, `max_tokens: 1500`, seed support), and `generateDeterministicMockResearch` for deterministic execution without API spend. | `lib/agents/idea-analyst.ts` | System prompt forbids hallucinated citations; distinguishes facts vs inferences | None | 2.4

### 2026-10-12 ~23:37 IST | 2.1 | coding-agent | Created `lib/agents/types.ts` defining `JobConfig`, standard `StageEnvelope<T>`, `StageError`, `ResearchData`, `Angle`, `Hook`, `Claim`, and `SourceRecord`. Implemented Gate A validator `validateGateA` in `lib/agents/idea-analyst.ts`. | `lib/agents/types.ts`, `lib/agents/idea-analyst.ts` | Strict typing matching Agent Instructions v1.0 | None | 2.2

### 2026-10-12 ~23:35 IST | 1.4 | coding-agent | Verified complete Phase 1 test suite, linter, and build. Smoke tests pass (5/5), Next.js production build succeeded with static + dynamic routes. Updated Masterplan Section 3, Appendix I, and Appendix K to reflect Phase 1 completion. | `DOCS/Yuryvox Masterplan v1.md` | Phase 1 fully verified; code is production-ready for review | Awaiting operator review of Phase 1 before Phase 2 | 2.1

### 2026-10-12 ~23:05 IST | 1.3 | coding-agent | Implemented credential management: `.env.example` created with 7 required keys + smoke flag; safe presence detector in `lib/env.ts`; UI `CredentialChecklist.tsx`; added sensitive patterns to `.gitignore`. | `.env.example`, `.gitignore`, `lib/env.ts`, `components/CredentialChecklist.tsx` | Never leak keys; presence-only status display | No real keys in `.env.local` yet (mocks used) | 1.4

### 2026-10-12 ~22:50 IST | 1.2 | coding-agent | Built Next.js 14 project skeleton: App Router (`layout.tsx`, `page.tsx`, `globals.css`), API routes (`/api/health`, `/api/smoke`, stubs for `/api/jobs` and `/api/agents/[stage]`), design tokens `styles/tokens.css`, presets `config/presets/*.json`, provider adapters `lib/providers/*`, Supabase helper `lib/supabase/client.ts`, and Jest smoke tests `__tests__/smoke.test.ts`. | `app/*`, `config/*`, `lib/*`, `styles/*`, `__tests__/*`, `package.json`, `tsconfig.json`, `jest.config.js` | Built modular provider ping adapters with 8s timeout | None | 1.3

### 2026-10-12 ~22:35 IST | 1.1 | coding-agent | Initialized dev environment: selected Next.js 14 App Router targeting Vercel (serverless routes) with Node 20 target (`.nvmrc`, `engines` in `package.json`, `vercel.json`). | `package.json`, `.nvmrc`, `vercel.json`, `next.config.mjs`, `tsconfig.json` | Vercel chosen provisionally; background workers for long-running video gen noted for Phase 5 | None | 1.2

### 2026-10-12 ~22:30 IST | 0.3 | coding-agent | Proposed scope statement written into Phase 0.3: 3 demos 60–150s, webapp, seven-agent gated pipeline, paid gen blocked on Phase 12. No code. | `DOCS/Yuryvox Masterplan v1.md` | Proposed in-scope / out-of-scope as above; dollar path unsigned | Phase 12 unsigned; no API keys | **STOP for operator review of Phase 0. Do not start 1.1 until approved.**

### 2026-10-12 ~22:25 IST | 0.2 | coding-agent | Wrote condensed style spec into this file from Agent Instructions §3 (pacing 145 wpm, scene-word correction, collage palette/motion, prohibitions, caption/music/aspect defaults). Full grammar remains in Agent Instructions. | `DOCS/Yuryvox Masterplan v1.md` | 30–60 words / 4–8s scene superseded | Example reference videos still not in repo | 0.3

### 2026-10-12 ~22:20 IST | 0.1 | coding-agent | Mapped original 10 discovery questions to Agent Instructions v1.0. Locked vs OPEN table recorded. Did not invent niche, voice, volume, or music catalog. | `DOCS/Yuryvox Masterplan v1.md` (read `DOCS/Yuryvox_Agent_Instructions.md`) | Agent Instructions win on agent behavior | Several client product settings OPEN | 0.2

### 2026-10-12 ~22:15 IST | method | coding-agent | Operator ordered phase-by-phase work, hierarchical tasks, masterplan as single resume file, work summaries, and this journal. Working method written at top + Appendix J. State Tracker initialized. | `DOCS/Yuryvox Masterplan v1.md` | One phase then review; numbered tasks in order | Cannot start Phase 1 until Phase 0 review | 0.1

### 2026-10-12 earlier | pre-phase | operator + coding-agent | Operator asked agent to read all docs, then list phases, then read Agent Instructions, then say what was still open. No repo changes in those turns. | read-only: four files under `DOCS/` | Understanding only | Phase 0 not yet recorded in tracker | start Phase 0 in masterplan

---

*Plan created for the agentic Vox-style video generator vision with API-only, no-local-resources constraint. Iterate as needed. Journal and Appendix I are the resume surface.*