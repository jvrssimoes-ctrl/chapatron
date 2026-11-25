import { ITEMS } from '../../shared/items';

// Ícones de itens desenhados em vetor (canvas). Cada glifo é desenhado numa área 100x100,
// com contorno escuro grosso, gradiente e brilho — estilo "ícone de jogo".

type C = CanvasRenderingContext2D;
const TAU = Math.PI * 2;
const OL = '#160b28';
const SIZE = 128;

/** Cor-tema de cada componente (os itens completos misturam as duas da receita). */
const THEME: Record<string, string> = {
  isqueiro: '#ff6a3d', seda: '#4fd8ff', cachimbo: '#b07aff', colirio: '#3d8bff',
  lataria: '#b8c0d0', aluminio: '#8fd0ff', pochete: '#5dff7a', luvas: '#ffd23f',
};

// ---------------- helpers ----------------
function lg(c: C, x0: number, y0: number, x1: number, y1: number, ...cols: string[]) {
  const g = c.createLinearGradient(x0, y0, x1, y1);
  cols.forEach((col, i) => g.addColorStop(cols.length === 1 ? 0 : i / (cols.length - 1), col));
  return g;
}
function rg(c: C, x: number, y: number, r: number, ...cols: string[]) {
  const g = c.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.05, x, y, r);
  cols.forEach((col, i) => g.addColorStop(i / (cols.length - 1), col));
  return g;
}
/** Contorno + preenchimento + brilho (o brilho é recortado pela forma). */
function shade(c: C, path: () => void, fill: string | CanvasGradient, opts: { lw?: number; gloss?: [number, number, number, number] | false } = {}) {
  c.beginPath(); path();
  c.lineJoin = 'round'; c.lineCap = 'round';
  c.strokeStyle = OL; c.lineWidth = opts.lw ?? 6; c.stroke();
  c.fillStyle = fill; c.fill();
  if (opts.gloss) {
    const [x, y, rx, ry] = opts.gloss;
    c.save(); c.clip();
    c.globalAlpha = 0.32; c.fillStyle = '#fff';
    c.beginPath(); c.ellipse(x, y, rx, ry, -0.35, 0, TAU); c.fill();
    c.restore();
  }
}
/** Traço com contorno. */
function line(c: C, pts: number[], color: string | CanvasGradient, w: number, close = false) {
  const p = () => { c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); if (close) c.closePath(); };
  c.lineJoin = 'round'; c.lineCap = 'round';
  p(); c.strokeStyle = OL; c.lineWidth = w + 5; c.stroke();
  p(); c.strokeStyle = color; c.lineWidth = w; c.stroke();
}
function arcLine(c: C, x: number, y: number, r: number, a0: number, a1: number, color: string, w: number) {
  c.lineCap = 'round';
  c.beginPath(); c.arc(x, y, r, a0, a1); c.strokeStyle = OL; c.lineWidth = w + 5; c.stroke();
  c.beginPath(); c.arc(x, y, r, a0, a1); c.strokeStyle = color; c.lineWidth = w; c.stroke();
}
function circle(c: C, x: number, y: number, r: number, fill: string | CanvasGradient, lw = 5, gloss = true) {
  shade(c, () => c.arc(x, y, r, 0, TAU), fill, { lw, gloss: gloss ? [x - r * 0.3, y - r * 0.45, r * 0.6, r * 0.35] : false });
}
function rr(c: C, x: number, y: number, w: number, h: number, r: number | number[]) { c.roundRect(x, y, w, h, r); }
function T(c: C, x: number, y: number, rot: number, s: number, fn: () => void) {
  c.save(); c.translate(x, y); c.rotate(rot); c.scale(s, s); fn(); c.restore();
}
/** Gota / chama: ponta em cima, base redonda (base em y). */
function teardrop(c: C, x: number, y: number, w: number, h: number) {
  c.moveTo(x, y - h);
  c.bezierCurveTo(x + w * 0.2, y - h * 0.6, x + w, y - h * 0.5, x + w, y - w);
  c.arc(x, y - w, w, 0, Math.PI);
  c.bezierCurveTo(x - w, y - h * 0.5, x - w * 0.2, y - h * 0.6, x, y - h);
}
function flame(c: C, x: number, y: number, w: number, h: number, cols = ['#fff27a', '#ff9e2a', '#ff3d2a'], core = '#fffbe0') {
  shade(c, () => teardrop(c, x, y, w, h), lg(c, x, y - h, x, y, ...cols), { lw: 5 });
  c.beginPath(); teardrop(c, x, y - w * 0.15, w * 0.5, h * 0.55); c.fillStyle = core; c.fill();
}
function drop(c: C, x: number, y: number, w: number, h: number, cols = ['#c8f2ff', '#3d9bff', '#1d4ab8']) {
  shade(c, () => teardrop(c, x, y, w, h), lg(c, x - w, y - h, x + w, y, ...cols), { lw: 5, gloss: [x - w * 0.35, y - w * 1.2, w * 0.3, w * 0.5] });
}
function heart(c: C, x: number, y: number, s: number) {
  c.moveTo(x, y + s * 0.9);
  c.bezierCurveTo(x - s * 1.5, y, x - s * 0.8, y - s * 1.1, x, y - s * 0.35);
  c.bezierCurveTo(x + s * 0.8, y - s * 1.1, x + s * 1.5, y, x, y + s * 0.9);
}
function sparkle(c: C, x: number, y: number, r: number, color = '#fff') {
  c.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU - Math.PI / 2;
    const rr2 = i % 2 === 0 ? r : r * 0.22;
    c.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2);
  }
  c.closePath(); c.fillStyle = color; c.shadowColor = color; c.shadowBlur = 6; c.fill(); c.shadowBlur = 0;
}
function bolt(c: C, x: number, y: number, s: number, fill: string | CanvasGradient = '#ffe84a') {
  shade(c, () => {
    const p = [0, -1, 0.55, -1, 0.15, -0.15, 0.6, -0.15, -0.25, 1.05, 0.02, 0.15, -0.45, 0.15];
    c.moveTo(x + p[0] * s, y + p[1] * s);
    for (let i = 2; i < p.length; i += 2) c.lineTo(x + p[i] * s, y + p[i + 1] * s);
    c.closePath();
  }, fill, { lw: 5 });
}
function puffs(c: C, list: number[][], fill: string | CanvasGradient, lw = 5) {
  // contorno de todas primeiro, depois preenchimento (vira uma nuvem única)
  c.beginPath(); for (const [x, y, r] of list) { c.moveTo(x + r, y); c.arc(x, y, r, 0, TAU); }
  c.strokeStyle = OL; c.lineWidth = lw; c.stroke();
  c.fillStyle = fill; c.fill();
  c.save(); c.globalAlpha = 0.3; c.fillStyle = '#fff';
  for (const [x, y, r] of list) { c.beginPath(); c.arc(x - r * 0.3, y - r * 0.35, r * 0.4, 0, TAU); c.fill(); }
  c.restore();
}
function gem(c: C, x: number, y: number, s: number, cols: string[]) {
  shade(c, () => { c.moveTo(x, y - s); c.lineTo(x + s * 0.8, y); c.lineTo(x, y + s); c.lineTo(x - s * 0.8, y); c.closePath(); }, lg(c, x - s, y - s, x + s, y + s, ...cols), { lw: 4 });
  c.beginPath(); c.moveTo(x, y - s); c.lineTo(x - s * 0.8, y); c.lineTo(x, y); c.closePath(); c.fillStyle = 'rgba(255,255,255,0.45)'; c.fill();
}
const METAL = (c: C, y0 = 20, y1 = 80) => lg(c, 0, y0, 0, y1, '#ffffff', '#c8cede', '#7a8296', '#c0c6d4');
const GOLD = (c: C, y0 = 20, y1 = 80) => lg(c, 0, y0, 0, y1, '#fff6c8', '#ffd23f', '#c88a00', '#ffdf6a');

// ---------------- peças reutilizáveis ----------------
function lighter(c: C, body: string[], flameCols?: string[], core?: string) {
  flame(c, 44, 38, 10, 32, flameCols, core);
  shade(c, () => rr(c, 31, 48, 38, 40, 8), lg(c, 31, 48, 69, 88, ...body), { gloss: [40, 56, 8, 14] });
  shade(c, () => rr(c, 29, 37, 42, 13, 4), METAL(c, 37, 50), { lw: 5 });
  circle(c, 61, 33, 6.5, rg(c, 61, 33, 7, '#8a90a0', '#2a2e3a'), 4, false);
}
function pipe(c: C, smoke: string, ember: string[]) {
  puffs(c, [[69, 31, 6], [63, 24, 6.5], [67, 15, 6], [75, 9, 4.5], [61, 9, 3.5]], lg(c, 0, 4, 0, 36, '#ffffff', smoke));
  line(c, [60, 66, 20, 54], lg(c, 20, 50, 60, 70, '#c88a5a', '#6a3a1c'), 9);
  line(c, [22, 55, 13, 52], '#2a1d1d', 9);
  shade(c, () => { c.moveTo(54, 40); c.lineTo(84, 40); c.lineTo(81, 66); c.quadraticCurveTo(69, 82, 57, 66); c.closePath(); }, lg(c, 54, 40, 84, 70, '#e0a070', '#8a4a20', '#4a2410'), { gloss: [62, 48, 6, 10] });
  c.beginPath(); c.ellipse(69, 41, 13, 4.5, 0, 0, TAU); c.fillStyle = lg(c, 0, 37, 0, 45, ...ember); c.fill();
  c.lineWidth = 3; c.strokeStyle = OL; c.stroke();
}
function mitten(c: C, cols: string[], stripe: string) {
  const path = () => {
    c.moveTo(36, 70); c.lineTo(36, 38); c.bezierCurveTo(36, 16, 66, 16, 66, 38); c.lineTo(66, 70); c.closePath();
    c.moveTo(38, 58); c.ellipse(28, 50, 9, 14, -0.6, 0, TAU);
  };
  shade(c, path, lg(c, 30, 20, 66, 72, ...cols), { gloss: [44, 30, 8, 12] });
  c.save(); c.beginPath(); path(); c.clip();
  c.fillStyle = stripe; c.fillRect(20, 44, 60, 6); c.fillRect(20, 56, 60, 4); c.restore();
  shade(c, () => rr(c, 33, 66, 36, 18, 5), lg(c, 0, 66, 0, 84, '#ffffff', '#c8c0d8'), { lw: 5 });
  c.strokeStyle = 'rgba(40,20,60,0.35)'; c.lineWidth = 2;
  for (let x = 39; x < 68; x += 6) { c.beginPath(); c.moveTo(x, 69); c.lineTo(x, 81); c.stroke(); }
}
function pouch(c: C, cols: string[], strap: string) {
  line(c, [8, 50, 30, 46], strap, 7); line(c, [70, 46, 92, 50], strap, 7);
  shade(c, () => { c.moveTo(24, 42); c.lineTo(76, 42); c.quadraticCurveTo(80, 82, 50, 84); c.quadraticCurveTo(20, 82, 24, 42); c.closePath(); }, lg(c, 24, 40, 76, 84, ...cols), { gloss: [38, 50, 10, 6] });
  c.strokeStyle = 'rgba(0,0,0,0.45)'; c.lineWidth = 2.5; c.setLineDash([3, 3]);
  c.beginPath(); c.moveTo(27, 54); c.quadraticCurveTo(50, 58, 73, 54); c.stroke(); c.setLineDash([]);
  shade(c, () => rr(c, 64, 52, 6, 12, 2), GOLD(c, 52, 64), { lw: 3 });
}
function can(c: C, x: number, y: number, w: number, h: number, body: CanvasGradient, top: string) {
  const rx = w / 2, ry = w * 0.17, cx = x + rx;
  const path = () => { c.moveTo(x, y); c.lineTo(x, y + h); c.ellipse(cx, y + h, rx, ry, 0, Math.PI, 0, true); c.lineTo(x + w, y); c.ellipse(cx, y, rx, ry, 0, 0, Math.PI, true); c.closePath(); };
  shade(c, path, body);
  c.beginPath(); c.ellipse(cx, y, rx, ry, 0, 0, TAU); c.fillStyle = top; c.fill(); c.lineWidth = 3; c.strokeStyle = OL; c.stroke();
  c.beginPath(); c.ellipse(cx, y, rx * 0.72, ry * 0.62, 0, 0, TAU); c.fillStyle = 'rgba(0,0,0,0.25)'; c.fill();
  return path;
}

// ---------------- glifos ----------------
const G: Record<string, (c: C) => void> = {
  // ===== componentes =====
  isqueiro: (c) => lighter(c, ['#ff8a7a', '#e0303f', '#8a1428']),
  seda: (c) => {
    for (const [y, l] of [[38, 14], [52, 20], [66, 12]]) line(c, [12, y, 12 + l, y], '#7ae8ff', 4);
    shade(c, () => rr(c, 40, 15, 30, 18, 3), '#ffffff', { lw: 5 });
    shade(c, () => rr(c, 33, 26, 44, 56, 6), lg(c, 33, 26, 77, 82, '#fffaf0', '#e8d8b0', '#c8b080'), { gloss: [44, 36, 10, 14] });
    shade(c, () => rr(c, 33, 26, 44, 16, [6, 6, 0, 0]), lg(c, 0, 26, 0, 42, '#9dffb4', '#2fcf5c', '#1d8a3c'), { lw: 5 });
    bolt(c, 56, 62, 12, lg(c, 0, 50, 0, 75, '#e8fbff', '#4fd8ff'));
  },
  cachimbo: (c) => pipe(c, '#c8a0ff', ['#fff27a', '#ff5d2a']),
  colirio: (c) => {
    shade(c, () => { c.moveTo(42, 44); c.lineTo(50, 20); c.lineTo(58, 44); c.closePath(); }, lg(c, 42, 20, 58, 44, '#ffffff', '#b8c8e0'), { lw: 5 });
    shade(c, () => rr(c, 34, 42, 32, 44, 9), lg(c, 34, 42, 66, 86, '#f4fbff', '#a8d0f0', '#5a8ac0'), { gloss: [42, 52, 6, 12] });
    shade(c, () => rr(c, 34, 58, 32, 13, 0), lg(c, 0, 58, 0, 71, '#6ab4ff', '#1d5ad8'), { lw: 3 });
    drop(c, 76, 64, 9, 26);
  },
  lataria: (c) => {
    const path = can(c, 28, 30, 44, 46, lg(c, 28, 0, 72, 0, '#7a8296', '#f4f6fb', '#c8cede', '#6a7286'), '#dfe4ee');
    c.save(); c.beginPath(); path(); c.clip();
    c.fillStyle = lg(c, 28, 0, 72, 0, '#8a1d2a', '#ff5d6a', '#b8203d'); c.fillRect(20, 46, 70, 16);
    c.fillStyle = 'rgba(255,255,255,0.8)'; c.fillRect(20, 46, 70, 2); c.restore();
    shade(c, () => rr(c, 50, 22, 14, 7, 3), METAL(c, 22, 29), { lw: 3 });
  },
  aluminio: (c) => {
    const P = [22, 40, 38, 20, 58, 27, 80, 18, 84, 46, 75, 74, 52, 84, 28, 77, 16, 58];
    const path = () => { c.moveTo(P[0], P[1]); for (let i = 2; i < P.length; i += 2) c.lineTo(P[i], P[i + 1]); c.closePath(); };
    shade(c, path, lg(c, 16, 18, 84, 84, '#ffffff', '#c8dcf0', '#8aa0c0', '#e8f2ff', '#7a90b0'));
    c.save(); c.beginPath(); path(); c.clip();
    for (let i = 0; i < P.length; i += 2) {
      const j = (i + 2) % P.length;
      c.beginPath(); c.moveTo(50, 52); c.lineTo(P[i], P[i + 1]); c.lineTo(P[j], P[j + 1]); c.closePath();
      c.fillStyle = i % 4 === 0 ? 'rgba(255,255,255,0.35)' : 'rgba(40,60,110,0.22)'; c.fill();
    }
    c.restore();
    sparkle(c, 66, 34, 8, '#e8f8ff');
  },
  pochete: (c) => {
    pouch(c, ['#9dffb4', '#2fcf5c', '#156a2e'], '#2a4a34');
    shade(c, () => heart(c, 50, 68, 8), lg(c, 0, 58, 0, 76, '#ff9aaa', '#e0203d'), { lw: 4 });
  },
  luvas: (c) => { mitten(c, ['#ffe680', '#ffb81f', '#c87a00'], 'rgba(255,80,110,0.85)'); sparkle(c, 76, 26, 10, '#fff6c8'); },

  // ===== isqueiro + =====
  lancachamas: (c) => {
    T(c, 66, 46, 1.15, 1, () => flame(c, 0, 4, 12, 40));
    shade(c, () => rr(c, 14, 70, 22, 18, 5), lg(c, 0, 70, 0, 88, '#ff8a7a', '#c8203d'), { lw: 5 });
    T(c, 40, 62, -0.42, 1, () => { shade(c, () => rr(c, -28, -8, 56, 16, 6), METAL(c, -8, 8), { lw: 5 }); shade(c, () => rr(c, 22, -11, 10, 22, 3), '#3a3a4a', { lw: 4 }); });
  },
  bazuca: (c) => {
    T(c, 44, 60, -0.5, 1, () => {
      shade(c, () => rr(c, -34, -10, 66, 20, 7), lg(c, 0, -10, 0, 10, '#c8ff9a', '#4ac83a', '#1d6a1d'), { lw: 5, gloss: [-10, -6, 20, 3] });
      shade(c, () => rr(c, 26, -14, 12, 28, 4), lg(c, 0, -14, 0, 14, '#ffe680', '#c88a00'), { lw: 5 });
      shade(c, () => rr(c, -12, 8, 9, 14, 3), '#2a2a3a', { lw: 4 });
    });
    for (const [x, y] of [[78, 24], [66, 14], [88, 40], [62, 30]]) puffs(c, [[x, y, 5], [x + 5, y - 2, 4.5], [x + 2, y + 4, 4.5]], rg(c, x, y, 9, '#ffffff', '#fff2c0', '#e8c060'), 4);
  },
  isqueiroplasma: (c) => {
    lighter(c, ['#d8a0ff', '#8a3ae0', '#3a1478'], ['#ffffff', '#ff5de8', '#8a2aff'], '#ffe8ff');
    shade(c, () => heart(c, 50, 70, 7), lg(c, 0, 60, 0, 78, '#ff9aaa', '#e0203d'), { lw: 4 });
  },
  cristal: (c) => {
    const P = [50, 12, 76, 38, 64, 88, 36, 88, 24, 38];
    const path = () => { c.moveTo(P[0], P[1]); for (let i = 2; i < P.length; i += 2) c.lineTo(P[i], P[i + 1]); c.closePath(); };
    shade(c, path, lg(c, 24, 12, 76, 88, '#e8faff', '#7ac8ff', '#3d5aff', '#2a1d9e'));
    c.save(); c.beginPath(); path(); c.clip();
    c.fillStyle = 'rgba(255,255,255,0.4)'; c.beginPath(); c.moveTo(50, 12); c.lineTo(24, 38); c.lineTo(44, 44); c.closePath(); c.fill();
    c.fillStyle = 'rgba(20,10,80,0.3)'; c.beginPath(); c.moveTo(50, 12); c.lineTo(76, 38); c.lineTo(56, 44); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.15)'; c.beginPath(); c.moveTo(44, 44); c.lineTo(56, 44); c.lineTo(64, 88); c.lineTo(36, 88); c.closePath(); c.fill();
    c.restore();
    sparkle(c, 74, 20, 9, '#e8fbff'); sparkle(c, 26, 66, 6, '#c8e8ff');
  },
  tampa: (c) => {
    shade(c, () => { c.ellipse(50, 66, 36, 30, 0, Math.PI, 0); c.closePath(); }, lg(c, 14, 36, 86, 66, '#ffffff', '#c8cede', '#6a7286'), { gloss: [36, 48, 14, 7] });
    shade(c, () => c.ellipse(50, 67, 39, 8, 0, 0, TAU), lg(c, 0, 59, 0, 75, '#e8ecf4', '#5a6276'), { lw: 5 });
    shade(c, () => rr(c, 41, 28, 18, 10, 4), lg(c, 0, 28, 0, 38, '#5a4a6a', '#1a1424'), { lw: 4 });
    sparkle(c, 70, 44, 9);
  },
  facaeletrica: (c) => {
    T(c, 50, 52, 0.75, 1, () => {
      shade(c, () => { c.moveTo(-6, -8); c.lineTo(-6, -40); c.quadraticCurveTo(10, -30, 8, -8); c.closePath(); }, lg(c, -6, 0, 8, 0, '#ffffff', '#b8c4d8', '#7a8aa6'), { lw: 5 });
      shade(c, () => rr(c, -10, -10, 20, 6, 2), GOLD(c, -10, -4), { lw: 4 });
      shade(c, () => rr(c, -7, -4, 14, 34, 5), lg(c, -7, 0, 7, 0, '#4a4060', '#1a1424'), { lw: 5 });
    });
    bolt(c, 26, 34, 14, lg(c, 0, 20, 0, 48, '#ffffff', '#ffe84a', '#ff9e2a'));
    bolt(c, 78, 72, 10, lg(c, 0, 62, 0, 82, '#ffffff', '#7ae8ff'));
  },
  pocheteraivosa: (c) => {
    puffs(c, [[24, 26, 7], [18, 20, 5]], '#ffffff'); puffs(c, [[78, 24, 7], [84, 18, 5]], '#ffffff');
    pouch(c, ['#ff9a8a', '#e0303f', '#7a1020'], '#4a1a24');
    c.fillStyle = '#fff'; c.strokeStyle = OL; c.lineWidth = 3;
    for (const x of [40, 60]) { c.beginPath(); c.ellipse(x, 68, 5, 6, 0, 0, TAU); c.fill(); c.stroke(); c.beginPath(); c.arc(x, 69, 2.5, 0, TAU); c.fillStyle = OL; c.fill(); c.fillStyle = '#fff'; }
    line(c, [33, 58, 45, 63], OL, 3); line(c, [67, 58, 55, 63], OL, 3);
  },
  tesoura: (c) => {
    for (const s of [-1, 1]) {
      T(c, 50, 56, s * 0.32, 1, () => {
        shade(c, () => { c.moveTo(-5 * s, 0); c.lineTo(0, -44); c.lineTo(6 * s, 0); c.closePath(); }, lg(c, -6, 0, 6, 0, '#ffffff', '#ffd23f', '#a07000'), { lw: 5 });
      });
    }
    for (const s of [-1, 1]) {
      const x = 50 + s * 15, y = 78;
      line(c, [50, 58, x, y - 6], GOLD(c, 58, 72), 6);
      c.beginPath(); c.arc(x, y, 10, 0, TAU); c.strokeStyle = OL; c.lineWidth = 12; c.stroke();
      c.beginPath(); c.arc(x, y, 10, 0, TAU); c.strokeStyle = s < 0 ? '#ff5d6a' : '#ff5d6a'; c.lineWidth = 6; c.stroke();
    }
    circle(c, 50, 57, 5, GOLD(c, 52, 62), 4);
    sparkle(c, 70, 18, 8, '#fff6c8');
  },
  // ===== seda + =====
  megaseda: (c) => {
    const rows: [number, number, number][] = [[22, 36, 0], [36, 28, 4], [50, 21, -3], [62, 14, 3], [74, 9, -1], [84, 5, 1]];
    for (const [y, rx, dx] of rows) {
      c.beginPath(); c.ellipse(50 + dx, y, rx, rx * 0.28, 0, 0, TAU); c.strokeStyle = OL; c.lineWidth = 10; c.stroke();
    }
    for (const [y, rx, dx] of rows) {
      c.beginPath(); c.ellipse(50 + dx, y, rx, rx * 0.28, 0, 0, TAU); c.strokeStyle = lg(c, 50 - rx, 0, 50 + rx, 0, '#ffffff', '#7ae8ff', '#2a8ad8'); c.lineWidth = 5; c.stroke();
    }
    shade(c, () => rr(c, 70, 34, 14, 10, 2), '#fffaf0', { lw: 4 }); shade(c, () => rr(c, 14, 50, 12, 9, 2), '#fffaf0', { lw: 4 });
  },
  turbo: (c) => {
    T(c, 52, 50, 0.75, 1, () => {
      flame(c, 0, 52, 9, 26, ['#ffffff', '#7ae8ff', '#2a5aff'], '#ffffff');
      c.save(); c.scale(1, -1); flame(c, 0, -30, 9, 22, ['#ffffff', '#ffe84a', '#ff5d2a']); c.restore();
      for (const s of [-1, 1]) shade(c, () => { c.moveTo(12 * s, 6); c.lineTo(22 * s, 26); c.lineTo(10 * s, 24); c.closePath(); }, lg(c, 0, 6, 0, 26, '#ff8a7a', '#c8203d'), { lw: 5 });
      shade(c, () => { c.moveTo(0, -38); c.bezierCurveTo(18, -24, 14, 12, 12, 26); c.lineTo(-12, 26); c.bezierCurveTo(-14, 12, -18, -24, 0, -38); c.closePath(); }, lg(c, -14, 0, 14, 0, '#ffffff', '#d8dee8', '#8a92a6'), { gloss: [-5, -14, 4, 12] });
      shade(c, () => { c.moveTo(0, -38); c.bezierCurveTo(9, -31, 11, -24, 11.5, -20); c.lineTo(-11.5, -20); c.bezierCurveTo(-11, -24, -9, -31, 0, -38); c.closePath(); }, lg(c, 0, -38, 0, -20, '#ff8a7a', '#c8203d'), { lw: 4 });
      circle(c, 0, -4, 6.5, rg(c, 0, -4, 7, '#e8fbff', '#4fd8ff', '#1d4a8a'), 4);
    });
  },
  tocha: (c) => {
    T(c, 50, 70, -0.2, 1, () => {
      shade(c, () => rr(c, -6, -6, 12, 34, 4), lg(c, -6, 0, 6, 0, '#c88a5a', '#6a3a1c'), { lw: 5 });
      shade(c, () => { c.moveTo(-16, -18); c.lineTo(16, -18); c.lineTo(8, -2); c.lineTo(-8, -2); c.closePath(); }, METAL(c, -18, -2), { lw: 5 });
    });
    c.save(); c.globalAlpha = 0.5; c.fillStyle = rg(c, 48, 32, 26, '#bff4ff', 'rgba(80,200,255,0)'); c.beginPath(); c.arc(48, 32, 26, 0, TAU); c.fill(); c.restore();
    bolt(c, 48, 32, 22, lg(c, 0, 10, 0, 56, '#ffffff', '#bff4ff', '#4fd8ff'));
  },
  coleteseda: (c) => {
    const path = () => {
      c.moveTo(30, 16); c.lineTo(42, 16); c.lineTo(50, 40); c.lineTo(58, 16); c.lineTo(70, 16);
      c.quadraticCurveTo(70, 34, 80, 40); c.lineTo(80, 84); c.lineTo(20, 84); c.lineTo(20, 40); c.quadraticCurveTo(30, 34, 30, 16); c.closePath();
    };
    shade(c, path, lg(c, 20, 16, 80, 84, '#ffd08a', '#ff8a2a', '#c8460a'), { gloss: [34, 40, 7, 14] });
    c.save(); c.beginPath(); path(); c.clip();
    c.fillStyle = lg(c, 0, 58, 0, 66, '#ffffff', '#b8c8d8'); c.fillRect(10, 58, 80, 7); c.fillRect(10, 72, 80, 5); c.restore();
    line(c, [50, 42, 50, 84], '#6a2a0a', 2);
    bolt(c, 64, 46, 7, '#7ae8ff');
  },
  rede: (c) => {
    const cx = 48, cy = 54;
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; line(c, [cx, cy, cx + Math.cos(a) * 38, cy + Math.sin(a) * 38], '#e8e0ff', 2.5); }
    for (const r of [12, 23, 34]) {
      const pts: number[] = [];
      for (let i = 0; i <= 8; i++) { const a = (i / 8) * TAU; pts.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
      line(c, pts, '#e8e0ff', 2.5);
    }
    circle(c, 78, 22, 10, rg(c, 78, 22, 11, '#ffffff', '#ff5d6a', '#a8102a'));
    c.save(); c.beginPath(); c.arc(78, 22, 10, 0, TAU); c.clip(); c.fillStyle = '#fff'; c.fillRect(66, 20, 24, 4); c.restore();
  },
  caixadesom: (c) => {
    for (const r of [12, 21, 30]) arcLine(c, 64, 50, r, -0.65, 0.65, '#7ae8ff', 4);
    shade(c, () => rr(c, 18, 18, 42, 68, 7), lg(c, 18, 18, 60, 86, '#5a4a8a', '#2a2048', '#140c24'), { gloss: [26, 26, 8, 12] });
    for (const [y, r] of [[34, 8], [62, 14]]) {
      circle(c, 39, y, r, rg(c, 39, y, r, '#8a7ac0', '#1a1430'), 4, false);
      c.beginPath(); c.arc(39, y, r * 0.4, 0, TAU); c.fillStyle = '#4fd8ff'; c.shadowColor = '#4fd8ff'; c.shadowBlur = 8; c.fill(); c.shadowBlur = 0;
    }
  },
  mira: (c) => {
    c.save(); c.globalAlpha = 0.6; line(c, [12, 88, 56, 46], '#ff3d5a', 3); c.restore();
    arcLine(c, 56, 46, 26, 0, TAU, '#ff5d6a', 5);
    arcLine(c, 56, 46, 13, 0, TAU, '#ff5d6a', 3);
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) line(c, [56 + dx * 18, 46 + dy * 18, 56 + dx * 36, 46 + dy * 36], '#ff8a9a', 4);
    circle(c, 56, 46, 4, '#ffffff', 3, false);
    shade(c, () => { T(c, 18, 82, -0.76, 1, () => rr(c, -6, -14, 12, 26, 4)); }, '#3a3a4a', { lw: 4 });
  },
  // ===== cachimbo + =====
  cachimbogig: (c) => {
    T(c, 50, 54, 0, 1.1, () => T(c, -52, -50, 0, 1, () => pipe(c, '#ffb08a', ['#ffffff', '#ffe84a', '#ff3d2a'])));
    sparkle(c, 24, 30, 7, '#ffd08a');
  },
  garrafa: (c) => {
    const path = () => { c.moveTo(43, 14); c.lineTo(57, 14); c.lineTo(57, 34); c.quadraticCurveTo(74, 42, 74, 58); c.lineTo(74, 80); c.quadraticCurveTo(74, 88, 66, 88); c.lineTo(34, 88); c.quadraticCurveTo(26, 88, 26, 80); c.lineTo(26, 58); c.quadraticCurveTo(26, 42, 43, 34); c.closePath(); };
    shade(c, path, lg(c, 26, 14, 74, 88, '#b8ffcc', '#2fcf5c', '#0e5a2a'));
    c.save(); c.beginPath(); path(); c.clip();
    c.fillStyle = lg(c, 0, 50, 0, 88, '#e0a8ff', '#8a3ae0'); c.globalAlpha = 0.85;
    c.beginPath(); c.moveTo(20, 58); c.bezierCurveTo(35, 50, 55, 66, 80, 54); c.lineTo(80, 90); c.lineTo(20, 90); c.closePath(); c.fill();
    c.globalAlpha = 0.35; c.fillStyle = '#fff'; c.fillRect(31, 44, 6, 38); c.restore();
    shade(c, () => rr(c, 41, 8, 18, 10, 3), lg(c, 0, 8, 0, 18, '#e0a070', '#8a4a20'), { lw: 4 });
    for (const [x, y, r] of [[56, 70, 3], [48, 78, 2], [62, 62, 2]]) { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fillStyle = 'rgba(255,255,255,0.8)'; c.fill(); }
  },
  escudocosmico: (c) => {
    const path = () => { c.moveTo(50, 12); c.quadraticCurveTo(68, 22, 82, 20); c.quadraticCurveTo(84, 66, 50, 88); c.quadraticCurveTo(16, 66, 18, 20); c.quadraticCurveTo(32, 22, 50, 12); c.closePath(); };
    shade(c, path, lg(c, 18, 12, 82, 88, '#a8b8ff', '#5a3ae0', '#1d1060'), { gloss: [34, 28, 10, 8] });
    c.save(); c.beginPath(); path(); c.clip();
    for (const [x, y] of [[30, 64], [68, 34], [62, 70], [36, 34]]) { c.fillStyle = '#fff'; c.fillRect(x, y, 2, 2); }
    c.restore();
    c.beginPath(); c.ellipse(50, 50, 24, 7, -0.35, Math.PI, TAU); c.strokeStyle = OL; c.lineWidth = 8; c.stroke(); c.strokeStyle = '#ffd08a'; c.lineWidth = 3.5; c.stroke();
    circle(c, 50, 50, 13, rg(c, 50, 50, 14, '#fff2c0', '#ff9e3d', '#a8401a'), 4);
    c.beginPath(); c.ellipse(50, 50, 24, 7, -0.35, 0, Math.PI); c.strokeStyle = OL; c.lineWidth = 8; c.stroke(); c.strokeStyle = '#ffd08a'; c.lineWidth = 3.5; c.stroke();
  },
  ionizador: (c) => {
    const path = () => { c.arc(50, 50, 32, 0, Math.PI); c.lineTo(18, 20); c.lineTo(34, 20); c.lineTo(34, 50); c.arc(50, 50, 16, Math.PI, 0, true); c.lineTo(66, 20); c.lineTo(82, 20); c.closePath(); };
    shade(c, path, lg(c, 18, 20, 82, 82, '#ff9aaa', '#e0203d', '#7a0a1d'), { gloss: [26, 60, 4, 12] });
    shade(c, () => { rr(c, 18, 18, 16, 12, 2); rr(c, 66, 18, 16, 12, 2); }, METAL(c, 18, 30), { lw: 4 });
    for (const [x0, y0, x1, y1] of [[22, 12, 18, 4], [30, 12, 34, 4], [70, 12, 66, 4], [78, 12, 82, 4]]) line(c, [x0, y0, x1, y1], '#7ae8ff', 2.5);
    sparkle(c, 50, 22, 7, '#bff4ff');
  },
  morteiro: (c) => {
    T(c, 68, 30, 2.4, 1, () => flame(c, 0, 0, 9, 34));
    circle(c, 68, 30, 10, rg(c, 68, 30, 11, '#fff2a0', '#ff7a2a', '#a8201a'), 5);
    T(c, 36, 64, -0.6, 1.35, () => { shade(c, () => rr(c, -12, -22, 24, 34, [4, 4, 8, 8]), lg(c, -12, 0, 12, 0, '#8a92a6', '#3a3e4e', '#1a1c26'), { lw: 5 }); shade(c, () => rr(c, -15, -26, 30, 8, 3), METAL(c, -26, -18), { lw: 4 }); });
    shade(c, () => rr(c, 14, 80, 44, 9, 3), lg(c, 0, 80, 0, 89, '#6a5a4a', '#2a2018'), { lw: 4 });
  },
  luvaarcana: (c) => {
    mitten(c, ['#e0b8ff', '#9a4aff', '#4a1a9e'], 'rgba(122,232,255,0.6)');
    gem(c, 51, 42, 11, ['#ffffff', '#7ae8ff', '#1d5ad8']);
    sparkle(c, 78, 24, 9, '#e8d8ff');
  },
  // ===== colírio + =====
  coroa: (c) => {
    const path = () => { c.moveTo(18, 72); c.lineTo(14, 30); c.lineTo(32, 48); c.lineTo(50, 20); c.lineTo(68, 48); c.lineTo(86, 30); c.lineTo(82, 72); c.closePath(); };
    shade(c, path, GOLD(c, 20, 72), { gloss: [34, 42, 10, 6] });
    shade(c, () => rr(c, 16, 70, 68, 14, 4), lg(c, 0, 70, 0, 84, '#fff2a0', '#d89a00', '#8a5a00'), { lw: 5 });
    gem(c, 50, 77, 5, ['#ffffff', '#ff5d6a', '#8a0a1d']); gem(c, 32, 77, 4, ['#ffffff', '#5dff7a', '#0a6a2a']); gem(c, 68, 77, 4, ['#ffffff', '#4fd8ff', '#1d4ab8']);
    for (const [x, y] of [[14, 30], [50, 20], [86, 30]]) circle(c, x, y, 4.5, rg(c, x, y, 5, '#ffffff', '#4fd8ff', '#1d4ab8'), 3);
  },
  manto: (c) => {
    const cx = 50, cy = 50;
    const arms = () => {
      const segs: number[][] = [];
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU - Math.PI / 2, ca = Math.cos(a), sa = Math.sin(a);
        segs.push([cx, cy, cx + ca * 36, cy + sa * 36]);
        for (const [d, l] of [[16, 10], [27, 7]]) for (const s of [-1, 1]) {
          const b = a + s * 0.75;
          segs.push([cx + ca * d, cy + sa * d, cx + ca * d + Math.cos(b) * l, cy + sa * d + Math.sin(b) * l]);
        }
      }
      return segs;
    };
    const segs = arms();
    c.lineCap = 'round';
    for (const s of segs) { c.beginPath(); c.moveTo(s[0], s[1]); c.lineTo(s[2], s[3]); c.strokeStyle = OL; c.lineWidth = 10; c.stroke(); }
    for (const s of segs) { c.beginPath(); c.moveTo(s[0], s[1]); c.lineTo(s[2], s[3]); c.strokeStyle = lg(c, 14, 14, 86, 86, '#ffffff', '#bff4ff', '#4fa8ff'); c.lineWidth = 5; c.stroke(); }
    shade(c, () => { for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; c.lineTo(cx + Math.cos(a) * 9, cy + Math.sin(a) * 9); } c.closePath(); }, rg(c, cx, cy, 10, '#ffffff', '#7ac8ff'), { lw: 4 });
  },
  radio: (c) => {
    line(c, [64, 38, 76, 12], '#c8cede', 3); circle(c, 76, 12, 4, '#ff5d6a', 3, false);
    arcLine(c, 50, 38, 20, Math.PI, TAU, '#3a3048', 5);
    shade(c, () => rr(c, 16, 36, 68, 46, 9), lg(c, 16, 36, 84, 82, '#ffb08a', '#e0502a', '#8a2010'), { gloss: [28, 44, 12, 6] });
    circle(c, 36, 60, 13, rg(c, 36, 60, 14, '#4a3a3a', '#1a1414'), 4, false);
    c.fillStyle = '#c8a890'; for (let y = -8; y <= 8; y += 4) for (let x = -8; x <= 8; x += 4) if (x * x + y * y < 90) { c.beginPath(); c.arc(36 + x, 60 + y, 1.2, 0, TAU); c.fill(); }
    shade(c, () => rr(c, 56, 48, 20, 10, 2), lg(c, 0, 48, 0, 58, '#fffbe0', '#e8d090'), { lw: 3 });
    line(c, [64, 49, 62, 57], '#e0202d', 1.5);
    circle(c, 60, 70, 4, METAL(c, 66, 74), 3, false); circle(c, 72, 70, 4, METAL(c, 66, 74), 3, false);
    for (const [x, y] of [[8, 46], [92, 54]]) { c.fillStyle = '#5dff7a'; c.font = 'bold 12px sans-serif'; c.fillText('+', x - 4, y); }
  },
  mochila: (c) => {
    shade(c, () => rr(c, 18, 70, 64, 12, [3, 3, 8, 8]), lg(c, 0, 70, 0, 82, '#ffd08a', '#c8781f'), { lw: 5 });
    shade(c, () => { c.moveTo(14, 66); for (let x = 14; x <= 86; x += 8) c.quadraticCurveTo(x + 4, 74, x + 8, 66); c.lineTo(86, 62); c.lineTo(14, 62); c.closePath(); }, lg(c, 0, 60, 0, 74, '#b8ff8a', '#3ab82a'), { lw: 4 });
    shade(c, () => rr(c, 20, 56, 60, 8, 3), lg(c, 0, 56, 0, 64, '#ff9a8a', '#d8202d'), { lw: 4 });
    shade(c, () => { c.moveTo(18, 50); c.lineTo(82, 50); c.lineTo(76, 58); c.lineTo(66, 54); c.lineTo(56, 60); c.lineTo(44, 54); c.lineTo(32, 59); c.lineTo(22, 54); c.closePath(); }, '#ffd23f', { lw: 4 });
    shade(c, () => { c.moveTo(16, 52); c.quadraticCurveTo(16, 22, 50, 22); c.quadraticCurveTo(84, 22, 84, 52); c.closePath(); }, lg(c, 0, 22, 0, 52, '#ffe0a8', '#e0902a', '#a8580a'), { gloss: [36, 30, 12, 5] });
    c.fillStyle = '#fffbe8'; for (const [x, y] of [[36, 32], [50, 28], [62, 34], [44, 40], [70, 42], [28, 42]]) { c.beginPath(); c.ellipse(x, y, 2.2, 1.3, 0.4, 0, TAU); c.fill(); }
    line(c, [80, 10, 80, 22], '#5dff7a', 4); line(c, [74, 16, 86, 16], '#5dff7a', 4);
  },
  maodestino: (c) => {
    const skin = lg(c, 20, 14, 80, 90, '#f0d8ff', '#b88ae0', '#6a3aa8');
    const path = () => {
      for (const [x, y, h] of [[30, 26, 34], [41, 16, 42], [52, 14, 44], [63, 20, 38]]) rr(c, x, y, 10, h, 5);
      c.moveTo(78, 52); c.ellipse(74, 56, 7, 15, 0.7, 0, TAU);
      rr(c, 28, 42, 46, 44, [8, 8, 18, 18]);
    };
    shade(c, path, skin, { gloss: [40, 50, 8, 10] });
    c.beginPath(); c.ellipse(51, 62, 13, 8, 0, 0, TAU); c.fillStyle = '#fff'; c.fill(); c.lineWidth = 3; c.strokeStyle = OL; c.stroke();
    c.beginPath(); c.arc(51, 62, 6, 0, TAU); c.fillStyle = rg(c, 51, 62, 6, '#fff6a0', '#ffb81f', '#a86a00'); c.fill();
    c.beginPath(); c.arc(51, 62, 2.5, 0, TAU); c.fillStyle = OL; c.fill();
    sparkle(c, 22, 20, 7, '#ffe8a0'); sparkle(c, 82, 30, 6, '#e8d8ff');
  },
  // ===== lataria + =====
  caixadagua: (c) => {
    const path = can(c, 24, 30, 52, 48, lg(c, 24, 0, 76, 0, '#1d4ab8', '#8ad8ff', '#4fa8ff', '#1d3a8a'), '#9ae0ff');
    c.save(); c.beginPath(); path(); c.clip(); c.fillStyle = 'rgba(10,20,60,0.45)';
    for (const y of [44, 60]) { c.beginPath(); c.ellipse(50, y, 26, 8, 0, 0, Math.PI); c.lineWidth = 3; c.strokeStyle = 'rgba(10,20,60,0.5)'; c.stroke(); }
    c.restore();
    shade(c, () => { c.ellipse(50, 30, 26, 14, 0, Math.PI, TAU); c.closePath(); }, lg(c, 0, 16, 0, 30, '#c8f0ff', '#4fa8ff'), { lw: 5 });
    drop(c, 82, 86, 6, 16);
  },
  cadeado: (c) => {
    arcLine(c, 50, 42, 17, Math.PI, TAU, '#c8cede', 8);
    line(c, [33, 42, 33, 50], '#c8cede', 8); line(c, [67, 42, 67, 50], '#c8cede', 8);
    shade(c, () => rr(c, 22, 46, 56, 40, 9), lg(c, 22, 46, 78, 86, '#ffe680', '#d8981f', '#7a4a0a'), { gloss: [32, 54, 10, 6] });
    shade(c, () => { c.arc(50, 62, 6, 0, TAU); c.moveTo(47, 64); c.lineTo(45, 76); c.lineTo(55, 76); c.lineTo(53, 64); }, '#1a1020', { lw: 2 });
    for (const [x, y] of [[28, 52], [72, 52], [28, 80], [72, 80]]) { c.beginPath(); c.arc(x, y, 2, 0, TAU); c.fillStyle = '#fff2c0'; c.fill(); }
  },
  parachoque: (c) => {
    for (const [y, h] of [[52, 16], [64, 12]]) T(c, 18, y, -Math.PI / 2, 1, () => flame(c, 0, 0, 6, h + 6));
    shade(c, () => rr(c, 34, 30, 34, 20, [10, 10, 0, 0]), lg(c, 0, 30, 0, 50, '#ff9a8a', '#d8202d'), { lw: 5 });
    shade(c, () => rr(c, 40, 34, 22, 12, [6, 6, 0, 0]), lg(c, 40, 34, 62, 46, '#e8fbff', '#7ac8ff'), { lw: 3 });
    shade(c, () => rr(c, 20, 46, 66, 22, 8), lg(c, 0, 46, 0, 68, '#ff8a7a', '#c8203d', '#7a0a1d'), { gloss: [34, 50, 12, 4] });
    shade(c, () => rr(c, 76, 56, 14, 8, 3), METAL(c, 56, 64), { lw: 4 });
    circle(c, 82, 52, 3.5, '#fff6a0', 3, false);
    for (const x of [36, 70]) { circle(c, x, 70, 10, rg(c, x, 70, 10, '#5a5a6a', '#1a1a24'), 5, false); circle(c, x, 70, 4, METAL(c, 66, 74), 3, false); }
  },
  coracao: (c) => {
    c.save(); c.shadowColor = '#ff5d9e'; c.shadowBlur = 14;
    shade(c, () => heart(c, 50, 50, 30), lg(c, 20, 20, 80, 86, '#ffffff', '#c8cede', '#7a8296', '#b8c0d0'), { gloss: [36, 34, 10, 6] });
    c.restore();
    shade(c, () => heart(c, 50, 52, 12), lg(c, 0, 40, 0, 64, '#ffc8d8', '#ff3d7a', '#a80a3a'), { lw: 4 });
    for (const [x, y] of [[26, 38], [38, 26], [62, 26], [74, 38], [70, 62], [50, 80], [30, 62]]) { c.beginPath(); c.arc(x, y, 2.6, 0, TAU); c.fillStyle = '#5a6276'; c.fill(); c.beginPath(); c.arc(x - 0.7, y - 0.7, 1, 0, TAU); c.fillStyle = '#fff'; c.fill(); }
  },
  // ===== alumínio + =====
  chapeu: (c) => {
    shade(c, () => c.ellipse(50, 74, 38, 10, 0, 0, TAU), lg(c, 12, 0, 88, 0, '#7a90b0', '#ffffff', '#c8dcf0', '#6a80a0'), { lw: 5 });
    const crown = () => { c.moveTo(28, 74); c.lineTo(30, 22); c.ellipse(50, 22, 20, 6, 0, Math.PI, 0); c.lineTo(72, 74); c.closePath(); };
    shade(c, crown, lg(c, 28, 0, 72, 0, '#8aa0c0', '#ffffff', '#c8dcf0', '#7a90b0'));
    c.save(); c.beginPath(); crown(); c.clip();
    for (const [x, y, s] of [[34, 30, 1], [56, 40, -1], [40, 56, 1], [62, 26, 1]]) { c.beginPath(); c.moveTo(x, y); c.lineTo(x + 12 * s, y + 6); c.lineTo(x + 4 * s, y + 14); c.closePath(); c.fillStyle = s > 0 ? 'rgba(255,255,255,0.4)' : 'rgba(40,60,110,0.25)'; c.fill(); }
    c.fillStyle = lg(c, 0, 58, 0, 68, '#7ac8ff', '#1d5ad8'); c.fillRect(20, 58, 60, 10);
    c.restore();
    c.beginPath(); c.ellipse(50, 22, 20, 6, 0, 0, TAU); c.fillStyle = '#e8f2ff'; c.fill(); c.lineWidth = 3; c.strokeStyle = OL; c.stroke();
    sparkle(c, 80, 32, 7, '#5dff7a');
  },
  abafador: (c) => {
    puffs(c, [[34, 56, 16], [54, 46, 20], [72, 58, 14], [50, 66, 16], [24, 68, 10], [80, 70, 9]], lg(c, 0, 26, 0, 84, '#f0e8ff', '#a898c8', '#5a4a7a'));
    c.lineCap = 'round'; c.strokeStyle = 'rgba(40,24,70,0.6)'; c.lineWidth = 3;
    for (const [x, y, r] of [[50, 48, 7], [32, 60, 5], [68, 62, 5]]) { c.beginPath(); c.arc(x, y, r, 0.3, TAU * 0.8); c.stroke(); }
    shade(c, () => { c.moveTo(42, 20); c.lineTo(58, 20); c.lineTo(58, 10); c.lineTo(68, 22); c.lineTo(58, 34); c.lineTo(58, 26); c.lineTo(42, 26); c.closePath(); }, '#ff5d6a', { lw: 4 });
  },
  tenis: (c) => {
    for (const x of [36, 64]) line(c, [x - 6, 76, x + 6, 80, x - 6, 84, x + 6, 88], '#c8cede', 3);
    const upper = () => { c.moveTo(16, 66); c.lineTo(18, 40); c.quadraticCurveTo(30, 34, 40, 42); c.lineTo(58, 50); c.quadraticCurveTo(84, 52, 86, 66); c.closePath(); };
    shade(c, upper, lg(c, 16, 34, 86, 70, '#b8ff9a', '#3ad84a', '#0e7a2a'), { gloss: [30, 44, 10, 4] });
    shade(c, () => rr(c, 12, 62, 78, 12, 6), lg(c, 0, 62, 0, 74, '#ffffff', '#c8c0d8'), { lw: 5 });
    for (const x of [40, 47, 54]) line(c, [x, 44 + (x - 40) * 0.3, x + 4, 50 + (x - 40) * 0.3], '#ffffff', 2);
    shade(c, () => { c.moveTo(56, 58); c.lineTo(70, 54); c.lineTo(64, 62); c.closePath(); }, '#ffd23f', { lw: 3 });
  },
  // ===== pochete + =====
  marmita: (c) => {
    arcLine(c, 50, 30, 14, Math.PI, TAU, '#3a3048', 5);
    const tiers: [number, string[]][] = [[30, ['#ff9a8a', '#d8202d']], [48, ['#ffe680', '#d8981f']], [66, ['#8ad8ff', '#1d5ad8']]];
    for (const [y, cols] of tiers.slice().reverse()) shade(c, () => rr(c, 18, y, 64, 20, 7), lg(c, 0, y, 0, y + 20, ...cols), { lw: 5, gloss: [30, y + 5, 10, 3] });
    line(c, [50, 30, 50, 86], '#2a2038', 4);
    shade(c, () => heart(c, 66, 58, 6), lg(c, 0, 50, 0, 64, '#ffc8d8', '#ff3d7a'), { lw: 3 });
  },
  maleta: (c) => {
    T(c, 64, 30, 0.6, 1, () => {
      shade(c, () => { rr(c, -3, -6, 6, 30, 3); c.moveTo(9, -10); c.arc(0, -12, 9, 0, TAU); }, METAL(c, -20, 24), { lw: 4 });
      c.beginPath(); c.arc(0, -15, 4, 0, TAU); c.fillStyle = '#2a2a3a'; c.fill();
    });
    arcLine(c, 44, 40, 10, Math.PI, TAU, '#3a3048', 5);
    shade(c, () => rr(c, 16, 40, 62, 44, 6), lg(c, 16, 40, 78, 84, '#ff9a8a', '#d8202d', '#7a0a1d'), { gloss: [26, 46, 10, 5] });
    shade(c, () => rr(c, 16, 52, 62, 6, 0), lg(c, 0, 52, 0, 58, '#7a0a1d', '#4a0610'), { lw: 3 });
    for (const x of [28, 60]) shade(c, () => rr(c, x, 50, 8, 10, 2), METAL(c, 50, 60), { lw: 3 });
  },
  // ===== luvas + =====
  maoleve: (c) => {
    const box = () => rr(c, 20, 44, 60, 42, 5);
    shade(c, box, lg(c, 20, 44, 80, 86, '#ff9ae0', '#c83aa8', '#6a1468'));
    shade(c, () => rr(c, 16, 36, 68, 14, 4), lg(c, 0, 36, 0, 50, '#ffb8ea', '#d84ab8'), { lw: 5 });
    shade(c, () => { rr(c, 44, 36, 12, 50, 0); }, GOLD(c, 36, 86), { lw: 3 });
    for (const s of [-1, 1]) shade(c, () => { c.moveTo(50, 36); c.bezierCurveTo(50 + s * 10, 16, 50 + s * 30, 20, 50 + s * 22, 34); c.closePath(); }, GOLD(c, 18, 36), { lw: 4 });
    circle(c, 50, 35, 5, GOLD(c, 30, 40), 3);
    sparkle(c, 82, 22, 9, '#fff'); sparkle(c, 16, 26, 6, '#7ae8ff'); sparkle(c, 86, 54, 5, '#5dff7a');
  },
};

// ---------------- moldura ----------------
function mix(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.round(v * k).toString(16).padStart(2, '0');
  return `#${f((n >> 16) & 255)}${f((n >> 8) & 255)}${f(n & 255)}`;
}

function frame(c: C, id: string) {
  const it = ITEMS[id];
  const sp = !!it?.special;
  const rad = !!it?.radiant;
  const art = !!it?.artifact;
  const comp = !it || it.component || sp;
  const rec = (rad ? ITEMS[it.radiant!].recipe : it?.recipe) ?? ['', ''];
  const [a, b] = sp ? ['#3dffb0', '#7ad7ff'] : art ? ['#ff8a3d', '#3dd6ff'] : comp ? [THEME[id] ?? '#b07aff', THEME[id] ?? '#b07aff'] : [THEME[rec[0]] ?? '#ff9de2', THEME[rec[1]] ?? '#ff9de2'];
  // borda
  c.beginPath(); rr(c, 3, 3, 122, 122, 24);
  c.fillStyle = id === 'maoleve' || rad
    ? lg(c, 0, 0, 128, 128, '#ff7ad9', '#7ad7ff', '#5dff7a', '#ffd23f', '#ff7ad9')
    : art ? lg(c, 0, 0, 128, 128, '#ffe0b8', '#ff8a3d', '#5a1a0a', '#3dd6ff', '#0a3a5a')
    : sp ? lg(c, 0, 0, 128, 128, '#d6fff0', '#3dffb0', '#0a5a4a', '#9fffe0', '#1a7a6a')
    : comp ? lg(c, 0, 0, 128, 128, '#f4f6fb', '#8a92a6', '#4a5064', '#c8cede', '#6a7286')
      : lg(c, 0, 0, 128, 128, '#fff6c8', '#ffcf4a', '#8a5a00', '#ffe680', '#a06a00');
  c.fill();
  c.beginPath(); rr(c, 3, 3, 122, 122, 24); c.lineWidth = 2; c.strokeStyle = 'rgba(0,0,0,0.6)'; c.stroke();
  // fundo
  c.save();
  c.beginPath(); rr(c, 10, 10, 108, 108, 18); c.clip();
  c.fillStyle = lg(c, 10, 10, 118, 118, mix(a, 0.42), '#120a24', mix(b, 0.42)); c.fillRect(0, 0, 128, 128);
  const glow = c.createRadialGradient(64, 60, 4, 64, 60, 64);
  glow.addColorStop(0, `${a}aa`); glow.addColorStop(0.5, `${b}33`); glow.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = glow; c.fillRect(0, 0, 128, 128);
  // raios de luz
  c.globalAlpha = 0.07; c.fillStyle = '#fff';
  for (let i = 0; i < 12; i++) {
    const a0 = (i / 12) * TAU;
    c.beginPath(); c.moveTo(64, 60); c.arc(64, 60, 90, a0, a0 + 0.13); c.closePath(); c.fill();
  }
  c.globalAlpha = 1;
  // vinheta + brilho de vidro
  const vig = c.createRadialGradient(64, 64, 40, 64, 64, 80);
  vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(0,0,0,0.55)');
  c.fillStyle = vig; c.fillRect(0, 0, 128, 128);
  c.fillStyle = lg(c, 0, 10, 0, 50, 'rgba(255,255,255,0.16)', 'rgba(255,255,255,0)');
  c.fillRect(0, 0, 128, 50);
  c.restore();
  c.beginPath(); rr(c, 10, 10, 108, 108, 18); c.lineWidth = 2; c.strokeStyle = 'rgba(0,0,0,0.7)'; c.stroke();
  if (rad) {
    // brilho radiante: estrelinhas nos cantos
    for (const [x, y] of [[20, 20], [108, 20], [20, 108], [108, 108]]) {
      c.beginPath();
      for (let i = 0; i < 8; i++) { const r = i % 2 ? 2.5 : 8; const ang = (i / 8) * TAU - TAU / 4; c.lineTo(x + Math.cos(ang) * r, y + Math.sin(ang) * r); }
      c.closePath(); c.fillStyle = '#fff6c8'; c.fill();
    }
  }
  if (!comp) {
    for (const [x, y] of [[64, 6], [64, 122]]) {
      c.beginPath(); c.moveTo(x, y - 6); c.lineTo(x + 6, y); c.lineTo(x, y + 6); c.lineTo(x - 6, y); c.closePath();
      c.fillStyle = lg(c, x - 6, y - 6, x + 6, y + 6, '#ffffff', a, mix(b, 0.6)); c.fill(); c.lineWidth = 1.5; c.strokeStyle = OL; c.stroke();
    }
  }
}

// ---------------- render / cache ----------------
const cache = new Map<string, { canvas: HTMLCanvasElement; url: string }>();

function render(id: string) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = SIZE;
  const c = cv.getContext('2d')!;
  frame(c, id);
  // glifo numa camada à parte, para ganhar sombra projetada
  const gl = document.createElement('canvas');
  gl.width = gl.height = SIZE;
  const g = gl.getContext('2d')!;
  g.translate(14, 12); g.scale(1, 1);
  const draw = G[id] ?? (ITEMS[id]?.radiant ? G[ITEMS[id].radiant!] : undefined);
  if (draw) draw(g);
  else { g.font = '64px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ITEMS[id]?.icon ?? '❔', 50, 54); }
  c.save();
  c.shadowColor = 'rgba(0,0,0,0.6)'; c.shadowBlur = 8; c.shadowOffsetY = 4;
  c.drawImage(gl, 0, 0);
  c.restore();
  const entry = { canvas: cv, url: cv.toDataURL('image/png') };
  cache.set(id, entry);
  return entry;
}

// helpers de desenho reaproveitados pelos emblemas (emblems.ts)
export type { C };
export { TAU, OL, SIZE, lg, rg, shade, line, arcLine, circle, rr, T, teardrop, drop, heart, sparkle, bolt, puffs, METAL, GOLD, G };

/** Canvas 128x128 do ícone (para desenhar no overlay 2D). */
export function itemCanvas(id: string) { return (cache.get(id) ?? render(id)).canvas; }
/** data URL do ícone (para <img>). */
export function itemIcon(id: string) { return (cache.get(id) ?? render(id)).url; }
/** <img> inline pronto para HTML. */
export function itemImg(id: string, cls = 'ii') { return `<img class="${cls}" src="${itemIcon(id)}" alt="" draggable="false">`; }
