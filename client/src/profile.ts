import { COST_COLORS, TRAITS, UNITS } from '../../shared/data';
import { computeTraits } from '../../shared/traits';
import { traitBonus } from '../../shared/augments';
import type { TraitId } from '../../shared/types';
import { traitImg } from './emblems';
import { banner, esc } from './hud';
import { robotPortrait } from './three/portrait';
import { SKINS, setSkin, skin } from './skins';
import { sfx } from './sfx';
import { store } from './store';

// Perfil local (fica no navegador): estatísticas, histórico, conquistas e skin escolhida.

interface GameRecord { at: number; place: number; players: number; round: number; units: { d: string; s: number }[]; traits: TraitId[] }
interface Profile {
  games: number; wins: number; top4: number;
  places: number[];
  history: GameRecord[];
  unitPlays: Record<string, number>;
  stars3: number;
  achievements: Record<string, number>;
  skin: string;
}

const KEY = 'chapatron_profile';
const blank = (): Profile => ({ games: 0, wins: 0, top4: 0, places: [], history: [], unitPlays: {}, stars3: 0, achievements: {}, skin: 'padrao' });
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
    const tr = computeTraits(board.map((u) => u.defId), traitBonus(me.augments));
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

export function trackGameOver(place: number, players: number) {
  if (!tracking) return;
  tracking = false;
  prof.games++;
  if (place === 1) prof.wins++;
  if (place <= 4) prof.top4++;
  prof.places = [...prof.places, place].slice(-50);
  prof.history = [{ at: Date.now(), place, players, round: store.state?.round ?? 0, units: lastBoard, traits: lastTraits }, ...prof.history].slice(0, 15);
  for (const u of new Set(lastBoard.map((x) => x.d))) prof.unitPlays[u] = (prof.unitPlays[u] ?? 0) + 1;
  save();
  unlock('primeira');
  if (place <= 4) unlock('top4');
  if (place === 1) unlock('campeao');
  if (place <= 4 && minHp <= 10) unlock('porumfio');
  if (prof.games >= 10) unlock('veterano');
  if (Object.keys(prof.unitPlays).length >= 30) unlock('colecionador');
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
        return `<div class="pf-ach ${on ? 'on' : ''}"><span class="pf-ach-i">${on ? a.icon : '🔒'}</span><div><b>${esc(a.name)}</b><small>${esc(a.desc)}${sk ? ` <i>· libera skin ${esc(sk.name)}</i>` : ''}</small></div></div>`;
      }).join('')}</div>
      <h4>Skin do tabuleiro</h4>
      <div class="pf-skins">${SKINS.map((s) => {
        const locked = !!s.unlock && !prof.achievements[s.unlock];
        const req = ACHIEVEMENTS.find((a) => a.id === s.unlock);
        return `<button class="pf-skin ${locked ? 'locked' : ''} ${skin().id === s.id ? 'on' : ''}" data-skin="${s.id}" title="${locked ? `Conquista: ${esc(req?.name ?? '')}` : esc(s.name)}">
          <div class="pf-swatch">${[s.enemy[0], s.enemy[1], s.enemy[0], s.mine[1], s.mine[0], s.mine[1]].map((c) => `<i style="background:${c}"></i>`).join('')}<em style="background:${s.neon}"></em></div>
          <span>${locked ? '🔒 ' : ''}${esc(s.name)}</span></button>`;
      }).join('')}</div>
      <h4>Últimas partidas</h4>
      ${prof.history.length ? `<div class="pf-hist">${prof.history.map((h) => `<div class="pf-game p${Math.min(h.place, 5)}">
        <b class="pf-place">${h.place}º</b>
        <div class="pf-gunits">${h.units.slice(0, 9).map((u) => { const d = UNITS[u.d]; return d ? `<img src="${robotPortrait(u.d, d.look)}" style="--cc:${COST_COLORS[d.cost]}" title="${esc(d.name)} ${'★'.repeat(u.s)}" alt="">` : ''; }).join('')}</div>
        <div class="pf-gtraits">${h.traits.map((t) => TRAITS[t] ? traitImg(t, TRAITS[t].color) : '').join('')}</div>
        <small>${h.players} jogadores · ${ago(h.at)}</small>
      </div>`).join('')}</div>` : '<p class="gd-hint">Jogue uma partida para começar seu histórico.</p>'}
    </div></div>`;
}
