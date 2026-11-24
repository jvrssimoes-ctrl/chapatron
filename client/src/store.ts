import type { ServerMsg } from '../../shared/types';

type StateMsg = Extract<ServerMsg, { t: 'state' }>;
type LobbyMsg = Extract<ServerMsg, { t: 'lobby' }>;
type CombatMsg = Extract<ServerMsg, { t: 'combat' }>;
type CarouselMsg = Extract<ServerMsg, { t: 'carousel' }>;

export const store = {
  youId: '',
  room: '',
  lobby: null as LobbyMsg | null,
  state: null as StateMsg | null,
  phaseEndsAt: 0,
  combat: null as CombatMsg | null,
  combatStartedAt: 0,
  scoutId: null as string | null,
  carousel: null as CarouselMsg | null,
  carouselAt: 0,
  /** itens/ouro do último saque, para a Fumacinha coletar os orbes */
  loot: [] as { items: string[]; gold: number; at: number }[],
};

export type { StateMsg, LobbyMsg, CombatMsg, CarouselMsg };
