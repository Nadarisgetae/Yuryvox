export type SmokePingResult = {
  provider: string;
  configured: boolean;
  liveAttempted: boolean;
  ok: boolean;
  status?: number;
  error?: string;
};

export async function pingIfConfigured(options: {
  provider: string;
  configured: boolean;
  live: boolean;
  request: () => Promise<Response>;
}): Promise<SmokePingResult> {
  const { provider, configured, live } = options;
  if (!configured) {
    return { provider, configured: false, liveAttempted: false, ok: true };
  }
  if (!live) {
    return { provider, configured: true, liveAttempted: false, ok: true };
  }
  try {
    const response = await Promise.race([
      options.request(),
      new Promise<Response>((_, reject) => {
        setTimeout(() => reject(new Error('smoke_timeout')), 8000);
      }),
    ]);
    return {
      provider,
      configured: true,
      liveAttempted: true,
      ok: response.ok,
      status: response.status,
      error: response.ok ? undefined : `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      provider,
      configured: true,
      liveAttempted: true,
      ok: false,
      error: error instanceof Error ? error.message : 'unknown_error',
    };
  }
}
