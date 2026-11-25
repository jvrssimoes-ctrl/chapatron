import { COST_COLORS, TRAITS, UNITS } from '../../shared/data';
import { computeTraits, emblemBonus, mergeBonus } from '../../shared/traits';
import { traitBonus } from '../../shared/augments';
import type { TraitId } from '../../shared/types';
import { traitImg } from './emblems';
import { banner, esc } from './hud';
import { robotPortrait } from './three/portrait';
import { SKINS, setSkin, skin } from './skins';
import { ARENAS, arena, setArena } from './arenas';
import { sfx } from './sfx';
import { lpDelta, rankBadge, rankOf } from './rank';
import { store } from './store';

// Perfil local (fica no navegador): estatísticas, histórico, conquistas e skin escolhida.

interface GameRecord { at: number; place: number; players: number; round: number; units: { d: string; s: number }[]; traits: TraitId[]; mode?: string; lp?: number }
interface Profile {
  games: number; wins: number; top4: number;
  places: number[];
  history: GameRecord[];
  unitPlays: Record<string, number>;
  stars3: number;
  achievements: Record<string, number>;
  skin: string;
  /** pontos de ranque e melhor marca */
  lp: number;
  peak: number;
}

const KEY = 'chapatron_profile';
const blank = (): Profile => ({ games: 0, wins: 0, top4: 0, places: [], history: [], unitPlays: {}, stars3: 0, achievements: {}, skin: 'padrao', lp: 0, peak: 0 });
function load(): Profile {
  try { return { ...blank(), ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }; } catch { return blank(); }
}
const prof = load();
function save() { try { localStorage.setItem(KEY, JSON.stringify(prof)); } catch { /* */ } }
setSkin(prof.skin);

// ---------------- conquistas ----------------

interface Ach { id: string; name: string; desc: string; icon: string }
export const ACHIEVEMENTS: Ach[] = [
  { id: 'primeira', name: 'Primeira Brisa', desc: 'Termine uma partida.', icon: '🌱' },
  { id: 'top4', name: 'Entre os Chapados', desc: 'Termine entre os 4 primeiros.', icon: '🏅' },
  { id: 'campeao', name: 'Rei da Brisa', desc: 'Vença uma partida.', icon: '👑' },
  { id: 'tristar', name: 'Brisa Máxima', desc: 'Tenha um robô ⭐⭐⭐.', icon: '🌟' },
  { id: 'lenda', name: 'Lenda Viva', desc: 'Tenha um robô de 5 custo ⭐⭐.', icon: '💎' },
  { id: 'poupador', name: 'Pé-de-Meia', desc: 'Junte 50 de ouro.', icon: '🐷' },
  { id: 'nivel9', name: 'Nível Celestial', desc: 'Chegue ao nível 9.', icon: '🚀' },
  { id: 'vertical', name: 'Fechou a Sinergia', desc: 'Ative o nível máximo de uma sinergia vertical (6).', icon: '🧩' },
  { id: 'sequencia', name: 'Embalado', desc: 'Ganhe 5 combates seguidos.', icon: '🔥' },
  { id: 'dano', name: 'Estouro', desc: 'Cause 6.000 de dano num único combate.', icon: '💥' },
  { id: 'porumfio', name: 'Por um Fio', desc: 'Fique no top 4 depois de chegar a 10 de vida ou menos.', icon: '🩹' },
  { id: 'veterano', name: 'Veterano da Brisa', desc: 'Jogue 10 partidas.', icon: '🎖️' },
  { id: 'colecionador', name: 'Colecionador', desc: 'Termine partidas usando 30 robôs diferentes.', icon: '📚' },
];

function unlock(id: string) {
  if (prof.achievements[id]) return;
  prof.achievements[id] = Date.now();
  save();
  const a = ACHIEVEMENTS.find((x) => x.id === id)!;
  const sk = SKINS.find((s) => s.unlock === id);
  setTimeout(() => {
    banner(`<span class="bn-stars">${a.icon}</span><b>${esc(a.name)}</b><small>Conquista desbloqueada${sk ? ` · skin "${esc(sk.name)}"` : ''}</small>`, 'green', 3200);
    sfx('levelup');
  }, 600);
}

// ---------------- acompanhamento da partida ----------------

let lastBoard: { d: string; s: number }[] = [];
let lastTraits: TraitId[] = [];
let minHp = 100;
let tracking = false;

/** Chamado a cada estado recebido. */
export function trackState() {
  const s = store.state;
  if (!s) return;
  if (s.round <= 1) minHp = 100;
  tracking = true;
  const me = s.me;
  if (!me.alive) return;
  minHp = Math.min(minHp, me.hp);
  const board = me.units.filter((u) => u.loc.zone === 'board');
  if (board.length) {
    lastBoard = board.map((u) => ({ d: u.defId, s: u.star }));
    const tr = computeTraits(board.map((u) => u.defId), mergeBonus(traitBonus(me.augments), emblemBonus(board)));
    lastTraits = tr.filter((t) => t.tier >= 0).slice(0, 3).map((t) => t.id);
    if (tr.some((t) => TRAITS[t.id].style === 'vertical' && TRAITS[t.id].breakpoints.length >= 3 && t.tier === TRAITS[t.id].breakpoints.length - 1)) unlock('vertical');
  }
  if (me.gold >= 50) unlock('poupador');
  if (me.level >= 9) unlock('nivel9');
  if (me.streak >= 5) unlock('sequencia');
  if (me.units.some((u) => u.star >= 2 && UNITS[u.defId].cost === 5)) unlock('lenda');
}

export function onStarUp(star: number) {
  if (star < 3) return;
  prof.stars3++;
  save();
  unlock('tristar');
}

/** Chamado quando chega um combate novo (já sabemos o resultado inteiro). */
export function trackCombat() {
  const cb = store.combat;
  if (!cb) return;
  let dmg = 0;
  const mine = new Set(cb.result.units.filter((u) => u.side === cb.mySide).map((u) => u.uid));
  for (const e of cb.result.events) if (e.k === 'dmg' && e.s !== undefined && mine.has(e.s)) dmg += e.amt;
  if (dmg >= 6000) unlock('dano');
}

export interface RankChange { before: number; after: number; delta: number }
let lastRank: RankChange | null = null;
/** Mudança de ranque da última partida (para a tela final). */
export function lastRankChange() { return lastRank; }
export function myLp() { return prof.lp; }

/** total = número de jogadores (ou de duplas, no modo Dupla). */
export function trackGameOver(place: number, players: number, mode = 'normal') {
  if (!tracking) return lastRank;
  tracking = false;
  const before = prof.lp;
  const delta = lpDelta(place, players);
  prof.lp = Math.max(0, prof.lp + delta);
  prof.peak = Math.max(prof.peak, prof.lp);
  lastRank = { before, after: prof.lp, delta: prof.lp - before };
  prof.games++;
  if (place === 1) prof.wins++;
  if (place <= 4) prof.top4++;
  prof.places = [...prof.places, place].slice(-50);
  prof.history = [{ at: Date.now(), place, players, round: store.state?.round ?? 0, units: lastBoard, traits: lastTraits, mode, lp: lastRank.delta }, ...prof.history].slice(0, 15);
  for (const u of new Set(lastBoard.map((x) => x.d))) prof.unitPlays[u] = (prof.unitPlays[u] ?? 0) + 1;
  save();
  unlock('primeira');
  if (place <= 4) unlock('top4');
  if (place === 1) unlock('campeao');
  if (place <= 4 && minHp <= 10) unlock('porumfio');
  if (prof.games >= 10) unlock('veterano');
  if (Object.keys(prof.unitPlays).length >= 30) unlock('colecionador');
  const rb = rankOf(before), ra = rankOf(prof.lp);
  if (ra.index > rb.index) setTimeout(() => { banner(`<span class="bn-stars">${ra.tier.icon}</span><b>${esc(ra.tier.name)}</b><small>Subiu de ranque!</small>`, 'gold', 3600); sfx('levelup'); }, 2200);
  return lastRank;
}

// ---------------- tela do perfil ----------------

let root: HTMLElement | null = null;
export function isProfileOpen() { return !!root && !root.classList.contains('hidden'); }
export function closeProfile() { root?.classList.add('hidden'); }

export function openProfile() {
  if (!root) {
    root = document.createElement('div');
    root.id = 'profile';
    document.body.appendChild(root);
    root.addEventListener('click', (e) => {
      const el = e.target as HTMLElement;
      if (el === root || el.closest('.gd-close')) { closeProfile(); return; }
      const ar = el.closest('[data-arena]') as HTMLElement | null;
      if (ar && !ar.classList.contains('locked')) { setArena(ar.dataset.arena!); sfx('equip'); render(); return; }
      const sk = el.closest('[data-skin]') as HTMLElement | null;
      if (sk && !sk.classList.contains('locked')) {
        prof.skin = sk.dataset.skin!;
        save();
        setSkin(prof.skin);
        sfx('equip');
        render();
      }
    });
  }
  root.classList.remove('hidden');
  render();
  sfx('click');
}

function rankBox() {
  const r = rankOf(prof.lp);
  const next = TIERS_NEXT(prof.lp);
  return `<div class="pf-rank" style="--rc:${r.tier.color}">
    <div class="pf-rank-ic">${r.tier.icon}</div>
    <div class="pf-rank-main"><small>Ranque</small><b>${esc(r.label)}</b>
      <div class="pf-rank-bar"><i style="width:${r.top ? 100 : r.pts}%"></i></div>
      <small>${r.top ? `${r.pts} pontos` : `${r.pts}/100 pontos` }${next ? ` · próximo: ${esc(next)}` : ''} · melhor: ${esc(rankOf(prof.peak).label)}</small></div>
  </div>`;
}
function TIERS_NEXT(lp: number) {
  const r = rankOf(lp);
  if (r.top) return '';
  return r.div === 'I' ? rankOf(r.tier.min + 400).tier.name : `${r.tier.name} ${['IV', 'III', 'II', 'I'][['IV', 'III', 'II', 'I'].indexOf(r.div) + 1]}`;
}

function render() {
  if (!root) return;
  const avg = prof.places.length ? (prof.places.reduce((a, b) => a + b, 0) / prof.places.length).toFixed(2) : '—';
  const pct = (n: number) => (prof.games ? `${Math.round((100 * n) / prof.games)}%` : '—');
  const fav = Object.entries(prof.unitPlays).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const got = ACHIEVEMENTS.filter((a) => prof.achievements[a.id]).length;
  const ago = (t: number) => {
    const m = Math.round((Date.now() - t) / 60000);
    return m < 60 ? `há ${Math.max(1, m)} min` : m < 1440 ? `há ${Math.round(m / 60)} h` : `há ${Math.round(m / 1440)} d`;
  };
  root.innerHTML = `<div class="gd-box pf-box">
    <div class="gd-head"><h2>🏅 Seu Perfil</h2><span class="pf-sub">salvo neste navegador</span><button class="gd-close btn small ghost" title="Fechar (Esc)">✖</button></div>
    <div class="gd-body">
      ${rankBox()}
      <div class="pf-stats">
        <div><b>${prof.games}</b><span>partidas</span></div>
        <div><b>${prof.wins}</b><span>vitórias · ${pct(prof.wins)}</span></div>
        <div><b>${prof.top4}</b><span>top 4 · ${pct(prof.top4)}</span></div>
        <div><b>${avg}</b><span>colocação média</span></div>
        <div><b>${prof.stars3}</b><span>robôs ⭐⭐⭐</span></div>
      </div>
      ${fav.length ? `<h4>Robôs favoritos</h4><div class="pf-fav">${fav.map(([id, n]) => {
        const d = UNITS[id];
        return d ? `<div style="--cc:${COST_COLORS[d.cost]}"><img src="${robotPortrait(id, d.look)}" alt=""><span>${esc(d.name)}</span><small>${n}x</small></div>` : '';
      }).join('')}</div>` : ''}
      <h4>Conquistas <small>${got}/${ACHIEVEMENTS.length}</small></h4>
      <div class="pf-achs">${ACHIEVEMENTS.map((a) => {
        const on = !!prof.achievements[a.id];
        const sk = SKINS.find((s) => s.unlock === a.id);
        const ar = ARENAS.find((x) => x.unlock === a.id);
        return `<div class="pf-ach ${on ? 'on' : ''}"><span class="pf-ach-i">${on ? a.icon : '🔒'}</span><div><b>${esc(a.name)}</b><small>${esc(a.desc)}${sk ? ` <i>· libera skin ${esc(sk.name)}</i>` : ''}${ar ? ` <i>· libera arena ${esc(ar.name)}</i>` : ''}</small></div></div>`;
      }).join('')}</div>
      <h4>Skin do tabuleiro</h4>
      <div class="pf-skins">${SKINS.map((s) => {
        const locked = !!s.unlock && !prof.achievements[s.unlock];
        const req = ACHIEVEMENTS.find((a) => a.id === s.unlock);
        return `<button class="pf-skin ${locked ? 'locked' : ''} ${skin().id === s.id ? 'on' : ''}" data-skin="${s.id}" title="${locked ? `Conquista: ${esc(req?.name ?? '')}` : esc(s.name)}">
          <div class="pf-swatch">${[s.enemy[0], s.enemy[1], s.enemy[0], s.mine[1], s.mine[0], s.mine[1]].map((c) => `<i style="background:${c}"></i>`).join('')}<em style="background:${s.neon}"></em></div>
          <span>${locked ? '🔒 ' : ''}${esc(s.name)}</span></button>`;
      }).join('')}</div>
      <h4>Arena</h4>
      <div class="pf-arenas">${ARENAS.map((a) => {
        const locked = !!a.unlock && !prof.achievements[a.unlock];
        const req = ACHIEVEMENTS.find((x) => x.id === a.unlock);
        return `<button class="pf-arena ${locked ? 'locked' : ''} ${arena().id === a.id ? 'on' : ''}" data-arena="${a.id}" title="${locked ? `Conquista: ${esc(req?.name ?? '')}` : esc(a.name)}"
          style="--s1:${a.sky.hor};--s2:${a.sky.mid};--s3:${a.sky.top};--gr:${a.ground};--l1:${a.lights[0]};--l2:${a.lights[1]}">
          <div class="pf-arena-pv"><i></i><b>${a.icon}</b></div>
          <span>${locked ? '🔒 ' : ''}${esc(a.name)}</span>${locked && req ? `<small>${esc(req.name)}</small>` : ''}</button>`;
      }).join('')}</div>
      <h4>Últimas partidas</h4>
      ${prof.history.length ? `<div class="pf-hist">${prof.history.map((h) => `<div class="pf-game p${Math.min(h.place, 5)}">
        <b class="pf-place">${h.place}º</b>
        <div class="pf-gunits">${h.units.slice(0, 9).map((u) => { const d = UNITS[u.d]; return d ? `<img src="${robotPortrait(u.d, d.look)}" style="--cc:${COST_COLORS[d.cost]}" title="${esc(d.name)} ${'★'.repeat(u.s)}" alt="">` : ''; }).join('')}</div>
        <div class="pf-gtraits">${h.traits.map((t) => TRAITS[t] ? traitImg(t, TRAITS[t].color) : '').join('')}</div>
        <small>${h.players} ${h.mode === 'dupla' ? 'duplas' : 'jogadores'}${h.mode && h.mode !== 'normal' ? ` · ${h.mode === 'turbo' ? '⚡ Turbo' : '🤝 Dupla'}` : ''} · ${ago(h.at)}${h.lp !== undefined ? ` · <b class="${h.lp >= 0 ? 'lp-up' : 'lp-down'}">${h.lp >= 0 ? '+' : ''}${h.lp}</b>` : ''}</small>
      </div>`).join('')}</div>` : '<p class="gd-hint">Jogue uma partida para começar seu histórico.</p>'}
    </div></div>`;
}
