// Roda partidas só com bots, sem rede, para validar regras e balanceamento.
//   npx tsx scripts/simtest.ts 40          → 40 partidas, IA nova
//   npx tsx scripts/simtest.ts 40 --ab     → metade IA nova x metade IA antiga
//   npx tsx scripts/simtest.ts 40 --quiet  → só as estatísticas
import { UNITS } from '../shared/data';
import { AUGMENTS } from '../shared/augments';
import { botChoose, botPlan } from '../server/bot';
import { Player, Room } from '../server/room';
import { oldBotChoose, oldBotPlan } from './oldbot';

const games = Number(process.argv[2] ?? 5);
const AB = process.argv.includes('--ab');
const QUIET = process.argv.includes('--quiet');

let totalRounds = 0;
const durs: Record<string, number[]> = { pve: [], pvp: [] };
const timeouts: Record<string, number> = { pve: 0, pvp: 0 };
const groupPlace: Record<string, number[]> = { nova: [], antiga: [] };
// por unidade: colocações finais de quem terminou com ela no tabuleiro
const unitPlaces: Record<string, number[]> = {};
const unitStars: Record<string, number[]> = {};
const costPlaces: Record<number, number[]> = {};
const augPlaces: Record<string, number[]> = {};
const levelAt: Record<number, number[]> = {};
const push = <K extends string | number>(o: Record<K, number[]>, k: K, v: number) => { (o[k] ??= []).push(v); };

const isOld = (p: Player) => AB && Number(p.id.slice(1)) % 2 === 1;

for (let g = 0; g < games; g++) {
  const room = new Room('TEST', () => {});
  room.setTimer = () => {};
  for (let i = 0; i < 8; i++) room.players.push(new Player(`p${i}`, '', `Bot${i}`, true));
  room.startGame();
  // carrossel: no simulador cada bot pega o robô que escolheria
  const skipCarousel = () => {
    if ((room.phase as string) !== 'carousel' || !room.carousel) return;
    for (const p of room.alive()) {
      const i = room.botCarouselChoice(p);
      const av = room.carousel.avatars.get(p.id);
      if (i >= 0 && av) { room.carousel.units[i].taken = p.id; av.picked = i; }
    }
    room.finishCarousel();
  };
  skipCarousel();
  const snap = new Set<Player>();
  const boards = new Map<Player, { defId: string; star: number }[]>();
  const record = (p: Player) => {
    if (snap.has(p) || !p.place) return;
    snap.add(p);
    push(groupPlace, isOld(p) ? 'antiga' : 'nova', p.place);
    if (isOld(p)) return;
    const seen = new Set<string>();
    for (const u of boards.get(p) ?? []) {
      if (seen.has(u.defId)) continue;
      seen.add(u.defId);
      push(unitPlaces, u.defId, p.place);
      push(unitStars, u.defId, u.star);
      push(costPlaces, UNITS[u.defId].cost, p.place);
    }
    for (const a of p.augments) push(augPlaces, a, p.place);
  };
  let safety = 0;
  while ((room.phase as string) !== 'gameover' && safety++ < 80) {
    for (const p of room.alive()) {
      if (isOld(p)) {
        if (p.choice) room.choose(p, oldBotChoose(p));
        oldBotPlan(room, p);
      } else {
        if (p.choice) room.choose(p, botChoose(room, p));
        botPlan(room, p);
      }
      if (!isOld(p)) push(levelAt, room.round, p.level);
    }
    room.startCombat();
    for (const c of room.pendingCombats) {
      const key = c.pve ? 'pve' : 'pvp';
      durs[key].push(c.result.duration);
      if (c.result.winner === -1) timeouts[key]++;
    }
    for (const p of room.alive()) boards.set(p, p.boardUnits().map((u) => ({ defId: u.defId, star: u.star })));
    room.endCombat();
    skipCarousel();
    for (const p of room.players) record(p);
  }
  const winner = room.players.find((p) => p.place === 1)!;
  totalRounds += room.round;
  if (!QUIET) {
    console.log(`Jogo ${g + 1}: ${winner.name}${isOld(winner) ? ' (antiga)' : ''} r${room.round} nv${winner.level} vida ${winner.hp}:`,
      winner.boardUnits().map((u) => `${UNITS[u.defId].name}${'★'.repeat(u.star)}${u.items.length ? `[${u.items.join('+')}]` : ''}`).join(', '),
      '| aug:', winner.augments.join(','));
  }
  for (const [id, n] of Object.entries(room.pool)) if (n < 0) throw new Error(`pool negativo ${id}`);
}

const avg = (a: number[]) => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length);
const top4 = (a: number[]) => a.filter((x) => x <= 4).length / Math.max(1, a.length);
console.log('\nRodadas médias:', (totalRounds / games).toFixed(1));
for (const k of ['pve', 'pvp']) {
  const d = durs[k].sort((a, b) => a - b);
  console.log(`${k}: ${d.length} combates, média ${(avg(d) / 1000).toFixed(1)}s, mediana ${(d[d.length >> 1] / 1000).toFixed(1)}s, p90 ${(d[Math.floor(d.length * 0.9)] / 1000).toFixed(1)}s, empates/timeout ${timeouts[k]}`);
}
if (AB) for (const [k, v] of Object.entries(groupPlace)) console.log(`IA ${k}: colocação média ${avg(v).toFixed(2)}, top4 ${(top4(v) * 100).toFixed(0)}%, vitórias ${v.filter((x) => x === 1).length}`);
const lv = [12, 15, 19, 25, 30].filter((r) => levelAt[r]).map((r) => `r${r}:${avg(levelAt[r]).toFixed(1)}`).join(' ');
console.log('Nível médio por rodada:', lv);
console.log('\nPor custo (colocação média de quem terminou com):');
for (const c of [1, 2, 3, 4, 5]) console.log(`  custo ${c}: ${avg(costPlaces[c] ?? []).toFixed(2)} (n=${costPlaces[c]?.length ?? 0})`);
console.log('\nUnidades (colocação média · top4 · uso · estrela média):');
const rows = Object.entries(unitPlaces).sort((a, b) => avg(a[1]) - avg(b[1]));
for (const [id, v] of rows) {
  console.log(`  ${UNITS[id].cost}💰 ${UNITS[id].name.padEnd(22)} ${avg(v).toFixed(2)}  ${(top4(v) * 100).toFixed(0).padStart(3)}%  n=${String(v.length).padStart(3)}  ★${avg(unitStars[id]).toFixed(2)}`);
}
console.log('\nAprimoramentos (colocação média · n):');
for (const [id, v] of Object.entries(augPlaces).sort((a, b) => avg(a[1]) - avg(b[1]))) console.log(`  ${AUGMENTS[id].name.padEnd(26)} ${avg(v).toFixed(2)} n=${v.length}`);
