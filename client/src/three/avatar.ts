import * as THREE from 'three';

// "Fumacinha": o mascote de cada jogador (a Pequena Lenda do CHAPATRON).
// Uma nuvenzinha fofa com olhos, uma folhinha na cabeça e um rastro de fumaça.

export interface AvatarModel {
  root: THREE.Group;
  body: THREE.Group;
  mats: THREE.MeshStandardMaterial[];
  tick: (t: number, moving: boolean, happy: boolean) => void;
  dispose: () => void;
}

export const AVATAR_COLORS = ['#7ad7ff', '#ff7ad9', '#9bff5d', '#ffd23f', '#ff8a3d', '#c58bff', '#5dffe0', '#ff5d73'];

export function avatarColor(id: string) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export function buildAvatar(color: string): AvatarModel {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const base = new THREE.Color(color);
  const mats: THREE.MeshStandardMaterial[] = [];
  const geos: THREE.BufferGeometry[] = [];
  const mat = (c: THREE.ColorRepresentation, emissive = 0.25, rough = 0.6) => {
    const m = new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: 0, emissive: new THREE.Color(c).multiplyScalar(emissive) });
    mats.push(m);
    return m;
  };
  const sphere = (r: number, seg = 18) => { const g = new THREE.SphereGeometry(r, seg, Math.round(seg * 0.75)); geos.push(g); return g; };

  // nuvem: bolotas fofas
  const cloud = mat(base.clone().lerp(new THREE.Color('#ffffff'), 0.2).multiplyScalar(0.62), 0.0, 0.95);
  const puffs: [number, number, number, number][] = [
    [0, 0.45, 0, 0.42], [-0.32, 0.36, 0.05, 0.3], [0.32, 0.36, 0.05, 0.3], [0, 0.32, -0.25, 0.32],
    [-0.18, 0.66, -0.05, 0.27], [0.2, 0.68, -0.04, 0.25], [0, 0.25, 0.22, 0.27],
  ];
  for (const [x, y, z, r] of puffs) {
    const m = new THREE.Mesh(sphere(r), cloud);
    m.position.set(x, y, z);
    m.castShadow = true;
    body.add(m);
  }
  // barriguinha colorida
  const belly = new THREE.Mesh(sphere(0.3), mat(new THREE.Color(color).multiplyScalar(0.8), 0.12, 0.5));
  belly.position.set(0, 0.36, 0.2);
  belly.scale.set(1.1, 0.85, 0.6);
  body.add(belly);
  // olhos
  const eyeW = mat('#ffffff', 0.15, 0.3);
  const eyeB = mat('#1a1030', 0, 0.2);
  const eyes: THREE.Group[] = [];
  for (const sx of [-1, 1]) {
    const eg = new THREE.Group();
    const w = new THREE.Mesh(sphere(0.105, 14), eyeW);
    const p = new THREE.Mesh(sphere(0.062, 12), eyeB);
    p.position.set(0, -0.005, 0.07);
    const hl = new THREE.Mesh(sphere(0.022, 8), eyeW);
    hl.position.set(0.025, 0.03, 0.115);
    eg.add(w, p, hl);
    eg.position.set(sx * 0.15, 0.55, 0.33);
    body.add(eg);
    eyes.push(eg);
  }
  // bochechas
  const cheek = mat('#ff9ab8', 0.3, 0.8);
  for (const sx of [-1, 1]) {
    const c = new THREE.Mesh(sphere(0.05, 10), cheek);
    c.position.set(sx * 0.27, 0.45, 0.3);
    c.scale.set(1, 0.6, 0.4);
    body.add(c);
  }
  // folhinha
  const leafG = new THREE.ConeGeometry(0.09, 0.32, 6);
  geos.push(leafG);
  const leaf = new THREE.Mesh(leafG, mat('#5dff7a', 0.4, 0.6));
  leaf.position.set(0.05, 0.98, 0);
  leaf.rotation.z = -0.4;
  leaf.scale.set(1, 1, 0.35);
  body.add(leaf);
  // sombra fake no chão
  const shG = new THREE.CircleGeometry(0.42, 24);
  geos.push(shG);
  const shM = new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.28, depthWrite: false });
  const shadow = new THREE.Mesh(shG, shM);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  root.add(shadow);

  const seed = Math.random() * 10;
  const tick = (t: number, moving: boolean, happy: boolean) => {
    const bob = Math.sin(t * (moving ? 9 : 2.4) + seed);
    body.position.y = 0.12 + bob * (moving ? 0.07 : 0.05) + (happy ? Math.abs(Math.sin(t * 8)) * 0.25 : 0);
    body.rotation.z = Math.sin(t * 1.7 + seed) * 0.06 + (moving ? Math.sin(t * 9) * 0.08 : 0);
    body.rotation.x = moving ? 0.18 : 0;
    leaf.rotation.z = -0.4 + Math.sin(t * 3 + seed) * 0.2;
    // piscar
    const blink = (t + seed) % 3.6 < 0.12 ? 0.15 : 1;
    for (const e of eyes) e.scale.y = blink;
    shadow.scale.setScalar(1 - (body.position.y - 0.12) * 0.8);
  };
  const dispose = () => { geos.forEach((g) => g.dispose()); mats.forEach((m) => m.dispose()); shM.dispose(); };
  return { root, body, mats, tick, dispose };
}
