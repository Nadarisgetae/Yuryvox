# Yuryvox — Remediation Implementation Plan

**Date:** October 2026  
**Document Version:** 1.0  
**Context:** Action plan to resolve the 9 architectural bugs, pipeline disconnects, and mock-only stub limitations identified in [DOCS/Phase_Completion_And_Bug_Report.md](file:///c:/Upwork/Yuryvox/DOCS/Phase_Completion_And_Bug_Report.md).

---

## 🎯 Plan Architecture & Division

This plan is divided into two distinct parts:
1. **Part 1: Light & Moderate Tasks** — Straightforward, lower-risk UI, fallback, and routing improvements that can be executed quickly without risky cross-service refactors.
2. **Part 2: Critical & Important Tasks** — High-complexity architectural fixes involving cross-agent type contracts, live media API piping (Fal.ai, Shotstack, ElevenLabs), Supabase storage streaming, and orchestrator state machine updates. A high-reasoning model is recommended for this part.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       PART 1: LIGHT & MODERATE TASKS                        │
│   (UI Toggles, Mock Video Fallbacks, Caption Mapping, Storage Warnings)     │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      PART 2: CRITICAL & IMPORTANT TASKS                     │
│    (Agent 3→5 Prompt Wiring, Shotstack Live Output, ElevenLabs Mastering,   │
│             Supabase Durable Storage, Live API Integration Tests)           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

# PART 1: Light & Moderate Tasks
*Recommended Model: Gemini 3.8 Flash or standard coding model*  
*Estimated Effort: 1–2 hours*  
*Objective: Eliminate client-facing UI glitches, fix mock video rendering errors, and ensure governance settings persist across views.*

---

### Task 1.1: Fix Detail Page Hardcoded `forceMock: true` (Bug 4)
* **Severity:** High (Frontend setting override)
* **Target File:** [app/jobs/[id]/page.tsx](file:///c:/Upwork/Yuryvox/app/jobs/%5Bid%5D/page.tsx)
* **Problem:** Lines 68 and 87 hardcode `forceMock: true` inside `handleAction` and `handleStepNext`. If a user initiates a live job from `/`, continuing or stepping on the detail page forces it back into mock mode.
* **Implementation Steps:**
  1. Inspect `job?.config?.provider_config_version` or read an explicit `forceMock` boolean stored in `job.config`.
  2. Add an explicit **Mode Indicator / Toggle** on the Job Detail banner: `[ Mock Mode | Live API Mode ]`.
  3. Update `handleAction` and `handleStepNext` to pass the job's actual mode:
     ```typescript
     const isMock = job?.config?.forceMock ?? (job?.config?.provider_config_version === 'mock');
     body: JSON.stringify({ action, forceMock: isMock });
     ```
  4. Ensure stepping never silently overwrites the user's intended execution tier.
* **Verification:** Run `npm test __tests__/step-routes.test.ts` and verify `/api/jobs/[id]` accepts dynamic `forceMock` flags.

---

### Task 1.2: Fix Mock Video Player Streaming Failures (Bug 7)
* **Severity:** Medium (User experience)
* **Target File:** [app/jobs/[id]/page.tsx](file:///c:/Upwork/Yuryvox/app/jobs/%5Bid%5D/page.tsx#L380-L420)
* **Problem:** In mock mode, the HTML5 `<video src="https://mock-supabase.example.com/.../final.mp4">` fails to stream because `mock-supabase.example.com` is a non-routable domain, producing browser console media errors.
* **Implementation Steps:**
  1. Add a helper function `isMockMediaUrl(url: string): boolean`.
  2. If `url` is a mock URL, render a rich **Archival Collage Interactive Preview Card** instead of an empty broken video element:
     - Render the scene title, duration, aspect ratio badge, and audio waveform illustration.
     - Display an animated SVG paper-collage mockup showing the video keyframe and overlay text.
     - Provide a clear banner: *"Mock preview mode active. Connect live credentials (Fal.ai, Shotstack, ElevenLabs) to stream real MP4 renders."*
  3. If `url` is a real accessible URL (starts with `https://` and is not `example.com` or `yuryvox.internal`), render the native HTML5 player with subtitle track attachments.
* **Verification:** Inspect `/jobs/demo-container-ships-01` in browser and verify no media loading errors occur.

---

### Task 1.3: Fix Hardcoded Captions Mock URLs in Orchestrator (Bug 5)
* **Severity:** High (Asset integrity)
* **Target Files:**
  - [lib/pipeline/orchestrator.ts](file:///c:/Upwork/Yuryvox/lib/pipeline/orchestrator.ts#L545-L552)
  - [lib/agents/types.ts](file:///c:/Upwork/Yuryvox/lib/agents/types.ts)
  - [lib/agents/audio-mastering.ts](file:///c:/Upwork/Yuryvox/lib/agents/audio-mastering.ts)
* **Problem:** Lines 545–549 in `orchestrator.ts` hardcode `srt_url` and `ass_url` to `mock-supabase.example.com`, ignoring the actual caption outputs produced by Agent 7.
* **Implementation Steps:**
  1. Update `FinalVideoData` in [lib/agents/types.ts](file:///c:/Upwork/Yuryvox/lib/agents/types.ts) or return a composite envelope containing `captions: CaptionsData`.
  2. In [lib/pipeline/orchestrator.ts](file:///c:/Upwork/Yuryvox/lib/pipeline/orchestrator.ts), set:
     ```typescript
     job.captions = audioEnv.captions || {
       srt_url: audioEnv.data.srt_url,
       ass_url: audioEnv.data.ass_url,
       sync_passed: audioEnv.data.sync_passed ?? true,
     };
     ```
  3. Ensure download buttons on the detail page link to genuine asset paths.
* **Verification:** Run `npm test __tests__/audio-mastering.test.ts` and `npm test __tests__/orchestrator.test.ts`.

---

### Task 1.4: Ephemeral Memory Store Warning & Supabase Fallback Guard (Bug 6)
* **Severity:** High (Operational data loss)
* **Target Files:**
  - [lib/pipeline/storage.ts](file:///c:/Upwork/Yuryvox/lib/pipeline/storage.ts)
  - [components/Navbar.tsx](file:///c:/Upwork/Yuryvox/components/Navbar.tsx)
  - [app/jobs/page.tsx](file:///c:/Upwork/Yuryvox/app/jobs/page.tsx)
* **Problem:** If deployed to Vercel without Supabase configured, the in-memory Map is destroyed between serverless lambdas.
* **Implementation Steps:**
  1. In `storage.ts`, export `isDurableStorage(): boolean` (`getStorageDriver() === 'supabase'`).
  2. In `Navbar.tsx` and `app/jobs/page.tsx`, show an amber warning pill when `storage === 'memory'`:
     *"Memory Storage (Ephemeral) — Add Supabase credentials for durable cloud history"*.
  3. Add a warning to `POST /api/jobs` response headers when in memory mode on non-local hostnames.
* **Verification:** Run build and check diagnostic output in `/api/health`.

---

# PART 2: Critical & Important Tasks
*Recommended Model: Gemini 3.8 Flash (High) or Opus / Reasoning model*  
*Estimated Effort: 3–5 hours*  
*Objective: Re-architect cross-agent data contracts, wire live external media APIs, preserve render URLs, and enable durable Supabase storage.*

---

### Task 2.1: Bridge Agent 3 Visual Prompts into Agent 5 (Bug 1 — CRITICAL)
* **Severity:** Critical (Core visual branding failure)
* **Target Files:**
  - [lib/agents/video-generator.ts](file:///c:/Upwork/Yuryvox/lib/agents/video-generator.ts)
  - [lib/agents/timing-layout.ts](file:///c:/Upwork/Yuryvox/lib/agents/timing-layout.ts)
  - [lib/pipeline/orchestrator.ts](file:///c:/Upwork/Yuryvox/lib/pipeline/orchestrator.ts#L444)
  - [lib/agents/types.ts](file:///c:/Upwork/Yuryvox/lib/agents/types.ts)
  - [app/api/agents/[stage]/route.ts](file:///c:/Upwork/Yuryvox/app/api/agents/%5Bstage%5D/route.ts)
* **Problem:** Agent 5 currently only receives `timedPlan`. Because `timedPlan` doesn't carry Agent 3's rich image prompts, line 391 in `video-generator.ts` falls back to `visualScene?.overlay?.text` (a 2–4 word title like `"First Glance"`). The multi-sentence archival collage prompt is completely lost.
* **Architecture Design:**
  *Approach Option A:* Add `visual_prompt` and `motion_prompt` to `TimedScene` in [lib/agents/types.ts](file:///c:/Upwork/Yuryvox/lib/agents/types.ts).  
  *Approach Option B (Recommended):* Update `runVideoGenerator` signature to accept `(jobConfig: JobConfig, timedPlan: TimedPlanData, visualPlan: VisualPlanData, options?: VideoGenOptions)`.
* **Implementation Steps:**
  1. Update `runVideoGenerator` signature in `lib/agents/video-generator.ts` to accept `visualPlan: VisualPlanData`.
  2. Update line 390–394 in `lib/agents/video-generator.ts`:
     ```typescript
     const sceneVisual = visualPlan.scene_visuals.find((v) => v.scene_id === scene.scene_id);
     const imagePrompt = sceneVisual?.image_prompt || `Archival collage explainer: ${scene.scene_id}`;
     const motionPrompt = sceneVisual?.video_motion_prompt || sceneVisual?.motion_direction || scene.motion.direction;
     ```
  3. In [lib/pipeline/orchestrator.ts:L444](file:///c:/Upwork/Yuryvox/lib/pipeline/orchestrator.ts#L444), update call:
     ```typescript
     const videoAssetsEnv = await runVideoGenerator(job.config, job.timed_plan!, job.visual_plan!, { ... });
     ```
  4. Update `app/api/agents/[stage]/route.ts` for `stage === 'video-generator'` to require or accept `visual_plan`.
  5. Update `__tests__/video-generator.test.ts` and `__tests__/qa-gates.test.ts` to supply `visualPlan`.
* **Verification:** Run `npm test __tests__/video-generator.test.ts` and verify image prompts received by the generator match `scene_visuals[].image_prompt`.

---

### Task 2.2: Preserve Real Shotstack Output URLs (Bug 2 — CRITICAL)
* **Severity:** Critical (Loss of paid render output)
* **Target Files:**
  - [lib/agents/compositor.ts](file:///c:/Upwork/Yuryvox/lib/agents/compositor.ts#L492-L530)
  - [lib/pipeline/storage.ts](file:///c:/Upwork/Yuryvox/lib/pipeline/storage.ts)
* **Problem:** In live mode, `runCompositor` submits the edit to Shotstack and polls until `outputUrl` is ready. But then it calls `mockUploadToSupabase` and replaces `silent_video_url` with a fake URL (`https://mock-supabase.example.com/...`), discarding the actual rendered MP4.
* **Implementation Steps:**
  1. Check if Supabase storage is configured with `SUPABASE_SERVICE_ROLE_KEY`.
  2. If Supabase is configured:
     - Fetch the MP4 stream/buffer from `outputUrl`.
     - Upload to bucket `final-videos` via `uploadAsset(jobConfig.job_id, 'silent_video.mp4', buffer, 'video/mp4')`.
     - Set `silent_video_url` to the durable Supabase public URL.
  3. If Supabase is NOT configured:
     - Directly preserve `silent_video_url: outputUrl` (Shotstack hosts rendered exports on AWS S3/CloudFront for 24+ hours).
  4. Only use `mock-supabase.example.com` when `shouldUseMock` is strictly `true`.
* **Verification:** Run `npm test __tests__/compositor.test.ts` and verify `outputUrl` is preserved when `forceMock: false`.

---

### Task 2.3: Wire Live Audio Mastering Execution (Bug 3 — CRITICAL)
* **Severity:** Critical (Live audio & subtitles blocked)
* **Target Files:**
  - [lib/agents/audio-mastering.ts](file:///c:/Upwork/Yuryvox/lib/agents/audio-mastering.ts#L450-L525)
  - [lib/pipeline/orchestrator.ts](file:///c:/Upwork/Yuryvox/lib/pipeline/orchestrator.ts)
  - [lib/agents/types.ts](file:///c:/Upwork/Yuryvox/lib/agents/types.ts)
* **Problem:** Lines 504–524 in `audio-mastering.ts` explicitly state: `// Real implementation would go here` and fall back to `mock_adapter` even when live API keys are provided.
* **Implementation Steps:**
  1. Implement the live execution branch in `runAudioMastering`:
     - Loop through `script.scenes`, calling `callElevenLabsTTS(scene.narration, voiceId, elevenLabsKey)`.
     - Concatenate individual scene audio buffers (inserting 0.15s silence padding).
     - Upload the composite voiceover audio to Supabase bucket `voiceover` or temporary CDN.
     - Submit voiceover URL to AssemblyAI via `requestAssemblyAITranscription`.
     - Poll AssemblyAI with `pollAssemblyAITranscription` until word-level timestamps return.
     - Call `generateCaptionsFromWords` to create `.srt` and `.ass` buffers.
     - Upload subtitles to Supabase bucket `captions` via `uploadAsset`.
  2. For the final audio-video mix:
     - Combine `silent_video.silent_video_url` with the voiceover track (and background music ducked at -18 dB).
     - Note: Can be composited directly via a second Shotstack pass or serverless muxing.
  3. Return full `FinalVideoEnvelope` containing real URLs, measured duration, and caption URLs.
* **Verification:** Run `npm test __tests__/audio-mastering.test.ts`.

---

### Task 2.4: Supabase Durable Persistence & RLS Schema Verification (Bug 6 Durable Layer)
* **Severity:** High (Production database reliability)
* **Target Files:**
  - [DOCS/supabase_schema.sql](file:///c:/Upwork/Yuryvox/DOCS/supabase_schema.sql)
  - [lib/supabase/client.ts](file:///c:/Upwork/Yuryvox/lib/supabase/client.ts)
  - [lib/pipeline/storage.ts](file:///c:/Upwork/Yuryvox/lib/pipeline/storage.ts)
* **Implementation Steps:**
  1. Review [DOCS/supabase_schema.sql](file:///c:/Upwork/Yuryvox/DOCS/supabase_schema.sql) ensuring all columns (`job_id`, `config`, `research`, `script`, `visual_plan`, `timed_plan`, `video_assets`, `silent_video`, `final_video`, `captions`, `cost`, `timestamps`) match `JobRecord`.
  2. Verify that `getSupabaseServerClient()` in `lib/supabase/client.ts` uses `SUPABASE_SERVICE_ROLE_KEY` on server routes to bypass Row Level Security (RLS) during automated pipeline writes.
  3. Verify storage bucket creation statements for all 5 buckets: `final-videos`, `video-clips`, `thumbnails`, `captions`, `voiceover`.
  4. Test edge cases where Supabase is down: ensure graceful fallback to memory store with logged warnings, without throwing 500 errors to the client.
* **Verification:** Run `npm test __tests__/storage.test.ts` with both mock and live configurations.

---

### Task 2.5: Comprehensive Integration & Regression Verification
* **Severity:** High (System reliability)
* **Target Files:**
  - [__tests__/orchestrator.test.ts](file:///c:/Upwork/Yuryvox/__tests__/orchestrator.test.ts)
  - [__tests__/qa-gates.test.ts](file:///c:/Upwork/Yuryvox/__tests__/qa-gates.test.ts)
  - [__tests__/step-routes.test.ts](file:///c:/Upwork/Yuryvox/__tests__/step-routes.test.ts)
* **Implementation Steps:**
  1. Add tests asserting that `runPipeline` successfully propagates `visual_plan.scene_visuals[].image_prompt` into `video_assets`.
  2. Add tests verifying `runCompositor` outputs retain external URLs when `forceMock: false`.
  3. Add tests verifying step progression across all 7 stages with approval pause.
  4. Run full linter and production build to ensure 0 regressions:
     ```bash
     npm test
     npm run lint
     npm run build
     ```

---

## 📅 Execution Sequence Summary

```
PHASE A: Execute Part 1 (Light & Moderate Tasks)
  ├─ Step 1: Fix app/jobs/[id]/page.tsx hardcoded forceMock (Task 1.1)
  ├─ Step 2: Fix Mock Video Player Streaming Failures (Task 1.2)
  ├─ Step 3: Fix Orchestrator Captions Mock URLs (Task 1.3)
  └─ Step 4: Add Ephemeral Storage Warnings (Task 1.4)
  └─ Check: npm test && npm run build

PHASE B: Switch to Advanced Model for Part 2 (Critical & Important Tasks)
  ├─ Step 5: Wire Agent 3 prompts to Agent 5 (Task 2.1)
  ├─ Step 6: Fix Shotstack Live URL preservation (Task 2.2)
  ├─ Step 7: Wire Live Audio Mastering & Subtitle Generation (Task 2.3)
  ├─ Step 8: Verify Supabase Storage & RLS policies (Task 2.4)
  └─ Check: Run full 153+ unit test suite & verify zero build errors (Task 2.5)
```
