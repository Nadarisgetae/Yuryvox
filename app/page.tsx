import { CredentialChecklist } from '@/components/CredentialChecklist';
import { configuredCount, getCredentialPresence } from '@/lib/env';
import { presets } from '@/lib/config';

export default function HomePage() {
  const presence = getCredentialPresence();
  const counts = configuredCount(presence);

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '3rem 1.5rem' }}>
      <p style={{ letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ochre)' }}>
        Phase 1 · environment
      </p>
      <h1 style={{ fontWeight: 500 }}>Yuryvox</h1>
      <p>
        Archival collage explainer pipeline. Host target: Vercel (Node 20). Long-running Agents 5–7
        will need a worker later; that is not built in this phase.
      </p>
      <p>
        Style preset: <em>{presets.style.id}</em>. Default job: {presets.jobDefaults.target_seconds}s
        · {presets.jobDefaults.aspect_ratios.join(', ')} · {presets.style.pacing_wpm} wpm.
      </p>
      <h2>Credentials ({counts.configured}/{counts.total})</h2>
      <p style={{ color: 'var(--ink)' }}>
        Values are never shown. Copy <code>.env.example</code> to <code>.env.local</code> to fill keys.
        Live pings stay off unless <code>YURYVOX_SMOKE_LIVE=true</code>.
      </p>
      <CredentialChecklist presence={presence} />
      <p style={{ marginTop: '2rem' }}>
        Health: <a href="/api/health">/api/health</a>
        {' · '}
        Smoke: <a href="/api/smoke">/api/smoke</a>
      </p>
    </main>
  );
}
