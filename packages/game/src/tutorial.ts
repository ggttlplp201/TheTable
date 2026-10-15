import { applyCommand, applyTimeout, startMatch } from './engine.js';
import { projectAuthorizedRoom } from './projection.js';
import { event } from './internal.js';
import { stack } from './inventory.js';
import { assignTasks } from './tasks.js';
import { RULES } from './content.js';
import type { AuthorizedRoomView, GameCommand, PlayerState, RoomState } from './types.js';
export const TUTORIAL_VERSION = 2;
export const HUMAN = 'student';
export const DEALER = 'dealer';
export const TUTORIAL_STEPS = {
  look: { chapter: 1, title: 'LOOK AROUND THE TABLE', text: 'Move your cursor left and right to look around. Explore the room before you act.', focus: 'table' },
  dealer: { chapter: 1, title: 'THE DEALER', text: 'Your practice opponent sits opposite you. The Dealer follows a fixed lesson.', focus: 'dealer' },
  inventory: { chapter: 1, title: 'YOUR PLACE AT THE TABLE', text: 'Your Role, HP and Gold are beside your visible items. Everyone can see items left on the table.', focus: 'inventory' },
  pocket: { chapter: 1, title: 'PUT MEDICINE IN YOUR POCKET', text: 'Open Pockets, select Medicine, then fill your empty Pocket.', focus: 'pockets' },
  privacy: { chapter: 1, title: 'ONLY YOU KNOW WHAT IS INSIDE', text: 'YOU SEE: MEDICINE. THE DEALER SEES: POCKET OCCUPIED. A Pocket stays locked until its item is used.', focus: 'pockets' },
  trade: { chapter: 2, title: 'TRADE WITH THE DEALER', text: 'Open Trade. Give your Key and request 2 Gold. Your private TRADE Task pays another 2 Gold.', focus: 'trade' },
  reward: { chapter: 2, title: 'TASK COMPLETE · +2 GOLD', text: 'The Key changed hands, you received 2 Gold, and your Task added 2 more. Your Primary Action is resolved, so your turn ended automatically.', focus: 'tasks' },
  refuse: { chapter: 3, title: 'REFUSE THE COVERED THREAT', text: 'The Dealer demands 2 Gold. The hidden item may be a weapon or a bluff. Refuse this one.', focus: 'response' },
  bluff: { chapter: 3, title: 'BLUFF CALLED', text: 'An Antidote was under the Cloth. No attack occurred. Trade timeout = Decline. Threat timeout = Comply.', focus: 'dealer' },
  practice: { chapter: 3, title: 'YOUR COVERED THREAT', text: 'Choose Threaten → Under Cloth. Back it with your Knife, cover it with Cloth, and demand 1 Gold from The Dealer.', focus: 'threat' },
  practiceDone: { chapter: 3, title: 'THE DEALER COMPLIED', text: 'You received the Gold. The Knife was not used. Next you will practise surviving a lethal hit.', focus: 'dealer' },
  downed: { chapter: 4, title: 'DOWNED — NOT DEAD', text: 'You can still talk and inspect the table. You die immediately before The Dealer’s next normal turn if you remain Downed. It is your Downed turn: use REVIVE WITH MEDICINE.', focus: 'revive' },
  income: { chapter: 5, title: 'ROUND COMPLETE · +2 ROUND INCOME', text: 'You revived to 2 HP. Every living player still at the table receives Round Income. Tasks can earn extra Gold.', focus: 'coins' },
  publicShop: { chapter: 5, title: 'BUY A KEY AT THE PUBLIC SHOP', text: 'Shared stock: once someone buys an item, it is gone. Buy the Key before entering your private market.', focus: 'market' },
  blackMarket: { chapter: 5, title: 'YOUR PRIVATE BLACK MARKET', text: 'Your Public decision unlocked the Black Market. Other players cannot see these offers. Buy the Antidote.', focus: 'market' },
  finishShopping: { chapter: 5, title: 'FINISH SHOPPING', text: 'Use Finish Intermission to move on when you are ready.', focus: 'market' },
  chest: { chapter: 5, title: 'TRAINING CONTRACT · OPEN THE STANDARD CHEST', text: 'Click the physical Standard Chest, then use your Key. This is your training exit objective.', focus: 'chest' },
  objective: { chapter: 5, title: 'OBJECTIVE COMPLETE', text: 'Leave Table unlocks at the start of your next normal turn. Until then, you are still exposed to other players.', focus: 'contract' },
  draw: { chapter: 6, title: 'ROUND 3 · DRAW A WILDCARD', text: 'Use DRAW WILDCARD at the bottom of the screen. You may draw once per match, and drawing spends your Primary Action.', focus: 'wildcard' },
  use: { chapter: 6, title: 'SEIZE · USE YOUR CARD', text: 'This card takes one visible item from another player. USE reveals it to the table; BURN discards it while keeping its identity secret.', focus: 'wildcard' },
  seize: { chapter: 6, title: 'TAKE A VISIBLE DEALER ITEM', text: 'Choose The Dealer, select one visible item, and resolve SEIZE.', focus: 'dealer' },
  burn: { chapter: 6, title: 'YOU USED A WILDCARD', text: 'In a real match, you may BURN instead. A burned Wildcard stays secret. Your action is complete; leave on your next normal turn.', focus: 'wildcard' },
  exit: { chapter: 6, title: 'LEAVE THE TABLE', text: 'Your next normal turn has begun. Your completed Contract lets you leave successfully. Open Contract or click the exit.', focus: 'contract' },
  complete: { chapter: 6, title: 'YOU’RE READY FOR THE TABLE', text: '3–4 players. Secret Objectives. Trust nobody completely.', focus: 'table' },
} as const;
export type TutorialStep = keyof typeof TUTORIAL_STEPS;
export interface TutorialMetric { kind: 'started' | 'chapter' | 'retry' | 'completed' | 'abandoned' | 'replayed'; at: number; chapter: number; elapsedMs?: number; action?: string }
const item = (room: RoomState, owner: string, id: string) => { const player = room.players.find(value => value.id === owner)!; return [...player.inventory.visible, ...player.inventory.pockets.map(pocket => pocket.item)].find(value => value?.itemId === id)!; };

/** Local deterministic lesson conductor. All visible transactions use the same engine as multiplayer. */
export class TutorialController {
  room: RoomState;
  step: TutorialStep = 'look';
  retries = 0;
  readonly metrics: TutorialMetric[] = [];
  private lookedLeft = false;
  private lookedRight = false;
  private chapterStartedAt: number;
  private wildcardCheckpoint?: RoomState;
  constructor(private readonly clock = () => Date.now()) {
    const now = clock(); this.chapterStartedAt = now;
    const players: PlayerState[] = [HUMAN, DEALER].map((id, index) => ({ id, seat: index as 0 | 1, name: index ? 'THE DEALER' : 'YOU', normalizedName: index ? 'the dealer' : 'you', roleId: index ? 'enforcer' : 'broker', ready: true, connection: 'CONNECTED', hp: 5, life: 'ACTIVE', score: 0, inventory: { visible: Array(6).fill(null), pockets: [{ source: 'DEFAULT', protectedBySafe: false, item: null }], coins: 3 } }));
    let room = startMatch({ mode: 'tutorial', id: 'tutorial', code: 'LESSON', status: 'LOBBY', revision: 0, createdAt: now, updatedAt: now, hostPlayerId: HUMAN, players }, { seed: 4242, now });
    for (const player of room.players) room = applyCommand(room, player.id, { type: 'LOCK_SETUP', instanceId: player.inventory.visible[2]!.instanceId }, now);
    this.room = room;
    this.loadout(HUMAN, ['medicine', 'knife', 'key']); this.loadout(DEALER, ['antidote', 'cloth', 'pistol', 'bullet']);
    this.room.players.forEach(player => { player.inventory.coins = 5; }); this.room.players[0]!.hp = 2;
    this.room.chests!.forEach(chest => { for (const loot of chest.loot) if (loot.kind === 'ITEM' && ['brass-idol','glass-eye','red-ledger'].includes(loot.stack.itemId)) this.room.match!.artifactPool.push(loot.stack.itemId); chest.loot = [{ kind: 'COINS', amount: 1 }]; });
    this.room.sideJobsByPlayer = {}; this.freeze();
    this.metrics.push({ kind: 'started', at: now, chapter: 1 });
  }
  get chapter() { return TUTORIAL_STEPS[this.step].chapter; }
  get instruction() { return TUTORIAL_STEPS[this.step]; }
  view(): AuthorizedRoomView {
    const view = projectAuthorizedRoom(this.room, HUMAN);
    // The income lesson has its own presentation beat. Keep the engine-created
    // reveal private until prepareShop retimes it, otherwise the die begins near
    // the end of this beat and is visibly restarted when the shop lesson opens.
    if (this.step === 'income' && view.public.shop) delete view.public.shop.orderReveal;
    if (view.public.turn) view.public.turn.pausedRemainingMs = RULES.turnMs;
    if (view.public.pendingTrade) view.public.pendingTrade.deadlineAt = this.clock() + RULES.responseMs;
    if (view.public.pendingThreat) view.public.pendingThreat.deadlineAt = this.clock() + RULES.responseMs;
    return view;
  }
  look(headingDegrees: number): boolean {
    if (this.step !== 'look') return false;
    this.lookedLeft ||= headingDegrees <= -18;
    this.lookedRight ||= headingDegrees >= 18;
    if (!this.lookedLeft || !this.lookedRight) return false;
    this.enter('dealer');
    return true;
  }
  next(): void {
    switch (this.step) {
      case 'dealer': this.enter('inventory'); break;
      case 'inventory': this.enter('pocket'); break;
      case 'privacy': this.trainingTasks(); this.enter('trade'); break;
      case 'reward': this.room.round!.seatsOwedTurn = [0]; this.act(DEALER, { type: 'THREAT', mode: 'COVERED', targetId: HUMAN, committedItemId: item(this.room, DEALER, 'antidote').instanceId, clothItemId: item(this.room, DEALER, 'cloth').instanceId, demandedItems: [], demandedCoins: 2 }); this.enter('refuse'); break;
      case 'bluff': this.normalTurn(HUMAN, 1); this.give(HUMAN, 'cloth'); this.enter('practice'); break;
      case 'practiceDone': this.prepareDowned(); break;
      case 'income': this.prepareShop(); this.enter('publicShop'); break;
      case 'objective': this.advanceToHuman(3); this.room.wildcardDeck = ['seize', ...this.room.wildcardDeck!.filter(id => id !== 'seize')]; this.wildcardCheckpoint = structuredClone(this.room); this.enter('draw'); break;
      case 'burn': this.advanceToHuman(4); this.enter('exit'); break;
    }
    this.freeze();
  }
  skipPractice(): void { if (this.step === 'practice') this.prepareDowned(); }
  submit(command: GameCommand): void {
    const correct = this.expected(command);
    if (!correct) { this.retry(command.type); throw new Error(this.instruction.text); }
    if (command.type === 'BURN_WILDCARD' && this.step === 'use') {
      this.act(HUMAN, command); const burned = this.room; this.room = structuredClone(this.wildcardCheckpoint!); this.room.revision = burned.revision + 1; this.room.events = burned.events ?? []; this.room.match!.nextId = burned.match!.nextId;
      this.enter('draw'); this.retry(command.type); this.freeze(); throw new Error('The card was burned privately. The lesson is restored: draw again and choose USE to practise Seize.');
    }
    try { this.act(HUMAN, command); } catch (error) { this.retry(command.type); throw error; }
    switch (this.step) {
      case 'pocket': this.enter('privacy'); break;
      case 'trade': this.act(DEALER, { type: 'RESPOND_TRADE', accept: true }); this.enter('reward'); break;
      case 'refuse': this.enter('bluff'); break;
      case 'practice': this.act(DEALER, { type: 'RESPOND_THREAT', comply: true }); this.enter('practiceDone'); break;
      case 'downed': this.enter('income'); break;
      case 'publicShop': this.finishDealerShopping(); this.enter('blackMarket'); break;
      case 'blackMarket': this.enter('finishShopping'); break;
      case 'finishShopping':
        this.room.players[0]!.objective = { objectiveId: 'chest-raider', status: 'ACTIVE', progress: {}, rewardGranted: false };
        this.room.chests![0]!.availability = 'AVAILABLE'; this.room.chests![0]!.loot = [{ kind: 'COINS', amount: 1 }];
        this.enter('chest'); break;
      case 'chest': this.enter('objective'); break;
      case 'draw': this.enter('use'); break;
      case 'use': this.enter('seize'); break;
      case 'seize': this.enter('burn'); break;
      case 'exit': this.enter('complete'); this.metrics.push({ kind: 'chapter', at: this.clock(), chapter: 6, elapsedMs: this.clock()-this.chapterStartedAt }); this.metrics.push({ kind: 'completed', at: this.clock(), chapter: 6 }); break;
    }
    this.freeze();
  }
  /** Resume restages the last chapter through the exact same successful lesson transitions. */
  resume(chapter: number): void {
    while (this.chapter < chapter && this.step !== 'complete') this.solveCheckpoint();
    this.metrics.length = 0; this.metrics.push({ kind: 'started', at: this.clock(), chapter: this.chapter });
  }
  private solveCheckpoint(): void {
    switch (this.step) {
      case 'look': this.look(-30); this.look(30); break;
      case 'pocket': this.submit({ type: 'POCKET', instanceId: item(this.room,HUMAN,'medicine').instanceId, pocketIndex: 0 }); break;
      case 'trade': this.submit({ type: 'TRADE', targetId: DEALER, offeredItems: [item(this.room,HUMAN,'key').instanceId], requestedItems: [], offeredCoins: 0, requestedCoins: 2 }); break;
      case 'refuse': this.submit({ type: 'RESPOND_THREAT', comply: false }); break;
      case 'practice': this.skipPractice(); break;
      case 'downed': this.submit({ type: 'USE_ITEM', instanceId: item(this.room,HUMAN,'medicine').instanceId, targetId: HUMAN }); break;
      case 'publicShop': this.submit({ type: 'BUY', market: 'PUBLIC', offerId: 'training-key' }); break;
      case 'blackMarket': this.submit({ type: 'BUY', market: 'BLACK', offerId: 'training-antidote' }); break;
      case 'finishShopping': this.submit({ type: 'FINISH_SHOPPING' }); break;
      case 'chest': this.submit({ type: 'USE_ITEM', instanceId: item(this.room,HUMAN,'key').instanceId }); break;
      default: this.next();
    }
  }
  private expected(command: GameCommand): boolean {
    switch (this.step) {
      case 'pocket': return command.type === 'POCKET' && command.instanceId === item(this.room,HUMAN,'medicine')?.instanceId && command.pocketIndex === 0;
      case 'trade': return command.type === 'TRADE' && command.targetId === DEALER && command.offeredItems.length === 1 && command.offeredItems[0] === item(this.room,HUMAN,'key')?.instanceId && command.requestedItems.length === 0 && command.offeredCoins === 0 && command.requestedCoins === 2;
      case 'refuse': return command.type === 'RESPOND_THREAT' && !command.comply;
      case 'practice': return command.type === 'THREAT' && command.mode === 'COVERED' && command.targetId === DEALER && command.committedItemId === item(this.room,HUMAN,'knife')?.instanceId && command.demandedCoins === 1 && command.demandedItems.length === 0;
      case 'downed': return command.type === 'USE_ITEM' && command.instanceId === item(this.room,HUMAN,'medicine')?.instanceId && (!command.targetId || command.targetId === HUMAN);
      case 'publicShop': return command.type === 'BUY' && command.market === 'PUBLIC' && command.offerId === 'training-key';
      case 'blackMarket': return command.type === 'BUY' && command.market === 'BLACK' && command.offerId === 'training-antidote';
      case 'finishShopping': return command.type === 'FINISH_SHOPPING';
      case 'chest': return command.type === 'USE_ITEM' && command.instanceId === item(this.room,HUMAN,'key')?.instanceId;
      case 'draw': return command.type === 'DRAW_WILDCARD';
      case 'use': return command.type === 'USE_WILDCARD' || command.type === 'BURN_WILDCARD';
      case 'seize': return command.type === 'RESOLVE_WILDCARD' && command.targetId === DEALER;
      case 'exit': return command.type === 'LEAVE_TABLE';
      default: return false;
    }
  }
  private retry(action: string) { this.retries++; this.metrics.push({ kind:'retry', at:this.clock(), chapter:this.chapter, action }); }
  private enter(step: TutorialStep) { event(this.room, this.clock(), 'TUTORIAL_STEP_COMPLETED', '', HUMAN, [], { [HUMAN]: { step: this.step, chapter: this.chapter } }); const chapter = TUTORIAL_STEPS[step].chapter; if (chapter !== this.chapter) { this.metrics.push({ kind:'chapter', at:this.clock(), chapter:this.chapter, elapsedMs:this.clock()-this.chapterStartedAt }); this.chapterStartedAt=this.clock(); event(this.room, this.clock(), 'TUTORIAL_CHAPTER_STARTED', '', HUMAN, [], { [HUMAN]: { chapter } }); } this.step=step; if(step === 'complete') event(this.room, this.clock(), 'TUTORIAL_COMPLETED', 'Tutorial complete.', HUMAN); }
  private loadout(id: string, items: string[]) { const player=this.room.players.find(player=>player.id===id)!; player.inventory.visible=Array(6).fill(null); player.inventory.pockets=[{source:'DEFAULT',protectedBySafe:false,item:null}]; for(const id of items) this.give(player.id,id); }
  private give(owner: string, itemId: string) { const player=this.room.players.find(player=>player.id===owner)!; if (!item(this.room,owner,itemId)) player.inventory.visible[player.inventory.visible.findIndex(value=>!value)] = stack(this.room,itemId); }
  private act(owner: string, command: GameCommand) { this.freeze(); const now=Math.max(this.clock(),this.room.updatedAt+1); this.room=applyCommand(this.room,owner,command,now); this.freeze(); }
  private freeze() { const far=Math.max(this.clock(),this.room.updatedAt)+86_400_000; if(this.room.turn) { this.room.turn.deadlineAt=far; if(this.room.turn.immediateLoot) this.room.turn.immediateLoot.deadlineAt=far; } if(this.room.pendingThreat) this.room.pendingThreat.deadlineAt=far; if(this.room.pendingTrade) this.room.pendingTrade.deadlineAt=far; for(const overflow of this.room.overflows??[]) overflow.deadlineAt=far; if(this.room.shop) { this.room.shop.prepDeadlineAt=far; if(this.room.shop.publicDeadlineAt) this.room.shop.publicDeadlineAt=far; if(this.room.shop.privateDeadlineAt) this.room.shop.privateDeadlineAt=far; } }
  private normalTurn(owner: string, round: number) { const player=this.room.players.find(player=>player.id===owner)!; delete this.room.shop; this.room.round={number:round,phase:'TURN',seatsOwedTurn:owner===HUMAN?[1]:[0]}; player.turnsStarted=(player.turnsStarted??0)+1; this.room.turn={activeSeat:player.seat,serial:++this.room.match!.turnSerial,startedAt:this.clock(),deadlineAt:this.clock()+RULES.turnMs,primaryUsed:false,downedInteractionUsed:false,exitDeclined:false,startedDowned:false}; this.room.revision++; this.freeze(); }
  private trainingTasks() { assignTasks(this.room,this.room.updatedAt); this.room.sideJobsByPlayer![HUMAN]={round:this.room.round!.number,reward:2,completed:false,replacementUsed:false,opportunityTaken:false,jobs:[{id:'trade',status:'ACTIVE',progress:0,prerequisites:[]},{id:'damage',status:'ACTIVE',progress:0,prerequisites:[]}]}; }
  private prepareDowned() { this.normalTurn(DEALER,1); this.room.players[0]!.hp=2; this.act(DEALER,{type:'USE_ITEM',instanceId:item(this.room,DEALER,'pistol').instanceId,targetId:HUMAN}); if(this.room.turn?.immediateLoot) this.act(DEALER,{type:'SKIP_LOOT'}); this.enter('downed'); this.freeze(); }
  private prepareShop() { const shop=this.room.shop!; shop.order=[HUMAN,DEALER]; shop.activeShopperIndex=0; shop.publicOffers=[{id:'training-key',itemId:'key',price:2}]; shop.privateOffers[HUMAN]=[{id:'training-antidote',itemId:'antidote',price:3}]; const now=Math.max(this.clock(),this.room.updatedAt+1); shop.prepDeadlineAt=now; if(shop.orderReveal) shop.orderReveal.startedAt=now; this.room=applyTimeout(this.room,now); this.freeze(); }
  private finishDealerShopping() { const shop=this.room.shop; if(!shop) return; if(shop.phase==='PUBLIC'&&shop.order[shop.activeShopperIndex]===DEALER) this.act(DEALER,{type:'SKIP_PUBLIC_SHOP'}); if(this.room.shop?.privateUnlockedBy[DEALER]&&!this.room.shop.finishedBy[DEALER]) this.act(DEALER,{type:'FINISH_SHOPPING'}); }
  private advanceToHuman(round: number) { for(let attempt=0;attempt<40;attempt++) { if(this.room.round!.number>=round&&this.room.turn?.activeSeat===0) return; if(this.room.round!.phase==='TURN') this.act(this.room.players.find(player=>player.seat===this.room.turn!.activeSeat)!.id,{type:'PASS_TURN'}); else { const shop=this.room.shop!; if(shop.phase==='PREP') { const now=Math.max(this.clock(),this.room.updatedAt+1); shop.prepDeadlineAt=now; this.room=applyTimeout(this.room,now); } else if(shop.phase==='PUBLIC') this.act(shop.order[shop.activeShopperIndex]!,{type:'SKIP_PUBLIC_SHOP'}); else this.act(shop.order.find(id=>!shop.finishedBy[id])!,{type:'FINISH_SHOPPING'}); } } throw new Error('Tutorial checkpoint could not reach the next turn.'); }
}
