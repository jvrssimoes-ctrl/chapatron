// Arenas: o cenário em volta do tabuleiro (céu, chão, luzes, neblina e partículas).
// Escolhidas no perfil; algumas liberadas por conquistas.

export interface Arena {
  id: string;
  name: string;
  icon: string;
  /** conquista que desbloqueia (vazio = sempre liberada) */
  unlock: string;
  sky: { top: string; mid: string; hor: string; nebA: string; nebB: string };
  fog: string;
  ground: string;
  hemi: [string, string];
  lights: [string, string];
  /** cor das partículas no ar e como se movem (0 = flutuam, >0 sobem, <0 caem) */
  motes: { colors: [string, string, string]; rise: number; size: number };
}

export const ARENAS: Arena[] = [
  {
    id: 'ilha', name: 'Ilha da Brisa', icon: '🏝️', unlock: '',
    sky: { top: '#090416', mid: '#290d42', hor: '#1a524d', nebA: '#8c1fa6', nebB: '#1abf73' },
    fog: '#1a0d2e', ground: '#3d8f4a', hemi: ['#cbb8ff', '#1f4a2a'], lights: ['#5dff7a', '#ff5d9e'],
    motes: { colors: ['#c8ff6a', '#ffd86a', '#7affe8'], rise: 0, size: 1 },
  },
  {
    id: 'vulcao', name: 'Vulcão da Brasa', icon: '🌋', unlock: '',
    sky: { top: '#0d0302', mid: '#3a0a06', hor: '#8a2a0a', nebA: '#ff4a1a', nebB: '#ffb02a' },
    fog: '#2a0c06', ground: '#4a3a32', hemi: ['#ffb08a', '#3a1208'], lights: ['#ff6a2a', '#ffcf3a'],
    motes: { colors: ['#ff7a2a', '#ffcf4a', '#ff3a1a'], rise: 0.9, size: 0.8 },
  },
  {
    id: 'geleira', name: 'Geleira Mentolada', icon: '🧊', unlock: '',
    sky: { top: '#020a18', mid: '#0c2a4a', hor: '#5aa8c8', nebA: '#6ad8ff', nebB: '#d8f4ff' },
    fog: '#14304a', ground: '#b8d8e8', hemi: ['#d8f0ff', '#2a4a6a'], lights: ['#6ad8ff', '#b88aff'],
    motes: { colors: ['#ffffff', '#d8f4ff', '#a8e0ff'], rise: -0.7, size: 0.9 },
  },
  {
    id: 'pantano', name: 'Pântano Neon', icon: '🍄', unlock: 'veterano',
    sky: { top: '#02080a', mid: '#0a2a1e', hor: '#2a5a1a', nebA: '#3aff9a', nebB: '#d8ff3a' },
    fog: '#0a2014', ground: '#2a4a22', hemi: ['#b8ffb8', '#0a2a0a'], lights: ['#3aff9a', '#d8ff3a'],
    motes: { colors: ['#6aff9a', '#d8ff5a', '#3affd8'], rise: 0.25, size: 1.2 },
  },
  {
    id: 'baile', name: 'Baile Espacial', icon: '🪩', unlock: 'tristar',
    sky: { top: '#0a0214', mid: '#2a0a3a', hor: '#5a0a5a', nebA: '#ff3af0', nebB: '#3afff0' },
    fog: '#1a0626', ground: '#2a2a4a', hemi: ['#ffb8f8', '#1a0a3a'], lights: ['#ff3af0', '#3afff0'],
    motes: { colors: ['#ff3af0', '#3afff0', '#ffe83a'], rise: 0, size: 1.3 },
  },
  {
    id: 'olimpo', name: 'Olimpo Dourado', icon: '🏛️', unlock: 'campeao',
    sky: { top: '#140a02', mid: '#4a2a0a', hor: '#c8902a', nebA: '#ffd24a', nebB: '#fff0b8' },
    fog: '#3a2408', ground: '#c8b88a', hemi: ['#fff0c8', '#4a3a1a'], lights: ['#ffd24a', '#ffffff'],
    motes: { colors: ['#ffe08a', '#ffffff', '#ffd24a'], rise: 0.35, size: 1.1 },
  },
];

let current: Arena = ARENAS[0];
const listeners: ((a: Arena) => void)[] = [];
const KEY = 'chapatron_arena';

try { current = ARENAS.find((a) => a.id === localStorage.getItem(KEY)) ?? ARENAS[0]; } catch { /* sem storage */ }

export function arena() { return current; }
export function setArena(id: string) {
  current = ARENAS.find((a) => a.id === id) ?? ARENAS[0];
  try { localStorage.setItem(KEY, current.id); } catch { /* sem storage */ }
  for (const fn of listeners) fn(current);
}
export function onArena(fn: (a: Arena) => void) { listeners.push(fn); fn(current); }
