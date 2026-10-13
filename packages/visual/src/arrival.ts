import { Vector3, type Group, type PerspectiveCamera } from 'three';
import type { SeatVisual } from './types.js';

// Six-second reference motion followed by its 1.4-second seated hold.
export const ARRIVAL_DURATION = 7.4;
export const ARRIVAL_BEATS = [
  ['footstep', .28], ['footstep', .56], ['footstep', .84], ['footstep', 1.12],
  ['footstep', 1.4], ['footstep', 1.68], ['footstep', 1.96],
  ['chair-scrape', 2.6], ['footstep', 3.86], ['footstep', 4.27], ['chair-settle', 5.25],
] as const;
export type ArrivalBeat = (typeof ARRIVAL_BEATS)[number][0];
export type ArrivalPhase = 'approach' | 'stop' | 'chair' | 'step' | 'sit' | 'overview';
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (v: number) => { const x = clamp(v); return x*x*(3-2*x); };
const phase = (t: number, a: number, b: number) => smooth((t-a)/(b-a));
const lerp = (a: number, b: number, u: number) => a+(b-a)*u;
function local(seat: SeatVisual, x: number, y: number, z: number) {
  const out = new Vector3(seat.position[0],0,seat.position[2]).normalize();
  return new Vector3(out.z,0,-out.x).multiplyScalar(x).addScaledVector(out,z).setY(y);
}
export function seatedArrivalPose(seat: SeatVisual) {
  return { position: local(seat,0,1.58,2.4), lookAt: local(seat,0,.74,-.6) };
}
/** Scrubbable port of introAt(t) in Visual Audit Patch.dc.html. */
export function sampleArrival(seat: SeatVisual, seconds: number) {
  const t = Math.max(0,Math.min(ARRIVAL_DURATION,seconds));
  let x=0,y=1.8,z=5.4,lx=0,ly=1.1,lz=0,chairZ=2.45,chairY=0,chairYaw=0,handsVisible=false,legsVisible=false;
  let label: ArrivalPhase='approach';
  if(t<2.2) {
    const u=phase(t,0,2.2), h=t*Math.PI*1.8, q=phase(t,1.2,2.2);
    x=lerp(.12,0,u)+Math.sin(h)*.008; y-=Math.abs(Math.sin(h))*.022; z=lerp(5.4,3.5,u);
    ly=lerp(1.1,1.05,q); lz=lerp(0,2.75,q);
  } else if(t<2.55) {
    label='stop'; y-=Math.sin(phase(t,2.2,2.55)*Math.PI)*.008; z=3.5; ly=1.05; lz=2.75;
  } else if(t<3.55) {
    label='chair'; handsVisible=true; const u=phase(t,2.6,3.5);
    chairZ=lerp(2.45,2.95,u); chairY=Math.sin(u*Math.PI)*.004; chairYaw=u*.06;
    y-=Math.sin(u*Math.PI*3)*.006; z=lerp(3.5,3.85,u); ly=1.05; lz=chairZ+.3;
  } else if(t<4.6) {
    label='step'; const u=phase(t,3.55,4.6), q=phase(t,3.7,4.6);
    x=2*u*(1-u)*.52+u*u*.02; y-=Math.abs(Math.sin(u*Math.PI*2))*.018;
    z=(1-u)*(1-u)*3.85+2*u*(1-u)*3.4+u*u*2.62;
    ly=lerp(1,.9,q); lz=lerp(3,-.4,q); chairZ=2.95; chairYaw=.06;
  } else if(t<6) {
    label='sit'; legsVisible=true; const d=phase(t,4.6,5.3), s=phase(t,5.3,6), n=phase(t,4.85,5.45);
    x=.02*(1-d); y=lerp(1.8,1.5,d)+.08*s+Math.sin(s*Math.PI)*.01;
    z=lerp(2.62,2.48,d)-.08*s; chairZ=lerp(2.95,2.66,n); chairYaw=.06*(1-n)+.015;
    ly=lerp(.9,.74,s); lz=lerp(-.4,-.6,s);
  } else {
    label='overview'; y=1.58; z=2.4; ly=.74; lz=-.6; chairZ=2.66; chairYaw=.015; legsVisible=true;
  }
  return { position:local(seat,x,y,z), lookAt:local(seat,lx,ly,lz), chairZ,chairY,chairYaw,handsVisible,legsVisible,
    chairSideOffset:0, chairBackOffset:chairZ-2.45, roll:0, phase:label };
}
export interface ArrivalBody { chair: Group; legs: Group; hands: Group }
/** Drives the camera and the viewer's physical intro props, never the game clock. */
export class TableArrival {
  private elapsed=0; private done=false; private readonly upperVisible: boolean | undefined;
  constructor(private readonly camera:PerspectiveCamera,private readonly seat:SeatVisual,private readonly character?:Group,
    private readonly onBeat?:(beat:ArrivalBeat)=>void,private readonly body?:ArrivalBody) {
    const upper=character?.getObjectByName('upper');
    this.upperVisible=upper?.visible; if(upper) upper.visible=false;
    this.update(0);
  }
  update(seconds:number):ArrivalPhase {
    if(this.done) return 'overview';
    const t=Math.max(this.elapsed,seconds),p=sampleArrival(this.seat,t);
    this.camera.position.copy(p.position); this.camera.lookAt(p.lookAt);
    if(this.body) {
      this.body.chair.position.set(0,p.chairY,p.chairZ); this.body.chair.rotation.y=p.chairYaw;
      this.body.legs.position.set(0,0,p.chairZ-.02); this.body.legs.visible=p.legsVisible;
      this.body.hands.position.set(0,1.33,p.chairZ+.3); this.body.hands.rotation.set(-.15,p.chairYaw,0); this.body.hands.visible=p.handsVisible;
    }
    for(const [beat,at] of ARRIVAL_BEATS) if(at>this.elapsed&&at<=t) this.onBeat?.(beat);
    this.elapsed=t; if(t>=ARRIVAL_DURATION) this.finish(); return p.phase;
  }
  finish():void {
    if(this.done) return; this.done=true; const p=seatedArrivalPose(this.seat);
    this.camera.position.copy(p.position); this.camera.lookAt(p.lookAt);
    if(this.body) {
      this.body.chair.position.set(0,0,2.66); this.body.chair.rotation.y=.015;
      this.body.legs.position.set(0,0,2.64); this.body.legs.visible=true; this.body.hands.visible=false;
    }
    const upper=this.character?.getObjectByName('upper'); if(upper&&this.upperVisible!==undefined) upper.visible=this.upperVisible;
  }
  get finished():boolean {return this.done}
  dispose():void {this.finish()}
}
