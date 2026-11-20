import { TRAITS, UNITS } from './data';
import type { TraitId } from './types';

export interface ActiveTrait {
  id: TraitId;
  count: number;
  tier: number; // -1 = inativo, 0.. = índice do breakpoint atingido
  next: number | null; // próximo breakpoint
}

/** Conta sinergias por unidades ÚNICAS no tabuleiro. */
export function computeTraits(defIds: string[], bonus: Partial<Record<TraitId, number>> = {}): ActiveTrait[] {
  const unique = new Set(defIds);
  const counts = new Map<TraitId, number>();
  for (const id of unique) {
    const def = UNITS[id];
    if (!def) continue;
    for (const t of def.traits) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  for (const [t, n] of Object.entries(bonus) as [TraitId, number][]) {
    if (n) counts.set(t, (counts.get(t) ?? 0) + n);
  }
  const out: ActiveTrait[] = [];
  for (const [id, count] of counts) {
    const bp = TRAITS[id].breakpoints;
    let tier = -1;
    for (let i = 0; i < bp.length; i++) if (count >= bp[i]) tier = i;
    const next = bp.find((b) => b > count) ?? null;
    out.push({ id, count, tier, next });
  }
  out.sort((a, b) => b.tier - a.tier || b.count - a.count || a.id.localeCompare(b.id));
  return out;
}
