import { getEnv } from '@/lib/env';
import { pingIfConfigured, type SmokePingResult } from '@/lib/providers/types';

export const FAL_PROVIDER = 'fal' as const;

export function getFalKey(): string | null {
  return getEnv('FAL_API_KEY');
}

export async function smokePingFal(live: boolean): Promise<SmokePingResult> {
  const key = getFalKey();
  return pingIfConfigured({
    provider: FAL_PROVIDER,
    configured: Boolean(key),
    live,
    request: () =>
      fetch('https://api.fal.ai/v1/models', {
        headers: { Authorization: `Key ${key}` },
      }),
  });
}
