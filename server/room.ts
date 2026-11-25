import type { WebSocket } from 'ws';
import {
  MAX_ITEMS, MAX_LEVEL, POOL_SIZE, REROLL_COST, SHOP_ODDS, SHOP_SIZE, SHOP_UNITS, START_HP, TRAITS, UNITS,
  XP_COST, XP_PER_BUY, XP_TO_LEVEL, isArmoryRound, isAugmentRound, isCarouselRound, isPveRound, sellValue,
  stageDamage, stageLabel, stageOf, survivorDamage,
} from '../shared/data';
import { AUGMENTS, augmentPool, traitBonus } from '../shared/augments';
import { computeTraits, emblemBonus, mergeBonus } from '../shared/traits';
import { COMPLETED, COMPONENTS, EMBLEMS, ITEMS, SPECIALS, boardCap, combine, emblemAllowed, isComponent, isEmblem, isSpecial, itemSlots } from '../shared/items';
import { BENCH_SIZE, BOARD_ROWS, COLS } from '../shared/hex';
import type { AugTier, CarouselUnit, Choice, ClientMsg, CombatResult, Loc, OwnedUnit, Phase, PublicPlayer, ServerMsg } from '../shared/types';
import { simulate, type SideInput } from './combat';
import { PORTALS, PORTAL_IDS, interestCap, rerollCost } from '../shared/portals';
import { botChoose, botPlan } from './bot';

const MAX_PLAYERS = 8;
const EMOTE_COUNT = 8;
const PLANNING_MS = 30000;
const FIRST_PLANNING_MS = 20000;
const CHOICE_EXTRA_MS = 10000;
const COMBAT_PAD_MS = 2500;
const ITEM_BENCH_MAX = 12;
// carrossel (coordenadas do mundo 3D do cliente)
const CAROUSEL_N = 9;
const CAROUSEL_R = 3.0;
const CAROUSEL_SPIN = 0.32; // rad/s
const CAROUSEL_TICK = 100;
const AV_R = 5.0;
const AV_SPEED = 4.6;
const PICK_R = 0.85;
const BOT_NAMES = [
  'Robozão do Pântano', 'Ciborgue Lerdo', 'MC Engrenagem', 'Dona Fumacinha', 'Seu Parafuso',
  'Androide Zen', 'Capitão Larica', 'Mecha Tranquilão', 'Tia do Brownie', 'Neurônio Solto',
];

let unitCounter = 1;
const newUnitId = () => `u${unitCounter++}`;
const pick = <T>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
const randomComponent = () => pick(COMPONENTS);
const randomCompleted = () => pick(COMPLETED.filter((i) => i !== 'maoleve'));
const randomSpecial = () => pick(SPECIALS);
const randomEmblem = () => pick(EMBLEMS);

export class Player {
  ws: WebSocket | null = null;
  hp = START_HP;
  gold = 0;
  level = 1;
  xp = 0;
  shop: (string | null)[] = [];
  units: OwnedUnit[] = [];
  itemBench: string[] = [];
  augments: string[] = [];
  choice: Choice | null = null;
  freeRerolls = 0;
  locked = false;
  streak = 0;
  alive = true;
  place = 0;
  ready = false;
  lastChatAt = 0;
  lastEmoteAt = 0;
  lastOpp: string | null = null;
  avatar = '';
  opponentId: string | null = null;

  constructor(public id: string, public token: string, public name: string, public isBot: boolean) {}

  get connected() { return this.isBot || (this.ws !== null && this.ws.readyState === 1); }
  boardUnits() { return this.units.filter((u) => u.loc.zone === 'board'); }
  benchUnits() { return this.units.filter((u) => u.loc.zone === 'bench'); }
  xpNeeded() { return this.level >= MAX_LEVEL ? 0 : XP_TO_LEVEL[this.level]; }
  hasAug(id: string) { return this.augments.includes(id); }
  cap() { return boardCap(this.level, this.units, this.augments); }
  freeBenchSlot(): number {
    const used = new Set(this.benchUnits().map((u) => (u.loc as { i: number }).i));
    for (let i = 0; i < BENCH_SIZE; i++) if (!used.has(i)) return i;
    return -1;
  }
  unitAt(loc: Loc): OwnedUnit | undefined {
    return this.units.find((u) =>
      loc.zone === 'board'
        ? u.loc.zone === 'board' && u.loc.r === loc.r && u.loc.c === loc.c
        : u.loc.zone === 'bench' && u.loc.i === loc.i,
    );
  }
  addXp(n: number) {
    if (this.level >= MAX_LEVEL) return;
    this.xp += n;
    while (this.level < MAX_LEVEL && this.xp >= XP_TO_LEVEL[this.level]) {
      this.xp -= XP_TO_LEVEL[this.level];
      this.level++;
    }
    if (this.level >= MAX_LEVEL) this.xp = 0;
  }
  giveItems(ids: string[]) {
    for (const id of ids) if (this.itemBench.length < ITEM_BENCH_MAX) this.itemBench.push(id);
  }
  send(msg: ServerMsg) {
    if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(msg));
  }
}

export class Room {
  players: Player[] = [];
  hostId = '';
  phase: Phase = 'lobby';
  round = 0;
  endsAt = 0;
  phaseTotal = 0;
  timer: NodeJS.Timeout | null = null;
  pool: Record<string, number> = {};
  pendingCombats: { a: Player; b: Player | null; ghost: boolean; result: CombatResult; pve: boolean; home?: 0 | 1 }[] = [];
  lastActivity = Date.now();
  combatStartedAt = 0;
  augTiers: AugTier[] = [];
  /** regra especial da partida (votada no começo) */
  portal: string | null = null;
  portalVote: { options: string[]; votes: Map<string, number>; end: number } | null = null;
  private playerCounter = 1;

  /** Reenvia o combate em andamento para quem reconectou no meio dele. */
  resendCombat(p: Player) {
    if (this.phase !== 'combat') return;
    const elapsed = Date.now() - this.combatStartedAt;
    for (const c of this.pendingCombats) {
      if (c.a === p) {
        const name = c.pve ? 'Drones da Patrulha' : c.ghost ? `${c.b!.name} (fantasma)` : c.b!.name;
        p.send({ t: 'combat', round: this.round, mySide: 0, opponentName: name, opponentId: c.b?.id, pve: c.pve, result: c.result, elapsed, home: c.home ?? 0, dmg: this.combatDamage(c.result, c.pve) });
        return;
      }
      if (c.b === p && !c.ghost && !c.pve) {
        p.send({ t: 'combat', round: this.round, mySide: 1, opponentName: c.a.name, opponentId: c.a.id, pve: false, result: c.result, elapsed, home: c.home ?? 0, dmg: this.combatDamage(c.result, false) });
        return;
      }
    }
  }

  constructor(public code: string, private onEmpty: (code: string) => void) {}

  // ================= conexão / lobby =================

  join(ws: WebSocket, name: string, token: string): Player | string {
    this.lastActivity = Date.now();
    const existing = this.players.find((p) => p.token === token && !p.isBot);
    if (existing) {
      existing.ws = ws;
      if (name) existing.name = name;
      return existing;
    }
    if (this.phase !== 'lobby') return 'A partida já começou nessa sala.';
    if (this.players.length >= MAX_PLAYERS) return 'Sala cheia (máx. 8).';
    const p = new Player(`p${this.playerCounter++}`, token, name || 'Robô Anônimo', false);
    p.ws = ws;
    this.players.push(p);
    if (!this.hostId || !this.players.find((x) => x.id === this.hostId && !x.isBot)) this.hostId = p.id;
    return p;
  }

  disconnect(p: Player) {
    p.ws = null;
    if (this.phase === 'lobby') {
      // dá um tempinho pra quem só recarregou a página voltar sem perder a vaga (nem o posto de anfitrião)
      this.broadcastLobby();
      setTimeout(() => {
        if (this.phase !== 'lobby' || p.connected || !this.players.includes(p)) return;
        this.players = this.players.filter((x) => x !== p);
        this.reassignHost();
        this.broadcastLobby();
      }, 20000);
    } else {
      this.broadcastState();
    }
    if (!this.players.some((x) => !x.isBot && x.connected)) {
      setTimeout(() => {
        if (!this.players.some((x) => !x.isBot && x.connected)) this.destroy();
      }, 5 * 60 * 1000);
    }
  }

  destroy() {
    if (this.timer) clearTimeout(this.timer);
    if (this.carouselTick) clearInterval(this.carouselTick);
    this.phase = 'lobby';
    this.onEmpty(this.code);
  }

  reassignHost() {
    if (this.players.find((x) => x.id === this.hostId && !x.isBot)) return;
    this.hostId = this.players.find((x) => !x.isBot)?.id ?? '';
  }

  broadcastLobby() {
    const msg: ServerMsg = {
      t: 'lobby', room: this.code, hostId: this.hostId,
      players: this.players.map((p) => ({ id: p.id, name: p.name, isBot: p.isBot, connected: p.connected, avatar: p.avatar })),
    };
    for (const p of this.players) p.send(msg);
  }

  toast(p: Player, msg: string, kind: 'info' | 'good' | 'bad' = 'bad') {
    p.send({ t: 'toast', msg, kind });
  }

  // ================= mensagens =================

  handle(p: Player, msg: ClientMsg) {
    this.lastActivity = Date.now();
    const isHost = p.id === this.hostId;
    switch (msg.t) {
      case 'addBot':
        if (!isHost || this.phase !== 'lobby' || this.players.length >= MAX_PLAYERS) return;
        {
          const used = new Set(this.players.map((x) => x.name));
          const free = BOT_NAMES.filter((n) => !used.has(`🤖 ${n}`));
          const name = free[Math.floor(Math.random() * free.length)] ?? `Bot ${this.playerCounter}`;
          const bot = new Player(`p${this.playerCounter++}`, '', `🤖 ${name}`, true);
          bot.avatar = `${pick(['nuvem', 'cogumelo', 'robozinho', 'geleca'])}:${Math.floor(Math.random() * 8)}`;
          this.players.push(bot);
        }
        this.broadcastLobby();
        return;
      case 'kick':
        if (!isHost || this.phase !== 'lobby' || msg.id === p.id) return;
        {
          const k = this.players.find((x) => x.id === msg.id);
          if (k) {
            k.send({ t: 'error', msg: 'Você foi removido da sala.' });
            k.ws?.close();
            this.players = this.players.filter((x) => x !== k);
          }
        }
        this.broadcastLobby();
        return;
      case 'start':
        if (!isHost || this.phase !== 'lobby') return;
        if (this.players.length < 2) return this.toast(p, 'Precisa de pelo menos 2 jogadores (adicione bots!).');
        this.startGame();
        return;
      case 'restart':
        if (!isHost || this.phase !== 'gameover') return;
        this.phase = 'lobby';
        this.players = this.players.filter((x) => x.isBot || x.connected);
        this.reassignHost();
        this.broadcastLobby();
        return;
      case 'chat': {
        const text = String(msg.msg ?? '').slice(0, 200).trim();
        if (!text) return;
        const now = Date.now();
        if (now - p.lastChatAt < 700) return this.toast(p, 'Calma, parceiro. Uma mensagem de cada vez.');
        p.lastChatAt = now;
        for (const x of this.players) x.send({ t: 'chat', from: p.name, msg: text });
        return;
      }
      case 'emote': {
        const e = Math.floor(Number(msg.e));
        const now = Date.now();
        if (!(e >= 0 && e < EMOTE_COUNT) || now - p.lastEmoteAt < 1200) return;
        p.lastEmoteAt = now;
        for (const x of this.players) x.send({ t: 'emote', from: p.id, e });
        return;
      }
    }
    if (msg.t === 'vote') { this.vote(p, Number(msg.i)); return; }
    if (msg.t === 'avatar') {
      const look = String(msg.look ?? '');
      if (!/^[a-z]{3,12}:\d$/.test(look) || look === p.avatar) return;
      p.avatar = look;
      if (this.phase === 'lobby') this.broadcastLobby(); else this.broadcastState();
      return;
    }
    if (msg.t === 'walk') { if (this.phase === 'carousel' && p.alive) this.walk(p, Number(msg.x), Number(msg.z)); return; }
    if (this.phase !== 'planning' && this.phase !== 'combat') return;
    if (!p.alive) return;
    let ok = true;
    switch (msg.t) {
      case 'buy': ok = this.buy(p, msg.i); break;
      case 'sell': ok = this.sell(p, msg.id); break;
      case 'move': ok = this.move(p, msg.id, msg.to); break;
      case 'equip': ok = this.equip(p, msg.item, msg.unitId); break;
      case 'choose': ok = this.choose(p, msg.i); break;
      case 'rerollChoice': ok = this.rerollChoice(p, msg.i); break;
      case 'reroll': ok = this.reroll(p); break;
      case 'xp': ok = this.buyXp(p); break;
      case 'lock': p.locked = !p.locked; break;
      case 'ready':
        if (this.phase !== 'planning') return;
        p.ready = !p.ready;
        if (this.players.every((x) => x.isBot || !x.alive || !x.connected || x.ready)) {
          this.startCombat();
          return;
        }
        break;
      default: return;
    }
    if (ok) this.sendState(p);
    if (msg.t === 'move' || msg.t === 'sell' || msg.t === 'buy' || msg.t === 'equip' || msg.t === 'choose') this.broadcastState(p);
  }

  // ================= ações do jogador =================

  takeFromPool(defId: string) { this.pool[defId] = Math.max(0, (this.pool[defId] ?? 0) - 1); }
  returnToPool(defId: string, n = 1) { this.pool[defId] = (this.pool[defId] ?? 0) + n; }

  rollShop(p: Player) {
    for (const id of p.shop) if (id) this.returnToPool(id);
    p.shop = [];
    const odds = SHOP_ODDS[p.level];
    for (let i = 0; i < SHOP_SIZE; i++) {
      let roll = Math.random() * 100;
      let cost = 1;
      for (let c = 0; c < 5; c++) {
        if (roll < odds[c]) { cost = c + 1; break; }
        roll -= odds[c];
      }
      let picked: string | null = null;
      for (let cc = cost; cc >= 1 && !picked; cc--) {
        const cands = SHOP_UNITS.filter((d) => d.cost === cc && (this.pool[d.id] ?? 0) > 0);
        const total = cands.reduce((s, d) => s + this.pool[d.id], 0);
        if (!total) continue;
        let x = Math.random() * total;
        for (const d of cands) {
          x -= this.pool[d.id];
          if (x < 0) { picked = d.id; break; }
        }
      }
      if (picked) this.takeFromPool(picked);
      p.shop.push(picked);
    }
  }

  canMergeOnBuy(p: Player, defId: string) {
    const eligible = p.units.filter((u) => u.defId === defId && u.star === 1 &&
      (this.phase === 'planning' || u.loc.zone === 'bench'));
    return eligible.length >= 2;
  }

  buy(p: Player, i: number): boolean {
    const defId = p.shop[i];
    if (!defId) return false;
    const def = UNITS[defId];
    if (p.gold < def.cost) { this.toast(p, 'Grana insuficiente, parceiro.'); return false; }
    const slot = p.freeBenchSlot();
    if (slot < 0 && !this.canMergeOnBuy(p, defId)) { this.toast(p, 'Banco lotado!'); return false; }
    p.gold -= def.cost;
    p.shop[i] = null;
    p.units.push({ id: newUnitId(), defId, star: 1, items: [], loc: slot >= 0 ? { zone: 'bench', i: slot } : { zone: 'bench', i: -1 } });
    this.tryMerge(p);
    return true;
  }

  tryMerge(p: Player) {
    let merged = true;
    while (merged) {
      merged = false;
      const groups = new Map<string, OwnedUnit[]>();
      for (const u of p.units) {
        if (u.star >= 3) continue;
        if (this.phase === 'combat' && u.loc.zone === 'board') continue;
        const k = `${u.defId}:${u.star}`;
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k)!.push(u);
      }
      for (const list of groups.values()) {
        if (list.length < 3) continue;
        const three = list.slice(0, 3);
        const keeper = three.find((u) => u.loc.zone === 'board') ??
          three.find((u) => u.items.length > 0) ??
          three.find((u) => u.loc.zone === 'bench' && u.loc.i >= 0) ?? three[0];
        const others = three.filter((u) => u !== keeper);
        // itens dos outros vão para o que fica (o que não couber volta para o banco de itens)
        for (const o of others) {
          for (const it of o.items) {
            if (itemSlots([...keeper.items, it]) <= MAX_ITEMS) keeper.items.push(it);
            else p.giveItems([it]);
          }
        }
        p.units = p.units.filter((u) => !others.includes(u));
        keeper.star++;
        if (keeper.loc.zone === 'bench' && keeper.loc.i < 0) {
          const s = p.freeBenchSlot();
          keeper.loc = { zone: 'bench', i: s };
        }
        if (keeper.star === 3) this.toast(p, `⭐⭐⭐ ${UNITS[keeper.defId].name} chegou no nível máximo da brisa!`, 'good');
        merged = true;
        break;
      }
    }
    for (const u of [...p.units]) {
      if (u.loc.zone === 'bench' && u.loc.i < 0) {
        const s = p.freeBenchSlot();
        if (s >= 0) u.loc = { zone: 'bench', i: s };
        else {
          p.units = p.units.filter((x) => x !== u);
          p.gold += UNITS[u.defId].cost;
          p.giveItems(u.items);
          this.returnToPool(u.defId);
        }
      }
    }
  }

  sell(p: Player, id: string): boolean {
    const u = p.units.find((x) => x.id === id);
    if (!u) return false;
    if (this.phase === 'combat' && u.loc.zone === 'board') { this.toast(p, 'Não dá pra vender quem está lutando.'); return false; }
    const def = UNITS[u.defId];
    p.gold += sellValue(def.cost, u.star) + (p.hasAug('reciclagem') ? 1 : 0);
    this.returnToPool(u.defId, Math.pow(3, u.star - 1));
    p.giveItems(u.items);
    p.units = p.units.filter((x) => x !== u);
    return true;
  }

  move(p: Player, id: string, to: Loc): boolean {
    const u = p.units.find((x) => x.id === id);
    if (!u) return false;
    if (to.zone === 'board') {
      if (!(to.r >= 0 && to.r < BOARD_ROWS && to.c >= 0 && to.c < COLS)) return false;
    } else if (!(to.i >= 0 && to.i < BENCH_SIZE)) return false;
    if (this.phase === 'combat' && (to.zone === 'board' || u.loc.zone === 'board')) {
      this.toast(p, 'Espera o combate acabar pra mexer no tabuleiro.');
      return false;
    }
    const other = p.unitAt(to);
    if (other === u) return false;
    if (other) {
      const tmp = u.loc;
      u.loc = to;
      other.loc = tmp;
      return true;
    }
    if (to.zone === 'board' && u.loc.zone === 'bench' && p.boardUnits().length >= p.cap()) {
      this.toast(p, `Limite de ${p.cap()} robôs no tabuleiro. Suba de nível!`);
      return false;
    }
    u.loc = to;
    return true;
  }

  /** Equipa um item do banco de itens numa unidade (combina componentes automaticamente). */
  equip(p: Player, index: number, unitId: string): boolean {
    const item = p.itemBench[index];
    const u = p.units.find((x) => x.id === unitId);
    if (!item || !u) return false;
    if (this.phase === 'combat' && u.loc.zone === 'board') { this.toast(p, 'Espera o combate acabar pra equipar quem está lutando.'); return false; }
    if (isSpecial(item)) return this.useSpecial(p, index, u);
    if (u.items.includes('maoleve')) { this.toast(p, 'A Mão Leve já ocupa todos os espaços.'); return false; }
    const traitsOf = UNITS[u.defId].traits;
    if (isEmblem(item) && !emblemAllowed(traitsOf, u.items, item)) { this.toast(p, `${UNITS[u.defId].name} já tem essa sinergia.`); return false; }
    if (item === 'chapeucuca' && u.items.includes('chapeucuca')) { this.toast(p, 'Um chapéu por robô, chef.'); return false; }
    if (isComponent(item)) {
      const ci = u.items.findIndex((x) => isComponent(x));
      if (ci >= 0) {
        const made = combine(u.items[ci], item)!;
        if (made === 'maoleve' && u.items.length > 1) { this.toast(p, 'A Mão Leve precisa de um robô sem outros itens.'); return false; }
        if (isEmblem(made) && !emblemAllowed(traitsOf, u.items.filter((_, k) => k !== ci), made)) { this.toast(p, `Isso viraria ${ITEMS[made].name}, mas ${UNITS[u.defId].name} já tem essa sinergia.`); return false; }
        if (made === 'chapeucuca' && u.items.includes('chapeucuca')) { this.toast(p, 'Um chapéu por robô, chef.'); return false; }
        u.items[ci] = made;
        p.itemBench.splice(index, 1);
        this.toast(p, `${ITEMS[made].icon} ${ITEMS[made].name} montado!`, 'good');
        return true;
      }
    }
    if (itemSlots([...u.items, item]) > MAX_ITEMS) { this.toast(p, 'Esse robô já está com os 3 espaços cheios.'); return false; }
    u.items.push(item);
    p.itemBench.splice(index, 1);
    return true;
  }

  /** Itens especiais: Pé de Cabra, Reforjador e Xerox. */
  useSpecial(p: Player, index: number, u: OwnedUnit): boolean {
    const item = p.itemBench[index];
    const name = UNITS[u.defId].name;
    if (item === 'pedecabra' || item === 'reforjador') {
      if (!u.items.length) { this.toast(p, ` não tem itens.`); return false; }
    }
    if (item === 'pedecabra') {
      if (p.itemBench.length - 1 + u.items.length > ITEM_BENCH_MAX) { this.toast(p, 'Banco de itens lotado.'); return false; }
      p.itemBench.splice(index, 1);
      const back = u.items;
      u.items = [];
      p.giveItems(back);
      this.toast(p, `🔧 Itens de ${name} de volta pro banco.`, 'good');
      return true;
    }
    if (item === 'reforjador') {
      p.itemBench.splice(index, 1);
      u.items = u.items.map((it) => {
        if (it === 'chapeucuca') return it;
        if (isEmblem(it)) return pick(EMBLEMS.filter((e) => e !== it && emblemAllowed(UNITS[u.defId].traits, [], e)));
        if (isComponent(it)) return pick(COMPONENTS.filter((c) => c !== it));
        return pick(COMPLETED.filter((c) => c !== it && c !== 'maoleve'));
      });
      this.toast(p, `🔨 Reforjado: ${u.items.map((i) => ITEMS[i].icon + ' ' + ITEMS[i].name).join(', ')}`, 'good');
      return true;
    }
    if (item === 'xerox') {
      const def = UNITS[u.defId];
      if (def.cost > 4) { this.toast(p, 'O Xerox não dá conta de robô lendário (custo 5).'); return false; }
      if ((this.pool[u.defId] ?? 0) <= 0) { this.toast(p, `Acabaram as cópias de ${name}.`); return false; }
      const slot = p.freeBenchSlot();
      if (slot < 0) { this.toast(p, 'Banco lotado!'); return false; }
      p.itemBench.splice(index, 1);
      this.takeFromPool(u.defId);
      p.units.push({ id: newUnitId(), defId: u.defId, star: 1, items: [], loc: { zone: 'bench', i: slot } });
      this.toast(p, `📠 Cópia de ${name} saindo do forno!`, 'good');
      this.tryMerge(p);
      return true;
    }
    return false;
  }

  choose(p: Player, i: number): boolean {
    const ch = p.choice;
    if (!ch) return false;
    const opt = ch.options[Math.max(0, Math.min(ch.options.length - 1, i | 0))];
    p.choice = null;
    if (ch.kind === 'armory') {
      p.giveItems([opt]);
      return true;
    }
    p.augments.push(opt);
    switch (opt) {
      case 'heranca': p.gold += 12; break;
      case 'feira': p.giveItems([randomComponent(), randomComponent()]); break;
      case 'nivelja': p.addXp(10); break;
      case 'itempronto': p.giveItems([randomCompleted()]); break;
      case 'fortuna': p.gold += 30; break;
      case 'caixamist': p.giveItems([randomCompleted(), randomCompleted(), randomCompleted()]); break;
      case 'ascensao': p.addXp(20); p.gold += 10; break;
      case 'rolagratis': p.freeRerolls += 1; break;
      case 'kitbasico': p.giveItems([randomComponent()]); p.gold += 4; break;
      case 'colherada': p.giveItems(['colher', randomComponent()]); break;
      case 'colherdourada': p.giveItems(['colher', 'colher']); break;
      case 'presente': {
        const opts = SHOP_UNITS.filter((d) => d.cost === 5 && (this.pool[d.id] ?? 0) > 0);
        const d = opts[Math.floor(Math.random() * opts.length)];
        const slot = p.freeBenchSlot();
        if (d && slot >= 0) {
          this.pool[d.id]--;
          p.units.push({ id: newUnitId(), defId: d.id, star: 1, items: [], loc: { zone: 'bench', i: slot } });
          this.tryMerge(p);
        } else p.gold += 10;
        break;
      }
    }
    this.toast(p, `${AUGMENTS[opt].icon} Aprimoramento: ${AUGMENTS[opt].name}`, 'good');
    return true;
  }

  reroll(p: Player): boolean {
    if (p.freeRerolls > 0) {
      p.freeRerolls--;
    } else {
      const cost = rerollCost(this.portal);
      if (p.gold < cost) { this.toast(p, 'Sem grana pra rolar.'); return false; }
      p.gold -= cost;
    }
    this.rollShop(p);
    return true;
  }

  buyXp(p: Player): boolean {
    if (p.level >= MAX_LEVEL) return false;
    if (p.gold < XP_COST) { this.toast(p, 'Sem grana pra XP.'); return false; }
    p.gold -= XP_COST;
    p.addXp(XP_PER_BUY + (this.portal === 'pilotagem' ? 2 : 0));
    return true;
  }

  // ================= escolhas (aprimoramentos e arsenal) =================

  makeAugmentChoice(p: Player, tier: AugTier): Choice {
    const myTraits = new Set(p.units.flatMap((u) => UNITS[u.defId].traits));
    const pool = augmentPool(tier).filter((g) => !p.augments.includes(g.id) && (!g.trait || myTraits.has(g.trait)));
    // no máximo 1 coração/coroa entre as opções
    const generic = pool.filter((g) => !g.trait).sort(() => Math.random() - 0.5);
    const hearts = pool.filter((g) => g.trait).sort(() => Math.random() - 0.5);
    const opts = [...generic.slice(0, 2), ...(hearts.length ? [hearts[0]] : generic.slice(2, 3))];
    while (opts.length < 3 && generic.length > opts.length) opts.push(generic[opts.length]);
    const tierName = tier === 'prata' ? 'Prata' : tier === 'ouro' ? 'Ouro' : 'Prisma';
    const options = opts.sort(() => Math.random() - 0.5).map((g) => g.id);
    return { kind: 'augment', title: `Escolha um aprimoramento (${tierName})`, options, rerolled: options.map(() => false), tier };
  }

  /** Troca uma opção de aprimoramento por outra do mesmo tier (1 vez por opção). */
  rerollChoice(p: Player, i: number): boolean {
    const ch = p.choice;
    if (!ch || ch.kind !== 'augment' || !ch.tier) return false;
    i = Math.max(0, Math.min(ch.options.length - 1, i | 0));
    const rr = ch.rerolled ?? ch.options.map(() => false);
    if (rr[i]) return false;
    const old = AUGMENTS[ch.options[i]];
    const myTraits = new Set(p.units.flatMap((u) => UNITS[u.defId].traits));
    const pool = augmentPool(ch.tier).filter((g) => !p.augments.includes(g.id) && !ch.options.includes(g.id) && (!g.trait || myTraits.has(g.trait)));
    // mantém o "tipo" da opção (genérico ↔ sinergia) quando dá
    const same = pool.filter((g) => !!g.trait === !!old?.trait);
    const from = same.length ? same : pool;
    if (!from.length) { this.toast(p, 'Nenhum outro aprimoramento disponível.'); return false; }
    ch.options[i] = from[Math.floor(Math.random() * from.length)].id;
    rr[i] = true;
    ch.rerolled = rr;
    return true;
  }

  makeArmoryChoice(): Choice {
    const stage = stageOf(this.round).stage;
    if (stage <= 3) {
      const opts = [...COMPONENTS].sort(() => Math.random() - 0.5).slice(0, 3);
      if (stage >= 2 && Math.random() < 0.15) opts[2] = 'colher';
      return { kind: 'armory', title: 'Arsenal: escolha um componente', options: opts };
    }
    const opts = COMPLETED.filter((i) => i !== 'maoleve').sort(() => Math.random() - 0.5).slice(0, 3);
    if (Math.random() < 0.35) opts[2] = randomSpecial();
    else if (Math.random() < 0.2) opts[2] = randomEmblem();
    return { kind: 'armory', title: 'Arsenal: escolha um item completo', options: opts };
  }

  // ================= fluxo do jogo =================

  startGame() {
    this.pool = {};
    for (const d of SHOP_UNITS) this.pool[d.id] = POOL_SIZE[d.cost];
    this.players = this.players.filter((p) => p.isBot || p.connected);
    // tiers dos aprimoramentos da partida (iguais para todos, como no TFT)
    const tiers: AugTier[] = ['prata', 'ouro', 'prisma'];
    const roll = () => {
      const x = Math.random();
      return x < 0.4 ? tiers[0] : x < 0.85 ? tiers[1] : tiers[2];
    };
    this.augTiers = [roll(), roll(), roll()];
    for (const p of this.players) {
      Object.assign(p, {
        hp: START_HP, gold: 0, level: 1, xp: 0, shop: [], units: [], locked: false,
        itemBench: [], augments: [], choice: null, freeRerolls: 0,
        streak: 0, alive: true, place: 0, ready: false, lastOpp: null, opponentId: null,
      });
    }
    this.round = 0;
    this.portal = null;
    this.startPortalVote();
  }

  // ================= portal (regra da partida) =================

  startPortalVote() {
    const options = [...PORTAL_IDS].sort(() => Math.random() - 0.5).slice(0, 3);
    const dur = 15000;
    this.portalVote = { options, votes: new Map(), end: Date.now() + dur };
    this.phase = 'portal';
    this.endsAt = Date.now() + dur;
    this.phaseTotal = dur;
    this.setTimer(dur, () => this.finishPortal());
    this.broadcastState();
    this.broadcastPortal();
    // bots votam com um pouquinho de atraso
    for (const p of this.players) {
      if (!p.isBot) continue;
      setTimeout(() => this.vote(p, Math.floor(Math.random() * options.length)), 1500 + Math.random() * 6000);
    }
  }

  broadcastPortal(chosen: string | null = null) {
    const v = this.portalVote;
    if (!v) return;
    const msg: ServerMsg = { t: 'portal', options: v.options, votes: Object.fromEntries(v.votes), endsIn: Math.max(0, v.end - Date.now()), chosen };
    for (const p of this.players) p.send(msg);
  }

  vote(p: Player, i: number) {
    const v = this.portalVote;
    if (!v || this.phase !== 'portal' || !(i >= 0 && i < v.options.length)) return;
    v.votes.set(p.id, Math.floor(i));
    this.broadcastPortal();
    if (v.end > Date.now() + 1600 && this.players.every((x) => v.votes.has(x.id) || (!x.isBot && !x.connected))) {
      v.end = Date.now() + 1500;
      this.endsAt = v.end;
      this.setTimer(1500, () => this.finishPortal());
      this.broadcastState();
    }
  }

  /** Apura os votos (empate: sorteio) e começa o carrossel inicial. */
  finishPortal(immediate = false) {
    const v = this.portalVote;
    if (!v || this.phase !== 'portal') return;
    const count = v.options.map((_, i) => [...v.votes.values()].filter((x) => x === i).length);
    const top = Math.max(...count);
    const best = v.options.filter((_, i) => count[i] === top);
    this.portal = best[Math.floor(Math.random() * best.length)];
    const def = PORTALS[this.portal];
    for (const p of this.players) {
      if (this.portal === 'kit') p.giveItems([randomComponent(), randomComponent()]);
      if (this.portal === 'colheres') p.giveItems(['colher']);
      this.toast(p, `${def.icon} Portal da partida: ${def.name} — ${def.desc}`, 'good');
    }
    this.broadcastPortal(this.portal);
    this.portalVote = null;
    if (immediate) this.startCarousel(true);
    else {
      this.endsAt = Date.now() + 2500;
      this.phaseTotal = 2500;
      this.broadcastState();
      this.setTimer(2500, () => this.startCarousel(true));
    }
  }

  isPve(round: number) { return isPveRound(round); }

  alive() { return this.players.filter((p) => p.alive); }

  // ================= carrossel =================

  carousel: {
    units: CarouselUnit[];
    angle: number;
    avatars: Map<string, { x: number; z: number; tx: number; tz: number; picked: number }>;
    unlockAt: Map<string, number>;
    end: number;
    botPick: Map<string, number>;
  } | null = null;
  carouselTick: ReturnType<typeof setInterval> | null = null;

  /** Próxima etapa depois do combate: carrossel (se for a hora) ou planejamento. */
  nextRound() {
    if (isCarouselRound(this.round + 1, this.portal)) this.startCarousel(false);
    else this.startPlanning();
  }

  startCarousel(initial: boolean) {
    const { stage } = stageOf(this.round + 1);
    const costs = initial ? [1] : stage <= 2 ? [1, 2, 2, 3] : stage === 3 ? [2, 3, 3, 4] : stage === 4 ? [3, 3, 4, 4, 5] : [3, 4, 4, 5, 5];
    const units: CarouselUnit[] = [];
    const used = new Set<string>();
    for (let i = 0; i < CAROUSEL_N; i++) {
      const cost = costs[i % costs.length];
      const opts = SHOP_UNITS.filter((d) => d.cost === cost && (this.pool[d.id] ?? 0) > 0 && !used.has(d.id));
      const def = opts.length ? pick(opts) : pick(SHOP_UNITS.filter((d) => d.cost === cost));
      used.add(def.id);
      this.takeFromPool(def.id);
      const item = initial ? randomComponent()
        : stage <= 3 ? (Math.random() < 0.08 ? 'colher' : randomComponent())
        : Math.random() < 0.12 ? randomSpecial() : Math.random() < 0.1 ? randomEmblem() : randomCompleted();
      units.push({ defId: def.id, item, taken: null });
    }
    const now = Date.now();
    const alive = this.alive();
    const avatars = new Map<string, { x: number; z: number; tx: number; tz: number; picked: number }>();
    alive.forEach((p, i) => {
      const a = (i / Math.max(1, alive.length)) * Math.PI * 2 + Math.PI / 8;
      const x = Math.cos(a) * AV_R * 1.12, z = Math.sin(a) * AV_R * 0.92;
      avatars.set(p.id, { x, z, tx: x, tz: z, picked: -1 });
    });
    // quem está pior escolhe primeiro (de 2 em 2), igual TFT
    const unlockAt = new Map<string, number>();
    let end: number;
    if (initial) {
      for (const p of alive) unlockAt.set(p.id, now + 2500);
      end = now + 13000;
    } else {
      const order = [...alive].sort((a, b) => a.hp - b.hp || Math.random() - 0.5);
      order.forEach((p, i) => unlockAt.set(p.id, now + 3000 + Math.floor(i / 2) * 3500));
      end = now + 3000 + Math.ceil(order.length / 2) * 3500 + 2500;
    }
    this.carousel = { units, angle: Math.random() * Math.PI * 2, avatars, unlockAt, end, botPick: new Map() };
    this.phase = 'carousel';
    this.endsAt = end;
    this.phaseTotal = end - now;
    if (this.timer) clearTimeout(this.timer);
    this.broadcastState();
    if (this.carouselTick) clearInterval(this.carouselTick);
    this.carouselTick = setInterval(() => this.stepCarousel(), CAROUSEL_TICK);
    this.stepCarousel();
  }

  carouselPos(i: number): [number, number] {
    const car = this.carousel!;
    const a = car.angle + (i / car.units.length) * Math.PI * 2;
    return [Math.cos(a) * CAROUSEL_R, Math.sin(a) * CAROUSEL_R];
  }

  walk(p: Player, x: number, z: number) {
    const av = this.carousel?.avatars.get(p.id);
    if (!av || av.picked >= 0 || !Number.isFinite(x) || !Number.isFinite(z)) return;
    av.tx = Math.max(-6.6, Math.min(6.6, x));
    av.tz = Math.max(-5.6, Math.min(5.6, z));
  }

  botCarouselChoice(p: Player): number {
    const car = this.carousel!;
    const traits = computeTraits(p.boardUnits().map((u) => u.defId), mergeBonus(traitBonus(p.augments), emblemBonus(p.boardUnits())));
    let best = -1, bs = -Infinity;
    car.units.forEach((cu, i) => {
      if (cu.taken) return;
      const def = UNITS[cu.defId];
      const copies = p.units.filter((u) => u.defId === cu.defId).length;
      const synergy = def.traits.filter((t) => traits.some((x) => x.id === t && x.count > 0)).length;
      const itemV = ITEMS[cu.item]?.component ? 0.6 : ITEMS[cu.item]?.special ? 0.8 : 1.6;
      const s = def.cost * 1.3 + synergy * 1.1 + copies * 1.8 + itemV + Math.random() * 0.8;
      if (s > bs) { bs = s; best = i; }
    });
    return best;
  }

  stepCarousel() {
    const car = this.carousel;
    if (!car || this.phase !== 'carousel') {
      if (this.carouselTick) clearInterval(this.carouselTick);
      this.carouselTick = null;
      return;
    }
    const now = Date.now();
    const dt = CAROUSEL_TICK / 1000;
    car.angle += CAROUSEL_SPIN * dt;
    for (const p of this.alive()) {
      const av = car.avatars.get(p.id);
      if (!av || av.picked >= 0) continue;
      const open = now >= (car.unlockAt.get(p.id) ?? Infinity);
      // bots (e humanos desconectados) andam sozinhos até o robô escolhido
      if ((p.isBot || !p.connected) && open) {
        let target = car.botPick.get(p.id) ?? -1;
        if (target < 0 || car.units[target].taken) { target = this.botCarouselChoice(p); car.botPick.set(p.id, target); }
        if (target >= 0) { const [x, z] = this.carouselPos(target); av.tx = x; av.tz = z; }
      }
      const dx = av.tx - av.x, dz = av.tz - av.z;
      const d = Math.hypot(dx, dz);
      const step = AV_SPEED * dt * (p.isBot ? 0.85 : 1);
      if (d > 0.01) { const k = Math.min(1, step / d); av.x += dx * k; av.z += dz * k; }
      // trancado: barreira invisível em volta do carrossel
      const r = Math.hypot(av.x, av.z);
      if (!open && r < CAROUSEL_R + 1.2) { const k = (CAROUSEL_R + 1.2) / Math.max(0.01, r); av.x *= k; av.z *= k; }
      if (!open) continue;
      for (let i = 0; i < car.units.length; i++) {
        const cu = car.units[i];
        if (cu.taken) continue;
        const [x, z] = this.carouselPos(i);
        if (Math.hypot(x - av.x, z - av.z) < PICK_R) { cu.taken = p.id; av.picked = i; break; }
      }
    }
    const everyone = this.alive().every((p) => (car.avatars.get(p.id)?.picked ?? 0) >= 0);
    const msg: ServerMsg = {
      t: 'carousel', units: car.units, angle: car.angle, spin: CAROUSEL_SPIN, radius: CAROUSEL_R,
      avatars: [...car.avatars.entries()].map(([id, a]) => ({ id, x: Math.round(a.x * 100) / 100, z: Math.round(a.z * 100) / 100, picked: a.picked })),
      unlocked: [...car.unlockAt.entries()].filter(([, at]) => now >= at).map(([id]) => id),
      locked: [...car.unlockAt.entries()].filter(([, at]) => now < at).map(([id]) => id),
      endsIn: Math.max(0, car.end - now),
    };
    for (const p of this.players) p.send(msg);
    if (everyone) setTimeout(() => this.finishCarousel(), 1200);
    if (now >= car.end || everyone) {
      if (this.carouselTick) clearInterval(this.carouselTick);
      this.carouselTick = null;
      if (!everyone) this.finishCarousel();
    }
  }

  finishCarousel() {
    const car = this.carousel;
    if (!car || this.phase !== 'carousel') return;
    if (this.carouselTick) clearInterval(this.carouselTick);
    this.carouselTick = null;
    for (const p of this.alive()) {
      const av = car.avatars.get(p.id);
      let i = av?.picked ?? -1;
      if (i < 0) {
        const free = car.units.map((u, k) => (u.taken ? -1 : k)).filter((k) => k >= 0);
        if (!free.length) continue;
        i = pick(free);
        car.units[i].taken = p.id;
      }
      const cu = car.units[i];
      const slot = p.freeBenchSlot();
      if (slot >= 0) p.units.push({ id: newUnitId(), defId: cu.defId, star: 1, items: [], loc: { zone: 'bench', i: slot } });
      else { p.gold += UNITS[cu.defId].cost; this.returnToPool(cu.defId); }
      p.giveItems([cu.item]);
      this.tryMerge(p);
      if (!p.isBot) this.toast(p, `🎠 Você pegou ${UNITS[cu.defId].name} com ${ITEMS[cu.item].icon} ${ITEMS[cu.item].name}!`, 'good');
    }
    for (const cu of car.units) if (!cu.taken) this.returnToPool(cu.defId);
    this.carousel = null;
    this.startPlanning();
  }

  startPlanning() {
    this.round++;
    this.phase = 'planning';
    const label = stageLabel(this.round);
    const augIdx = ['2-1', '3-2', '4-2'].indexOf(label);
    let hasChoice = false;
    for (const p of this.alive()) {
      p.ready = false;
      p.opponentId = null;
      // renda (igual TFT): base + juros + sequência
      const base = this.round === 1 ? 2 : this.round === 2 ? 2 : this.round === 3 ? 3 : this.round === 4 ? 4 : 5;
      const cap = interestCap(this.portal, p.hasAug('juroscomp'));
      const interest = this.round === 1 ? 0 : Math.min(cap, Math.floor(p.gold / 10));
      const s = Math.abs(p.streak);
      const streakBonus = s >= 6 ? 3 : s >= 5 ? 2 : s >= 3 ? 1 : 0;
      p.gold += base + interest + (this.isPve(this.round - 1) ? 0 : streakBonus) + (this.portal === 'chuva' ? 1 : 0);
      if (this.portal === 'colheres' && label === '3-1') { p.giveItems(['colher']); if (!p.isBot) this.toast(p, '🥄 Chuva de Colheres: mais uma Colher de Pau!', 'good'); }
      p.addXp(2 + (p.hasAug('xpturbo') ? 2 : 0));
      p.freeRerolls = p.hasAug('rolagratis') ? 1 : 0;
      if (!p.locked || p.shop.length === 0) this.rollShop(p);
      p.locked = false;
      this.tryMerge(p);
      // escolhas
      p.choice = null;
      if (augIdx >= 0 && isAugmentRound(this.round)) { p.choice = this.makeAugmentChoice(p, this.augTiers[augIdx]); hasChoice = true; }
      else if (isArmoryRound(this.round)) { p.choice = this.makeArmoryChoice(); hasChoice = true; }
    }
    const dur = (this.round === 1 ? FIRST_PLANNING_MS : PLANNING_MS) + (hasChoice ? CHOICE_EXTRA_MS : 0);
    this.endsAt = Date.now() + dur;
    this.phaseTotal = dur;
    this.setTimer(dur, () => this.startCombat());
    this.broadcastState();
    setTimeout(() => {
      if (this.phase !== 'planning') return;
      for (const p of this.alive()) {
        if (!p.isBot) continue;
        if (p.choice) this.choose(p, botChoose(this, p));
        botPlan(this, p);
      }
      this.broadcastState();
    }, 1200 + Math.random() * 1500);
  }

  setTimer(ms: number, fn: () => void) {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(fn, ms);
  }

  autoFill(p: Player) {
    while (p.boardUnits().length < p.cap() && p.benchUnits().length > 0) {
      const u = p.benchUnits().sort((a, b) => UNITS[b.defId].cost * b.star - UNITS[a.defId].cost * a.star)[0];
      const melee = UNITS[u.defId].range <= 1;
      const rows = melee ? [0, 1, 2, 3] : [3, 2, 1, 0];
      const cols = [3, 2, 4, 1, 5, 0, 6];
      let placed = false;
      for (const r of rows) {
        for (const c of cols) {
          if (!p.unitAt({ zone: 'board', r, c })) { u.loc = { zone: 'board', r, c }; placed = true; break; }
        }
        if (placed) break;
      }
      if (!placed) break;
    }
    while (p.boardUnits().length > p.cap()) {
      const u = p.boardUnits()[p.boardUnits().length - 1];
      const s = p.freeBenchSlot();
      if (s < 0) break;
      u.loc = { zone: 'bench', i: s };
    }
  }

  sideOf(p: Player): SideInput {
    return {
      augments: p.augments,
      units: p.boardUnits().map((u) => ({
        defId: u.defId, star: u.star, items: u.items,
        r: (u.loc as { r: number }).r, c: (u.loc as { c: number }).c,
      })),
    };
  }

  pveSide(): SideInput {
    const { stage, sub } = stageOf(this.round);
    const units: SideInput['units'] = [];
    const cols = [3, 1, 5, 2, 4, 0, 6];
    if (stage === 1) {
      const n = sub; // 1-2: 2 drones, 1-3: 3, 1-4: 4
      for (let i = 0; i < n; i++) units.push({ defId: 'drone', star: 1, r: 0, c: cols[i] });
    } else {
      const tier = stage - 1; // 2-7 → 1, 3-7 → 2...
      const star = Math.min(3, tier);
      for (let i = 0; i < Math.min(7, 1 + tier); i++) units.push({ defId: 'dronebig', star, r: 0, c: cols[i] });
      for (let i = 0; i < Math.min(7, 2 + tier); i++) units.push({ defId: 'drone', star: Math.min(3, star + 1), r: 1, c: cols[i] });
    }
    return { units };
  }

  makePairs(): { a: Player; b: Player | null; ghost: boolean }[] {
    const alive = this.alive();
    let best: Player[] = [];
    for (let attempt = 0; attempt < 20; attempt++) {
      const arr = [...alive].sort(() => Math.random() - 0.5);
      best = arr;
      let repeats = 0;
      for (let i = 0; i + 1 < arr.length; i += 2) if (arr[i].lastOpp === arr[i + 1].id) repeats++;
      if (repeats === 0 || alive.length <= 2) break;
    }
    const pairs: { a: Player; b: Player | null; ghost: boolean }[] = [];
    for (let i = 0; i + 1 < best.length; i += 2) pairs.push({ a: best[i], b: best[i + 1], ghost: false });
    if (best.length % 2 === 1) {
      const solo = best[best.length - 1];
      const others = alive.filter((x) => x !== solo);
      const ghost = others[Math.floor(Math.random() * others.length)];
      pairs.push({ a: solo, b: ghost, ghost: true });
    }
    return pairs;
  }

  startCombat() {
    if (this.phase !== 'planning') return;
    this.phase = 'combat';
    const pve = this.isPve(this.round);
    this.pendingCombats = [];
    for (const p of this.alive()) {
      // escolha não feita: escolhe sozinho
      if (p.choice) this.choose(p, Math.floor(Math.random() * p.choice.options.length));
      this.autoFill(p);
    }
    let maxDur = 0;
    if (pve) {
      for (const p of this.alive()) {
        const result = simulate(this.sideOf(p), this.pveSide(), Math.floor(Math.random() * 1e9));
        this.pendingCombats.push({ a: p, b: null, ghost: false, result, pve: true });
        maxDur = Math.max(maxDur, result.duration);
        p.opponentId = null;
        p.send({ t: 'combat', round: this.round, mySide: 0, opponentName: 'Drones da Patrulha', pve: true, result, home: 0, dmg: this.combatDamage(result, true) });
      }
    } else {
      for (const pair of this.makePairs()) {
        const b = pair.b!;
        const result = simulate(this.sideOf(pair.a), this.sideOf(b), Math.floor(Math.random() * 1e9));
        // casa/fora: um dos dois viaja até o tabuleiro do outro (fantasma sempre joga fora)
        const home: 0 | 1 = pair.ghost ? 0 : Math.random() < 0.5 ? 0 : 1;
        const dmg = this.combatDamage(result, false);
        this.pendingCombats.push({ a: pair.a, b, ghost: pair.ghost, result, pve: false, home });
        maxDur = Math.max(maxDur, result.duration);
        pair.a.opponentId = b.id;
        pair.a.lastOpp = b.id;
        pair.a.send({ t: 'combat', round: this.round, mySide: 0, opponentName: pair.ghost ? `${b.name} (fantasma)` : b.name, opponentId: b.id, pve: false, result, home, dmg });
        if (!pair.ghost) {
          b.opponentId = pair.a.id;
          b.lastOpp = pair.a.id;
          b.send({ t: 'combat', round: this.round, mySide: 1, opponentName: pair.a.name, opponentId: pair.a.id, pve: false, result, home, dmg });
        }
      }
    }
    const dur = maxDur + COMBAT_PAD_MS;
    this.combatStartedAt = Date.now();
    this.endsAt = Date.now() + dur;
    this.phaseTotal = dur;
    this.setTimer(dur, () => this.endCombat());
    this.broadcastState();
  }

  /** Recompensas das rodadas PvE (componentes, itens e ouro). */
  pveLoot(p: Player, won: boolean, killed: number) {
    const { stage } = stageOf(this.round);
    const loot: string[] = [];
    if (stage === 1) {
      loot.push(randomComponent());
      if (this.round === 3) { p.gold += 2; if (Math.random() < 0.5) loot.push(randomComponent()); }
    } else if (stage <= 3) {
      loot.push(randomComponent());
      if (won) loot.push(randomComponent());
    } else {
      loot.push(won ? randomCompleted() : randomComponent());
      if (won && Math.random() < 0.5) loot.push(randomComponent());
    }
    if (stage >= 3 && Math.random() < 0.2) loot.push(randomSpecial());
    if (stage >= 2 && Math.random() < 0.1) loot.push('colher');
    if (this.portal === 'drones') loot.push(randomComponent());
    p.gold += killed;
    p.giveItems(loot);
    p.send({ t: 'loot', items: loot, gold: killed });
    if (!p.isBot) {
      this.toast(p, `🎁 Saque: ${loot.map((i) => `${ITEMS[i].icon} ${ITEMS[i].name}`).join(', ')}${killed ? ` · +${killed} 💰` : ''}`, 'good');
    }
  }

  /** Muambeiros: depois de cada combate contra jogador, chance de trazer muamba (mais se perdeu). */
  muamba(p: Player, won: boolean) {
    const traits = computeTraits(p.boardUnits().map((u) => u.defId), mergeBonus(traitBonus(p.augments), emblemBonus(p.boardUnits())));
    const tr = traits.find((x) => x.id === 'muambeiro');
    if (!tr || tr.tier < 0) return;
    const chance = TRAITS.muambeiro.values[tr.tier] / 100 + (won ? 0 : 0.15);
    if (Math.random() >= chance) return;
    const gold = tr.tier >= 1 ? 3 + Math.floor(Math.random() * 3) : 1 + Math.floor(Math.random() * 2);
    p.gold += gold;
    const loot: string[] = [];
    if (tr.tier >= 1 && Math.random() < 0.5) loot.push(randomComponent());
    if (tr.tier >= 1 && Math.random() < 0.15) loot.push(randomSpecial());
    p.giveItems(loot);
    if (!p.isBot) this.toast(p, `💰 Muamba: +${gold} de ouro${loot.map((i) => ` · ${ITEMS[i].icon} ${ITEMS[i].name}`).join('')}`, 'good');
  }

  /** Dano que o perdedor leva (igual para o aviso no começo do combate e o fim). */
  combatDamage(res: CombatResult, pve: boolean) {
    const base = stageDamage(this.round);
    const dmgFrom = (side: 0 | 1) =>
      base + res.survivors.filter((s) => s.side === side).reduce((s, x) => s + survivorDamage(x.star, x.cost), 0);
    const k = this.portal === 'colchao' ? 0.75 : 1;
    if (pve) return res.winner === 0 ? 0 : Math.max(1, Math.ceil((dmgFrom(1) / 2) * k));
    return Math.max(1, Math.ceil((res.winner === -1 ? base : dmgFrom(res.winner)) * k));
  }

  endCombat() {
    for (const c of this.pendingCombats) {
      const res = c.result;
      const dmg = this.combatDamage(res, c.pve);
      if (c.pve) {
        const killed = res.units.filter((u) => u.side === 1).length - res.survivors.filter((s) => s.side === 1).length;
        this.pveLoot(c.a, res.winner === 0, killed);
        if (res.winner !== 0) c.a.hp -= dmg;
        continue;
      }
      const b = c.b!;
      this.muamba(c.a, res.winner === 0);
      if (!c.ghost) this.muamba(b, res.winner === 1);
      if (res.winner === 0) {
        this.win(c.a);
        if (!c.ghost) this.lose(b, dmg);
      } else if (res.winner === 1) {
        this.lose(c.a, dmg);
        if (!c.ghost) this.win(b);
      } else {
        this.lose(c.a, dmg);
        if (!c.ghost) this.lose(b, dmg);
      }
    }
    this.pendingCombats = [];
    const dead = this.alive().filter((p) => p.hp <= 0).sort((a, b) => a.hp - b.hp);
    let place = this.alive().length;
    for (const p of dead) {
      p.alive = false;
      p.hp = 0;
      p.place = place--;
      for (const u of p.units) this.returnToPool(u.defId, Math.pow(3, u.star - 1));
      for (const id of p.shop) if (id) this.returnToPool(id);
      p.units = [];
      p.shop = [];
      p.choice = null;
      for (const x of this.players) this.toast(x, `💀 ${p.name} apagou de vez (${p.place}º lugar)`, 'info');
    }
    const alive = this.alive();
    if (alive.length <= 1) {
      if (alive[0]) alive[0].place = 1;
      this.phase = 'gameover';
      if (this.timer) clearTimeout(this.timer);
      const ranking = [...this.players].sort((a, b) => a.place - b.place)
        .map((p) => ({ id: p.id, name: p.name, place: p.place, isBot: p.isBot }));
      this.broadcastState();
      for (const p of this.players) p.send({ t: 'gameover', ranking });
      return;
    }
    this.nextRound();
  }

  win(p: Player) {
    p.gold += 1;
    p.streak = p.streak >= 0 ? p.streak + 1 : 1;
  }

  lose(p: Player, dmg: number) {
    p.hp -= dmg;
    p.streak = p.streak <= 0 ? p.streak - 1 : -1;
  }

  // ================= estado =================

  publicPlayers(): PublicPlayer[] {
    return this.players.map((p) => ({
      id: p.id, name: p.name, hp: p.hp, level: p.level, alive: p.alive, isBot: p.isBot,
      connected: p.connected, streak: p.streak, place: p.place, gold: p.gold, augments: p.augments, avatar: p.avatar,
      board: p.boardUnits().map((u) => ({ defId: u.defId, star: u.star, items: u.items, r: (u.loc as { r: number }).r, c: (u.loc as { c: number }).c })),
    }));
  }

  sendState(p: Player, pub = this.publicPlayers()) {
    if (p.isBot) return;
    p.send({
      t: 'state', phase: this.phase, round: this.round, endsIn: Math.max(0, this.endsAt - Date.now()),
      phaseTotal: this.phaseTotal, portal: this.portal,
      pve: this.isPve(this.round), hostId: this.hostId, players: pub, opponentId: p.opponentId,
      me: {
        gold: p.gold, level: p.level, xp: p.xp, xpNeeded: p.xpNeeded(), shop: p.shop, units: p.units,
        itemBench: p.itemBench, augments: p.augments, choice: p.choice, freeRerolls: p.freeRerolls,
        locked: p.locked, streak: p.streak, ready: p.ready, hp: p.hp, alive: p.alive,
      },
    });
  }

  broadcastState(except?: Player) {
    const pub = this.publicPlayers();
    for (const p of this.players) if (p !== except) this.sendState(p, pub);
  }
}
