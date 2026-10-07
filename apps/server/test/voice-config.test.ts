import { describe, expect, it } from 'vitest';
import { parseVoiceIceServers, voiceCapability } from '../src/voice-config.js';

describe('voice ICE configuration', () => {
  it('accepts portable STUN/TURN configuration and reports relay capability', () => {
    const servers = parseVoiceIceServers(JSON.stringify([
      { urls: ['stun:stun.example.test:3478'] },
      { urls: 'turns:relay.example.test:5349?transport=tcp', username: 'table', credential: 'secret' },
    ]));
    expect(voiceCapability(true, servers)).toEqual({ enabled: true, iceServers: servers, relayConfigured: true });
  });

  it('rejects web URLs, malformed JSON, and TURN without credentials', () => {
    expect(() => parseVoiceIceServers('{')).toThrow('valid JSON');
    expect(() => parseVoiceIceServers('[{"urls":"https://example.test"}]')).toThrow('stun:');
    expect(() => parseVoiceIceServers('[{"urls":"turn:relay.example.test"}]')).toThrow('TURN entries require');
  });

  it('makes missing relay configuration explicit without silently disabling voice', () => {
    expect(voiceCapability(true, [])).toEqual({ enabled: true, iceServers: [], relayConfigured: false });
  });
});
