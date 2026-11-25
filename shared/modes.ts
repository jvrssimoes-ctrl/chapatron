import type { GameMode } from './types';

// Modos de jogo (igual TFT: normal, Turbo = partida rápida, Dupla = 2v2).

export interface ModeDef { id: GameMode; name: string; icon: string; desc: string; color: string }

export const MODES: Record<GameMode, ModeDef> = {
  normal: { id: 'normal', name: 'Normal', icon: '🌿', color: '#5dff7a', desc: 'A partida completa: economia, juros, XP e até 8 jogadores.' },
  turbo: { id: 'turbo', name: 'Turbo', icon: '⚡', color: '#ffd23f', desc: 'Partida rápida (~15 min): ouro fixo e mais alto, sem juros, nível sobe sozinho, rolar custa 1 e o dano é maior.' },
  dupla: { id: 'dupla', name: 'Dupla', icon: '🤝', color: '#ff7ad9', desc: '2v2: você e sua dupla dividem a vida, lutam contra a mesma dupla adversária e podem mandar itens e robôs um pro outro.' },
};
export const MODE_IDS = Object.keys(MODES) as GameMode[];
/** cor de cada dupla */
export const TEAM_COLORS = ['#5dff7a', '#ff7ad9', '#7ad7ff', '#ffd23f'];

/** Turbo: o nível acompanha a rodada (não dá pra comprar XP). */
export function turboLevel(stage: number, round: number) {
  if (stage <= 1) return round <= 1 ? 3 : 4;
  return Math.min(9, stage + 3);
}
/** Turbo: renda fixa por rodada (sem juros nem sequência). */
export function turboIncome(round: number) { return round <= 2 ? 4 : round <= 4 ? 6 : 9; }
/** Multiplicador do dano que o perdedor leva. */
export function modeDamageMult(mode: GameMode) { return mode === 'turbo' ? 1.8 : mode === 'dupla' ? 0.7 : 1; }
/** Multiplicador do tempo de planejamento. */
export function modePlanningMult(mode: GameMode) { return mode === 'turbo' ? 0.6 : 1; }