import { describe, expect, it } from 'vitest';
import { assignmentsFor } from '../runner/config.js';
import { nextMatchKind, type BatchState } from '../runner/batch-state.js';
import { parseDecision } from '../runner/decision.js';
import { PlayerAgent } from '../runner/player-agent.js';
import { OpenAIClient } from '../runner/model-client.js';
import type { Observation } from '../runner/types.js';
const obs:Observation={id:'a-1',playerId:'a',capturedAt:'2026-01-01T00:00:00Z',url:'http://localhost',title:'Table',text:'my private objective',round:1,phase:'playing',controls:[{id:'button-1',kind:'button',role:'button',name:'Trade',enabled:true}],visibleEvents:[]};
const decision={observationId:'a-1',intent:'Trade for a key',noMeaningfulAction:false,action:{type:'click',controlId:'button-1'}};
describe('UI capability validation',()=>{
 it('allows only current enabled control IDs',()=>{expect(parseDecision(JSON.stringify(decision),obs)).toEqual(decision);expect(()=>parseDecision(JSON.stringify({...decision,action:{type:'click',controlId:'hidden'}}),obs)).toThrow();});
 it('rejects executable payloads, unknown actions, stale IDs and spectator actions',()=>{
  for(const change of [{action:{type:'evaluate',code:'window.state'}},{action:{type:'press',key:'Meta+L'}},{action:{type:'click',controlId:'button-1',script:'evil'}},{observationId:'old'}]) expect(()=>parseDecision(JSON.stringify({...decision,...change}),obs)).toThrow();
  expect(()=>parseDecision(JSON.stringify(decision),{...obs,phase:'spectator'})).toThrow();
 });
});
describe('agent isolation',()=>{
 it('rejects foreign observations before they enter memory or model calls',async()=>{let calls=0;const agent=new PlayerAgent('a',{complete:async()=>{calls++;return JSON.stringify(decision);}},'rules');await expect(agent.decide({...obs,playerId:'b',text:'B secret'})).rejects.toThrow('Cross-player');expect(calls).toBe(0);expect(agent.observations).toHaveLength(0);});
 it('never appends spectator secrets and freezes interview evidence',async()=>{const agent=new PlayerAgent('a',{complete:async()=>JSON.stringify(decision)},'rules');agent.observe(obs);agent.observe({...obs,id:'terminal',phase:'spectator',text:'B secret'});expect(agent.observations).toEqual([obs]);await expect(agent.decide({...obs,phase:'results'})).rejects.toThrow();});
 it('remembers the rendered private Contract after it leaves recent screen history',async()=>{
  let prompt='';
  const agent=new PlayerAgent('a',{complete:async input=>{prompt=input.prompt;return JSON.stringify(decision);}},'rules');
  const contract={...obs,id:'a-contract',text:'ROUND\n01\nYOUR TURN\nCONTRACT · PRIVATE\n◆ SEALED\nMartyr\nBe the first player to permanently die.',controls:[]};
  agent.observe(contract);
  for(let i=0;i<13;i++)agent.observe({...obs,id:`a-later-${i}`,text:'Ordinary public table screen'});
  await agent.decide(obs);
  const sent=JSON.parse(prompt) as {rememberedOwnContract:Observation;recentOwnObservations:Observation[]};
  expect(sent.rememberedOwnContract).toEqual(contract);
  expect(sent.recentOwnObservations.some(o=>o.id===contract.id)).toBe(false);
 });
 it('sends stateless no-tool provider requests',async()=>{let sent:Record<string,unknown>={};const transport:typeof fetch=async(_url,init)=>{sent=JSON.parse(String(init?.body));return new Response(JSON.stringify({status:'completed',output:[{type:'message',content:[{type:'output_text',text:'{}'}]}]}));};const client=new OpenAIClient({apiKey:'test',model:'test-model'},transport);await client.complete({system:'rules',prompt:'A only'});expect(sent).toMatchObject({store:false,tools:[],input:'A only'});expect(sent).not.toHaveProperty('previous_response_id');});
 it('does not send OpenAI credentials to arbitrary endpoints',()=>expect(()=>new OpenAIClient({apiKey:'test',model:'test',baseUrl:'https://example.com'})).toThrow());
});
describe('stable batch gates',()=>{
 const state=():BatchState=>({version:1,createdAt:'now',fingerprint:'fixed',model:'test',url:'local',attempts:[]});
 it('requires three successful smoke packages before full matches',()=>{const s=state();expect(nextMatchKind(s)).toBe('smoke');for(let i=0;i<3;i++)s.attempts.push({matchId:String(i),kind:'smoke',status:'completed',directory:String(i),feedbackComplete:true,videosComplete:true});expect(nextMatchKind(s)).toBe('full');s.attempts[1]!.videosComplete=false;expect(()=>nextMatchKind(s)).toThrow();});
 it('ends after exactly 20 full matches and rejects interrupted attempts',()=>{const s=state();for(let i=0;i<23;i++)s.attempts.push({matchId:String(i),kind:i<3?'smoke':'full',status:'completed',directory:String(i),feedbackComplete:true,videosComplete:true});expect(nextMatchKind(s)).toBeNull();s.attempts[10]!.status='running';expect(()=>nextMatchKind(s)).toThrow();});
 it('rotates all personas across seats independently of roles',()=>{for(let seat=0;seat<4;seat++)expect(new Set(Array.from({length:4},(_,i)=>assignmentsFor(i)[seat]!.persona)).size).toBe(4);expect(assignmentsFor(0)[0]!.rolePreference).not.toBe(assignmentsFor(4)[0]!.rolePreference);expect(new Set([0,4,8,12].map(i=>assignmentsFor(i)[0]!.playerId)).size).toBe(4);});
});
