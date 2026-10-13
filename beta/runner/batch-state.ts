import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
export type MatchKind = 'smoke'|'full';
export interface Attempt {matchId:string;kind:MatchKind;status:'running'|'completed'|'failed'|'blocked';directory:string;feedbackComplete:boolean;videosComplete:boolean}
export interface BatchState {version:1;createdAt:string;fingerprint:string;model:string;url:string;attempts:Attempt[]}
export function nextMatchKind(state:BatchState):MatchKind|null {
  if(state.attempts.some(a=>a.status!=='completed'||!a.feedbackComplete||!a.videosComplete)) throw new Error('Previous attempt is incomplete. Review its evidence and start a new output directory; failed smoke tests never unlock the full batch.');
  if(state.attempts.filter(a=>a.kind==='smoke').length<3) return 'smoke';
  return state.attempts.filter(a=>a.kind==='full').length<20?'full':null;
}
export async function loadBatch(directory:string, identity:{fingerprint:string;model:string;url:string}):Promise<BatchState>{
  let raw:string;
  try {raw=await readFile(resolve(directory,'batch.json'),'utf8');}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;return {version:1,createdAt:new Date().toISOString(),...identity,attempts:[]};}
  const state=JSON.parse(raw) as BatchState;
  if(state.version!==1 || !Array.isArray(state.attempts)) throw new Error('Invalid batch manifest');
  if(state.fingerprint!==identity.fingerprint || state.model!==identity.model || state.url!==identity.url) throw new Error('Batch identity changed (rules/UI source, model, or game URL). Start a fresh BETA_OUTPUT_DIR.');
  return state;
}
export async function saveBatch(directory:string,state:BatchState){
  await mkdir(directory,{recursive:true});
  await writeFile(resolve(directory,'batch.json.tmp'),JSON.stringify(state,null,2)+'\n');
  await rename(resolve(directory,'batch.json.tmp'),resolve(directory,'batch.json'));
}
