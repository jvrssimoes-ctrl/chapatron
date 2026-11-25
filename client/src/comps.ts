import { TRAITS, UNITS } from '../../shared/data';
import { computeTraits } from '../../shared/traits';
import { recommendedItems } from '../../shared/recommend';
import type { TraitId, UnitDef } from '../../shared/types';

// Times recomendados (comps), montados a partir das sinergias: núcleo de uma sinergia
// + robôs que ativam outras, carregador com itens sugeridos. Igual ao "meta" do TFT.

export interface Comp {
  id: string;
  name: string;
  core: TraitId;
  units: string[];
  carry: string;
  tank: string;
  carryItems: string[];
  tankItems: string[];
  traits: { id: TraitId; count: number; tier: number }[];
  score: number;
  tip: string;
}

const SHOP = Object.values(UNITS).filter((u) => !u.pve && !u.summon) as UnitDef[];
const isCarry = (u: UnitDef) => u.role === 'adcarry' || u.role === 'apcaster' || u.role === 'assassin';
const isFront = (u: UnitDef) => u.role === 'tank' || u.role === 'fighter';

function evaluate(ids: string[]) {
  const tr = computeTraits(ids);
  const active = tr.filter((t) => t.tier >= 0);
  return { active, score: active.reduce((s, t) => s + (t.tier + 1) * (TRAITS[t.id].style === 'vertical' ? 1.3 : 1), 0) };
}

function build(core: TraitId, size = 8): Comp | null {
  const t = TRAITS[core];
  const members = SHOP.filter((u) => u.traits.includes(core)).sort((a, b) => b.cost - a.cost);
  const bp = [...t.breakpoints].reverse().find((b) => b <= Math.min(members.length, 6));
  if (!bp) return null;
  const chosen = members.slice(0, bp).map((u) => u.id);
  while (chosen.length < size) {
    let best: string | null = null, bestS = -1;
    for (const u of SHOP) {
      if (chosen.includes(u.id)) continue;
      const s = evaluate([...chosen, u.id]).score + u.cost * 0.15
        + (isFront(u) && chosen.filter((id) => isFront(UNITS[id])).length < 3 ? 0.8 : 0);
      if (s > bestS) { bestS = s; best = u.id; }
    }
    if (!best) break;
    chosen.push(best);
  }
  const defs = chosen.map((id) => UNITS[id]);
  const carry = [...defs].filter(isCarry).sort((a, b) => b.cost - a.cost)[0] ?? defs[0];
  const tank = [...defs].filter(isFront).sort((a, b) => b.cost - a.cost)[0] ?? defs[defs.length - 1];
  const { active, score } = evaluate(chosen);
  const second = active.filter((a) => a.id !== core).sort((a, b) => b.tier - a.tier || b.count - a.count)[0];
  const tip = carry.ability.scale === 'ad'
    ? `Foque itens de ataque no ${carry.name} e segure a linha de frente com ${tank.name}.`
    : `Dê mana e Poder de Habilidade pro ${carry.name}; ${tank.name} segura a frente.`;
  return {
    id: core, core, name: `${t.name}${second ? ` + ${TRAITS[second.id].name}` : ''}`,
    units: chosen.sort((a, b) => UNITS[a].cost - UNITS[b].cost), carry: carry.id, tank: tank.id,
    carryItems: recommendedItems(carry.id, [], 3), tankItems: recommendedItems(tank.id, [], 2),
    traits: active.map((a) => ({ id: a.id, count: a.count, tier: a.tier })).sort((a, b) => b.tier - a.tier || b.count - a.count),
    score, tip,
  };
}

let cache: Comp[] | null = null;
/** Os melhores times (um por sinergia principal). */
export function recommendedComps(n = 8): Comp[] {
  if (cache) return cache.slice(0, n);
  const all = (Object.keys(TRAITS) as TraitId[]).map((t) => build(t)).filter((c): c is Comp => !!c);
  const seen = new Set<string>();
  cache = all.sort((a, b) => b.score - a.score).filter((c) => {
    const key = [c.core, c.traits.find((t) => t.id !== c.core)?.id ?? ''].sort().join('+');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return cache.slice(0, n);
}
