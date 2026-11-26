import {
  type C, TAU, OL, SIZE, lg, rg, shade, line, arcLine, circle, rr, T, teardrop, drop, heart, sparkle, bolt, puffs, METAL, GOLD, G,
} from './itemIcons';

// Emblemas: sinergias e papéis (glifo de uma cor, estilo brasão) + aprimoramentos (coloridos com moldura do tier).

let TINT = '#ffffff';
function mixc(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(k >= 1 ? v + (255 - v) * (k - 1) : v * k))).toString(16).padStart(2, '0');
  return `#${ch((n >> 16) & 255)}${ch((n >> 8) & 255)}${ch(n & 255)}`;
}
const isWhite = () => TINT === '#ffffff';
/** Preenchimento do glifo no tom atual (branco = emblema do hexágono). */
function F(c: C, y0 = 12, y1 = 88) {
  return isWhite()
    ? lg(c, 0, y0, 0, y1, '#ffffff', '#eee8fa', '#b8acd4')
    : lg(c, 0, y0, 0, y1, mixc(TINT, 1.55), TINT, mixc(TINT, 0.55));
}
const solid = () => (isWhite() ? '#f4f0fc' : TINT);
const HOLE = 'rgba(22,11,40,0.78)';
function txt(c: C, s: string, x: number, y: number, size: number, fill: string | CanvasGradient) {
  c.font = `900 ${size}px 'Bungee', 'Arial Black', sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.lineJoin = 'round'; c.strokeStyle = OL; c.lineWidth = size * 0.22; c.strokeText(s, x, y);
  c.fillStyle = fill; c.fillText(s, x, y);
}
function shieldPath(c: C) {
  c.moveTo(50, 10); c.quadraticCurveTo(68, 20, 84, 18); c.quadraticCurveTo(86, 66, 50, 90); c.quadraticCurveTo(14, 66, 16, 18); c.quadraticCurveTo(32, 20, 50, 10); c.closePath();
}
function dagger(c: C) {
  shade(c, () => { c.moveTo(50, 8); c.lineTo(59, 22); c.lineTo(57, 60); c.lineTo(43, 60); c.lineTo(41, 22); c.closePath(); }, F(c, 8, 60), { lw: 6 });
  c.beginPath(); c.moveTo(50, 18); c.lineTo(50, 56); c.strokeStyle = 'rgba(22,11,40,0.35)'; c.lineWidth = 2.5; c.stroke();
  shade(c, () => rr(c, 26, 58, 48, 9, 4), F(c, 58, 67), { lw: 6 });
  shade(c, () => rr(c, 44, 66, 12, 18, 3), F(c, 66, 84), { lw: 6 });
  circle(c, 50, 88, 5, F(c, 83, 93), 5, false);
}
function pizza(c: C, cheese: string | CanvasGradient, crust: string | CanvasGradient, pep: string) {
  const slice = () => { c.moveTo(16, 28); c.quadraticCurveTo(50, 14, 84, 28); c.lineTo(50, 90); c.closePath(); };
  shade(c, slice, cheese, { gloss: [36, 34, 8, 12] });
  c.save(); c.beginPath(); slice(); c.clip();
  c.beginPath(); c.moveTo(10, 28); c.quadraticCurveTo(50, 12, 90, 28); c.lineTo(90, 38); c.quadraticCurveTo(50, 22, 10, 38); c.closePath();
  c.fillStyle = crust; c.fill(); c.restore();
  c.beginPath(); c.moveTo(16, 34); c.quadraticCurveTo(50, 19, 84, 34); c.strokeStyle = OL; c.lineWidth = 3; c.stroke();
  for (const [x, y, r] of [[40, 46, 6], [60, 48, 5.5], [50, 66, 5], [48, 80, 3]]) { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fillStyle = pep; c.fill(); }
}

// ---------------- sinergias + papéis ----------------
const TG: Record<string, (c: C) => void> = {
  verdinho: (c) => {
    line(c, [50, 70, 50, 90], solid(), 5);
    shade(c, () => {
      for (const [a, l] of [[-1.3, 26], [-0.65, 34], [0, 44], [0.65, 34], [1.3, 26]] as const) {
        const x = 50, y = 70, ex = x + Math.sin(a) * l, ey = y - Math.cos(a) * l;
        const nx = Math.cos(a) * l * 0.2, ny = Math.sin(a) * l * 0.2, mx = (x + ex) / 2, my = (y + ey) / 2;
        c.moveTo(x, y); c.quadraticCurveTo(mx + nx, my + ny, ex, ey); c.quadraticCurveTo(mx - nx, my - ny, x, y);
      }
    }, F(c, 20, 72), { lw: 6 });
  },
  fumaceiro: (c) => {
    puffs(c, [[34, 66, 14], [53, 58, 18], [71, 68, 12], [50, 76, 12]], F(c, 40, 88), 6);
    puffs(c, [[62, 30, 9], [48, 22, 6.5], [72, 16, 5]], F(c, 10, 40), 6);
    c.strokeStyle = HOLE; c.lineWidth = 3.5; c.lineCap = 'round';
    c.beginPath(); c.arc(52, 62, 7, 0.4, TAU * 0.85); c.stroke();
  },
  larica: (c) => pizza(c, F(c), isWhite() ? '#cfc4e4' : mixc(TINT, 0.6), HOLE),
  ferrugem: (c) => {
    shade(c, () => { for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + Math.PI / 6; c.lineTo(50 + Math.cos(a) * 38, 50 + Math.sin(a) * 38); } c.closePath(); }, F(c), { lw: 6, gloss: [38, 30, 14, 8] });
    c.beginPath(); c.arc(50, 50, 24, 0, TAU); c.lineWidth = 2.5; c.strokeStyle = 'rgba(22,11,40,0.3)'; c.stroke();
    c.beginPath(); c.arc(50, 50, 15, 0, TAU); c.fillStyle = HOLE; c.fill(); c.lineWidth = 4; c.strokeStyle = OL; c.stroke();
  },
  cosmico: (c) => {
    c.save(); c.globalAlpha = 0.45; c.beginPath(); c.moveTo(40, 62); c.lineTo(60, 62); c.lineTo(74, 92); c.lineTo(26, 92); c.closePath(); c.fillStyle = F(c, 60, 92); c.fill(); c.restore();
    shade(c, () => { c.ellipse(50, 46, 18, 20, 0, Math.PI, 0); c.closePath(); }, F(c, 26, 46), { lw: 6, gloss: [44, 34, 5, 6] });
    shade(c, () => c.ellipse(50, 52, 40, 12, 0, 0, TAU), F(c, 40, 64), { lw: 6 });
    for (const x of [26, 42, 58, 74]) { c.beginPath(); c.arc(x, 53, 3.2, 0, TAU); c.fillStyle = HOLE; c.fill(); }
  },
  tanque: (c) => {
    shade(c, () => shieldPath(c), F(c), { lw: 6, gloss: [34, 28, 10, 8] });
    c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = HOLE; c.lineWidth = 6;
    c.beginPath(); c.moveTo(32, 38); c.lineTo(50, 52); c.lineTo(68, 38); c.stroke();
    c.beginPath(); c.moveTo(34, 56); c.lineTo(50, 68); c.lineTo(66, 56); c.stroke();
  },
  atirador: (c) => {
    arcLine(c, 50, 50, 28, 0, TAU, solid(), 7);
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) line(c, [50 + dx * 16, 50 + dy * 16, 50 + dx * 42, 50 + dy * 42], solid(), 7);
    circle(c, 50, 50, 6, F(c, 44, 56), 5, false);
  },
  brisa: (c) => {
    const pts: number[] = [];
    for (let t = 0; t <= 1.0001; t += 0.02) { const a = t * Math.PI * 3.6, r = 3 + t * 36; pts.push(50 + Math.cos(a) * r, 50 + Math.sin(a) * r); }
    line(c, pts, solid(), 8);
  },
  sorrateiro: (c) => dagger(c),
  guru: (c) => {
    for (const [a, h] of [[-1.2, 32], [1.2, 32], [-0.6, 42], [0.6, 42], [0, 52]] as const) T(c, 50, 80, a, 1, () => shade(c, () => { c.moveTo(0, -h); c.bezierCurveTo(17, -h * 0.6, 15, -6, 0, 0); c.bezierCurveTo(-15, -6, -17, -h * 0.6, 0, -h); }, F(c, 28, 80), { lw: 6 }));
    c.lineCap = 'round';
    c.beginPath(); c.moveTo(18, 84); c.quadraticCurveTo(50, 76, 82, 84); c.strokeStyle = OL; c.lineWidth = 10; c.stroke();
    c.strokeStyle = solid(); c.lineWidth = 5; c.stroke();
  },
  dj: (c) => {
    arcLine(c, 50, 54, 30, Math.PI * 1.02, Math.PI * 1.98, solid(), 8);
    shade(c, () => { rr(c, 12, 48, 20, 32, 8); rr(c, 68, 48, 20, 32, 8); }, F(c, 48, 80), { lw: 6, gloss: [18, 54, 4, 8] });
    for (const x of [22, 78]) { c.beginPath(); c.arc(x, 64, 5, 0, TAU); c.fillStyle = HOLE; c.fill(); }
  },
  hacker: (c) => {
    line(c, [34, 28, 14, 50, 34, 72], solid(), 9);
    line(c, [66, 28, 86, 50, 66, 72], solid(), 9);
    line(c, [57, 22, 43, 78], solid(), 8);
  },
  reciclado: (c) => {
    for (let k = 0; k < 3; k++) {
      const a0 = k * (TAU / 3) - Math.PI / 2 + 0.35, a1 = a0 + 1.45, r = 28;
      arcLine(c, 50, 52, r, a0, a1, solid(), 8);
      const px = 50 + Math.cos(a1) * r, py = 52 + Math.sin(a1) * r;
      const dx = -Math.sin(a1), dy = Math.cos(a1), nx = Math.cos(a1), ny = Math.sin(a1);
      shade(c, () => { c.moveTo(px + dx * 13, py + dy * 13); c.lineTo(px + nx * 10, py + ny * 10); c.lineTo(px - nx * 10, py - ny * 10); c.closePath(); }, F(c), { lw: 5 });
    }
  },
  neon: (c) => {
    // tubo de neon em forma de raio dentro de uma moldura arredondada
    c.save(); c.globalAlpha = 0.35; c.fillStyle = rg(c, 50, 50, 44, isWhite() ? '#ffffff' : mixc(TINT, 1.4), 'rgba(255,255,255,0)');
    c.beginPath(); c.arc(50, 50, 44, 0, TAU); c.fill(); c.restore();
    shade(c, () => rr(c, 14, 14, 72, 72, 18), 'rgba(0,0,0,0)', { lw: 5 });
    c.beginPath(); rr(c, 14, 14, 72, 72, 18); c.strokeStyle = solid(); c.lineWidth = 4; c.stroke();
    line(c, [58, 20, 36, 52, 54, 52, 40, 82], solid(), 8);
    for (const [x, y] of [[58, 20], [40, 82]]) circle(c, x, y, 5, F(c, y - 5, y + 5), 4, false);
  },
  paranoico: (c) => {
    // olho arregalado com espiral
    shade(c, () => { c.moveTo(8, 50); c.quadraticCurveTo(50, 8, 92, 50); c.quadraticCurveTo(50, 92, 8, 50); c.closePath(); }, F(c, 22, 78), { lw: 6, gloss: [36, 36, 12, 5] });
    circle(c, 50, 50, 19, HOLE, 4, false);
    const pts: number[] = [];
    for (let k = 0; k <= 1.0001; k += 0.04) { const a = k * Math.PI * 4, r = 2 + k * 14; pts.push(50 + Math.cos(a) * r, 50 + Math.sin(a) * r); }
    c.beginPath(); for (let i = 0; i < pts.length; i += 2) (i ? c.lineTo(pts[i], pts[i + 1]) : c.moveTo(pts[i], pts[i + 1]));
    c.strokeStyle = solid(); c.lineWidth = 3.5; c.lineCap = 'round'; c.stroke();
    for (const [x0, y0, x1, y1] of [[50, 6, 50, 16], [24, 14, 30, 22], [76, 14, 70, 22]]) line(c, [x0, y0, x1, y1], solid(), 5);
  },
  jardineiro: (c) => {
    // broto num vasinho
    shade(c, () => { c.moveTo(28, 62); c.lineTo(72, 62); c.lineTo(64, 90); c.lineTo(36, 90); c.closePath(); }, F(c, 62, 90), { lw: 6 });
    line(c, [50, 62, 50, 36], solid(), 5);
    shade(c, () => { c.moveTo(50, 44); c.bezierCurveTo(40, 20, 18, 24, 14, 30); c.bezierCurveTo(20, 46, 40, 50, 50, 44); }, F(c, 20, 50), { lw: 5 });
    shade(c, () => { c.moveTo(50, 38); c.bezierCurveTo(58, 12, 80, 12, 86, 18); c.bezierCurveTo(82, 36, 62, 44, 50, 38); }, F(c, 12, 44), { lw: 5 });
  },
  muambeiro: (c) => {
    // saco de muamba com cifrão
    shade(c, () => { c.moveTo(38, 28); c.quadraticCurveTo(12, 52, 16, 72); c.quadraticCurveTo(20, 90, 50, 90); c.quadraticCurveTo(80, 90, 84, 72); c.quadraticCurveTo(88, 52, 62, 28); c.closePath(); }, F(c, 28, 90), { lw: 6, gloss: [34, 50, 8, 12] });
    shade(c, () => { c.moveTo(36, 28); c.lineTo(30, 12); c.lineTo(50, 20); c.lineTo(70, 12); c.lineTo(64, 28); c.closePath(); }, F(c, 10, 30), { lw: 5 });
    txt(c, '$', 50, 64, 30, HOLE);
  },
  pirado: (c) => {
    // carinha com olhos em espiral
    circle(c, 50, 50, 38, F(c), 6);
    for (const cx of [36, 64]) {
      const pts: number[] = [];
      for (let k = 0; k <= 1.0001; k += 0.05) { const a = k * Math.PI * 4, r = 1 + k * 9; pts.push(cx + Math.cos(a) * r, 42 + Math.sin(a) * r); }
      c.beginPath(); for (let i = 0; i < pts.length; i += 2) (i ? c.lineTo(pts[i], pts[i + 1]) : c.moveTo(pts[i], pts[i + 1]));
      c.strokeStyle = HOLE; c.lineWidth = 3.5; c.lineCap = 'round'; c.stroke();
    }
    c.beginPath(); c.moveTo(32, 64); c.quadraticCurveTo(42, 74, 50, 64); c.quadraticCurveTo(58, 54, 68, 66); c.strokeStyle = HOLE; c.lineWidth = 5; c.stroke();
  },
  mutante: (c) => {
    // frasco de laboratório borbulhando
    shade(c, () => { c.moveTo(40, 12); c.lineTo(60, 12); c.lineTo(60, 38); c.lineTo(84, 80); c.quadraticCurveTo(88, 90, 76, 90); c.lineTo(24, 90); c.quadraticCurveTo(12, 90, 16, 80); c.lineTo(40, 38); c.closePath(); }, F(c, 12, 90), { lw: 6, gloss: [42, 20, 5, 10] });
    c.save(); c.beginPath(); c.moveTo(30, 62); c.lineTo(70, 62); c.lineTo(84, 82); c.lineTo(16, 82); c.closePath(); c.fillStyle = HOLE; c.fill(); c.restore();
    for (const [x, y, r] of [[38, 72, 5], [56, 68, 4], [62, 78, 3], [48, 50, 3.5], [54, 30, 3]]) circle(c, x, y, r, F(c, y - r, y + r), 3, false);
  },
  eletrico: (c) => bolt(c, 50, 50, 40, F(c, 10, 90)),
  duelista: (c) => {
    // duas espadas cruzadas
    for (const s of [-1, 1]) T(c, 50, 52, s * 0.72, 1, () => {
      shade(c, () => { c.moveTo(0, -44); c.lineTo(6, -36); c.lineTo(5, 14); c.lineTo(-5, 14); c.lineTo(-6, -36); c.closePath(); }, F(c, 8, 66), { lw: 5 });
      shade(c, () => rr(c, -16, 14, 32, 7, 3), F(c, 60, 70), { lw: 5 });
      shade(c, () => rr(c, -4, 21, 8, 16, 3), F(c, 66, 84), { lw: 5 });
    });
  },
  // ----- papéis -----
  r_tank: (c) => TG.tanque(c),
  r_fighter: (c) => {
    shade(c, () => { rr(c, 28, 18, 48, 50, [22, 22, 14, 14]); c.moveTo(35, 50); c.ellipse(26, 46, 9, 13, -0.5, 0, TAU); }, F(c, 18, 68), { lw: 6, gloss: [42, 28, 10, 7] });
    shade(c, () => rr(c, 30, 66, 44, 20, 5), F(c, 66, 86), { lw: 6 });
    c.strokeStyle = HOLE; c.lineWidth = 3.5; c.lineCap = 'round';
    c.beginPath(); c.moveTo(48, 30); c.quadraticCurveTo(62, 34, 66, 48); c.stroke();
  },
  r_assassin: (c) => dagger(c),
  r_adcarry: (c) => {
    arcLine(c, 66, 50, 36, Math.PI * 0.62, Math.PI * 1.38, solid(), 7);
    line(c, [37, 22, 37, 78], solid(), 2.5);
    line(c, [20, 50, 80, 50], solid(), 5);
    shade(c, () => { c.moveTo(92, 50); c.lineTo(78, 41); c.lineTo(78, 59); c.closePath(); }, F(c), { lw: 5 });
    shade(c, () => { c.moveTo(12, 42); c.lineTo(26, 50); c.lineTo(12, 58); c.lineTo(18, 50); c.closePath(); }, F(c), { lw: 4 });
  },
  r_apcaster: (c) => {
    shade(c, () => { c.moveTo(30, 88); c.lineTo(36, 72); c.lineTo(64, 72); c.lineTo(70, 88); c.closePath(); }, F(c, 72, 88), { lw: 6 });
    circle(c, 50, 44, 28, F(c, 16, 72), 6);
    sparkle(c, 50, 44, 15, HOLE); sparkle(c, 64, 30, 5, HOLE);
  },
  r_support: (c) => shade(c, () => { rr(c, 38, 14, 24, 72, 7); rr(c, 14, 38, 72, 24, 7); }, F(c), { lw: 6, gloss: [42, 22, 8, 10] }),
};

// ---------------- aprimoramentos ----------------
const COIN = (c: C, x0: number, x1: number) => lg(c, x0, 0, x1, 0, '#a07000', '#ffe680', '#ffd23f', '#a07000');
const AG: Record<string, (c: C) => void> = {
  heranca: (c) => {
    shade(c, () => { c.moveTo(38, 30); c.quadraticCurveTo(14, 52, 18, 72); c.quadraticCurveTo(22, 90, 50, 90); c.quadraticCurveTo(78, 90, 82, 72); c.quadraticCurveTo(86, 52, 62, 30); c.closePath(); }, lg(c, 14, 30, 86, 90, '#e8d4a8', '#b8905a', '#6a4a24'), { gloss: [34, 50, 8, 12] });
    shade(c, () => { c.moveTo(36, 30); c.lineTo(28, 14); c.lineTo(42, 20); c.lineTo(50, 10); c.lineTo(58, 20); c.lineTo(72, 14); c.lineTo(64, 30); c.closePath(); }, lg(c, 0, 10, 0, 30, '#e8d4a8', '#8a6a3a'), { lw: 5 });
    shade(c, () => rr(c, 34, 28, 32, 7, 3), lg(c, 0, 28, 0, 35, '#ff9a8a', '#c8203d'), { lw: 4 });
    txt(c, '$', 50, 64, 30, GOLD(c, 50, 78));
  },
  rolagratis: (c) => {
    const die = (x: number, y: number, rot: number, pips: number[][]) => T(c, x, y, rot, 1, () => {
      shade(c, () => rr(c, -20, -20, 40, 40, 9), lg(c, -20, -20, 20, 20, '#ffffff', '#e0d8f0', '#9a8ec0'), { lw: 5, gloss: [-8, -12, 10, 5] });
      for (const [px, py] of pips) { c.beginPath(); c.arc(px, py, 4.2, 0, TAU); c.fillStyle = '#c8203d'; c.fill(); }
    });
    die(36, 60, -0.25, [[-10, -10], [10, -10], [0, 0], [-10, 10], [10, 10]]);
    die(66, 36, 0.3, [[-10, -10], [0, 0], [10, 10]]);
    sparkle(c, 82, 74, 8, '#5dff7a');
  },
  xpturbo: (c) => {
    for (const [y, cols, rot] of [[72, ['#8ad8ff', '#1d5ad8'], 0.04], [54, ['#ff9a8a', '#c8203d'], -0.05], [36, ['#b8ff9a', '#2a9e3a'], 0.06]] as [number, string[], number][]) {
      T(c, 48, y, rot, 1, () => {
        shade(c, () => rr(c, -32, -9, 64, 18, 4), lg(c, 0, -9, 0, 9, ...cols), { lw: 5 });
        shade(c, () => rr(c, 18, -6, 12, 12, 2), '#fffaf0', { lw: 2 });
      });
    }
    txt(c, 'XP', 74, 16, 16, lg(c, 0, 8, 0, 24, '#e8fbff', '#4fd8ff'));
  },
  feira: (c) => {
    circle(c, 36, 40, 11, rg(c, 36, 40, 12, '#ffb8a8', '#e0303f', '#7a0a1d'), 5);
    circle(c, 62, 36, 12, rg(c, 62, 36, 13, '#c8ff9a', '#3ab82a', '#0e5a1a'), 5);
    circle(c, 49, 46, 10, rg(c, 49, 46, 11, '#fff2a0', '#ffb81f', '#a86a00'), 5);
    arcLine(c, 50, 50, 30, Math.PI, TAU, '#8a5a2a', 5);
    const basket = () => { c.moveTo(14, 50); c.lineTo(86, 50); c.lineTo(76, 88); c.lineTo(24, 88); c.closePath(); };
    shade(c, basket, lg(c, 0, 50, 0, 88, '#e8b878', '#a86a2a', '#6a3a10'));
    c.save(); c.beginPath(); basket(); c.clip(); c.strokeStyle = 'rgba(60,30,10,0.55)'; c.lineWidth = 2.5;
    for (let y = 58; y < 90; y += 8) { c.beginPath(); c.moveTo(10, y); c.lineTo(90, y); c.stroke(); }
    for (let x = 22; x < 86; x += 10) { c.beginPath(); c.moveTo(x, 50); c.lineTo(x + (50 - x) * 0.15, 90); c.stroke(); }
    c.restore();
  },
  lataforte: (c) => {
    T(c, 44, 48, 0, 0.85, () => T(c, -50, -54, 0, 1, () => G.lataria(c)));
    T(c, 70, 66, 0, 0.42, () => T(c, -50, -50, 0, 1, () => shade(c, () => shieldPath(c), lg(c, 0, 10, 0, 90, '#c8f0ff', '#4fa8ff', '#1d3a8a'), { lw: 9 })));
  },
  dedonervoso: (c) => {
    c.save(); c.globalAlpha = 0.5; c.fillStyle = rg(c, 50, 50, 40, '#fff6a0', 'rgba(255,220,80,0)'); c.beginPath(); c.arc(50, 50, 40, 0, TAU); c.fill(); c.restore();
    bolt(c, 50, 50, 36, lg(c, 0, 14, 0, 88, '#ffffff', '#ffe84a', '#ff9e2a'));
    sparkle(c, 22, 30, 7, '#fff6c8'); sparkle(c, 80, 72, 6, '#fff6c8');
  },
  menteexp: (c) => {
    shade(c, () => rr(c, 44, 66, 12, 18, 3), lg(c, 0, 66, 0, 84, '#ffb8de', '#c8408a'), { lw: 4 });
    puffs(c, [[36, 40, 15], [54, 32, 16], [70, 44, 13], [62, 60, 14], [40, 60, 14], [26, 54, 10]], lg(c, 0, 16, 0, 76, '#ffd8ee', '#ff8ac8', '#c8408a'));
    c.strokeStyle = 'rgba(120,20,70,0.6)'; c.lineWidth = 3; c.lineCap = 'round';
    for (const [x, y, r, a] of [[42, 42, 7, 0], [60, 40, 6, 1], [52, 58, 7, 2], [34, 56, 5, 3]]) { c.beginPath(); c.arc(x, y, r, a, a + 3.6); c.stroke(); }
    for (const [x, y] of [[16, 22], [84, 20], [86, 66]]) sparkle(c, x, y, 7, '#e8d8ff');
  },
  golpecrit: (c) => {
    line(c, [50, 52, 58, 88], '#2a9e3a', 5);
    for (let k = 0; k < 4; k++) T(c, 50, 48, k * (TAU / 4) + Math.PI / 4, 1, () => shade(c, () => heart(c, 0, -15, 13), lg(c, -12, -32, 12, 0, '#c8ff9a', '#3ad84a', '#0e7a2a'), { lw: 5 }));
    sparkle(c, 80, 20, 9, '#fff6c8');
  },
  linhafrente: (c) => {
    for (let r = 0; r < 4; r++) for (let i = -1; i < 4; i++) {
      const x = 14 + i * 24 + (r % 2 ? 12 : 0), y = 20 + r * 17;
      if (x < 4 || x + 22 > 96) continue;
      shade(c, () => rr(c, x, y, 22, 15, 2), lg(c, x, y, x + 22, y + 15, '#ffa88a', '#d8502a', '#8a2a10'), { lw: 4 });
    }
  },
  juroscomp: (c) => {
    for (let i = 0; i < 5; i++) shade(c, () => c.ellipse(36, 82 - i * 9, 22, 8, 0, 0, TAU), COIN(c, 14, 58), { lw: 4 });
    for (let i = 0; i < 3; i++) shade(c, () => c.ellipse(72, 84 - i * 9, 15, 6, 0, 0, TAU), COIN(c, 57, 87), { lw: 4 });
    shade(c, () => { c.moveTo(72, 10); c.lineTo(90, 32); c.lineTo(79, 32); c.lineTo(79, 54); c.lineTo(65, 54); c.lineTo(65, 32); c.lineTo(54, 32); c.closePath(); }, lg(c, 0, 10, 0, 54, '#c8ffd4', '#2fcf5c', '#156a2e'), { lw: 5 });
  },
  nivelja: (c) => {
    shade(c, () => { c.moveTo(50, 8); c.lineTo(86, 46); c.lineTo(64, 46); c.lineTo(64, 88); c.lineTo(36, 88); c.lineTo(36, 46); c.lineTo(14, 46); c.closePath(); }, lg(c, 14, 8, 86, 88, '#e8fbff', '#4fd8ff', '#1d4ab8'), { gloss: [40, 30, 10, 14] });
    txt(c, 'XP', 50, 66, 17, '#ffffff');
  },
  itempronto: (c) => G.maoleve(c),
  furia: (c) => {
    puffs(c, [[16, 26, 7], [10, 18, 5]], '#ffffff'); puffs(c, [[84, 26, 7], [90, 18, 5]], '#ffffff');
    circle(c, 50, 56, 32, rg(c, 50, 56, 34, '#ffb8a0', '#ff4a2a', '#8a0a0a'), 6);
    c.lineCap = 'round'; c.strokeStyle = OL; c.lineWidth = 6;
    c.beginPath(); c.moveTo(30, 40); c.lineTo(44, 48); c.stroke(); c.beginPath(); c.moveTo(70, 40); c.lineTo(56, 48); c.stroke();
    for (const x of [38, 62]) { c.beginPath(); c.arc(x, 55, 4.5, 0, TAU); c.fillStyle = OL; c.fill(); }
    shade(c, () => { c.moveTo(34, 76); c.quadraticCurveTo(50, 62, 66, 76); c.closePath(); }, '#ffffff', { lw: 4 });
  },
  socorro: (c) => {
    arcLine(c, 50, 30, 12, Math.PI, TAU, '#3a3048', 5);
    shade(c, () => rr(c, 14, 30, 72, 56, 10), lg(c, 14, 30, 86, 86, '#ffffff', '#e0e4ee', '#9aa2b8'), { gloss: [28, 38, 14, 6] });
    shade(c, () => { rr(c, 43, 42, 14, 34, 3); rr(c, 33, 52, 34, 14, 3); }, lg(c, 0, 42, 0, 76, '#ff9a8a', '#e0203d', '#8a0a1d'), { lw: 4 });
  },
  artilharia: (c) => {
    circle(c, 46, 54, 34, '#ffffff', 6, false);
    for (const [r, col] of [[27, '#e0303f'], [20, '#ffffff'], [13, '#e0303f'], [6, '#ffffff']] as [number, string][]) { c.beginPath(); c.arc(46, 54, r, 0, TAU); c.fillStyle = col; c.fill(); }
    line(c, [50, 50, 84, 16], '#8a5a2a', 4);
    shade(c, () => { c.moveTo(46, 54); c.lineTo(50, 42); c.lineTo(58, 50); c.closePath(); }, METAL(c, 42, 54), { lw: 3 });
    shade(c, () => { c.moveTo(80, 12); c.lineTo(92, 8); c.lineTo(88, 22); c.lineTo(84, 20); c.closePath(); }, '#ffd23f', { lw: 3 });
  },
  manainf: (c) => {
    drop(c, 46, 88, 24, 74);
    drop(c, 80, 46, 8, 22); drop(c, 18, 40, 6, 16);
    sparkle(c, 38, 54, 6, '#ffffff');
  },
  laricacol: (c) => pizza(c, lg(c, 0, 20, 0, 90, '#fff2a0', '#ffc83a', '#d88a00'), lg(c, 0, 14, 0, 38, '#e8a860', '#a8601f'), '#d8202d'),
  fortuna: (c) => {
    for (let i = 0; i < 4; i++) shade(c, () => rr(c, 14 + i * 2, 68 - i * 10, 56, 18, 3), lg(c, 0, 68 - i * 10, 0, 86 - i * 10, '#b8ffb4', '#2fcf5c', '#156a2e'), { lw: 4 });
    txt(c, '$', 48, 47, 14, '#e8ffe8');
    for (const [x, y] of [[76, 30], [84, 52], [72, 74]]) circle(c, x, y, 9, rg(c, x, y, 10, '#fff6c8', '#ffd23f', '#a07000'), 4);
    for (const [x, y] of [[18, 22], [52, 14], [90, 14]]) sparkle(c, x, y, 7, '#fff6c8');
  },
  caixamist: (c) => {
    c.save(); c.globalAlpha = 0.9; c.fillStyle = rg(c, 50, 22, 28, '#f0d8ff', 'rgba(176,122,255,0)'); c.beginPath(); c.arc(50, 22, 28, 0, TAU); c.fill(); c.restore();
    shade(c, () => { c.moveTo(50, 26); c.lineTo(84, 38); c.lineTo(84, 76); c.lineTo(50, 90); c.lineTo(16, 76); c.lineTo(16, 38); c.closePath(); }, lg(c, 16, 26, 84, 90, '#e8b878', '#b8783a', '#6a3a10'));
    shade(c, () => { c.moveTo(50, 26); c.lineTo(84, 38); c.lineTo(50, 50); c.lineTo(16, 38); c.closePath(); }, lg(c, 0, 26, 0, 50, '#ffd8a0', '#d8984a'), { lw: 4 });
    c.beginPath(); c.moveTo(50, 50); c.lineTo(50, 90); c.strokeStyle = 'rgba(60,30,10,0.5)'; c.lineWidth = 2.5; c.stroke();
    txt(c, '?', 50, 66, 30, lg(c, 0, 50, 0, 82, '#f0d8ff', '#b07aff'));
  },
  brisalend: (c) => {
    const cols = ['#ff5d6a', '#ff9e3d', '#ffe84a', '#5dff7a', '#4fd8ff', '#b07aff'];
    c.beginPath(); c.arc(50, 76, 24, Math.PI, TAU); c.strokeStyle = OL; c.lineWidth = 6 * cols.length + 8; c.stroke();
    cols.forEach((col, i) => { c.beginPath(); c.arc(50, 76, 39 - i * 6, Math.PI, TAU); c.strokeStyle = col; c.lineWidth = 6.5; c.stroke(); });
    puffs(c, [[14, 78, 9], [26, 82, 8], [8, 86, 6]], '#ffffff'); puffs(c, [[86, 78, 9], [74, 82, 8], [92, 86, 6]], '#ffffff');
    sparkle(c, 50, 22, 9, '#ffffff');
  },
  ascensao: (c) => G.turbo(c),
  reciclagem: (c) => {
    TINT = '#5dff7a';
    TG.reciclado(c);
    TINT = '#ffffff';
    circle(c, 74, 74, 15, rg(c, 74, 74, 16, '#fff6c8', '#ffd23f', '#a07000'), 5);
    txt(c, '$', 74, 75, 15, '#7a4a00');
  },
  pazinterior: (c) => {
    circle(c, 50, 50, 38, lg(c, 0, 12, 0, 88, '#e8fbff', '#7ad7ff', '#2a6ab8'), 6);
    c.lineCap = 'round'; c.strokeStyle = '#ffffff'; c.lineWidth = 7;
    c.beginPath(); c.arc(50, 50, 26, 0, TAU); c.stroke();
    c.beginPath(); c.moveTo(50, 24); c.lineTo(50, 76); c.moveTo(50, 52); c.lineTo(32, 68); c.moveTo(50, 52); c.lineTo(68, 68); c.stroke();
    sparkle(c, 84, 18, 8, '#fff6c8');
  },
  vampiro: (c) => {
    shade(c, () => { c.moveTo(12, 30); c.quadraticCurveTo(50, 14, 88, 30); c.lineTo(80, 74); c.quadraticCurveTo(50, 92, 20, 74); c.closePath(); }, lg(c, 0, 20, 0, 90, '#ffb8c8', '#d8203d', '#6a0a1d'), { gloss: [34, 32, 12, 6] });
    c.beginPath(); c.moveTo(22, 44); c.quadraticCurveTo(50, 56, 78, 44); c.lineTo(78, 52); c.quadraticCurveTo(50, 62, 22, 52); c.closePath(); c.fillStyle = OL; c.fill();
    for (const x of [36, 64]) shade(c, () => { c.moveTo(x - 6, 50); c.lineTo(x + 6, 50); c.lineTo(x, 70); c.closePath(); }, '#ffffff', { lw: 3 });
    drop(c, 64, 88, 5, 12);
  },
  presente: (c) => {
    shade(c, () => rr(c, 16, 42, 68, 46, 6), lg(c, 16, 42, 84, 88, '#ff9ae0', '#d83aa8', '#6a0a5a'), { gloss: [26, 48, 14, 6] });
    shade(c, () => rr(c, 12, 32, 76, 14, 4), lg(c, 0, 32, 0, 46, '#ffb8ee', '#e04ab8'), { lw: 5 });
    shade(c, () => { rr(c, 44, 32, 12, 56, 2); }, GOLD(c, 32, 88), { lw: 4 });
    for (const s of [-1, 1]) shade(c, () => { c.ellipse(50 + s * 14, 24, 14, 9, s * 0.5, 0, TAU); }, GOLD(c, 14, 34), { lw: 5 });
    circle(c, 50, 28, 6, GOLD(c, 22, 34), 4);
    for (const [x, y] of [[14, 16], [88, 18], [90, 62]]) sparkle(c, x, y, 7, '#fff6c8');
  },
};

// ---------------- render / cache ----------------
const cache = new Map<string, string>();

function glyphCanvas(draw: (c: C) => void, size: number, tint: string) {
  const gl = document.createElement('canvas');
  gl.width = gl.height = size;
  const g = gl.getContext('2d')!;
  g.scale(size / 100, size / 100);
  TINT = tint;
  try { draw(g); } finally { TINT = '#ffffff'; }
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const c = cv.getContext('2d')!;
  c.shadowColor = 'rgba(0,0,0,0.55)'; c.shadowBlur = size * 0.05; c.shadowOffsetY = size * 0.025;
  c.drawImage(gl, 0, 0);
  return cv;
}
function cached(key: string, make: () => HTMLCanvasElement) {
  let u = cache.get(key);
  if (!u) { u = make().toDataURL('image/png'); cache.set(key, u); }
  return u;
}
const img = (u: string, cls: string) => (u ? `<img class="${cls}" src="${u}" alt="" draggable="false">` : '');

/** Emblema de sinergia: sem cor = branco (hexágono); com cor = tingido (chips, tooltips). */
export function traitIcon(id: string, color?: string) {
  const draw = TG[id];
  return draw ? cached(`t:${id}:${color ?? 'w'}`, () => glyphCanvas(draw, 96, color ?? '#ffffff')) : '';
}
export const traitImg = (id: string, color?: string, cls = 'ti') => img(traitIcon(id, color), cls);
export function roleImg(role: string, color?: string, cls = 'ri') {
  const draw = TG[`r_${role}`];
  return draw ? img(cached(`r:${role}:${color ?? 'w'}`, () => glyphCanvas(draw, 96, color ?? '#ffffff')), cls) : '';
}

const TIER_EDGE: Record<string, (c: C) => CanvasGradient> = {
  prata: (c) => lg(c, 0, 0, 128, 128, '#f4f6fb', '#8a92a6', '#4a5064', '#c8cede', '#6a7286'),
  ouro: (c) => lg(c, 0, 0, 128, 128, '#fff6c8', '#ffcf4a', '#8a5a00', '#ffe680', '#a06a00'),
  prisma: (c) => lg(c, 0, 0, 128, 128, '#ff7ad9', '#7ad7ff', '#5dff7a', '#ffd23f', '#ff7ad9'),
};
const TIER_BG: Record<string, [string, string, string]> = {
  prata: ['#5a6a8a', '#2a3048', '#c7d3e0'], ouro: ['#8a6a1a', '#3a2a10', '#ffd23f'], prisma: ['#8a3ac8', '#1d4a8a', '#d68bff'],
};

export interface AugIconOpts { tier: string; trait?: string; traitColor?: string; bonus?: number; emoji?: string }

/** Ícone de aprimoramento com moldura do tier (128px). */
export function augIcon(id: string, o: AugIconOpts) {
  return cached(`a:${id}`, () => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = SIZE;
    const c = cv.getContext('2d')!;
    const [bgA, bgB, glowC] = TIER_BG[o.tier] ?? TIER_BG.prata;
    c.beginPath(); rr(c, 3, 3, 122, 122, 28); c.fillStyle = (TIER_EDGE[o.tier] ?? TIER_EDGE.prata)(c); c.fill();
    c.lineWidth = 2; c.strokeStyle = 'rgba(0,0,0,0.6)'; c.stroke();
    c.save(); c.beginPath(); rr(c, 10, 10, 108, 108, 22); c.clip();
    const a = o.traitColor ? mixc(o.traitColor, 0.45) : bgA;
    c.fillStyle = lg(c, 10, 10, 118, 118, a, '#120a24', o.traitColor ? '#120a24' : bgB); c.fillRect(0, 0, 128, 128);
    const glow = c.createRadialGradient(64, 60, 4, 64, 60, 62);
    glow.addColorStop(0, `${o.traitColor ?? glowC}99`); glow.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = glow; c.fillRect(0, 0, 128, 128);
    c.globalAlpha = 0.08; c.fillStyle = '#fff';
    for (let i = 0; i < 12; i++) { const a0 = (i / 12) * TAU; c.beginPath(); c.moveTo(64, 60); c.arc(64, 60, 90, a0, a0 + 0.13); c.closePath(); c.fill(); }
    c.globalAlpha = 1;
    c.fillStyle = lg(c, 0, 10, 0, 50, 'rgba(255,255,255,0.16)', 'rgba(255,255,255,0)'); c.fillRect(0, 0, 128, 50);
    c.restore();
    c.beginPath(); rr(c, 10, 10, 108, 108, 22); c.lineWidth = 2; c.strokeStyle = 'rgba(0,0,0,0.7)'; c.stroke();
    const draw = o.trait ? TG[o.trait] : AG[id];
    if (draw) c.drawImage(glyphCanvas(draw, 100, o.trait ? (o.traitColor ?? '#ffffff') : '#ffffff'), 14, 12, 100, 100);
    else { c.font = '60px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(o.emoji ?? '✨', 64, 66); }
    if (o.trait && o.bonus) {
      const g = document.createElement('canvas'); g.width = g.height = 100;
      const gc = g.getContext('2d')!;
      if (o.bonus === 1) shade(gc, () => heart(gc, 50, 50, 28), lg(gc, 0, 20, 0, 80, '#ffc8d8', '#ff3d7a', '#a80a3a'), { lw: 8, gloss: [38, 38, 8, 6] });
      else {
        shade(gc, () => { gc.moveTo(14, 78); gc.lineTo(10, 28); gc.lineTo(32, 50); gc.lineTo(50, 20); gc.lineTo(68, 50); gc.lineTo(90, 28); gc.lineTo(86, 78); gc.closePath(); }, GOLD(gc, 20, 78), { lw: 8 });
      }
      c.save(); c.shadowColor = 'rgba(0,0,0,0.6)'; c.shadowBlur = 5; c.drawImage(g, 78, 78, 44, 44); c.restore();
    }
    if (o.tier === 'prisma') { sparkle(c, 24, 26, 7); sparkle(c, 104, 30, 5, '#7ad7ff'); }
    return cv;
  });
}
