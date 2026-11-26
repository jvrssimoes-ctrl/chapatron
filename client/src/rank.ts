// Ranque local (fica no navegador): pontos sobem/descem pela colocação, igual ao ranqueado do TFT.

export interface Tier { min: number; name: string; icon: string; color: string }

export const TIERS: Tier[] = [
  { min: 0, name: 'Ferro-Velho', icon: '🔩', color: '#9aa3ad' },
  { min: 400, name: 'Lata Amassada', icon: '🥫', color: '#c9824f' },
  { min: 800, name: 'Prata Fumê', icon: '🥈', color: '#d0d8e4' },
  { min: 1200, name: 'Ouro Verde', icon: '🥇', color: '#ffd23f' },
  { min: 1600, name: 'Platina Brisada', icon: '💠', color: '#5dffe0' },
  { min: 2000, name: 'Diamante Chapado', icon: '💎', color: '#7ad7ff' },
  { min: 2400, name: 'Mestre da Brisa', icon: '🔮', color: '#c58bff' },
  { min: 2800, name: 'Chapado Supremo', icon: '👑', color: '#ff5d9e' },
];
const DIV = ['IV', 'III', 'II', 'I'];

/** Ranque de uma pontuação: tier, divisão e pontos dentro da divisão (0–99). */
export function rankOf(lp: number) {
  let i = 0;
  for (let k = 0; k < TIERS.length; k++) if (lp >= TIERS[k].min) i = k;
  const tier = TIERS[Math.max(0, i)];
  const top = i === TIERS.length - 1;
  const inTier = lp - tier.min;
  const div = top ? '' : DIV[Math.min(3, Math.floor(inTier / 100))];
  const pts = top ? inTier : inTier % 100;
  return { tier, index: Math.max(0, i), div, pts, label: `${tier.name}${div ? ` ${div}` : ''}`, top };
}

/** Pontos por colocação (escala para 8 jogadores; no modo Dupla conta a dupla). */
const DELTA_8 = [45, 32, 22, 12, -10, -18, -28, -38];
export function lpDelta(place: number, total: number) {
  if (total < 2) return 0;
  const k = Math.round(((place - 1) * 7) / (total - 1));
  return DELTA_8[Math.max(0, Math.min(7, k))];
}

// ---------------- temporadas (uma por mês) ----------------
const SEASON_NAMES = [
  'Brisa de Estreia', 'Laboratório Clandestino', 'Verão da Larica', 'Noite de Neon', 'Horta Proibida', 'Ferro-Velho Fest',
  'Chuva de Gosma', 'Baile Cósmico', 'Fumaça Dourada', 'Pane no Sistema', 'Colheita Maldita', 'Festa Infinita',
];
/** Temporada atual: começa em nov/2026 (Temporada 1) e vira todo dia 1º. */
export function seasonOf(at = Date.now()) {
  const d = new Date(at);
  const n = Math.max(1, (d.getFullYear() - 2026) * 12 + (d.getMonth() - 10) + 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
  return { n, name: SEASON_NAMES[(n - 1) % SEASON_NAMES.length], end, daysLeft: Math.max(0, Math.ceil((end - at) / 86400000)) };
}
/** Pontos que sobram na virada da temporada (reset parcial). */
export const seasonCarry = (lp: number) => Math.floor(Math.min(lp, 2000) * 0.4);

export function rankBadge(lp: number, cls = '') {
  const r = rankOf(lp);
  return `<span class="rank-badge ${cls}" style="--rc:${r.tier.color}" title="${r.label} · ${r.pts} pontos">${r.tier.icon} ${r.label}</span>`;
}
