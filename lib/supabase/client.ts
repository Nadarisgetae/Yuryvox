import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getEnv } from '@/lib/env';
import { pingIfConfigured, type SmokePingResult } from '@/lib/providers/types';

export const SUPABASE_PROVIDER = 'supabase' as const;

export function getSupabaseBrowserClient(): SupabaseClient | null {
  const url = getEnv('SUPABASE_URL');
  const anon = getEnv('SUPABASE_ANON_KEY');
  if (!url || !anon) return null;
  return createClient(url, anon);
}

export async function smokePingSupabase(live: boolean): Promise<SmokePingResult> {
  const url = getEnv('SUPABASE_URL');
  const anon = getEnv('SUPABASE_ANON_KEY');
  const configured = Boolean(url && anon);
  return pingIfConfigured({
    provider: SUPABASE_PROVIDER,
    configured,
    live,
    request: () =>
      fetch(`${url}/rest/v1/`, {
        headers: {
          apikey: anon as string,
          Authorization: `Bearer ${anon}`,
        },
      }),
  });
}
