import { getEnv } from '@/lib/env';
import { pingIfConfigured, type SmokePingResult } from '@/lib/providers/types';

export const SHOTSTACK_PROVIDER = 'shotstack' as const;

export function getShotstackKey(): string | null {
  return getEnv('SHOTSTACK_API_KEY');
}

export async function smokePingShotstack(live: boolean): Promise<SmokePingResult> {
  const key = getShotstackKey();
  return pingIfConfigured({
    provider: SHOTSTACK_PROVIDER,
    configured: Boolean(key),
    live,
    request: () =>
      fetch('https://api.shotstack.io/edit/stage/probe?url=https://shotstack-assets.s3.amazonaws.com/footage/beach-aerial.mp4', {
        headers: {
          'x-api-key': key as string,
          Accept: 'application/json',
        },
      }),
  });
}
