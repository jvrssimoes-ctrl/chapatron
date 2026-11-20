import { AD_STAR_MULT, BASE_CRIT, BASE_CRIT_DMG, HP_STAR_MULT, TRAITS, UNITS } from '../shared/data';
import { COLS, COMBAT_ROWS, hexDist, localToCombat, neighbors } from '../shared/hex';
import { COMPLETED, ITEMS } from '../shared/items';
import { traitBonus } from '../shared/augments';
import { computeTraits } from '../shared/traits';
import type { CombatEvent, CombatResult, CombatUnitInit, TraitId, UnitDef } from '../shared/types';

export interface SideUnit { defId: string; star: number; r: number; c: number; items?: string[] } // coords locais
export interface SideInput { units: SideUnit[]; augments?: string[] }

const TICK = 50;
const MAX_T = 45000;
const MOVE_TIME = 420;
const FOREVER = 1e9;
const OVERTIME_T = 22000;

type DmgType = 'phys' | 'magic' | 'true';
type DmgKind = 'atk' | 'ability' | 'proc';

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
  burnUntil: number;
  burnPerSec: number;
  burnSrc: CU | null;
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

export function simulate(a: SideInput, b: SideInput, seed: number): CombatResult {
  const rng = mulberry32(seed);
  const units: CU[] = [];
  const events: CombatEvent[] = [];
  let uid = 1;
  let t = 0;

  const hackedSides = new Set<0 | 1>();
  const build = (side: 0 | 1, input: SideInput) => {
    const list = input.units;
    const augs = new Set(input.augments ?? []);
    const traits = computeTraits(list.map((x) => x.defId), traitBonus(input.augments ?? []));
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

    for (const su of list) {
      const def = UNITS[su.defId];
      if (!def) continue;
      const star = Math.max(1, Math.min(3, su.star));
      const [r, c] = localToCombat(su.r, su.c, side);
      const hasT = (t: TraitId) => def.traits.includes(t);

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
      const has = new Set(items);

      let maxHp = def.hp * HP_STAR_MULT[star - 1] + st.hp;
      if (hasT('tanque')) maxHp += val('tanque');
      if (augs.has('linhafrente') && su.r <= 1) maxHp += 250;
      if (augs.has('pazinterior')) maxHp += 150;
      if (has.has('marmita')) maxHp *= 1.12;

      const sorr = hasT('sorrateiro') ? val('sorrateiro') / 100 : 0;
      const cu: CU = {
        uid: uid++, side, def, star, r, c, localR: su.r, items, has,
        hp: maxHp, maxHp,
        baseAd: def.atk * AD_STAR_MULT[star - 1],
        adPct: st.ad / 100 + (augs.has('furia') ? 0.15 : 0),
        as: def.as,
        asPct: st.as / 100 + (hasT('atirador') ? val('atirador') / 100 : 0) + teamAS,
        range: def.range,
        armor: def.armor + teamRes + st.armor,
        mr: def.mr + teamRes + st.mr,
        mana: def.startMana + st.mana + (hasT('hacker') ? val('hacker') : 0) + (augs.has('manainf') ? 20 : 0),
        maxMana: Math.max(20, def.mana - (has.has('coroa') ? 10 : 0)),
        shield: teamShield, shieldUntil: teamShield > 0 ? FOREVER : 0,
        stunUntil: 0,
        stunImmuneUntil: has.has('tenis') ? 15000 : 0,
        nextAct: 300 + Math.floor(rng() * 300),
        target: null,
        alive: true,
        dodge: hasT('fumaceiro') ? val('fumaceiro') / 100 : 0,
        crit: BASE_CRIT / 100 + st.crit / 100 + sorr + (augs.has('golpecrit') ? 0.15 : 0),
        critDmg: 1 + BASE_CRIT_DMG / 100 + sorr + (has.has('tesoura') ? 0.15 : 0),
        abilityCrit: has.has('tesoura') || has.has('luvaarcana'),
        ap: 100 + st.ap + (hasT('brisa') ? val('brisa') : 0) + (hasT('cosmico') ? extra('cosmico') : 0) + (augs.has('menteexp') ? 15 : 0),
        omnivamp: (augs.has('vampiro') ? 0.12 : 0) + (has.has('isqueiroplasma') ? 0.2 : 0) + (has.has('facaeletrica') ? 0.12 : 0) + (has.has('maodestino') ? 0.15 : 0),
        regen: (hasT('verdinho') ? val('verdinho') : 0) + (augs.has('laricacol') ? 1 : 0),
        manaRegen: hasT('cosmico') ? val('cosmico') : 0,
        killHeal: hasT('larica') ? val('larica') : 0,
        killAS: hasT('larica') ? extra('larica') / 100 : 0,
        recycle: hasT('reciclado') ? val('reciclado') / 100 : 0,
        dmgAmp: (has.has('lancachamas') ? 0.2 : 0) + (has.has('maodestino') ? 0.15 : 0)
          + (augs.has('brisalend') ? 0.25 : 0) + (augs.has('artilharia') && su.r >= 2 ? 0.2 : 0),
        buffAS: 0, buffUntil: 0, turboUntil: 0,
        armorShredUntil: 0, mrShredUntil: 0, healCutUntil: 0,
        burnUntil: 0, burnPerSec: 0, burnSrc: null,
        atkCount: 0, coleteStacks: 0, thornsReadyAt: 0,
        tampaDone: false, facaDone: false, escudoDone: !has.has('escudocosmico'),
        jumper: def.role === 'assassin',
        manaFromHits: def.role === 'tank' ? 1.5 : 1,
        abilityAmp: hasT('neon') ? val('neon') / 100 : 0,
        neonMana: hasT('neon') ? extra('neon') : 0,
        paraAS: hasT('paranoico') ? val('paranoico') / 100 : 0,
        paraDone: false,
        invulnUntil: 0,
      };
      if (has.has('escudocosmico')) {
        cu.shield += cu.maxHp * 0.3;
        cu.shieldUntil = cu.shieldUntil === FOREVER ? FOREVER : 8000;
      }
      units.push(cu);
    }
  };
  build(0, a);
  build(1, b);
  // hackers: o lado invadido começa sem mana
  for (const cu of units) if (hackedSides.has(cu.side)) cu.mana = 0;
  // Caixa de Som: aliados na mesma fileira
  for (const cu of units) {
    if (!cu.has.has('caixadesom')) continue;
    for (const al of units) if (al.side === cu.side && al.r === cu.r) al.asPct += 0.15;
  }

  const init: CombatUnitInit[] = units.map((u) => ({
    uid: u.uid, defId: u.def.id, star: u.star, side: u.side, r: u.r, c: u.c,
    hp: Math.round(u.hp), maxHp: Math.round(u.maxHp), mana: Math.round(u.mana), maxMana: u.maxMana,
    shield: Math.round(u.shield), items: u.items,
  }));

  const occupied = (r: number, c: number) => units.some((u) => u.alive && u.r === r && u.c === c);
  const enemiesOf = (u: CU) => units.filter((x) => x.alive && x.side !== u.side);
  const alliesOf = (u: CU) => units.filter((x) => x.alive && x.side === u.side);
  const dist = (x: CU, y: CU) => hexDist(x.r, x.c, y.r, y.c);
  const auraNear = (u: CU, item: string) => units.some((x) => x.alive && x.side !== u.side && x.has.has(item) && dist(x, u) <= 2);

  const adOf = (u: CU) => {
    let pct = u.adPct + u.coleteStacks;
    if (u.has.has('pocheteraivosa') && u.hp < u.maxHp * 0.6) pct += 0.4;
    return u.baseAd * (1 + pct);
  };
  const apOf = (u: CU) => u.ap * (1 + u.coleteStacks);
  const asOf = (u: CU) => {
    let bonus = u.asPct + (u.buffUntil > t ? u.buffAS : 0) + (u.turboUntil > t ? 0.6 : 0);
    if (auraNear(u, 'manto')) bonus -= 0.2;
    return u.as * Math.max(0.3, 1 + bonus);
  };
  const armorOf = (u: CU) => {
    let a = u.armor;
    if (u.has.has('cadeado')) a += 12 * units.filter((x) => x.alive && x.side !== u.side && x.target === u).length;
    let shred = 0;
    if (u.armorShredUntil > t) shred = 0.3;
    if (auraNear(u, 'abafador')) shred = Math.max(shred, 0.3);
    return a * (1 - shred);
  };
  const mrOf = (u: CU) => {
    let m = u.mr;
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
      const d = dist(u, e);
      if (d < bd || (d === bd && best && e.uid < best.uid)) { bd = d; best = e; }
    }
    return best;
  };

  const proc = (u: CU, item: string, tgs?: number[]) => events.push({ t, k: 'proc', u: u.uid, item, tgs });

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
  };

  const heal = (tgt: CU, amount: number) => {
    if (!tgt.alive) return;
    if (tgt.healCutUntil > t) amount *= 0.67;
    const before = tgt.hp;
    tgt.hp = Math.min(tgt.maxHp, tgt.hp + amount);
    const amt = Math.round(tgt.hp - before);
    if (amt > 0) events.push({ t, k: 'heal', u: tgt.uid, amt, hp: Math.round(tgt.hp) });
  };

  const addShield = (tgt: CU, amount: number, dur: number) => {
    if (!tgt.alive) return;
    tgt.shield = (tgt.shieldUntil > t ? tgt.shield : 0) + amount;
    tgt.shieldUntil = Math.max(tgt.shieldUntil, t + dur);
    events.push({ t, k: 'shield', u: tgt.uid, sh: Math.round(tgt.shield) });
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

  const damage = (src: CU | null, tgt: CU, raw: number, type: DmgType, kind: DmgKind, canCrit = false) => {
    if (!tgt.alive) return 0;
    if (kind === 'atk' && tgt.dodge > 0 && rng() < tgt.dodge) {
      events.push({ t, k: 'dmg', u: tgt.uid, amt: 0, hp: Math.round(tgt.hp), sh: Math.round(tgt.shield), mana: Math.round(tgt.mana), dodge: true });
      return 0;
    }
    if (tgt.invulnUntil > t) return 0;
    if (tgt.shieldUntil <= t) tgt.shield = 0;
    // "a brisa bateu": dano cresce no fim para não arrastar
    let amp = 1 + (src?.dmgAmp ?? 0) + (kind === 'ability' ? src?.abilityAmp ?? 0 : 0);
    if (src?.has.has('bazuca') && tgt.maxHp > GIANT_HP) amp += 0.25;
    if (src?.has.has('maleta') && tgt.shield > 0) amp += 0.2;
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
    if (kind !== 'proc') {
      tgt.mana = Math.min(tgt.maxMana, tgt.mana + Math.min(15, (pre * 0.01 + amount * 0.03) * tgt.manaFromHits));
    }
    events.push({
      t, k: 'dmg', u: tgt.uid, amt: Math.round(amount), hp: Math.max(0, Math.round(tgt.hp)),
      sh: Math.round(tgt.shield), mana: Math.round(tgt.mana), crit: crit || undefined, magic: type !== 'phys' || undefined,
      s: src?.uid,
    });
    if (src && src.alive && src.omnivamp > 0) heal(src, amount * src.omnivamp);
    if (src && kind !== 'proc' && src.has.has('morteiro')) {
      tgt.burnUntil = t + 5000;
      tgt.burnPerSec = tgt.maxHp * 0.02;
      tgt.burnSrc = src;
      tgt.healCutUntil = Math.max(tgt.healCutUntil, t + 5000);
    }
    // Caixa d'Água: espinhos
    if (kind === 'atk' && tgt.has.has('caixadagua') && t >= tgt.thornsReadyAt && tgt.hp > 0) {
      tgt.thornsReadyAt = t + 2000;
      const adj = enemiesOf(tgt).filter((e) => dist(e, tgt) <= 1);
      proc(tgt, 'caixadagua', adj.map((e) => e.uid));
      for (const e of adj) damage(tgt, e, 80, 'magic', 'proc');
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

  const SELF_CAST = new Set(['shield', 'buffAS', 'heal', 'teamHeal', 'teamAS', 'teamShield', 'aoeStun']);

  const cast = (u: CU) => {
    const ab = u.def.ability;
    const base = ab.values[u.star - 1];
    const isAD = ab.scale === 'ad';
    const v = isAD ? (base / 100) * adOf(u) : (base * apOf(u)) / 100;
    const dtype: DmgType = isAD ? 'phys' : 'magic';
    const tg = u.target && u.target.alive ? u.target : nearestEnemy(u);
    u.mana = 0;
    const hit = (e: CU, val = v) => damage(u, e, val, dtype, 'ability', u.abilityCrit);
    switch (ab.kind) {
      case 'shield':
        events.push({ t, k: 'cast', u: u.uid, ab: ab.kind });
        addShield(u, v, ab.duration ?? 4000);
        break;
      case 'buffAS':
        events.push({ t, k: 'cast', u: u.uid, ab: ab.kind });
        u.buffAS = base / 100;
        u.buffUntil = t + (ab.duration ?? 4000);
        events.push({ t, k: 'buff', u: u.uid, dur: ab.duration ?? 4000 });
        break;
      case 'heal': {
        const allies = alliesOf(u).sort((x, y) => x.hp / x.maxHp - y.hp / y.maxHp);
        const a0 = allies[0];
        events.push({ t, k: 'cast', u: u.uid, ab: ab.kind, tg: a0?.uid });
        if (a0) heal(a0, v);
        break;
      }
      case 'teamHeal': {
        const allies = alliesOf(u);
        events.push({ t, k: 'cast', u: u.uid, ab: ab.kind, tgs: allies.map((x) => x.uid) });
        for (const al of allies) heal(al, v);
        break;
      }
      case 'teamAS': {
        const allies = alliesOf(u);
        const dur = ab.duration ?? 4000;
        events.push({ t, k: 'cast', u: u.uid, ab: ab.kind, tgs: allies.map((x) => x.uid) });
        for (const al of allies) {
          al.buffAS = Math.max(al.buffUntil > t ? al.buffAS : 0, base / 100);
          al.buffUntil = t + dur;
          events.push({ t, k: 'buff', u: al.uid, dur });
        }
        break;
      }
      case 'teamShield': {
        const allies = alliesOf(u);
        events.push({ t, k: 'cast', u: u.uid, ab: ab.kind, tgs: allies.map((x) => x.uid) });
        for (const al of allies) addShield(al, v, ab.duration ?? 5000);
        break;
      }
      case 'aoeStun': {
        const rad = ab.radius ?? 1;
        const hits = enemiesOf(u).filter((e) => dist(u, e) <= rad);
        events.push({ t, k: 'cast', u: u.uid, ab: ab.kind, tgs: hits.map((x) => x.uid) });
        for (const e of hits) { hit(e); stun(e, ab.duration ?? 1500); }
        break;
      }
      default: {
        if (!tg) { events.push({ t, k: 'cast', u: u.uid, ab: ab.kind }); break; }
        if (ab.kind === 'multishot') {
          const n = ab.count ?? 2;
          const hits = [tg, ...enemiesOf(u).filter((e) => e !== tg).sort((x, y) => dist(tg, x) - dist(tg, y) || x.uid - y.uid)].slice(0, n);
          events.push({ t, k: 'cast', u: u.uid, ab: ab.kind, tg: tg.uid, tgs: hits.map((x) => x.uid) });
          for (const e of hits) hit(e);
        } else if (ab.kind === 'aoe' || ab.kind === 'meteor') {
          const rad = ab.radius ?? 1;
          const hits = enemiesOf(u).filter((e) => dist(tg, e) <= rad);
          events.push({ t, k: 'cast', u: u.uid, ab: ab.kind, tg: tg.uid, tgs: hits.map((x) => x.uid) });
          for (const e of hits) {
            hit(e);
            if (ab.kind === 'meteor') stun(e, ab.duration ?? 1500);
          }
        } else {
          events.push({ t, k: 'cast', u: u.uid, ab: ab.kind, tg: tg.uid });
          const dealt = hit(tg);
          if (ab.kind === 'drain') heal(u, dealt > 0 ? Math.max(dealt, v * 0.5) : v * 0.5);
          if (ab.kind === 'stun') stun(tg, ab.duration ?? 1500);
        }
      }
    }
    if (u.has.has('coroa')) u.mana = 10;
    if (u.neonMana > 0) u.mana = Math.min(u.maxMana - 1, u.mana + u.neonMana);
    if (u.has.has('turbo')) { u.turboUntil = t + 5000; proc(u, 'turbo'); }
    u.nextAct = t + 400;
  };

  const attack = (u: CU, tg: CU) => {
    const gain = 10 + (u.has.has('cristal') ? 5 : 0);
    u.mana = Math.min(u.maxMana, u.mana + gain);
    events.push({ t, k: 'atk', u: u.uid, tg: tg.uid, mana: Math.round(u.mana) });
    u.atkCount++;
    const ad = adOf(u);
    damage(u, tg, ad, 'phys', 'atk', true);
    if (u.has.has('mira') && tg.alive) tg.armorShredUntil = t + 3000;
    if (u.has.has('megaseda')) u.asPct += 0.05;
    if (u.has.has('coleteseda')) u.coleteStacks = Math.min(0.25, u.coleteStacks + 0.02);
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
      const enemies = enemiesOf(u);
      if (!enemies.length) continue;
      enemies.sort((x, y) => (u.side === 0 ? x.r - y.r : y.r - x.r) || x.uid - y.uid);
      const back = enemies[0];
      const spots = neighbors(back.r, back.c).filter(([r, c]) => !occupied(r, c));
      if (!spots.length) continue;
      spots.sort((p, q) => (u.side === 0 ? p[0] - q[0] : q[0] - p[0]));
      const [r, c] = spots[0];
      u.r = r; u.c = c;
      u.target = back;
      u.nextAct = t + 450;
      events.push({ t, k: 'move', u: u.uid, r, c, jump: true });
    }
  };

  let lastSecond = 0;
  let jumped = false;

  const sideAlive = (s: 0 | 1) => units.some((u) => u.alive && u.side === s);

  while (t < MAX_T && sideAlive(0) && sideAlive(1)) {
    t += TICK;
    if (!jumped && t >= 200) { doJumps(); jumped = true; }

    // efeitos por segundo
    if (t - lastSecond >= 1000) {
      lastSecond = t;
      const sec = Math.round(t / 1000);
      for (const u of units) {
        if (!u.alive) continue;
        if (u.regen > 0 && u.hp < u.maxHp) heal(u, (u.maxHp * u.regen) / 100);
        if (u.manaRegen > 0 && u.mana < u.maxMana) {
          u.mana = Math.min(u.maxMana, u.mana + u.manaRegen);
          events.push({ t, k: 'mana', u: u.uid, mana: Math.round(u.mana) });
        }
        if (u.burnUntil > t && u.burnSrc) damage(u.burnSrc, u, u.burnPerSec, 'true', 'proc');
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

      // alvo
      if (!u.target || !u.target.alive || dist(u, u.target) > u.range) {
        const n = nearestEnemy(u);
        if (u.target && u.target.alive && n && dist(u, n) >= dist(u, u.target)) {
          // mantém alvo atual e persegue
        } else u.target = n;
      }
      const tg = u.target;
      if (!tg) continue;

      if (u.mana >= u.maxMana) {
        const ab = u.def.ability;
        if (SELF_CAST.has(ab.kind) || dist(u, tg) <= u.range + (u.range > 1 ? 1 : 0)) {
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
          const others = enemiesOf(u).filter((e) => e !== tg).sort((x, y) => dist(u, x) - dist(u, y));
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
  const survivors = units.filter((u) => u.alive).map((u) => ({ side: u.side, star: u.star, cost: u.def.cost }));
  return { units: init, events, duration: t, winner, survivors };
}

export { COMBAT_ROWS };
