'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface TopicSuggestion {
  title: string;
  duration: number;
  label: string;
}

const INSPIRATION_TOPICS: TopicSuggestion[] = [
  {
    title: 'How container ships quietly restructured global trade',
    duration: 90,
    label: '90s · Standard',
  },
  {
    title: 'The forgotten paper maps that created modern property lines',
    duration: 180,
    label: '3 Min · Featurette',
  },
  {
    title: 'Why electric grid frequencies must never drift from 60 Hz',
    duration: 300,
    label: '5 Min · Deep Dive',
  },
  {
    title: 'The 1858 transatlantic telegraph cable: Connecting two worlds in seconds',
    duration: 900,
    label: '15 Min · Documentary',
  },
  {
    title: 'The evolution of sovereign debt: From Renaissance city-states to global fiat',
    duration: 1200,
    label: '20 Min · Extended Doc',
  },
];

const DURATION_PRESETS = [
  { seconds: 60, label: '1 Min', desc: 'Short / Hook' },
  { seconds: 90, label: '90s', desc: 'Standard Explainer' },
  { seconds: 180, label: '3 Min', desc: 'Featurette' },
  { seconds: 300, label: '5 Min', desc: 'Deep Dive' },
  { seconds: 600, label: '10 Min', desc: 'Mini-Doc' },
  { seconds: 900, label: '15 Min', desc: 'Documentary' },
  { seconds: 1200, label: '20 Min', desc: 'Extended Doc' },
];

export default function StudioPage() {
  const router = useRouter();

  const [topic, setTopic] = useState('');
  const [targetSeconds, setTargetSeconds] = useState(90);
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16' | '1:1'>('16:9');
  const [approvalMode, setApprovalMode] = useState(true);
  const [stepByStep, setStepByStep] = useState(false);
  const [isBackground, setIsBackground] = useState(false);
  const [forceMock, setForceMock] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Live calculations
  const estimatedWords = Math.round((targetSeconds * 145) / 60);
  const estimatedScenes = Math.max(6, Math.round(targetSeconds / 8));
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${mins}:${rem < 10 ? '0' : ''}${rem}`;
  };

  const handleSelectSuggestion = (suggestion: TopicSuggestion) => {
    setTopic(suggestion.title);
    setTargetSeconds(suggestion.duration);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const trimmedTopic = topic.trim();
    if (!trimmedTopic) {
      setErrorMsg('Please enter a topic or thesis for your video.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: trimmedTopic,
          target_seconds: targetSeconds,
          aspect_ratios: [aspectRatio],
          approval_mode: approvalMode
            ? 'script_and_visual_plan_before_paid_generation'
            : 'fully_automatic',
          // Step-by-step: create job but don't auto-run any stage
          auto_run: !stepByStep,
          background: stepByStep ? false : isBackground,
          forceMock,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Failed to create job');
      }

      const jobId = data.job_id || data.job?.job_id;
      if (jobId) {
        router.push(`/jobs/${jobId}`);
      } else {
        router.push('/jobs');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
      setIsSubmitting(false);
    }
  };

  return (
    <main className="container" style={{ padding: '2.5rem 1.5rem 5rem' }}>
      {/* Hero Header */}
      <div style={{ textAlign: 'center', maxWidth: 760, margin: '0 auto 2.5rem' }}>
        <span className="archival-tag">Agentic Explainer Engine · Up to 20 Min Runtimes</span>
        <h1
          style={{
            fontSize: '2.5rem',
            lineHeight: 1.15,
            marginBottom: '0.85rem',
            fontWeight: 700,
          }}
        >
          Transform Any Idea into an Archival-Collage Documentary
        </h1>
        <p
          style={{
            fontSize: '1.05rem',
            color: 'var(--ink-muted)',
            lineHeight: 1.6,
            margin: '0 auto',
          }}
        >
          Chains 7 specialized AI agents — from source research and narrative scripting to
          visual collage layouts, motion generation, and master audio. 100% API-driven with zero
          local compute.
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 340px',
          gap: '2rem',
          alignItems: 'start',
        }}
      >
        {/* Main Creation Form */}
        <form onSubmit={handleSubmit} className="card" style={{ padding: '2.25rem' }}>
          {errorMsg && (
            <div
              style={{
                background: 'var(--red-light)',
                color: 'var(--red)',
                border: '1px solid #f7c5be',
                padding: '0.85rem 1.25rem',
                borderRadius: 6,
                marginBottom: '1.5rem',
                fontSize: '0.9rem',
              }}
            >
              {errorMsg}
            </div>
          )}

          {/* Topic Input */}
          <div style={{ marginBottom: '1.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <label
                htmlFor="topic-input"
                style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--ink)' }}
              >
                Topic or Central Thesis
              </label>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.75rem',
                  color: 'var(--ink-light)',
                }}
              >
                {topic.length} characters
              </span>
            </div>
            <textarea
              id="topic-input"
              rows={4}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. How container ships quietly restructured global trade, or Why electric grid frequencies must never drift from 60 Hz..."
              style={{
                width: '100%',
                padding: '0.85rem 1rem',
                fontSize: '1rem',
                fontFamily: 'var(--font-sans)',
                background: 'var(--paper-subtle)',
                color: 'var(--ink)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                outline: 'none',
                resize: 'vertical',
                lineHeight: 1.5,
              }}
            />

            {/* Inspiration Chips */}
            <div style={{ marginTop: '0.75rem' }}>
              <span
                style={{
                  display: 'block',
                  fontSize: '0.78rem',
                  color: 'var(--ink-light)',
                  marginBottom: '0.4rem',
                  fontWeight: 500,
                }}
              >
                Inspiration ideas (click to populate):
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {INSPIRATION_TOPICS.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectSuggestion(item)}
                    style={{
                      background: 'var(--cream)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 4,
                      padding: '0.3rem 0.65rem',
                      fontSize: '0.78rem',
                      color: 'var(--ink-muted)',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--ochre)';
                      e.currentTarget.style.color = 'var(--ink)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-subtle)';
                      e.currentTarget.style.color = 'var(--ink-muted)';
                    }}
                  >
                    <span style={{ fontWeight: 600, color: 'var(--ochre-dark)', marginRight: 4 }}>
                      [{item.label}]
                    </span>
                    {item.title.length > 45 ? item.title.slice(0, 45) + '…' : item.title}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Target Runtime Selector (Supporting up to 20 mins) */}
          <div style={{ marginBottom: '1.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.65rem' }}>
              <label style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                Target Runtime
              </label>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.85rem',
                  color: 'var(--ochre-dark)',
                  fontWeight: 600,
                }}
              >
                {formatTime(targetSeconds)} ({targetSeconds}s) · ~{estimatedWords} words · ~{estimatedScenes} scenes
              </span>
            </div>

            {/* Preset Buttons */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))',
                gap: '0.5rem',
                marginBottom: '0.85rem',
              }}
            >
              {DURATION_PRESETS.map((preset) => {
                const active = targetSeconds === preset.seconds;
                return (
                  <button
                    key={preset.seconds}
                    type="button"
                    onClick={() => setTargetSeconds(preset.seconds)}
                    style={{
                      background: active ? 'var(--ink)' : 'var(--cream)',
                      color: active ? 'var(--paper)' : 'var(--ink)',
                      border: `1px solid ${active ? 'var(--ink)' : 'var(--border)'}`,
                      borderRadius: 6,
                      padding: '0.55rem 0.25rem',
                      textAlign: 'center',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{preset.label}</div>
                    <div
                      style={{
                        fontSize: '0.68rem',
                        opacity: active ? 0.85 : 0.65,
                        marginTop: 2,
                      }}
                    >
                      {preset.desc}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Custom Slider (30s to 1200s / 20 mins) */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                background: 'var(--paper-subtle)',
                padding: '0.75rem 1rem',
                borderRadius: 6,
                border: '1px solid var(--border-subtle)',
              }}
            >
              <span style={{ fontSize: '0.8rem', color: 'var(--ink-light)', fontFamily: 'var(--font-mono)' }}>
                30s
              </span>
              <input
                type="range"
                min={30}
                max={1200}
                step={10}
                value={targetSeconds}
                onChange={(e) => setTargetSeconds(parseInt(e.target.value, 10))}
                style={{ flex: 1, accentColor: 'var(--ochre)' }}
              />
              <span style={{ fontSize: '0.8rem', color: 'var(--ink-light)', fontFamily: 'var(--font-mono)' }}>
                20 Min (1200s)
              </span>
            </div>
          </div>

          {/* Aspect Ratio */}
          <div style={{ marginBottom: '1.75rem' }}>
            <label style={{ display: 'block', fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.65rem' }}>
              Aspect Ratio
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
              {[
                { id: '16:9', title: '16:9 Landscape', desc: 'YouTube Documentary / Desktop' },
                { id: '9:16', title: '9:16 Vertical', desc: 'TikTok / Shorts / Reels' },
                { id: '1:1', title: '1:1 Square', desc: 'Instagram / Square Social' },
              ].map((opt) => {
                const active = aspectRatio === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setAspectRatio(opt.id as any)}
                    style={{
                      background: active ? 'var(--paper-subtle)' : 'var(--cream)',
                      border: `2px solid ${active ? 'var(--ochre)' : 'var(--border)'}`,
                      borderRadius: 6,
                      padding: '0.75rem',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--ink)' }}>
                      {opt.title}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--ink-muted)', marginTop: 2 }}>
                      {opt.desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Execution Controls */}
          <div
            style={{
              background: 'var(--cream)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: '1.25rem',
              marginBottom: '2rem',
            }}
          >
            <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.75rem' }}>
              Execution & Safety Governance
            </div>

            {/* Step-by-Step Manual Mode */}
            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.65rem',
                cursor: 'pointer',
                marginBottom: '0.85rem',
                padding: '0.7rem 0.85rem',
                borderRadius: 6,
                background: stepByStep ? '#eef5ff' : 'transparent',
                border: stepByStep ? '1px solid #b6d0f5' : '1px solid transparent',
                transition: 'all 0.2s ease',
              }}
            >
              <input
                type="checkbox"
                checked={stepByStep}
                onChange={(e) => setStepByStep(e.target.checked)}
                style={{ marginTop: 3 }}
              />
              <span style={{ fontSize: '0.85rem', color: 'var(--ink)' }}>
                <strong>🔬 Step-by-Step Manual Mode:</strong> Create job but pause immediately.
                You manually trigger and review each agent stage before proceeding to the next.
                Perfect for inspecting every agent output before it runs the next one.
              </span>
            </label>

            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.65rem',
                cursor: 'pointer',
                marginBottom: '0.75rem',
              }}
            >
              <input
                type="checkbox"
                checked={approvalMode}
                onChange={(e) => setApprovalMode(e.target.checked)}
                style={{ marginTop: 3, accentColor: 'var(--ink)' }}
              />
              <span style={{ fontSize: '0.85rem', color: 'var(--ink)' }}>
                <strong>Human Approval Gate:</strong> Pause pipeline after Stage 4 (Timing & Layout)
                to review script, visual concepts, and estimated costs before initiating video generation.
              </span>
            </label>

            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.65rem',
                cursor: 'pointer',
                marginBottom: '0.75rem',
              }}
            >
              <input
                type="checkbox"
                checked={isBackground}
                onChange={(e) => setIsBackground(e.target.checked)}
                style={{ marginTop: 3, accentColor: 'var(--ink)' }}
              />
              <span style={{ fontSize: '0.85rem', color: 'var(--ink)' }}>
                <strong>Asynchronous Background Execution:</strong> Dispatch job in background and
                redirect to live progress monitor (recommended for &gt;3 min jobs to avoid serverless timeouts).
              </span>
            </label>

            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.65rem',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={forceMock}
                onChange={(e) => setForceMock(e.target.checked)}
                style={{ marginTop: 3, accentColor: 'var(--ink)' }}
              />
              <span style={{ fontSize: '0.85rem', color: 'var(--ink)' }}>
                <strong>Zero-Spend Mock Mode:</strong> Check this only if you want to test deterministic offline fixtures without calling live APIs ($0.00). Unchecked = <strong>Live Provider APIs Active</strong>.
              </span>
            </label>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary"
            style={{ width: '100%', padding: '0.9rem', fontSize: '1.05rem' }}
          >
            {isSubmitting ? (
              <span>{stepByStep ? 'Creating Job (Paused)…' : 'Initiating 7-Agent Pipeline…'}</span>
            ) : (
              <span>
                {stepByStep
                  ? `🔬 Create Job & Enter Step-by-Step Mode →`
                  : `Launch Archival Collage Pipeline (${formatTime(targetSeconds)}) →`}
              </span>
            )}
          </button>
        </form>

        {/* Sidebar Info & Architecture */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="card" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.15rem', marginBottom: '0.5rem' }}>7-Agent Sequence</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--ink-muted)', marginBottom: '1rem' }}>
              Canonical pipeline per Agent Instructions v1.0:
            </p>

            <ol
              style={{
                paddingLeft: '1.25rem',
                margin: 0,
                fontSize: '0.85rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.6rem',
                color: 'var(--ink)',
              }}
            >
              <li>
                <strong>Idea Analyst:</strong> 3 angles, hooks, and sourced claims
              </li>
              <li>
                <strong>Scriptwriter:</strong> 145 WPM narration & claim traceability
              </li>
              <li>
                <strong>Visual Ideator:</strong> Archival collage prompts & motion
              </li>
              <li>
                <strong>Timing & Layout:</strong> 4–8s shot calibration & safe zones
              </li>
              <li style={{ color: 'var(--ochre-dark)' }}>
                <em>[Human Approval Gate]</em>
              </li>
              <li>
                <strong>Video Generator:</strong> Fal.ai image & video synthesis
              </li>
              <li>
                <strong>Compositor:</strong> Shotstack pan/zoom render
              </li>
              <li>
                <strong>Audio Mastering:</strong> ElevenLabs TTS, ducking & captions
              </li>
            </ol>
          </div>

          <div className="card" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.15rem', marginBottom: '0.5rem' }}>Pipeline Status</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--ink-muted)', marginBottom: '1rem' }}>
              Zero-compute API orchestration ready:
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <li style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Storage Driver</span>
                <strong style={{ fontFamily: 'var(--font-mono)' }}>Supabase / Memory</strong>
              </li>
              <li style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Max Target Duration</span>
                <strong style={{ fontFamily: 'var(--font-mono)' }}>20 Min (1200s)</strong>
              </li>
              <li style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Style Preset</span>
                <strong style={{ fontFamily: 'var(--font-mono)' }}>Archival Collage</strong>
              </li>
              <li style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Pacing Standard</span>
                <strong style={{ fontFamily: 'var(--font-mono)' }}>145 WPM</strong>
              </li>
            </ul>

            <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
              <Link href="/jobs" className="btn-secondary" style={{ display: 'block', textAlign: 'center' }}>
                View Jobs Dashboard →
              </Link>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}