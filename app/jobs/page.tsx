'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

interface JobSummary {
  job_id: string;
  topic: string;
  target_seconds: number;
  aspects: string[];
  status: 'pending' | 'in_progress' | 'awaiting_approval' | 'completed' | 'failed' | 'needs_review';
  current_stage?: string;
  cost?: {
    total_usd: number;
  };
  timestamps: {
    created: string;
    completed?: string;
  };
  final_video?: {
    final_video_url: string;
    duration_s: number;
  };
  thumbnail?: {
    url: string;
  };
}

export default function JobsDashboardPage() {
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [storageDriver, setStorageDriver] = useState<string>('memory');
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch('/api/jobs?limit=50');
      const data = await res.json();
      if (res.ok) {
        setJobs(data.jobs || []);
        setStorageDriver(data.storage || 'memory');
      } else {
        setErrorMsg(data.message || 'Failed to load jobs');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();

    // Auto-poll every 5 seconds if there are active in-progress jobs
    const interval = setInterval(() => {
      fetchJobs();
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchJobs]);

  const handleDelete = async (jobId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this job record?')) return;

    try {
      const res = await fetch(`/api/jobs/${jobId}`, { method: 'DELETE' });
      if (res.ok) {
        setJobs((prev) => prev.filter((j) => j.job_id !== jobId));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSeedDemos = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/jobs/seed', { method: 'POST' });
      if (res.ok) {
        await fetchJobs();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredJobs = jobs.filter((job) => {
    if (filter === 'all') return true;
    return job.status === filter;
  });

  const formatDuration = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${mins}:${rem < 10 ? '0' : ''}${rem}`;
  };

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoStr;
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'completed':
        return 'status-completed';
      case 'in_progress':
        return 'status-in_progress';
      case 'awaiting_approval':
        return 'status-awaiting_approval';
      case 'failed':
        return 'status-failed';
      default:
        return 'status-pending';
    }
  };

  const formatStage = (stage?: string) => {
    if (!stage) return 'Pending Start';
    return stage
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  };

  return (
    <main className="container" style={{ padding: '2.5rem 1.5rem 5rem' }}>
      {/* Top Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '2rem',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <span className="archival-tag">Pipeline Dashboard · {storageDriver.toUpperCase()} STORE</span>
          <h1 style={{ fontSize: '2.2rem', marginBottom: '0.4rem', fontWeight: 700 }}>
            Generated Explainer Jobs
          </h1>
          <p style={{ color: 'var(--ink-muted)', margin: 0, fontSize: '0.95rem' }}>
            Track multi-agent generation progress, review approval checkpoints, and download completed videos.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleSeedDemos}
            className="btn-accent"
            style={{ padding: '0.65rem 1rem', fontSize: '0.88rem' }}
          >
            ✨ Load Demos
          </button>
          <button
            type="button"
            onClick={() => fetchJobs()}
            className="btn-secondary"
            style={{ padding: '0.65rem 1rem' }}
          >
            ↻ Refresh
          </button>
          <Link href="/" className="btn-primary" style={{ padding: '0.65rem 1.25rem' }}>
            + Create New Video
          </Link>
        </div>
      </div>

      {/* Ephemeral Storage Warning Banner */}
      {storageDriver === 'memory' && (
        <div
          style={{
            padding: '0.75rem 1rem',
            background: 'rgba(217, 119, 6, 0.08)',
            border: '1px solid rgba(217, 119, 6, 0.25)',
            borderRadius: 6,
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            fontSize: '0.85rem',
            color: '#92400e',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>⚠️</span>
            <span>
              <strong>Ephemeral Memory Storage:</strong> Jobs are stored in server memory and will reset on server restarts or Vercel serverless cold starts.
            </span>
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', opacity: 0.9 }}>
            To persist data, configure Supabase credentials in .env.local
          </span>
        </div>
      )}

      {/* Filter Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          borderBottom: '1px solid var(--border)',
          paddingBottom: '0.75rem',
          marginBottom: '1.5rem',
          flexWrap: 'wrap',
        }}
      >
        {[
          { id: 'all', label: 'All Jobs', count: jobs.length },
          {
            id: 'awaiting_approval',
            label: 'Awaiting Approval',
            count: jobs.filter((j) => j.status === 'awaiting_approval').length,
          },
          {
            id: 'in_progress',
            label: 'In Progress',
            count: jobs.filter((j) => j.status === 'in_progress').length,
          },
          {
            id: 'completed',
            label: 'Completed',
            count: jobs.filter((j) => j.status === 'completed').length,
          },
        ].map((tab) => {
          const active = filter === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              style={{
                background: active ? 'var(--ink)' : 'transparent',
                color: active ? 'var(--paper)' : 'var(--ink-muted)',
                border: 'none',
                borderRadius: 4,
                padding: '0.4rem 0.85rem',
                fontSize: '0.88rem',
                fontWeight: active ? 600 : 500,
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                transition: 'all 0.15s ease',
              }}
            >
              <span>{tab.label}</span>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.72rem',
                  opacity: 0.85,
                  background: active ? 'rgba(255,255,255,0.2)' : 'var(--border-subtle)',
                  padding: '0.1rem 0.35rem',
                  borderRadius: 3,
                }}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {errorMsg && (
        <div
          style={{
            background: 'var(--red-light)',
            color: 'var(--red)',
            padding: '1rem',
            borderRadius: 6,
            marginBottom: '1.5rem',
            border: '1px solid #f7c5be',
          }}
        >
          {errorMsg}
        </div>
      )}

      {/* Jobs Listing */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--ink-muted)' }}>
          <p>Loading jobs from {storageDriver} store…</p>
        </div>
      ) : filteredJobs.length === 0 ? (
        <div
          className="card"
          style={{
            textAlign: 'center',
            padding: '4rem 2rem',
            background: 'var(--cream)',
            border: '2px dashed var(--border)',
          }}
        >
          <h3 style={{ fontSize: '1.35rem', marginBottom: '0.5rem' }}>
            {filter === 'all' ? 'No video jobs created yet' : `No jobs matching filter "${filter}"`}
          </h3>
          <p style={{ color: 'var(--ink-muted)', maxWidth: 460, margin: '0 auto 1.5rem' }}>
            Input any topic or thesis in the studio, and the 7-agent pipeline will generate your
            archival documentary explainer.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleSeedDemos}
              className="btn-accent"
              style={{ padding: '0.75rem 1.5rem' }}
            >
              ✨ Load 3 Pre-Generated Demo Videos
            </button>
            <Link href="/" className="btn-primary">
              Launch Studio & Create Video →
            </Link>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {filteredJobs.map((job) => (
            <div
              key={job.job_id}
              className="card"
              style={{
                padding: '1.35rem 1.65rem',
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) auto',
                gap: '1.5rem',
                alignItems: 'center',
                transition: 'border-color 0.15s ease',
              }}
            >
              {/* Left Info */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                  <span className={`status-pill ${getStatusClass(job.status)}`}>
                    ● {job.status.replace('_', ' ')}
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.75rem',
                      color: 'var(--ink-light)',
                    }}
                  >
                    ID: {job.job_id}
                  </span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--ink-muted)' }}>
                    · Created {formatDate(job.timestamps.created)}
                  </span>
                </div>

                <h3
                  style={{
                    fontSize: '1.2rem',
                    fontWeight: 700,
                    margin: '0 0 0.5rem',
                    color: 'var(--ink)',
                  }}
                >
                  <Link
                    href={`/jobs/${job.job_id}`}
                    style={{ color: 'var(--ink)', textDecoration: 'none' }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--red)')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink)')}
                  >
                    {job.topic}
                  </Link>
                </h3>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    fontSize: '0.82rem',
                    color: 'var(--ink-muted)',
                    flexWrap: 'wrap',
                  }}
                >
                  <span>
                    <strong>Target:</strong> {formatDuration(job.target_seconds)} ({job.target_seconds}s)
                  </span>
                  <span>·</span>
                  <span>
                    <strong>Aspect:</strong> {job.aspects?.join(', ') || '16:9'}
                  </span>
                  <span>·</span>
                  <span>
                    <strong>Active Stage:</strong> {formatStage(job.current_stage)}
                  </span>
                  <span>·</span>
                  <span>
                    <strong>Cost:</strong> ${job.cost?.total_usd?.toFixed(4) ?? '0.0000'}
                  </span>
                </div>
              </div>

              {/* Right Actions */}
              <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center' }}>
                {job.status === 'awaiting_approval' && (
                  <Link
                    href={`/jobs/${job.job_id}`}
                    className="btn-accent"
                    style={{ padding: '0.55rem 1rem', fontSize: '0.85rem' }}
                  >
                    Review & Approve →
                  </Link>
                )}

                <Link
                  href={`/jobs/${job.job_id}`}
                  className="btn-secondary"
                  style={{ padding: '0.55rem 1rem', fontSize: '0.85rem' }}
                >
                  Inspect Stepper →
                </Link>

                <button
                  type="button"
                  onClick={(e) => handleDelete(job.job_id, e)}
                  title="Delete Job"
                  style={{
                    background: 'transparent',
                    border: '1px solid var(--border)',
                    borderRadius: 4,
                    color: 'var(--ink-light)',
                    padding: '0.5rem 0.65rem',
                    fontSize: '0.85rem',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'var(--red)';
                    e.currentTarget.style.borderColor = 'var(--red)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--ink-light)';
                    e.currentTarget.style.borderColor = 'var(--border)';
                  }}
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
