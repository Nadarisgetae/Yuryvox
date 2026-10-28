# Yuryvox — Full Phase Completion Audit & Bug Report

**Generated:** October 2026  
**Document Version:** 1.0  
**Scope:** Complete line-by-line inspection of all files, folders, tests, and configurations against [Yuryvox Masterplan v1.md](file:///c:/Upwork/Yuryvox/DOCS/Yuryvox%20Masterplan%20v1.md) and [Yuryvox_Agent_Instructions.md](file:///c:/Upwork/Yuryvox/DOCS/Yuryvox_Agent_Instructions.md) (v1.0).

---

## 1. Executive Summary & Verification Matrix

The Yuryvox codebase has completed the core architectural development through **Phase 8.3** (all 7 agents, pipeline orchestrator, dual persistence layer, REST endpoints, and Next.js 14 Webapp UI). The project compiles cleanly and passes all automated test suites in **Mock-First (Zero-Spend) Mode**.

However, deep code traversal revealed **several critical bugs and disconnects** where live API execution paths were left stubbed, variables were improperly mapped between stages, and mock URLs were hardcoded into live flows.

### Build & Verification Matrix

| Verification Check | Target Standard | Current Status | Notes |
| :--- | :--- | :--- | :--- |
| **Jest Test Suite** | 100% Pass | **154 / 154 PASS** | 13 test suites passing in `__tests__/` |
| **ESLint / Next Lint** | 0 warnings, 0 errors | **0 Errors / 0 Warnings** | Conforms to Next.js core web vitals |
| **Next.js Production Build** | Static & Dynamic compile | **Clean Compilation** | All App Router routes compile successfully |
| **External Credentials** | 7 required keys | **0 / 7 configured** | `.env.local` contains empty template; mock active |
| **Live API Endpoints** | Stages 1–7 callable | **Functional in Mock** | Live calls blocked or faulty in Agents 5–7 |
| **Storage Persistence** | Durable DB + Object Bucket | **Dual Driver Ready** | In-memory active; Supabase schema prepared |

---

## 2. Complete Phase-by-Phase Completion Audit (Phases 0–12)

```
[Phase 0: Spec] ────► [Phase 1: Env] ────► [Phases 2-4.5: Agents 1-4] ────► [Phase 8.1-8.2: Orchestrator/API]
      DONE                  DONE                     DONE                               DONE
                                                                                          │
[Phase 12: Scope] ◄── [Phase 11: Demos] ◄── [Phases 9-10: QA/Tests] ◄── [Phases 5-7: Media Gen] ◄───┘
   UNRESOLVED           0/3 SHIPPED             PARTIAL                   MOCK-ONLY (BUGS)
```

### Phase 0: Discovery and Definition
* **Status:** **COMPLETED** (Approved with working defaults)
* **What is Done:**
  - Locked visual style: `archival_collage_explainer` (aged paper textures, researcher's desk arrangement, maps, cut-outs, selective red emphasis, high-contrast compositor text).
  - Pacing locked: **145 words per minute** standard.
  - Scene length locked: **4–8 seconds per shot** (~10–19 spoken words per scene; supersedes old 30–60 word draft flaw).
  - Human approval gate locked: `script_and_visual_plan_before_paid_generation`.
* **What is Open / Missing:**
  - Physical example reference video files were never committed to the repo (marked OPEN in Masterplan Task 0.1).
  - Target channel niche and specific voice actor ID remain placeholders.

---

### Phase 1: Environment and Credentials
* **Status:** **COMPLETED**
* **What is Done:**
  - Next.js 14 App Router project skeleton initialized targeting Node 20 and Vercel serverless.
  - Configuration presets established in `config/presets/*.json` (`style.json`, `aspect.json`, `voice.json`, `job.defaults.json`).
  - Safe credential presence detection implemented in [lib/env.ts](file:///c:/Upwork/Yuryvox/lib/env.ts) without exposing secrets.
  - Smoke ping routes created at `/api/health` and `/api/smoke`.
  - Smoke tests verified in [__tests__/smoke.test.ts](file:///c:/Upwork/Yuryvox/__tests__/smoke.test.ts).

---

### Phase 2: Agent 1 – Idea Analyst
* **Status:** **COMPLETED**
* **What is Done:**
  - TypeScript contracts defined for `JobConfig`, `ResearchData`, `Angle`, `Hook`, `Claim`, and `SourceRecord` in [lib/agents/types.ts](file:///c:/Upwork/Yuryvox/lib/agents/types.ts).
  - Gate A validation implemented in [lib/agents/idea-analyst.ts](file:///c:/Upwork/Yuryvox/lib/agents/idea-analyst.ts#L14-L69) checking topic, duration, aspect, and budget.
  - OpenRouter prompt builder enforcing strict JSON envelopes, distinguishing facts vs inference, and forbidding fabricated citations.
  - Deterministic mock generator `generateDeterministicMockResearch` producing 3 angles and structured claims.
  - 17 unit tests passing in [__tests__/idea-analyst.test.ts](file:///c:/Upwork/Yuryvox/__tests__/idea-analyst.test.ts).
* **Limitations / Open Items:**
  - Real-time search/browsing is not connected; claims rely on pre-trained model knowledge with `support_status` flags.

---

### Phase 3: Agent 2 – Scriptwriter
* **Status:** **COMPLETED**
* **What is Done:**
  - Gate B validator implemented in [lib/agents/scriptwriter.ts](file:///c:/Upwork/Yuryvox/lib/agents/scriptwriter.ts#L15-L67) enforcing claim mapping and research validation.
  - 145 WPM pacing calibration engine (`target_words = round(target_seconds * 145 / 60)`).
  - 4–8s shot length enforcer (~10–19 words per scene).
  - Claim traceability checker flagging any scene claims not present in research brief.
  - Deterministic mock script generator producing full explainer scripts across varied topics.
  - 27 unit tests passing in [__tests__/scriptwriter.test.ts](file:///c:/Upwork/Yuryvox/__tests__/scriptwriter.test.ts).

---

### Phase 4: Agent 3 – Visual Ideator
* **Status:** **COMPLETED**
* **What is Done:**
  - Gate C validator implemented in [lib/agents/visual-ideator.ts](file:///c:/Upwork/Yuryvox/lib/agents/visual-ideator.ts#L52-L100).
  - Archival collage art direction engine mapping scene narrative functions to visual types (`archival_collage`, `map`, `timeline`, `diagram`, `chart`).
  - OpenRouter prompt builder generating image prompts, video motion prompts, overlay text suggestions (max 4 words), and transition intents.
  - Deterministic mock generator producing comprehensive visual plans.
  - 11 unit tests passing in [__tests__/visual-ideator.test.ts](file:///c:/Upwork/Yuryvox/__tests__/visual-ideator.test.ts).

---

### Phase 4.5: Agent 4 – Timing & Layout Agent
* **Status:** **COMPLETED**
* **What is Done:**
  - Zero-API-cost rule-based math engine in [lib/agents/timing-layout.ts](file:///c:/Upwork/Yuryvox/lib/agents/timing-layout.ts).
  - Gate D validator checking arithmetic integrity, scene sequence, and safe margins.
  - Duration distribution with 3–12s scene clamping and 10% hook scene duration bonus.
  - Text overlay safe zone calculator (bottom third, 5–10% margin, reading speed validation).
  - Audio cue markers for voiceover start/end and music ducking (-18 dB).
  - 14 unit tests passing in [__tests__/timing-layout.test.ts](file:///c:/Upwork/Yuryvox/__tests__/timing-layout.test.ts).

---

### Phase 5: Agent 5 – Video Generator
* **Status:** **COMPLETED (Mock Mode Only)**
* **What is Done:**
  - Gate E validator in [lib/agents/video-generator.ts](file:///c:/Upwork/Yuryvox/lib/agents/video-generator.ts#L41-L69).
  - Fal.ai Flux Schnell payload generator for keyframe image generation.
  - Fal.ai Stable Video Diffusion (SVD) payload generator for short video clips.
  - Ken Burns still-image fallback logic for static scenes.
  - Per-scene and total estimated generation cost calculator.
  - 11 unit tests passing in [__tests__/video-generator.test.ts](file:///c:/Upwork/Yuryvox/__tests__/video-generator.test.ts).
* **Faults & Incomplete Work:**
  - **Critical prompt disconnect:** Agent 5 discards Agent 3's rich image prompts (see Bug 1).
  - Live API calls untested with real funds (pending Phase 12).

---

### Phase 6: Agent 6 – Compositor & Transition Agent
* **Status:** **COMPLETED (Mock Mode Only)**
* **What is Done:**
  - Gate F validator in [lib/agents/compositor.ts](file:///c:/Upwork/Yuryvox/lib/agents/compositor.ts#L103-L150).
  - Programmatic Shotstack edit JSON builder (`buildShotstackEdit`) structuring tracks, video clips, Ken Burns zoom effects, crossfade transitions, typography overlays, and background soundtrack.
  - Shotstack render polling loop with exponential wait.
  - 12 unit tests passing in [__tests__/compositor.test.ts](file:///c:/Upwork/Yuryvox/__tests__/compositor.test.ts).
* **Faults & Incomplete Work:**
  - **Critical output URL discard:** Shotstack's real output URL is overwritten with a mock string (see Bug 2).

---

### Phase 7: Agent 7 – Audio Mastering Agent
* **Status:** **COMPLETED (Mock Mode Only)**
* **What is Done:**
  - Gate G validator in [lib/agents/audio-mastering.ts](file:///c:/Upwork/Yuryvox/lib/agents/audio-mastering.ts#L34-L57).
  - ElevenLabs text-to-speech helper caller.
  - AssemblyAI audio upload and transcription polling helpers.
  - Sentence and phrase-level caption chunker generating `.srt` and `.ass` subtitles.
  - 16 unit tests passing in [__tests__/audio-mastering.test.ts](file:///c:/Upwork/Yuryvox/__tests__/audio-mastering.test.ts).
* **Faults & Incomplete Work:**
  - **Live execution stubbed:** The live execution path in `runAudioMastering` was left unimplemented (see Bug 3).

---

### Phase 8: Orchestration, Queue, API, and Webapp UI
* **Status:** **COMPLETED**
* **What is Done:**
  - **8.1 Backend Pipeline Orchestrator:** [lib/pipeline/orchestrator.ts](file:///c:/Upwork/Yuryvox/lib/pipeline/orchestrator.ts) implements the 7-stage state machine, Gate A–G checks, pause at human approval (`awaiting_approval`), and step progression (`determineNextStage`, `runNextStage`).
  - **8.1 Persistence Layer:** [lib/pipeline/storage.ts](file:///c:/Upwork/Yuryvox/lib/pipeline/storage.ts) provides dual storage (Supabase PostgreSQL + in-memory Map fallback). Database DDL script finalized in [DOCS/supabase_schema.sql](file:///c:/Upwork/Yuryvox/DOCS/supabase_schema.sql).
  - **8.2 API Routes:**
    - `POST /api/jobs`: Creates job, supports synchronous, background (`background: true`), and auto-run options.
    - `GET /api/jobs`: Lists jobs sorted newest-first with `?limit=` support.
    - `GET /api/jobs/[id]`: Returns job state, envelopes, cost telemetry, and timestamps.
    - `POST /api/jobs/[id]`: Handles actions `approve`, `resume`, `retry`, and `redo` (with automatic downstream cache invalidation).
    - `DELETE /api/jobs/[id]`: Deletes job record and storage assets.
    - `GET /api/jobs/[id]/step`: Inspects next pending stage and approval requirements.
    - `POST /api/jobs/[id]/step`: Executes only the single next pending stage (serverless-friendly).
    - `POST /api/jobs/seed`: Seeds 3 demo jobs (90s standard, 3min featurette, 5min deep dive).
  - **8.3 Webapp UI:**
    - [app/page.tsx](file:///c:/Upwork/Yuryvox/app/page.tsx): Archival Studio with duration slider supported up to 20 minutes (1200s), presets, aspect ratio cards, and governance toggles.
    - [app/jobs/page.tsx](file:///c:/Upwork/Yuryvox/app/jobs/page.tsx): Jobs Dashboard with status filters, deletion, and demo seeding button.
    - [app/jobs/[id]/page.tsx](file:///c:/Upwork/Yuryvox/app/jobs/%5Bid%5D/page.tsx): 7-stage horizontal stepper, approval action banner, 8 inspector tabs, dynamic header `↻ Redo Stage N` button, per-stage redo controls, and HTML5 video player.

---

### Phase 9: Quality, Safety and Legal
* **Status:** **PARTIALLY DONE (Simulated / Unit Gates Only)**
* **What is Done:**
  - Pre-flight Gate A–G unit validation verified in [__tests__/qa-gates.test.ts](file:///c:/Upwork/Yuryvox/__tests__/qa-gates.test.ts).
* **What is Left / Missing:**
  - Real FFmpeg `blackdetect` scan on scene boundaries.
  - Real FFmpeg `silencedetect` for dead air > 0.8s.
  - Real `loudnorm` audio measurement (currently hardcoded as -14 LUFS in mock output).
  - YouTube synthetic-content disclosure tag injected into MP4 file metadata.
  - Voice cloning authorization document upload field.

---

### Phase 10: Testing and QA Matrix
* **Status:** **PARTIALLY DONE**
* **What is Done:**
  - Unit tests covering all agents, pipeline state transitions, routes, and storage (153 tests).
* **What is Left / Missing:**
  - Real end-to-end runs with live API keys (Appendix D tests V01–V15).
  - Failure injection tests (killed API keys, expired tokens, provider 500s).
  - Reproducibility test: verifying whether the same seed produces identical video output.
  - Concurrency test: 10 concurrent jobs running on hosted serverless infrastructure.

---

### Phase 11: Deliverable Package and Handoff
* **Status:** **IN PROGRESS (0 / 3 Sample Videos Shipped)**
* **What is Done:**
  - Clean local quickstart documentation in [README.md](file:///c:/Upwork/Yuryvox/README.md).
  - External API integration guide in [DOCS/Yuryvox_API_Requirements.md](file:///c:/Upwork/Yuryvox/DOCS/Yuryvox_API_Requirements.md).
  - Pre-loaded demonstration data in `/api/jobs/seed`.
* **What is Left / Missing:**
  - **3 Real Rendered MP4 Videos:** The repository currently has mock records; real exported videos on public URLs are not yet generated.
  - 90-second product walkthrough video (Loom).
  - Deployment to live Vercel / Render production domains.

---

### Phase 12: Budget Decision Gate
* **Status:** **OPEN / PENDING CLIENT DECISION**
* **What is Left:**
  - Written scope agreement between **Path A (Demo-only proof of concept)** and **Path B (Full MVP with production credentials)**.
  - Client-provisioned API keys for live rendering.

---

## 3. Traversed File & Folder Inventory

The project consists of **32 functional source and configuration files**:

| Directory / File | Lines | Bytes | Role / Functionality | Operational Status |
| :--- | :---: | :---: | :--- | :--- |
| `app/layout.tsx` | 40 | 1,387 | Global HTML layout, brand shell & navbar | Operational |
| `app/globals.css` | 185 | 5,137 | Core CSS tokens, fonts, and responsive grid | Operational |
| `app/page.tsx` | 566 | 20,990 | Topic creation Studio UI (20-min runtime support) | Operational |
| `app/jobs/page.tsx` | 437 | 13,878 | Jobs Dashboard UI (filtering, seed button, delete) | Operational |
| `app/jobs/[id]/page.tsx` | 1,083 | 43,552 | Stepper, approval banner, tabs & video player | **Bug 4 (Hardcoded mock)** |
| `app/api/health/route.ts` | 31 | 678 | Health check & credential status endpoint | Operational |
| `app/api/smoke/route.ts` | 44 | 1,089 | External provider ping endpoint | Operational |
| `app/api/jobs/route.ts` | 208 | 6,416 | Job creation, listing & pipeline execution | Operational |
| `app/api/jobs/[id]/route.ts` | 180 | 4,268 | Job state retrieval, action handling, and deletion | Operational |
| `app/api/jobs/[id]/step/route.ts` | 108 | 2,542 | Single-step execution endpoint for serverless | Operational |
| `app/api/jobs/seed/route.ts` | 74 | 2,555 | Seeds 3 showcase demonstration jobs | Operational |
| `app/api/agents/[stage]/route.ts` | 464 | 15,537 | Dynamic stage execution endpoint (stages 1-7) | Operational |
| `components/Navbar.tsx` | 62 | 1,754 | Top navigation bar with active path indicators | Operational |
| `components/CredentialChecklist.tsx`| 38 | 1,134 | Provider credential presence UI table | Operational |
| `config/presets/style.json` | 17 | 537 | Visual tokens, palette & motion grammar | Operational |
| `config/presets/aspect.json` | 16 | 238 | 16:9 and 9:16 resolutions and safe margins | Operational |
| `config/presets/voice.json` | 9 | 246 | Voice configuration presets | Operational |
| `config/presets/job.defaults.json` | 17 | 416 | Default job settings (90s, $15 budget cap) | Operational |
| `lib/config.ts` | 12 | 292 | Presets module export | Operational |
| `lib/env.ts` | 56 | 1,775 | Safe environment variable presence detector | Operational |
| `lib/supabase/client.ts` | 48 | 1,367 | Supabase client builders with fallback handling | Operational |
| `lib/agents/types.ts` | 345 | 7,754 | Strict TypeScript types & envelope schemas | Operational |
| `lib/agents/idea-analyst.ts` | 548 | 18,226 | Agent 1 implementation & Gate A validator | Operational |
| `lib/agents/scriptwriter.ts` | 666 | 22,604 | Agent 2 implementation & Gate B validator | Operational |
| `lib/agents/visual-ideator.ts` | 683 | 24,091 | Agent 3 implementation & Gate C validator | Operational |
| `lib/agents/timing-layout.ts` | 578 | 25,616 | Agent 4 implementation & Gate D validator | Operational |
| `lib/agents/video-generator.ts` | 469 | 17,082 | Agent 5 implementation & Gate E validator | **Bug 1 (Prompt loss)** |
| `lib/agents/compositor.ts` | 564 | 19,054 | Agent 6 implementation & Gate F validator | **Bug 2 (Output URL discard)** |
| `lib/agents/audio-mastering.ts` | 525 | 18,778 | Agent 7 implementation & Gate G validator | **Bug 3 (Live stubbed)** |
| `lib/pipeline/orchestrator.ts` | 680 | 24,767 | Pipeline state machine & stage sequencer | **Bug 5 (Mock captions)** |
| `lib/pipeline/storage.ts` | 232 | 6,323 | Dual persistence engine (Supabase + memory) | **Bug 6 (Ephemeral store)** |
| `DOCS/supabase_schema.sql` | 102 | 3,474 | PostgreSQL schema DDL & bucket setup | Operational |

---

## 4. Comprehensive Bug & Defect Register

During the line-by-line inspection, **9 bugs, disconnects, and logic errors** were identified.

---

### Bug 1 (CRITICAL): Agent 3 Visual Prompts Discarded by Agent 5
* **File:** [lib/agents/video-generator.ts](file:///c:/Upwork/Yuryvox/lib/agents/video-generator.ts#L390-L392)
* **Lines:** 390–392
* **Root Cause:**
  ```typescript
  // In lib/agents/video-generator.ts:
  const visualScene = timedPlan.scenes.find((s) => s.scene_id === scene.scene_id);
  const imagePrompt = visualScene?.overlay?.text || `Archival collage scene: ${scene.scene_id}`;
  const motionPrompt = visualScene?.motion?.direction || 'slow zoom in';
  ```
  `runVideoGenerator` takes `timedPlan`, but `timedPlan.scenes[].overlay.text` is only the **short 2–4 word title overlay** (e.g., `"First Glance"` or `"1950s Mandates"`).
  The detailed, multi-sentence archival collage prompt produced by Agent 3 (`visualPlan.scene_visuals[].image_prompt`) is **never passed to Agent 5**. In fact, `runVideoGenerator` does not even receive `visualPlan` in its arguments!
* **Impact:** In live generation, Fal.ai Flux Schnell receives `"First Glance"` as the prompt instead of the rich archival collage prompt. The resulting video completely loses the archival collage visual direction.
* **Remediation:**
  1. Update `runVideoGenerator` signature to accept `visualPlan: VisualPlanData`.
  2. In [lib/pipeline/orchestrator.ts:L444](file:///c:/Upwork/Yuryvox/lib/pipeline/orchestrator.ts#L444), pass `job.visual_plan!`.
  3. Map `imagePrompt` to `visualPlan.scene_visuals.find(v => v.scene_id === scene.scene_id)?.image_prompt`.

---

### Bug 2 (CRITICAL): Shotstack Render Output URL Discarded in Live Mode
* **File:** [lib/agents/compositor.ts](file:///c:/Upwork/Yuryvox/lib/agents/compositor.ts#L503-L519)
* **Lines:** 503–519
* **Root Cause:**
  ```typescript
  // Submit render & poll for outputUrl ...
  const statusResponse = await pollShotstackStatus(renderId, apiKey);
  const outputUrl = statusResponse.response?.url;
  if (!outputUrl) throw new Error('Shotstack render completed but no output URL');

  // But then:
  const [videoUpload, thumbnailUpload] = await Promise.all([
    mockUploadToSupabase(jobConfig.job_id, 'video'),
    mockUploadToSupabase(jobConfig.job_id, 'image'),
  ]);

  const data: SilentVideoData = {
    silent_video_url: videoUpload.publicUrl, // -> "https://mock-supabase.example.com/.../final.mp4"
    thumbnail_url: thumbnailUpload.publicUrl,
    ...
  };
  ```
* **Impact:** When a user pays for a Shotstack render, the API returns the actual hosted MP4 URL, but the code **discards it** and sets `silent_video_url` to a non-existent mock URL (`https://mock-supabase.example.com/...`). The real video is lost to the user.
* **Remediation:** Set `silent_video_url: outputUrl` directly, or upload the downloaded buffer from `outputUrl` to Supabase Storage if configured.

---

### Bug 3 (CRITICAL): Live Audio Mastering Stubbed Out in Runner
* **File:** [lib/agents/audio-mastering.ts](file:///c:/Upwork/Yuryvox/lib/agents/audio-mastering.ts#L504-L524)
* **Lines:** 504–524
* **Root Cause:**
  While the helper functions `callElevenLabsTTS`, `uploadToAssemblyAI`, and `requestAssemblyAITranscription` exist, the live execution branch in `runAudioMastering` contains:
  ```typescript
  // Real implementation would go here
  // For now, return mock since we don't have full script/voice config
  const finalVideo = generateDeterministicMockFinalVideo(jobConfig, silentVideo);
  const captions = generateDeterministicMockCaptions(jobConfig, silentVideo);
  const voiceover = generateDeterministicMockVoiceover(jobConfig, script);

  return {
    ...
    provider: 'mock_adapter',
    model: 'deterministic_fixture',
    data: finalVideo,
  };
  ```
* **Impact:** Even if `ELEVENLABS_API_KEY` and `ASSEMBLYAI_API_KEY` are configured and `forceMock: false` is passed, Agent 7 **always runs in mock mode**. Live voice generation and transcription can never execute.
* **Remediation:** Implement the live loop calling `callElevenLabsTTS` per scene, concatenating audio, uploading to AssemblyAI, and generating captions.

---

### Bug 4 (HIGH): Job Detail Page Hardcodes `forceMock: true`
* **File:** [app/jobs/[id]/page.tsx](file:///c:/Upwork/Yuryvox/app/jobs/%5Bid%5D/page.tsx#L68)
* **Lines:** 68, 87
* **Root Cause:**
  ```typescript
  // Line 68:
  const handleAction = async (action: 'approve' | 'resume' | 'retry') => {
    ...
    body: JSON.stringify({ action, forceMock: true }),
  };

  // Line 87:
  const handleStepNext = async () => {
    ...
    body: JSON.stringify({ forceMock: true, skipApproval: ... }),
  };
  ```
* **Impact:** If an operator unchecks "Mock-First" on the Studio creation page to run live models, the moment they click **"Approve & Continue"** or **"Step Next Stage"** on the Job Detail page, the frontend forcibly forces the job back into mock mode.
* **Remediation:** Read the execution mode from `job?.config?.provider_config_version` or provide an explicit live/mock toggle on the Job Detail page.

---

### Bug 5 (HIGH): Captions Hardcoded as Mock URLs in Orchestrator
* **File:** [lib/pipeline/orchestrator.ts](file:///c:/Upwork/Yuryvox/lib/pipeline/orchestrator.ts#L545-L549)
* **Lines:** 545–549
* **Root Cause:**
  ```typescript
  job.captions = {
    srt_url: `https://mock-supabase.example.com/${job.job_id}/captions.srt`,
    ass_url: `https://mock-supabase.example.com/${job.job_id}/captions.ass`,
    sync_passed: true,
  };
  ```
  The orchestrator ignores any generated captions data from `audioEnv` and hardcodes fake mock URLs directly into `job.captions`.
* **Impact:** The Subtitle download buttons on the Job Detail page link to non-existent domains.
* **Remediation:** Return `captions` from `runAudioMastering` and assign `job.captions = audioEnv.captions`.

---

### Bug 6 (HIGH): Ephemeral In-Memory Storage Data Loss on Vercel
* **File:** [lib/pipeline/storage.ts](file:///c:/Upwork/Yuryvox/lib/pipeline/storage.ts#L8-L20)
* **Lines:** 8–20
* **Root Cause:**
  The fallback storage driver stores jobs in `globalThis.__yuryvox_in_memory_job_store__`. On Vercel (serverless lambdas), server memory is isolated across lambda instances and wiped on cold starts.
* **Impact:** When deployed to Vercel without a configured Supabase database, a job created on `POST /api/jobs` will vanish, causing polling requests to `/api/jobs/[id]` to return `404 Not Found`.
* **Remediation:** Require Supabase configuration in production environments, or add a warning banner when running in memory mode on Vercel.

---

### Bug 7 (MEDIUM): Video Player Fails to Play Mock Videos
* **File:** [app/jobs/[id]/page.tsx](file:///c:/Upwork/Yuryvox/app/jobs/%5Bid%5D/page.tsx#L380-L395)
* **Lines:** 380–395
* **Root Cause:**
  The HTML5 `<video src={job.final_video.final_video_url} controls />` player attempts to load `https://mock-supabase.example.com/.../final.mp4`.
* **Impact:** In mock mode, the video player displays a broken media icon or black frame with `MEDIA_ELEMENT_ERROR: Empty src or URL not found`.
* **Remediation:** In mock mode, display an archival collage animated SVG card or fallback sample video (e.g. from Wikimedia or a local public asset) rather than a non-routable domain.

---

### Bug 8 (MEDIUM): Agent 1 Lacks Real-Time Search API
* **File:** [lib/agents/idea-analyst.ts](file:///c:/Upwork/Yuryvox/lib/agents/idea-analyst.ts#L232-L236)
* **Lines:** 232–236
* **Root Cause:**
  ```typescript
  ${config.user_sources && config.user_sources.length > 0
    ? `User-provided sources: ${JSON.stringify(config.user_sources)}`
    : 'No external user sources provided. Web search not connected. Rely on trained knowledge with honest support_status flags.'}
  ```
* **Impact:** Agent 1 cannot retrieve current news or live web statistics. It produces historical or conceptual claims, but current-year topics will have unverified or outdated sources.
* **Remediation:** Integrate a search API (e.g., Tavily or Brave Search) in Gate A research.

---

### Bug 9 (LOW): Simulated QA Gates (Hardcoded -14 LUFS)
* **File:** [lib/agents/audio-mastering.ts](file:///c:/Upwork/Yuryvox/lib/agents/audio-mastering.ts#L173-L174)
* **Lines:** 173–174
* **Root Cause:**
  `loudness_lufs: -14` and `true_peak_dbfs: -1` are hardcoded in the mock generator. No real FFmpeg loudnorm pass is executed.
* **Impact:** If an actual audio file has clipped audio or dead air, the system will still mark it as `-14 LUFS` and pass Gate G.

---

## 5. Actionable Remediation Roadmap

To transition the repository from its current **Mock-First State** to **Full Production Readiness**, execute these steps in order:

### Step 1: Fix Internal Pipeline Disconnects (Code Edits)
1. **Pass Visual Prompts to Video Gen:**
   Modify `runVideoGenerator` in [lib/agents/video-generator.ts](file:///c:/Upwork/Yuryvox/lib/agents/video-generator.ts) to accept `visualPlan: VisualPlanData`, and map `imagePrompt` to `visualPlan.scene_visuals[].image_prompt`.
2. **Preserve Real Shotstack URLs:**
   In [lib/agents/compositor.ts](file:///c:/Upwork/Yuryvox/lib/agents/compositor.ts#L517), set `silent_video_url = outputUrl` when running with real API keys.
3. **Complete Live Audio Mastering:**
   In [lib/agents/audio-mastering.ts](file:///c:/Upwork/Yuryvox/lib/agents/audio-mastering.ts), connect the ElevenLabs and AssemblyAI helper functions to the runner when keys are present.
4. **Remove Hardcoded `forceMock` in UI:**
   In [app/jobs/[id]/page.tsx](file:///c:/Upwork/Yuryvox/app/jobs/%5Bid%5D/page.tsx), pass the user's selected mode rather than hardcoding `forceMock: true`.

### Step 2: Database & Storage Configuration
1. Execute [DOCS/supabase_schema.sql](file:///c:/Upwork/Yuryvox/DOCS/supabase_schema.sql) in the Supabase SQL editor to create the `jobs` table and storage buckets (`final-videos`, `video-clips`, `thumbnails`, `captions`, `voiceover`).
2. Add `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` to `.env.local`.

### Step 3: Phase 12 Scope Confirmation & Live Rendering
1. Confirm pricing and scope in writing with the client ($150–200 demo vs $600–800 MVP).
2. Insert client API keys into `.env.local`.
3. Render the **3 official showcase videos** (60–150s) to fulfill Phase 11.
