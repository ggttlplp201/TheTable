import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { resolve } from 'node:path';
import { PROJECT_ROOT } from './config.js';

async function assertFree(port: number) {
  await new Promise<void>((ok,fail)=>{const server=createServer();server.once('error',fail);server.listen(port,'127.0.0.1',()=>server.close(error=>error?fail(error):ok()));});
}
/** Runs the ordinary server entry point; no QA harness, seed, fake clock, or rules overrides. */
export async function startLocalApp(): Promise<()=>Promise<void>> {
  await assertFree(3107); await assertFree(4173);
  const children:ChildProcess[]=[];
  const stop=async()=>{
    await Promise.all(children.map(async child=>{
      if(child.exitCode !== null || child.signalCode !== null) return;
      child.kill('SIGTERM');
      await Promise.race([new Promise<void>(r=>child.once('exit',()=>r())),delay(4000)]);
      if(child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    }));
  };
  const env={...process.env};delete env.OPENAI_API_KEY;
  try {
    children.push(spawn(resolve(PROJECT_ROOT,'apps/server/node_modules/.bin/tsx'),['apps/server/src/index.ts'],{cwd:PROJECT_ROOT,env:{...env,PORT:'3107',HOST:'127.0.0.1',CLIENT_ORIGIN:'http://127.0.0.1:4173',VOICE_ENABLED:'false'},stdio:['ignore','inherit','inherit']}));
    children.push(spawn(resolve(PROJECT_ROOT,'apps/web/node_modules/.bin/vite'),['--host','127.0.0.1','--port','4173','--strictPort'],{cwd:resolve(PROJECT_ROOT,'apps/web'),env:{...env,VITE_SERVER_URL:'http://127.0.0.1:3107'},stdio:['ignore','inherit','inherit']}));
    let spawnError:Error|undefined;
    for(const child of children) child.once('error',error=>{spawnError=error;});
    const deadline=Date.now()+30_000;
    while(Date.now()<deadline){
      if(spawnError) throw spawnError;
      if(children.some(c=>c.exitCode !== null)) throw new Error('Local app exited before readiness');
      try {
        const responses=await Promise.all([fetch('http://127.0.0.1:3107/health/ready',{signal:AbortSignal.timeout(1500)}),fetch('http://127.0.0.1:4173',{signal:AbortSignal.timeout(1500)})]);
        if(responses.every(r=>r.ok)) return stop;
      } catch { /* startup */ }
      await delay(250);
    }
    throw new Error('Local app did not become ready');
  } catch(error){await stop();throw error;}
}
