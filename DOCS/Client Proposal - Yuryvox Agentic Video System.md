# Proposal: Agentic Vox-Style Video Generator for Client A

**Prepared for**: Client A  
**Prepared by**: Nadar Code  
**Date**: 2025-08-24  
**Reference**: Yuryvox Masterplan v1 (API‑only, no local resources)

---

## Executive Summary

You currently spend **$30–$35 per 15‑minute video** using a manual process (Chrome extension + Leonardo AI).  
I propose an **agentic webapp** that automates the entire pipeline—research, script, visual ideation, timing, video generation, compositing, and audio—using only third‑party APIs and serverless functions.  

**Result**:  
- **Cost per 15‑minute video drops to ~$13.30** (≈ 60 % savings).  
- **Monthly cost for 20 videos: ≈ $266** (vs. $600–$700 today).  
- **Zero local GPU/CPU/storage required from you or me**—everything runs in APIs or ephemeral serverless functions (Vercel/Render).  
- You get a **private webapp** where you type a topic and receive a finished Vox‑style animated explainer video.

---

## 1. Agent Architecture & Tool Stack

The system consists of seven specialized agents, each calling a best‑of‑breed API.  
All agents are orchestrated via lightweight serverless functions (Next.js API routes) and store metadata/assets in Supabase (managed PostgreSQL + object storage).  
No agent runs on your machine or requires you to manage GPUs, CPUs, or files.

### High‑Level Data Flow (Text Schematic)

```
[User Topic] 
      ↓
[Agent 1: Idea Analyst] → OpenRouter (free LLM) 
      ↓
[Agent 2: Scriptwriter] → OpenRouter (free LLM) 
      ↓
[Agent 3: Visual Ideator] → OpenRouter (free LLM) 
      ↓
[Agent 4: Timing & Layout] → Rule‑based (no API) 
      ↓
[Agent 5: Video Generator] → Fal.ai (Flux Schnell + Stable Video Diffusion) 
      ↓
[Agent 6: Compositor] → Shotstack API (cloud video editing) 
      ↓
[Agent 7: Audio Mastering] → ElevenLabs (TTS) + AssemblyAI (captions) 
      ↓
[Final Video URL] ← Supabase Storage (permanent copy)
```

### Agent‑by‑Agent Breakdown

| Agent | Role | API/Tool Used | What It Does (Simple) | Cost per 15‑min Video* |
|-------|------|---------------|-----------------------|------------------------|
| **1** | Idea Analyst | OpenRouter – `google/gemma-7b-it` (free tier) | Researches the topic, finds 3 angles, key facts, hooks, and source URLs. | $0.002 |
| **2** | Scriptwriter | OpenRouter – `mistralai/mixtral-8x7b-instruct` (free tier) | Turns research into a retention‑optimized script and splits it into scenes (30‑60 words each). | $0.003 |
| **3** | Visual Ideator | OpenRouter – `google/gemma-7b-it` (free tier) | For each scene, creates a detailed image prompt, a short on‑screen text suggestion, and a motion direction (e.g., “slow zoom in”). | $0.002 |
| **4** | Timing & Layout | **Rule‑based logic** (no API call) | Assigns exact start/end times to each scene, decides text placement, and notes audio cues (voice/music ducking). | $0.00 |
| **5** | Video Generator | Fal.ai – `fal-ai/flux/schnell` (image) + `fal-ai/stable-video-diffusion` (video) | Generates a keyframe image per scene, then turns it into a 4‑6 s video clip using the motion direction. (Optimized: 8 s scenes, 30% shot reuse.) | $6.19 |
| **6** | Compositor | Shotstack API (cloud video editing) | Stitches all video clips (or Ken Burns‑panned images) together, adds transitions, overlays the on‑screen text, and inserts a royalty‑free music bed at ‑18 dB. | $6.80 |
| **7** | Audio Mastering | ElevenLabs (TTS) + AssemblyAI (captions) + FFmpeg (serverless) | Generates scene‑by‑scene voiceover, transcribes it for word‑accurate captions, mixes voiceover with music, and normalizes loudness to broadcast standard (‑14 LUFS). | $5.00 |
| **Storage & Hosting** | Supabase (DB + object storage) + Vercel (webapp) | Stores job metadata, thumbnails, and low‑res previews; hosts the Next.js webapp. | $0.00 (free tiers) + $1.00/mo domain |
| ***** | **Total per video** | | | **$13.30** |

> \*Costs are based on actual published pricing (Fal.ai, Shotstack, ElevenLabs, AssemblyAI) and optimized usage (8‑second scenes, 30% asset reuse, alignment with free tiers). OpenRouter agents use free tiers sufficient for low volume.

---

## 2. How the Tool Works (Simple Walk‑Through)

1. **You log into your private webapp** (hosted on Vercel; only you have access).  
2. **You type a topic** (e.g., “How interest rates affect housing”) and pick video length/aspect ratio.  
3. **Agent 1** searches the web and returns angles, facts, and hooks.  
4. **Agent 2** writes a full script and splits it into scenes.  
5. **Agent 3** creates visual prompts and text ideas for each scene.  
6. **Agent 4** calculates timing, placements, and audio cues.  
7. **Agent 5** calls Fal.ai to make an image, then a short video clip for each scene.  
8. **Agent 6** sends all clips/text/music to Shotstack, which renders a silent video.  
9. **Agent 7** gets a voiceover from ElevenLabs, captions from AssemblyAI, mixes everything, and loudness‑normalizes the audio.  
10. The final MP4 URL is stored in Supabase and shown in the webapp for you to download.  

**Total hands‑on time for you**: under 2 minutes (just entering the topic and clicking “Download”).  
**Total wall‑clock time**: ~10–20 minutes (mostly waiting for APIs—no manual work).

---

## 3. Monthly Cost Estimate (20 Videos @ 15 min)

| Item | Monthly Cost |
|------|--------------|
| Agents 1‑4 (OpenRouter) | $0.14 |
| Agent 5 – Fal.ai (video gen) | $123.80 |
| Agent 6 – Shotstack (compositing) | $136.00 |
| Agent 7 – ElevenLabs + AssemblyAI | $5.00 |
| Supabase storage & Vercel hosting | ~$0.00 |
| Domain ( yearly amortized ) | $1.00 |
| **Total** | **$265.94** |
| **Per‑video average** | **$13.30** |

*Comparison*: Your current manual process costs **$600–$700/month** for the same output.  
**Savings**: **$334–$434/month** (≈ 60 %).

---

## 4. Implementation Plan – Complete Within One Month

I will deliver a **private, production‑ready webapp** you can access within 4 weeks.  
Work is split into weekly sprints; each ends with a usable increment.

### Week 1 – Foundations & Agent 1‑4 (Zero‑Cost Validation)
- Set up Vercel repo, Supabase project, and API keys (OpenRouter, Fal trial, ElevenLabs trial, AssemblyAI trial, Shotstack trial).  
- Build **Agent 1 (Idea Analyst)** and **Agent 2 (Scriptwriter)** routes; test with 3 sample topics.  
- Build **Agent 3 (Visual Ideator)** and **Agent 4 (Timing & Layout)** routes; verify end‑to‑end research→script→visuals→timing flow.  
- **Deliverable by end of Week 1**: A local‑dev demo where you input a topic and get a JSON research brief, script, visual plan, and timing plan—**zero API cost** (uses OpenRouter free tiers and trial credits where needed).

### Week 2 – Agent 5 (Video Generator) & Early Integration
- Implement **Agent 5** using Fal.ai (Flux Schnell → Stable Video Diffusion).  
- Add logic to store generated video URLs in Supabase Storage and handle fallbacks (Ken Burns on image if video gen fails).  
- Integrate Agent 5 output into the orchestration chain.  
- **Deliverable by end of Week 2**: Ability to generate AI‑video clips for a topic and store them; you can preview clips in the webapp.

### Week 3 – Agent 6 (Compositor) & Agent 7 (Audio Mastering)
- Build **Agent 6** that calls Shotstack with a timeline built from Agent 4/5 outputs (clips, transitions, text overlays, music).  
- Build **Agent 7** that calls ElevenLabs (TTS) and AssemblyAI (captions), mixes audio with the silent video via a short FFmpeg serverless function, and loudness‑normalizes.  
- Finalize the orchestration: each agent updates the job record in Supabase and triggers the next.  
- **Deliverable by end of Week 3**: End‑to‑end pipeline that takes a topic and returns a finished MP4 URL (still using trial/free tiers). You can download 1‑2 full demo videos (≤ 90 s) to verify quality.

### Week 4 – Polish, QA, Handoff
- Implement idempotency keys, error handling, retry logic, and basic QA gates (caption sync, loudness check via FFmpeg in serverless function).  
- Polish the Next.js webapp: topic form, job list with status indicators, video player, download button.  
- Write a short README with instructions to add your own API keys for scaling (so you control ongoing costs).  
- Conduct a 30‑minute walkthrough (via screen‑share) showing:  
  1. How to submit a topic.  
  2. How to monitor job progress.  
  3. How to download the final video.  
  4. Where to view cost breakdown per job.  
- **Deliverable by end of Week 4**: Private Vercel URL (only you can access) + GitHub repo (or zip) + this proposal + cost‑tracking guide. You will be ready to run unlimited videos (cost scales linearly with usage).

### Total Effort
- **≈ 120 hours** (well within a month part‑time).  
- No dependency on you installing anything—you only need a browser and internet connection.

---

## 5. Next Steps

1. **Review this proposal** – let me know if any agent/tool needs adjustment (e.g., you prefer Runway over Fal, or a different TTS provider).  
2. **Confirm video length and volume** – the numbers above assume 20 videos/month @ 15 min. If you plan different volumes, I’ll adjust the cost estimate.  
3. **Kick‑off** – Upon your go‑ahead, I’ll set up the repo and send you access links within 48 hours.  
4. **First demo** – By the end of Week 1 you’ll see the research/script/visuals/timing output; by Week 3 you’ll have full video demos.

---

### Why This Works for You

- **No learning curve** – you only interact with a simple web form.  
- **Cost predictability** – you pay only for what you use (API bills are transparent).  
- **Scalable** – if you need 50 videos/month later, the same architecture handles it; the per‑video cost drops slightly thanks to better API tier utilization.  
- **Future‑proof** – agents are decoupled; swapping a better model (e.g., a new video gen API) requires changing only one route.  

I’m ready to start as soon as you confirm. Please reply with any questions or your go‑ahead, and we’ll have your automated video tool live in under a month.

--- 

*Prepared with reference to Yuryvox Masterplan v1 (API‑only, no‑local‑resources version).*  