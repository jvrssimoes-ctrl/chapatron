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
