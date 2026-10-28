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
    request: async () => {
      let res = await fetch('https://api.shotstack.io/edit/v1/render/00000000-0000-0000-0000-000000000000', {
        headers: { 'x-api-key': key as string, Accept: 'application/json' },
      });
      if (res.status === 403) {
        res = await fetch('https://api.shotstack.io/edit/stage/render/00000000-0000-0000-0000-000000000000', {
          headers: { 'x-api-key': key as string, Accept: 'application/json' },
        });
      }
      if (res.status === 200 || res.status === 400) {
        return new Response('authenticated', { status: 200 });
      }
      return res;
    },
  });
}
