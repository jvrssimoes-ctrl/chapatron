import { AUGMENTS, traitBonus } from '../shared/augments';
import { MAX_LEVEL, stageOf, TRAITS, UNITS, XP_COST } from '../shared/data';
import { BENCH_SIZE } from '../shared/hex';
import { combine, isComponent, ITEMS, itemSlots } from '../shared/items';
import { computeTraits } from '../shared/traits';
import type { OwnedUnit, TraitId } from '../shared/types';
import type { Player, Room } from './room';

// =====================================================================
// IA dos bots: escolhe uma composição (2 sinergias foco), nivela e rola
// em momentos-chave como um jogador de verdade, monta itens no carregador
// e no tanque, e posiciona tanques na frente e carregadores no canto.
// =====================================================================

type Style = 'padrao' | 'reroll';

interface Brain {
  style: Style;
  focus: TraitId[];
  side: 0 | 1; // canto preferido do carregador (esquerda/direita)
  carryId: string | null;
  tankId: string | null;
  rolledAt: Set<number>; // níveis em que já fez o "roll down"
  lastRound: number;
}

const brains = new WeakMap<Player, Brain>();

function brainOf(room: Room, p: Player): Brain {
  let b = brains.get(p);
  if (!b || room.round < b.lastRound) {
    b = {
      style: Math.random() < 0.3 ? 'reroll' : 'padrao',
      focus: [],
      side: Math.random() < 0.5 ? 0 : 1,
      carryId: null,
      tankId: null,
      rolledAt: new Set(),
      lastRound: 0,
    };
    brains.set(p, b);
  }
  b.lastRound = room.round;
  return b;
}

/** Rodada correspondente a um estágio (ex.: 3-2 → 12). */
const R = (stage: number, sub: number) => 4 + (stage - 2) * 7 + (sub - 1);

// curvas de nível (rodada a partir da qual quer estar no nível)
const LEVEL_CURVE: Record<Style, [number, number][]> = {
  padrao: [[R(2, 1), 4], [R(2, 5), 5], [R(3, 2), 6], [R(3, 5), 7], [R(4, 2), 8], [R(5, 2), 9], [R(6, 2), 10]],
  reroll: [[R(2, 1), 4], [R(2, 5), 5], [R(3, 1), 6], [R(4, 5), 7], [R(5, 1), 8], [R(6, 1), 9]],
};

const STAR_POWER = [1, 2.6, 6.5];
const MELEE_ROLES = new Set(['tank', 'fighter']);
const FRONT = (defId: string) => MELEE_ROLES.has(UNITS[defId].role);
const isCarryRole = (defId: string) => ['adcarry', 'apcaster', 'assassin'].includes(UNITS[defId].role);
const isAP = (defId: string) => UNITS[defId].role === 'apcaster' || (UNITS[defId].role === 'support' && UNITS[defId].ability.scale === 'ap');

function unitPower(u: OwnedUnit) {
  const d = UNITS[u.defId];
  return (1 + d.cost * 0.65) * STAR_POWER[u.star - 1] + u.items.length * 1.3;
}

/** Valor das sinergias ativas de um conjunto de unidades. */
function traitValue(defIds: string[], bonus: Partial<Record<TraitId, number>>, focus: TraitId[]) {
  let v = 0;
  for (const t of computeTraits(defIds, bonus)) {
    if (t.tier < 0) {
      // perto de ativar também vale um pouco
      if (focus.includes(t.id)) v += t.count * 0.3;
      continue;
    }
    const w = focus.includes(t.id) ? 1.4 : 1;
    v += (t.tier + 1) * 2.2 * w;
  }
  return v;
}

/** Quantas "cópias de 1★" o jogador tem desse robô (que ainda podem evoluir). */
function copies(p: Player, defId: string) {
  let n = 0;
  for (const u of p.units) if (u.defId === defId && u.star < 3) n += Math.pow(3, u.star - 1);
  return n;
}

// ---------------- foco de composição ----------------

function updateFocus(room: Room, p: Player, b: Brain) {
  const bonus = traitBonus(p.augments);
  const uniq = [...new Set(p.units.map((u) => u.defId))];
  const scores = new Map<TraitId, number>();
  for (const id of uniq) {
    const d = UNITS[id];
    const best = Math.max(...p.units.filter((u) => u.defId === id).map(unitPower));
    for (const t of d.traits) scores.set(t, (scores.get(t) ?? 0) + 1 + best * 0.12);
  }
  for (const [t, n] of Object.entries(bonus) as [TraitId, number][]) scores.set(t, (scores.get(t) ?? 0) + n * 1.6);
  // sinergias com breakpoints altos são melhores para foco
  for (const [t, s] of scores) scores.set(t, s + TRAITS[t].breakpoints.length * 0.25);
  // histerese: mantém o foco atual se ainda estiver perto do melhor
  for (const t of b.focus) if (scores.has(t)) scores.set(t, scores.get(t)! + (room.round >= R(3, 1) ? 1.5 : 0.5));
  const ranked = [...scores.entries()].sort((a, z) => z[1] - a[1]).map(([t]) => t);
  b.focus = ranked.slice(0, 2);
}

// ---------------- compras ----------------

function wantScore(room: Room, p: Player, b: Brain, defId: string) {
  const d = UNITS[defId];
  const stage = stageOf(room.round).stage;
  let s = 0;
  const c = copies(p, defId);
  const maxed = p.units.some((u) => u.defId === defId && u.star === 3);
  if (maxed) return -5;
  if (c > 0) s += 2.5 + Math.min(c, 4) * 0.9 + (c % 3 === 2 ? 1.5 : 0); // completa evolução
  for (const t of d.traits) {
    if (b.focus.includes(t)) s += 2.2;
    else if (p.boardUnits().some((u) => UNITS[u.defId].traits.includes(t))) s += 0.6;
  }
  if (b.style === 'reroll') s += d.cost <= 3 ? 0.8 : (stage >= 5 ? 1 : -0.5);
  else s += d.cost * (stage >= 4 ? 0.55 : stage >= 3 ? 0.3 : 0.15);
  // late game: unidades baratas sem par não valem nada
  if (stage >= 4 && d.cost <= 2 && c === 0) s -= 2.5;
  return s;
}

function reserveFor(room: Room, p: Player) {
  const stage = stageOf(room.round).stage;
  if (stage <= 1 || room.round < R(2, 3)) return 0;
  if (stage === 2) return room.round < R(2, 6) ? 10 : 20;
  if (p.hp <= 50) return 10;
  if (stage === 3) return 30;
  return 50;
}

function shopPass(room: Room, p: Player, b: Brain, reserve: number) {
  for (let i = 0; i < p.shop.length; i++) {
    const id = p.shop[i];
    if (!id) continue;
    const d = UNITS[id];
    if (p.gold < d.cost) continue;
    const w = wantScore(room, p, b, id);
    const needBody = p.units.length < p.level;
    const c = copies(p, id);
    const isUpgrade = c % 3 === 2;
    const early = stageOf(room.round).stage <= 2;
    // começo de jogo: junta pares e robôs das sinergias foco para ter ⭐⭐ cedo
    const threshold = needBody ? 0 : early ? 2.2 : 3;
    if (w < threshold) continue;
    const canSpend = p.gold - d.cost >= reserve || isUpgrade || needBody ||
      (early && c > 0 && p.gold - d.cost >= reserve - 10) || (w >= 4.5 && p.gold - d.cost >= reserve - 10);
    if (!canSpend) continue;
    if (p.freeBenchSlot() < 0 && !room.canMergeOnBuy(p, id)) {
      // abre espaço vendendo o pior do banco, se valer a troca
      const worst = benchJunk(room, p, b)[0];
      if (!worst || junkScore(room, p, b, worst) >= w - 1) continue;
      room.sell(p, worst.id);
    }
    room.buy(p, i);
  }
}

function junkScore(room: Room, p: Player, b: Brain, u: OwnedUnit) {
  // valor de manter: o mesmo critério de compra + poder do próprio robô
  return wantScore(room, p, b, u.defId) * 0.6 + unitPower(u) * 0.4 - (copies(p, u.defId) >= 2 ? 0 : 1);
}

function benchJunk(room: Room, p: Player, b: Brain) {
  return p.benchUnits().sort((x, y) => junkScore(room, p, b, x) - junkScore(room, p, b, y));
}

// ---------------- plano da rodada ----------------

export function botPlan(room: Room, p: Player) {
  const b = brainOf(room, p);
  const round = room.round;
  const stage = stageOf(round).stage;

  updateFocus(room, p, b);
  arrange(p, b);

  // nível alvo pela curva
  let target = 1;
  for (const [r, lvl] of LEVEL_CURVE[b.style]) if (round >= r) target = lvl;
  // morrendo cedo: segura o nível e gasta em rolagem; muito rico: sobe mais rápido
  if (p.hp <= 30 && stage >= 4) target = Math.max(p.level, target - 1);

  let rollTo = Infinity; // ouro mínimo que fica depois das rolagens
  const levelUp = () => {
    while (p.level < MAX_LEVEL && p.level < target && p.gold >= XP_COST) room.buyXp(p);
  };
  levelUp();

  // momentos de "roll down"
  const spike = b.style === 'padrao' ? [8, 9] : [6, 8];
  if (spike.includes(p.level) && !b.rolledAt.has(p.level) && p.level >= target) {
    b.rolledAt.add(p.level);
    rollTo = p.level >= 8 ? 10 : 20;
  }
  if (p.hp <= 20 && stage >= 3) rollTo = Math.min(rollTo, 0);
  else if (p.hp <= 40 && stage >= 3) rollTo = Math.min(rollTo, 10);
  else if (p.hp <= 60 && stage >= 4) rollTo = Math.min(rollTo, 30);
  // gasta o excesso acima de 50 (rerollers rolam devagar no nível-chave)
  if (round >= R(3, 1)) {
    const slow = b.style === 'reroll' ? 50 : p.level >= 8 ? 50 : Infinity;
    rollTo = Math.min(rollTo, slow);
  }
  // nível 9/10 no fim: ouro sobrando vira XP
  if (stage >= 5 && p.level >= 8 && p.gold >= 56 && p.level < MAX_LEVEL && b.style === 'padrao') {
    while (p.gold >= 54 && p.level < MAX_LEVEL) room.buyXp(p);
  }

  const reserve = Math.min(reserveFor(room, p), rollTo);
  shopPass(room, p, b, reserve);

  let rolls = 0;
  while (p.freeRerolls > 0 || (p.gold >= rollTo + 2 && rolls < 30)) {
    if (!room.reroll(p)) break;
    rolls++;
    arrange(p, b);
    shopPass(room, p, b, Math.min(rollTo, reserve));
  }

  // economia: sobrou acima do alvo de juros e falta nível? compra XP
  if (stage >= 3 && p.level < MAX_LEVEL && p.gold >= 58 && b.style === 'padrao') {
    while (p.gold >= 54 && p.level < MAX_LEVEL) room.buyXp(p);
  }

  // vende o excesso do banco (mantém pares e foco)
  while (p.units.length > p.level + BENCH_SIZE - 2) {
    arrange(p, b);
    const junk = benchJunk(room, p, b)[0];
    if (!junk) break;
    room.sell(p, junk.id);
  }
  // late game: limpa o banco de robôs sem futuro
  if (stage >= 4) {
    for (const u of benchJunk(room, p, b)) {
      if (copies(p, u.defId) <= 1 && !UNITS[u.defId].traits.some((t) => b.focus.includes(t)) && UNITS[u.defId].cost <= 3) room.sell(p, u.id);
    }
  }

  room.tryMerge(p);
  arrange(p, b);
  equipItems(room, p, b);
  arrange(p, b);
}

// ---------------- escolhas (aprimoramentos e arsenal) ----------------

const AUG_BASE: Record<string, [number, number, number]> = {
  // [estágio 2, estágio 3, estágio 4+]
  heranca: [6, 5, 3], rolagratis: [5.5, 5, 4], xpturbo: [6, 5, 2], feira: [6, 5.5, 4.5],
  lataforte: [5, 6, 6.5], dedonervoso: [5, 6, 6.5], menteexp: [4.5, 5.5, 6], golpecrit: [4.5, 5.5, 6], linhafrente: [5, 6, 6.5],
  juroscomp: [7.5, 5, 2.5], nivelja: [6.5, 6, 4], itempronto: [7, 7, 6.5], furia: [5.5, 6.5, 7.5], socorro: [5.5, 6, 6.5],
  artilharia: [5.5, 6.5, 7.5], manainf: [5, 6, 6.5], laricacol: [5.5, 6, 6.5],
  reciclagem: [4.5, 4.5, 4], pazinterior: [5, 6, 6.5], vampiro: [5.5, 6.5, 7], presente: [7, 8.5, 9],
  fortuna: [8.5, 8, 6.5], caixamist: [9, 9, 8.5], brisalend: [8, 9, 10], ascensao: [8, 8, 6.5],
};

function compKind(p: Player): 'ad' | 'ap' {
  const board = p.boardUnits();
  const ap = board.filter((u) => isAP(u.defId)).length;
  const ad = board.filter((u) => ['adcarry', 'assassin'].includes(UNITS[u.defId].role)).length;
  return ap > ad ? 'ap' : 'ad';
}

function augScore(room: Room, p: Player, b: Brain, id: string) {
  const g = AUGMENTS[id];
  const stage = stageOf(room.round).stage;
  const k = Math.max(0, Math.min(2, stage - 2));
  if (g.trait) {
    const uniq = p.units.map((u) => u.defId);
    const bonus = traitBonus(p.augments);
    const before = computeTraits(uniq, bonus).find((t) => t.id === g.trait);
    const after = computeTraits(uniq, { ...bonus, [g.trait]: (bonus[g.trait] ?? 0) + (g.traitBonus ?? 0) }).find((t) => t.id === g.trait);
    let s = b.focus.includes(g.trait) ? 6.5 : 2.5;
    if (after && (after.tier > (before?.tier ?? -1))) s += 2.5;
    return s + (g.traitBonus ?? 1) * 0.6;
  }
  let s = (AUG_BASE[id] ?? [5, 5, 5])[k];
  const kind = compKind(p);
  if (kind === 'ap' && (id === 'menteexp' || id === 'manainf')) s += 1;
  if (kind === 'ad' && (id === 'furia' || id === 'golpecrit' || id === 'dedonervoso')) s += 1;
  if (b.style === 'reroll' && id === 'rolagratis') s += 1.5;
  if (b.style === 'reroll' && (id === 'xpturbo' || id === 'nivelja')) s -= 1.5;
  if (p.hp < 50 && (id === 'heranca' || id === 'juroscomp' || id === 'xpturbo')) s -= 2;
  return s;
}

export function botChoose(room: Room, p: Player): number {
  const ch = p.choice;
  if (!ch || !ch.options.length) return 0;
  const b = brainOf(room, p);
  updateFocus(room, p, b);
  const scoreOf = (id: string) =>
    (ch.kind === 'augment' ? augScore(room, p, b, id) : itemNeedScore(p, b, id)) + Math.random() * 0.8;
  let best = 0;
  let bestS = -Infinity;
  ch.options.forEach((id, i) => {
    const s = scoreOf(id);
    if (s > bestS) { bestS = s; best = i; }
  });
  return best;
}

// ---------------- itens ----------------

const AD_COMP = new Set(['isqueiro', 'seda', 'luvas', 'colirio']);
const AP_COMP = new Set(['cachimbo', 'colirio', 'luvas', 'seda']);
const TANK_COMP = new Set(['lataria', 'aluminio', 'pochete']);
const AD_ITEMS = new Set(['lancachamas', 'bazuca', 'megaseda', 'mira', 'rede', 'maodestino', 'pocheteraivosa', 'isqueiroplasma', 'cristal', 'tocha', 'tesoura', 'turbo']);
const AP_ITEMS = new Set(['cachimbogig', 'garrafa', 'luvaarcana', 'coroa', 'morteiro', 'turbo', 'cristal', 'isqueiroplasma', 'maodestino', 'tesoura', 'ionizador', 'lancachamas']);
const TANK_ITEMS = new Set(['caixadagua', 'cadeado', 'parachoque', 'coracao', 'chapeu', 'abafador', 'tenis', 'marmita', 'tampa', 'facaeletrica', 'manto', 'mochila', 'radio', 'coleteseda', 'caixadesom', 'escudocosmico', 'maleta']);

function wantsItem(defId: string, item: string): number {
  const ap = isAP(defId);
  const carry = isCarryRole(defId);
  if (isComponent(item)) {
    if (carry) return (ap ? AP_COMP : AD_COMP).has(item) ? 3 : TANK_COMP.has(item) ? 0.5 : 1;
    return TANK_COMP.has(item) ? 3 : 1;
  }
  if (carry) return (ap ? AP_ITEMS : AD_ITEMS).has(item) ? 4 : TANK_ITEMS.has(item) ? 0.5 : 1.5;
  return TANK_ITEMS.has(item) ? 4 : 1;
}

function pickCarryTank(p: Player, b: Brain) {
  const board = p.boardUnits();
  const carryOf = (u: OwnedUnit) => unitPower(u) + u.items.length * 3 + (u.id === b.carryId ? 2 : 0);
  const carries = board.filter((u) => isCarryRole(u.defId)).sort((x, y) => carryOf(y) - carryOf(x));
  const tanks = board.filter((u) => FRONT(u.defId)).sort((x, y) => carryOf(y) - carryOf(x) + (UNITS[y.defId].role === 'tank' ? 1 : 0) - (UNITS[x.defId].role === 'tank' ? 1 : 0));
  b.carryId = carries[0]?.id ?? board[0]?.id ?? null;
  b.tankId = tanks[0]?.id ?? null;
  return { carry: carries[0] ?? board[0], carry2: carries[1], tank: tanks[0] };
}

/** Quão bom seria receber este item agora (usado no arsenal). */
function itemNeedScore(p: Player, b: Brain, item: string) {
  const { carry, tank } = pickCarryTank(p, b);
  let s = 1;
  if (carry) {
    const free = carry.items.length < 3 || carry.items.some(isComponent);
    s = Math.max(s, wantsItem(carry.defId, item) * (free ? 1.2 : 0.4));
    if (isComponent(item)) {
      const held = carry.items.find(isComponent);
      const made = held && combine(held, item);
      if (made && wantsItem(carry.defId, made) >= 4) s += 2;
      for (const c of p.itemBench.filter(isComponent)) {
        const m = combine(c, item);
        if (m && wantsItem(carry.defId, m) >= 4) { s += 1; break; }
      }
    }
  }
  if (tank) s = Math.max(s, wantsItem(tank.defId, item) * (tank.items.length < 3 ? 1 : 0.3));
  return s;
}

/** Pode receber este item sem estragar (combinação ruim / sem espaço)? Retorna o ganho. */
function equipGain(u: OwnedUnit, item: string): number {
  if (ITEMS[item]?.special) return item === 'xerox' && UNITS[u.defId].cost <= 4 && u.star < 3 ? 2.5 + UNITS[u.defId].cost * 0.3 : -1;
  if (u.items.includes('maoleve')) return -1;
  if (isComponent(item)) {
    const held = u.items.find(isComponent);
    if (held) {
      const made = combine(held, item)!;
      if (made === 'maoleve') return u.items.length > 1 ? -1 : 2;
      return wantsItem(u.defId, made);
    }
  }
  if (item === 'maoleve') return u.items.length === 0 ? 3 : -1;
  if (itemSlots([...u.items, item]) > 3) return -1;
  return wantsItem(u.defId, item);
}

function equipItems(room: Room, p: Player, b: Brain) {
  if (!p.boardUnits().length || !p.itemBench.length) return;
  const stage = stageOf(room.round).stage;
  let guard = 40;
  while (p.itemBench.length && guard-- > 0) {
    const { carry, carry2, tank } = pickCarryTank(p, b);
    const others = p.boardUnits().filter((u) => u !== carry && u !== carry2 && u !== tank).sort((x, y) => unitPower(y) - unitPower(x));
    const targets = [carry, tank, carry2, ...others].filter(Boolean) as OwnedUnit[];
    // completos primeiro, depois componentes
    const order = p.itemBench.map((it, i) => ({ it, i })).sort((x, y) => Number(isComponent(x.it)) - Number(isComponent(y.it)));
    let did = false;
    for (const { it, i } of order) {
      let best: OwnedUnit | null = null;
      let bestG = 0;
      targets.forEach((u, rank) => {
        const g = equipGain(u, it) - rank * 0.35;
        if (g > bestG) { bestG = g; best = u; }
      });
      // componente sem bom destino: guarda até o estágio 4 (espera a combinação certa)
      const minGain = isComponent(it) && stage < 4 && p.itemBench.length < 6 ? 2.2 : 0.3;
      if (best && bestG >= minGain && room.equip(p, i, (best as OwnedUnit).id)) { did = true; break; }
    }
    if (!did) break;
  }
}

// ---------------- tabuleiro e posicionamento ----------------

function arrange(p: Player, b: Brain) {
  const bonus = traitBonus(p.augments);
  const pool = [...p.units];
  const chosen: OwnedUnit[] = [];
  const minFront = Math.max(2, Math.round(p.level / 3));
  while (chosen.length < p.level && pool.length) {
    const ids = chosen.map((u) => u.defId);
    const base = traitValue(ids, bonus, b.focus);
    const front = chosen.filter((u) => FRONT(u.defId)).length;
    let best = -1;
    let bestV = -Infinity;
    pool.forEach((u, i) => {
      const dup = ids.includes(u.defId);
      let v = unitPower(u) + (dup ? 0 : traitValue([...ids, u.defId], bonus, b.focus) - base);
      if (dup) v -= 1.5;
      if (FRONT(u.defId) && front < minFront) v += 2.5;
      if (!FRONT(u.defId) && front >= minFront && chosen.length - front >= p.level - minFront) v -= 1.5;
      if (v > bestV) { bestV = v; best = i; }
    });
    chosen.push(pool.splice(best, 1)[0]);
  }

  // posições (fileira 0 = frente)
  const used = new Set<string>();
  const mir = (c: number) => (b.side ? 6 - c : c);
  const place = (u: OwnedUnit, spots: [number, number][]) => {
    for (const [r, c0] of spots) {
      const c = mir(c0);
      const k = `${r},${c}`;
      if (!used.has(k)) { used.add(k); u.loc = { zone: 'board', r, c }; return true; }
    }
    return false;
  };
  const all: [number, number][] = [];
  for (let r = 0; r < 4; r++) for (const c of [3, 2, 4, 1, 5, 0, 6]) all.push([r, c]);
  const carry = chosen.filter((u) => isCarryRole(u.defId) && UNITS[u.defId].range > 1)
    .sort((x, y) => (y.id === b.carryId ? 99 : 0) - (x.id === b.carryId ? 99 : 0) || unitPower(y) - unitPower(x));
  const byRole = (r: string) => chosen.filter((u) => UNITS[u.defId].role === r).sort((x, y) => unitPower(y) - unitPower(x));

  // carregador principal no canto de trás; demais atiradores ao lado
  for (const u of carry) place(u, [[3, 0], [3, 1], [2, 0], [3, 2], [2, 1], [3, 3], [3, 4], [3, 5], [3, 6], ...all]);
  // tanques no centro da frente, puxando para o lado do carregador
  for (const u of byRole('tank')) place(u, [[0, 2], [0, 3], [0, 1], [0, 4], [0, 0], [0, 5], [0, 6], ...all]);
  for (const u of byRole('fighter')) place(u, [[0, 1], [0, 4], [0, 2], [0, 3], [0, 0], [0, 5], [1, 1], [1, 3], [0, 6], ...all]);
  // assassinos nas laterais (pulam na retaguarda no começo)
  for (const u of byRole('assassin')) place(u, [[1, 6], [1, 0], [0, 6], [2, 6], [1, 5], ...all]);
  // suportes perto do carregador
  for (const u of byRole('support')) place(u, [[2, 1], [3, 1], [2, 2], [3, 2], [2, 0], ...all]);

  const rest = p.units.filter((u) => !chosen.includes(u));
  rest.forEach((u, i) => { u.loc = { zone: 'bench', i }; });
}
