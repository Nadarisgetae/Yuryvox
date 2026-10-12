import { NextResponse } from 'next/server';
import { getCredentialPresence, isSmokeLiveEnabled } from '@/lib/env';
import {
  smokePingAssemblyAi,
  smokePingElevenLabs,
  smokePingFal,
  smokePingOpenRouter,
  smokePingShotstack,
} from '@/lib/providers';
import { smokePingSupabase } from '@/lib/supabase/client';

export const dynamic = 'force-dynamic';

export async function GET() {
  const live = isSmokeLiveEnabled();
  const presence = getCredentialPresence();
  const pings = await Promise.all([
    smokePingOpenRouter(live),
    smokePingElevenLabs(live),
    smokePingFal(live),
    smokePingShotstack(live),
    smokePingAssemblyAi(live),
    smokePingSupabase(live),
  ]);

  const liveFailures = pings.filter((ping) => ping.liveAttempted && !ping.ok);

  return NextResponse.json({
    ok: liveFailures.length === 0,
    live,
    note: live
      ? 'Live provider pings were attempted for configured keys only.'
      : 'Presence-only smoke. Set YURYVOX_SMOKE_LIVE=true to ping providers. Unconfigured keys are not failures.',
    credentials: presence,
    pings,
  });
}
