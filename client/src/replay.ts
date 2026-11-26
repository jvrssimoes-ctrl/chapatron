import { UNITS } from '../../shared/data';
import { ITEMS } from '../../shared/items';
import { flip, lineHexes } from '../../shared/hex';
import type { AbilityKind, CombatEvent, CombatUnitInit, FxKind, StatusKind } from '../../shared/types';
import { sfx } from './sfx';

// Reprodução do combate a partir da lista de eventos do servidor. Independente do renderizador.

export interface RU {
  init: CombatUnitInit;
  mine: boolean;
  r: number; c: number;
  fr: number; fc: number;
  moveStart: number; moveDur: number; jump: boolean; arc: number;
  hp: number; maxHp: number; mana: number; maxMana: number; shield: number;
  alive: boolean; deathAt: number;
  flashAt: number; stunUntil: number; buffUntil: number; stealthUntil: number; spawnAt: number;
  lungeAt: number; lungeTo: number | null; castAt: number; castKind: FxKind | null; castColor: string;
  shotAt: number; atkCount: number; hitAt: number;
  tg: number | null;
  /** status ativos (até quando) para os ícones em cima da barra */
  st: Partial<Record<StatusKind | 'stun' | 'buff', number>>;
}

/** Ícones dos status mostrados ao lado da barra de vida. */
export const STATUS_ICON: Partial<Record<StatusKind | 'stun' | 'buff', string>> = {
  stun: '💫', burn: '🔥', blind: '🙈', slow: '🐌', silence: '🔇', mark: '🎯', taunt: '😠', virus: '🦠',
  reflect: '🪞', rage: '💢', dodge: '💨', stealth: '👻', buff: '⏫',
};
const NEGATIVE: (StatusKind | 'stun')[] = ['stun', 'burn', 'blind', 'slow', 'silence', 'mark', 'taunt', 'virus'];

export type Effect =
  | { k: 'proj'; from: number; to: number; start: number; dur: number; color: string; big?: boolean; bolt?: boolean; fromCast?: boolean }
  | { k: 'zap'; from: number; to: number; start: number; dur: number; color: string }
  | { k: 'ring'; r: number; c: number; start: number; dur: number; color: string; rad: number }
  | { k: 'puff'; r: number; c: number; start: number; dur: number; seed: number; big?: boolean }
  | { k: 'text'; u: number; text: string; color: string; start: number; dur: number; size: number; dx: number }
  | { k: 'beam'; from: number; to: number; start: number; dur: number; color: string }
  | { k: 'meteor'; r: number; c: number; start: number; dur: number }
  | { k: 'label'; u: number; text: string; start: number; dur: number }
  // efeitos de habilidade (client/src/three/vfx.ts)
  | { k: 'rune'; u?: number; r?: number; c?: number; start: number; dur: number; color: string; rad: number }
  | { k: 'nova'; u?: number; r?: number; c?: number; start: number; dur: number; color: string; rad: number }
  | { k: 'pillar'; u: number; start: number; dur: number; color: string }
  | { k: 'bubble'; u: number; start: number; dur: number; color: string }
  | { k: 'drain'; from: number; to: number; start: number; dur: number; color: string }
  | { k: 'strike'; u: number; start: number; dur: number; color: string }
  | { k: 'slam'; u?: number; r?: number; c?: number; start: number; dur: number; color: string; rad: number }
  | { k: 'swirl'; u: number; start: number; dur: number; color: string }
  | { k: 'plus'; u: number; start: number; dur: number };

export const AB_COLOR: Record<FxKind, string> = {
  shield: '#7ad7ff', multishot: '#ffe066', drain: '#ff5d73', heal: '#5dff7a', buffAS: '#ffcf5d',
  nuke: '#d27aff', stun: '#ffe066', aoe: '#b9b3d6', teamHeal: '#5dff7a', aoeStun: '#9f97d8',
  teamShield: '#7ad7ff', meteor: '#ff8a3d', teamAS: '#ff5d9e',
};

const STATUS_TEXT: Partial<Record<StatusKind, [string, string]>> = {
  blind: ['cego!', '#c9c2ff'], slow: ['grudado', '#ff9de0'], mark: ['👁️ marcado', '#ff9d3d'], taunt: ['😠', '#ff5d5d'],
  silence: ['🔇 calado', '#9fe8ff'], virus: ['🦠', '#3dffb0'], cleanse: ['✨ limpo', '#ffffff'], rage: ['💢', '#ff6b3d'],
  reflect: ['🪞', '#ffe9a8'], dodge: ['💨 esquiva', '#c9c2ff'],
};

export class Replay {
  units = new Map<number, RU>();
  fx: Effect[] = [];
  idx = 0;
  ended = false;
  shake = 0;

  constructor(public events: CombatEvent[], init: CombatUnitInit[], public mySide: 0 | 1, public start: number, public duration: number, public winner: number) {
    for (const u of init) this.addUnit(u, -1e9);
  }

  private addUnit(u: CombatUnitInit, at: number) {
    const [r, c] = this.view(u.r, u.c);
    this.units.set(u.uid, {
      init: u, mine: u.side === this.mySide, r, c, fr: r, fc: c, moveStart: 0, moveDur: 1, jump: false, arc: 0.18,
      hp: u.hp, maxHp: u.maxHp, mana: u.mana, maxMana: u.maxMana, shield: u.shield,
      alive: true, deathAt: 0, flashAt: -1e9, stunUntil: 0, buffUntil: 0, stealthUntil: 0, spawnAt: at,
      lungeAt: -1e9, lungeTo: null, castAt: -1e9, castKind: null, castColor: '#ffffff',
      tg: null, shotAt: -1e9, atkCount: 0, hitAt: -1e9, st: {},
    });
  }

  view(r: number, c: number): [number, number] { return this.mySide === 1 ? flip(r, c) : [r, c]; }

  quiet = false;
  snd(name: Parameters<typeof sfx>[0], throttle?: number, delay?: number) {
    if (!this.quiet) sfx(name, throttle, delay);
  }

  update(now: number) {
    const el = now - this.start;
    while (this.idx < this.events.length && this.events[this.idx].t <= el) {
      const e = this.events[this.idx++];
      // eventos muito atrasados (reconexão / aba em segundo plano): só atualiza o estado, sem efeitos
      this.quiet = el - e.t > 700;
      const before = this.fx.length;
      this.apply(e, now);
      if (this.quiet) this.fx.length = before;
      this.quiet = false;
    }
    if (!this.ended && el > this.duration + 300) {
      this.ended = true;
      sfx(this.winner === this.mySide ? 'win' : 'lose');
    }
    this.fx = this.fx.filter((f) => now - f.start < f.dur);
  }

  apply(e: CombatEvent, now: number) {
    if (e.k === 'spawn') {
      this.addUnit(e.unit, now);
      const nu = this.units.get(e.unit.uid)!;
      this.fx.push({ k: 'puff', r: nu.r, c: nu.c, start: now, dur: 900, seed: Math.random() * 10, big: true });
      this.fx.push({ k: 'nova', u: e.unit.uid, start: now, dur: 600, color: '#8aff5d', rad: 0.7 });
      this.fx.push({ k: 'label', u: e.unit.uid, text: `${UNITS[e.unit.defId]?.name ?? ''}!`, start: now, dur: 1000 });
      this.snd('heal', 100);
      return;
    }
    const u = this.units.get(e.u);
    if (!u) return;
    const text = (t: string, color: string, size = 1, uid = e.u) =>
      this.fx.push({ k: 'text', u: uid, text: t, color, start: now, dur: 900, size, dx: (Math.random() - 0.5) * 0.6 });
    switch (e.k) {
      case 'move': {
        const [r, c] = this.view(e.r, e.c);
        u.fr = u.r; u.fc = u.c; u.r = r; u.c = c;
        u.moveStart = now;
        u.jump = !!e.jump;
        u.moveDur = e.jump ? 480 : e.dash ? 230 : e.push ? 200 : 340;
        u.arc = e.jump ? 2.6 : e.dash ? 0.7 : e.push ? 0.35 : 0.18;
        if (e.jump) { this.snd('puff'); this.fx.push({ k: 'puff', r: u.fr, c: u.fc, start: now, dur: 900, seed: Math.random() * 10 }); }
        if (e.dash) { this.snd('whoosh', 120); this.fx.push({ k: 'puff', r: u.fr, c: u.fc, start: now, dur: 600, seed: Math.random() * 10 }); }
        if (e.push) this.fx.push({ k: 'puff', r: u.r, c: u.c, start: now + 150, dur: 600, seed: Math.random() * 10 });
        break;
      }
      case 'atk': {
        u.mana = e.mana;
        u.tg = e.tg;
        u.atkCount++;
        const def = UNITS[u.init.defId];
        if (def.range > 1) {
          const t = this.units.get(e.tg);
          const d = t ? Math.hypot(t.r - u.r, t.c - u.c) : 3;
          u.shotAt = now;
          const ap = def.role === 'apcaster' || def.role === 'support';
          this.fx.push({
            k: 'proj', from: e.u, to: e.tg, start: now + 60, dur: 90 + d * 45,
            color: ap ? (u.mine ? '#b98bff' : '#ff7ad9') : u.mine ? '#9bff5d' : '#ff6b8b', bolt: !ap,
          });
          this.snd(ap ? 'shootMagic' : 'shoot', 60);
        } else {
          u.lungeAt = now; u.lungeTo = e.tg;
          this.snd('slash', 70);
        }
        break;
      }
      case 'proc': {
        const icon = ITEMS[e.item]?.icon ?? '✨';
        text(icon, '#ffffff', 1.1);
        if (e.tgs && (e.item === 'tocha' || e.item === 'rede' || e.item === 'caixadagua' || e.item === 'parachoque')) {
          for (const id of e.tgs) this.fx.push({ k: 'zap', from: e.u, to: id, start: now, dur: 260, color: e.item === 'tocha' ? '#9fe8ff' : e.item === 'parachoque' ? '#ff8a3d' : '#ffe066' });
          this.snd('zap', 150);
        }
        if (e.item === 'radio' && e.tgs) for (const id of e.tgs) { const t = this.units.get(id); if (t) this.fx.push({ k: 'ring', r: t.r, c: t.c, start: now, dur: 500, color: '#5dff7a', rad: 0.5 }); }
        break;
      }
      case 'dmg':
        u.hp = e.hp; u.shield = e.sh; u.mana = e.mana;
        if (e.dodge) { text('esquivou!', '#c9c2ff', 0.8); break; }
        if (e.miss) { text('errou!', '#c9c2ff', 0.8); break; }
        u.flashAt = now;
        u.hitAt = now;
        if (e.amt > 0) text(e.crit ? `${e.amt}!` : String(e.amt), e.crit ? '#ffcf3f' : e.tru ? '#ffffff' : e.magic ? '#d27aff' : '#ffb0a0', e.crit ? 1.35 : e.amt > 300 ? 1.15 : 0.9);
        if (e.crit) this.snd('hitCrit', 90);
        else if (e.magic) this.snd('hitMagic', 60);
        else this.snd('hit', 50);
        break;
      case 'heal':
        u.hp = e.hp;
        if (e.maxHp) u.maxHp = e.maxHp;
        if (e.amt >= 5) text(`+${e.amt}`, '#5dff7a', 0.85);
        break;
      case 'shield':
        u.shield = e.sh;
        this.fx.push({ k: 'ring', r: u.r, c: u.c, start: now, dur: 500, color: '#7ad7ff', rad: 0.6 });
        this.snd('shield', 200);
        break;
      case 'mana':
        u.mana = e.mana;
        break;
      case 'stun':
        u.stunUntil = now + e.dur;
        u.st.stun = now + e.dur;
        break;
      case 'buff':
        u.buffUntil = Math.max(u.buffUntil, now + e.dur);
        u.st.buff = u.buffUntil;
        break;
      case 'status': {
        if (e.s === 'cleanse') for (const k of NEGATIVE) delete u.st[k];
        else u.st[e.s] = Math.max(u.st[e.s] ?? 0, now + e.dur);
        if (e.s === 'stealth') {
          u.stealthUntil = now + e.dur;
          this.fx.push({ k: 'puff', r: u.r, c: u.c, start: now, dur: 700, seed: Math.random() * 10 });
          break;
        }
        if (e.s === 'reflect') this.fx.push({ k: 'bubble', u: e.u, start: now, dur: Math.min(e.dur, 1800), color: '#ffe9a8' });
        if (e.s === 'dodge') this.fx.push({ k: 'swirl', u: e.u, start: now, dur: 900, color: '#c9c2ff' });
        const st = STATUS_TEXT[e.s];
        if (st) text(st[0], st[1], 0.85);
        break;
      }
      case 'death':
        u.alive = false; u.deathAt = now; u.hp = 0;
        this.fx.push({ k: 'puff', r: u.r, c: u.c, start: now, dur: 1100, seed: Math.random() * 10, big: true });
        this.fx.push({ k: 'nova', r: u.r, c: u.c, start: now, dur: 550, color: u.mine ? '#9bff5d' : '#ff6b8b', rad: 0.4 });
        this.snd('death', 80);
        this.snd('puff', 80);
        break;
      case 'cast': {
        const def = UNITS[u.init.defId];
        const color = def.ability.color ?? AB_COLOR[def.ability.fx];
        u.castAt = now; u.mana = 0; u.castKind = def.ability.fx; u.castColor = color;
        this.fx.push({ k: 'label', u: e.u, text: def.ability.name, start: now, dur: 1100 });
        // círculo rúnico embaixo de quem conjura
        this.fx.push({ k: 'rune', u: e.u, start: now, dur: def.range > 1 ? 800 : 600, color, rad: 1.0 });
        this.snd('cast', 120);
        this.abilityFx(e.ab, e, u, now, color, false);
        break;
      }
      case 'fx': {
        const def = UNITS[u.init.defId];
        const color = def.ability.color ?? AB_COLOR[def.ability.fx];
        this.abilityFx(e.ab, e, u, now, color, true);
        break;
      }
    }
  }

  // ---------------- visual de cada habilidade ----------------
  private abilityFx(kind: AbilityKind, e: { u: number; tg?: number; tgs?: number[]; r?: number; c?: number; n?: number }, u: RU, now: number, color: string, impact: boolean) {
    const fx = this.fx;
    const def = UNITS[u.init.defId];
    const ranged = def.range > 1;
    const tgs = e.tgs ?? (e.tg ? [e.tg] : []);
    const tg = e.tg ?? tgs[0];
    const hex = (): [number, number] | null => (e.r !== undefined && e.c !== undefined ? this.view(e.r, e.c) : null);
    const seed = () => Math.random() * 10;
    const dOf = (a: number, b: number) => {
      const x = this.units.get(a), y = this.units.get(b);
      return x && y ? Math.hypot(x.r - y.r, x.c - y.c) : 3;
    };
    const proj = (to: number, delay: number, col = color, opts: { bolt?: boolean; big?: boolean; from?: number } = {}) => {
      const from = opts.from ?? e.u;
      const dur = 140 + dOf(from, to) * 55;
      fx.push({ k: 'proj', from, to, start: now + delay, dur, color: col, big: opts.big ?? true, bolt: opts.bolt, fromCast: ranged && !opts.bolt && from === e.u });
      return delay + dur;
    };
    const nova = (id: number, delay: number, rad = 0.6, col = color, dur = 500) => fx.push({ k: 'nova', u: id, start: now + delay, dur, color: col, rad });
    const novaAt = (r: number, c: number, delay: number, rad: number, col = color, dur = 650) => fx.push({ k: 'nova', r, c, start: now + delay, dur, color: col, rad });
    const strike = (id: number, delay: number, col = color) => fx.push({ k: 'strike', u: id, start: now + delay, dur: 420, color: col });
    const beam = (to: number, delay = 0, col = color, from = e.u) => fx.push({ k: 'beam', from, to, start: now + delay, dur: 450, color: col });
    const zap = (from: number, to: number, delay: number, col = color) => fx.push({ k: 'zap', from, to, start: now + delay, dur: 260, color: col });
    const puffAt = (r: number, c: number, delay: number, big = true, dur = 1000) => fx.push({ k: 'puff', r, c, start: now + delay, dur, seed: seed(), big });
    const slamU = (id: number, delay: number, rad: number, col = color) => fx.push({ k: 'slam', u: id, start: now + delay, dur: 1300, color: col, rad });
    const slamAt = (r: number, c: number, delay: number, rad: number, col = color) => fx.push({ k: 'slam', r, c, start: now + delay, dur: 1400, color: col, rad });
    const runeAt = (r: number, c: number, dur: number, rad: number, col = color) => fx.push({ k: 'rune', r, c, start: now, dur, color: col, rad });
    const pillar = (id: number, delay: number, col = color) => fx.push({ k: 'pillar', u: id, start: now + delay, dur: 900, color: col });
    const plus = (id: number, delay: number) => fx.push({ k: 'plus', u: id, start: now + delay, dur: 1000 });
    const bubble = (id: number, delay: number, col = color) => fx.push({ k: 'bubble', u: id, start: now + delay, dur: 1400, color: col });
    const swirl = (id: number, delay: number, col = color) => fx.push({ k: 'swirl', u: id, start: now + delay, dur: 900, color: col });
    const text = (s: string, col: string, size: number, uid: number) => fx.push({ k: 'text', u: uid, text: s, color: col, start: now, dur: 900, size, dx: 0 });
    const posOf = (id: number) => { const x = this.units.get(id); return x ? [x.r, x.c] as [number, number] : null; };
    const line = (delay: number, col = color, big = false) => {
      const h = hex();
      if (!h) return;
      const [cr, cc] = this.view(u.r, u.c); // volta pra coordenada de combate
      const [er, ec] = this.view(h[0], h[1]);
      lineHexes(cr, cc, er, ec).forEach(([r, c], i) => {
        const [vr, vc] = this.view(r, c);
        novaAt(vr, vc, delay + i * 55, big ? 0.75 : 0.55, col, 420);
        if (i % 2 === 0) puffAt(vr, vc, delay + i * 55, false, 600);
      });
    };
    const meteorAt = (r: number, c: number, delay: number, rad: number, col = color) => {
      runeAt(r, c, delay + 500, rad * 1.25 + 0.6, col);
      fx.push({ k: 'meteor', r, c, start: now + delay, dur: 900 });
      novaAt(r, c, delay + 380, rad + 1.2, col, 900);
      slamAt(r, c, delay + 380, rad + 0.6, col);
      puffAt(r, c, delay + 380, true, 1200);
      this.snd('whoosh', 200, delay);
      this.snd('boom', 200, delay + 380);
    };

    if (!impact) {
      switch (kind) {
        case 'cascagrossa': bubble(e.u, 0); slamU(e.u, 200, 1.2, '#ff7a7a'); this.snd('shield', 0); break;
        case 'baforada': if (tg) { const t1 = proj(tg, 80, '#d6d0f0'); const p = posOf(tg); if (p) puffAt(p[0], p[1], t1, true); } this.snd('puff', 0, 200); break;
        case 'mordida': if (tg) { strike(tg, 120, '#ff5d73'); fx.push({ k: 'drain', from: e.u, to: tg, start: now + 150, dur: 700, color }); pillar(e.u, 450, '#5dff7a'); } this.snd('drain', 0, 150); break;
        case 'bolinhapaz': case 'fornada': if (tg) { const t1 = kind === 'fornada' ? proj(tg, 0, '#ffd28a', { from: e.u }) : 200; beam(tg, 0, '#5dff7a'); pillar(tg, t1); plus(tg, t1 + 50); } this.snd('heal', 0, 200); break;
        case 'estouro': case 'hiperespaco': swirl(e.u, 0); pillar(e.u, 0); this.snd('buff', 0); break;
        case 'brasa': case 'chiclete': if (tg) { const t1 = proj(tg, ranged ? 200 : 80, color, { bolt: kind === 'brasa' }); nova(tg, t1, 0.8); } this.snd(kind === 'brasa' ? 'boom' : 'puff', 0, 250); break;
        case 'sinaltravado': if (tgs[0]) { zap(e.u, tgs[0], 140); strike(tgs[0], 220); nova(tgs[0], 220, 0.5); } if (tgs[1]) { zap(tgs[0], tgs[1], 420); strike(tgs[1], 480); } this.snd('zap', 0, 220); break;
        case 'olhogordo': if (tg) { beam(tg, 0, '#ff9d3d'); strike(tg, 220, '#ff9d3d'); nova(tg, 220, 0.6, '#ff9d3d'); } this.snd('zap', 0, 220); break;
        case 'cupinzeiro': puffAt(u.r, u.c, 0, true); this.snd('puff', 0); break;
        case 'fogueira': case 'nuvemdensa': {
          const h = hex(); if (!h) break;
          if (tg) proj(tg, 120, color);
          runeAt(h[0], h[1], 3300, 1.9, color);
          for (let i = 0; i < 4; i++) puffAt(h[0], h[1], 300 + i * 800, true, 1100);
          novaAt(h[0], h[1], 300, 1.6, color, 700);
          this.snd(kind === 'fogueira' ? 'boom' : 'puff', 0, 300);
          break;
        }
        case 'moedor': swirl(e.u, 0, '#c9d2dc'); break;
        case 'esporos': if (tg) { const t1 = proj(tg, 200); nova(tg, t1, 0.7); strike(tg, t1); for (const id of tgs) proj(id, t1, color, { from: tg, big: false }); } this.snd('zap', 0, 300); break;
        case 'golpenebuloso': puffAt(u.r, u.c, 0, true); this.snd('puff', 0); break;
        case 'grave': case 'radinho': for (const id of tgs) { beam(id, 0); swirl(id, 250); } slamU(e.u, 100, kind === 'grave' ? 2.6 : 1.2, color); this.snd('buff', 0, 150); break;
        case 'parafuso': case 'salgadinho': for (const id of tgs) { const t1 = proj(id, 280, color, { bolt: true }); nova(id, t1, 0.4); } this.snd('shoot', 0, 280); break;
        case 'pulsoneon': if (tg) { const p = posOf(tg); if (p) { runeAt(p[0], p[1], 600, 1.8, color); novaAt(p[0], p[1], 280, 1.5, color, 750); } } this.snd('boom', 0, 280); break;
        case 'raiz': for (const id of tgs) { zap(e.u, id, 150, '#5dff7a'); strike(id, 300, '#5dff7a'); } bubble(e.u, 0, '#a8ff9e'); this.snd('slam', 0, 300); break;
        case 'tornado': case 'escapamento': case 'sirene': line(kind === 'escapamento' ? 120 : 200, color, kind !== 'tornado'); this.snd(kind === 'sirene' ? 'zap' : 'whoosh', 0, 200); break;
        case 'fotossintese': case 'rima': case 'seiva': case 'vibracao':
          for (const id of tgs) {
            beam(id, 0);
            if (kind === 'vibracao') bubble(id, 250); else { pillar(id, 200); plus(id, 250); }
          }
          if (kind === 'rima') swirl(e.u, 0, '#ff6b3d');
          this.snd(kind === 'vibracao' ? 'shield' : 'heal', 0, 150);
          break;
        case 'neblinapesada': case 'surto': case 'badtrip': case 'colheita':
          slamU(e.u, kind === 'neblinapesada' || kind === 'badtrip' ? 330 : 240, 1.7, color);
          puffAt(u.r, u.c, 300, true);
          for (const id of tgs) strike(id, 260, color);
          this.snd('slam', 0, 300);
          break;
        case 'eclipse': if (tg) { strike(tg, 250); nova(tg, 250, 0.9); } this.snd('slash', 0, 250); break;
        case 'virus': if (tg) { const t1 = proj(tg, 200, color); nova(tg, t1, 0.6); } this.snd('drain', 0, 300); break;
        case 'ricochete': {
          let prev = e.u;
          tgs.forEach((id, i) => { zap(prev, id, 200 + i * 130, color); nova(id, 260 + i * 130, 0.5); prev = id; });
          this.snd('zap', 0, 260);
          break;
        }
        case 'curto': {
          let prev = e.u;
          tgs.forEach((id, i) => { zap(prev, id, 120 + i * 220, color); strike(id, 150 + i * 220, color); prev = id; });
          this.snd('zap', 0, 150);
          break;
        }
        case 'imantar': if (tg) { beam(tg, 0, color); strike(tg, 300, color); nova(tg, 300, 0.6); } this.snd('zap', 0, 300); break;
        case 'groove': break; // o salto já aparece; o impacto vem no evento 'fx'
        case 'pizza': { const h = hex(); if (h) { runeAt(h[0], h[1], 1000, 3.2, color); fx.push({ k: 'meteor', r: h[0], c: h[1], start: now + 420, dur: 900 }); this.snd('whoosh', 200, 420); } break; }
        case 'latariareal': case 'espelho': { const id = kind === 'espelho' ? tg : e.u; if (id) { if (kind === 'espelho') beam(id, 0, color); bubble(id, 200, color); pillar(id, 0, color); } this.snd('shield', 0); break; }
        case 'pane': if (tg) { strike(tg, 300, color); nova(tg, 300, 0.8); beam(tg, 0, color); } this.snd('zap', 0, 300); break;
        case 'bigbang': { const h = hex(); if (h) meteorAt(h[0], h[1], 0, 2); break; }
        case 'festa':
          for (const id of tgs) { proj(id, 350, ['#ff7ad9', '#ffe066', '#7ad7ff', '#9bff5d'][id % 4], { big: false }); }
          swirl(e.u, 0, '#ff5d9e'); pillar(e.u, 0, '#ffe066');
          this.snd('buff', 0); this.snd('shoot', 0, 350);
          break;
        case 'apagao': { const h = hex(); if (h) { runeAt(h[0], h[1], 700, 3.4, color); novaAt(h[0], h[1], 300, 3, '#2a0a3a', 900); novaAt(h[0], h[1], 300, 2.6, color, 700); } for (const id of tgs) strike(id, 300, color); this.snd('boom', 0, 300); break; }
        case 'buraconegro': { const h = hex(); if (h) { runeAt(h[0], h[1], 1300, 3.2, color); novaAt(h[0], h[1], 0, 2.6, '#140a2a', 1300); slamAt(h[0], h[1], 800, 2.4, color); puffAt(h[0], h[1], 800, true, 1200); } this.snd('whoosh', 0, 200); this.snd('boom', 0, 800); break; }
        case 'marreta': if (tg) { const p = posOf(tg); strike(tg, 300, color); if (p) { slamAt(p[0], p[1], 300, 1.5, color); puffAt(p[0], p[1], 300, true); } } this.snd('slam', 0, 300); break;
        // chefões
        case 'enxame': bubble(e.u, 0, '#ffd23f'); pillar(e.u, 0, '#ffd23f'); slamU(e.u, 0, 1.6, '#3d8bff'); text('👑 ENXAME!', '#ffd23f', 1.3, e.u); this.snd('buff', 0); break;
        case 'torrada': runeAt(u.r, u.c, 700, 1.6, color); for (const id of tgs) proj(id, 150, color, { big: true }); this.snd('cast', 0); break;
        case 'sugada': runeAt(u.r, u.c, 1100, 3.6, color); novaAt(u.r, u.c, 0, 3.2, '#140a2a', 1100); swirl(e.u, 0, color); slamU(e.u, 750, 2.2, color); text('SSSHHHUUUP!', '#9fe8ff', 1.2, e.u); this.snd('whoosh', 0, 100); this.snd('boom', 0, 750); break;
        case 'turbilhao': swirl(e.u, 0, color); text('🌀', '#ff5d73', 1.4, e.u); this.snd('whoosh', 0); break;
        case 'congelar': { const h = hex(); if (h) { runeAt(h[0], h[1], 900, 3.2, color); novaAt(h[0], h[1], 450, 2.8, '#e8f8ff', 900); slamAt(h[0], h[1], 450, 2.4, color); } for (const id of tgs) strike(id, 450, '#e8f8ff'); text('❄️ CONGELA!', '#bfe9ff', 1.3, e.u); this.snd('boom', 0, 450); break; }
        // Laboratório Clandestino
        case 'gosma': bubble(e.u, 0, '#b6ff3d'); slamU(e.u, 150, 1.3, '#b6ff3d'); puffAt(u.r, u.c, 100, true, 900); for (const id of tgs) strike(id, 200, '#b6ff3d'); this.snd('drain', 0); break;
        case 'faisca': { let prev = e.u; tgs.forEach((id, i) => { zap(prev, id, 180 + i * 140, color); nova(id, 220 + i * 140, i ? 0.4 : 0.6); prev = id; }); this.snd('zap', 0, 200); break; }
        case 'estocada': case 'finta': if (tg) swirl(e.u, 0, color); if (kind === 'finta') puffAt(u.r, u.c, 0, false, 700); this.snd('slash', 0, 150); break;
        case 'chicotada': for (const id of tgs) { beam(id, 100, color); strike(id, 280, color); } swirl(e.u, 0, color); this.snd('slash', 0, 280); break;
        case 'descarga': { const h = hex(); if (h) { runeAt(h[0], h[1], 700, 2.2, color); novaAt(h[0], h[1], 320, 1.9, color, 700); } for (const id of tgs) { zap(e.u, id, 200, color); strike(id, 320, color); } this.snd('zap', 0, 320); break; }
        case 'inchar': pillar(e.u, 0, '#b6ff3d'); slamU(e.u, 300, 1.6, '#b6ff3d'); text('INCHOU!', '#d8ff5d', 1.1, e.u); for (const id of tgs) strike(id, 300, color); this.snd('slam', 0, 300); break;
        case 'relampago': if (tg) { zap(e.u, tg, 80, '#ffffff'); zap(e.u, tg, 160, color); } this.snd('zap', 0); break;
        case 'rajadaduelo': swirl(e.u, 0, color); this.snd('shoot', 0, 150); break;
        case 'cuspeacido': for (const id of tgs) { const t1 = proj(id, 220, color); nova(id, t1, 0.55); } this.snd('drain', 0, 250); break;
        case 'campotesla': slamU(e.u, 0, 2.6, color); for (const id of tgs) { zap(e.u, id, 100, color); bubble(id, 200, color); } this.snd('shield', 0); this.snd('zap', 0, 250); break;
        case 'devorar': if (tg) { strike(tg, 260, '#b6ff3d'); fx.push({ k: 'drain', from: e.u, to: tg, start: now + 260, dur: 700, color }); nova(tg, 260, 0.9, '#b6ff3d'); } this.snd('drain', 0, 260); break;
        case 'chuvagosma': for (const id of tgs) { const p = posOf(id); if (p) { fx.push({ k: 'meteor', r: p[0], c: p[1], start: now + Math.random() * 200, dur: 700 }); novaAt(p[0], p[1], 500, 0.9, color, 600); } } text('🧪 CHUVA DE GOSMA!', '#b6ff3d', 1.2, e.u); this.snd('whoosh', 0); this.snd('boom', 0, 500); break;
        default: if (tg) { const t1 = proj(tg, ranged ? 200 : 80); nova(tg, t1, 0.6); }
      }
      return;
    }

    // ---- eventos de impacto tardio ('fx') ----
    switch (kind) {
      case 'cupinzeiro': case 'groove': {
        const h = hex() ?? [u.r, u.c];
        slamAt(h[0], h[1], 0, kind === 'groove' ? 1.7 : 1.3, color);
        puffAt(h[0], h[1], 0, true);
        for (const id of tgs) strike(id, 0, color);
        this.snd('slam', 0);
        break;
      }
      case 'moedor': {
        slamU(e.u, 0, 1.2, '#c9d2dc');
        for (const id of tgs) zap(e.u, id, 0, '#e6eef8');
        this.snd('slash', 120);
        break;
      }
      case 'golpenebuloso': case 'eclipse': if (tg) { strike(tg, kind === 'eclipse' ? 250 : 0, color); nova(tg, kind === 'eclipse' ? 250 : 0, 0.8); } this.snd('slash', 0); break;
      case 'fotossintese': for (const id of tgs) plus(id, 0); break;
      case 'estouro': for (const id of tgs) nova(id, 0, 0.45, '#fff8d6'); if (tg) nova(tg, 0, 0.7, '#ffe066'); this.snd('puff', 100); break;
      case 'hiperespaco': if (tg) proj(tg, 40, '#7ad7ff', { bolt: true, big: false }); break;
      case 'virus': if (tg) { if (tgs[0]) proj(tg, 0, color, { from: tgs[0] }); text('🦠', '#3dffb0', 1, tg); } break;
      case 'pizza': { const h = hex(); if (h) { novaAt(h[0], h[1], 0, 3.2, color, 900); slamAt(h[0], h[1], 0, 2.6, '#ffe08a'); puffAt(h[0], h[1], 0, true, 1300); } this.snd('boom', 0); break; }
      case 'pane': if (tg && tgs[0]) beam(tgs[0], 0, '#3dffb0', tg); break;
      case 'colheita': if (tg) { text('COLHIDO!', '#c4ff9e', 1.2, tg); strike(tg, 0, '#ffffff'); } break;
      case 'bigbang': { const h = hex(); if (h) meteorAt(h[0], h[1], 0, 1); break; }
      case 'turbilhao': slamU(e.u, 0, 2.3, color); for (const id of tgs) strike(id, 0, color); this.snd('slash', 0); break;
      case 'estocada': case 'finta': if (tg) { strike(tg, 0, kind === 'finta' ? '#ffffff' : color); nova(tg, 0, 0.45, color); } this.snd('slash', 0); break;
      case 'rajadaduelo': if (tg) { const t1 = proj(tg, 0, color, { bolt: true, big: false }); nova(tg, t1, 0.35, color); } this.snd('shoot', 60); break;
      case 'relampago': { const h = hex(); if (h) { novaAt(h[0], h[1], 0, 1.6, '#fff7a0', 450); slamAt(h[0], h[1], 0, 1.4, color); } pillar(e.u, 0, color); for (const id of tgs) strike(id, 0, color); this.snd('boom', 0); break; }
      case 'campotesla': if (tg && tgs[0]) zap(tgs[0], tg, 0, color); break;
      case 'mutacao': nova(e.u, 0, 0.55, '#b6ff3d', 500); if ((e.n ?? 0) >= 5) text('🧪 MUTAÇÃO MÁXIMA', '#b6ff3d', 0.9, e.u); break;
      case 'choque': for (const id of tgs) { fx.push({ k: 'strike', u: id, start: now + 120, dur: 420, color: '#fff7a0' }); zap(e.u, id, 0, '#ffe93d'); nova(id, 200, 0.5, '#ffe93d', 400); } this.snd('zap', 0, 200); break;
      default: break;
    }
  }
}
