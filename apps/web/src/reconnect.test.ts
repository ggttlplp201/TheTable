import { describe, expect, it } from 'vitest';
import { ConnectionRestoreGate, shouldForgetRestoreSession } from './reconnect';

describe('ConnectionRestoreGate', () => {
  it('allows a fresh restore after a later socket connection', () => {
    const gate = new ConnectionRestoreGate();
    const firstConnection = gate.nextConnection();
    expect(gate.begin(firstConnection)).toBe(true);
    expect(gate.begin(firstConnection)).toBe(false);
    expect(gate.isLatest(firstConnection)).toBe(true);

    const reconnect = gate.nextConnection();
    expect(gate.begin(reconnect)).toBe(true);
    expect(gate.isCurrent(firstConnection)).toBe(false);
    expect(gate.isCurrent(reconnect)).toBe(true);
    expect(gate.isLatest(firstConnection)).toBe(false);
    expect(gate.isLatest(reconnect)).toBe(true);

    gate.complete(reconnect);
    expect(gate.begin(gate.nextConnection())).toBe(true);
  });
});

describe('restore failure retention', () => {
  it('keeps credentials for transient network failures and forgets only terminal identity failures', () => {
    expect(shouldForgetRestoreSession('TIMEOUT')).toBe(false);
    expect(shouldForgetRestoreSession('CONNECTION_FAILED')).toBe(false);
    expect(shouldForgetRestoreSession('SERVER_CLOSING')).toBe(false);
    expect(shouldForgetRestoreSession('INVALID_SESSION')).toBe(true);
    expect(shouldForgetRestoreSession('ROOM_NOT_FOUND')).toBe(true);
  });
});
