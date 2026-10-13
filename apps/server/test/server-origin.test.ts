import type { IncomingMessage } from 'node:http';
import { describe, expect, it } from 'vitest';
import { isAllowedRequestOrigin } from '../src/server.js';

function request(headers: IncomingMessage['headers']): IncomingMessage {
  return { headers } as IncomingMessage;
}

describe('deployment origin policy', () => {
  const configured = ['http://localhost:5173'];

  it('accepts configured origins and requests without a browser origin', () => {
    expect(isAllowedRequestOrigin(request({ origin: configured[0] }), configured)).toBe(true);
    expect(isAllowedRequestOrigin(request({}), configured)).toBe(true);
  });

  it('accepts the same public host forwarded by a deployment proxy', () => {
    expect(isAllowedRequestOrigin(request({
      origin: 'https://the-table-preview.vercel.app',
      'x-forwarded-host': 'the-table-preview.vercel.app',
    }), configured)).toBe(true);
  });

  it('rejects malformed and cross-origin WebSocket upgrades', () => {
    expect(isAllowedRequestOrigin(request({
      origin: 'https://attacker.example',
      'x-forwarded-host': 'the-table-preview.vercel.app',
    }), configured)).toBe(false);
    expect(isAllowedRequestOrigin(request({ origin: 'not a URL', host: 'the-table-preview.vercel.app' }), configured)).toBe(false);
  });
});
