import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

// Pequena Lenda do CHAPATRON: cada jogador escolhe uma espécie e uma cor.
// O visual é todo procedural (sem arquivos), com olhos, piscada e quique.

export type AvatarSpecies = 'nuvem' | 'cogumelo' | 'robozinho' | 'geleca';
export interface AvatarLook { species: AvatarSpecies; color: number }

export const AVATAR_SPECIES: { id: AvatarSpecies; name: string; icon: string; desc: string }[] = [
  { id: 'nuvem', name: 'Fumacinha', icon: '☁️', desc: 'Uma nuvenzinha fofa que deixa rastro de fumaça.' },
  { id: 'cogumelo', name: 'Cogubolota', icon: '🍄', desc: 'Cogumelo saltitante com chapéu pintado.' },
  { id: 'robozinho', name: 'Robolinho', icon: '🤖', desc: 'Mini robô com telinha no rosto e antena.' },
  { id: 'geleca', name: 'Geleca', icon: '💧', desc: 'Gosma brilhante que balança pra todo lado.' },
];
export const AVATAR_COLORS = ['#7ad7ff', '#ff7ad9', '#9bff5d', '#ffd23f', '#ff8a3d', '#c58bff', '#5dffe0', '#ff5d73'];

export function hashLook(id: string): AvatarLook {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return { species: 'nuvem', color: h % AVATAR_COLORS.length };
}

/** "especie:cor" → look (com valores seguros) */
export function parseLook(s: string | undefined | null, fallbackId = ''): AvatarLook {
  const [sp, c] = String(s ?? '').split(':');
  const species = AVATAR_SPECIES.some((x) => x.id === sp) ? (sp as AvatarSpecies) : null;
  const color = Number(c);
  if (!species || !(color >= 0 && color < AVATAR_COLORS.length)) return hashLook(fallbackId);
  return { species, color };
}
export const lookKey = (l: AvatarLook) => `${l.species}:${l.color}`;

export interface AvatarModel {
  root: THREE.Group;
  body: THREE.Group;
  height: number;
  tick: (t: number, moving: boolean, happy: boolean, hurt: number, dance: number) => void;
  dispose: () => void;
}

export function buildAvatar(look: AvatarLook): AvatarModel {
  const color = AVATAR_COLORS[look.color] ?? AVATAR_COLORS[0];
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const base = new THREE.Color(color);
  const mats: THREE.Material[] = [];
  const geos: THREE.BufferGeometry[] = [];
  const mat = (c: THREE.ColorRepresentation, emissive = 0.1, rough = 0.6, extra: THREE.MeshStandardMaterialParameters = {}) => {
    const m = new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: 0, emissive: new THREE.Color(c).multiplyScalar(emissive), ...extra });
    mats.push(m);
    return m;
  };
  const g = <T extends THREE.BufferGeometry>(x: T) => { geos.push(x); return x; };
  const sphere = (r: number, seg = 18) => g(new THREE.SphereGeometry(r, seg, Math.round(seg * 0.75)));
  const mesh = (geo: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0, parent: THREE.Object3D = body) => {
    const o = new THREE.Mesh(geo, m);
    o.position.set(x, y, z);
    o.castShadow = true;
    parent.add(o);
    return o;
  };

  // olhos (comum a todas as espécies)
  const eyeW = mat('#ffffff', 0.12, 0.3);
  const eyeB = mat('#1a1030', 0, 0.2);
  const eyes: THREE.Group[] = [];
  const addEyes = (y: number, z: number, spread = 0.15, size = 1) => {
    for (const sx of [-1, 1]) {
      const eg = new THREE.Group();
      const w = new THREE.Mesh(sphere(0.105 * size, 14), eyeW);
      const p = new THREE.Mesh(sphere(0.062 * size, 12), eyeB);
      p.position.set(0, -0.005, 0.07 * size);
      const hl = new THREE.Mesh(sphere(0.022 * size, 8), eyeW);
      hl.position.set(0.025 * size, 0.03 * size, 0.115 * size);
      eg.add(w, p, hl);
      eg.position.set(sx * spread, y, z);
      body.add(eg);
      eyes.push(eg);
    }
  };
  const cheeks = (y: number, z: number, spread: number) => {
    const cheek = mat('#ff9ab8', 0.2, 0.8);
    for (const sx of [-1, 1]) {
      const c = mesh(sphere(0.05, 10), cheek, sx * spread, y, z);
      c.scale.set(1, 0.6, 0.4);
    }
  };

  let height = 1.0;
  const wobblers: THREE.Object3D[] = [];
  if (look.species === 'nuvem') {
    const cloud = mat(base.clone().lerp(new THREE.Color('#ffffff'), 0.2).multiplyScalar(0.62), 0.0, 0.95);
    const puffs: [number, number, number, number][] = [
      [0, 0.45, 0, 0.42], [-0.32, 0.36, 0.05, 0.3], [0.32, 0.36, 0.05, 0.3], [0, 0.32, -0.25, 0.32],
      [-0.18, 0.66, -0.05, 0.27], [0.2, 0.68, -0.04, 0.25], [0, 0.25, 0.22, 0.27],
    ];
    for (const [x, y, z, r] of puffs) mesh(sphere(r), cloud, x, y, z);
    const belly = mesh(sphere(0.3), mat(base.clone().multiplyScalar(0.8), 0.12, 0.5), 0, 0.36, 0.2);
    belly.scale.set(1.1, 0.85, 0.6);
    addEyes(0.55, 0.33);
    cheeks(0.45, 0.3, 0.27);
    const leaf = mesh(g(new THREE.ConeGeometry(0.09, 0.32, 6)), mat('#5dff7a', 0.3, 0.6), 0.05, 0.98, 0);
    leaf.scale.set(1, 1, 0.35);
    wobblers.push(leaf);
    height = 1.05;
  } else if (look.species === 'cogumelo') {
    mesh(g(new THREE.CylinderGeometry(0.26, 0.32, 0.55, 18)), mat('#f3e6cf', 0.05, 0.8), 0, 0.3, 0);
    const capPivot = new THREE.Group();
    capPivot.position.y = 0.55;
    body.add(capPivot);
    const cap = mesh(g(new THREE.SphereGeometry(0.5, 22, 14, 0, Math.PI * 2, 0, Math.PI / 2)), mat(base.clone().multiplyScalar(0.85), 0.1, 0.55), 0, 0, 0, capPivot);
    cap.scale.set(1, 0.75, 1);
    const under = mesh(g(new THREE.CircleGeometry(0.5, 22)), mat('#d9c7a8', 0, 0.9, { side: THREE.DoubleSide }), 0, 0.002, 0, capPivot);
    under.rotation.x = Math.PI / 2;
    const spotM = mat('#fff7ea', 0.1, 0.7);
    for (const [phi, th] of [[0.35, 0.2], [0.75, 0.9], [0.8, 2.2], [0.7, 3.6], [0.85, 4.8], [0.6, 5.6]]) {
      const s = mesh(sphere(0.07, 10), spotM, Math.sin(phi) * Math.cos(th) * 0.49, Math.cos(phi) * 0.37, Math.sin(phi) * Math.sin(th) * 0.49, capPivot);
      s.scale.set(1, 0.5, 1);
    }
    wobblers.push(capPivot);
    addEyes(0.36, 0.27, 0.12, 0.85);
    cheeks(0.26, 0.28, 0.2);
    height = 0.95;
  } else if (look.species === 'robozinho') {
    const shell = mat(base.clone().multiplyScalar(0.75), 0.08, 0.35, { metalness: 0.5 });
    mesh(g(new RoundedBoxGeometry(0.62, 0.55, 0.5, 4, 0.12)), shell, 0, 0.42, 0);
    const screen = mesh(g(new RoundedBoxGeometry(0.46, 0.32, 0.05, 3, 0.04)), mat('#120a24', 0, 0.2), 0, 0.46, 0.25);
    screen.castShadow = false;
    const antPivot = new THREE.Group();
    antPivot.position.y = 0.7;
    body.add(antPivot);
    mesh(g(new THREE.CylinderGeometry(0.02, 0.02, 0.25, 6)), mat('#cfcfe0', 0, 0.3, { metalness: 0.8 }), 0, 0.12, 0, antPivot);
    mesh(sphere(0.07, 12), mat('#9bff5d', 1.4, 0.3), 0, 0.27, 0, antPivot);
    wobblers.push(antPivot);
    for (const sx of [-1, 1]) {
      const arm = mesh(sphere(0.09, 10), shell, sx * 0.38, 0.38, 0);
      arm.scale.set(0.8, 1.2, 0.8);
      mesh(g(new RoundedBoxGeometry(0.18, 0.1, 0.22, 2, 0.04)), shell, sx * 0.16, 0.1, 0.02);
    }
    addEyes(0.47, 0.25, 0.1, 0.7);
    height = 1.05;
  } else {
    // geleca
    const goo = mat(base.clone().multiplyScalar(0.8), 0.25, 0.15, { transparent: true, opacity: 0.88, metalness: 0.1 });
    const blob = mesh(sphere(0.45, 24), goo, 0, 0.38, 0);
    blob.scale.set(1.1, 0.85, 1);
    wobblers.push(blob);
    const drip = mesh(sphere(0.12, 12), goo, 0.2, 0.78, 0.05);
    drip.scale.set(0.8, 1.3, 0.8);
    const core = mesh(sphere(0.12, 12), mat('#ffffff', 0.4, 0.3, { transparent: true, opacity: 0.5 }), -0.12, 0.3, 0.1);
    core.castShadow = false;
    addEyes(0.48, 0.35, 0.15, 0.95);
    cheeks(0.38, 0.38, 0.28);
    height = 0.9;
  }

  // sombra fake no chão
  const shM = new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.28, depthWrite: false });
  mats.push(shM);
  const shadow = new THREE.Mesh(g(new THREE.CircleGeometry(0.42, 24)), shM);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  root.add(shadow);

  const seed = Math.random() * 10;
  const tick = (t: number, moving: boolean, happy: boolean, hurt: number, dance: number) => {
    const bob = Math.sin(t * (moving ? 9 : 2.4) + seed);
    let y = 0.12 + bob * (moving ? 0.07 : 0.05) + (happy ? Math.abs(Math.sin(t * 8)) * 0.25 : 0);
    body.rotation.set(moving ? 0.18 : 0, 0, Math.sin(t * 1.7 + seed) * 0.06 + (moving ? Math.sin(t * 9) * 0.08 : 0));
    body.scale.set(1, 1, 1);
    body.position.x = 0;
    if (dance > 0) {
      // dancinha: gira, pula e estica
      y += Math.abs(Math.sin(t * 10)) * 0.3;
      body.rotation.y = t * 9;
      const sq = 1 + Math.sin(t * 20) * 0.12;
      body.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
    }
    if (hurt > 0) {
      // levou dano: tremida e achatada
      body.position.x = Math.sin(t * 70) * 0.08 * hurt;
      body.scale.set(1 + 0.2 * hurt, 1 - 0.25 * hurt, 1 + 0.2 * hurt);
      body.rotation.x = -0.35 * hurt;
    }
    body.position.y = y;
    const amp = look.species === 'geleca' ? 0.04 : 0.2;
    wobblers.forEach((w, i) => { w.rotation.z = (look.species === 'nuvem' ? -0.4 : 0) + Math.sin(t * 3 + seed + i) * amp; });
    if (look.species === 'geleca') {
      const k = 1 + Math.sin(t * 4 + seed) * 0.05;
      wobblers[0].scale.set(1.1 * k, 0.85 / k, 1 * k);
    }
    const blink = (t + seed) % 3.6 < 0.12 || hurt > 0.5 ? 0.15 : 1;
    for (const e of eyes) e.scale.y = blink;
    shadow.scale.setScalar(Math.max(0.4, 1 - (y - 0.12) * 0.8));
  };
  const dispose = () => { geos.forEach((x) => x.dispose()); mats.forEach((m) => m.dispose()); };
  return { root, body, height, tick, dispose };
}
