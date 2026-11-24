// Grade hexagonal "odd-r" (linhas ímpares deslocadas meio hex para a direita).
// O combate acontece numa grade 8x7: o jogador "lado 0" ocupa as linhas 4..7,
// o "lado 1" ocupa 0..3 (espelhado por reflexão pontual).

export const COMBAT_ROWS = 8;
export const COLS = 7;
export const BOARD_ROWS = 4;
export const BENCH_SIZE = 9;

export function toCube(r: number, c: number) {
  const x = c - (r - (r & 1)) / 2;
  const z = r;
  return { x, y: -x - z, z };
}

export function hexDist(r1: number, c1: number, r2: number, c2: number): number {
  const a = toCube(r1, c1);
  const b = toCube(r2, c2);
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y), Math.abs(a.z - b.z));
}

const ODD_DIRS = [[0, 1], [0, -1], [-1, 0], [-1, 1], [1, 0], [1, 1]];
const EVEN_DIRS = [[0, 1], [0, -1], [-1, -1], [-1, 0], [1, -1], [1, 0]];

export function inCombatBounds(r: number, c: number) {
  return r >= 0 && r < COMBAT_ROWS && c >= 0 && c < COLS;
}

export function neighbors(r: number, c: number): [number, number][] {
  const dirs = r & 1 ? ODD_DIRS : EVEN_DIRS;
  const out: [number, number][] = [];
  for (const [dr, dc] of dirs) {
    const nr = r + dr, nc = c + dc;
    if (inCombatBounds(nr, nc)) out.push([nr, nc]);
  }
  return out;
}

/** Converte coordenada local do tabuleiro (linha 0 = frente) para a grade de combate. */
export function localToCombat(r: number, c: number, side: 0 | 1): [number, number] {
  return side === 0 ? [BOARD_ROWS + r, c] : [BOARD_ROWS - 1 - r, COLS - 1 - c];
}

/** Espelha uma posição de combate (vista do outro lado). */
export function flip(r: number, c: number): [number, number] {
  return [COMBAT_ROWS - 1 - r, COLS - 1 - c];
}

/** Centro do hex no plano (odd-r), em unidades de "largura de hex". */
export function hexCenter(r: number, c: number): [number, number] {
  return [c + (r & 1 ? 0.5 : 0), r * 0.866];
}

/** Hex mais próximo de um ponto do plano. */
export function nearestHex(x: number, y: number): [number, number] {
  let best: [number, number] = [0, 0];
  let bd = Infinity;
  const r0 = Math.round(y / 0.866);
  for (let r = r0 - 1; r <= r0 + 1; r++) {
    for (let c = Math.floor(x) - 1; c <= Math.floor(x) + 1; c++) {
      const [hx, hy] = hexCenter(r, c);
      const d = (hx - x) ** 2 + (hy - y) ** 2;
      if (d < bd) { bd = d; best = [r, c]; }
    }
  }
  return best;
}

/** Hexes em linha reta saindo de (r0,c0) na direção de (r1,c1), até a borda da arena. */
export function lineHexes(r0: number, c0: number, r1: number, c1: number): [number, number][] {
  const [x0, y0] = hexCenter(r0, c0);
  const [x1, y1] = hexCenter(r1, c1);
  const len = Math.hypot(x1 - x0, y1 - y0) || 1;
  const dx = (x1 - x0) / len, dy = (y1 - y0) / len;
  const out: [number, number][] = [];
  const seen = new Set<number>([r0 * 100 + c0]);
  for (let k = 0.5; k < 12; k += 0.35) {
    const [r, c] = nearestHex(x0 + dx * k, y0 + dy * k);
    if (!inCombatBounds(r, c)) break;
    const key = r * 100 + c;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push([r, c]);
  }
  return out;
}