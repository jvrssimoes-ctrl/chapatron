import { UNITS } from '../../shared/data';
import { ITEMS } from '../../shared/items';
import { flip } from '../../shared/hex';
import type { AbilityKind, CombatEvent, CombatUnitInit } from '../../shared/types';
import { sfx } from './sfx';

// Reprodução do combate a partir da lista de eventos do servidor. Independente do renderizador.

export interface RU {
  init: CombatUnitInit;
  mine: boolean;
  r: number; c: number;
  fr: number; fc: number;
  moveStart: number; moveDur: number; jump: boolean;
  hp: number; maxHp: number; mana: number; maxMana: number; shield: number;
  alive: boolean; deathAt: number;
  flashAt: number; stunUntil: number; buffUntil: number;
  lungeAt: number; lungeTo: number | null; castAt: number; castKind: AbilityKind | null;
  shotAt: number; atkCount: number; hitAt: number;
  tg: number | null;
}

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

export const AB_COLOR: Record<AbilityKind, string> = {
  shield: '#7ad7ff', multishot: '#ffe066', drain: '#ff5d73', heal: '#5dff7a', buffAS: '#ffcf5d',
  nuke: '#d27aff', stun: '#ffe066', aoe: '#b9b3d6', teamHeal: '#5dff7a', aoeStun: '#9f97d8',
  teamShield: '#7ad7ff', meteor: '#ff8a3d', teamAS: '#ff5d9e',
};

export class Replay {
  units = new Map<number, RU>();
  fx: Effect[] = [];
  idx = 0;
  ended = false;
  shake = 0;

  constructor(public events: CombatEvent[], init: CombatUnitInit[], public mySide: 0 | 1, public start: number, public duration: number, public winner: number) {
    for (const u of init) {
      const [r, c] = this.view(u.r, u.c);
      this.units.set(u.uid, {
        init: u, mine: u.side === mySide, r, c, fr: r, fc: c, moveStart: 0, moveDur: 1, jump: false,
        hp: u.hp, maxHp: u.maxHp, mana: u.mana, maxMana: u.maxMana, shield: u.shield,
        alive: true, deathAt: 0, flashAt: -1e9, stunUntil: 0, buffUntil: 0, lungeAt: -1e9, lungeTo: null,
        castAt: -1e9, castKind: null, tg: null, shotAt: -1e9, atkCount: 0, hitAt: -1e9,
      });
    }
  }

  view(r: number, c: number): [number, number] { return this.mySide === 1 ? flip(r, c) : [r, c]; }

  quiet = false;
  snd(name: Parameters<typeof sfx>[0], throttle?: number) {
    if (!this.quiet) sfx(name, throttle);
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
    const u = this.units.get(e.u);
    if (!u) return;
    const text = (t: string, color: string, size = 1) =>
      this.fx.push({ k: 'text', u: e.u, text: t, color, start: now, dur: 900, size, dx: (Math.random() - 0.5) * 0.6 });
    switch (e.k) {
      case 'move': {
        const [r, c] = this.view(e.r, e.c);
        u.fr = u.r; u.fc = u.c; u.r = r; u.c = c;
        u.moveStart = now; u.moveDur = e.jump ? 480 : 340; u.jump = !!e.jump;
        if (e.jump) { this.snd('puff'); this.fx.push({ k: 'puff', r: u.fr, c: u.fc, start: now, dur: 900, seed: Math.random() * 10 }); }
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
        u.flashAt = now;
        u.hitAt = now;
        if (e.amt > 0) text(String(e.amt), e.crit ? '#ffcf3f' : e.magic ? '#d27aff' : '#ffffff', e.crit ? 1.35 : e.amt > 300 ? 1.15 : 0.9);
        if (e.crit) this.snd('hitCrit', 90);
        else if (e.magic) this.snd('hitMagic', 60);
        else this.snd('hit', 50);
        break;
      case 'heal':
        u.hp = e.hp;
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
        break;
      case 'buff':
        u.buffUntil = Math.max(u.buffUntil, now + e.dur);
        break;
      case 'death':
        u.alive = false; u.deathAt = now; u.hp = 0;
        this.fx.push({ k: 'puff', r: u.r, c: u.c, start: now, dur: 1100, seed: Math.random() * 10, big: true });
        this.fx.push({ k: 'nova', r: u.r, c: u.c, start: now, dur: 550, color: u.mine ? '#9bff5d' : '#ff6b8b', rad: 0.4 });
        this.snd('death', 80);
        this.snd('puff', 80);
        break;
      case 'cast': {
        u.castAt = now; u.mana = 0; u.castKind = e.ab;
        const def = UNITS[u.init.defId];
        const color = AB_COLOR[e.ab];
        this.fx.push({ k: 'label', u: e.u, text: def.ability.name, start: now, dur: 1100 });
        // círculo rúnico embaixo de quem conjura
        this.fx.push({ k: 'rune', u: e.u, start: now, dur: def.range > 1 ? 800 : 600, color, rad: 1.0 });
        this.snd('cast', 120);
        // som específico de cada habilidade (no tempo do impacto)
        const snd2: Partial<Record<string, [Parameters<typeof sfx>[0], number]>> = {
          meteor: ['boom', 380], aoe: ['boom', 280], aoeStun: ['slam', 330], shield: ['shield', 0], buffAS: ['buff', 0],
          heal: ['heal', 150], teamHeal: ['heal', 150], teamShield: ['shield', 200], teamAS: ['buff', 150], drain: ['drain', 150], stun: ['zap', 220],
        };
        const s2 = snd2[e.ab];
        if (e.ab === 'meteor') this.snd('whoosh', 200);
        if (s2 && !this.quiet) sfx(s2[0], 120, s2[1]);
        const tgs = e.tgs ?? (e.tg ? [e.tg] : []);
        const rad = def.ability.radius ?? 1;
        const area = rad * 1.25 + 0.5;
        switch (e.ab) {
          case 'meteor': {
            const t = this.units.get(e.tg!);
            if (!t) break;
            this.fx.push({ k: 'rune', r: t.r, c: t.c, start: now, dur: 700, color, rad: area * 1.2 });
            this.fx.push({ k: 'meteor', r: t.r, c: t.c, start: now, dur: 900 });
            this.fx.push({ k: 'nova', r: t.r, c: t.c, start: now + 380, dur: 900, color, rad: rad + 1.2 });
            this.fx.push({ k: 'slam', r: t.r, c: t.c, start: now + 380, dur: 1600, color: '#ff8a3d', rad: rad + 0.6 });
            this.fx.push({ k: 'puff', r: t.r, c: t.c, start: now + 380, dur: 1200, seed: Math.random() * 10, big: true });
            break;
          }
          case 'aoe': {
            const t = this.units.get(e.tg!);
            if (!t) break;
            this.fx.push({ k: 'rune', r: t.r, c: t.c, start: now, dur: 600, color, rad: area });
            this.fx.push({ k: 'nova', r: t.r, c: t.c, start: now + 280, dur: 750, color, rad: rad + 0.5 });
            this.fx.push({ k: 'puff', r: t.r, c: t.c, start: now + 280, dur: 1100, seed: Math.random() * 10, big: true });
            break;
          }
          case 'aoeStun':
            this.fx.push({ k: 'slam', u: e.u, start: now + 330, dur: 1400, color, rad: 1.7 });
            this.fx.push({ k: 'puff', r: u.r, c: u.c, start: now + 330, dur: 1000, seed: Math.random() * 10, big: true });
            break;
          case 'shield':
            this.fx.push({ k: 'bubble', u: e.u, start: now, dur: 1500, color });
            break;
          case 'buffAS':
            this.fx.push({ k: 'swirl', u: e.u, start: now, dur: 1000, color });
            this.fx.push({ k: 'pillar', u: e.u, start: now, dur: 700, color });
            break;
          case 'heal': case 'teamHeal': case 'teamShield': case 'teamAS':
            for (const id of tgs) {
              if (!this.units.get(id)) continue;
              this.fx.push({ k: 'beam', from: e.u, to: id, start: now, dur: 450, color });
              if (e.ab === 'teamShield') this.fx.push({ k: 'bubble', u: id, start: now + 250, dur: 1400, color });
              else if (e.ab === 'teamAS') this.fx.push({ k: 'swirl', u: id, start: now + 250, dur: 900, color });
              else {
                this.fx.push({ k: 'pillar', u: id, start: now + 200, dur: 1000, color });
                this.fx.push({ k: 'plus', u: id, start: now + 250, dur: 1100 });
              }
            }
            break;
          case 'drain':
            for (const id of tgs) this.fx.push({ k: 'drain', from: e.u, to: id, start: now + 150, dur: 700, color });
            this.fx.push({ k: 'pillar', u: e.u, start: now + 450, dur: 700, color: '#5dff7a' });
            break;
          case 'stun':
            for (const id of tgs) {
              this.fx.push({ k: 'strike', u: id, start: now + 220, dur: 420, color });
              this.fx.push({ k: 'nova', u: id, start: now + 220, dur: 450, color, rad: 0.5 });
            }
            break;
          default: { // nuke / multishot: projéteis + explosão no impacto
            const ranged = def.range > 1;
            for (const id of tgs) {
              const t = this.units.get(id);
              const d = t ? Math.hypot(t.r - u.r, t.c - u.c) : 3;
              const st = now + (ranged ? 260 : 120), dur = 160 + d * 60;
              this.fx.push({
                k: 'proj', from: e.u, to: id, start: st, dur, color, big: true,
                bolt: def.ability.scale === 'ad', fromCast: ranged && def.ability.scale !== 'ad',
              });
              this.fx.push({ k: 'nova', u: id, start: st + dur, dur: e.ab === 'nuke' ? 650 : 400, color, rad: e.ab === 'nuke' ? 0.9 : 0.35 });
            }
          }
        }
        break;
      }
    }
  }
}
