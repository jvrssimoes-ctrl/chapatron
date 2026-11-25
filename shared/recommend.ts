import { UNITS } from './data';
import { ITEMS } from './items';
import type { Role } from './types';

// Itens recomendados por função (e escala da habilidade), em ordem de prioridade.
const BY_ROLE: Record<Role, string[]> = {
  tank: ['caixadagua', 'coracao', 'chapeu', 'cadeado', 'marmita', 'parachoque', 'manto', 'abafador'],
  fighter: ['facaeletrica', 'tampa', 'coracao', 'pocheteraivosa', 'mochila', 'marmita', 'maodestino'],
  adcarry: ['megaseda', 'lancachamas', 'mira', 'bazuca', 'rede', 'tesoura', 'maodestino'],
  apcaster: ['cachimbogig', 'coroa', 'garrafa', 'luvaarcana', 'isqueiroplasma', 'morteiro', 'cristal'],
  assassin: ['tesoura', 'maodestino', 'pocheteraivosa', 'lancachamas', 'facaeletrica', 'tampa'],
  support: ['radio', 'coroa', 'escudocosmico', 'ionizador', 'caixadesom', 'chapeu', 'manto'],
};
const AD_CASTER = ['tesoura', 'lancachamas', 'maodestino', 'pocheteraivosa', 'megaseda', 'mira'];

/** Funções para as quais este item é recomendado. */
export function rolesForItem(itemId: string): Role[] {
  return (Object.keys(BY_ROLE) as Role[]).filter((r) => BY_ROLE[r].slice(0, 5).includes(itemId));
}

/** Até `n` itens completos recomendados para o robô, sem repetir os que ele já tem. */
export function recommendedItems(defId: string, have: string[] = [], n = 3): string[] {
  const def = UNITS[defId];
  if (!def) return [];
  let list = BY_ROLE[def.role] ?? [];
  // conjurador/suporte cuja habilidade escala com DA prefere itens de DA
  if (def.ability.scale === 'ad' && (def.role === 'apcaster' || def.role === 'support')) list = [...AD_CASTER, ...list];
  return [...new Set(list)].filter((id) => ITEMS[id] && !have.includes(id)).slice(0, n);
}
