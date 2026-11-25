import { TRAITS, UNITS } from './data';
import { ITEMS } from './items';
import type { TraitId } from './types';

type Bonus = Partial<Record<TraitId, number>>;

/** Sinergias do robô contando emblemas equipados. */
export function unitTraits(defId: string, items: string[] = []): TraitId[] {
  const base = UNITS[defId]?.traits ?? [];
  const extra = items.map((i) => ITEMS[i]?.emblem).filter((t): t is TraitId => !!t && !base.includes(t));
  return [...base, ...new Set(extra)];
}

/** Bônus de sinergia vindo dos emblemas (cada robô único conta 1 vez por sinergia). */
export function emblemBonus(units: { defId: string; items?: string[] }[]): Bonus {
  const out: Bonus = {};
  const seen = new Set<string>();
  for (const u of units) {
    const base = UNITS[u.defId]?.traits ?? [];
    for (const it of u.items ?? []) {
      const t = ITEMS[it]?.emblem;
      if (!t || base.includes(t) || seen.has(`${u.defId}:${t}`)) continue;
      seen.add(`${u.defId}:${t}`);
      out[t] = (out[t] ?? 0) + 1;
    }
  }
  return out;
}

export function mergeBonus(...bs: Bonus[]): Bonus {
  const out: Bonus = {};
  for (const b of bs) for (const [t, n] of Object.entries(b) as [TraitId, number][]) out[t] = (out[t] ?? 0) + n;
  return out;
}

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
