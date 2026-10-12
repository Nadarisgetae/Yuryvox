import { getEnv } from '@/lib/env';
import { pingIfConfigured, type SmokePingResult } from '@/lib/providers/types';

export const ELEVENLABS_PROVIDER = 'elevenlabs' as const;

export function getElevenLabsKey(): string | null {
  return getEnv('ELEVENLABS_API_KEY');
}

export async function smokePingElevenLabs(live: boolean): Promise<SmokePingResult> {
  const key = getElevenLabsKey();
  return pingIfConfigured({
    provider: ELEVENLABS_PROVIDER,
    configured: Boolean(key),
    live,
    request: () =>
      fetch('https://api.elevenlabs.io/v1/user', {
        headers: { 'xi-api-key': key as string },
      }),
  });
}
