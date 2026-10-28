# Yuryvox · Archival-Collage Documentary Video Generator

> **Autonomous 7-Agent Explainer Pipeline (API-Only)**  
> Transforms ideas into archival-collage documentary videos up to **20 minutes** with **zero local compute or GPU dependencies**.

---

## 🚀 Quickstart: How to Run Locally

### 1. Start the Development Server
You do **not** need any API keys to run and test the application. It runs out-of-the-box in **Zero-Spend Mock Mode**:

```bash
# In the project directory (c:\Upwork\Yuryvox):
npm run dev
```

### 2. Open the Web Application
Open your browser and navigate to:

👉 **[http://localhost:3000](http://localhost:3000)** — **Topic Creation Studio**  
👉 **[http://localhost:3000/jobs](http://localhost:3000/jobs)** — **Jobs Dashboard**  
👉 **[http://localhost:3000/api/health](http://localhost:3000/api/health)** — **Health & Diagnostics**

---

## 🎬 How to Use the Web Application

### Step 1: Create a Video in the Studio (`/`)
1. Enter any topic or click one of the pre-loaded **Inspiration Ideas**:
   - *"How container ships quietly restructured global trade"* (90s Standard Explainer)
   - *"The forgotten paper maps that created modern property lines"* (3 Min Featurette)
   - *"Why electric grid frequencies must never drift from 60 Hz"* (5 Min Deep Dive)
   - *"The evolution of sovereign debt: From Renaissance city-states to global fiat"* (20 Min Extended Documentary)
2. Select your **Target Duration**:
   - Preset chips (**60s**, **90s**, **3 Min**, **5 Min**, **10 Min**, **15 Min**, **20 Min**) or adjust the continuous slider up to **1200 seconds (20 minutes)**.
3. Select your **Aspect Ratio** (16:9 Landscape, 9:16 Vertical, or 1:1 Square).
4. Choose your **Governance Options**:
   - **Human Approval Gate** (enabled by default): Pauses after Stage 4 so you can review the script and visual plan before video generation.
   - **Zero-Spend Mock Mode** (enabled by default): Executes local deterministic mock pipelines with $0.00 external spend.
5. Click **Launch Archival Collage Pipeline →**.

### Step 2: Live Stepper & Review (`/jobs/[id]`)
- Watch the **7-Stage Horizontal Stepper** progress in real-time.
- If the **Human Approval Gate** is active, review the narrative script and visual concepts, then click **✓ Approve & Generate Video** to continue.
- Inspect the generated envelopes across 7 dedicated tabs:
  1. **Research & Angles**: 3 distinct angles, thesis question, and verified claims.
  2. **Scriptwriter Narration**: Scene-by-scene script, 145 WPM pacing, and word count math.
  3. **Visual Ideator**: Archival collage prompts, motion directions, and safe zones.
  4. **Timing & Layout**: 4–8s shot calibration and audio ducking cues.
  5. **Generated Assets**: Synthesized image and video clips.
  6. **Compositor Video**: Shotstack silent video edit.
  7. **Final Video Player**: HTML5 video preview, -14 LUFS loudness check, and subtitle download links (`.srt` and `.ass`).
  8. **Telemetry**: Per-stage API cost accounting and execution timestamps.

### Step 3: Jobs Dashboard (`/jobs`)
- View all past and in-progress jobs.
- Click **✨ Load Demos** to immediately populate the 3 pre-generated showcase videos.

---

## 🧪 Testing & Verification

Run the automated test suite across all 7 agents, QA gates, storage, orchestrator, and API routes:

```bash
# Run all 13 test suites (153 unit tests)
npm test

# Run Next.js linting (0 errors)
npm run lint

# Compile production build
npm run build
```

---

## 🏛 7-Agent Architecture

The pipeline strictly follows [DOCS/Yuryvox_Agent_Instructions.md](DOCS/Yuryvox_Agent_Instructions.md) v1.0:

```
[User Topic]
     │
     ▼
[Stage 1: Idea Analyst] ───────► 3 angles, thesis question, sourced claims (Gate A)
     │
     ▼
[Stage 2: Scriptwriter] ───────► 145 WPM narration, scene breakdown, claim mapping (Gate B)
     │
     ▼
[Stage 3: Visual Ideator] ─────► Archival collage prompts, motion directions (Gate C)
     │
     ▼
[Stage 4: Timing & Layout] ────► 4–8s shot rule, aspect margins, safe zones (Gate D)
     │
     ▼
[Human Approval Checkpoint] ───► Operator review before paid API generation
     │
     ▼
[Stage 5: Video Generator] ────► Fal.ai image & video generation (Gate E)
     │
     ▼
[Stage 6: Compositor] ─────────► Shotstack edit render & thumbnail (Gate F)
     │
     ▼
[Stage 7: Audio Mastering] ────► ElevenLabs TTS, captions sync, -14 LUFS (Gate G)
     │
     ▼
[Final Mastered MP4 + Subtitles]
```

---

## 🔑 Adding Live API Keys (Optional)

When ready to run live AI models instead of mock mode:
1. Copy `.env.example` to `.env.local`:
   ```bash
   copy .env.example .env.local
   ```
2. Fill in your API keys (see [DOCS/Yuryvox_API_Requirements.md](DOCS/Yuryvox_API_Requirements.md) for details):
   - `OPENROUTER_API_KEY` (Idea Analyst, Scriptwriter, Visual Ideator)
   - `ELEVENLABS_API_KEY` (Voiceover Narration)
   - `FAL_API_KEY` (Image & Video Generation)
   - `SHOTSTACK_API_KEY` (Cloud Video Editing)
   - `ASSEMBLYAI_API_KEY` (Subtitle Alignment & Sync)
   - `SUPABASE_URL` & `SUPABASE_SERVICE_ROLE_KEY` (PostgreSQL Database & Storage)

---

## 📚 Canonical Documentation
- **Masterplan & State Tracker**: [DOCS/Yuryvox Masterplan v1.md](DOCS/Yuryvox%20Masterplan%20v1.md)
- **Agent Instructions v1.0**: [DOCS/Yuryvox_Agent_Instructions.md](DOCS/Yuryvox_Agent_Instructions.md)
- **API Requirements Guide**: [DOCS/Yuryvox_API_Requirements.md](DOCS/Yuryvox_API_Requirements.md)
- **Database Schema DDL**: [DOCS/supabase_schema.sql](DOCS/supabase_schema.sql)
