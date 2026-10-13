import { Group } from 'three';
import { describe, expect, it, vi } from 'vitest';
import { ARRIVAL_BEATS, ARRIVAL_DURATION, TableArrival, sampleArrival, seatedArrivalPose } from './arrival.js';
import { createCamera } from './scenes.js';
import type { SeatVisual } from './types.js';

const seats: SeatVisual[] = [[0,0,2.18],[2.65,0,0],[0,0,-2.18],[-2.65,0,0]].map((position,index) => ({
  id:String(index),role:'medic',color:0xffffff,rotationY:[Math.PI,-Math.PI/2,0,Math.PI/2][index]!,position:position as [number,number,number],
}));
const body = () => ({ chair:new Group(), legs:new Group(), hands:new Group() });

describe('six-second first-person arrival', () => {
  it('matches the five reference phases for every seat and holds the seated pose for 1.4 seconds', () => {
    expect(ARRIVAL_DURATION).toBe(7.4);
    for(const seat of seats) {
      const start=sampleArrival(seat,0),stop=sampleArrival(seat,2.4),pull=sampleArrival(seat,3.5);
      const step=sampleArrival(seat,4.1),sit=sampleArrival(seat,5.1),end=sampleArrival(seat,6);
      expect(start.phase).toBe('approach'); expect(stop.phase).toBe('stop');
      expect(pull.phase).toBe('chair'); expect(step.phase).toBe('step'); expect(sit.phase).toBe('sit');
      expect(start.position.distanceTo(stop.position)).toBeGreaterThan(1.8);
      expect(pull.chairZ).toBeCloseTo(2.95,2);
      expect(step.chairZ).toBe(2.95);
      expect(sit.legsVisible).toBe(true);
      expect(sampleArrival(seat,4.59).legsVisible).toBe(false);
      expect(end.position.distanceTo(seatedArrivalPose(seat).position)).toBeLessThan(.00001);
      expect(sampleArrival(seat,7.4).position.distanceTo(end.position)).toBeLessThan(.00001);
      let previous=start;
      for(let t=.01;t<=6;t+=.01) {
        const next=sampleArrival(seat,t);
        expect(next.position.distanceTo(previous.position)).toBeLessThan(.12);
        previous=next;
      }
    }
  });
  it('pulls a visible chair, plants first-person legs only during the sit, then settles it closer', () => {
    const camera=createCamera('seat'),figure=new Group(),upper=new Group(),props=body();
    upper.name='upper'; figure.add(upper);
    const arrival=new TableArrival(camera,seats[0]!,figure,undefined,props);
    expect(upper.visible).toBe(false); expect(props.legs.visible).toBe(false);
    arrival.update(3.5);
    expect(props.chair.position.z).toBeCloseTo(2.95,2); expect(props.hands.visible).toBe(true);
    arrival.update(4.6);
    expect(props.hands.visible).toBe(false); expect(props.legs.visible).toBe(true);
    arrival.finish(); arrival.dispose();
    expect(props.chair.position.z).toBe(2.66); expect(props.legs.position.z).toBe(2.64);
    expect(upper.visible).toBe(true);
  });
  it('emits each footstep and chair cue once even across dropped frames', () => {
    const beat=vi.fn(),arrival=new TableArrival(createCamera(),seats[2]!,undefined,beat,body());
    arrival.update(2); arrival.update(1); arrival.update(ARRIVAL_DURATION); arrival.update(ARRIVAL_DURATION+1);
    expect(beat.mock.calls.map(([value])=>value)).toEqual(ARRIVAL_BEATS.map(([value])=>value));
    expect(arrival.finished).toBe(true);
  });
});
