import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { RobotLook, Role } from '../../../shared/types';
import { addRim } from './env';

// Robôs 3D procedurais estilo "chibi premium": cabeção, rosto em tela com expressões animadas,
// corpo esculpido com juntas cromadas, silhueta própria por papel e visual que evolui por estrela.
// Frente = +Z. Pés em y = 0.

const geoCache = new Map<string, THREE.BufferGeometry>();
function geo<T extends THREE.BufferGeometry>(key: string, make: () => T): T {
  let g = geoCache.get(key);
  if (!g) { g = make(); geoCache.set(key, g); }
  return g as T;
}

// ======================= rosto (atlas de expressões) =======================

export type FaceExpr = 'chill' | 'blink' | 'happy' | 'angry' | 'dizzy' | 'dead' | 'shock' | 'relax';
const EXPRS: FaceExpr[] = ['chill', 'blink', 'happy', 'angry', 'dizzy', 'dead', 'shock', 'relax'];
const CW = 192, CH = 128;
let faceAtlas: THREE.CanvasTexture | null = null;

function capsule(x: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number) {
  const r = Math.min(h / 2, w / 2);
  x.beginPath();
  x.moveTo(cx - w / 2 + r, cy - h / 2);
  x.lineTo(cx + w / 2 - r, cy - h / 2);
  x.arc(cx + w / 2 - r, cy, r, -Math.PI / 2, Math.PI / 2);
  x.lineTo(cx - w / 2 + r, cy + h / 2);
  x.arc(cx - w / 2 + r, cy, r, Math.PI / 2, Math.PI * 1.5);
  x.closePath();
}

function drawFace(x: CanvasRenderingContext2D, ox: number, oy: number, e: FaceExpr, slit: boolean) {
  x.save();
  x.translate(ox, oy);
  x.beginPath();
  x.rect(0, 0, CW, CH);
  x.clip();
  x.strokeStyle = x.fillStyle = '#ffffff';
  x.lineCap = 'round';
  x.lineJoin = 'round';
  x.lineWidth = 9;
  x.shadowColor = '#ffffff';
  x.shadowBlur = 14;
  const EY = 54;
  const cut = (fn: () => void) => {
    x.save();
    x.globalCompositeOperation = 'destination-out';
    x.shadowBlur = 0;
    fn();
    x.restore();
  };
  const smile = (r = 17, w = 7) => { x.lineWidth = w; x.beginPath(); x.arc(96, 84, r, 0.18 * Math.PI, 0.82 * Math.PI); x.stroke(); };
  for (const [cx, side] of [[58, -1], [134, 1]] as const) {
    const outer = cx + side * 24, inner = cx - side * 24;
    x.lineWidth = 9;
    switch (e) {
      case 'chill': // chapadão: pálpebra pesada caída pra fora
        if (slit) { capsule(x, cx, EY + 6, 46, 13); x.fill(); break; }
        x.beginPath();
        x.ellipse(cx, EY, 23, 23, 0, 0, Math.PI);
        x.closePath();
        x.fill();
        cut(() => { x.beginPath(); x.moveTo(inner, EY - 40); x.lineTo(outer, EY - 40); x.lineTo(outer, EY + 5); x.lineTo(inner, EY - 1); x.closePath(); x.fill(); });
        cut(() => { x.beginPath(); x.arc(cx + 3, EY + 10, 7, 0, Math.PI * 2); x.fill(); });
        x.lineWidth = 6;
        x.beginPath(); x.moveTo(inner, EY - 4); x.lineTo(outer + side * 3, EY + 2); x.stroke();
        break;
      case 'blink':
        if (slit) { capsule(x, cx, EY + 8, 46, 5); x.fill(); break; }
        x.beginPath(); x.moveTo(cx - 21, EY + 6); x.quadraticCurveTo(cx, EY + 15, cx + 21, EY + 6); x.stroke();
        break;
      case 'happy':
        x.beginPath(); x.moveTo(cx - 20, EY + 10); x.quadraticCurveTo(cx, EY - 20, cx + 20, EY + 10); x.stroke();
        break;
      case 'angry':
        if (slit) {
          x.beginPath(); x.moveTo(outer, EY - 6); x.lineTo(inner, EY + 6); x.lineTo(inner, EY + 16); x.lineTo(outer, EY + 10); x.closePath(); x.fill();
          break;
        }
        x.beginPath(); x.ellipse(cx, EY + 5, 21, 18, 0, 0, Math.PI * 2); x.fill();
        cut(() => { x.beginPath(); x.moveTo(outer - side * 6, EY - 30); x.lineTo(inner + side * 6, EY - 30); x.lineTo(inner + side * 6, EY + 6); x.lineTo(outer - side * 6, EY - 12); x.closePath(); x.fill(); });
        cut(() => { x.beginPath(); x.arc(cx - side * 4, EY + 9, 6, 0, Math.PI * 2); x.fill(); });
        break;
      case 'dizzy':
        x.lineWidth = 6;
        x.beginPath();
        for (let a = 0; a < Math.PI * 4.2; a += 0.2) {
          const r = 1 + a * 1.75;
          const px = cx + Math.cos(a * side) * r, py = EY + Math.sin(a * side) * r;
          if (a === 0) x.moveTo(px, py); else x.lineTo(px, py);
        }
        x.stroke();
        break;
      case 'dead':
        x.beginPath(); x.moveTo(cx - 16, EY - 16); x.lineTo(cx + 16, EY + 16); x.moveTo(cx + 16, EY - 16); x.lineTo(cx - 16, EY + 16); x.stroke();
        break;
      case 'shock':
        if (slit) { capsule(x, cx, EY, 40, 30); x.fill(); cut(() => { capsule(x, cx, EY, 18, 12); x.fill(); }); break; }
        x.lineWidth = 7;
        x.beginPath(); x.arc(cx, EY, 21, 0, Math.PI * 2); x.stroke();
        x.beginPath(); x.arc(cx, EY, 7, 0, Math.PI * 2); x.fill();
        break;
      case 'relax':
        x.beginPath(); x.moveTo(cx - 20, EY + 2); x.quadraticCurveTo(cx, EY + 16, cx + 20, EY + 2); x.stroke();
        x.lineWidth = 4;
        x.globalAlpha = 0.7;
        for (let k = 0; k < 3; k++) { x.beginPath(); x.moveTo(cx - 14 + k * 10, EY + 30); x.lineTo(cx - 20 + k * 10, EY + 38); x.stroke(); }
        x.globalAlpha = 1;
        break;
    }
  }
  // boca
  switch (e) {
    case 'chill': case 'blink': smile(); break;
    case 'relax': smile(20, 7); break;
    case 'happy': x.beginPath(); x.arc(96, 82, 19, 0, Math.PI); x.closePath(); x.fill(); break;
    case 'angry': x.lineWidth = 7; x.beginPath(); x.moveTo(76, 100); x.quadraticCurveTo(96, 86, 116, 100); x.stroke(); break;
    case 'dizzy':
      x.lineWidth = 6; x.beginPath();
      for (let i = 0; i <= 20; i++) { const px = 74 + i * 2.2, py = 94 + Math.sin(i * 0.9) * 5; if (i === 0) x.moveTo(px, py); else x.lineTo(px, py); }
      x.stroke(); break;
    case 'dead': x.lineWidth = 7; x.beginPath(); x.moveTo(80, 95); x.lineTo(112, 95); x.stroke(); break;
    case 'shock': x.lineWidth = 7; x.beginPath(); x.ellipse(96, 95, 9, 12, 0, 0, Math.PI * 2); x.stroke(); break;
  }
  x.restore();
}

function getFaceAtlas() {
  if (faceAtlas) return faceAtlas;
  const c = document.createElement('canvas');
  c.width = CW * 8;
  c.height = CH * 2;
  const x = c.getContext('2d')!;
  for (let row = 0; row < 2; row++) for (let i = 0; i < 8; i++) drawFace(x, i * CW, row * CH, EXPRS[i], row === 1);
  faceAtlas = new THREE.CanvasTexture(c);
  faceAtlas.colorSpace = THREE.SRGBColorSpace;
  faceAtlas.anisotropy = 4;
  return faceAtlas;
}

// ======================= tipos =======================

export interface RobotModel {
  root: THREE.Group; // posição/rotação no mundo
  rig: THREE.Group; // animações (pulo, balanço, escala)
  mats: THREE.MeshStandardMaterial[];
  height: number;
  emitters: THREE.Object3D[]; // pontos que soltam fumaça
  stunRing: THREE.Group;
  baseEmissive: THREE.Color[];
  /** pivôs nos ombros [esq, dir] — rotação x negativa levanta o braço para a frente */
  arms: THREE.Group[];
  /** pivôs nos quadris (vazio para esteiras / flutuantes) */
  legs: THREE.Group[];
  /** rodas das esteiras (giram ao andar) */
  wheels: THREE.Object3D[];
  /** pivô no pescoço */
  head: THREE.Group;
  /** ponta da arma / mão direita (origem dos tiros) */
  muzzle: THREE.Object3D;
  /** ponto acima da cabeça (origem das magias) */
  castPoint: THREE.Object3D;
  /** anima rosto, flutuação e peças girando */
  tick: (t: number, expr?: FaceExpr) => void;
  /** recursos exclusivos deste robô (liberados em disposeRobot) */
  owned: { dispose(): void }[];
}

const leafBlade = () => geo('leafBlade', () => {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.quadraticCurveTo(0.14, 0.5, 0, 1);
  s.quadraticCurveTo(-0.14, 0.5, 0, 0);
  return new THREE.ShapeGeometry(s, 6);
});

export function buildLeaf(size: number, mat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const angles = [0, -0.5, 0.5, -1.0, 1.0, -1.45, 1.45];
  const lens = [1, 0.85, 0.85, 0.65, 0.65, 0.4, 0.4];
  angles.forEach((a, i) => {
    const m = new THREE.Mesh(leafBlade(), mat);
    m.scale.set(size, size * lens[i], size);
    m.rotation.z = -a;
    g.add(m);
  });
  const stem = new THREE.Mesh(geo('leafStem', () => new THREE.CylinderGeometry(0.02, 0.02, 1, 4)), mat);
  stem.scale.set(size, size * 0.35, size);
  stem.position.y = -size * 0.17;
  g.add(stem);
  return g;
}

// ======================= geometrias esculpidas =======================

const lathe = (key: string, pts: [number, number][], seg = 28) =>
  geo(key, () => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg));

/** corpo-ovo (redondo) */
function eggGeo(w: number, h: number) {
  return geo(`egg_${w}_${h}`, () => {
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 16; i++) {
      const a = -Math.PI / 2 + (i / 16) * Math.PI;
      const r = (w / 2) * Math.cos(a) * (a < 0 ? 1 : 0.9);
      pts.push(new THREE.Vector2(Math.max(0.0001, r), (h / 2) * Math.sin(a)));
    }
    pts[0].x = 0; pts[16].x = 0;
    return new THREE.LatheGeometry(pts, 32);
  });
}

/** tronco atlético (ombros largos, cintura fina) */
function torsoGeo(w: number, h: number) {
  const s = w / 0.44;
  return lathe(`torso_${w}_${h}`, [
    [0, -h / 2], [0.15 * s, -h / 2], [0.175 * s, -h / 2 + 0.035], [0.165 * s, -h * 0.18], [0.15 * s, -h * 0.02],
    [0.2 * s, h * 0.24], [0.22 * s, h * 0.36], [0.19 * s, h * 0.46], [0.1 * s, h / 2], [0, h / 2],
  ], 32);
}

function hexShape(r: number) {
  const s = new THREE.Shape();
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 3;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    if (i === 0) s.moveTo(x, y); else s.lineTo(x, y);
  }
  s.closePath();
  return s;
}

function bladeGeo() {
  return geo('blade', () => {
    const s = new THREE.Shape();
    s.moveTo(-0.025, 0);
    s.lineTo(0.035, 0);
    s.lineTo(0.012, -0.42);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 1 });
    g.translate(0, 0, -0.006);
    g.rotateY(Math.PI / 2);
    return g;
  });
}

/**
 * Material "uber" do robô: cor, metal/rugosidade e brilho vêm por vértice, então o robô
 * inteiro vira poucas malhas (uma por parte animada) — muito menos draw calls.
 */
function uberMaterial(rim: THREE.ColorRepresentation, rimStr: number, rimPow: number) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, metalness: 1, roughness: 1 });
  const uRim = { value: new THREE.Color(rim) }, uStr = { value: rimStr }, uPow = { value: rimPow };
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uRim = uRim;
    sh.uniforms.uRimStr = uStr;
    sh.uniforms.uRimPow = uPow;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 aMR;\nattribute vec3 aEmi;\nvarying vec2 vMR;\nvarying vec3 vEmi;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMR = aMR;\nvEmi = aEmi;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vMR;\nvarying vec3 vEmi;\nuniform vec3 uRim;\nuniform float uRimStr;\nuniform float uRimPow;')
      .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = metalness * vMR.x;')
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = roughness * vMR.y;')
      .replace(
        '#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vEmi;\nfloat rimF = pow(1.0 - saturate(abs(dot(normalize(vViewPosition), normal))), uRimPow);\ntotalEmissiveRadiance += uRim * rimF * uRimStr;',
      );
  };
  m.customProgramCacheKey = () => 'uber-v1';
  return m;
}

/** Junta todas as malhas opacas sob cada "âncora" (parte que a animação mexe) numa só malha uber. */
function bakeRobot(root: THREE.Object3D, anchors: Set<THREE.Object3D>, uber: THREE.MeshStandardMaterial, owned: { dispose(): void }[]) {
  root.updateMatrixWorld(true);
  const byAnchor = new Map<THREE.Object3D, THREE.Mesh[]>();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || anchors.has(m) || m.userData.keep) return;
    const mat = m.material as THREE.MeshStandardMaterial;
    if (!(mat instanceof THREE.MeshStandardMaterial) || mat.transparent) return;
    let a = m.parent;
    while (a && !anchors.has(a)) a = a.parent;
    if (!a) return;
    const arr = byAnchor.get(a) ?? [];
    arr.push(m);
    byAnchor.set(a, arr);
  });
  const inv = new THREE.Matrix4();
  const rel = new THREE.Matrix4();
  for (const [a, list] of byAnchor) {
    inv.copy(a.matrixWorld).invert();
    const geos = list.map((m) => {
      const mat = m.material as THREE.MeshStandardMaterial;
      const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
      const n = g.attributes.position.count;
      const col = new Float32Array(n * 3), mr = new Float32Array(n * 2), emi = new Float32Array(n * 3);
      const e = mat.emissive.clone().multiplyScalar(mat.emissiveIntensity);
      for (let i = 0; i < n; i++) {
        col[i * 3] = mat.color.r; col[i * 3 + 1] = mat.color.g; col[i * 3 + 2] = mat.color.b;
        mr[i * 2] = mat.metalness; mr[i * 2 + 1] = mat.roughness;
        emi[i * 3] = e.r; emi[i * 3 + 1] = e.g; emi[i * 3 + 2] = e.b;
      }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      g.setAttribute('aMR', new THREE.BufferAttribute(mr, 2));
      g.setAttribute('aEmi', new THREE.BufferAttribute(emi, 3));
      rel.multiplyMatrices(inv, m.matrixWorld);
      g.applyMatrix4(rel);
      return g;
    });
    const merged = mergeGeometries(geos);
    geos.forEach((g) => g.dispose());
    if (!merged) continue;
    for (const m of list) m.parent?.remove(m);
    const mesh = new THREE.Mesh(merged, uber);
    mesh.castShadow = true;
    a.add(mesh);
    owned.push(merged);
  }
}
// ======================= construtor =======================

export function buildRobot(look: RobotLook, role?: Role, star = 1): RobotModel {
  const mats: THREE.MeshStandardMaterial[] = [];
  const owned: { dispose(): void }[] = [];
  const glowK = star >= 3 ? 1.35 : star === 2 ? 1.15 : 1;
  const mat = (color: THREE.ColorRepresentation, emissive?: THREE.ColorRepresentation, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) => {
    const m = addRim(new THREE.MeshStandardMaterial({ color, metalness: 0.25, roughness: 0.5, ...opts }), look.accent, 0.3, 2.6);
    if (emissive !== undefined) { m.emissive = new THREE.Color(emissive); if (opts.emissiveIntensity === undefined) m.emissiveIntensity = 1.4; }
    mats.push(m);
    return m;
  };
  const basic = (p: THREE.MeshBasicMaterialParameters) => { const m = new THREE.MeshBasicMaterial(p); owned.push(m); return m; };

  const acc = new Set(look.acc);
  const base = new THREE.Color(look.color);
  const dark = base.clone().lerp(new THREE.Color('#14111c'), 0.62);
  const accentCol = new THREE.Color(look.accent);
  const mBody = mat(base, undefined, { metalness: 0.45, roughness: 0.3 });
  const mBody2 = mat(base.clone().multiplyScalar(0.78), undefined, { metalness: 0.5, roughness: 0.36 });
  const mDark = mat(dark, undefined, { metalness: 0.7, roughness: 0.42 });
  const mAccent = mat(look.accent, look.accent, { emissiveIntensity: 2.4 * glowK, metalness: 0.1, roughness: 0.3 });
  const mBlack = mat('#1a1622', undefined, { metalness: 0.5, roughness: 0.5 });
  const mLeaf = mat('#3fcf5a', '#2fbf4a', { side: THREE.DoubleSide, emissiveIntensity: 0.6, metalness: 0, roughness: 0.6 });
  const mChrome = mat('#e8e4f0', undefined, { metalness: 1, roughness: 0.16 });
  // acabamento evolui com a estrela: grafite → prata → ouro
  const mTrim = star >= 3
    ? mat('#ffc93d', '#8a5a00', { metalness: 1, roughness: 0.18, emissiveIntensity: 0.55 })
    : star === 2
      ? mat('#eef3fa', undefined, { metalness: 1, roughness: 0.12 })
      : mat('#5d566e', undefined, { metalness: 0.85, roughness: 0.32 });
  const mGlass = mat('#0b0a12', look.accent, { metalness: 0.3, roughness: 0.08, emissiveIntensity: 0.07 });

  const root = new THREE.Group();
  const rigOuter = new THREE.Group(); // a cena anima este
  const rig = new THREE.Group(); // flutuação interna
  root.add(rigOuter);
  rigOuter.add(rig);
  const add = <T extends THREE.Object3D>(m: T, parent: THREE.Object3D = rig): T => { m.castShadow = true; parent.add(m); return m; };
  const mesh = (g: THREE.BufferGeometry, m: THREE.Material) => new THREE.Mesh(g, m);
  const emitters: THREE.Object3D[] = [];
  const spins: { o: THREE.Object3D; axis: 'x' | 'y' | 'z'; speed: number }[] = [];
  const flickers: THREE.Object3D[] = [];

  const hover = role === 'apcaster' && look.body !== 'tank';
  const slim = role === 'assassin';

  // ---------------- dimensões ----------------
  const legH = hover ? 0.24 : 0.22;
  let bw = 0.5, bh = 0.38, bd = 0.38;
  switch (look.body) {
    case 'round': bw = 0.58; bh = 0.48; bd = 0.52; break;
    case 'tall': bw = 0.44; bh = 0.48; bd = 0.36; break;
    case 'wide': bw = 0.7; bh = 0.36; bd = 0.44; break;
    case 'tank': bw = 0.64; bh = 0.4; bd = 0.5; break;
  }
  if (slim) bw *= 0.9;
  const bodyY = legH + bh / 2;

  // ---------------- pernas / esteiras / propulsor ----------------
  const legs: THREE.Group[] = [];
  const wheels: THREE.Object3D[] = [];
  if (look.body === 'tank') {
    for (const sx of [-1, 1]) {
      const tx = sx * (bw / 2 - 0.02);
      const track = add(mesh(geo('track', () => new RoundedBoxGeometry(0.22, 0.24, 0.8, 3, 0.11)), mBlack));
      track.position.set(tx, 0.12, 0);
      const fender = add(mesh(geo('fender', () => new RoundedBoxGeometry(0.26, 0.06, 0.84, 2, 0.03)), mBody2));
      fender.position.set(tx, 0.255, 0);
      const strip = add(mesh(geo('trackStrip', () => new THREE.BoxGeometry(0.012, 0.03, 0.56)), mAccent));
      strip.position.set(tx + sx * 0.112, 0.15, 0);
      for (let i = 0; i < 3; i++) {
        const w = add(mesh(geo('wheel', () => new THREE.CylinderGeometry(0.085, 0.085, 0.235, 14)), mTrim));
        w.rotation.z = Math.PI / 2;
        w.position.set(tx, 0.12, -0.25 + i * 0.25);
        const notch = add(mesh(geo('notch', () => new THREE.BoxGeometry(0.03, 0.245, 0.05)), mDark), w);
        notch.position.set(0, 0, 0.055);
        wheels.push(w);
      }
    }
  } else if (hover) {
    const cone = add(mesh(geo('hoverCone', () => new THREE.CylinderGeometry(bw * 0.36, 0.07, legH * 0.85, 20)), mDark));
    cone.position.y = legH * 0.58;
    const ring = add(mesh(geo('hoverRing', () => new THREE.TorusGeometry(0.11, 0.022, 8, 24)), mAccent));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = legH * 0.2;
    const flame = add(mesh(geo('flame', () => { const g = new THREE.ConeGeometry(0.075, 0.26, 14, 1, true); g.rotateX(Math.PI); return g; }),
      basic({ color: accentCol.clone().multiplyScalar(2.2), transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide })));
    flame.position.y = legH * 0.02;
    flame.castShadow = false;
    flame.userData.keep = true;
    flickers.push(flame);
  } else {
    for (const sx of [-1, 1]) {
      const hip = new THREE.Group();
      hip.position.set(sx * bw * 0.24, legH, 0);
      rig.add(hip);
      const thigh = add(mesh(geo('thigh', () => new THREE.CapsuleGeometry(0.052, 0.05, 4, 10)), mDark), hip);
      thigh.position.y = -0.05;
      const knee = add(mesh(geo('knee', () => new THREE.SphereGeometry(0.052, 12, 8)), mTrim), hip);
      knee.position.set(0, -0.105, 0.01);
      const shin = add(mesh(geo('shin', () => new THREE.CylinderGeometry(0.055, 0.068, 0.08, 12)), mBody2), hip);
      shin.position.y = -0.15;
      const boot = add(mesh(geo('boot', () => new RoundedBoxGeometry(0.17, 0.09, 0.25, 3, 0.04)), mBody), hip);
      boot.position.set(0, 0.045 - legH, 0.035);
      const sole = add(mesh(geo('sole', () => new RoundedBoxGeometry(0.18, 0.025, 0.26, 2, 0.012)), mBlack), hip);
      sole.position.set(0, 0.012 - legH, 0.035);
      const toe = add(mesh(geo('toeLight', () => new THREE.BoxGeometry(0.1, 0.018, 0.01)), mAccent), hip);
      toe.position.set(0, 0.05 - legH, 0.162);
      legs.push(hip);
    }
  }

  // ---------------- corpo ----------------
  const waist = add(mesh(geo(`waist_${bw}_${bd}`, () => new THREE.CylinderGeometry(bw * 0.36, bw * 0.4, 0.07, 20)), mDark));
  waist.position.y = legH + 0.03;
  waist.scale.z = bd / bw;
  let body: THREE.Mesh;
  if (look.body === 'round') {
    body = mesh(eggGeo(bw, bh), mBody);
    body.scale.z = bd / bw;
  } else if (look.body === 'tall') {
    body = mesh(torsoGeo(bw, bh), mBody);
    body.scale.z = bd / bw;
  } else {
    body = mesh(geo(`body_${bw}_${bh}_${bd}`, () => new RoundedBoxGeometry(bw, bh, bd, 4, 0.11)), mBody);
  }
  body.position.y = bodyY;
  add(body);
  const frontZ = look.body === 'round' ? (bd / 2) * 0.96 : look.body === 'tall' ? bd / 2 * 0.95 : bd / 2;
  // faixa de emenda + painel peitoral com reator
  if (look.body === 'round' || look.body === 'tall') {
    const seam = add(mesh(geo(`seam_${bw}`, () => new THREE.TorusGeometry(bw * (look.body === 'round' ? 0.47 : 0.36), 0.014, 6, 32)), mDark));
    seam.rotation.x = Math.PI / 2;
    seam.scale.y = bd / bw;
    seam.position.y = look.body === 'round' ? bodyY - bh * 0.12 : bodyY - bh * 0.02;
  } else {
    const belt = add(mesh(geo(`belt_${bw}_${bd}`, () => new RoundedBoxGeometry(bw + 0.02, 0.05, bd + 0.02, 2, 0.025)), mDark));
    belt.position.y = bodyY - bh * 0.28;
  }
  const plate = add(mesh(geo('chestPlate', () => new RoundedBoxGeometry(0.26, 0.2, 0.05, 3, 0.03)), mTrim));
  plate.position.set(0, bodyY + 0.03, frontZ - 0.008);
  const showEmblem = acc.has('leaf') && (look.body === 'tank' || !acc.has('antenna'));
  if (showEmblem) {
    const emblem = buildLeaf(0.1, mLeaf);
    emblem.position.set(0, bodyY + 0.01, frontZ + 0.035);
    rig.add(emblem);
  } else {
    const core = add(mesh(geo('core', () => new THREE.CylinderGeometry(0.055, 0.055, 0.03, 20)), mAccent));
    core.rotation.x = Math.PI / 2;
    core.position.set(0, bodyY + 0.03, frontZ + 0.02);
    const coreRing = add(mesh(geo('coreRing', () => new THREE.TorusGeometry(0.066, 0.013, 8, 24)), mChrome));
    coreRing.position.set(0, bodyY + 0.03, frontZ + 0.026);
  }
  // ventilação lateral
  for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) {
    const v = add(mesh(geo('vent', () => new THREE.BoxGeometry(0.012, 0.022, 0.12)), mBlack));
    v.position.set(sx * (bw / 2 - (look.body === 'round' || look.body === 'tall' ? 0.05 : 0.0)), bodyY + 0.06 - i * 0.045, 0);
  }

  // ---------------- costas: bateria / antena-prato / escapamentos ----------------
  const backZ = -bd / 2;
  if (role === 'support') {
    const mast = add(mesh(geo('mast', () => new THREE.CylinderGeometry(0.018, 0.018, 0.3, 6)), mChrome));
    mast.position.set(0, bodyY + 0.12, backZ - 0.06);
    const dishG = new THREE.Group();
    dishG.position.set(0, bodyY + 0.29, backZ - 0.06);
    rig.add(dishG);
    const dish = add(mesh(geo('dish', () => new THREE.SphereGeometry(0.15, 20, 8, 0, Math.PI * 2, 0, Math.PI * 0.38)), mTrim), dishG);
    dish.rotation.x = Math.PI * 0.82;
    const tip = add(mesh(geo('dishTip', () => new THREE.SphereGeometry(0.03, 10, 8)), mAccent), dishG);
    tip.position.set(0, 0.07, 0.07);
    spins.push({ o: dishG, axis: 'y', speed: 0.9 });
  }
  const pack = add(mesh(geo('pack', () => new RoundedBoxGeometry(0.3, 0.3, 0.14, 3, 0.045)), mDark));
  pack.position.set(0, bodyY + 0.01, backZ - 0.04);
  const cell = add(mesh(geo('cell', () => new THREE.CylinderGeometry(0.045, 0.045, 0.2, 12)), mAccent));
  cell.position.set(0, bodyY + 0.01, backZ - 0.12);
  for (const cy of [-0.11, 0.11]) {
    const cap = add(mesh(geo('cellCap', () => new THREE.CylinderGeometry(0.052, 0.052, 0.03, 12)), mChrome));
    cap.position.set(0, bodyY + 0.01 + cy, backZ - 0.12);
  }
  if (acc.has('smoke')) {
    for (const sx of [-1, 1]) {
      const pipe = add(mesh(geo('pipe', () => new THREE.CylinderGeometry(0.03, 0.026, 0.2, 10)), mChrome));
      pipe.position.set(sx * 0.11, bodyY + 0.17, backZ - 0.06);
      const e = new THREE.Object3D();
      e.position.set(sx * 0.11, bodyY + 0.28, backZ - 0.06);
      rig.add(e);
      emitters.push(e);
    }
  }

  // ---------------- braços (pivô no ombro) ----------------
  const arms: THREE.Group[] = [];
  const muzzle = new THREE.Object3D();
  const shoulderY = bodyY + bh * 0.28;
  for (const sx of [-1, 1]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(sx * (bw / 2 + 0.055), shoulderY, 0.01);
    rig.add(shoulder);
    const ball = add(mesh(geo('shoulderBall', () => new THREE.SphereGeometry(0.075, 14, 10)), mTrim), shoulder);
    ball.scale.set(1, 0.9, 1);
    if (role === 'tank' || look.body === 'tank') {
      const pd = add(mesh(geo('pauldron', () => new THREE.SphereGeometry(0.15, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2)), mBody), shoulder);
      pd.scale.set(1.05, 0.75, 1.1);
      pd.position.set(sx * 0.03, 0.02, 0);
      pd.rotation.z = -sx * 0.35;
      const rim = add(mesh(geo('pauldronRim', () => new THREE.TorusGeometry(0.15, 0.016, 6, 24)), mTrim), shoulder);
      rim.rotation.set(Math.PI / 2, -sx * 0.35, 0);
      rim.scale.set(1.05, 1.1, 1);
      rim.position.set(sx * 0.03, 0.02, 0);
      const stud = add(mesh(geo('pdStud', () => new THREE.SphereGeometry(0.022, 8, 6)), mAccent), shoulder);
      stud.position.set(sx * 0.1, 0.09, 0);
    }
    const upper = new THREE.Group();
    upper.rotation.z = sx * 0.2;
    shoulder.add(upper);
    const arm = add(mesh(geo('upperArm', () => new THREE.CapsuleGeometry(0.046, 0.08, 4, 10)), mDark), upper);
    arm.position.y = -0.085;
    const elbow = add(mesh(geo('elbow', () => new THREE.SphereGeometry(0.05, 12, 8)), mTrim), upper);
    elbow.position.y = -0.16;
    const cannon = role === 'adcarry' && sx === 1;
    if (cannon) {
      // braço-canhão
      const barrel = add(mesh(geo('cannonBody', () => new THREE.CylinderGeometry(0.07, 0.06, 0.2, 16)), mBody), upper);
      barrel.position.y = -0.26;
      const tube = add(mesh(geo('cannonTube', () => new THREE.CylinderGeometry(0.042, 0.045, 0.2, 14)), mTrim), upper);
      tube.position.y = -0.43;
      for (const ry of [-0.3, -0.4]) {
        const r = add(mesh(geo('cannonRing', () => new THREE.TorusGeometry(0.05, 0.012, 6, 18)), mAccent), upper);
        r.rotation.x = Math.PI / 2;
        r.position.y = ry - 0.07;
      }
      const tipR = add(mesh(geo('cannonTip', () => new THREE.TorusGeometry(0.044, 0.016, 8, 18)), mAccent), upper);
      tipR.rotation.x = Math.PI / 2;
      tipR.position.y = -0.53;
      const scope = add(mesh(geo('scope', () => new RoundedBoxGeometry(0.04, 0.12, 0.05, 2, 0.015)), mDark), upper);
      scope.position.set(0, -0.3, 0.08);
      const lens = add(mesh(geo('scopeLens', () => new THREE.CylinderGeometry(0.016, 0.016, 0.01, 10)), mAccent), upper);
      lens.position.set(0, -0.365, 0.08);
      muzzle.position.set(0, -0.56, 0);
      upper.add(muzzle);
    } else {
      const fore = add(mesh(geo('forearm', () => new THREE.CylinderGeometry(0.052, 0.066, 0.13, 14)), mBody), upper);
      fore.position.y = -0.24;
      const cuff = add(mesh(geo('cuff', () => new THREE.TorusGeometry(0.06, 0.014, 6, 18)), role === 'fighter' ? mAccent : mChrome), upper);
      cuff.rotation.x = Math.PI / 2;
      cuff.position.y = -0.31;
      if (role === 'fighter') {
        // manoplas gigantes
        const fist = add(mesh(geo('gauntlet', () => new RoundedBoxGeometry(0.17, 0.16, 0.17, 3, 0.05)), mDark), upper);
        fist.position.y = -0.4;
        for (let k = 0; k < 4; k++) {
          const st = add(mesh(geo('knuckle', () => new THREE.SphereGeometry(0.02, 8, 6)), mTrim), upper);
          st.position.set(-0.054 + k * 0.036, -0.45, 0.075);
        }
      } else {
        const hand = add(mesh(geo('hand', () => new THREE.SphereGeometry(0.066, 14, 10)), mDark), upper);
        hand.scale.set(1, 0.95, 0.9);
        hand.position.y = -0.37;
        const thumb = add(mesh(geo('thumb', () => new THREE.CapsuleGeometry(0.02, 0.04, 3, 6)), mDark), upper);
        thumb.position.set(-sx * 0.05, -0.36, 0.035);
        thumb.rotation.z = sx * 0.6;
      }
      if (role === 'tank' && sx === -1) {
        // escudo hexagonal no antebraço esquerdo
        const sh = add(mesh(geo('shield', () => {
          const g = new THREE.ExtrudeGeometry(hexShape(0.19), { depth: 0.03, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 2 });
          g.translate(0, 0, -0.015);
          return g;
        }), mBody2), upper);
        sh.position.set(-0.02, -0.26, 0.1);
        sh.rotation.y = -0.25;
        const rimS = add(mesh(geo('shieldRim', () => new THREE.ExtrudeGeometry(hexShape(0.21), { depth: 0.02, bevelEnabled: false })), mTrim), upper);
        rimS.position.set(-0.024, -0.26, 0.085);
        rimS.rotation.y = -0.25;
        const em = add(mesh(geo('shieldEm', () => new THREE.CircleGeometry(0.06, 6)), mAccent), upper);
        em.position.set(-0.012, -0.26, 0.138);
        em.rotation.y = -0.25;
      }
      if (role === 'assassin') {
        const b = add(mesh(bladeGeo(), mAccent), upper);
        b.position.set(sx * 0.07, -0.28, 0.02);
        b.rotation.z = sx * 0.12;
      }
      if (sx === 1) {
        muzzle.position.set(0, role === 'fighter' ? -0.5 : -0.45, 0.01);
        upper.add(muzzle);
      }
    }
    arms.push(shoulder);
  }
  // capa
  if (acc.has('cape')) {
    const capeMat = mat(new THREE.Color(look.accent).multiplyScalar(0.35), undefined, { side: THREE.DoubleSide, metalness: 0.1, roughness: 0.75 });
    const cape = add(mesh(geo('cape', () => {
      const g = new THREE.PlaneGeometry(0.62, 0.7, 4, 6);
      const p = g.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setZ(i, -Math.pow((0.35 - y) / 0.7, 2) * 0.12 + Math.cos(p.getX(i) * 9) * 0.015); p.setX(i, p.getX(i) * (1 + (0.35 - y) * 0.5)); }
      g.computeVertexNormals();
      return g;
    }), capeMat));
    cape.position.set(0, bodyY - 0.06, backZ - 0.13);
    cape.rotation.x = 0.12;
  }
  // ---- acessórios do Laboratório Clandestino ----
  if (acc.has('goo')) {
    // gosma escorrendo pelo corpo
    const gooM = mat('#b6ff3d', '#5aa01a', { emissiveIntensity: 1.3, transparent: true, opacity: 0.88, roughness: 0.12, metalness: 0 });
    const drops: [number, number, number, number][] = [
      [-0.15, bodyY + bh * 0.36, frontZ - 0.015, 0.07], [0.15, bodyY + bh * 0.08, frontZ - 0.02, 0.055],
      [0.02, bodyY - bh * 0.3, frontZ - 0.02, 0.06], [bw / 2 - 0.01, bodyY + 0.1, 0, 0.06], [-bw / 2 + 0.01, bodyY - 0.05, 0.03, 0.05],
    ];
    for (const [x, y, z, r] of drops) {
      const d = add(mesh(geo('gooDrop', () => new THREE.SphereGeometry(1, 12, 10)), gooM));
      d.scale.set(r, r * 1.6, r * 0.7);
      d.position.set(x, y, z);
      d.castShadow = false;
    }
    const pool = add(mesh(geo('gooPool', () => new THREE.CircleGeometry(0.36, 20)), gooM));
    pool.rotation.x = -Math.PI / 2;
    pool.position.y = 0.012;
    pool.castShadow = false;
  }
  if (acc.has('bolt')) {
    const boltM = mat('#ffe93d', '#ffc800', { emissiveIntensity: 3.2, metalness: 0.2, roughness: 0.3 });
    const boltGeo = () => geo('boltShape', () => {
      const s = new THREE.Shape();
      s.moveTo(0.03, 0.17); s.lineTo(-0.075, -0.005); s.lineTo(-0.008, -0.005); s.lineTo(-0.035, -0.17); s.lineTo(0.075, 0.03); s.lineTo(0.008, 0.03); s.closePath();
      const g = new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: false });
      g.translate(0, 0, -0.015);
      return g;
    });
    const chest = add(mesh(boltGeo(), boltM));
    chest.position.set(0, bodyY + bh * 0.02, frontZ + 0.02);
    chest.scale.setScalar(0.8);
    for (const sx of [-1, 1]) {
      const bb = add(mesh(boltGeo(), boltM));
      bb.position.set(sx * 0.13, bodyY + 0.3, backZ - 0.08);
      bb.scale.setScalar(0.65);
      bb.rotation.set(0, Math.PI, sx * 0.3);
    }
  }
  if (acc.has('sword')) {
    const up = arms[1]?.children.find((c) => c instanceof THREE.Group);
    if (up) {
      const sw = new THREE.Group();
      const blade = add(mesh(geo('swordBlade', () => new THREE.BoxGeometry(0.035, 0.5, 0.012)), mat('#e8f0ff', '#9fb8ff', { metalness: 1, roughness: 0.12, emissiveIntensity: 0.6 })), sw);
      blade.position.y = 0.3;
      const tipS = add(mesh(geo('swordTip', () => new THREE.ConeGeometry(0.025, 0.07, 4)), mChrome), sw);
      tipS.position.y = 0.585;
      tipS.rotation.y = Math.PI / 4;
      const guard = add(mesh(geo('swordGuard', () => new THREE.BoxGeometry(0.16, 0.025, 0.04)), mAccent), sw);
      guard.position.y = 0.045;
      const grip = add(mesh(geo('swordGrip', () => new THREE.CylinderGeometry(0.018, 0.018, 0.1, 8)), mDark), sw);
      grip.position.y = -0.01;
      sw.position.set(0, -0.38, 0.06);
      sw.rotation.x = Math.PI / 2 - 0.25;
      up.add(sw);
    }
  }
  if (acc.has('tentacles')) {
    const tm = mat(new THREE.Color(look.color).lerp(new THREE.Color(look.accent), 0.4), undefined, { roughness: 0.38, metalness: 0.05 });
    const tgeo = geo('tentacle', () => new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.09, 0.1, -0.12), new THREE.Vector3(0.22, 0.08, -0.2), new THREE.Vector3(0.32, 0.22, -0.2),
    ]), 14, 0.034, 6, false));
    const sucker = mat(look.accent, look.accent, { emissiveIntensity: 1.4 });
    for (const [sx, k] of [[-1, 1], [1, 1], [-1, 0.75], [1, 0.75]] as const) {
      const grp = new THREE.Group();
      grp.position.set(sx * 0.12, bodyY + (k === 1 ? bh * 0.25 : -bh * 0.05), backZ - 0.04);
      add(mesh(tgeo, tm), grp);
      const tip2 = add(mesh(geo('tentTip', () => new THREE.SphereGeometry(0.036, 10, 8)), sucker), grp);
      tip2.position.set(0.32, 0.22, -0.2);
      grp.scale.set(sx * k, k, k);
      grp.userData.sway = true;
      rig.add(grp);
    }
  }
  // bong ao lado
  if (acc.has('bong')) {
    const glass = mat('#9fe8ff', '#2a6f80', { transparent: true, opacity: 0.45, metalness: 0, roughness: 0.05, emissiveIntensity: 0.6, depthWrite: false });
    const bx = -(bw / 2 + 0.24);
    const tube = add(mesh(geo('bongTube', () => new THREE.CylinderGeometry(0.05, 0.05, 0.4, 14)), glass));
    tube.position.set(bx, bodyY + 0.06, 0.1);
    const bulb = add(mesh(geo('bongBulb', () => new THREE.SphereGeometry(0.115, 16, 12)), glass));
    bulb.position.set(bx, bodyY - 0.16, 0.1);
    const liquid = add(mesh(geo('bongLiquid', () => new THREE.SphereGeometry(0.085, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)), mat('#5dff7a', '#2fa04a', { emissiveIntensity: 1.8 })));
    liquid.position.set(bx, bodyY - 0.16, 0.1);
    const bowl = add(mesh(geo('bongBowl', () => new THREE.CylinderGeometry(0.03, 0.015, 0.05, 10)), mChrome));
    bowl.position.set(bx + 0.08, bodyY - 0.06, 0.1);
    bowl.rotation.z = -0.8;
    for (const o of [tube, bulb]) o.castShadow = false;
    const top = new THREE.Object3D();
    top.position.set(bx, bodyY + 0.28, 0.1);
    rig.add(top);
    emitters.push(top);
  }

  // ---------------- cabeça (grande, estilo chibi) ----------------
  const headBase = legH + bh + 0.035;
  const head = new THREE.Group();
  rig.add(head);
  let hw = 0.56, hh = 0.44, hd = 0.46;
  let headCY = headBase + hh / 2 + 0.05;
  let faceZ = hd / 2;
  let faceW = 0.42, faceH = 0.28;
  let faceCY = headCY;
  let topY = headCY + hh / 2;
  let faceGeo: THREE.BufferGeometry | null = null;
  let headR = 0.3;
  const slit = acc.has('visor');
  if (look.head !== 'none') {
    const neck = add(mesh(geo('neck', () => new THREE.CylinderGeometry(0.075, 0.095, 0.09, 12)), mChrome));
    neck.position.y = headBase + 0.025;
    const neckRing = add(mesh(geo('neckRing', () => new THREE.TorusGeometry(0.09, 0.016, 6, 20)), mTrim));
    neckRing.rotation.x = Math.PI / 2;
    neckRing.position.y = headBase + 0.005;
  }
  const earBolts = (x: number, y: number, z = 0) => {
    for (const sx of [-1, 1]) {
      const ear = add(mesh(geo('ear', () => new THREE.CylinderGeometry(0.07, 0.075, 0.05, 16)), mTrim), head);
      ear.rotation.z = Math.PI / 2;
      ear.position.set(sx * x, y, z);
      const cap = add(mesh(geo('earCap', () => new THREE.CylinderGeometry(0.035, 0.035, 0.02, 12)), mAccent), head);
      cap.rotation.z = Math.PI / 2;
      cap.position.set(sx * (x + 0.03), y, z);
    }
  };
  switch (look.head) {
    case 'square': {
      add(mesh(geo('headSq', () => new RoundedBoxGeometry(0.56, 0.44, 0.46, 5, 0.13)), mBody), head).position.y = headCY;
      const scr = add(mesh(geo('screenSq', () => new RoundedBoxGeometry(0.46, 0.32, 0.04, 3, 0.06)), mGlass), head);
      scr.position.set(0, headCY, hd / 2 - 0.006);
      faceZ = hd / 2 + 0.016;
      faceW = 0.42; faceH = 0.28;
      faceGeo = geo('facePlaneSq', () => new THREE.PlaneGeometry(0.42, 0.28));
      // "testa" em placa
      const brow = add(mesh(geo('browSq', () => new RoundedBoxGeometry(0.3, 0.05, 0.05, 2, 0.02)), mBody2), head);
      brow.position.set(0, headCY + hh / 2 - 0.02, hd / 2 - 0.05);
      earBolts(0.28, headCY);
      break;
    }
    case 'tv': {
      hw = 0.62; hh = 0.46; hd = 0.42;
      headCY = headBase + hh / 2 + 0.05;
      faceCY = headCY;
      topY = headCY + hh / 2;
      add(mesh(geo('headTv', () => new RoundedBoxGeometry(0.62, 0.46, 0.42, 4, 0.07)), mBody2), head).position.y = headCY;
      const bez = add(mesh(geo('tvBezel', () => new RoundedBoxGeometry(0.54, 0.38, 0.03, 3, 0.05)), mDark), head);
      bez.position.set(0, headCY, hd / 2 - 0.002);
      const scr = add(mesh(geo('tvScreen', () => new RoundedBoxGeometry(0.48, 0.32, 0.03, 3, 0.05)), mGlass), head);
      scr.position.set(0, headCY, hd / 2 + 0.008);
      faceZ = hd / 2 + 0.03;
      faceW = 0.44; faceH = 0.29;
      faceGeo = geo('facePlaneTv', () => new THREE.PlaneGeometry(0.44, 0.29));
      for (const sx of [-1, 1]) {
        const a = add(mesh(geo('tvAnt', () => new THREE.CylinderGeometry(0.012, 0.012, 0.28, 5)), mChrome), head);
        a.position.set(sx * 0.09, topY + 0.12, -0.02);
        a.rotation.z = -sx * 0.5;
        const b = add(mesh(geo('tvAntBall', () => new THREE.SphereGeometry(0.03, 10, 8)), mAccent), head);
        b.position.set(sx * 0.155, topY + 0.235, -0.02);
      }
      for (const ky of [0.08, -0.04]) {
        const knob = add(mesh(geo('tvKnob', () => new THREE.CylinderGeometry(0.03, 0.03, 0.03, 12)), mTrim), head);
        knob.rotation.z = Math.PI / 2;
        knob.position.set(hw / 2 + 0.012, headCY + ky, 0.08);
      }
      break;
    }
    case 'dome': {
      headR = 0.3;
      hw = 0.6; hh = 0.56;
      headCY = headBase + headR * 0.92 + 0.03;
      faceCY = headCY;
      topY = headCY + headR * 0.92;
      const d = add(mesh(geo('headDome', () => new THREE.SphereGeometry(0.3, 36, 24)), mBody), head);
      d.scale.set(1, 0.92, 0.95);
      d.position.y = headCY;
      const PH = 1.5, TH = 0.82;
      const vis = add(mesh(geo('domeVisor', () => new THREE.SphereGeometry(0.304, 24, 12, Math.PI / 2 - PH / 2, PH, Math.PI / 2 - TH / 2, TH)), mGlass), head);
      vis.scale.set(1, 0.92, 0.95);
      vis.position.y = headCY;
      faceGeo = geo('domeFace', () => new THREE.SphereGeometry(0.309, 24, 12, Math.PI / 2 - 0.68, 1.36, Math.PI / 2 - 0.36, 0.72));
      faceZ = 0;
      const chin = add(mesh(geo('domeChin', () => new THREE.TorusGeometry(0.26, 0.018, 6, 32)), mTrim), head);
      chin.rotation.x = Math.PI / 2;
      chin.position.y = headCY - 0.155;
      earBolts(0.29, headCY);
      break;
    }
    case 'mushroom': {
      hw = 0.44; hh = 0.4;
      const stem = add(mesh(geo('mushStem', () => new THREE.CylinderGeometry(0.21, 0.23, 0.36, 24)), mat('#f6e9d0', undefined, { roughness: 0.6, metalness: 0 })), head);
      stem.position.y = headBase + 0.18;
      headCY = headBase + 0.17;
      faceCY = headCY;
      const scr = add(mesh(geo('mushScreen', () => new THREE.CylinderGeometry(0.223, 0.223, 0.27, 24, 1, true, -0.95, 1.9)), mGlass), head);
      scr.position.y = headCY;
      faceGeo = geo('mushFace', () => new THREE.CylinderGeometry(0.228, 0.228, 0.24, 20, 1, true, -0.85, 1.7));
      faceZ = 0;
      const capMat = mat(look.color, undefined, { metalness: 0.15, roughness: 0.45 });
      const cap = add(mesh(geo('mushCap', () => new THREE.SphereGeometry(0.46, 32, 14, 0, Math.PI * 2, 0, Math.PI / 2)), capMat), head);
      cap.scale.set(1, 0.68, 1);
      cap.position.y = headBase + 0.32;
      const gills = add(mesh(geo('mushGills', () => new THREE.RingGeometry(0.2, 0.455, 32)), mat(look.accent, look.accent, { emissiveIntensity: 0.9, side: THREE.DoubleSide })), head);
      gills.rotation.x = Math.PI / 2;
      gills.position.y = headBase + 0.322;
      const dotMat = mat('#ffffff', '#ffffff', { emissiveIntensity: 0.35, roughness: 0.4 });
      for (const [x, z, r] of [[0.16, 0.22, 0.075], [-0.22, 0.1, 0.065], [0.05, -0.26, 0.075], [-0.12, -0.12, 0.055], [0.27, -0.05, 0.055], [-0.05, 0.05, 0.05]]) {
        const dot = add(mesh(geo('dot', () => new THREE.SphereGeometry(1, 10, 8)), dotMat), head);
        dot.scale.set(r, r * 0.5, r);
        const y = Math.sqrt(Math.max(0, 0.46 * 0.46 - x * x - z * z)) * 0.68;
        dot.position.set(x, headBase + 0.32 + y, z);
      }
      topY = headBase + 0.32 + 0.46 * 0.68;
      faceW = 0.4; faceH = 0.24;
      break;
    }
    case 'none': {
      // rosto num monitor embutido no peito
      headCY = bodyY + bh * 0.12;
      faceCY = headCY;
      const mon = add(mesh(geo('chestMon', () => new RoundedBoxGeometry(0.4, 0.24, 0.07, 3, 0.04)), mDark), head);
      mon.position.set(0, headCY, frontZ + 0.01);
      const scr = add(mesh(geo('chestScr', () => new RoundedBoxGeometry(0.34, 0.19, 0.03, 3, 0.03)), mGlass), head);
      scr.position.set(0, headCY, frontZ + 0.04);
      faceZ = frontZ + 0.058;
      faceW = 0.32; faceH = 0.18;
      faceGeo = geo('facePlaneChest', () => new THREE.PlaneGeometry(0.32, 0.2));
      rig.remove(plate);
      hw = bw * 0.8;
      hh = 0;
      topY = legH + bh;
      break;
    }
  }

  // ---------------- rosto (tela com expressões) ----------------
  const faceTex = getFaceAtlas().clone();
  faceTex.repeat.set(1 / 8, 1 / 2);
  owned.push(faceTex);
  const eyeCol = accentCol.clone().lerp(new THREE.Color('#ffffff'), 0.15).multiplyScalar(1.7 * glowK);
  const faceMat = basic({ map: faceTex, color: eyeCol, transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2 });
  if (faceGeo) {
    const f = mesh(faceGeo, faceMat);
    f.userData.keep = true;
    if (look.head === 'dome') { f.scale.set(1, 0.92, 0.95); f.position.y = faceCY; }
    else if (look.head === 'mushroom') f.position.y = faceCY;
    else f.position.set(0, faceCY, faceZ);
    f.renderOrder = 2;
    head.add(f);
  }
  const frontOf = (y: number) => (look.head === 'dome' ? Math.sqrt(Math.max(0, headR * headR - ((y - headCY) / 0.92) ** 2)) * 0.95 : look.head === 'mushroom' ? 0.225 : faceZ);
  const eyeY = faceCY + faceH * 0.08;
  const eyeX = faceW * 0.2;

  if (acc.has('shades')) {
    const lensMat = mat('#0d0d12', look.accent, { transparent: true, opacity: 0.82, metalness: 0.6, roughness: 0.08, emissiveIntensity: 0.15 });
    const z = frontOf(eyeY) + 0.03;
    for (const sx of [-1, 1]) {
      const lens = add(mesh(geo('lens', () => { const g = new THREE.CylinderGeometry(0.075, 0.075, 0.025, 20); g.rotateX(Math.PI / 2); return g; }), lensMat), head);
      lens.scale.set(1.15, 0.85, 1);
      lens.position.set(sx * eyeX, eyeY, z);
      lens.renderOrder = 3;
      const frame = add(mesh(geo('lensFrame', () => new THREE.TorusGeometry(0.075, 0.012, 6, 20)), mTrim), head);
      frame.scale.set(1.15, 0.85, 1);
      frame.position.set(sx * eyeX, eyeY, z);
    }
    const bridge = add(mesh(geo('bridge', () => new THREE.BoxGeometry(0.06, 0.016, 0.016)), mTrim), head);
    bridge.position.set(0, eyeY + 0.02, z);
  }
  if (slit) {
    const bar = add(mesh(geo('visorBar', () => new RoundedBoxGeometry(0.36, 0.035, 0.04, 2, 0.015)), mChrome), head);
    bar.position.set(0, faceCY + faceH * 0.5 + 0.01, frontOf(faceCY + faceH * 0.5) + 0.005);
  }
  // baseado no canto da boca
  if (acc.has('joint')) {
    const j = new THREE.Group();
    const paper = add(mesh(geo('joint', () => new THREE.CylinderGeometry(0.017, 0.024, 0.22, 10)), mat('#f4f1e6', undefined, { roughness: 0.8, metalness: 0 })), j);
    paper.rotation.z = Math.PI / 2;
    paper.position.x = 0.11;
    const ember = add(mesh(geo('ember', () => new THREE.SphereGeometry(0.026, 8, 6)), mat('#ff5a1f', '#ff3a00', { emissiveIntensity: 4 })), j);
    ember.position.x = 0.225;
    const tip = new THREE.Object3D();
    tip.position.x = 0.235;
    j.add(tip);
    emitters.push(tip);
    const jy = faceCY - faceH * 0.32;
    j.position.set(faceW * 0.12, jy, frontOf(jy) + 0.02);
    j.rotation.y = -0.55;
    j.rotation.z = -0.22;
    head.add(j);
  }

  // ---------------- topo ----------------
  const top = topY;
  const crownR = look.head === 'dome' ? 0.21 : look.head === 'tv' ? 0.24 : 0.23;
  if (acc.has('beanie')) {
    const cols = ['#e53935', '#fdd835', '#43a047'];
    cols.forEach((c, i) => {
      const band = add(mesh(geo(`beanie${i}`, () => new THREE.CylinderGeometry(0.28 - i * 0.055, 0.3 - i * 0.055, 0.1, 24)), mat(c, undefined, { roughness: 0.85, metalness: 0 })), head);
      band.position.y = top + 0.01 + i * 0.09;
    });
    const pom = add(mesh(geo('pom', () => new THREE.SphereGeometry(0.075, 12, 10)), mat('#43a047', undefined, { roughness: 0.9, metalness: 0 })), head);
    pom.position.y = top + 0.3;
    const dread = mat('#4e342e', undefined, { roughness: 0.85, metalness: 0 });
    for (let i = 0; i < 7; i++) {
      const a = Math.PI * 0.55 + (i / 6) * Math.PI * 1.9;
      const d = add(mesh(geo('dread', () => new THREE.CapsuleGeometry(0.028, 0.3, 3, 6)), dread), head);
      d.position.set(Math.cos(a) * 0.28, top - 0.16, Math.sin(a) * 0.26 - 0.04);
      d.rotation.set(Math.sin(a) * 0.2, 0, -Math.cos(a) * 0.2);
    }
  }
  if (acc.has('crown')) {
    const gold = mat('#ffd23f', '#a07800', { metalness: 1, roughness: 0.2, emissiveIntensity: 0.5 });
    const ring = add(mesh(geo('crownRing', () => new THREE.CylinderGeometry(crownR, crownR * 0.95, 0.1, 24, 1, true)), gold), head);
    ring.position.y = top + 0.04;
    ring.material.side = THREE.DoubleSide;
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const spike = add(mesh(geo('crownSpike', () => new THREE.ConeGeometry(0.04, 0.14, 6)), gold), head);
      spike.position.set(Math.cos(a) * crownR, top + 0.15, Math.sin(a) * crownR);
      const gemS = add(mesh(geo('crownTipGem', () => new THREE.SphereGeometry(0.018, 8, 6)), mAccent), head);
      gemS.position.set(Math.cos(a) * crownR, top + 0.225, Math.sin(a) * crownR);
    }
    const gem = add(mesh(geo('gem', () => new THREE.OctahedronGeometry(0.045)), mat('#5dff7a', '#2fbf4a', { emissiveIntensity: 3 })), head);
    gem.position.set(0, top + 0.05, crownR + 0.01);
  }
  if (acc.has('mohawk')) {
    for (let i = -2; i <= 2; i++) {
      const c = add(mesh(geo('spike', () => new THREE.ConeGeometry(0.05, 0.22, 8)), mAccent), head);
      c.position.set(0, top + 0.08 - Math.abs(i) * 0.02, i * 0.085);
      c.rotation.x = i * 0.28;
    }
  }
  if (acc.has('headphones')) {
    const r = hw / 2 + 0.03;
    const band = add(mesh(geo(`hpBand_${r}`, () => new THREE.TorusGeometry(r, 0.03, 8, 24, Math.PI)), mBlack), head);
    band.position.y = headCY + 0.02;
    for (const sx of [-1, 1]) {
      const cup = add(mesh(geo('hpCup', () => new THREE.CylinderGeometry(0.1, 0.1, 0.09, 18)), mDark), head);
      cup.rotation.z = Math.PI / 2;
      cup.position.set(sx * r, headCY, 0);
      const ring = add(mesh(geo('hpRing', () => new THREE.TorusGeometry(0.085, 0.016, 6, 20)), mAccent), head);
      ring.rotation.y = Math.PI / 2;
      ring.position.set(sx * (r + 0.048), headCY, 0);
    }
  }
  if (acc.has('antenna')) {
    const ant = new THREE.Group();
    const stick = add(mesh(geo('antStick', () => new THREE.CylinderGeometry(0.013, 0.013, 0.3, 6)), mChrome), ant);
    stick.position.y = 0.15;
    const baseA = add(mesh(geo('antBase', () => new THREE.CylinderGeometry(0.035, 0.045, 0.04, 10)), mTrim), ant);
    baseA.position.y = 0.01;
    if (acc.has('leaf') && look.body !== 'tank') {
      const lf = buildLeaf(0.16, mLeaf);
      lf.position.y = 0.3;
      ant.add(lf);
    } else {
      const ball = add(mesh(geo('antBall', () => new THREE.SphereGeometry(0.045, 12, 10)), mAccent), ant);
      ball.position.y = 0.32;
    }
    ant.position.set(-0.13, top - 0.02, 0);
    ant.rotation.z = 0.15;
    ant.userData.sway = true;
    head.add(ant);
  } else if (acc.has('leaf') && look.body !== 'tank' && look.head !== 'none') {
    const lf = buildLeaf(0.2, mLeaf);
    lf.position.set(0.14, top + 0.08, 0);
    lf.rotation.z = -0.4;
    head.add(lf);
  }
  if (acc.has('halo')) {
    const halo = add(mesh(geo('halo', () => new THREE.TorusGeometry(0.2, 0.025, 10, 32)), mat('#fff3a0', '#ffe066', { emissiveIntensity: 3 })), head);
    halo.rotation.x = Math.PI / 2;
    halo.position.y = top + 0.2;
    halo.userData.spin = true;
    halo.userData.keep = true;
  }
  // 3★: crista dourada
  if (star >= 3 && !acc.has('crown') && !acc.has('beanie') && !acc.has('mohawk')) {
    const fin = add(mesh(geo('fin', () => {
      const s = new THREE.Shape();
      s.moveTo(-0.12, 0); s.quadraticCurveTo(0, 0.05, 0.14, 0.2); s.quadraticCurveTo(0.06, 0.04, 0.12, 0); s.closePath();
      const g = new THREE.ExtrudeGeometry(s, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 1 });
      g.translate(0, 0, -0.01);
      g.rotateY(Math.PI / 2);
      return g;
    }), mTrim), head);
    fin.position.set(0.04, top - 0.02, 0);
  }

  // ---------------- flutuante: cristais orbitando ----------------
  if (hover) {
    const orb = new THREE.Group();
    orb.position.y = headCY;
    rig.add(orb);
    const crys = mat(look.accent, look.accent, { emissiveIntensity: 2.2, metalness: 0.2, roughness: 0.1 });
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const c = add(mesh(geo('orbCrystal', () => new THREE.OctahedronGeometry(0.05)), crys), orb);
      c.scale.set(0.7, 1.4, 0.7);
      c.position.set(Math.cos(a) * 0.45, Math.sin(a * 2) * 0.05, Math.sin(a) * 0.45);
    }
    spins.push({ o: orb, axis: 'y', speed: 1.3 });
  }

  // ---------------- aura de estrela ----------------
  if (star >= 2) {
    const auraMat = basic({
      color: (star >= 3 ? new THREE.Color('#ffd23f') : new THREE.Color('#cfe0ff')).multiplyScalar(star >= 3 ? 1.6 : 0.9),
      transparent: true, opacity: star >= 3 ? 0.7 : 0.45, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide,
    });
    const aura = new THREE.Mesh(geo('auraRing', () => {
      const g = new THREE.RingGeometry(0.44, 0.52, 48, 1);
      g.rotateX(-Math.PI / 2);
      return g;
    }), auraMat);
    aura.position.y = 0.015;
    aura.userData.keep = true;
    rigOuter.add(aura);
    if (star >= 3) {
      const inner = new THREE.Mesh(geo('auraTicks', () => {
        const parts: THREE.BufferGeometry[] = [];
        for (let i = 0; i < 6; i++) {
          const g = new THREE.RingGeometry(0.56, 0.6, 8, 1, (i / 6) * Math.PI * 2, 0.5);
          parts.push(g.toNonIndexed());
        }
        const m = mergeGeometries(parts)!;
        m.rotateX(-Math.PI / 2);
        return m;
      }), auraMat);
      inner.position.y = 0.016;
      inner.userData.keep = true;
      rigOuter.add(inner);
      spins.push({ o: inner, axis: 'y', speed: 0.8 });
    }
  }

  // anel de "viajando" (atordoado)
  const stunRing = new THREE.Group();
  const yLeaf = mat('#ffe066', '#b89a00', { side: THREE.DoubleSide });
  for (let i = 0; i < 3; i++) {
    const lf = buildLeaf(0.12, yLeaf);
    const a = (i / 3) * Math.PI * 2;
    lf.position.set(Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3);
    stunRing.add(lf);
  }
  stunRing.visible = false;
  rigOuter.add(stunRing);

  // pivô do pescoço: a cabeça gira em torno do pescoço, não dos pés
  const neckY = look.head === 'none' ? bodyY : headBase;
  const headPivot = new THREE.Group();
  headPivot.position.y = neckY;
  rig.remove(head);
  head.position.y = -neckY;
  headPivot.add(head);
  rig.add(headPivot);

  // âncoras = partes que se mexem sozinhas; o resto é "assado" numa malha só por âncora
  const anchors = new Set<THREE.Object3D>([root, rigOuter, rig, headPivot, stunRing, ...arms, ...legs, ...wheels, ...spins.map((s) => s.o), ...flickers]);
  root.traverse((o) => { if (o.userData.sway || o.userData.spin) anchors.add(o); });
  const uber = uberMaterial(look.accent, 0.24, 2.6);
  bakeRobot(root, anchors, uber, owned);
  const used = new Set<THREE.MeshStandardMaterial>();
  root.traverse((o) => { const mm = (o as THREE.Mesh).material; if (mm instanceof THREE.MeshStandardMaterial) used.add(mm); });
  for (const mm of mats) if (!used.has(mm)) mm.dispose();
  mats.length = 0;
  mats.push(...used);

  const box = new THREE.Box3().setFromObject(rig);
  const height = box.max.y;
  stunRing.position.y = height + 0.12;

  const castPoint = new THREE.Object3D();
  castPoint.position.set(0, height + 0.25, 0.1);
  rig.add(castPoint);

  // ---------------- animação interna ----------------
  const seed = Math.random() * 10;
  let nextBlink = 1 + Math.random() * 3;
  let blinkEnd = 0;
  let cur = '';
  const setFace = (e: FaceExpr) => {
    if (e === cur) return;
    cur = e;
    faceTex.offset.set(EXPRS.indexOf(e) / 8, slit ? 0 : 0.5);
  };
  setFace('chill');
  const tick = (t: number, expr: FaceExpr = 'chill') => {
    let e = expr;
    if (t > nextBlink) { blinkEnd = t + 0.12; nextBlink = t + 1.8 + Math.random() * 3.5; }
    if (t < blinkEnd && (expr === 'chill' || expr === 'happy' || expr === 'angry')) e = 'blink';
    setFace(e);
    if (hover) rig.position.y = 0.05 + Math.sin(t * 2.4 + seed) * 0.035;
    for (const s of spins) s.o.rotation[s.axis] = t * s.speed + seed;
    for (const f of flickers) { const k = 0.85 + Math.sin(t * 40 + seed) * 0.1 + Math.random() * 0.1; f.scale.set(k, 0.8 + Math.random() * 0.4, k); }
  };

  return {
    root, rig: rigOuter, mats, height, emitters, stunRing, baseEmissive: mats.map((m) => m.emissive.clone()),
    arms, legs, wheels, head: headPivot, muzzle, castPoint, tick, owned,
  };
}

export function disposeRobot(m: RobotModel) {
  for (const mat of m.mats) mat.dispose();
  for (const o of m.owned) o.dispose();
}
