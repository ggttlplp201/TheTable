import { mkdir, writeFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { readConfig } from './config.js';
import { startLocalApp } from './local-server.js';
import { preflight, runBatch } from './orchestrator.js';
import { generateFindings } from './reviewer.js';
import { validateUI } from './validate-ui.js';
import { OpenAIClient } from './model-client.js';

const command=process.argv[2]??'run';
const config=readConfig();
const controller=new AbortController();
for(const signal of ['SIGINT','SIGTERM'] as const)process.once(signal,()=>controller.abort());
let stop:(()=>Promise<void>)|undefined;
try {
  if(command==='report'){
    if(config.apiKey && config.model){
      const reviewer=new OpenAIClient({apiKey:config.apiKey,model:config.model,timeoutMs:60_000});
      await generateFindings({replaysDir:resolve(config.outputDir,'replays'),outputDir:config.outputDir,complete:input=>reviewer.complete({...input,format:'text'})});
    } else {
      const inventory=resolve(config.outputDir,'inventory');
      await generateFindings({replaysDir:resolve(config.outputDir,'replays'),outputDir:inventory});
      console.log(`No reviewer credentials: deterministic inventory saved to ${inventory}; existing findings preserved.`);
    }
  }
  else if(command==='preflight')await preflight(config);
  else if(command==='run'||command==='validate-ui'){
    if(command==='run')await preflight(config);
    if(!process.env.BETA_GAME_URL)stop=await startLocalApp();
    if(command==='run')await runBatch(config,controller.signal);
    else await validateUI(config);
  }else throw new Error('Usage: beta/runner/cli.ts run|preflight|validate-ui|report');
  await mkdir(config.outputDir,{recursive:true});
  const status=JSON.stringify({at:new Date().toISOString(),command,status:'succeeded'},null,2)+'\n';
  await writeFile(resolve(config.outputDir,'last-run-status.json'),status);
  await writeFile(resolve(config.outputDir,`${command}-status.json`),status);
}catch(error){
  const message=error instanceof Error?error.message:String(error);
  console.error(message);
  await mkdir(config.outputDir,{recursive:true});
  const status=JSON.stringify({at:new Date().toISOString(),command,status:'blocked',reason:message},null,2)+'\n';
  await writeFile(resolve(config.outputDir,'last-run-status.json'),status);
  if(['run','preflight','validate-ui','report'].includes(command))await writeFile(resolve(config.outputDir,`${command}-status.json`),status);
  if(command==='run' && !(await stat(resolve(config.outputDir,'FAST_BETA_FINDINGS.md')).catch(()=>undefined)))await generateFindings({replaysDir:resolve(config.outputDir,'replays'),outputDir:config.outputDir}).catch(()=>{});
  process.exitCode=1;
}finally{await stop?.();}
