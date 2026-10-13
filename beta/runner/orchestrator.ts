import { readFile, mkdir, stat, writeFile, open, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium, type Browser } from '@playwright/test';
import { BrowserPlayer } from './browser-player.js';
import { PlayerAgent } from './player-agent.js';
import { OpenAIClient } from './model-client.js';
import { ReplayRecorder } from './replay-recorder.js';
import { runFeedback } from './feedback-runner.js';
import { generateFindings } from './reviewer.js';
import { assignmentsFor, BETA_ROOT, rulesFingerprint, type Config } from './config.js';
import { loadBatch, nextMatchKind, saveBatch, type Attempt } from './batch-state.js';
import type { Decision, PlayerId } from './types.js';

const now=()=>new Date().toISOString();
const errorText=(error:unknown)=>error instanceof Error?error.message:String(error);

export async function runMatch(browser:Browser, config:Config, index:number, attempt:Attempt, fingerprint:string, signal:AbortSignal):Promise<Attempt> {
  const assignments=assignmentsFor(index);
  const directory=attempt.directory;
  await mkdir(directory,{recursive:true});
  const recorder=new ReplayRecorder(directory,{matchId:attempt.matchId,kind:attempt.kind,startedAt:now(),assignments,rulesFingerprint:fingerprint,model:config.model});
  const players=new Map<PlayerId,BrowserPlayer>();
  const agents=new Map<PlayerId,PlayerAgent>();
  const interviews=new Map<PlayerId,Promise<boolean>>();
  const base=await readFile(resolve(BETA_ROOT,'agents/PLAYER_BASE.md'),'utf8');
  let status:Attempt['status']='failed';
  let endedAt=now();
  let stop=false;
  let fatal:unknown;
  let stage='create independent browser sessions';
  const interview=(id:PlayerId):Promise<boolean>=>{
    const existing=interviews.get(id);if(existing)return existing;
    const agent=agents.get(id);
    if(!agent)return Promise.resolve(false);
    const persona=assignments.find(a=>a.playerId===id)!.persona;
    const model=new OpenAIClient({apiKey:config.apiKey,model:config.model,timeoutMs:60_000});
    const pending=runFeedback({playerId:id,persona,model:input=>model.complete(input),observations:agent.observations,decisions:agent.decisions,outputDir:directory}).then(report=>report.status==='complete').catch(async error=>{await recorder.recordFailure({playerId:id,at:now(),reason:`Interview failure: ${errorText(error)}`});return false;});
    interviews.set(id,pending);return pending;
  };
  try {
    // Deterministic join order is seat rotation; personas and Roles rotate independently.
    for(const assignment of assignments){
      stage=`open player ${assignment.playerId}'s browser and handbook`;
      const player=await BrowserPlayer.create(browser,{playerId:assignment.playerId,url:config.url,outputDir:directory});
      players.set(assignment.playerId,player);
      const handbook=await player.readHandbook();
      await writeFile(resolve(directory,`player-${assignment.playerId}-handbook.txt`),handbook);
      const persona=await readFile(resolve(BETA_ROOT,`agents/PLAYER_${assignment.persona.toUpperCase()}.md`),'utf8');
      agents.set(assignment.playerId,new PlayerAgent(assignment.playerId,new OpenAIClient({apiKey:config.apiKey,model:config.model}),`${base}\nYour table identity is Player ${assignment.playerId.toUpperCase()}. The following persona label is a behavioral assignment, not your seat or display name.\n${persona}\nCurrent player-facing handbook:\n${handbook}`));
    }
    const hostId=assignments[0]!.playerId;
    const host=players.get(hostId)!;
    stage=`create room as player ${hostId}`;
    const code=await host.createRoom(`Player ${hostId.toUpperCase()}`);
    for(const {playerId:id} of assignments.slice(1)){stage=`join room as player ${id}`;await players.get(id)!.joinRoom(code,`Player ${id.toUpperCase()}`);}
    for(const a of assignments) {
      stage=`choose ${a.rolePreference} and ready player ${a.playerId}`;
      await players.get(a.playerId)!.chooseRoleAndReady(a.rolePreference);
      const observation=await players.get(a.playerId)!.observe();
      agents.get(a.playerId)!.observe(observation);
      observation.screenshotPath=await players.get(a.playerId)!.screenshot('lobby-ready');
      await recorder.recordObservation(observation);
    }
    stage='start match through the host UI';
    await host.startMatch();
    stage='complete normal gameplay through visible UI';
    const deadline=Date.now()+config.maxMatchMs;
    const seenResults=new Set<PlayerId>();
    const tasks=assignments.map(async assignment=>{
      const id=assignment.playerId, player=players.get(id)!, agent=agents.get(id)!;
      let decisions=0, errors=0, lastRound:number|null=null, lastPhase='',lastHistory=0,lastAlert='';
      while(!stop && !signal.aborted && Date.now()<deadline){
        const observation=await player.observe();
        if(observation.phase==='spectator'||observation.phase==='results'){
          void interview(id);
          if(observation.phase==='results'){seenResults.add(id);break;}
          await delay(500);continue;
        }
        if(observation.phase!==lastPhase || observation.round!==lastRound || decisions%8===0) observation.screenshotPath=await player.screenshot(`round-${observation.round??0}-${observation.phase}`);
        lastRound=observation.round;lastPhase=observation.phase;
        agent.observe(observation);
        await recorder.recordObservation(observation);
        const alert=(observation.errors??[]).join('\n');
        if(alert && alert!==lastAlert){
          const screenshotPath=observation.screenshotPath??await player.screenshot('ui-rejection');
          await recorder.recordFailure({playerId:id,at:observation.capturedAt,reason:`Visible UI rejection: ${alert}`,screenshotPath,intendedAction:agent.decisions.at(-1)?.intent??'Complete the visible player action'});
        }
        lastAlert=alert;
        if(++decisions>config.maxDecisions)throw new Error(`Harness decision limit reached for player ${id}; match is incomplete.`);
        let decision:Decision|undefined;
        try {
          decision=await agent.decide(observation);
          if(stop||signal.aborted)break;
          await player.act(decision);
          agent.outcome(observation.id,'UI input performed; inspect the next visible state for acceptance.');
          await recorder.recordAction({playerId:id,at:now(),observationId:observation.id,action:decision.action,outcome:'performed',reason:decision.intent,noMeaningfulAction:decision.noMeaningfulAction,...(observation.round !== null && /YOUR TURN/.test(observation.text) ? {turnKey:`${id}:${observation.round}`} : {})});
          errors=0;
        }catch(error){
          const reason=errorText(error);agent.outcome(observation.id,reason);
          await recorder.recordAction({playerId:id,at:now(),observationId:observation.id,action:decision?.action??{type:'model-decision'},outcome:'rejected',error:reason});
          if(++errors>=5){
            const screenshotPath=await player.screenshot('blocker');
            await recorder.recordFailure({playerId:id,at:now(),reason:`UI BLOCKER or harness failure after five rejected attempts: ${reason}`,screenshotPath,intendedAction:decision?.action??'Obtain a valid UI decision'});
            throw new Error(`Player ${id} could not proceed: ${reason}`);
          }
        }
        if(Date.now()-lastHistory>10_000){
          try {
            const history=await player.inspectHistory();
            if(history){agent.observe(history);await recorder.recordObservation(history);}
          } catch(error) { await recorder.recordFailure({playerId:id,at:now(),reason:`History inspection unavailable: ${errorText(error)}`}); }
          lastHistory=Date.now();
        }
        await delay(150);
      }
      if(signal.aborted)throw new Error('Batch interrupted; recorded attempt is incomplete.');
    });
    // A failed player stops every loop, but cleanup waits for all pending calls to settle.
    await Promise.all(tasks.map(task=>task.catch(error=>{stop=true;fatal??=error;})));
    endedAt=now();
    if(fatal)throw fatal;
    if(seenResults.size!==4)throw new Error('Harness time limit reached before all four browsers showed match Results. Timers were not advanced.');
    status='completed';
  }catch(error){
    endedAt=now();status='blocked';
    await recorder.recordFailure({at:endedAt,reason:errorText(error),intendedAction:stage});
    for(const [id,player] of players){
      try {
        const observation=await player.observe();
        observation.screenshotPath=await player.screenshot('failure-state');
        await recorder.recordObservation(observation);
        await recorder.recordFailure({playerId:id,at:now(),reason:`Failure state while attempting: ${stage}. ${errorText(error)}`,screenshotPath:observation.screenshotPath,intendedAction:stage});
      } catch { /* Keep the original failure if the browser itself is unavailable. */ }
    }
  }finally{
    stop=true;
    try {
      const feedback=await Promise.all(assignments.map(a=>interview(a.playerId)));
      attempt.feedbackComplete=feedback.every(Boolean);
      if(attempt.feedbackComplete && status==='completed'){
        const result=await players.get('a')!.resultsSummary();
        if(result)await recorder.recordResults(result);
        else {status='blocked';await recorder.recordFailure({at:now(),reason:'UI BLOCKER: final result table unavailable after interviews.'});}
      }
    } catch(error) {
      status='failed';await recorder.recordFailure({at:now(),reason:`Final evidence failure: ${errorText(error)}`});
    } finally {
      const videos=await Promise.allSettled([...players.values()].map(p=>p.close()));
      attempt.videosComplete=videos.length===4 && videos.every(v=>v.status==='fulfilled');
      for(const v of videos)if(v.status==='rejected')await recorder.recordFailure({at:now(),reason:`Video failure: ${errorText(v.reason)}`});
    }
    if(!attempt.feedbackComplete||!attempt.videosComplete)status='failed';
    if(await rulesFingerprint()!==fingerprint) {
      status='failed';
      await recorder.recordFailure({at:now(),reason:'Game or harness source changed during this match. This replay is excluded from the stable sample.'});
    }
    attempt.status=status;
    await recorder.finalize({status,endedAt,feedbackComplete:attempt.feedbackComplete});
  }
  return attempt;
}

export async function preflight(config:Config):Promise<void>{
  const missing=['OPENAI_API_KEY','BETA_MODEL'].filter(key=>!(key==='OPENAI_API_KEY'?config.apiKey:config.model));
  if(missing.length)throw new Error(`Missing ${missing.join(' and ')}. Configure these in the runner environment; no AI matches attempted.`);
  await stat(chromium.executablePath());
  const client=new OpenAIClient({apiKey:config.apiKey,model:config.model});
  const response=JSON.parse(await client.complete({system:'Connectivity check. Return JSON only.',prompt:'Return {"ok":true}.'})) as {ok?:boolean};
  if(response.ok!==true)throw new Error('Model preflight did not return a valid response.');
}

export async function runBatch(config:Config, signal:AbortSignal):Promise<void>{
  await mkdir(config.outputDir,{recursive:true});
  const lockPath=resolve(config.outputDir,'batch.lock');
  const lock=await open(lockPath,'wx').catch(()=>{throw new Error('The output directory is locked by another or interrupted beta runner. Inspect batch.lock before restarting.');});
  try {
    await lock.writeFile(JSON.stringify({pid:process.pid,startedAt:now()})+'\n');
    await runLockedBatch(config,signal);
  } finally {await lock.close();await unlink(lockPath);}
}

async function runLockedBatch(config:Config, signal:AbortSignal):Promise<void>{
  const fingerprint=await rulesFingerprint();
  const state=await loadBatch(config.outputDir,{fingerprint,model:config.model,url:config.url});
  await saveBatch(config.outputDir,state);
  const browser=await chromium.launch({headless:config.headless});
  try {
    while(!signal.aborted){
      const kind=nextMatchKind(state);if(!kind)break;
      if(await rulesFingerprint()!==fingerprint)throw new Error('Source changed during the batch. The stable sample has stopped.');
      const matchId=`match-${String(state.attempts.length+1).padStart(3,'0')}`;
      const directory=resolve(config.outputDir,'replays',matchId);
      const attempt:Attempt={matchId,kind,status:'running',directory,feedbackComplete:false,videosComplete:false};
      state.attempts.push(attempt);await saveBatch(config.outputDir,state);
      console.log(`${matchId}: starting ${kind} match with four independent players`);
      await runMatch(browser,config,state.attempts.length-1,attempt,fingerprint,signal);
      await saveBatch(config.outputDir,state);
      console.log(`${matchId}: ${attempt.status}`);
      if(attempt.status!=='completed')break;
    }
  }finally{
    await browser.close();
    const reviewer = new OpenAIClient({apiKey:config.apiKey,model:config.model,timeoutMs:60_000});
    await generateFindings({replaysDir:resolve(config.outputDir,'replays'),outputDir:config.outputDir,complete:input=>reviewer.complete({...input,format:'text'})});
  }
  const aggregate=JSON.parse(await readFile(resolve(config.outputDir,'aggregate-metrics.json'),'utf8')) as {
    completionGatePassed?:boolean; matchesAttempted:number; matchesCompleted:number; harnessFailures:number;
    averageRounds:{value:number|null}; averageDurationMs:{value:number|null};
  };
  console.log([
    `Matches attempted: ${aggregate.matchesAttempted}`,
    `Matches completed: ${aggregate.matchesCompleted}`,
    `Harness failures: ${aggregate.harnessFailures}`,
    `Average rounds: ${aggregate.averageRounds.value ?? 'unknown'}`,
    `Average duration: ${aggregate.averageDurationMs.value === null ? 'unknown' : `${Math.round(aggregate.averageDurationMs.value / 1000)} seconds`}`,
    `Replay directory: ${resolve(config.outputDir,'replays')}`,
    `Feedback directory: each match directory inside ${resolve(config.outputDir,'replays')}`,
    `Findings report: ${resolve(config.outputDir,'FAST_BETA_FINDINGS.md')}`,
    'Major issues discovered: see the evidence-backed findings report.',
  ].join('\n'));
  if(nextMatchKind(state)!==null)throw new Error('Beta sample is incomplete. Review FAST_BETA_FINDINGS.md and the saved attempt.');
  if(!aggregate.completionGatePassed)throw new Error('Matches finished but mandatory evidence is incomplete. Review FAST_BETA_FINDINGS.md.');
}
