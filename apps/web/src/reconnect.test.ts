import { describe, expect, it } from 'vitest';
import { ConnectionRestoreGate } from './reconnect';

describe('ConnectionRestoreGate', () => {
  it('allows a fresh restore after a later socket connection', () => {
    const gate = new ConnectionRestoreGate();
    const firstConnection = gate.nextConnection();
    expect(gate.begin(firstConnection)).toBe(true);
    expect(gate.begin(firstConnection)).toBe(false);

    const reconnect = gate.nextConnection();
    expect(gate.begin(reconnect)).toBe(true);
    expect(gate.isCurrent(firstConnection)).toBe(false);
    expect(gate.isCurrent(reconnect)).toBe(true);

    gate.complete(reconnect);
    expect(gate.begin(gate.nextConnection())).toBe(true);
  });
});
