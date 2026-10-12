import { getEnv } from '@/lib/env';
import { pingIfConfigured, type SmokePingResult } from '@/lib/providers/types';

export const ASSEMBLYAI_PROVIDER = 'assemblyai' as const;

export function getAssemblyAiKey(): string | null {
  return getEnv('ASSEMBLYAI_API_KEY');
}

export async function smokePingAssemblyAi(live: boolean): Promise<SmokePingResult> {
  const key = getAssemblyAiKey();
  return pingIfConfigured({
    provider: ASSEMBLYAI_PROVIDER,
    configured: Boolean(key),
    live,
    request: () =>
      fetch('https://api.assemblyai.com/v2/transcript?limit=1', {
        headers: { authorization: key as string },
      }),
  });
}
