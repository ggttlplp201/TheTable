import { Group } from 'three';
import { describe, expect, it, vi } from 'vitest';
import { ARRIVAL_BEATS, ARRIVAL_DURATION, TableArrival, sampleArrival } from './arrival.js';
import { CAMERA_VIEWS, createCamera } from './scenes.js';
import type { SeatVisual } from './types.js';

const seats: SeatVisual[] = [[0, 0, 2.18], [2.65, 0, 0], [0, 0, -2.18], [-2.65, 0, 0]].map((position, index) => ({
  id: String(index), role: 'medic', color: 0xffffff, rotationY: [Math.PI, -Math.PI / 2, 0, Math.PI / 2][index]!, position: position as [number, number, number],
}));
describe('first person arrival', () => {
  it('approaches every assigned seat from outside the table, finishes at the exact overview, and stays continuous', () => {
    expect(ARRIVAL_DURATION).toBeGreaterThanOrEqual(5); expect(ARRIVAL_DURATION).toBeLessThanOrEqual(8);
    for (const seat of seats) {
      const start = sampleArrival(seat, 0), near = sampleArrival(seat, 2.3), end = sampleArrival(seat, ARRIVAL_DURATION);
      expect(start.position.length()).toBeGreaterThan(near.position.length() + 2);
      end.position.toArray().forEach((value, index) => expect(value).toBeCloseTo(CAMERA_VIEWS.spectator.position[index]!));
      end.lookAt.toArray().forEach((value, index) => expect(value).toBeCloseTo(CAMERA_VIEWS.spectator.lookAt[index]!));
      expect(sampleArrival(seat, 3.05).chairOffset).toBeCloseTo(0.42);
      expect(sampleArrival(seat, 4.65).chairOffset).toBe(0);
      let previous = start;
      for (let t = 0.01; t <= ARRIVAL_DURATION; t += 0.01) {
        const next = sampleArrival(seat, t);
        expect(next.position.distanceTo(previous.position)).toBeLessThan(0.12);
        expect(next.lookAt.distanceTo(previous.lookAt)).toBeLessThan(0.06);
        expect(next.position.y).toBeGreaterThan(1.4);
        expect(Math.abs(next.roll)).toBeLessThan(0.004);
        previous = next;
      }
    }
  });
  it('restores camera, chair and body when skipped/disposed, without late beats', () => {
    const camera = createCamera('spectator'), character = new Group(), chair = new Group(), upper = new Group();
    chair.name = 'chair'; upper.name = 'upper'; character.add(chair, upper);
    const beat = vi.fn(); const arrival = new TableArrival(camera, seats[0]!, character, beat);
    expect(upper.visible).toBe(false);
    arrival.update(3); expect(chair.position.z).toBeLessThan(-0.4);
    const count = beat.mock.calls.length;
    arrival.dispose(); arrival.dispose(); arrival.update(9);
    expect(beat).toHaveBeenCalledTimes(count); expect(upper.visible).toBe(true);
    expect(chair.position.z).toBe(0); expect(camera.position.toArray()).toEqual([...CAMERA_VIEWS.spectator.position]);
  });
  it('emits every beat once even across dropped frames and restores a hidden body as hidden', () => {
    const character = new Group(), upper = new Group(); upper.name = 'upper'; upper.visible = false; character.add(upper);
    const beat = vi.fn(), arrival = new TableArrival(createCamera(), seats[2]!, character, beat);
    arrival.update(2); arrival.update(1); arrival.update(8); arrival.update(9);
    expect(beat.mock.calls.map(([value]) => value)).toEqual(ARRIVAL_BEATS.map(([value]) => value));
    expect(upper.visible).toBe(false); expect(arrival.finished).toBe(true);
  });
});
