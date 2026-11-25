import { UNITS } from '../shared/data';
import { simulate, type SideUnit } from '../server/combat';
import { recommendedItems } from '../shared/recommend';
const shop = Object.values(UNITS).filter((u) => !u.pve && !u.summon);
let seed = 1;
const R = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const place = (defId: string, i: number): [number, number] => {
  const melee = UNITS[defId].range <= 1;
  return [melee ? 0 : 3, (i * 2 + (melee ? 0 : 1)) % 7];
};
function board(n: number, costs: number[], star: number, items: number): SideUnit[] {
  const out: SideUnit[] = [];
  const used = new Set<string>();
  for (let i = 0; i < n; i++) {
    const pool = shop.filter((u) => costs.includes(u.cost) && !used.has(u.id));
    const d = pool[Math.floor(R() * pool.length)]; used.add(d.id);
    const [r, c] = place(d.id, i);
    out.push({ defId: d.id, star, r: r === 0 ? (i < 7 ? 0 : 1) : (i < 7 ? 3 : 2), c: i % 7, items: recommendedItems(d.id, [], items) });
  }
  return out;
}
for (const cost of [3, 4, 5]) {
  for (const [label, mk] of [
    ['vs 6x ★★ (custo 1-3, 1 item)', () => board(6, [1, 2, 3], 2, 1)],
    ['vs 8x ★★ (custo 2-4, 2 itens)', () => board(8, [2, 3, 4], 2, 2)],
  ] as const) {
    let wins = 0, n = 0, dur = 0;
    for (const u of shop.filter((x) => x.cost === cost)) {
      for (let k = 0; k < 6; k++) {
        const [r, c] = place(u.id, 1);
        // o ★★★ com 3 itens + 3 robôs ★★ de custo 1-2 de apoio
        const team: SideUnit[] = [{ defId: u.id, star: 3, r, c: 3, items: recommendedItems(u.id, [], 3) }, ...board(3, [1, 2], 2, 0).map((x, i) => ({ ...x, c: i * 3 % 7 === 3 ? 6 : i * 3 % 7 }))];
        const res = simulate({ units: team }, { units: mk() }, Math.floor(R() * 1e9));
        n++; if (res.winner === 0) { wins++; dur += res.duration; }
      }
    }
    if (cost >= 4) for (const u of shop.filter((x) => x.cost === cost)) {
      let w = 0, d = 0;
      for (let k = 0; k < 8; k++) {
        const [r] = place(u.id, 1);
        const team: SideUnit[] = [{ defId: u.id, star: 3, r, c: 3, items: recommendedItems(u.id, [], 3) }, ...board(3, [1, 2], 2, 0).map((x, i) => ({ ...x, c: [0, 2, 6][i] }))];
        const res = simulate({ units: team }, { units: board(8, [2, 3, 4], 2, 2) }, Math.floor(R() * 1e9));
        if (res.winner === 0) { w++; d += res.duration; }
      }
      if (label.startsWith('vs 8')) console.log(`   ${u.name.padEnd(22)} ${w}/8  ${(d / Math.max(1, w) / 1000).toFixed(1)}s`);
    }
    console.log(`custo ${cost} ★★★ + 3 ajudantes ${label}: vitória ${Math.round(100 * wins / n)}%  duração média das vitórias ${(dur / Math.max(1, wins) / 1000).toFixed(1)}s`);
  }
}