'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import type { JobRecord, PipelineStage } from '@/lib/pipeline/orchestrator';

const STAGES: Array<{ id: PipelineStage; label: string; number: number; desc: string }> = [
  { id: 'idea_analyst', label: 'Idea Analyst', number: 1, desc: 'Research & 3 Angles' },
  { id: 'scriptwriter', label: 'Scriptwriter', number: 2, desc: '145 WPM Narration' },
  { id: 'visual_ideator', label: 'Visual Ideator', number: 3, desc: 'Collage Prompts & Motion' },
  { id: 'timing_layout', label: 'Timing & Layout', number: 4, desc: '4–8s Shot Calibration' },
  { id: 'video_generator', label: 'Video Generator', number: 5, desc: 'Fal.ai Asset Synthesis' },
  { id: 'compositor', label: 'Compositor', number: 6, desc: 'Shotstack Video Edit' },
  { id: 'audio_mastering', label: 'Audio Mastering', number: 7, desc: 'TTS, Sync & Loudness' },
];

export default function JobDetailPage({ params }: { params: { id: string } }) {
  const jobId = params.id;

  const [job, setJob] = useState<JobRecord | null>(null);
  const [activeTab, setActiveTab] = useState<PipelineStage | 'final' | 'telemetry'>('idea_analyst');
  const userSelectedTabRef = useRef(false);
  const [selectedAngleId, setSelectedAngleId] = useState<string | null>(null);
  const [forceMock, setForceMock] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSelectTab = (tab: PipelineStage | 'final' | 'telemetry') => {
    userSelectedTabRef.current = true;
    setActiveTab(tab);
  };

  const fetchJob = useCallback(async () => {
    try {
      const res = await fetch(`/api/jobs/${jobId}`);
      if (!res.ok) {
        if (res.status === 404) setErrorMsg('Job not found');
        return;
      }
      const data = await res.json();
      if (data.job) {
        setJob(data.job);
        if (data.job.config && typeof (data.job.config as any).forceMock === 'boolean') {
          setForceMock((data.job.config as any).forceMock);
        }
        if (data.job.research?.recommended_angle_id) {
          setSelectedAngleId((prev) => prev || data.job.research.recommended_angle_id);
        }
        // Only set active tab automatically if user hasn't manually picked a tab
        if (!userSelectedTabRef.current) {
          if (data.job.status === 'completed') {
            setActiveTab('final');
          } else if (data.job.current_stage) {
            setActiveTab(data.job.current_stage);
          }
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    fetchJob();

    // Auto-poll only while job is in progress or pending
    const interval = setInterval(() => {
      setJob((currentJob) => {
        if (currentJob && (currentJob.status === 'completed' || currentJob.status === 'failed')) {
          return currentJob;
        }
        fetchJob();
        return currentJob;
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [fetchJob]);

  const handleAction = async (action: 'approve' | 'resume' | 'retry') => {
    setIsActionLoading(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, forceMock }),
      });
      const data = await res.json();
      if (data.job) {
        setJob(data.job);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsActionLoading(false);
    }
  };

  // Run a specific stage via the step API (used in step-by-step mode)
  const handleRunStage = async (targetStage: PipelineStage, angleId?: string) => {
    setIsActionLoading(true);
    userSelectedTabRef.current = true;
    setActiveTab(targetStage === 'audio_mastering' ? 'final' : targetStage);
    try {
      const res = await fetch(`/api/jobs/${jobId}/step`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          forceMock,
          skipApproval: true,
          targetStage,
          approvedAngleId: angleId || selectedAngleId || job?.research?.recommended_angle_id,
        }),
      });
      const data = await res.json();
      if (data.job) {
        setJob(data.job);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleStepNext = async () => {
    setIsActionLoading(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/step`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceMock, skipApproval: job?.status === 'awaiting_approval' }),
      });
      const data = await res.json();
      if (data.job) {
        setJob(data.job);
        if (data.stage_executed) {
          setActiveTab(data.stage_executed === 'audio_mastering' ? 'final' : data.stage_executed);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsActionLoading(false);
    }
  };

  // Re-run and regenerate a specific stage (or current viewed stage)
  const handleRedoStage = async (explicitStage?: PipelineStage) => {
    let targetStage: PipelineStage;
    if (explicitStage) {
      targetStage = explicitStage;
    } else {
      const info = getActiveStageInfo();
      targetStage = info ? info.id : 'idea_analyst';
    }

    setIsActionLoading(true);
    userSelectedTabRef.current = true;
    setActiveTab(targetStage === 'audio_mastering' ? 'final' : targetStage);

    try {
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'redo',
          stage: targetStage,
          forceMock,
          approvedAngleId: selectedAngleId || job?.research?.recommended_angle_id,
        }),
      });
      const data = await res.json();
      if (data.job) {
        setJob(data.job);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsActionLoading(false);
    }
  };

  const isStageReady = (stage: PipelineStage): boolean => {
    if (!job) return false;
    switch (stage) {
      case 'idea_analyst':
        return !job.research;
      case 'scriptwriter':
        return Boolean(job.research) && !job.script;
      case 'visual_ideator':
        return Boolean(job.script) && !job.visual_plan;
      case 'timing_layout':
        return Boolean(job.visual_plan) && !job.timed_plan;
      case 'video_generator':
        return Boolean(job.timed_plan) && !job.video_assets;
      case 'compositor':
        return Boolean(job.video_assets) && !job.silent_video;
      case 'audio_mastering':
        return Boolean(job.silent_video) && !job.final_video;
      default:
        return false;
    }
  };

  const getStagePrevRequirement = (stage: PipelineStage): string => {
    switch (stage) {
      case 'scriptwriter': return 'Stage 1: Idea Analyst research';
      case 'visual_ideator': return 'Stage 2: Scriptwriter narration';
      case 'timing_layout': return 'Stage 3: Visual Ideator plan';
      case 'video_generator': return 'Stage 4: Timing & Layout specification';
      case 'compositor': return 'Stage 5: Video Generator assets';
      case 'audio_mastering': return 'Stage 6: Compositor silent video';
      default: return '';
    }
  };

  // Helper: renders a "Run Stage N" call-to-action banner inside a stage panel
  // Shown when this stage hasn't completed yet
  const StageRunBanner = ({
    stage,
    number,
    label,
  }: {
    stage: PipelineStage;
    number: number;
    label: string;
  }) => {
    const alreadyDone = isStageComplete(stage);
    if (alreadyDone) return null;

    const ready = isStageReady(stage);
    const isRunning = isActionLoading && (activeTab === stage || (activeTab === 'final' && stage === 'audio_mastering'));

    if (isRunning) {
      return (
        <div
          style={{
            background: '#eef5ff',
            border: '1px solid #b6d0f5',
            borderRadius: 8,
            padding: '1.25rem',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.85rem',
          }}
        >
          <span style={{ fontSize: '1.25rem' }}>⏳</span>
          <div>
            <div style={{ fontWeight: 600, color: '#2b5ea8' }}>
              Stage {number} ({label}) is executing…
            </div>
            <div style={{ fontSize: '0.82rem', color: '#4770ab', marginTop: 2 }}>
              Synthesizing agent output. This usually takes 2–10 seconds.
            </div>
          </div>
        </div>
      );
    }

    if (!ready) {
      return (
        <div
          style={{
            background: 'var(--paper-subtle)',
            border: '1px dashed var(--border)',
            borderRadius: 8,
            padding: '1rem 1.25rem',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            color: 'var(--ink-muted)',
            fontSize: '0.88rem',
          }}
        >
          <span style={{ fontSize: '1.1rem' }}>🔒</span>
          <span>
            Stage {number}: {label} is locked. Complete{' '}
            <strong>{getStagePrevRequirement(stage)}</strong> first.
          </span>
        </div>
      );
    }

    return (
      <div
        style={{
          background: '#f0fdf4',
          border: '1px solid #86efac',
          borderRadius: 8,
          padding: '1.25rem',
          marginBottom: '1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div style={{ fontWeight: 700, color: '#166534', fontSize: '1.02rem', marginBottom: 3 }}>
            ▶ Stage {number}: {label} — Ready to Run
          </div>
          <div style={{ fontSize: '0.85rem', color: '#15803d' }}>
            Click below to execute this stage and review the output before continuing.
          </div>
        </div>
        <button
          type="button"
          onClick={() => handleRunStage(stage)}
          disabled={isActionLoading}
          style={{
            background: '#16a34a',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            padding: '0.7rem 1.4rem',
            fontWeight: 700,
            fontSize: '0.95rem',
            cursor: isActionLoading ? 'not-allowed' : 'pointer',
            opacity: isActionLoading ? 0.6 : 1,
            whiteSpace: 'nowrap',
            boxShadow: '0 2px 4px rgba(22, 163, 74, 0.2)',
          }}
        >
          {isActionLoading ? '⏳ Running…' : `▶ Run Stage ${number}: ${label}`}
        </button>
      </div>
    );
  };

  // Helper: renders an approval & next stage advancement banner inside a completed stage panel
  const StageApprovalBanner = ({
    currentStage,
    currentNumber,
    currentLabel,
    nextStage,
    nextNumber,
    nextLabel,
    summaryText,
  }: {
    currentStage?: PipelineStage;
    currentNumber?: number;
    currentLabel?: string;
    nextStage: PipelineStage;
    nextNumber: number;
    nextLabel: string;
    summaryText: string;
  }) => {
    const isNextDone = isStageComplete(nextStage);
    const isRunning = isActionLoading;

    return (
      <div
        style={{
          marginTop: '2rem',
          padding: '1.25rem 1.5rem',
          background: isNextDone ? 'var(--paper-subtle)' : '#f0fdf4',
          border: `1px solid ${isNextDone ? 'var(--border)' : '#86efac'}`,
          borderRadius: 8,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div style={{ fontWeight: 700, color: isNextDone ? 'var(--ink)' : '#166534', fontSize: '0.98rem', marginBottom: 3 }}>
            ✓ {summaryText}
          </div>
          <div style={{ fontSize: '0.83rem', color: isNextDone ? 'var(--ink-muted)' : '#15803d' }}>
            {isNextDone
              ? `Stage ${nextNumber}: ${nextLabel} has already completed. Click to view its results.`
              : `Review the results above. When satisfied, click below to confirm and trigger Stage ${nextNumber}.`}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {currentStage && (
            <button
              type="button"
              onClick={() => handleRedoStage(currentStage)}
              disabled={isRunning}
              className="btn-secondary"
              style={{
                padding: '0.65rem 1rem',
                fontSize: '0.85rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
              title={`Re-run Stage ${currentNumber} (${currentLabel}) to generate fresh results`}
            >
              <span>↻</span>
              <span>Redo Stage {currentNumber}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              if (isNextDone) {
                handleSelectTab(nextStage === 'audio_mastering' ? 'final' : nextStage);
              } else {
                handleRunStage(nextStage);
              }
            }}
            disabled={isRunning}
            style={{
              background: isNextDone ? 'var(--ink)' : '#16a34a',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              padding: '0.7rem 1.35rem',
              fontWeight: 700,
              fontSize: '0.92rem',
              cursor: isRunning ? 'not-allowed' : 'pointer',
              opacity: isRunning ? 0.6 : 1,
              whiteSpace: 'nowrap',
            }}
          >
            {isRunning
              ? '⏳ Running…'
              : isNextDone
              ? `View Stage ${nextNumber}: ${nextLabel} →`
              : `✓ Approve & Run Stage ${nextNumber}: ${nextLabel} →`}
          </button>
        </div>
      </div>
    );
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const rem = Math.round(secs % 60);
    return `${mins}:${rem < 10 ? '0' : ''}${rem}`;
  };

  const isStageComplete = (stage: PipelineStage): boolean => {
    if (!job) return false;
    switch (stage) {
      case 'idea_analyst':
        return Boolean(job.research);
      case 'scriptwriter':
        return Boolean(job.script);
      case 'visual_ideator':
        return Boolean(job.visual_plan);
      case 'timing_layout':
        return Boolean(job.timed_plan);
      case 'video_generator':
        return Boolean(job.video_assets);
      case 'compositor':
        return Boolean(job.silent_video);
      case 'audio_mastering':
        return Boolean(job.final_video);
      default:
        return false;
    }
  };

  const getLatestCompletedStage = (): { id: PipelineStage; number: number; label: string } | null => {
    if (!job) return null;
    if (job.final_video) return { id: 'audio_mastering', number: 7, label: 'Audio Mastering' };
    if (job.silent_video) return { id: 'compositor', number: 6, label: 'Compositor' };
    if (job.video_assets) return { id: 'video_generator', number: 5, label: 'Video Generator' };
    if (job.timed_plan) return { id: 'timing_layout', number: 4, label: 'Timing & Layout' };
    if (job.visual_plan) return { id: 'visual_ideator', number: 3, label: 'Visual Ideator' };
    if (job.script) return { id: 'scriptwriter', number: 2, label: 'Scriptwriter' };
    if (job.research) return { id: 'idea_analyst', number: 1, label: 'Idea Analyst' };
    return null;
  };

  const getActiveStageInfo = (): { id: PipelineStage; number: number; label: string } | null => {
    if (activeTab === 'final' || activeTab === 'audio_mastering') {
      return { id: 'audio_mastering', number: 7, label: 'Audio Mastering' };
    }
    const found = STAGES.find((s) => s.id === activeTab);
    if (found) {
      if (!isStageComplete(found.id)) {
        const latest = getLatestCompletedStage();
        return latest || { id: found.id, number: found.number, label: found.label };
      }
      return { id: found.id, number: found.number, label: found.label };
    }
    return getLatestCompletedStage();
  };

  if (isLoading) {
    return (
      <main className="container" style={{ padding: '4rem 1.5rem', textAlign: 'center' }}>
        <p style={{ color: 'var(--ink-muted)' }}>Loading job state for {jobId}…</p>
      </main>
    );
  }

  if (errorMsg || !job) {
    return (
      <main className="container" style={{ padding: '4rem 1.5rem', textAlign: 'center' }}>
        <div className="card" style={{ maxWidth: 540, margin: '0 auto', padding: '3rem' }}>
          <h2 style={{ color: 'var(--red)', marginBottom: '0.5rem' }}>{errorMsg || 'Job Not Found'}</h2>
          <p style={{ color: 'var(--ink-muted)', marginBottom: '1.5rem' }}>
            We could not locate job <code>{jobId}</code> in storage.
          </p>
          <Link href="/jobs" className="btn-primary">
            ← Return to Jobs Dashboard
          </Link>
        </div>
      </main>
    );
  }

  const activeStageObj = getActiveStageInfo();

  return (
    <main className="container" style={{ padding: '2.5rem 1.5rem 5rem' }}>
      {/* Breadcrumb Navigation */}
      <div style={{ marginBottom: '1rem', fontSize: '0.85rem' }}>
        <Link href="/jobs" style={{ color: 'var(--ink-muted)' }}>
          ← Jobs Dashboard
        </Link>
      </div>

      {/* Top Header Card */}
      <div className="card" style={{ marginBottom: '2rem', padding: '2rem' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '1.5rem',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
              <span className={`status-pill status-${job.status}`}>
                ● {job.status.replace('_', ' ')}
              </span>
              <button
                type="button"
                onClick={() => setForceMock(!forceMock)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.2rem 0.6rem',
                  borderRadius: 12,
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: '1px solid var(--border)',
                  background: forceMock ? 'var(--cream)' : 'var(--blue-light)',
                  color: forceMock ? 'var(--ink)' : 'var(--blue)',
                }}
                title="Toggle execution mode between local zero-cost mock and live provider APIs"
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    backgroundColor: forceMock ? '#296846' : '#2b5ea8',
                  }}
                />
                {forceMock ? 'Mock Mode ($0.00)' : 'Live Provider API'}
              </button>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--ink-light)' }}>
                Job ID: {job.job_id}
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--ink-muted)' }}>
                · Target Runtime: <strong>{formatTime(job.target_seconds)}</strong> ({job.target_seconds}s)
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--ink-muted)' }}>
                · Aspect: <strong>{job.aspects?.join(', ')}</strong>
              </span>
            </div>

            <h1 style={{ fontSize: '2rem', margin: '0 0 0.5rem', fontWeight: 700 }}>
              {job.topic}
            </h1>
            <p style={{ margin: 0, color: 'var(--ink-muted)', fontSize: '0.9rem' }}>
              Archival Explainer Pipeline · 7 Stages · Total API Spend: ${job.cost?.total_usd?.toFixed(4) ?? '0.0000'}
            </p>
          </div>

          {/* Action Button Controls */}
          <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {job.status === 'awaiting_approval' && (
              <button
                type="button"
                onClick={() => handleAction('approve')}
                disabled={isActionLoading}
                className="btn-accent"
                style={{ padding: '0.75rem 1.5rem' }}
              >
                {isActionLoading ? 'Resuming…' : '✓ Approve & Generate Video'}
              </button>
            )}

            {job.status !== 'completed' && (
              <button
                type="button"
                onClick={handleStepNext}
                disabled={isActionLoading}
                className="btn-secondary"
                style={{ padding: '0.75rem 1.25rem' }}
              >
                {isActionLoading ? 'Advancing…' : 'Advance Next Stage →'}
              </button>
            )}

            {job.status === 'failed' && (
              <button
                type="button"
                onClick={() => handleAction('retry')}
                disabled={isActionLoading}
                className="btn-primary"
                style={{ padding: '0.75rem 1.25rem' }}
              >
                {isActionLoading ? 'Retrying…' : '↻ Retry Failed Stage'}
              </button>
            )}

            {job.status !== 'completed' && activeStageObj && (
              <button
                type="button"
                onClick={() => handleRedoStage(activeStageObj.id)}
                disabled={isActionLoading}
                className="btn-secondary"
                style={{
                  padding: '0.75rem 1.15rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  fontWeight: 600,
                  cursor: isActionLoading ? 'not-allowed' : 'pointer',
                }}
                title={`Re-run Stage ${activeStageObj.number} (${activeStageObj.label}) to regenerate fresh results`}
              >
                <span>↻</span>
                <span>
                  {isActionLoading ? 'Redoing…' : `Redo Stage ${activeStageObj.number}`}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() => fetchJob()}
              disabled={isActionLoading}
              className="btn-secondary"
              style={{ padding: '0.75rem' }}
              title="Refresh State from Storage"
            >
              🔄
            </button>
          </div>
        </div>

        {/* Step-by-Step Guidance Banner */}
        {job.status === 'pending' && !job.research && (
          <div
            style={{
              marginTop: '1.5rem',
              background: '#f0fdf4',
              border: '1px solid #86efac',
              padding: '1rem 1.25rem',
              borderRadius: 6,
              color: '#166534',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1rem',
            }}
          >
            <div>
              <strong>🔬 Step-by-Step Mode Active: Pipeline Ready to Start</strong>
              <div style={{ fontSize: '0.85rem', marginTop: 2 }}>
                Click below to start Stage 1 (Idea Analyst) and review 3 synthesized angles and sourced claims before advancing.
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleRunStage('idea_analyst')}
              disabled={isActionLoading}
              className="btn-accent"
              style={{ padding: '0.55rem 1.25rem', fontSize: '0.88rem' }}
            >
              {isActionLoading ? 'Running…' : '▶ Start Stage 1: Idea Analyst'}
            </button>
          </div>
        )}

        {/* Approval Alert Banner */}
        {job.status === 'awaiting_approval' && (
          <div
            style={{
              marginTop: '1.5rem',
              background: '#fff8eb',
              border: '1px solid #fbd38d',
              padding: '1rem 1.25rem',
              borderRadius: 6,
              color: '#8c6a32',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1rem',
            }}
          >
            <div>
              <strong>Checkpoint: Script & Visual Plan Awaiting Approval</strong>
              <div style={{ fontSize: '0.85rem', marginTop: 2 }}>
                Review the research, narration script, and timed layout below. Once approved, the
                pipeline will initiate paid video generation and compositor rendering.
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => handleRedoStage('timing_layout')}
                disabled={isActionLoading}
                className="btn-secondary"
                style={{ padding: '0.55rem 1rem', fontSize: '0.88rem' }}
                title="Re-run Stage 4 (Timing & Layout) with fresh pacing calibration"
              >
                ↻ Redo Stage 4 (Layout)
              </button>
              <button
                type="button"
                onClick={() => handleRedoStage('scriptwriter')}
                disabled={isActionLoading}
                className="btn-secondary"
                style={{ padding: '0.55rem 1rem', fontSize: '0.88rem' }}
                title="Re-run Stage 2 (Scriptwriter) to draft a fresh script"
              >
                ↻ Redo Stage 2 (Script)
              </button>
              <button
                type="button"
                onClick={() => handleAction('approve')}
                disabled={isActionLoading}
                className="btn-accent"
                style={{ padding: '0.55rem 1.25rem', fontSize: '0.88rem' }}
              >
                Confirm & Continue Generation →
              </button>
            </div>
          </div>
        )}

        {/* Error Banner */}
        {job.error && (
          <div
            style={{
              marginTop: '1.5rem',
              background: '#fef2f2',
              border: '1px solid #fca5a5',
              padding: '1.1rem 1.25rem',
              borderRadius: 6,
              color: '#991b1b',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1rem',
            }}
          >
            <div>
              <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.95rem' }}>
                <span>⚠️</span>
                <span>Stage Error: {job.error.code || 'PIPELINE_ERROR'}</span>
              </div>
              <div style={{ fontSize: '0.88rem', marginTop: 4, color: '#7f1d1d' }}>
                {job.error.message}
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleAction('retry')}
              disabled={isActionLoading}
              className="btn-primary"
              style={{ padding: '0.55rem 1.25rem', fontSize: '0.88rem', background: '#dc2626', borderColor: '#b91c1c' }}
            >
              {isActionLoading ? 'Retrying…' : '↻ Retry Stage'}
            </button>
          </div>
        )}
      </div>

      {/* 7-Stage Horizontal Stepper */}
      <div
        className="card"
        style={{
          marginBottom: '2rem',
          padding: '1.25rem 1.5rem',
          overflowX: 'auto',
        }}
      >
        <div style={{ display: 'flex', minWidth: 780, justifyContent: 'space-between', position: 'relative' }}>
          {STAGES.map((st, idx) => {
            const completed = isStageComplete(st.id);
            const active = job.current_stage === st.id;
            const selected = activeTab === st.id;

            let badgeColor = 'var(--cream)';
            let textColor = 'var(--ink-muted)';
            let borderColor = 'var(--border)';

            if (completed) {
              badgeColor = 'var(--green-light)';
              textColor = 'var(--green)';
              borderColor = '#b8dfcb';
            } else if (active) {
              badgeColor = 'var(--blue-light)';
              textColor = 'var(--blue)';
              borderColor = '#c2dbf3';
            }

            return (
              <button
                key={st.id}
                type="button"
                onClick={() => handleSelectTab(st.id)}
                style={{
                  background: selected ? 'var(--paper-subtle)' : 'transparent',
                  border: `1px solid ${selected ? 'var(--ochre)' : 'transparent'}`,
                  borderRadius: 6,
                  padding: '0.65rem 0.5rem',
                  flex: 1,
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: badgeColor,
                    color: textColor,
                    border: `1px solid ${borderColor}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 0.4rem',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                  }}
                >
                  {completed ? '✓' : st.number}
                </div>
                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--ink)' }}>
                  {st.label}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--ink-light)', marginTop: 2 }}>
                  {st.desc}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Inspector Tabs Header */}
      <div
        style={{
          display: 'flex',
          gap: '0.4rem',
          borderBottom: '1px solid var(--border)',
          paddingBottom: '0.6rem',
          marginBottom: '1.5rem',
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          onClick={() => handleSelectTab('idea_analyst')}
          style={{
            background: activeTab === 'idea_analyst' ? 'var(--ink)' : 'transparent',
            color: activeTab === 'idea_analyst' ? 'var(--paper)' : 'var(--ink-muted)',
            border: 'none',
            borderRadius: 4,
            padding: '0.45rem 0.9rem',
            fontSize: '0.88rem',
            fontWeight: activeTab === 'idea_analyst' ? 600 : 500,
          }}
        >
          1. Research {job.research ? '✓' : ''}
        </button>

        <button
          type="button"
          onClick={() => handleSelectTab('scriptwriter')}
          style={{
            background: activeTab === 'scriptwriter' ? 'var(--ink)' : 'transparent',
            color: activeTab === 'scriptwriter' ? 'var(--paper)' : 'var(--ink-muted)',
            border: 'none',
            borderRadius: 4,
            padding: '0.45rem 0.9rem',
            fontSize: '0.88rem',
            fontWeight: activeTab === 'scriptwriter' ? 600 : 500,
          }}
        >
          2. Script {job.script ? '✓' : ''}
        </button>

        <button
          type="button"
          onClick={() => handleSelectTab('visual_ideator')}
          style={{
            background: activeTab === 'visual_ideator' ? 'var(--ink)' : 'transparent',
            color: activeTab === 'visual_ideator' ? 'var(--paper)' : 'var(--ink-muted)',
            border: 'none',
            borderRadius: 4,
            padding: '0.45rem 0.9rem',
            fontSize: '0.88rem',
            fontWeight: activeTab === 'visual_ideator' ? 600 : 500,
          }}
        >
          3. Visual Plan {job.visual_plan ? '✓' : ''}
        </button>

        <button
          type="button"
          onClick={() => handleSelectTab('timing_layout')}
          style={{
            background: activeTab === 'timing_layout' ? 'var(--ink)' : 'transparent',
            color: activeTab === 'timing_layout' ? 'var(--paper)' : 'var(--ink-muted)',
            border: 'none',
            borderRadius: 4,
            padding: '0.45rem 0.9rem',
            fontSize: '0.88rem',
            fontWeight: activeTab === 'timing_layout' ? 600 : 500,
          }}
        >
          4. Timing & Layout {job.timed_plan ? '✓' : ''}
        </button>

        <button
          type="button"
          onClick={() => handleSelectTab('video_generator')}
          style={{
            background: activeTab === 'video_generator' ? 'var(--ink)' : 'transparent',
            color: activeTab === 'video_generator' ? 'var(--paper)' : 'var(--ink-muted)',
            border: 'none',
            borderRadius: 4,
            padding: '0.45rem 0.9rem',
            fontSize: '0.88rem',
            fontWeight: activeTab === 'video_generator' ? 600 : 500,
          }}
        >
          5. Assets {job.video_assets ? '✓' : ''}
        </button>

        <button
          type="button"
          onClick={() => handleSelectTab('compositor')}
          style={{
            background: activeTab === 'compositor' ? 'var(--ink)' : 'transparent',
            color: activeTab === 'compositor' ? 'var(--paper)' : 'var(--ink-muted)',
            border: 'none',
            borderRadius: 4,
            padding: '0.45rem 0.9rem',
            fontSize: '0.88rem',
            fontWeight: activeTab === 'compositor' ? 600 : 500,
          }}
        >
          6. Composition {job.silent_video ? '✓' : ''}
        </button>

        <button
          type="button"
          onClick={() => handleSelectTab('final')}
          style={{
            background: (activeTab === 'final' || activeTab === 'audio_mastering') ? 'var(--ink)' : 'transparent',
            color: (activeTab === 'final' || activeTab === 'audio_mastering') ? 'var(--paper)' : 'var(--ink-muted)',
            border: 'none',
            borderRadius: 4,
            padding: '0.45rem 0.9rem',
            fontSize: '0.88rem',
            fontWeight: (activeTab === 'final' || activeTab === 'audio_mastering') ? 600 : 500,
          }}
        >
          7. Final Video {job.final_video ? '✓' : ''}
        </button>

        <button
          type="button"
          onClick={() => handleSelectTab('telemetry')}
          style={{
            background: activeTab === 'telemetry' ? 'var(--ink)' : 'transparent',
            color: activeTab === 'telemetry' ? 'var(--paper)' : 'var(--ink-muted)',
            border: 'none',
            borderRadius: 4,
            padding: '0.45rem 0.9rem',
            fontSize: '0.88rem',
            fontWeight: activeTab === 'telemetry' ? 600 : 500,
          }}
        >
          Cost & Telemetry
        </button>
      </div>

      {/* Tab Panels */}

      {/* 1. Research Tab */}
      {activeTab === 'idea_analyst' && (
        <div className="card">
          <StageRunBanner stage="idea_analyst" number={1} label="Idea Analyst" />
          <h2 style={{ fontSize: '1.4rem', marginBottom: '0.5rem' }}>Stage 1: Idea Analyst Research</h2>
          {!job.research ? (
            <p style={{ color: 'var(--ink-muted)' }}>Research stage has not executed yet.</p>
          ) : (
            <div>
              <p style={{ color: 'var(--ink-muted)', marginBottom: '1.5rem' }}>
                Researched topic and synthesized {job.research.angles?.length || 0} distinct angles,{' '}
                {job.research.claims?.length || 0} claims, and proposal hooks.
              </p>

              <h3 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>
                3 Distinct Angles (Click to select for script)
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                {job.research.angles?.map((angle) => {
                  const isRec = angle.angle_id === job.research?.recommended_angle_id;
                  const isSelected = selectedAngleId === angle.angle_id || (!selectedAngleId && isRec);
                  return (
                    <div
                      key={angle.angle_id}
                      onClick={() => setSelectedAngleId(angle.angle_id)}
                      style={{
                        background: isSelected ? '#fefce8' : isRec ? 'var(--cream)' : 'var(--paper-subtle)',
                        border: `2px solid ${isSelected ? 'var(--ochre-dark)' : isRec ? 'var(--ochre)' : 'var(--border)'}`,
                        borderRadius: 6,
                        padding: '1.25rem',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        boxShadow: isSelected ? '0 2px 8px rgba(180, 83, 9, 0.15)' : 'none',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        {isRec ? (
                          <span
                            style={{
                              background: 'var(--ochre-dark)',
                              color: 'white',
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              padding: '0.15rem 0.45rem',
                              borderRadius: 3,
                              textTransform: 'uppercase',
                              display: 'inline-block',
                            }}
                          >
                            Recommended
                          </span>
                        ) : <span />}
                        {isSelected && (
                          <span
                            style={{
                              background: '#16a34a',
                              color: 'white',
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              padding: '0.15rem 0.45rem',
                              borderRadius: 3,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 3,
                            }}
                          >
                            ✓ Selected for Script
                          </span>
                        )}
                      </div>
                      <h4 style={{ margin: '0 0 0.5rem', fontSize: '1.05rem' }}>{angle.title}</h4>
                      <p style={{ fontSize: '0.85rem', color: 'var(--ink-muted)', margin: '0 0 0.5rem' }}>
                        {angle.summary}
                      </p>
                      <div style={{ fontSize: '0.8rem', fontStyle: 'italic', color: 'var(--ink)' }}>
                        &ldquo;{angle.central_question}&rdquo;
                      </div>
                    </div>
                  );
                })}
              </div>

              <h3 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>Verified Sourced Claims</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {job.research.claims?.map((claim) => (
                  <div
                    key={claim.claim_id}
                    style={{
                      background: 'var(--paper-subtle)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 4,
                      padding: '0.75rem 1rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                      gap: '1rem',
                    }}
                  >
                    <div>
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.72rem',
                          color: 'var(--ochre-dark)',
                          marginRight: '0.5rem',
                          fontWeight: 600,
                        }}
                      >
                        [{claim.claim_id}]
                      </span>
                      <span style={{ fontSize: '0.88rem' }}>{claim.claim}</span>
                    </div>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontFamily: 'var(--font-mono)',
                        background: 'var(--cream)',
                        padding: '0.15rem 0.45rem',
                        borderRadius: 3,
                        color: 'var(--ink-muted)',
                      }}
                    >
                      {claim.support_status}
                    </span>
                  </div>
                ))}
              </div>

              <StageApprovalBanner
                currentStage="idea_analyst"
                currentNumber={1}
                currentLabel="Idea Analyst"
                nextStage="scriptwriter"
                nextNumber={2}
                nextLabel="Scriptwriter"
                summaryText="Stage 1: Idea Analyst Research Complete"
              />
            </div>
          )}
        </div>
      )}

      {/* 2. Script Tab */}
      {activeTab === 'scriptwriter' && (
        <div className="card">
          <StageRunBanner stage="scriptwriter" number={2} label="Scriptwriter" />
          <h2 style={{ fontSize: '1.4rem', marginBottom: '0.5rem' }}>Stage 2: Scriptwriter Narration</h2>
          {!job.script ? (
            <p style={{ color: 'var(--ink-muted)' }}>Scriptwriter stage has not executed yet.</p>
          ) : (
            <div>
              <div
                style={{
                  display: 'flex',
                  gap: '1.5rem',
                  fontSize: '0.85rem',
                  color: 'var(--ink-muted)',
                  borderBottom: '1px solid var(--border)',
                  paddingBottom: '1rem',
                  marginBottom: '1.5rem',
                  flexWrap: 'wrap',
                }}
              >
                <span>
                  <strong>Title:</strong> {job.script.title}
                </span>
                <span>
                  <strong>Target Words:</strong> {job.script.target_word_count}
                </span>
                <span>
                  <strong>Estimated Duration:</strong> {formatTime(job.script.estimated_duration_seconds)}
                </span>
                <span>
                  <strong>Scene Count:</strong> {job.script.scenes?.length} scenes
                </span>
              </div>

              <h3 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>Scene-by-Scene Breakdown</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {job.script.scenes?.map((scene) => (
                  <div
                    key={scene.scene_id}
                    style={{
                      background: 'var(--paper-subtle)',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      padding: '1rem 1.25rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.8rem', color: 'var(--ochre-dark)' }}>
                        SCENE {scene.scene_id} · [{scene.narrative_function.toUpperCase()}]
                      </span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--ink-light)' }}>
                        ~{scene.word_count} words ({scene.estimated_seconds}s)
                      </span>
                    </div>

                    <p style={{ fontSize: '0.98rem', margin: '0 0 0.5rem', lineHeight: 1.6, color: 'var(--ink)' }}>
                      &ldquo;{scene.narration}&rdquo;
                    </p>

                    <div style={{ display: 'flex', gap: '1rem', fontSize: '0.78rem', color: 'var(--ink-muted)', flexWrap: 'wrap' }}>
                      {scene.on_screen_text_suggestion && (
                        <span>
                          <strong>Overlay:</strong> &ldquo;{scene.on_screen_text_suggestion}&rdquo;
                        </span>
                      )}
                      {scene.visual_concept && (
                        <span>
                          <strong>Concept:</strong> {scene.visual_concept}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <StageApprovalBanner
                currentStage="scriptwriter"
                currentNumber={2}
                currentLabel="Scriptwriter"
                nextStage="visual_ideator"
                nextNumber={3}
                nextLabel="Visual Ideator"
                summaryText="Stage 2: Scriptwriter Narration Complete"
              />
            </div>
          )}
        </div>
      )}

      {/* 3. Visual Plan Tab */}
      {activeTab === 'visual_ideator' && (
        <div className="card">
          <StageRunBanner stage="visual_ideator" number={3} label="Visual Ideator" />
          <h2 style={{ fontSize: '1.4rem', marginBottom: '0.5rem' }}>Stage 3: Visual Ideator Plan</h2>
          {!job.visual_plan ? (
            <p style={{ color: 'var(--ink-muted)' }}>Visual Ideator stage has not executed yet.</p>
          ) : (
            <div>
              <p style={{ color: 'var(--ink-muted)', marginBottom: '1.5rem' }}>
                Style Preset: <strong>{job.visual_plan.style_preset}</strong> · Palette:{' '}
                {job.visual_plan.global_art_direction?.palette?.join(', ')}
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {job.visual_plan.scene_visuals?.map((sv) => (
                  <div
                    key={sv.scene_id}
                    style={{
                      background: 'var(--paper-subtle)',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      padding: '1rem 1.25rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.8rem', color: 'var(--ochre-dark)' }}>
                        SCENE {sv.scene_id} · [{sv.visual_type.toUpperCase()}]
                      </span>
                      <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--ink-muted)' }}>
                        Motion: {sv.motion_direction}
                      </span>
                    </div>

                    <div style={{ marginBottom: '0.4rem', fontSize: '0.88rem' }}>
                      <strong>Image Prompt:</strong> {sv.image_prompt}
                    </div>

                    {sv.overlay_text && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--ink-muted)' }}>
                        <strong>Overlay Text:</strong> {sv.overlay_text}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <StageApprovalBanner
                currentStage="visual_ideator"
                currentNumber={3}
                currentLabel="Visual Ideator"
                nextStage="timing_layout"
                nextNumber={4}
                nextLabel="Timing & Layout"
                summaryText="Stage 3: Visual Ideator Plan Complete"
              />
            </div>
          )}
        </div>
      )}

      {/* 4. Timing & Layout Tab */}
      {activeTab === 'timing_layout' && (
        <div className="card">
          <StageRunBanner stage="timing_layout" number={4} label="Timing & Layout" />
          <h2 style={{ fontSize: '1.4rem', marginBottom: '0.5rem' }}>Stage 4: Timing & Layout Specification</h2>
          {!job.timed_plan ? (
            <p style={{ color: 'var(--ink-muted)' }}>Timing & Layout stage has not executed yet.</p>
          ) : (
            <div>
              <div
                style={{
                  display: 'flex',
                  gap: '1.5rem',
                  fontSize: '0.85rem',
                  color: 'var(--ink-muted)',
                  borderBottom: '1px solid var(--border)',
                  paddingBottom: '1rem',
                  marginBottom: '1.5rem',
                }}
              >
                <span>
                  <strong>Planned Seconds:</strong> {job.timed_plan.planned_seconds}s
                </span>
                <span>
                  <strong>Target Seconds:</strong> {job.timed_plan.target_seconds}s
                </span>
                <span>
                  <strong>Pacing:</strong> {job.config.pacing_wpm || 145} WPM
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {job.timed_plan.scenes?.map((ts) => (
                  <div
                    key={ts.scene_id}
                    style={{
                      background: 'var(--paper-subtle)',
                      border: '1px solid var(--border)',
                      borderRadius: 4,
                      padding: '0.75rem 1rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '0.75rem',
                    }}
                  >
                    <div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.8rem', color: 'var(--ochre-dark)', marginRight: '0.5rem' }}>
                        SCENE {ts.scene_id}
                      </span>
                      <span style={{ fontSize: '0.85rem' }}>
                        {ts.overlay?.text ? `Overlay: "${ts.overlay.text}"` : 'Visual Cut'}
                      </span>
                    </div>

                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--ink-muted)' }}>
                      [{ts.start_seconds.toFixed(1)}s → {ts.end_seconds.toFixed(1)}s] · Duration:{' '}
                      {ts.duration_seconds.toFixed(1)}s
                    </div>
                  </div>
                ))}
              </div>

              <StageApprovalBanner
                currentStage="timing_layout"
                currentNumber={4}
                currentLabel="Timing & Layout"
                nextStage="video_generator"
                nextNumber={5}
                nextLabel="Video Generator"
                summaryText="Stage 4: Timing & Layout Specification Complete"
              />
            </div>
          )}
        </div>
      )}

      {/* 5. Video Assets Tab */}
      {activeTab === 'video_generator' && (
        <div className="card">
          <StageRunBanner stage="video_generator" number={5} label="Video Generator" />
          <h2 style={{ fontSize: '1.4rem', marginBottom: '0.5rem' }}>Stage 5: Generated Video Assets</h2>
          {!job.video_assets ? (
            <p style={{ color: 'var(--ink-muted)' }}>Video Generator stage has not executed yet.</p>
          ) : (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <p style={{ color: 'var(--ink-muted)', margin: 0 }}>
                  Generated {job.video_assets.scenes?.length || 0} of {job.timed_plan?.scenes?.length || 0} visual assets
                  via Fal.ai adapter ({job.video_assets.scenes?.filter((s) => s.status === 'generated').length || 0} Kling motion clips).
                </p>
                {job.video_assets.total_actual_cost_usd > 0 && (
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', fontWeight: 600, color: '#166534', background: '#dcfce7', padding: '0.2rem 0.6rem', borderRadius: 4 }}>
                    Est. Cost: ${job.video_assets.total_actual_cost_usd.toFixed(3)} USD
                  </span>
                )}
              </div>

              {/* Warnings & Fal.ai balance notification */}
              {job.video_assets.warnings && job.video_assets.warnings.length > 0 && (
                <div
                  style={{
                    background: job.video_assets.warnings.some((w) => w.includes('TOP_UP') || w.includes('403')) ? '#fef2f2' : '#fffbeb',
                    border: `1px solid ${job.video_assets.warnings.some((w) => w.includes('TOP_UP') || w.includes('403')) ? '#fca5a5' : '#fef08a'}`,
                    borderRadius: 6,
                    padding: '1rem 1.25rem',
                    marginBottom: '1.25rem',
                    fontSize: '0.85rem',
                    color: job.video_assets.warnings.some((w) => w.includes('TOP_UP') || w.includes('403')) ? '#991b1b' : '#854d0e',
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span>{job.video_assets.warnings.some((w) => w.includes('TOP_UP') || w.includes('403')) ? '⚠️ Fal.ai Balance Exhausted (TOP_UP Required)' : 'ℹ️ Video Generation Fallback Notices'}</span>
                  </div>
                  <div>
                    {job.video_assets.warnings.some((w) => w.includes('TOP_UP') || w.includes('403')) ? (
                      <p style={{ margin: '0 0 0.5rem' }}>
                        Your Fal.ai balance was depleted during generation. Scenes up to SC10 were successfully created with Kling v1.6 motion, but subsequent scenes automatically fell back to Ken Burns placeholders to protect pipeline progress. Please top up your balance at <a href="https://fal.ai/dashboard/billing" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline', fontWeight: 600 }}>fal.ai/dashboard/billing</a> and then click <strong>Redo Stage 5</strong>. Your already-generated clips will be kept!
                      </p>
                    ) : null}
                    <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
                      {job.video_assets.warnings.slice(0, 5).map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                      {job.video_assets.warnings.length > 5 && (
                        <li>...and {job.video_assets.warnings.length - 5} more scenes fell back.</li>
                      )}
                    </ul>
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
                {job.video_assets.scenes?.map((sc) => (
                  <div
                    key={sc.scene_id}
                    style={{
                      background: 'var(--paper-subtle)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      padding: '1rem',
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.85rem' }}>
                        SCENE {sc.scene_id} ({sc.duration_s}s)
                      </span>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          padding: '0.15rem 0.45rem',
                          borderRadius: 4,
                          fontWeight: 600,
                          background: sc.status === 'generated' ? '#dcfce7' : '#fef3c7',
                          color: sc.status === 'generated' ? '#166534' : '#92400e',
                        }}
                      >
                        {sc.status === 'generated' ? '🎬 Kling Motion Clip' : '🖼️ Ken Burns Motion'}
                      </span>
                    </div>

                    {sc.video_url && !sc.video_url.includes('mock-supabase') ? (
                      <video
                        src={sc.video_url}
                        controls
                        playsInline
                        preload="metadata"
                        style={{ width: '100%', maxHeight: 180, borderRadius: 6, background: '#000', marginBottom: '0.65rem' }}
                      />
                    ) : sc.image_url && !sc.image_url.includes('mock-supabase') ? (
                      <img
                        src={sc.image_url}
                        alt={`Scene ${sc.scene_id}`}
                        style={{ width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: 6, marginBottom: '0.65rem' }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '100%',
                          height: 120,
                          background: 'var(--border)',
                          borderRadius: 6,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--ink-muted)',
                          fontSize: '0.8rem',
                          marginBottom: '0.65rem',
                        }}
                      >
                        Mock Video Clip ({sc.duration_s}s)
                      </div>
                    )}

                    <div style={{ fontSize: '0.76rem', color: 'var(--ink-muted)', wordBreak: 'break-all', marginTop: 'auto' }}>
                      {sc.video_url && (
                        <div>
                          <strong>Video URL:</strong>{' '}
                          <a href={sc.video_url} target="_blank" rel="noopener noreferrer">
                            {sc.video_url.slice(0, 45)}…
                          </a>
                        </div>
                      )}
                      {sc.image_url && !sc.video_url && (
                        <div>
                          <strong>Image URL:</strong>{' '}
                          <a href={sc.image_url} target="_blank" rel="noopener noreferrer">
                            {sc.image_url.slice(0, 45)}…
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <StageApprovalBanner
                currentStage="video_generator"
                currentNumber={5}
                currentLabel="Video Generator"
                nextStage="compositor"
                nextNumber={6}
                nextLabel="Compositor"
                summaryText="Stage 5: Video Generator Assets Complete"
              />
            </div>
          )}
        </div>
      )}

      {/* 6. Compositor Tab */}
      {activeTab === 'compositor' && (
        <div className="card">
          <StageRunBanner stage="compositor" number={6} label="Compositor" />
          <h2 style={{ fontSize: '1.4rem', marginBottom: '0.5rem' }}>Stage 6: Compositor Silent Video</h2>
          {!job.silent_video ? (
            <p style={{ color: 'var(--ink-muted)' }}>Compositor stage has not executed yet.</p>
          ) : (
            <div>
              <p style={{ color: 'var(--ink-muted)', marginBottom: '1.5rem' }}>
                Shotstack compositing render completed: Duration: {job.silent_video.duration_s}s ·
                Aspect: {job.silent_video.aspect_ratio || '16:9'} · Scenes: {job.silent_video.scene_count || 0}
              </p>

              <div style={{ padding: '1.5rem', background: 'var(--paper-subtle)', borderRadius: 6, border: '1px solid var(--border)' }}>
                <div style={{ marginBottom: '0.5rem' }}>
                  <strong>Silent Video Output:</strong>{' '}
                  <a href={job.silent_video.silent_video_url} target="_blank" rel="noopener noreferrer">
                    {job.silent_video.silent_video_url}
                  </a>
                </div>
                {job.silent_video.thumbnail_url && (
                  <div>
                    <strong>Thumbnail URL:</strong>{' '}
                    <a href={job.silent_video.thumbnail_url} target="_blank" rel="noopener noreferrer">
                      {job.silent_video.thumbnail_url}
                    </a>
                  </div>
                )}
              </div>

              <StageApprovalBanner
                currentStage="compositor"
                currentNumber={6}
                currentLabel="Compositor"
                nextStage="audio_mastering"
                nextNumber={7}
                nextLabel="Audio Mastering & Final Video"
                summaryText="Stage 6: Compositor Silent Video Complete"
              />
            </div>
          )}
        </div>
      )}

      {/* 7. Final Video Player Tab */}
      {(activeTab === 'final' || activeTab === 'audio_mastering') && (
        <div className="card">
          <StageRunBanner stage="audio_mastering" number={7} label="Audio Mastering & Final Video" />
          <h2 style={{ fontSize: '1.4rem', marginBottom: '0.5rem' }}>Stage 7: Final Mastered Video</h2>
          {!job.final_video ? (
            <p style={{ color: 'var(--ink-muted)' }}>
              Final video audio mastering has not executed yet. Advance through all stages to view
              the completed master render.
            </p>
          ) : (
            <div>
              {/* Video Player or Mock Preview Card */}
              {(!job.final_video.final_video_url ||
                job.final_video.final_video_url.includes('mock-supabase.example.com') ||
                job.final_video.final_video_url.includes('example.com') ||
                job.final_video.final_video_url.includes('mock-storage')) ? (
                <div
                  style={{
                    background: 'linear-gradient(135deg, #1f1d1b 0%, #2b2825 100%)',
                    borderRadius: 8,
                    padding: '2.5rem 2rem',
                    marginBottom: '1.5rem',
                    maxWidth: 720,
                    margin: '0 auto 1.5rem',
                    color: '#fff',
                    border: '1px solid #3d3935',
                    textAlign: 'center',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      padding: '0.25rem 0.75rem',
                      borderRadius: 12,
                      background: 'rgba(217, 119, 6, 0.2)',
                      border: '1px solid rgba(217, 119, 6, 0.4)',
                      fontSize: '0.75rem',
                      color: '#f59e0b',
                      marginBottom: '1rem',
                    }}
                  >
                    <span>🎬</span>
                    <span>Zero-Spend Mock Master Render</span>
                  </div>

                  <h3 style={{ fontSize: '1.35rem', fontWeight: 700, margin: '0 0 0.5rem', color: '#f5f3ef' }}>
                    {job.topic}
                  </h3>

                  <p style={{ color: '#a8a29e', fontSize: '0.85rem', maxWidth: 480, margin: '0 auto 1.5rem', lineHeight: 1.5 }}>
                    Archival explainer master generated in mock mode. Timeline calibrated to {job.final_video.duration_s.toFixed(1)}s with -14 LUFS loudness and synced captions.
                  </p>

                  {/* Simulated waveform bars */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, height: 36, marginBottom: '1.5rem' }}>
                    {[40, 70, 30, 85, 60, 95, 45, 80, 55, 90, 65, 40, 75, 50, 85, 30, 70, 45, 90, 60, 35].map((h, i) => (
                      <span
                        key={i}
                        style={{
                          width: 4,
                          height: `${h}%`,
                          backgroundColor: i % 4 === 0 ? 'var(--red)' : '#d6d3cd',
                          borderRadius: 2,
                          opacity: 0.8,
                        }}
                      />
                    ))}
                  </div>

                  <div style={{ background: 'rgba(0, 0, 0, 0.35)', borderRadius: 6, padding: '0.75rem 1rem', display: 'inline-block', fontSize: '0.78rem', color: '#d6d3cd', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                    💡 Live MP4 video streaming will activate automatically when provider credentials (Fal.ai, Shotstack, ElevenLabs) are connected.
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    background: '#000',
                    borderRadius: 8,
                    overflow: 'hidden',
                    marginBottom: '1.5rem',
                    maxWidth: 720,
                    margin: '0 auto 1.5rem',
                  }}
                >
                  <video
                    controls
                    poster={job.thumbnail?.url}
                    style={{ width: '100%', height: 'auto', display: 'block' }}
                  >
                    <source src={job.final_video.final_video_url} type="video/mp4" />
                    Your browser does not support HTML5 video playback.
                  </video>
                </div>
              )}

              {/* Dedicated Voiceover Audio Player */}
              {job.final_video.voiceover?.voiceover_url && (
                <div
                  style={{
                    background: 'var(--paper-subtle)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: '1rem 1.25rem',
                    maxWidth: 720,
                    margin: '0 auto 1.5rem',
                  }}
                >
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--ink)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>🎙️</span> ElevenLabs Voiceover Audio Track
                  </div>
                  <audio
                    controls
                    style={{ width: '100%', height: 40 }}
                    src={job.final_video.voiceover.voiceover_url}
                  >
                    Your browser does not support audio playback.
                  </audio>
                </div>
              )}

              {/* Master Telemetry Cards */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '1rem',
                  marginBottom: '1.5rem',
                }}
              >
                <div style={{ background: 'var(--paper-subtle)', border: '1px solid var(--border)', borderRadius: 6, padding: '1rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--ink-light)', textTransform: 'uppercase' }}>
                    Final Duration
                  </div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--ink)', marginTop: 4 }}>
                    {formatTime(job.final_video.duration_s)} ({job.final_video.duration_s.toFixed(1)}s)
                  </div>
                </div>

                <div style={{ background: 'var(--paper-subtle)', border: '1px solid var(--border)', borderRadius: 6, padding: '1rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--ink-light)', textTransform: 'uppercase' }}>
                    Loudness (LUFS)
                  </div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--green)', marginTop: 4 }}>
                    {job.final_video.loudness_lufs} LUFS
                  </div>
                </div>

                <div style={{ background: 'var(--paper-subtle)', border: '1px solid var(--border)', borderRadius: 6, padding: '1rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--ink-light)', textTransform: 'uppercase' }}>
                    True Peak (dBFS)
                  </div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--ink)', marginTop: 4 }}>
                    {job.final_video.true_peak_dbfs} dBFS
                  </div>
                </div>

                <div style={{ background: 'var(--paper-subtle)', border: '1px solid var(--border)', borderRadius: 6, padding: '1rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--ink-light)', textTransform: 'uppercase' }}>
                    Captions Sync
                  </div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--green)', marginTop: 4 }}>
                    Synchronized
                  </div>
                </div>
              </div>

              {/* Download Links */}
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <a
                  href={job.final_video.final_video_url}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary"
                >
                  ↓ Download Final MP4
                </a>
                {job.captions?.srt_url && (
                  <a
                    href={job.captions.srt_url}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary"
                  >
                    Download Subtitles (.SRT)
                  </a>
                )}
                {job.captions?.ass_url && (
                  <a
                    href={job.captions.ass_url}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary"
                  >
                    Download Styled Captions (.ASS)
                  </a>
                )}
                {job.final_video?.voiceover?.voiceover_url && (
                  <a
                    href={job.final_video.voiceover.voiceover_url}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary"
                  >
                    🎙️ Download Voiceover (.MP3)
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => handleRedoStage('audio_mastering')}
                  disabled={isActionLoading}
                  className="btn-secondary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                  title="Re-run Stage 7 (Audio Mastering) to generate fresh audio and video render"
                >
                  <span>↻</span>
                  <span>{isActionLoading ? 'Remastering…' : 'Redo Stage 7: Audio Mastering'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Telemetry Tab */}
      {activeTab === 'telemetry' && (
        <div className="card">
          <h2 style={{ fontSize: '1.4rem', marginBottom: '0.5rem' }}>Job Telemetry & Cost Breakdown</h2>
          <p style={{ color: 'var(--ink-muted)', marginBottom: '1.5rem' }}>
            Durable per-stage execution timestamps and API cost accounting.
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
              gap: '2rem',
              alignItems: 'start',
            }}
          >
            {/* Cost Breakdown */}
            <div>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>API Cost Accounting</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                <tbody>
                  {[
                    { label: 'Idea Analyst (OpenRouter)', amount: job.cost?.idea_analyst_usd },
                    { label: 'Scriptwriter (OpenRouter)', amount: job.cost?.scriptwriter_usd },
                    { label: 'Visual Ideator (OpenRouter)', amount: job.cost?.visual_ideator_usd },
                    { label: 'Timing & Layout (Rule Engine)', amount: job.cost?.timing_layout_usd },
                    { label: 'Video Generator (Fal.ai)', amount: job.cost?.video_gen_usd },
                    { label: 'Compositor (Shotstack)', amount: job.cost?.compositor_usd },
                    { label: 'Audio Mastering (ElevenLabs/AssemblyAI)', amount: job.cost?.audio_mastering_usd },
                    { label: 'Object Storage (Supabase)', amount: job.cost?.storage_usd },
                  ].map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '0.5rem 0' }}>{row.label}</td>
                      <td style={{ padding: '0.5rem 0', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                        ${row.amount?.toFixed(4) ?? '0.0000'}
                      </td>
                    </tr>
                  ))}
                  <tr style={{ fontWeight: 700, borderTop: '2px solid var(--border)' }}>
                    <td style={{ padding: '0.75rem 0' }}>Total Cost (USD)</td>
                    <td style={{ padding: '0.75rem 0', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--ochre-dark)' }}>
                      ${job.cost?.total_usd?.toFixed(4) ?? '0.0000'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Timestamps */}
            <div>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>Stage Execution Timestamps</h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {Object.entries(job.timestamps || {}).map(([key, val]) => (
                  <li
                    key={key}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '0.4rem 0',
                      borderBottom: '1px solid var(--border-subtle)',
                    }}
                  >
                    <span style={{ textTransform: 'capitalize' }}>{key.replace('_', ' ')}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-muted)' }}>
                      {val ? new Date(val).toLocaleTimeString() : '—'}
                    </span>
                  </li>
                ))}
              </ul>

              <div style={{ marginTop: '1.5rem', background: 'var(--paper-subtle)', padding: '1rem', borderRadius: 4, border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--ink-muted)' }}>
                  <strong>Deterministic Seed:</strong> {job.seed}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--ink-muted)', marginTop: 4 }}>
                  <strong>Idempotency Key:</strong> {job.idempotency_key}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
