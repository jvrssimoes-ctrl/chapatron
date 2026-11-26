import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

// Pequena Lenda do CHAPATRON: cada jogador escolhe uma espécie e uma cor.
// O visual é todo procedural (sem arquivos), com olhos, piscada e quique.

export type AvatarSpecies = 'nuvem' | 'cogumelo' | 'robozinho' | 'geleca' | 'abacate' | 'cacto' | 'polvo';
export interface AvatarLook { species: AvatarSpecies; color: number; hat: string; face: string; trail: string }

export interface Cosmetic { id: string; name: string; icon: string; desc?: string }
export const AVATAR_SPECIES: (Cosmetic & { id: AvatarSpecies; desc: string })[] = [
  { id: 'nuvem', name: 'Fumacinha', icon: '☁️', desc: 'Uma nuvenzinha fofa que deixa rastro de fumaça.' },
  { id: 'cogumelo', name: 'Cogubolota', icon: '🍄', desc: 'Cogumelo saltitante com chapéu pintado.' },
  { id: 'robozinho', name: 'Robolinho', icon: '🤖', desc: 'Mini robô com telinha no rosto e antena.' },
  { id: 'geleca', name: 'Geleca', icon: '💧', desc: 'Gosma brilhante que balança pra todo lado.' },
  { id: 'abacate', name: 'Abacatinho', icon: '🥑', desc: 'Abacate gordinho com caroço de estimação na barriga.' },
  { id: 'cacto', name: 'Cactolino', icon: '🌵', desc: 'Cacto de vasinho com florzinha na cabeça. Abraço por sua conta e risco.' },
  { id: 'polvo', name: 'Polvilho', icon: '🐙', desc: 'Polvo de laboratório que anda balançando os oito... seis tentáculos.' },
];
export const AVATAR_HATS: Cosmetic[] = [
  { id: '', name: 'Nada', icon: '🚫' },
  { id: 'bone', name: 'Boné', icon: '🧢' },
  { id: 'palha', name: 'Chapéu de Palha', icon: '👒' },
  { id: 'gorro', name: 'Gorro da Brisa', icon: '🧶' },
  { id: 'chef', name: 'Chapéu de Mestre-Cuca', icon: '👨‍🍳' },
  { id: 'cartola', name: 'Cartola', icon: '🎩' },
  { id: 'aureola', name: 'Auréola', icon: '😇' },
  { id: 'coroa', name: 'Coroa', icon: '👑' },
];
export const AVATAR_FACES: Cosmetic[] = [
  { id: '', name: 'Nada', icon: '🚫' },
  { id: 'escuro', name: 'Óculos Escuros', icon: '🕶️' },
  { id: 'redondo', name: 'Óculos Redondos', icon: '👓' },
  { id: 'bigode', name: 'Bigodão', icon: '🥸' },
  { id: 'mascara', name: 'Faixa Ninja', icon: '🥷' },
  { id: 'estrela', name: 'Óculos de Estrela', icon: '🤩' },
];
export const AVATAR_TRAILS: (Cosmetic & { color: string[]; additive?: boolean; rise?: number })[] = [
  { id: '', name: 'Poeirinha', icon: '💨', color: ['#d8ccff'] },
  { id: 'fumaca', name: 'Fumaça Verde', icon: '🌿', color: ['#7aff8a', '#4ad86a'], rise: 0.8 },
  { id: 'bolha', name: 'Bolhas', icon: '🫧', color: ['#9fe8ff', '#ffffff'], additive: true, rise: 1.1 },
  { id: 'coracao', name: 'Coraçõezinhos', icon: '💖', color: ['#ff7ad9', '#ff3d7a'], additive: true, rise: 1.3 },
  { id: 'faisca', name: 'Faíscas', icon: '⚡', color: ['#ffe93d', '#fff7a0'], additive: true, rise: 1.8 },
  { id: 'estrela', name: 'Poeira Estelar', icon: '✨', color: ['#ffd23f', '#fff3c0'], additive: true, rise: 0.6 },
  { id: 'arcoiris', name: 'Arco-Íris', icon: '🌈', color: ['#ff5d73', '#ffb347', '#ffe066', '#5dff7a', '#7ad7ff', '#c58bff'], additive: true, rise: 0.7 },
];
export const AVATAR_COLORS = ['#7ad7ff', '#ff7ad9', '#9bff5d', '#ffd23f', '#ff8a3d', '#c58bff', '#5dffe0', '#ff5d73'];

export function hashLook(id: string): AvatarLook {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return { species: 'nuvem', color: h % AVATAR_COLORS.length, hat: '', face: '', trail: '' };
}

const okId = (list: Cosmetic[], v: string | undefined) => (list.some((x) => x.id === v) ? v! : '');
/** "especie:cor[:chapeu:rosto:rastro]" → look (com valores seguros) */
export function parseLook(s: string | undefined | null, fallbackId = ''): AvatarLook {
  const [sp, c, hat, face, trail] = String(s ?? '').split(':');
  const species = AVATAR_SPECIES.some((x) => x.id === sp) ? (sp as AvatarSpecies) : null;
  const color = Number(c);
  if (!species || !(color >= 0 && color < AVATAR_COLORS.length)) return hashLook(fallbackId);
  return { species, color, hat: okId(AVATAR_HATS, hat), face: okId(AVATAR_FACES, face), trail: okId(AVATAR_TRAILS, trail) };
}
export const lookKey = (l: AvatarLook) => {
  const extra = [l.hat, l.face, l.trail];
  while (extra.length && !extra[extra.length - 1]) extra.pop();
  return [l.species, l.color, ...extra].join(':');
};
export const trailOf = (l: AvatarLook) => AVATAR_TRAILS.find((x) => x.id === l.trail) ?? AVATAR_TRAILS[0];

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
  // onde vão chapéu e rosto (topo da cabeça, altura/profundidade dos olhos, largura)
  let hatY = 0.95, eyeY = 0.55, eyeZ = 0.33, headW = 0.36;
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
    if (!look.hat) {
      const leaf = mesh(g(new THREE.ConeGeometry(0.09, 0.32, 6)), mat('#5dff7a', 0.3, 0.6), 0.05, 0.98, 0);
      leaf.scale.set(1, 1, 0.35);
      wobblers.push(leaf);
    }
    height = 1.05;
    hatY = 0.9; eyeY = 0.55; eyeZ = 0.36; headW = 0.4;
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
    hatY = 0.9; eyeY = 0.36; eyeZ = 0.29; headW = 0.3;
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
    hatY = 0.7; eyeY = 0.47; eyeZ = 0.28; headW = 0.34;
  } else if (look.species === 'abacate') {
    const skin = mat(base.clone().lerp(new THREE.Color('#2f6a1a'), 0.55), 0.06, 0.7);
    const flesh = mat('#d8f08a', 0.12, 0.6);
    const low = mesh(sphere(0.42, 22), skin, 0, 0.4, 0);
    low.scale.set(1, 0.95, 0.9);
    const up = mesh(sphere(0.3, 20), skin, 0, 0.78, -0.02);
    up.scale.set(1, 1.05, 0.9);
    const inner = mesh(sphere(0.36, 20), flesh, 0, 0.47, 0.1);
    inner.scale.set(0.9, 0.95, 0.75);
    const seed = mesh(sphere(0.16, 16), mat('#8a4a1f', 0.05, 0.4), 0, 0.38, 0.32);
    seed.scale.set(1, 1.1, 0.7);
    wobblers.push(up);
    addEyes(0.74, 0.25, 0.12, 0.85);
    cheeks(0.64, 0.24, 0.2);
    height = 1.1;
    hatY = 1.05; eyeY = 0.74; eyeZ = 0.27; headW = 0.3;
  } else if (look.species === 'cacto') {
    const potM = mat('#c8683a', 0.04, 0.8);
    mesh(g(new THREE.CylinderGeometry(0.3, 0.24, 0.3, 18)), potM, 0, 0.15, 0);
    mesh(g(new THREE.CylinderGeometry(0.33, 0.33, 0.07, 18)), potM, 0, 0.3, 0);
    const cact = mat(base.clone().lerp(new THREE.Color('#3aa04a'), 0.55), 0.08, 0.55);
    mesh(g(new THREE.CapsuleGeometry(0.22, 0.4, 6, 16)), cact, 0, 0.66, 0);
    const armPivots: THREE.Group[] = [];
    for (const sx of [-1, 1]) {
      const p = new THREE.Group();
      p.position.set(sx * 0.22, 0.62 + (sx > 0 ? 0.06 : 0), 0);
      body.add(p);
      const a1 = mesh(g(new THREE.CapsuleGeometry(0.075, 0.12, 4, 10)), cact, sx * 0.1, 0, 0, p);
      a1.rotation.z = Math.PI / 2;
      mesh(g(new THREE.CapsuleGeometry(0.075, 0.14, 4, 10)), cact, sx * 0.18, 0.1, 0, p);
      armPivots.push(p);
    }
    wobblers.push(...armPivots);
    const spineM = mat('#fff6d8', 0.1, 0.5);
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + 0.2, y = 0.5 + (i % 3) * 0.16;
      if (Math.cos(a) > 0.55) continue; // deixa o rosto livre
      const sp = mesh(g(new THREE.ConeGeometry(0.012, 0.06, 4)), spineM, Math.sin(a) * 0.225, y, Math.cos(a) * 0.225);
      sp.rotation.set(Math.PI / 2 * Math.cos(a), 0, -Math.PI / 2 * Math.sin(a));
    }
    if (!look.hat) {
      const fl = mat('#ff7ad9', 0.4, 0.5);
      for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; mesh(sphere(0.055, 10), fl, Math.cos(a) * 0.06, 1.1, Math.sin(a) * 0.06); }
      mesh(sphere(0.04, 10), mat('#ffe066', 0.6, 0.4), 0, 1.12, 0);
    }
    addEyes(0.7, 0.2, 0.09, 0.75);
    cheeks(0.6, 0.2, 0.15);
    height = 1.15;
    hatY = 1.06; eyeY = 0.7; eyeZ = 0.22; headW = 0.25;
  } else if (look.species === 'polvo') {
    const skin = mat(base.clone().multiplyScalar(0.85), 0.1, 0.45);
    const head = mesh(sphere(0.38, 24), skin, 0, 0.62, -0.02);
    head.scale.set(1, 1.08, 0.95);
    wobblers.push(head);
    const spotM = mat(base.clone().lerp(new THREE.Color('#ffffff'), 0.4), 0.15, 0.5);
    for (const [x, y, z] of [[0.22, 0.86, -0.15], [-0.2, 0.9, -0.1], [0.05, 0.98, -0.2]]) mesh(sphere(0.05, 8), spotM, x, y, z).scale.set(1, 0.5, 1);
    const tents: THREE.Group[] = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      const p = new THREE.Group();
      p.position.set(Math.sin(a) * 0.24, 0.32, Math.cos(a) * 0.24);
      p.rotation.y = a;
      body.add(p);
      const t1 = mesh(g(new THREE.CapsuleGeometry(0.07, 0.18, 4, 10)), skin, 0, -0.08, 0.06, p);
      t1.rotation.x = 0.7;
      const t2 = mesh(sphere(0.06, 10), skin, 0, -0.18, 0.2, p);
      t2.scale.set(1, 0.8, 1.2);
      tents.push(p);
    }
    wobblers.push(...tents);
    addEyes(0.6, 0.34, 0.15, 1);
    cheeks(0.5, 0.33, 0.27);
    height = 1.05;
    hatY = 1.0; eyeY = 0.6; eyeZ = 0.36; headW = 0.38;
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
    hatY = 0.74; eyeY = 0.48; eyeZ = 0.38; headW = 0.4;
  }

  // ---------------- chapéu ----------------
  if (look.hat) {
    const hg = new THREE.Group();
    hg.position.set(0, hatY - 0.03, 0);
    hg.scale.setScalar(headW / 0.36);
    body.add(hg);
    const H = (geo: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0) => mesh(geo, m, x, y, z, hg);
    const cyl = (rt: number, rb: number, h: number, s = 24) => g(new THREE.CylinderGeometry(rt, rb, h, s));
    switch (look.hat) {
      case 'bone': {
        const m = mat(base.clone().lerp(new THREE.Color('#ff3d6b'), 0.6), 0.08, 0.6);
        const dome = H(g(new THREE.SphereGeometry(0.27, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2)), m);
        dome.scale.set(1, 0.75, 1);
        const visor = H(cyl(0.2, 0.2, 0.025, 20), m, 0, 0.01, 0.2);
        visor.scale.set(1, 1, 0.75);
        H(sphere(0.035, 8), mat('#ffffff', 0.2), 0, 0.2, 0);
        break;
      }
      case 'palha': {
        const m = mat('#e8c878', 0.05, 0.9);
        H(cyl(0.48, 0.5, 0.03, 28), m, 0, 0.01, 0);
        H(cyl(0.22, 0.25, 0.2, 22), m, 0, 0.11, 0);
        H(cyl(0.252, 0.252, 0.05, 22), mat('#d8452e', 0.1, 0.7), 0, 0.05, 0);
        break;
      }
      case 'gorro': {
        ['#e53935', '#fdd835', '#43a047'].forEach((c, i) => H(cyl(0.27 - i * 0.06, 0.29 - i * 0.06, 0.1), mat(c, 0.05, 0.9), 0, 0.03 + i * 0.09, 0));
        H(sphere(0.07, 12), mat('#43a047', 0.05, 0.9), 0, 0.32, 0);
        break;
      }
      case 'chef': {
        const m = mat('#ffffff', 0.12, 0.8);
        H(cyl(0.24, 0.22, 0.18, 22), m, 0, 0.09, 0);
        for (const [x, z] of [[0, 0], [0.13, 0.06], [-0.13, 0.06], [0.06, -0.12], [-0.08, -0.1]]) H(sphere(0.14, 14), m, x, 0.26, z);
        break;
      }
      case 'cartola': {
        const m = mat('#15121e', 0.02, 0.4);
        H(cyl(0.36, 0.36, 0.03, 26), m, 0, 0.015, 0);
        H(cyl(0.21, 0.22, 0.34, 22), m, 0, 0.19, 0);
        H(cyl(0.225, 0.225, 0.06, 22), mat(base, 0.4, 0.5), 0, 0.07, 0);
        break;
      }
      case 'aureola': {
        const halo = H(g(new THREE.TorusGeometry(0.22, 0.03, 10, 32)), mat('#fff3a0', 1.6, 0.3), 0, 0.2, 0);
        halo.rotation.x = Math.PI / 2;
        halo.castShadow = false;
        wobblers.push(hg);
        break;
      }
      case 'coroa': {
        const gold = mat('#ffd23f', 0.35, 0.25, { metalness: 0.9 });
        const ring = H(g(new THREE.CylinderGeometry(0.22, 0.21, 0.1, 22, 1, true)), gold, 0, 0.05, 0);
        (ring.material as THREE.Material).side = THREE.DoubleSide;
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          H(g(new THREE.ConeGeometry(0.04, 0.13, 6)), gold, Math.cos(a) * 0.22, 0.16, Math.sin(a) * 0.22);
        }
        H(g(new THREE.OctahedronGeometry(0.045)), mat('#5dff7a', 1.2, 0.2), 0, 0.06, 0.225);
        break;
      }
    }
  }
  // ---------------- rosto ----------------
  if (look.face) {
    const fg = new THREE.Group();
    fg.position.set(0, eyeY, eyeZ + 0.06);
    const k = headW / 0.36;
    fg.scale.setScalar(k);
    body.add(fg);
    const F = (geo: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0) => { const o = mesh(geo, m, x, y, z, fg); o.castShadow = false; return o; };
    const sp = 0.15 / k * (look.species === 'robozinho' ? 0.7 : look.species === 'cacto' ? 0.62 : look.species === 'cogumelo' ? 0.8 : 1);
    switch (look.face) {
      case 'escuro': {
        const lens = mat('#0d0d12', 0.05, 0.08, { metalness: 0.6 });
        for (const sx of [-1, 1]) { const l = F(g(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 18)), lens, sx * sp, 0, 0); l.rotation.x = Math.PI / 2; l.scale.set(1.15, 1, 0.85); }
        F(g(new THREE.BoxGeometry(sp * 1.2, 0.025, 0.025)), lens, 0, 0.02, 0);
        break;
      }
      case 'redondo': {
        const fr = mat('#c8a040', 0.2, 0.3, { metalness: 0.8 });
        for (const sx of [-1, 1]) F(g(new THREE.TorusGeometry(0.095, 0.016, 8, 24)), fr, sx * sp, 0, 0);
        F(g(new THREE.BoxGeometry(sp * 0.9, 0.018, 0.018)), fr, 0, 0.02, 0);
        break;
      }
      case 'bigode': {
        const m = mat('#3a2418', 0.02, 0.8);
        for (const sx of [-1, 1]) { const b = F(g(new THREE.CapsuleGeometry(0.035, 0.12, 4, 8)), m, sx * 0.08, -0.14, 0); b.rotation.z = sx * 1.25; }
        break;
      }
      case 'mascara': {
        const m = mat('#1a1a2a', 0.02, 0.7);
        // faixa atrás dos olhos (eles furam a faixa)
        F(g(new THREE.BoxGeometry(sp * 2 + 0.28, 0.11, 0.03)), m, 0, 0.0, -0.045);
        const tail = F(g(new THREE.BoxGeometry(0.04, 0.16, 0.02)), mat('#d8452e', 0.1, 0.7), sp + 0.16, -0.06, -0.1);
        tail.rotation.z = -0.5;
        break;
      }
      case 'estrela': {
        const m = mat('#ff3df0', 0.8, 0.3);
        const shape = new THREE.Shape();
        for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.05 : 0.11, a = (i / 10) * Math.PI * 2 + Math.PI / 2; shape[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); }
        const sg = g(new THREE.ExtrudeGeometry(shape, { depth: 0.02, bevelEnabled: false }));
        for (const sx of [-1, 1]) F(sg, m, sx * sp, 0, 0);
        break;
      }
    }
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
