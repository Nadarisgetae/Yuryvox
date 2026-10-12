import { getEnv } from '@/lib/env';
import { pingIfConfigured, type SmokePingResult } from '@/lib/providers/types';

export const OPENROUTER_PROVIDER = 'openrouter' as const;

export function getOpenRouterKey(): string | null {
  return getEnv('OPENROUTER_API_KEY');
}

export async function smokePingOpenRouter(live: boolean): Promise<SmokePingResult> {
  const key = getOpenRouterKey();
  return pingIfConfigured({
    provider: OPENROUTER_PROVIDER,
    configured: Boolean(key),
    live,
    request: () =>
      fetch('https://openrouter.ai/api/v1/models', {
        headers: { Authorization: `Bearer ${key}` },
      }),
  });
}
