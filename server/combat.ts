import { AD_STAR_MULT, BASE_CRIT, BASE_CRIT_DMG, HP_STAR_MULT, TRAITS, UNITS } from '../shared/data';
import { COLS, COMBAT_ROWS, hexDist, lineHexes, localToCombat, neighbors } from '../shared/hex';
import { COMPLETED, ITEMS } from '../shared/items';
import { traitBonus } from '../shared/augments';
import { computeTraits, emblemBonus, mergeBonus, unitTraits } from '../shared/traits';
import type { AbilityKind, CombatEvent, CombatResult, CombatUnitInit, StatusKind, TraitId, UnitDef } from '../shared/types';

export interface SideUnit { defId: string; star: number; r: number; c: number; items?: string[] } // coords locais
export interface SideInput { units: SideUnit[]; augments?: string[] }

const TICK = 50;
const MAX_T = 45000;
const MOVE_TIME = 420;
const FOREVER = 1e9;
const OVERTIME_T = 22000;

type DmgType = 'phys' | 'magic' | 'true';
type DmgKind = 'atk' | 'ability' | 'proc';

interface Dot { src: CU; dps: number; until: number; type: DmgType; healCut: boolean; tag: string }

interface CU {
  uid: number;
  side: 0 | 1;
  def: UnitDef;
  star: number;
  r: number;
  c: number;
  localR: number;
  items: string[];
  has: Set<string>;
  hp: number;
  maxHp: number;
  baseAd: number;
  adPct: number; // bônus percentual permanente
  as: number; // base
  asPct: number; // bônus permanente (itens/sinergias/acúmulos)
  range: number;
  armor: number;
  mr: number;
  mana: number;
  maxMana: number;
  shield: number;
  shieldUntil: number;
  stunUntil: number;
  stunImmuneUntil: number;
  nextAct: number;
  target: CU | null;
  alive: boolean;
  dodge: number;
  crit: number;
  critDmg: number;
  abilityCrit: boolean;
  ap: number; // 100 = base
  omnivamp: number;
  regen: number; // % por segundo
  manaRegen: number;
  killHeal: number; // %
  killAS: number;
  recycle: number;
  dmgAmp: number;
  buffAS: number;
  buffUntil: number;
  turboUntil: number;
  armorShredUntil: number;
  mrShredUntil: number;
  healCutUntil: number;
  dots: Dot[];
  atkCount: number;
  coleteStacks: number;
  thornsReadyAt: number;
  tampaDone: boolean;
  facaDone: boolean;
  escudoDone: boolean;
  jumper: boolean;
  manaFromHits: number; // multiplicador de mana ao apanhar
  abilityAmp: number; // Neons: dano extra de habilidade
  neonMana: number; // Neons: mana devolvida após lançar
  paraAS: number; // Paranoicos: vel. de ataque ao surtar
  paraDone: boolean;
  invulnUntil: number;
  piradoPct: number; // Pirados: respingo a cada 3 ataques
  // ---- estados das habilidades únicas ----
  blindUntil: number;
  slowUntil: number;
  slowAmt: number;
  vulnUntil: number;
  vulnAmt: number;
  tauntBy: CU | null;
  tauntUntil: number;
  stealthUntil: number;
  reflectUntil: number;
  reflectPct: number;
  silenceUntil: number;
  dodgeBuffUntil: number;
  dodgeBuff: number;
  adBuff: number;
  adBuffUntil: number;
  resBuff: number;
  resBuffUntil: number;
  popAttacks: number;
  popPct: number;
  hyperUntil: number;
  summons: number;
  summon: boolean;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GIANT_HP = 1600;

/** Habilidades que não precisam de alvo no alcance para serem lançadas. */
const NO_RANGE = new Set<AbilityKind>([
  'cascagrossa', 'bolinhapaz', 'estouro', 'fornada', 'grave', 'fotossintese', 'neblinapesada', 'rima', 'hiperespaco',
  'latariareal', 'vibracao', 'seiva', 'festa', 'radinho', 'espelho', 'groove', 'pizza', 'eclipse', 'golpenebuloso',
  'cupinzeiro', 'imantar', 'parafuso', 'buraconegro', 'raiz', 'moedor',
]);

export function simulate(a: SideInput, b: SideInput, seed: number): CombatResult {
  const rng = mulberry32(seed);
  const units: CU[] = [];
  const events: CombatEvent[] = [];
  let uid = 1;
  let t = 0;

  // ações agendadas (impactos atrasados, zonas, canalizações)
  const tasks: { at: number; fn: () => void }[] = [];
  const later = (ms: number, fn: () => void) => tasks.push({ at: t + ms, fn });

  const makeCU = (def: UnitDef, side: 0 | 1, r: number, c: number, star: number, localR: number, items: string[]): CU => {
    const maxHp = def.hp * HP_STAR_MULT[star - 1];
    return {
      uid: uid++, side, def, star, r, c, localR, items, has: new Set(items),
      hp: maxHp, maxHp,
      baseAd: def.atk * AD_STAR_MULT[star - 1], adPct: 0, as: def.as, asPct: 0, range: def.range,
      armor: def.armor, mr: def.mr, mana: def.startMana, maxMana: def.mana,
      shield: 0, shieldUntil: 0, stunUntil: 0, stunImmuneUntil: 0,
      nextAct: 300 + Math.floor(rng() * 300), target: null, alive: true,
      dodge: 0, crit: BASE_CRIT / 100, critDmg: 1 + BASE_CRIT_DMG / 100, abilityCrit: false, ap: 100,
      omnivamp: 0, regen: 0, manaRegen: 0, killHeal: 0, killAS: 0, recycle: 0, dmgAmp: 0,
      buffAS: 0, buffUntil: 0, turboUntil: 0, armorShredUntil: 0, mrShredUntil: 0, healCutUntil: 0, dots: [],
      atkCount: 0, coleteStacks: 0, thornsReadyAt: 0, tampaDone: false, facaDone: false, escudoDone: true,
      jumper: def.role === 'assassin', manaFromHits: def.role === 'tank' ? 1.5 : 1,
      abilityAmp: 0, neonMana: 0, paraAS: 0, paraDone: false, invulnUntil: 0, piradoPct: 0,
      blindUntil: 0, slowUntil: 0, slowAmt: 0, vulnUntil: 0, vulnAmt: 0, tauntBy: null, tauntUntil: 0,
      stealthUntil: 0, reflectUntil: 0, reflectPct: 0, silenceUntil: 0, dodgeBuffUntil: 0, dodgeBuff: 0,
      adBuff: 0, adBuffUntil: 0, resBuff: 0, resBuffUntil: 0, popAttacks: 0, popPct: 0, hyperUntil: 0,
      summons: 0, summon: !!def.summon,
    };
  };

  const occupied = (r: number, c: number) => units.some((u) => u.alive && u.r === r && u.c === c);

  const hackedSides = new Set<0 | 1>();
  const gardens: { side: 0 | 1; count: number; hp: number; col: number }[] = [];
  const build = (side: 0 | 1, input: SideInput) => {
    const list = input.units;
    const augs = new Set(input.augments ?? []);
    const traits = computeTraits(list.map((x) => x.defId), mergeBonus(traitBonus(input.augments ?? []), emblemBonus(list)));
    const tierOf = (id: TraitId) => traits.find((t) => t.id === id)?.tier ?? -1;
    const val = (id: TraitId) => {
      const tier = tierOf(id);
      return tier >= 0 ? TRAITS[id].values[tier] : 0;
    };
    const extra = (id: TraitId) => {
      const tier = tierOf(id);
      return tier >= 0 ? (TRAITS[id].extra?.[tier] ?? 0) : 0;
    };
    const teamRes = val('ferrugem') + (augs.has('lataforte') ? 20 : 0);
    const teamShield = val('guru') + (augs.has('socorro') ? 200 : 0);
    const teamAS = val('dj') / 100 + (augs.has('dedonervoso') ? 0.12 : 0);
    if (val('hacker') > 0) hackedSides.add(side === 0 ? 1 : 0);

    const gardeners: number[] = [];
    for (const su of list) {
      const def = UNITS[su.defId];
      if (!def) continue;
      const star = Math.max(1, Math.min(3, su.star));
      const [r, c] = localToCombat(su.r, su.c, side);
      const myTraits = unitTraits(su.defId, su.items ?? []);
      const hasT = (t: TraitId) => myTraits.includes(t);
      if (hasT('jardineiro')) gardeners.push(c);

      // Mão Leve: troca por 2 itens completos aleatórios a cada combate
      let items = [...(su.items ?? [])];
      if (items.includes('maoleve')) {
        const pool = COMPLETED.filter((i) => i !== 'maoleve');
        items = ['maoleve', pool[Math.floor(rng() * pool.length)], pool[Math.floor(rng() * pool.length)]];
      }
      const st = { ad: 0, as: 0, ap: 0, mana: 0, armor: 0, mr: 0, hp: 0, crit: 0 };
      for (const id of items) {
        const it = ITEMS[id];
        if (!it || id === 'maoleve') continue;
        for (const [k, v] of Object.entries(it.stats)) st[k as keyof typeof st] += v as number;
      }
      const cu = makeCU(def, side, r, c, star, su.r, items);
      const has = cu.has;

      let maxHp = cu.maxHp + st.hp;
      if (hasT('tanque')) maxHp += val('tanque');
      if (augs.has('linhafrente') && su.r <= 1) maxHp += 250;
      if (augs.has('pazinterior')) maxHp += 150;
      if (has.has('marmita')) maxHp *= 1.12;
      cu.hp = cu.maxHp = maxHp;

      const sorr = hasT('sorrateiro') ? val('sorrateiro') / 100 : 0;
      cu.adPct = st.ad / 100 + (augs.has('furia') ? 0.15 : 0);
      cu.asPct = st.as / 100 + (hasT('atirador') ? val('atirador') / 100 : 0) + teamAS;
      cu.armor += teamRes + st.armor;
      cu.mr += teamRes + st.mr;
      cu.mana += st.mana + (hasT('hacker') ? val('hacker') : 0) + (augs.has('manainf') ? 20 : 0);
      cu.maxMana = Math.max(20, def.mana - (has.has('coroa') ? 10 : 0));
      cu.shield = teamShield; cu.shieldUntil = teamShield > 0 ? FOREVER : 0;
      cu.stunImmuneUntil = has.has('tenis') ? 15000 : 0;
      cu.dodge = hasT('fumaceiro') ? val('fumaceiro') / 100 : 0;
      cu.crit += st.crit / 100 + sorr + (augs.has('golpecrit') ? 0.15 : 0);
      cu.critDmg += sorr + (has.has('tesoura') ? 0.15 : 0);
      cu.abilityCrit = has.has('tesoura') || has.has('luvaarcana');
      cu.ap = 100 + st.ap + (hasT('brisa') ? val('brisa') : 0) + (hasT('cosmico') ? extra('cosmico') : 0) + (augs.has('menteexp') ? 15 : 0);
      cu.omnivamp = (augs.has('vampiro') ? 0.12 : 0) + (has.has('isqueiroplasma') ? 0.2 : 0) + (has.has('facaeletrica') ? 0.12 : 0) + (has.has('maodestino') ? 0.15 : 0);
      cu.regen = (hasT('verdinho') ? val('verdinho') : 0) + (augs.has('laricacol') ? 1 : 0);
      cu.manaRegen = hasT('cosmico') ? val('cosmico') : 0;
      cu.killHeal = hasT('larica') ? val('larica') : 0;
      cu.killAS = hasT('larica') ? extra('larica') / 100 : 0;
      cu.recycle = hasT('reciclado') ? val('reciclado') / 100 : 0;
      cu.dmgAmp = (has.has('lancachamas') ? 0.2 : 0) + (has.has('maodestino') ? 0.15 : 0)
        + (augs.has('brisalend') ? 0.25 : 0) + (augs.has('artilharia') && su.r >= 2 ? 0.2 : 0);
      cu.escudoDone = !has.has('escudocosmico');
      cu.abilityAmp = hasT('neon') ? val('neon') / 100 : 0;
      cu.neonMana = hasT('neon') ? extra('neon') : 0;
      cu.paraAS = hasT('paranoico') ? val('paranoico') / 100 : 0;
      cu.piradoPct = hasT('pirado') ? val('pirado') / 100 : 0;
      if (has.has('escudocosmico')) {
        cu.shield += cu.maxHp * 0.3;
        cu.shieldUntil = cu.shieldUntil === FOREVER ? FOREVER : 8000;
      }
      units.push(cu);
    }
    if (val('jardineiro') > 0 && gardeners.length) {
      const col = Math.round(gardeners.reduce((s, x) => s + x, 0) / gardeners.length);
      gardens.push({ side, count: val('jardineiro'), hp: extra('jardineiro'), col });
    }
  };
  build(0, a);
  build(1, b);

  /** Hex livre mais próximo de (r,c) no lado indicado (ou em qualquer lugar). */
  const freeNear = (r: number, c: number, side?: 0 | 1): [number, number] | null => {
    let best: [number, number] | null = null;
    let bd = Infinity;
    for (let rr = 0; rr < COMBAT_ROWS; rr++) {
      if (side === 0 && rr < 4) continue;
      if (side === 1 && rr > 3) continue;
      for (let cc = 0; cc < COLS; cc++) {
        if (occupied(rr, cc)) continue;
        const d = hexDist(r, c, rr, cc) + Math.abs(cc - c) * 0.01;
        if (d < bd) { bd = d; best = [rr, cc]; }
      }
    }
    return best;
  };

  // Jardineiros: mudinhas na linha de frente desde o início
  for (const g of gardens) {
    const front = g.side === 0 ? 4 : 3;
    for (let i = 0; i < g.count; i++) {
      const col = g.side === 0 ? g.col : COLS - 1 - g.col;
      const spot = freeNear(front, Math.max(0, Math.min(COLS - 1, col + (i % 2 ? 1 : -1) * Math.ceil(i / 2))), g.side);
      if (!spot) break;
      const m = makeCU(UNITS.muda, g.side, spot[0], spot[1], 1, 0, []);
      m.hp = m.maxHp = g.hp;
      units.push(m);
    }
  }

  // hackers: o lado invadido começa sem mana
  for (const cu of units) if (hackedSides.has(cu.side)) cu.mana = 0;
  // Caixa de Som: aliados na mesma fileira
  for (const cu of units) {
    if (!cu.has.has('caixadesom')) continue;
    for (const al of units) if (al.side === cu.side && al.r === cu.r) al.asPct += 0.15;
  }

  const initOf = (u: CU): CombatUnitInit => ({
    uid: u.uid, defId: u.def.id, star: u.star, side: u.side, r: u.r, c: u.c,
    hp: Math.round(u.hp), maxHp: Math.round(u.maxHp), mana: Math.round(u.mana), maxMana: u.maxMana,
    shield: Math.round(u.shield), items: u.items,
  });
  const init: CombatUnitInit[] = units.map(initOf);

  const enemiesOf = (u: CU) => units.filter((x) => x.alive && x.side !== u.side);
  const alliesOf = (u: CU) => units.filter((x) => x.alive && x.side === u.side);
  const dist = (x: CU, y: CU) => hexDist(x.r, x.c, y.r, y.c);
  const auraNear = (u: CU, item: string) => units.some((x) => x.alive && x.side !== u.side && x.has.has(item) && dist(x, u) <= 2);
  const targetable = (e: CU) => e.alive && e.stealthUntil <= t;

  const adOf = (u: CU) => {
    let pct = u.adPct + u.coleteStacks + (u.adBuffUntil > t ? u.adBuff : 0);
    if (u.has.has('pocheteraivosa') && u.hp < u.maxHp * 0.6) pct += 0.4;
    return u.baseAd * (1 + pct);
  };
  const apOf = (u: CU) => u.ap * (1 + u.coleteStacks);
  const asOf = (u: CU) => {
    let bonus = u.asPct + (u.buffUntil > t ? u.buffAS : 0) + (u.turboUntil > t ? 0.6 : 0);
    if (auraNear(u, 'manto')) bonus -= 0.2;
    if (u.slowUntil > t) bonus -= u.slowAmt;
    return u.as * Math.max(0.3, 1 + bonus);
  };
  const armorOf = (u: CU) => {
    let a = u.armor + (u.resBuffUntil > t ? u.resBuff : 0);
    if (u.has.has('cadeado')) a += 12 * units.filter((x) => x.alive && x.side !== u.side && x.target === u).length;
    let shred = 0;
    if (u.armorShredUntil > t) shred = 0.3;
    if (auraNear(u, 'abafador')) shred = Math.max(shred, 0.3);
    return a * (1 - shred);
  };
  const mrOf = (u: CU) => {
    let m = u.mr + (u.resBuffUntil > t ? u.resBuff : 0);
    if (u.has.has('cadeado')) m += 12 * units.filter((x) => x.alive && x.side !== u.side && x.target === u).length;
    let shred = 0;
    if (u.mrShredUntil > t) shred = 0.3;
    if (auraNear(u, 'ionizador')) shred = Math.max(shred, 0.3);
    return m * (1 - shred);
  };

  const nearestEnemy = (u: CU) => {
    let best: CU | null = null;
    let bd = Infinity;
    for (const e of enemiesOf(u)) {
      if (!targetable(e)) continue;
      const d = dist(u, e);
      if (d < bd || (d === bd && best && e.uid < best.uid)) { bd = d; best = e; }
    }
    return best;
  };
  const byDist = (from: { r: number; c: number }, list: CU[]) =>
    [...list].sort((x, y) => hexDist(from.r, from.c, x.r, x.c) - hexDist(from.r, from.c, y.r, y.c) || x.uid - y.uid);
  /** Inimigo cujo hex tem mais inimigos em volta (centro do "maior grupo"). */
  const clusterCenter = (u: CU, rad: number) => {
    const es = enemiesOf(u);
    let best: CU | null = null;
    let bn = -1;
    for (const e of es) {
      const n = es.filter((x) => dist(x, e) <= rad).length;
      if (n > bn || (n === bn && best && dist(u, e) < dist(u, best))) { bn = n; best = e; }
    }
    return best;
  };

  const status = (u: CU, s: StatusKind, dur: number) => events.push({ t, k: 'status', u: u.uid, s, dur });
  const proc = (u: CU, item: string, tgs?: number[]) => events.push({ t, k: 'proc', u: u.uid, item, tgs });
  const fx = (u: CU, ab: AbilityKind, extra: { tg?: number; tgs?: number[]; r?: number; c?: number; n?: number } = {}) =>
    events.push({ t, k: 'fx', u: u.uid, ab, ...extra });

  const moveTo = (u: CU, r: number, c: number, how: 'jump' | 'dash' | 'push') => {
    u.r = r; u.c = c;
    events.push({ t, k: 'move', u: u.uid, r, c, jump: how === 'jump' || undefined, dash: how === 'dash' || undefined, push: how === 'push' || undefined });
  };
  /** Hex livre vizinho de alvo, preferindo o lado de trás dele (visto de quem vem). */
  const spotBehind = (from: CU, tg: CU): [number, number] | null => {
    const spots = neighbors(tg.r, tg.c).filter(([r, c]) => !occupied(r, c));
    if (!spots.length) return null;
    spots.sort((p, q) => hexDist(from.r, from.c, q[0], q[1]) - hexDist(from.r, from.c, p[0], p[1]));
    return spots[0];
  };
  const spotNear = (tg: CU, from?: CU): [number, number] | null => {
    const spots = neighbors(tg.r, tg.c).filter(([r, c]) => !occupied(r, c));
    if (!spots.length) return null;
    if (from) spots.sort((p, q) => hexDist(from.r, from.c, p[0], p[1]) - hexDist(from.r, from.c, q[0], q[1]));
    return spots[0];
  };
  const push = (src: { r: number; c: number }, tg: CU) => {
    if (!tg.alive) return;
    const d0 = hexDist(src.r, src.c, tg.r, tg.c);
    const spots = neighbors(tg.r, tg.c).filter(([r, c]) => !occupied(r, c) && hexDist(src.r, src.c, r, c) > d0);
    if (!spots.length) return;
    spots.sort((p, q) => hexDist(src.r, src.c, q[0], q[1]) - hexDist(src.r, src.c, p[0], p[1]));
    moveTo(tg, spots[0][0], spots[0][1], 'push');
  };

  const kill = (src: CU | null, tgt: CU) => {
    tgt.alive = false;
    tgt.hp = 0;
    events.push({ t, k: 'death', u: tgt.uid });
    if (src && src.alive && src.killHeal > 0) {
      heal(src, (src.maxHp * src.killHeal) / 100);
      src.asPct += src.killAS;
      events.push({ t, k: 'buff', u: src.uid, dur: 1500 });
    }
    for (const al of units) {
      if (al.alive && al.side === tgt.side && al.recycle > 0) {
        al.dmgAmp += al.recycle;
        events.push({ t, k: 'buff', u: al.uid, dur: 1000 });
      }
    }
    // vírus herbal: pula para o inimigo mais próximo
    const vir = tgt.dots.find((d) => d.tag === 'virus' && d.until > t);
    if (vir) {
      const next = byDist(tgt, units.filter((x) => x.alive && x.side === tgt.side))[0];
      if (next) {
        addDot(next, vir.src, vir.dps, 4000, 'magic', false, 'virus');
        fx(vir.src, 'virus', { tg: next.uid, tgs: [tgt.uid] });
      }
    }
  };

  const heal = (tgt: CU, amount: number) => {
    if (!tgt.alive) return 0;
    if (tgt.healCutUntil > t) amount *= 0.67;
    const before = tgt.hp;
    tgt.hp = Math.min(tgt.maxHp, tgt.hp + amount);
    const amt = Math.round(tgt.hp - before);
    if (amt > 0) events.push({ t, k: 'heal', u: tgt.uid, amt, hp: Math.round(tgt.hp) });
    return amount - (tgt.hp - before); // sobra
  };

  const addShield = (tgt: CU, amount: number, dur: number) => {
    if (!tgt.alive) return;
    tgt.shield = (tgt.shieldUntil > t ? tgt.shield : 0) + amount;
    tgt.shieldUntil = Math.max(tgt.shieldUntil, t + dur);
    events.push({ t, k: 'shield', u: tgt.uid, sh: Math.round(tgt.shield) });
  };

  const addDot = (tgt: CU, src: CU, dps: number, dur: number, type: DmgType, healCut: boolean, tag: string) => {
    if (!tgt.alive) return;
    const cur = tgt.dots.find((d) => d.tag === tag && d.src === src);
    if (cur) { cur.dps = Math.max(cur.dps, dps); cur.until = t + dur; }
    else tgt.dots.push({ src, dps, until: t + dur, type, healCut, tag });
    if (healCut) tgt.healCutUntil = Math.max(tgt.healCutUntil, t + dur);
    if (tag === 'burn' || tag === 'virus' || tag === 'queijo') status(tgt, tag === 'virus' ? 'virus' : 'burn', dur);
  };

  const thresholds = (u: CU) => {
    if (!u.alive) return;
    const pct = u.hp / u.maxHp;
    if (!u.tampaDone && u.has.has('tampa') && pct <= 0.6) {
      u.tampaDone = true;
      addShield(u, u.maxHp * 0.25, 5000);
      u.asPct += 0.2;
      proc(u, 'tampa');
    }
    if (!u.paraDone && u.paraAS > 0 && pct <= 0.5) {
      u.paraDone = true;
      u.invulnUntil = t + 1500;
      u.asPct += u.paraAS;
      events.push({ t, k: 'buff', u: u.uid, dur: 1500 });
    }
    if (!u.facaDone && u.has.has('facaeletrica') && pct <= 0.4) {
      u.facaDone = true;
      addShield(u, u.maxHp * 0.25, 5000);
      proc(u, 'facaeletrica');
    }
  };

  const gainMana = (u: CU, amt: number) => {
    if (u.silenceUntil > t) return;
    u.mana = Math.min(u.maxMana, u.mana + amt);
  };

  const damage = (src: CU | null, tgt: CU, raw: number, type: DmgType, kind: DmgKind, canCrit = false): number => {
    if (!tgt.alive) return 0;
    const dodge = tgt.dodge + (tgt.dodgeBuffUntil > t ? tgt.dodgeBuff : 0);
    if (kind === 'atk' && dodge > 0 && rng() < dodge) {
      events.push({ t, k: 'dmg', u: tgt.uid, amt: 0, hp: Math.round(tgt.hp), sh: Math.round(tgt.shield), mana: Math.round(tgt.mana), dodge: true });
      return 0;
    }
    if (tgt.invulnUntil > t) return 0;
    if (tgt.shieldUntil <= t) tgt.shield = 0;
    // "a brisa bateu": dano cresce no fim para não arrastar
    let amp = 1 + (src?.dmgAmp ?? 0) + (kind === 'ability' ? src?.abilityAmp ?? 0 : 0);
    if (src?.has.has('bazuca') && tgt.maxHp > GIANT_HP) amp += 0.25;
    if (src?.has.has('maleta') && tgt.shield > 0) amp += 0.2;
    if (tgt.vulnUntil > t) amp += tgt.vulnAmt;
    let amount = raw * amp * (t > OVERTIME_T ? 1 + (t - OVERTIME_T) / 4000 : 1);
    let crit = false;
    if (src && canCrit && rng() < src.crit) { amount *= src.critDmg; crit = true; }
    const pre = amount;
    if (type === 'phys') amount *= 100 / (100 + Math.max(0, armorOf(tgt)));
    else if (type === 'magic') amount *= 100 / (100 + Math.max(0, mrOf(tgt)));
    if (tgt.has.has('coracao')) amount *= tgt.hp > tgt.maxHp * 0.5 ? 0.75 : 0.85;
    if (kind === 'atk' && tgt.has.has('caixadagua')) amount *= 0.92;
    if (tgt.shield > 0) {
      const absorbed = Math.min(tgt.shield, amount);
      tgt.shield -= absorbed;
      tgt.hp -= amount - absorbed;
    } else {
      tgt.hp -= amount;
    }
    if (kind !== 'proc') gainMana(tgt, Math.min(15, (pre * 0.01 + amount * 0.03) * tgt.manaFromHits));
    events.push({
      t, k: 'dmg', u: tgt.uid, amt: Math.round(amount), hp: Math.max(0, Math.round(tgt.hp)),
      sh: Math.round(tgt.shield), mana: Math.round(tgt.mana), crit: crit || undefined, magic: type === 'magic' || undefined,
      tru: type === 'true' || undefined, s: src?.uid,
    });
    if (src && src.alive && src.omnivamp > 0) heal(src, amount * src.omnivamp);
    if (src && kind !== 'proc' && src.has.has('morteiro')) addDot(tgt, src, tgt.maxHp * 0.02, 5000, 'true', true, 'morteiro');
    // Caixa d'Água: espinhos
    if (kind === 'atk' && tgt.has.has('caixadagua') && t >= tgt.thornsReadyAt && tgt.hp > 0) {
      tgt.thornsReadyAt = t + 2000;
      const adj = enemiesOf(tgt).filter((e) => dist(e, tgt) <= 1);
      proc(tgt, 'caixadagua', adj.map((e) => e.uid));
      for (const e of adj) damage(tgt, e, 80, 'magic', 'proc');
    }
    // espelho / lataria: devolve parte do dano
    if (src && src.alive && kind !== 'proc' && tgt.reflectUntil > t && tgt.shield > 0 && amount > 0) {
      damage(tgt, src, amount * tgt.reflectPct, 'magic', 'proc');
    }
    if (tgt.hp <= 0) kill(src, tgt);
    else thresholds(tgt);
    return amount;
  };

  const stun = (tgt: CU, dur: number) => {
    if (!tgt.alive || t < tgt.stunImmuneUntil) return;
    tgt.stunUntil = Math.max(tgt.stunUntil, t + dur);
    events.push({ t, k: 'stun', u: tgt.uid, dur });
  };
  const cleanse = (u: CU) => {
    if (u.stunUntil > t) { u.stunUntil = t; status(u, 'cleanse', 600); }
  };

  const summonMuda = (owner: CU, hp: number) => {
    const spot = freeNear(owner.r, owner.c);
    if (!spot) return;
    const m = makeCU(UNITS.muda, owner.side, spot[0], spot[1], 1, 0, []);
    m.hp = m.maxHp = hp;
    m.nextAct = t + 500;
    units.push(m);
    events.push({ t, k: 'spawn', u: m.uid, src: owner.uid, unit: initOf(m) });
  };

  // =================== HABILIDADES ÚNICAS ===================
  const cast = (u: CU) => {
    const ab = u.def.ability;
    const base = ab.values[u.star - 1];
    const x = ab.values2?.[u.star - 1] ?? 0;
    const isAD = ab.scale === 'ad';
    const v = isAD ? (base / 100) * adOf(u) : (base * apOf(u)) / 100;
    const vAP = (base * apOf(u)) / 100;
    const dtype: DmgType = isAD ? 'phys' : 'magic';
    const tg = u.target && targetable(u.target) ? u.target : nearestEnemy(u);
    u.mana = 0;
    u.nextAct = t + 400;
    const hit = (e: CU, val = v, type: DmgType = dtype) => damage(u, e, val, type, 'ability', u.abilityCrit);
    const ev = (extra: { tg?: number; tgs?: number[]; r?: number; c?: number; n?: number } = {}) =>
      events.push({ t, k: 'cast', u: u.uid, ab: ab.kind, ...extra });
    const adjEnemies = (center: { r: number; c: number }, rad = 1) => enemiesOf(u).filter((e) => hexDist(center.r, center.c, e.r, e.c) <= rad);
    const lineFrom = (to: CU) => {
      const cells = lineHexes(u.r, u.c, to.r, to.c);
      const set = new Set(cells.map(([r, c]) => r * COLS + c));
      const end = cells[cells.length - 1] ?? [to.r, to.c];
      return { hits: enemiesOf(u).filter((e) => set.has(e.r * COLS + e.c)), end };
    };

    switch (ab.kind) {
      // ---------------- custo 1 ----------------
      case 'cascagrossa': {
        const adj = adjEnemies(u);
        ev({ tgs: adj.map((e) => e.uid) });
        addShield(u, v, ab.duration ?? 4000);
        for (const e of adj) { e.tauntBy = u; e.tauntUntil = t + 2000; e.target = u; status(e, 'taunt', 2000); }
        break;
      }
      case 'baforada': {
        if (!tg) { ev(); break; }
        ev({ tg: tg.uid });
        later(250, () => { hit(tg); if (tg.alive) { tg.blindUntil = t + 2500; status(tg, 'blind', 2500); } });
        break;
      }
      case 'mordida': {
        if (!tg) { ev(); break; }
        ev({ tg: tg.uid });
        const dealt = hit(tg);
        heal(u, dealt > 0 ? Math.max(dealt, v * 0.5) : v * 0.5);
        if (!tg.alive) { u.adPct += x / 100; status(u, 'rage', 1500); }
        break;
      }
      case 'bolinhapaz': {
        const a0 = alliesOf(u).sort((p, q) => p.hp / p.maxHp - q.hp / q.maxHp)[0];
        ev({ tg: a0?.uid });
        if (a0) {
          later(200, () => {
            heal(a0, v);
            cleanse(a0);
            a0.resBuff = x; a0.resBuffUntil = t + 4000;
          });
        }
        break;
      }
      case 'estouro': {
        ev();
        u.popAttacks = 4; u.popPct = base / 100;
        u.buffAS = Math.max(u.buffUntil > t ? u.buffAS : 0, 0.5); u.buffUntil = t + 5000;
        events.push({ t, k: 'buff', u: u.uid, dur: 5000 });
        break;
      }
      case 'brasa': {
        if (!tg) { ev(); break; }
        ev({ tg: tg.uid });
        later(200, () => { hit(tg); addDot(tg, u, tg.maxHp * 0.02, 4000, 'true', true, 'burn'); });
        break;
      }
      case 'sinaltravado': {
        if (!tg) { ev(); break; }
        const b2 = byDist(tg, enemiesOf(u).filter((e) => e !== tg))[0];
        ev({ tg: tg.uid, tgs: b2 ? [tg.uid, b2.uid] : [tg.uid] });
        later(220, () => { hit(tg); stun(tg, 1200); });
        if (b2) later(480, () => { hit(b2, v / 2); stun(b2, 600); });
        break;
      }
      case 'olhogordo': {
        if (!tg) { ev(); break; }
        ev({ tg: tg.uid });
        later(220, () => {
          if (!tg.alive) return;
          tg.vulnUntil = t + 4000; tg.vulnAmt = x / 100; status(tg, 'mark', 4000);
          hit(tg);
        });
        break;
      }
      case 'cupinzeiro': {
        if (!tg) { ev(); break; }
        ev({ tg: tg.uid });
        u.stealthUntil = t + 700; status(u, 'stealth', 700);
        u.nextAct = t + 900;
        later(600, () => {
          if (!u.alive) return;
          const tt = tg.alive ? tg : nearestEnemy(u);
          if (!tt) return;
          const spot = spotNear(tt, u);
          if (spot) moveTo(u, spot[0], spot[1], 'dash');
          const hits = adjEnemies(tt).filter((e) => e === tt || dist(e, tt) <= 1);
          fx(u, 'cupinzeiro', { tg: tt.uid, tgs: hits.map((e) => e.uid), r: tt.r, c: tt.c });
          for (const e of hits) { hit(e); stun(e, 1000); }
          u.target = tt;
        });
        break;
      }
      case 'chiclete': {
        if (!tg) { ev(); break; }
        ev({ tg: tg.uid });
        later(260, () => { hit(tg); if (tg.alive) { tg.slowUntil = t + 3000; tg.slowAmt = 0.4; status(tg, 'slow', 3000); } });
        break;
      }
      case 'fogueira': {
        if (!tg) { ev(); break; }
        const r0 = tg.r, c0 = tg.c;
        ev({ tg: tg.uid, r: r0, c: c0 });
        for (let i = 0; i < 6; i++) later(300 + i * 500, () => { for (const e of adjEnemies({ r: r0, c: c0 })) hit(e, v / 6); });
        break;
      }

      // ---------------- custo 2 ----------------
      case 'moedor': {
        ev();
        u.nextAct = t + 2000;
        for (let i = 0; i < 4; i++) {
          later(250 + i * 500, () => {
            if (!u.alive) return;
            const adj = adjEnemies(u);
            fx(u, 'moedor', { tgs: adj.map((e) => e.uid), n: i });
            for (const e of adj) { hit(e, v / 4); e.slowUntil = t + 1000; e.slowAmt = 0.3; }
          });
        }
        break;
      }
      case 'nuvemdensa': {
        if (!tg) { ev(); break; }
        const r0 = tg.r, c0 = tg.c;
        ev({ tg: tg.uid, r: r0, c: c0 });
        for (let i = 0; i < 6; i++) {
          later(300 + i * 500, () => {
            for (const e of adjEnemies({ r: r0, c: c0 })) { hit(e, v / 6); e.slowUntil = t + 800; e.slowAmt = 0.3; }
          });
        }
        break;
      }
      case 'esporos': {
        if (!tg) { ev(); break; }
        const nb = enemiesOf(u).filter((e) => e !== tg && dist(e, tg) <= 1);
        ev({ tg: tg.uid, tgs: nb.map((e) => e.uid) });
        later(300, () => {
          hit(tg); stun(tg, 1500);
          for (const e of nb) { hit(e, (v * x) / 100); stun(e, 750); }
        });
        break;
      }
      case 'fornada': {
        const a0 = alliesOf(u).sort((p, q) => p.hp / p.maxHp - q.hp / q.maxHp)[0];
        ev({ tg: a0?.uid });
        if (a0) later(300, () => { const extra = heal(a0, v); if (extra > 1) addShield(a0, extra, 4000); });
        break;
      }
      case 'golpenebuloso': {
        const low = enemiesOf(u).filter(targetable).sort((p, q) => p.hp - q.hp)[0] ?? tg;
        if (!low) { ev(); break; }
        ev({ tg: low.uid });
        u.stealthUntil = t + 1000; status(u, 'stealth', 1000);
        u.nextAct = t + 600;
        later(300, () => {
          if (!u.alive || !low.alive) return;
          const spot = spotBehind(u, low);
          if (spot) moveTo(u, spot[0], spot[1], 'jump');
          u.target = low;
          fx(u, 'golpenebuloso', { tg: low.uid });
          hit(low);
        });
        break;
      }
      case 'grave': {
        const allies = alliesOf(u);
        const dur = ab.duration ?? 4000;
        ev({ tgs: allies.map((p) => p.uid) });
        for (const al of allies) {
          const amt = (base / 100) * (dist(u, al) <= 2 ? 2 : 1);
          al.buffAS = Math.max(al.buffUntil > t ? al.buffAS : 0, amt);
          al.buffUntil = t + dur;
          events.push({ t, k: 'buff', u: al.uid, dur });
        }
        break;
      }
      case 'parafuso': {
        const hits = enemiesOf(u).sort((p, q) => p.hp - q.hp || p.uid - q.uid).slice(0, ab.count ?? 3);
        ev({ tg: hits[0]?.uid, tgs: hits.map((e) => e.uid) });
        later(300, () => { for (const e of hits) { hit(e); if (e.alive) e.armorShredUntil = t + 4000; } });
        break;
      }
      case 'pulsoneon': {
        if (!tg) { ev(); break; }
        const hits = adjEnemies(tg);
        ev({ tg: tg.uid, tgs: hits.map((e) => e.uid) });
        later(280, () => { for (const e of hits) { hit(e); e.mana = Math.max(0, e.mana - x); events.push({ t, k: 'mana', u: e.uid, mana: Math.round(e.mana) }); } });
        break;
      }
      case 'radinho': {
        const best = alliesOf(u).sort((p, q) => adOf(q) - adOf(p)).slice(0, 2);
        ev({ tgs: best.map((p) => p.uid) });
        for (const al of best) {
          al.adBuff = base / 100; al.adBuffUntil = t + 5000;
          al.buffAS = Math.max(al.buffUntil > t ? al.buffAS : 0, 0.2); al.buffUntil = t + 5000;
          events.push({ t, k: 'buff', u: al.uid, dur: 5000 });
        }
        break;
      }
      case 'raiz': {
        const hits = byDist(u, enemiesOf(u)).slice(0, 2);
        ev({ tgs: hits.map((e) => e.uid) });
        addShield(u, x * (apOf(u) / 100), 4000);
        later(300, () => { for (const e of hits) { hit(e); stun(e, 1500); } });
        break;
      }
      case 'tornado': {
        if (!tg) { ev(); break; }
        const { hits, end } = lineFrom(tg);
        ev({ tg: tg.uid, tgs: hits.map((e) => e.uid), r: end[0], c: end[1] });
        later(250, () => { for (const e of byDist(u, hits)) { hit(e); push(u, e); } });
        break;
      }

      // ---------------- custo 3 ----------------
      case 'salgadinho': {
        if (!tg) { ev(); break; }
        const hits = [tg, ...byDist(tg, enemiesOf(u).filter((e) => e !== tg))].slice(0, ab.count ?? 3);
        ev({ tg: tg.uid, tgs: hits.map((e) => e.uid) });
        u.asPct += x / 100;
        events.push({ t, k: 'buff', u: u.uid, dur: 800 });
        later(300, () => { for (const e of hits) hit(e); });
        break;
      }
      case 'fotossintese': {
        const allies = alliesOf(u);
        ev({ tgs: allies.map((p) => p.uid) });
        for (let i = 0; i < 3; i++) {
          later(200 + i * 1000, () => {
            for (const al of alliesOf(u)) heal(al, (v / 3) * (al.hp < al.maxHp * 0.4 ? 2 : 1));
            fx(u, 'fotossintese', { tgs: alliesOf(u).map((p) => p.uid), n: i });
          });
        }
        break;
      }
      case 'neblinapesada': {
        const hits = adjEnemies(u, ab.radius ?? 1);
        ev({ tgs: hits.map((e) => e.uid) });
        u.dodgeBuff = x / 100; u.dodgeBuffUntil = t + 3000; status(u, 'dodge', 3000);
        later(330, () => { for (const e of hits) { hit(e); stun(e, ab.duration ?? 1500); } });
        break;
      }
      case 'eclipse': {
        const jump = (n: number) => {
          if (!u.alive) return;
          const low = enemiesOf(u).filter(targetable).sort((p, q) => p.hp - q.hp)[0];
          if (!low) return;
          const spot = spotBehind(u, low);
          if (spot) moveTo(u, spot[0], spot[1], 'jump');
          u.target = low;
          if (n === 0) ev({ tg: low.uid }); else fx(u, 'eclipse', { tg: low.uid, n });
          later(250, () => {
            if (!u.alive || !low.alive) return;
            hit(low);
            if (!low.alive && n < 2) later(200, () => jump(n + 1));
          });
          u.nextAct = t + 700;
        };
        jump(0);
        break;
      }
      case 'rima': {
        const allies = alliesOf(u);
        ev({ tgs: allies.map((p) => p.uid) });
        for (const al of allies) heal(al, v);
        u.adBuff = x / 100; u.adBuffUntil = t + 5000; status(u, 'rage', 5000);
        break;
      }
      case 'virus': {
        if (!tg) { ev(); break; }
        ev({ tg: tg.uid });
        later(350, () => addDot(tg, u, v / 4, 4000, 'magic', false, 'virus'));
        break;
      }
      case 'escapamento': {
        if (!tg) { ev(); break; }
        const { hits, end } = lineFrom(tg);
        ev({ tg: tg.uid, tgs: hits.map((e) => e.uid), r: end[0], c: end[1] });
        later(220, () => { for (const e of hits) hit(e); });
        break;
      }
      case 'surto': {
        const hits = adjEnemies(u);
        ev({ tgs: hits.map((e) => e.uid) });
        u.stealthUntil = t + 1000; status(u, 'stealth', 1000);
        later(250, () => { for (const e of hits) hit(e); });
        break;
      }
      case 'ricochete': {
        if (!tg) { ev(); break; }
        const chain: CU[] = [tg];
        let cur = tg;
        for (let i = 1; i < 5; i++) {
          const opts = byDist(cur, enemiesOf(u).filter((e) => e !== cur && e !== chain[chain.length - 2]));
          if (!opts.length) break;
          cur = opts[0];
          chain.push(cur);
        }
        ev({ tg: tg.uid, tgs: chain.map((e) => e.uid) });
        chain.forEach((e, i) => later(260 + i * 130, () => hit(e, v * Math.pow(0.85, i))));
        break;
      }
      case 'curto': {
        const hits = byDist(u, enemiesOf(u).filter(targetable)).slice(0, 3);
        if (!hits.length) { ev(); break; }
        ev({ tg: hits[0].uid, tgs: hits.map((e) => e.uid) });
        u.nextAct = t + 250 + hits.length * 220;
        hits.forEach((e, i) => later(150 + i * 220, () => {
          if (!u.alive || !e.alive) return;
          const spot = spotBehind(u, e);
          if (spot) moveTo(u, spot[0], spot[1], 'dash');
          hit(e);
          e.mana = Math.max(0, e.mana - 20);
          events.push({ t, k: 'mana', u: e.uid, mana: Math.round(e.mana) });
          u.target = e;
        }));
        break;
      }
      case 'imantar': {
        const far = byDist(u, enemiesOf(u).filter(targetable)).reverse()[0];
        if (!far) { ev(); break; }
        ev({ tg: far.uid });
        later(300, () => {
          if (!u.alive || !far.alive) return;
          const spot = spotNear(u, far);
          if (spot && dist(u, far) > 1) moveTo(far, spot[0], spot[1], 'dash');
          hit(far); stun(far, 1500);
          u.target = far;
        });
        break;
      }

      // ---------------- custo 4 ----------------
      case 'groove': {
        const center = clusterCenter(u, 1) ?? tg;
        if (!center) { ev(); break; }
        const spot = dist(u, center) <= 1 ? null : spotNear(center, u);
        if (spot) moveTo(u, spot[0], spot[1], 'jump');
        ev({ tg: center.uid });
        u.nextAct = t + 900;
        later(450, () => {
          if (!u.alive) return;
          const hits = adjEnemies(u, ab.radius ?? 1);
          fx(u, 'groove', { tgs: hits.map((e) => e.uid), r: u.r, c: u.c });
          for (const e of hits) { hit(e); stun(e, ab.duration ?? 1750); }
        });
        break;
      }
      case 'pizza': {
        const center = clusterCenter(u, 2) ?? tg;
        if (!center) { ev(); break; }
        const r0 = center.r, c0 = center.c;
        ev({ tg: center.uid, r: r0, c: c0 });
        later(800, () => {
          const hits = adjEnemies({ r: r0, c: c0 }, ab.radius ?? 2);
          fx(u, 'pizza', { tgs: hits.map((e) => e.uid), r: r0, c: c0 });
          for (const e of hits) { hit(e); addDot(e, u, v * 0.06, 3000, 'magic', false, 'queijo'); }
        });
        break;
      }
      case 'hiperespaco': {
        ev();
        u.buffAS = Math.max(u.buffUntil > t ? u.buffAS : 0, base / 100); u.buffUntil = t + (ab.duration ?? 5000);
        u.hyperUntil = t + (ab.duration ?? 5000);
        events.push({ t, k: 'buff', u: u.uid, dur: ab.duration ?? 5000 });
        break;
      }
      case 'latariareal': {
        ev();
        addShield(u, v, ab.duration ?? 5000);
        u.reflectUntil = t + (ab.duration ?? 5000); u.reflectPct = x / 100; status(u, 'reflect', ab.duration ?? 5000);
        break;
      }
      case 'pane': {
        if (!tg) { ev(); break; }
        ev({ tg: tg.uid });
        later(300, () => {
          if (!tg.alive) return;
          const stolen = tg.mana;
          tg.mana = 0;
          events.push({ t, k: 'mana', u: tg.uid, mana: 0 });
          hit(tg); stun(tg, ab.duration ?? 2500);
          const al = alliesOf(u).filter((p) => p !== u && p.maxMana < 500).sort((p, q) => p.mana / p.maxMana - q.mana / q.maxMana)[0];
          if (al && stolen > 0) {
            gainMana(al, stolen);
            events.push({ t, k: 'mana', u: al.uid, mana: Math.round(al.mana) });
            fx(u, 'pane', { tg: tg.uid, tgs: [al.uid] });
          }
        });
        break;
      }
      case 'badtrip': {
        const hits = adjEnemies(u);
        ev({ tgs: hits.map((e) => e.uid) });
        later(330, () => { for (const e of hits) { hit(e); push(u, e); stun(e, 1500); } });
        break;
      }
      case 'espelho': {
        const a0 = alliesOf(u).sort((p, q) => p.hp / p.maxHp - q.hp / q.maxHp)[0];
        ev({ tg: a0?.uid });
        if (a0) later(250, () => { addShield(a0, v, 4000); a0.reflectUntil = t + 4000; a0.reflectPct = x / 100; status(a0, 'reflect', 4000); });
        break;
      }
      case 'colheita': {
        const hits = adjEnemies(u);
        ev({ tgs: hits.map((e) => e.uid) });
        later(260, () => {
          for (const e of hits) {
            hit(e);
            if (e.alive && e.hp < e.maxHp * (x / 100)) {
              fx(u, 'colheita', { tg: e.uid });
              damage(u, e, e.hp + e.shield + 1, 'true', 'proc');
            }
          }
        });
        break;
      }
      case 'sirene': {
        if (!tg) { ev(); break; }
        const { hits, end } = lineFrom(tg);
        ev({ tg: tg.uid, tgs: hits.map((e) => e.uid), r: end[0], c: end[1] });
        later(250, () => { for (const e of hits) { hit(e); if (e.alive) { e.silenceUntil = t + 3000; status(e, 'silence', 3000); } } });
        break;
      }

      // ---------------- custo 5 ----------------
      case 'vibracao': {
        const allies = alliesOf(u);
        ev({ tgs: allies.map((p) => p.uid) });
        for (const al of allies) { addShield(al, v, ab.duration ?? 5000); cleanse(al); }
        break;
      }
      case 'bigbang': {
        if (!tg) { ev(); break; }
        const r0 = tg.r, c0 = tg.c;
        ev({ tg: tg.uid, r: r0, c: c0 });
        later(380, () => { for (const e of adjEnemies({ r: r0, c: c0 }, ab.radius ?? 2)) { hit(e); stun(e, ab.duration ?? 1500); } });
        for (let i = 0; i < 2; i++) {
          later(900 + i * 450, () => {
            const es = enemiesOf(u);
            if (!es.length) return;
            const p = es[Math.floor(rng() * es.length)];
            const pr = p.r, pc = p.c;
            fx(u, 'bigbang', { r: pr, c: pc, n: i + 1 });
            later(380, () => { for (const e of adjEnemies({ r: pr, c: pc }, 1)) hit(e, (v * x) / 100); });
          });
        }
        break;
      }
      case 'seiva': {
        const allies = alliesOf(u);
        ev({ tgs: allies.map((p) => p.uid) });
        for (const al of allies) heal(al, v);
        if (u.summons < 2) { u.summons++; later(300, () => { if (u.alive) summonMuda(u, x); }); }
        break;
      }
      case 'festa': {
        const allies = alliesOf(u);
        const dur = ab.duration ?? 6000;
        const es = enemiesOf(u);
        ev({ tgs: es.map((e) => e.uid), n: allies.length });
        for (const al of allies) {
          al.buffAS = Math.max(al.buffUntil > t ? al.buffAS : 0, base / 100);
          al.buffUntil = t + dur;
          events.push({ t, k: 'buff', u: al.uid, dur });
        }
        later(350, () => { for (const e of es) hit(e, (x / 100) * adOf(u), 'phys'); });
        break;
      }
      case 'apagao': {
        if (!tg) { ev(); break; }
        const hits = adjEnemies(tg, ab.radius ?? 2);
        ev({ tg: tg.uid, tgs: hits.map((e) => e.uid), r: tg.r, c: tg.c });
        u.stealthUntil = t + 1500; status(u, 'stealth', 1500);
        later(300, () => { for (const e of hits) { hit(e); if (e.alive) { e.blindUntil = t + 2000; status(e, 'blind', 2000); } } });
        break;
      }
      case 'buraconegro': {
        const center = clusterCenter(u, 2) ?? tg;
        if (!center) { ev(); break; }
        const r0 = center.r, c0 = center.c;
        const hits = adjEnemies({ r: r0, c: c0 }, ab.radius ?? 2);
        ev({ tg: center.uid, tgs: hits.map((e) => e.uid), r: r0, c: c0 });
        later(400, () => {
          for (const e of byDist({ r: r0, c: c0 }, hits)) {
            if (!e.alive || hexDist(e.r, e.c, r0, c0) <= 1) continue;
            const spots = neighbors(r0, c0).filter(([r, c]) => !occupied(r, c))
              .sort((p, q) => hexDist(e.r, e.c, p[0], p[1]) - hexDist(e.r, e.c, q[0], q[1]));
            if (spots.length) moveTo(e, spots[0][0], spots[0][1], 'dash');
          }
        });
        later(800, () => { for (const e of hits) { hit(e); stun(e, 1500); } });
        break;
      }
      case 'marreta': {
        if (!tg) { ev(); break; }
        const adj = enemiesOf(u).filter((e) => e !== tg && dist(e, tg) <= 1);
        ev({ tg: tg.uid, tgs: adj.map((e) => e.uid) });
        u.adPct += x / 100;
        later(300, () => {
          hit(tg);
          for (const e of adj) { hit(e, v / 2); push(tg, e); }
        });
        break;
      }
      default:
        ev();
    }
    if (u.has.has('coroa')) u.mana = 10;
    if (u.neonMana > 0) u.mana = Math.min(u.maxMana - 1, u.mana + u.neonMana);
    if (u.has.has('turbo')) { u.turboUntil = t + 5000; proc(u, 'turbo'); }
    void vAP;
  };

  const splash = (u: CU, tg: CU, pct: number, tag: AbilityKind | null) => {
    const around = enemiesOf(u).filter((e) => e !== tg && dist(e, tg) <= 1);
    if (!around.length) return;
    if (tag) fx(u, tag, { tg: tg.uid, tgs: around.map((e) => e.uid) });
    for (const e of around) damage(u, e, adOf(u) * pct, 'phys', 'proc', true);
  };

  const attack = (u: CU, tg: CU) => {
    const gain = 10 + (u.has.has('cristal') ? 5 : 0);
    gainMana(u, gain);
    events.push({ t, k: 'atk', u: u.uid, tg: tg.uid, mana: Math.round(u.mana) });
    u.atkCount++;
    if (u.blindUntil > t) {
      events.push({ t, k: 'dmg', u: tg.uid, amt: 0, hp: Math.round(tg.hp), sh: Math.round(tg.shield), mana: Math.round(tg.mana), miss: true });
      return;
    }
    const ad = adOf(u);
    damage(u, tg, ad, 'phys', 'atk', true);
    if (u.has.has('mira') && tg.alive) tg.armorShredUntil = t + 3000;
    if (u.has.has('megaseda')) u.asPct += 0.05;
    if (u.has.has('coleteseda')) u.coleteStacks = Math.min(0.25, u.coleteStacks + 0.02);
    if (u.popAttacks > 0) { u.popAttacks--; splash(u, tg, u.popPct, 'estouro'); }
    if (u.piradoPct > 0 && u.atkCount % 3 === 0) splash(u, tg, u.piradoPct, null);
    if (u.hyperUntil > t) {
      const other = byDist(tg, enemiesOf(u).filter((e) => e !== tg && targetable(e)))[0];
      if (other) { fx(u, 'hiperespaco', { tg: other.uid }); damage(u, other, ad * 0.6, 'phys', 'proc', true); }
    }
    if (u.has.has('rede')) {
      const other = enemiesOf(u).filter((e) => e !== tg).sort((x, y) => dist(tg, x) - dist(tg, y))[0];
      if (other && dist(tg, other) <= 2) {
        proc(u, 'rede', [other.uid]);
        damage(u, other, ad * 0.55, 'phys', 'proc', true);
      }
    }
    if (u.has.has('tocha') && u.atkCount % 3 === 0) {
      const zapped = [tg, ...enemiesOf(u).filter((e) => e !== tg).sort((x, y) => dist(tg, x) - dist(tg, y))].filter((e) => e.alive).slice(0, 3);
      proc(u, 'tocha', zapped.map((e) => e.uid));
      for (const e of zapped) { e.mrShredUntil = t + 5000; damage(u, e, 70, 'magic', 'proc'); }
    }
  };

  /** BFS: primeiro passo em direção a um hex dentro do alcance do alvo. */
  const stepToward = (u: CU, tg: CU): [number, number] | null => {
    const key = (r: number, c: number) => r * COLS + c;
    const prev = new Map<number, number>();
    const start = key(u.r, u.c);
    prev.set(start, -1);
    const queue: [number, number][] = [[u.r, u.c]];
    while (queue.length) {
      const [r, c] = queue.shift()!;
      if (!(r === u.r && c === u.c) && hexDist(r, c, tg.r, tg.c) <= u.range) {
        let k = key(r, c);
        while (prev.get(k) !== start) k = prev.get(k)!;
        return [Math.floor(k / COLS), k % COLS];
      }
      for (const [nr, nc] of neighbors(r, c)) {
        const nk = key(nr, nc);
        if (prev.has(nk) || occupied(nr, nc)) continue;
        prev.set(nk, key(r, c));
        queue.push([nr, nc]);
      }
    }
    return null;
  };

  // ---- saltos dos assassinos ----
  const doJumps = () => {
    for (const u of units) {
      if (!u.alive || !u.jumper) continue;
      const enemies = enemiesOf(u).filter(targetable);
      if (!enemies.length) continue;
      enemies.sort((x, y) => (u.side === 0 ? x.r - y.r : y.r - x.r) || x.uid - y.uid);
      const back = enemies[0];
      const spots = neighbors(back.r, back.c).filter(([r, c]) => !occupied(r, c));
      if (!spots.length) continue;
      spots.sort((p, q) => (u.side === 0 ? p[0] - q[0] : q[0] - p[0]));
      const [r, c] = spots[0];
      u.target = back;
      u.nextAct = t + 450;
      moveTo(u, r, c, 'jump');
    }
  };

  let lastSecond = 0;
  let jumped = false;

  const sideAlive = (s: 0 | 1) => units.some((u) => u.alive && u.side === s && !u.summon) ;

  while (t < MAX_T && sideAlive(0) && sideAlive(1)) {
    t += TICK;
    if (!jumped && t >= 200) { doJumps(); jumped = true; }

    // ações agendadas
    if (tasks.length) {
      const due = tasks.filter((k) => k.at <= t);
      if (due.length) {
        for (let i = tasks.length - 1; i >= 0; i--) if (tasks[i].at <= t) tasks.splice(i, 1);
        for (const k of due) k.fn();
      }
    }

    // efeitos por segundo
    if (t - lastSecond >= 1000) {
      lastSecond = t;
      const sec = Math.round(t / 1000);
      for (const u of units) {
        if (!u.alive) continue;
        if (u.regen > 0 && u.hp < u.maxHp) heal(u, (u.maxHp * u.regen) / 100);
        if (u.manaRegen > 0 && u.mana < u.maxMana && u.silenceUntil <= t) {
          u.mana = Math.min(u.maxMana, u.mana + u.manaRegen);
          events.push({ t, k: 'mana', u: u.uid, mana: Math.round(u.mana) });
        }
        if (u.dots.length) {
          u.dots = u.dots.filter((d) => d.until > t - 1);
          for (const d of [...u.dots]) { if (u.alive) damage(d.src, u, d.dps, d.type, 'proc'); }
        }
        if (!u.alive) continue;
        if (!u.escudoDone && (t >= 8000 || u.shield <= 0)) {
          u.escudoDone = true;
          u.ap += 30;
          proc(u, 'escudocosmico');
        }
        if (sec % 2 === 0) {
          if (u.has.has('mochila') && u.hp < u.maxHp) heal(u, (u.maxHp - u.hp) * 0.05);
          if (u.has.has('chapeu') && u.hp < u.maxHp) heal(u, u.maxHp * 0.05);
          if (u.has.has('tenis')) u.asPct += 0.03;
          if (u.has.has('parachoque')) {
            const adj = enemiesOf(u).filter((e) => dist(e, u) <= 1);
            if (adj.length) {
              proc(u, 'parachoque', adj.map((e) => e.uid));
              for (const e of adj) { e.healCutUntil = Math.max(e.healCutUntil, t + 3000); damage(u, e, 60, 'magic', 'proc'); }
            }
          }
        }
        if (sec % 5 === 0) {
          if (u.has.has('garrafa')) { u.ap += 20; proc(u, 'garrafa'); }
          if (u.has.has('radio')) {
            proc(u, 'radio', alliesOf(u).map((x) => x.uid));
            for (const al of alliesOf(u)) if (al.hp < al.maxHp) heal(al, (al.maxHp - al.hp) * 0.12);
          }
        }
      }
    }

    for (const u of units) {
      if (!u.alive) continue;
      if (t < u.stunUntil || t < u.nextAct) continue;
      if (!sideAlive(u.side === 0 ? 1 : 0)) break;

      // provocação: só ataca quem provocou
      if (u.tauntUntil > t && u.tauntBy?.alive) u.target = u.tauntBy;
      // alvo
      else if (!u.target || !targetable(u.target) || dist(u, u.target) > u.range) {
        const n = nearestEnemy(u);
        if (u.target && targetable(u.target) && n && dist(u, n) >= dist(u, u.target)) {
          // mantém alvo atual e persegue
        } else u.target = n;
      }
      const tg = u.target;
      if (!tg) { u.nextAct = t + 150; continue; }

      if (u.mana >= u.maxMana && u.def.ability.kind !== 'none' && u.def.ability.kind !== 'mudinha') {
        if (NO_RANGE.has(u.def.ability.kind) || dist(u, tg) <= u.range + (u.range > 1 ? 1 : 0)) {
          cast(u);
          continue;
        }
      }

      if (dist(u, tg) <= u.range) {
        attack(u, tg);
        u.nextAct = t + Math.max(180, Math.round(1000 / asOf(u)));
      } else {
        const step = stepToward(u, tg);
        if (step) {
          u.r = step[0]; u.c = step[1];
          events.push({ t, k: 'move', u: u.uid, r: u.r, c: u.c });
          u.nextAct = t + MOVE_TIME;
        } else {
          const others = enemiesOf(u).filter((e) => e !== tg && targetable(e)).sort((x, y) => dist(u, x) - dist(u, y));
          let moved = false;
          for (const o of others) {
            if (dist(u, o) <= u.range) { u.target = o; moved = true; break; }
            const s = stepToward(u, o);
            if (s) {
              u.target = o; u.r = s[0]; u.c = s[1];
              events.push({ t, k: 'move', u: u.uid, r: u.r, c: u.c });
              u.nextAct = t + MOVE_TIME;
              moved = true;
              break;
            }
          }
          if (!moved) u.nextAct = t + 200;
        }
      }
    }
  }

  const a0 = sideAlive(0), a1 = sideAlive(1);
  const winner: 0 | 1 | -1 = a0 && !a1 ? 0 : a1 && !a0 ? 1 : -1;
  const survivors = units.filter((u) => u.alive && !u.summon).map((u) => ({ side: u.side, star: u.star, cost: u.def.cost }));
  return { units: init, events, duration: t, winner, survivors };
}

export { COMBAT_ROWS };
