import type { ServerMsg } from '../../shared/types';

type StateMsg = Extract<ServerMsg, { t: 'state' }>;
type LobbyMsg = Extract<ServerMsg, { t: 'lobby' }>;
type CombatMsg = Extract<ServerMsg, { t: 'combat' }>;

export const store = {
  youId: '',
  room: '',
  lobby: null as LobbyMsg | null,
  state: null as StateMsg | null,
  phaseEndsAt: 0,
  combat: null as CombatMsg | null,
  combatStartedAt: 0,
  scoutId: null as string | null,
};

export type { StateMsg, LobbyMsg, CombatMsg };
