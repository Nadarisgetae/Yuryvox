import { NextResponse } from 'next/server';
import { configuredCount, getCredentialPresence } from '@/lib/env';
import { presets } from '@/lib/config';

export const dynamic = 'force-dynamic';

export async function GET() {
  const credentials = getCredentialPresence();
  return NextResponse.json({
    ok: true,
    service: 'yuryvox',
    phase: 1,
    node: process.version,
    host_target: 'vercel',
    runtime_target: 'nodejs20.x',
    credentials,
    credential_counts: configuredCount(credentials),
    presets: {
      style: presets.style.id,
      aspect: presets.jobDefaults.aspect_ratios,
      target_seconds: presets.jobDefaults.target_seconds,
    },
  });
}
