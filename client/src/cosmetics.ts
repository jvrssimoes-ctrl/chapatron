import { TIERS } from './rank';
import { ACHIEVEMENTS, unlockStats } from './profile';

// O que libera cada visual da Pequena Lenda e cada emote extra.
// Sem regra = liberado desde o começo.

export interface Unlock { ach?: string; rank?: number; games?: number }

export const UNLOCKS: Record<string, Unlock> = {
  // espécies
  'sp:cacto': { ach: 'campeao' },
  'sp:polvo': { rank: 2 },
  // chapéus
  'hat:gorro': { games: 3 },
  'hat:chef': { ach: 'poupador' },
  'hat:cartola': { rank: 3 },
  'hat:aureola': { ach: 'tristar' },
  'hat:coroa': { rank: 5 },
  // rostos
  'face:bigode': { games: 5 },
  'face:mascara': { ach: 'sequencia' },
  'face:estrela': { ach: 'dano' },
  // rastros
  'trail:faisca': { ach: 'chefao' },
  'trail:coracao': { ach: 'galera' },
  'trail:estrela': { rank: 4 },
  'trail:arcoiris': { ach: 'temporada' },
  // emotes extras (índice em EMOTES)
  'emote:10': { ach: 'poupador' },
  'emote:11': { ach: 'campeao' },
  'emote:12': { ach: 'chefao' },
  'emote:13': { ach: 'veterano' },
  'emote:14': { ach: 'porumfio' },
  'emote:15': { ach: 'mutantes' },
};

export function isUnlocked(key: string) {
  const u = UNLOCKS[key];
  if (!u) return true;
  const st = unlockStats();
  if (u.ach && !st.achievements[u.ach]) return false;
  if (u.rank !== undefined && st.peak < TIERS[u.rank].min) return false;
  if (u.games !== undefined && st.games < u.games) return false;
  return true;
}

/** Texto curto do requisito ("Conquista: Rei da Brisa", "Ranque Ouro Verde"...). */
export function unlockText(key: string) {
  const u = UNLOCKS[key];
  if (!u) return '';
  if (u.ach) return `Conquista: ${ACHIEVEMENTS.find((a) => a.id === u.ach)?.name ?? u.ach}`;
  if (u.rank !== undefined) return `Chegue a ${TIERS[u.rank].icon} ${TIERS[u.rank].name}`;
  if (u.games !== undefined) return `Jogue ${u.games} partidas`;
  return '';
}

/** Todos os desbloqueios ligados a uma conquista (para mostrar no perfil). */
export function rewardsOf(achId: string) {
  return Object.entries(UNLOCKS).filter(([, u]) => u.ach === achId).map(([k]) => k);
}
