# LOOM VIDEO SCRIPT (2:00 max): "Vox-Style Video Machine, Explained"

**Purpose:** proposal-stage Loom. You explain the pipeline in plain words, show
it running, and make each component's value obvious to a non-technical client.
**Pacing:** ~150 words per minute. Voiceover budget: 290 words. Stick to the
timestamps. If you run long, cut the app layer section (1:33-1:45) and the
music line in 1:12-1:30.
**Golden rule:** demo with dummy topics and your own test render. Never show
client data or copyrighted footage in a proposal video.

---

## PRE-FLIGHT (have these open before recording)

1. The pipeline running locally: terminal showing a job finishing, or the
   Streamlit dashboard with a finished video
2. The 3 sample videos rendered (or at least one 60s vertical sample)
3. A visible job.json or API response (proves structure, not magic)
4. Browser zoom 110%, bookmarks bar hidden, desktop clean

---

## THE SCRIPT

**0:00-0:10 | Intro (26 words)**
On screen: terminal or dashboard with a finished video.
"I'm Aditya Nadar. I build automation pipelines: Python, LLMs, video rendering.
Here's how the Vox-style video machine works, in two minutes."

**0:10-0:25 | Script engine (38 words)**
On screen: hooks list, then scene plan JSON.
"Step one, the script. GPT-4o-mini writes five hooks, scores them, then splits
the narration into scenes, each with keywords and a visual search query. That
structure is what makes everything downstream automatic."

**0:25-0:40 | Voiceover (36 words)**
On screen: audio waveform with scene markers.
"Step two, the voice. ElevenLabs turns each scene into speech with natural
pacing. Per-scene audio means every clip lands exactly on its cue. If the
service fails, a fallback voice takes over automatically. No dead air, ever."

**0:40-0:55 | B-roll (38 words)**
On screen: search results grid, selected clip highlighted.
"Step three, footage. The Pexels API searches each scene's query, downloads
three candidates, scores them for relevance and motion, and trims to length.
No match? A slow-panning photo covers the gap so renders never stall."

**0:55-1:12 | Captions (36 words)**
On screen: captioned video frame, phone-sized crop.
"Step four, captions. Whisper transcribes the finished voiceover word by word,
so subtitles sync perfectly by definition. Bold two-line captions get burned
into the video. That's the style that keeps thumbs from scrolling on silent
feeds."

**1:12-1:30 | Render (46 words)**
On screen: FFmpeg log, then both aspect outputs side by side.
"Step five, render. FFmpeg stitches the clips, mixes music eighteen decibels
under the voice, normalizes loudness to broadcast standard, and exports both
nine-sixteen and sixteen-nine from one job. Same input, same video, every time.
A two-minute video renders in under half an hour on a basic server."

**1:30-1:45 | App layer (34 words)**
On screen: API response, then job list with status states.
"Then the app layer. A job queue, a REST API, and a one-page dashboard. Submit
a topic, watch the status flip through six states, download the video. Media
cost per video: under ten cents."

**1:45-2:00 | Close (30 words)**
On screen: the three demo videos in a row.
"Every piece you saw is a tested module, not a demo trick. Tell me which style
matches your channel, and a sample video lands in your inbox tomorrow."

**Total voiceover: ~284 words, 1:58.**

---

## 60-MINUTE PROTOTYPE BUILD (do this before recording)

If nothing exists yet, build the minimum path in one hour:
1. Write a 150-word script by hand, split into 5 scenes
2. Generate voiceover: ElevenLabs free trial or OpenAI TTS (per scene)
3. Pull 5 clips from Pexels (free API key, 5 minutes)
4. Concatenate with one FFmpeg command: trim, scale to 1080x1920, concat
5. Captions: faster-whisper on the voiceover, burn in with subtitles filter
6. Export H.264, loudnorm pass, one 60s vertical video

That single video is enough to record the Loom. The full pipeline (queue, API,
dashboard) is described in the master plan, phases 7-11.

## OPTION B: NO RENDER YET? (10-minute fallback)

Screen-share a terminal: show the script-to-scene JSON output from the LLM,
then flip to the master plan and zoom to the pipeline map (Appendix C) and the
cost table. Narrate over the diagram. Same clarity, zero render time.

## PRODUCTION NOTES

- Record 1080p, microphone audio not browser audio, 48kHz. Cut dead air.
- One take per timestamp section, splice together. Hard cap 2:00.
- Upload unlisted. Title: "Vox-Style Video Pipeline Explained (Aditya Nadar)"
- Paste the Loom link as line 2 of the Upwork proposal. Line 1 stays the
  hook question about faceless vs animated.
- Keep the sample video file ready to attach in chat: it is the "previous
  experience" proof the job posting demands.
