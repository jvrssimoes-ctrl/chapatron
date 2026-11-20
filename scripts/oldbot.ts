// IA antiga dos bots — usada só como referência em testes A/B (scripts/simtest.ts --ab).
import { MAX_LEVEL, UNITS, XP_COST } from '../shared/data';
import { BENCH_SIZE } from '../shared/hex';
import { computeTraits } from '../shared/traits';
import type { OwnedUnit } from '../shared/types';
import type { Player, Room } from '../server/room';

const TARGET_LEVEL: [number, number][] = [[4, 4], [8, 5], [12, 6], [18, 7], [22, 8], [28, 9]];

function score(u: OwnedUnit) {
  const d = UNITS[u.defId];
  return d.cost * Math.pow(3, u.star - 1) + d.cost * 0.1;
}

export function oldBotPlan(room: Room, p: Player) {
  const round = room.round;
  let target = 1;
  for (const [r, lvl] of TARGET_LEVEL) if (round >= r) target = lvl;
  while (p.level < MAX_LEVEL && p.gold >= XP_COST && (p.level < target || p.gold >= 56)) room.buyXp(p);
  const reserve = round >= 12 ? 30 : round >= 8 ? 20 : round >= 5 ? 10 : 0;
  const traitsWanted = new Set(computeTraits(p.units.map((u) => u.defId)).filter((t) => t.count >= 1).map((t) => t.id));
  const wants = (defId: string) => {
    if (p.units.some((u) => u.defId === defId)) return 3;
    let s = UNITS[defId].traits.filter((t) => traitsWanted.has(t)).length;
    if (p.units.length < p.level + 2) s += 1;
    return s;
  };
  const shopPass = () => {
    for (let i = 0; i < p.shop.length; i++) {
      const id = p.shop[i];
      if (!id) continue;
      const d = UNITS[id];
      const w = wants(id);
      if (w >= 2 && (p.gold - d.cost >= reserve || w >= 3) && p.gold >= d.cost) room.buy(p, i);
    }
  };
  shopPass();
  let rolls = 0;
  const rollFloor = p.hp < 40 ? 10 : 50;
  while (p.gold >= rollFloor + 2 && rolls < 8 && round >= 8) { room.reroll(p); shopPass(); rolls++; }
  const counts = (id: string) => p.units.filter((u) => u.defId === id).length;
  while (p.units.length > p.level + BENCH_SIZE - 3) {
    const cand = p.units.filter((u) => counts(u.defId) === 1).sort((a, b) => score(a) - score(b))[0] ??
      [...p.units].sort((a, b) => score(a) - score(b))[0];
    room.sell(p, cand.id);
  }
  arrange(p);
  room.tryMerge(p);
  const board = p.boardUnits();
  if (board.length && p.itemBench.length) {
    const byScore = [...board].sort((a, b) => score(b) - score(a));
    const carry = byScore.find((u) => ['adcarry', 'apcaster', 'assassin'].includes(UNITS[u.defId].role)) ?? byScore[0];
    const tank = byScore.find((u) => u !== carry && ['tank', 'fighter'].includes(UNITS[u.defId].role));
    const order = [carry, tank, ...byScore.filter((u) => u !== carry && u !== tank)].filter(Boolean) as OwnedUnit[];
    let guard = 30;
    while (p.itemBench.length && guard-- > 0) {
      let done = false;
      for (const u of order) if (room.equip(p, p.itemBench.length - 1, u.id)) { done = true; break; }
      if (!done) break;
    }
  }
}

export function oldBotChoose(p: Player) {
  return Math.floor(Math.random() * (p.choice?.options.length ?? 1));
}

function arrange(p: Player) {
  const sorted = [...p.units].sort((a, b) => score(b) - score(a));
  const chosen: OwnedUnit[] = [];
  const seen = new Set<string>();
  for (const u of sorted) { if (chosen.length >= p.level) break; if (!seen.has(u.defId)) { chosen.push(u); seen.add(u.defId); } }
  for (const u of sorted) { if (chosen.length >= p.level) break; if (!chosen.includes(u)) chosen.push(u); }
  const rest = p.units.filter((u) => !chosen.includes(u));
  const cols = [3, 2, 4, 1, 5, 0, 6];
  const used = new Set<string>();
  const place = (u: OwnedUnit, rows: number[]) => {
    for (const r of rows) for (const c of cols) {
      const k = `${r},${c}`;
      if (!used.has(k)) { used.add(k); u.loc = { zone: 'board', r, c }; return; }
    }
  };
  for (const u of chosen.filter((u) => UNITS[u.defId].range <= 1)) place(u, [0, 1, 2, 3]);
  for (const u of chosen.filter((u) => UNITS[u.defId].range > 1)) place(u, [3, 2, 1, 0]);
  rest.forEach((u, i) => { u.loc = { zone: 'bench', i }; });
}
