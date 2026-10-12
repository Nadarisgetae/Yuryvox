import { configuredCount, getCredentialPresence, isSmokeLiveEnabled } from '@/lib/env';
import {
  getAssemblyAiKey,
  getElevenLabsKey,
  getFalKey,
  getOpenRouterKey,
  getShotstackKey,
} from '@/lib/providers';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { presets } from '@/lib/config';

describe('Phase 1 smoke (presence + imports, no live spend)', () => {
  it('exports credential presence without throwing', () => {
    const presence = getCredentialPresence();
    expect(Object.keys(presence)).toHaveLength(7);
    const counts = configuredCount(presence);
    expect(counts.total).toBe(7);
    expect(counts.configured).toBeGreaterThanOrEqual(0);
  });

  it('does not enable live smoke by default', () => {
    expect(isSmokeLiveEnabled()).toBe(false);
  });

  it('imports every provider adapter', () => {
    expect(typeof getOpenRouterKey).toBe('function');
    expect(typeof getElevenLabsKey).toBe('function');
    expect(typeof getFalKey).toBe('function');
    expect(typeof getShotstackKey).toBe('function');
    expect(typeof getAssemblyAiKey).toBe('function');
    expect(typeof getSupabaseBrowserClient).toBe('function');
  });

  it('loads versioned presets from config', () => {
    expect(presets.style.id).toBe('archival_collage_explainer');
    expect(presets.jobDefaults.target_seconds).toBe(90);
    expect(presets.jobDefaults.approval_mode).toBe(
      'script_and_visual_plan_before_paid_generation',
    );
    expect(presets.aspect.layouts['16:9'].width).toBe(1920);
  });

  it('returns null clients when keys are missing', () => {
    expect(getOpenRouterKey()).toBeNull();
    expect(getSupabaseBrowserClient()).toBeNull();
  });
});
