import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from '@playwright/test';
import { BrowserPlayer } from './browser-player.js';
import { assignmentsFor, type Config } from './config.js';
import type { Observation, UIControl } from './types.js';

/** Wiring validation only. It does not impersonate AI gameplay or count as a smoke match. */
export async function validateUI(config:Config){
  const directory=resolve(config.outputDir,'validation',new Date().toISOString().replace(/[:.]/g,'-'));
  await mkdir(directory,{recursive:true});
  const browser=await chromium.launch({headless:config.headless});
  const players:BrowserPlayer[]=[];
  const observations:Observation[]=[];
  let failure:unknown;
  let stage='launch';
  const checkpoint=(next:string)=>{stage=next;console.log(`UI validation: ${next}`);};
  async function click(player:BrowserPlayer,predicate:(control:UIControl)=>boolean){
    const deadline=Date.now()+20_000;
    while(Date.now()<deadline){
      const observation=await player.observe();
      const control=observation.controls.find(c=>c.enabled&&predicate(c));
      if(control){await player.act({observationId:observation.id,intent:'Validate this visible UI control',action:{type:'click',controlId:control.id},noMeaningfulAction:false});return;}
      await delay(250);
    }
    throw new Error(`UI BLOCKER: requested control not visible for player ${player.playerId}`);
  }
  async function lockSetup(player:BrowserPlayer){
    const deadline=Date.now()+40_000;
    let selected=false,submitted=false;
    while(Date.now()<deadline){
      const observation=await player.observe();
      if(observation.phase==='playing' && submitted || /is locked in your Pocket/i.test(observation.text)){
        observation.screenshotPath=await player.screenshot('setup-locked');observations.push(observation);return;
      }
      if(observation.phase==='playing')throw new Error(`UI BLOCKER: setup ended before player ${player.playerId} could submit a Pocket choice`);
      const control=observation.controls.find(c=>c.enabled&&(selected?/^Lock Pocket choice$/i.test(c.name):/^Pocket /i.test(c.name)&&c.name!=='Pocket nothing'));
      if(control){
        await player.act({observationId:observation.id,intent:selected?'Lock selected starting Pocket through the UI':'Select an eligible starting Pocket item',action:{type:'click',controlId:control.id},noMeaningfulAction:false});
        if(selected)submitted=true;else selected=true;
      }
      // A click is not an acceptance receipt. Reinspect the visible UI and
      // retry a normal lock control if another player's revision won the race.
      await delay(250);
    }
    throw new Error(`UI BLOCKER: player ${player.playerId} did not visibly finish Pocket setup`);
  }
  try {
    for(const assignment of assignmentsFor(0)){
      checkpoint(`player ${assignment.playerId}: open session and handbook`);
      const player=await BrowserPlayer.create(browser,{playerId:assignment.playerId,url:config.url,outputDir:directory});players.push(player);
      const handbook=await player.readHandbook();
      if(!handbook.includes('Primary Action')||!handbook.includes('Trade'))throw new Error('Player handbook is incomplete');
    }
    checkpoint('player a: create room');
    const code=await players[0]!.createRoom('Player A');
    for(const player of players.slice(1)){checkpoint(`player ${player.playerId}: join room`);await player.joinRoom(code,`Player ${player.playerId.toUpperCase()}`);}
    for(const [index,player] of players.entries()){checkpoint(`player ${player.playerId}: role and ready`);await player.chooseRoleAndReady(assignmentsFor(0)[index]!.rolePreference);}
    for(const player of players){const obs=await player.observe();obs.screenshotPath=await player.screenshot('four-player-lobby');observations.push(obs);}
    checkpoint('start match and lock private Pockets');
    await players[0]!.startMatch();
    for(const player of players){checkpoint(`player ${player.playerId}: confirm private Pocket lock`);await lockSetup(player);}
    checkpoint('inspect own Contracts and public history');
    // Arrival and objective presentation use their normal production timings.
    for(const player of players){
      if(!await player.revealTableTools(45_000))throw new Error(`UI BLOCKER: player ${player.playerId} could not reveal Table tools using normal pointer or keyboard input`);
      await click(player,c=>/^Contract$/i.test(c.name));
      const obs=await player.observe();obs.screenshotPath=await player.screenshot('own-contract');observations.push(obs);
      const closeObservation=await player.observe();
      await player.act({observationId:closeObservation.id,intent:'Close the Contract with its normal Escape shortcut',action:{type:'press',key:'Escape'},noMeaningfulAction:false});
      const history=await player.inspectHistory();if(!history)throw new Error(`UI BLOCKER: player ${player.playerId} could not open public history`);observations.push(history);
    }
  }catch(error){failure=error;for(const player of players)await player.screenshot('validation-blocker').catch(()=>{});}
  finally {
    const videos=await Promise.allSettled(players.map(player=>player.close()));
    if(videos.some(v=>v.status==='rejected'))failure??=new Error('Video finalization failed');
    await browser.close();
    await writeFile(resolve(directory,'observations.json'),JSON.stringify(observations,null,2));
    await writeFile(resolve(directory,'validation-summary.md'),`# UI wiring validation\n\nStatus: ${failure?'FAILED':'PASSED'}\n\nLast checkpoint: ${stage}\n\nThis is a scripted browser-boundary check, not an AI smoke match or completed gameplay match. It checks four separate sessions, visible room creation/joining, handbook access, role readiness, private Pocket setup, Contract controls, history and four browser videos. Normal game timers were used.\n\n${failure instanceof Error?failure.message:''}\n`);
  }
  console.log(`UI validation evidence: ${directory}`);
  if(failure)throw failure;
}
