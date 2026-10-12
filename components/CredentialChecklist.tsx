import type { CredentialPresence } from '@/lib/env';

const LABELS: Record<keyof CredentialPresence, string> = {
  OPENROUTER_API_KEY: 'OpenRouter',
  ELEVENLABS_API_KEY: 'ElevenLabs',
  FAL_API_KEY: 'Fal.ai',
  SHOTSTACK_API_KEY: 'Shotstack',
  ASSEMBLYAI_API_KEY: 'AssemblyAI',
  SUPABASE_URL: 'Supabase URL',
  SUPABASE_ANON_KEY: 'Supabase anon key',
};

export function CredentialChecklist({ presence }: { presence: CredentialPresence }) {
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
      {(Object.keys(LABELS) as Array<keyof CredentialPresence>).map((key) => {
        const ok = presence[key];
        return (
          <li
            key={key}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '0.5rem 0',
              borderBottom: '1px solid var(--beige)',
            }}
          >
            <span>{LABELS[key]}</span>
            <strong style={{ color: ok ? 'var(--ochre)' : 'var(--red)' }}>
              {ok ? 'configured' : 'missing'}
            </strong>
          </li>
        );
      })}
    </ul>
  );
}
