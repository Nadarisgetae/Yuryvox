const REQUIRED_LATER = [
  'OPENROUTER_API_KEY',
  'ELEVENLABS_API_KEY',
  'FAL_API_KEY',
  'SHOTSTACK_API_KEY',
  'ASSEMBLYAI_API_KEY',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
] as const;

export type CredentialName = (typeof REQUIRED_LATER)[number];

export type CredentialPresence = Record<CredentialName, boolean>;

function present(name: string): boolean {
  const value = process.env[name];
  return typeof value === 'string' && value.trim().length > 0;
}

export function getCredentialPresence(): CredentialPresence {
  return {
    OPENROUTER_API_KEY: present('OPENROUTER_API_KEY'),
    ELEVENLABS_API_KEY: present('ELEVENLABS_API_KEY'),
    FAL_API_KEY: present('FAL_API_KEY'),
    SHOTSTACK_API_KEY: present('SHOTSTACK_API_KEY'),
    ASSEMBLYAI_API_KEY: present('ASSEMBLYAI_API_KEY'),
    SUPABASE_URL: present('SUPABASE_URL'),
    SUPABASE_ANON_KEY: present('SUPABASE_ANON_KEY'),
  };
}

export function isSmokeLiveEnabled(): boolean {
  return process.env.YURYVOX_SMOKE_LIVE === 'true';
}

export function getEnv(name: CredentialName): string | null {
  const value = process.env[name];
  if (!value || !value.trim()) return null;
  return value.trim();
}

export function configuredCount(presence: CredentialPresence): {
  configured: number;
  total: number;
} {
  const values = Object.values(presence);
  return {
    configured: values.filter(Boolean).length,
    total: values.length,
  };
}
