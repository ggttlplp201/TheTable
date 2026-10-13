import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PLAYER_IDS, type Assignment } from './types.js';
export const PROJECT_ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
export const BETA_ROOT = resolve(PROJECT_ROOT, 'beta');
export interface Config {url:string;model:string;apiKey:string;headless:boolean;maxMatchMs:number;outputDir:string;maxDecisions:number}
export function readConfig(env: NodeJS.ProcessEnv = process.env):Config {
  const url = env.BETA_GAME_URL ?? 'http://127.0.0.1:4173';
  const parsed = new URL(url);
  if (!['http:','https:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error('Invalid BETA_GAME_URL');
  const maxMatchMs = Number(env.BETA_MAX_MATCH_MINUTES ?? 90) * 60_000;
  const maxDecisions = Number(env.BETA_MAX_DECISIONS ?? 4000);
  if (!Number.isFinite(maxMatchMs) || maxMatchMs < 60_000 || !Number.isInteger(maxDecisions) || maxDecisions < 1) throw new Error('Invalid harness limits');
  return {url,model:env.BETA_MODEL ?? '',apiKey:env.OPENAI_API_KEY ?? '',headless:env.BETA_HEADED !== '1',maxMatchMs,maxDecisions,outputDir:resolve(env.BETA_OUTPUT_DIR ?? BETA_ROOT)};
}
export function assignmentsFor(index:number):Assignment[] {
  // Four cyclic persona placements; the role schedule advances independently every four matches.
  const roles = ['Enforcer','Medic','Smuggler','Locksmith','Broker','Scavenger'];
  return PLAYER_IDS.map((_,seat)=>({playerId:PLAYER_IDS[(seat+Math.floor(index/4))%4]!,seat,persona:PLAYER_IDS[(seat+index)%4]!,rolePreference:roles[(seat+Math.floor(index/4))%roles.length]!}));
}
export async function rulesFingerprint():Promise<string> {
  const hash=createHash('sha256');
  async function scan(dir:string):Promise<void>{
    for (const entry of (await readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))) {
      const path=resolve(dir,entry.name);
      if(entry.isDirectory()) await scan(path);
      else if (/\.(ts|tsx|css|js|html|json|md)$/.test(entry.name)) {hash.update(relative(PROJECT_ROOT,path));hash.update(await readFile(path));}
    }
  }
  // Includes uncommitted source changes. No model sees these files or this digest's source material.
  for(const dir of ['packages/game/src','packages/content/src','apps/server/src','apps/web/src','beta/runner','beta/agents','beta/schemas']) await scan(resolve(PROJECT_ROOT,dir));
  return hash.digest('hex');
}
