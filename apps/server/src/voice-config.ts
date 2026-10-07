import { z } from 'zod';

const iceUrl = z.string().trim().min(1).max(500).refine(
  value => /^(?:stun|stuns|turn|turns):[^\s]+$/i.test(value),
  'ICE URLs must use stun:, stuns:, turn:, or turns: schemes.',
);

const iceServer = z.object({
  urls: z.union([iceUrl, z.array(iceUrl).min(1).max(8)]),
  username: z.string().min(1).max(500).optional(),
  credential: z.string().min(1).max(1000).optional(),
}).strict().superRefine((value, context) => {
  const urls = typeof value.urls === 'string' ? [value.urls] : value.urls;
  if (urls.some(url => /^turns?:/i.test(url)) && (!value.username || !value.credential)) {
    context.addIssue({ code: 'custom', message: 'TURN entries require both username and credential.' });
  }
  if ((value.username && !value.credential) || (!value.username && value.credential)) {
    context.addIssue({ code: 'custom', message: 'ICE username and credential must be supplied together.' });
  }
});

const iceServers = z.array(iceServer).max(8);

export type VoiceIceServer = z.infer<typeof iceServer>;

export interface VoiceCapability {
  enabled: boolean;
  iceServers: VoiceIceServer[];
  relayConfigured: boolean;
}

export function parseVoiceIceServers(raw: string | undefined): VoiceIceServer[] {
  if (!raw?.trim()) return [];
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error('VOICE_ICE_SERVERS must be valid JSON.');
  }
  const result = iceServers.safeParse(value);
  if (!result.success) throw new Error(`Invalid VOICE_ICE_SERVERS: ${result.error.issues[0]?.message ?? 'invalid configuration'}`);
  return result.data;
}

export function voiceCapability(enabled: boolean, configured: readonly VoiceIceServer[] = []): VoiceCapability {
  const iceServers = configured.map(server => ({ ...server, urls: Array.isArray(server.urls) ? [...server.urls] : server.urls }));
  return {
    enabled,
    iceServers,
    relayConfigured: iceServers.some(server => (typeof server.urls === 'string' ? [server.urls] : server.urls).some(url => /^turns?:/i.test(url))),
  };
}
