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

export function rankBadge(lp: number, cls = '') {
  const r = rankOf(lp);
  return `<span class="rank-badge ${cls}" style="--rc:${r.tier.color}" title="${r.label} · ${r.pts} pontos">${r.tier.icon} ${r.label}</span>`;
}
