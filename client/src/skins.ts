// Skins do tabuleiro: só cores, desbloqueadas por conquistas (ver profile.ts).

export interface Skin {
  id: string;
  name: string;
  /** conquista que desbloqueia (vazio = sempre liberada) */
  unlock: string;
  mine: [string, string];
  enemy: [string, string];
  neon: string;
  gapMine: string;
  gapEnemy: string;
  trim: string;
}

export const SKINS: Skin[] = [
  { id: 'padrao', name: 'Brisa Clássica', unlock: '', mine: ['#5c9e78', '#6aad86'], enemy: ['#7a6aae', '#8676ba'], neon: '#5dff7a', gapMine: '#4dff8a', gapEnemy: '#b06bff', trim: '#d9a94a' },
  { id: 'floresta', name: 'Estufa Secreta', unlock: 'veterano', mine: ['#2e7a3a', '#3a8a46'], enemy: ['#5a6a2a', '#667a34'], neon: '#a8ff5d', gapMine: '#5dff7a', gapEnemy: '#d8ff5d', trim: '#8ad860' },
  { id: 'fogo', name: 'Brasa Viva', unlock: 'sequencia', mine: ['#8a4a2a', '#9a5634'], enemy: ['#5a2a3a', '#6a3446'], neon: '#ff6b3d', gapMine: '#ff9a3d', gapEnemy: '#ff3d5a', trim: '#ffb347' },
  { id: 'neon', name: 'Baile Neon', unlock: 'tristar', mine: ['#3a3a8a', '#46469a'], enemy: ['#7a2a6e', '#8a347a'], neon: '#ff3df0', gapMine: '#3dfff0', gapEnemy: '#ff3df0', trim: '#c0c8ff' },
  { id: 'cosmos', name: 'Vazio Cósmico', unlock: 'nivel9', mine: ['#2a4a7a', '#34588a'], enemy: ['#3a2a6a', '#46347a'], neon: '#7ad7ff', gapMine: '#7ad7ff', gapEnemy: '#c58bff', trim: '#a8c8ff' },
  { id: 'ouro', name: 'Trono Dourado', unlock: 'campeao', mine: ['#a8843a', '#bc9448'], enemy: ['#7a5a8e', '#866a9a'], neon: '#ffd23f', gapMine: '#ffcf4a', gapEnemy: '#ff8a3d', trim: '#ffe08a' },
];

let current: Skin = SKINS[0];
const listeners: ((s: Skin) => void)[] = [];

export function skin() { return current; }
export function setSkin(id: string) {
  current = SKINS.find((s) => s.id === id) ?? SKINS[0];
  for (const fn of listeners) fn(current);
}
export function onSkin(fn: (s: Skin) => void) { listeners.push(fn); fn(current); }
