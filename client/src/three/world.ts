import * as THREE from 'three';
import { addRim, glowTexture, noiseTexture } from './env';
import { buildLeaf } from './models';

// Cenário: céu com nebulosa, ilha flutuante, grama ao vento, cogumelos gigantes,
// pés de "erva", cristais, torres-bong, vagalumes e névoa. Tudo procedural.

export interface WorldOpts {
  quality: 'alto' | 'medio' | 'baixo';
  benchZ: number;
  emit: (pos: THREE.Vector3, o: { vel?: THREE.Vector3; spread?: number; life?: number; s0?: number; s1?: number; color?: string; alpha?: number; additive?: boolean }) => void;
}

export interface World {
  update: (t: number, dt: number) => void;
}

function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// área ocupada pelo tabuleiro + banco (não colocar decoração aqui)
function insideBoard(x: number, z: number, benchZ: number) {
  if (Math.abs(x) < 7.9 && z > -7.3 && z < 7.0) return true;
  if (Math.abs(x) < 10.2 && z > benchZ - 1.9 && z < benchZ + 1.9) return true;
  return false;
}

export function buildWorld(scene: THREE.Scene, o: WorldOpts): World {
  const updaters: ((t: number, dt: number) => void)[] = [];
  const R = rng(1337);
  const hi = o.quality === 'alto';
  const lo = o.quality === 'baixo';

  // ================= céu =================
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      varying vec3 vDir;
      uniform float uTime;
      float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
      float noise(vec3 p) {
        vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
                   mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
      }
      float fbm(vec3 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 top = vec3(0.035, 0.015, 0.09);
        vec3 mid = vec3(0.16, 0.05, 0.26);
        vec3 hor = vec3(0.10, 0.32, 0.30);
        vec3 col = mix(hor, mid, smoothstep(-0.15, 0.25, h));
        col = mix(col, top, smoothstep(0.25, 0.9, h));
        // nebulosa
        float n = fbm(d * 2.4 + vec3(uTime * 0.004, 0.0, 0.0));
        float n2 = fbm(d * 4.5 - vec3(0.0, uTime * 0.003, 0.0));
        vec3 neb = mix(vec3(0.55, 0.12, 0.65), vec3(0.1, 0.75, 0.45), n2);
        col += neb * pow(smoothstep(0.45, 0.85, n), 2.0) * 0.55 * smoothstep(-0.1, 0.3, h);
        // estrelas
        vec3 sp = d * 220.0;
        float s = hash(floor(sp));
        float star = step(0.9965, s) * (0.6 + 0.4 * sin(uTime * 2.0 + s * 100.0));
        col += vec3(star) * smoothstep(0.0, 0.3, h) * 1.4;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(140, 32, 20), skyMat);
  sky.renderOrder = -10;
  scene.add(sky);
  updaters.push((t) => { skyMat.uniforms.uTime.value = t; });

  // ================= ilha flutuante =================
  const rockTex = noiseTexture('rock', '#3a2c52', ['#5a4678', '#22182f', '#6a5a88', '#2d3a4a'], 256, 1.4);
  const rockMat = addRim(new THREE.MeshStandardMaterial({ color: '#7d6aa0', map: rockTex, roughness: 0.92, metalness: 0.05, flatShading: true }), '#8f6bff', 0.25);
  const under = new THREE.ConeGeometry(15.5, 14, 28, 6, true);
  {
    const pos = under.attributes.position as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const k = (v.y + 7) / 14; // 0 = ponta, 1 = topo
      const n = Math.sin(v.x * 1.7) * Math.cos(v.z * 1.3) * 0.9 + Math.sin(v.y * 2.1 + v.x) * 0.6;
      const f = 1 + (n * 0.12) * (1 - k * 0.6);
      v.x *= f; v.z *= f * 0.92;
      if (k < 0.98) v.y += Math.sin(v.x * 2 + v.z) * 0.35;
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    under.computeVertexNormals();
  }
  const island = new THREE.Mesh(under, rockMat);
  island.rotation.x = Math.PI;
  island.position.set(0, -7.6, 0.8);
  island.receiveShadow = true;
  scene.add(island);

  // topo gramado
  const grassTex = noiseTexture('grass', '#1f5a2c', ['#2f7a3a', '#174422', '#3f8f3a', '#1a4a3a'], 256, 1.2);
  grassTex.repeat.set(6, 6);
  const topGeo = new THREE.CircleGeometry(15.6, 48);
  {
    const pos = topGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 1; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i);
      const a = Math.atan2(y, x);
      const r = Math.hypot(x, y);
      const f = r > 15 ? 1 + Math.sin(a * 7) * 0.03 + Math.sin(a * 13) * 0.02 : 1;
      pos.setXY(i, x * f, y * f * 0.92);
    }
  }
  const ground = new THREE.Mesh(topGeo, new THREE.MeshStandardMaterial({ color: '#3d8f4a', map: grassTex, roughness: 0.95 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.6, 0.8);
  ground.receiveShadow = true;
  scene.add(ground);

  // borda de pedras em volta da ilha
  const stoneGeo = new THREE.DodecahedronGeometry(1, 0);
  const stones = new THREE.InstancedMesh(stoneGeo, rockMat, 70);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  for (let i = 0; i < 70; i++) {
    const a = (i / 70) * Math.PI * 2 + R() * 0.05;
    const r = 15.2 + R() * 0.6;
    const s = 0.5 + R() * 0.9;
    q.setFromEuler(new THREE.Euler(R() * 3, R() * 3, R() * 3));
    m4.compose(new THREE.Vector3(Math.cos(a) * r, -0.6 + s * 0.15, Math.sin(a) * r * 0.92 + 0.8), q, new THREE.Vector3(s, s * 0.7, s));
    stones.setMatrixAt(i, m4);
  }
  stones.castShadow = true;
  stones.receiveShadow = true;
  scene.add(stones);

  // ================= grama ao vento (instanciada) =================
  if (!lo) {
    const n = hi ? 5200 : 2200;
    const blade = new THREE.PlaneGeometry(0.09, 0.55, 1, 3);
    blade.translate(0, 0.275, 0);
    {
      const pos = blade.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i);
        pos.setX(i, pos.getX(i) * (1 - y / 0.6));
      }
    }
    const gmat = new THREE.MeshStandardMaterial({ color: '#5fcf5a', roughness: 0.8, side: THREE.DoubleSide });
    const uT = { value: 0 };
    gmat.onBeforeCompile = (sh) => {
      sh.uniforms.uT = uT;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uT;\nvarying float vH;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vH = position.y / 0.55;
          vec4 wp = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          float w = sin(uT * 1.6 + wp.x * 0.35 + wp.z * 0.2) * 0.5 + sin(uT * 3.1 + wp.x * 1.3) * 0.15;
          transformed.x += w * vH * vH * 0.25;
          transformed.z += w * vH * vH * 0.12;`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vH;')
        .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= mix(0.35, 1.25, vH);');
    };
    const grass = new THREE.InstancedMesh(blade, gmat, n);
    const col = new THREE.Color();
    let placed = 0;
    for (let tries = 0; placed < n && tries < n * 6; tries++) {
      const a = R() * Math.PI * 2;
      const r = Math.sqrt(R()) * 15;
      const x = Math.cos(a) * r, z = Math.sin(a) * r * 0.92 + 0.8;
      if (insideBoard(x, z, o.benchZ)) continue;
      const s = 0.7 + R() * 0.9;
      q.setFromEuler(new THREE.Euler(0, R() * Math.PI, (R() - 0.5) * 0.3));
      m4.compose(new THREE.Vector3(x, -0.6, z), q, new THREE.Vector3(s, s * (0.8 + R() * 0.8), s));
      grass.setMatrixAt(placed, m4);
      grass.setColorAt(placed, col.setHSL(0.27 + R() * 0.08, 0.6, 0.35 + R() * 0.2));
      placed++;
    }
    grass.count = placed;
    grass.receiveShadow = true;
    scene.add(grass);
    updaters.push((t) => { uT.value = t; });
  }

  // ================= cogumelos gigantes =================
  const capColors = ['#ff4d6d', '#b05dff', '#3fd6ff', '#ff9d3d', '#ff4d6d', '#5dff9a'];
  const stemMat = addRim(new THREE.MeshStandardMaterial({ color: '#f2e6cf', roughness: 0.7 }), '#ffe9c4', 0.3);
  const spotMat = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#fff6d8', emissiveIntensity: 0.9, roughness: 0.6 });
  const mushSpots: { x: number; z: number; s: number }[] = [
    { x: -11.5, z: -6.5, s: 2.3 }, { x: 11.8, z: -5.5, s: 2.0 }, { x: -12.3, z: 3.5, s: 1.5 },
    { x: 12.6, z: 3.2, s: 1.7 }, { x: -9.5, z: -9.8, s: 1.3 }, { x: 9.2, z: -10.2, s: 1.6 },
    { x: -13.4, z: -1.5, s: 1.0 }, { x: 13.6, z: -1.2, s: 1.1 },
  ];
  const caps: { mat: THREE.MeshStandardMaterial; phase: number }[] = [];
  mushSpots.forEach((ms, i) => {
    const g = new THREE.Group();
    const h = 2.2 * ms.s;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.28 * ms.s, 0.42 * ms.s, h, 14, 4), stemMat);
    stem.position.y = h / 2;
    stem.rotation.z = (R() - 0.5) * 0.15;
    stem.castShadow = true;
    g.add(stem);
    const c = capColors[i % capColors.length];
    const capMat = addRim(new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.25, roughness: 0.45, metalness: 0.0 }), '#ffffff', 0.35);
    caps.push({ mat: capMat, phase: R() * 6 });
    const cap = new THREE.Mesh(new THREE.SphereGeometry(1.15 * ms.s, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), capMat);
    cap.scale.y = 0.62;
    cap.position.y = h;
    cap.castShadow = true;
    g.add(cap);
    // lamelas brilhantes por baixo
    const gill = new THREE.Mesh(new THREE.CircleGeometry(1.12 * ms.s, 24), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.6, side: THREE.DoubleSide }));
    gill.rotation.x = Math.PI / 2;
    gill.position.y = h - 0.02;
    g.add(gill);
    for (let k = 0; k < 7; k++) {
      const sp = new THREE.Mesh(new THREE.SphereGeometry(0.13 * ms.s, 8, 6), spotMat);
      const a = R() * Math.PI * 2, rr = R() * 0.85;
      const x = Math.cos(a) * rr * 1.15 * ms.s, z = Math.sin(a) * rr * 1.15 * ms.s;
      const y = Math.sqrt(Math.max(0, 1 - rr * rr)) * 1.15 * ms.s * 0.62;
      sp.position.set(x, h + y, z);
      sp.scale.y = 0.5;
      g.add(sp);
    }
    g.position.set(ms.x, -0.6, ms.z);
    g.rotation.y = R() * 6;
    scene.add(g);
  });
  updaters.push((t) => {
    for (const c of caps) c.mat.emissiveIntensity = 0.22 + (Math.sin(t * 1.2 + c.phase) * 0.5 + 0.5) * 0.35;
  });

  // ================= pés de erva =================
  const leafMat = addRim(new THREE.MeshStandardMaterial({ color: '#3fcf5a', emissive: '#0d4a1a', emissiveIntensity: 0.6, roughness: 0.55, side: THREE.DoubleSide }), '#b8ff9e', 0.4);
  const plants: { g: THREE.Group; ph: number }[] = [];
  const plantSpots = [
    [-9.6, -7.6], [9.8, -7.8], [-10.6, 0.5], [10.8, 0.2], [-12.8, 6.5], [12.6, 6.8], [-6.5, -9.6], [6.8, -9.4],
    [-11.2, 9.6], [11.4, 9.8], [-3.2, -10.5], [3.5, -10.6], [-14.0, 2.4], [14.2, -3.6],
  ];
  for (const [x, z] of plantSpots) {
    const g = new THREE.Group();
    const s = 0.7 + R() * 0.6;
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.06, 1.8 * s, 6), leafMat);
    stalk.position.y = 0.9 * s;
    g.add(stalk);
    for (let k = 0; k < 6; k++) {
      const leaf = buildLeaf(0.55 * s * (1 - k * 0.08), leafMat);
      leaf.position.y = (0.4 + k * 0.25) * s;
      leaf.rotation.y = k * 2.2;
      leaf.rotation.x = -0.9 + k * 0.08;
      leaf.traverse((m) => { m.castShadow = true; });
      g.add(leaf);
    }
    const top = buildLeaf(0.45 * s, leafMat);
    top.position.y = 1.85 * s;
    g.add(top);
    g.position.set(x, -0.6, z);
    g.rotation.y = R() * 6;
    scene.add(g);
    plants.push({ g, ph: R() * 6 });
  }
  updaters.push((t) => {
    for (const p of plants) { p.g.rotation.z = Math.sin(t * 1.1 + p.ph) * 0.05; p.g.rotation.x = Math.sin(t * 0.9 + p.ph) * 0.04; }
  });

  // ================= cristais =================
  const crystalCols = ['#ff5dd8', '#5dd8ff', '#b97aff'];
  const crystals: THREE.MeshStandardMaterial[] = [];
  const crystalSpots = [[-13.2, -4.2], [13.0, -7.4], [-8.2, -11.0], [8.4, 9.6], [-14.2, 5.6], [14.4, 1.6]];
  crystalSpots.forEach(([x, z], i) => {
    const c = crystalCols[i % crystalCols.length];
    const mat = new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.3, roughness: 0.15, metalness: 0.2, transparent: true, opacity: 0.92, flatShading: true });
    crystals.push(mat);
    const g = new THREE.Group();
    for (let k = 0; k < 5; k++) {
      const h = 0.8 + R() * 1.6;
      const m = new THREE.Mesh(new THREE.ConeGeometry(0.22 + R() * 0.15, h, 5), mat);
      m.position.set((R() - 0.5) * 0.8, h / 2 - 0.1, (R() - 0.5) * 0.8);
      m.rotation.set((R() - 0.5) * 0.7, R() * 3, (R() - 0.5) * 0.7);
      g.add(m);
    }
    g.position.set(x, -0.6, z);
    scene.add(g);
  });
  updaters.push((t) => { crystals.forEach((m, i) => { m.emissiveIntensity = 1.0 + Math.sin(t * 2 + i) * 0.35; }); });

  // ================= torres-bong (luminárias) =================
  const glass = new THREE.MeshPhysicalMaterial({ color: '#bff6ff', roughness: 0.05, metalness: 0, transparent: true, opacity: 0.35, envMapIntensity: 1.5 });
  const liquid = new THREE.MeshStandardMaterial({ color: '#5dff7a', emissive: '#3dff6a', emissiveIntensity: 1.8, transparent: true, opacity: 0.85 });
  const metal = addRim(new THREE.MeshStandardMaterial({ color: '#c9a24a', metalness: 0.9, roughness: 0.3 }), '#ffe08a', 0.3);
  const smokePoints: THREE.Vector3[] = [];
  for (const sx of [-1, 1]) {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 0.5, 20), metal);
    base.position.y = 0.25;
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(1.0, 24, 18), glass);
    bulb.position.y = 1.4;
    const liq = new THREE.Mesh(new THREE.SphereGeometry(0.82, 24, 12, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55), liquid);
    liq.position.y = 1.4;
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 3.2, 20, 1, true), glass);
    neck.position.y = 3.6;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.07, 8, 24), metal);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 5.2;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.2, 8), metal);
    stem.position.set(0.7, 1.9, 0);
    stem.rotation.z = -0.8;
    const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), metal);
    bowl.position.set(1.15, 2.35, 0);
    const ember = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), new THREE.MeshStandardMaterial({ color: '#ff6b2d', emissive: '#ff4a10', emissiveIntensity: 3 }));
    ember.position.set(1.15, 2.42, 0);
    g.add(base, bulb, liq, neck, ring, stem, bowl, ember);
    g.traverse((m) => { m.castShadow = m !== bulb && m !== neck; });
    g.position.set(sx * 11.6, -0.6, -9.2);
    g.rotation.y = sx > 0 ? Math.PI : 0;
    scene.add(g);
    const light = new THREE.PointLight('#5dff7a', 6, 14, 1.4);
    light.position.set(sx * 11.6, 1.6, -9.2);
    scene.add(light);
    smokePoints.push(new THREE.Vector3(sx * 11.6, 4.7, -9.2));
    updaters.push((t) => { light.intensity = 5 + Math.sin(t * 3 + sx) * 1.2; });
  }
  let smokeT = 0;
  updaters.push((_t, dt) => {
    smokeT += dt;
    if (smokeT < 0.12) return;
    smokeT = 0;
    for (const p of smokePoints) o.emit(p, { vel: new THREE.Vector3(0.15, 0.9, 0), spread: 0.25, life: 3.2, s0: 0.6, s1: 2.6, alpha: 0.22, color: '#cfe8d8' });
  });

  // ================= pedras flutuando =================
  const floaters: { m: THREE.Mesh; y: number; ph: number; spin: number }[] = [];
  for (let i = 0; i < (lo ? 4 : 10); i++) {
    const a = R() * Math.PI * 2;
    const r = 19 + R() * 10;
    const s = 0.6 + R() * 1.6;
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 1), rockMat);
    const y = -3 + R() * 9;
    m.position.set(Math.cos(a) * r, y, Math.sin(a) * r - 4);
    if (m.position.z > 8) m.position.z -= 18;
    scene.add(m);
    // grama no topo
    const cap = new THREE.Mesh(new THREE.SphereGeometry(s * 0.95, 12, 6, 0, Math.PI * 2, 0, Math.PI / 3), new THREE.MeshStandardMaterial({ color: '#3d9f4a', roughness: 0.9 }));
    cap.position.y = s * 0.35;
    m.add(cap);
    floaters.push({ m, y, ph: R() * 6, spin: (R() - 0.5) * 0.2 });
  }
  updaters.push((t) => {
    for (const f of floaters) { f.m.position.y = f.y + Math.sin(t * 0.5 + f.ph) * 0.6; f.m.rotation.y += f.spin * 0.016; }
  });

  // ================= névoa abaixo da ilha =================
  const mistMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false,
    uniforms: { uT: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      varying vec2 vUv; uniform float uT;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      float fbm(vec2 p){ float v=0.0,a=0.5; for(int i=0;i<5;i++){ v+=a*n(p); p*=2.1; a*=0.5; } return v; }
      void main(){
        vec2 p = (vUv - 0.5) * 9.0;
        float f = fbm(p + vec2(uT * 0.05, uT * 0.03)) * fbm(p * 0.6 - vec2(uT * 0.02, 0.0));
        float d = length(vUv - 0.5) * 2.0;
        float a = smoothstep(1.0, 0.2, d) * smoothstep(0.05, 0.45, f) * 0.85;
        vec3 c = mix(vec3(0.35, 0.12, 0.55), vec3(0.15, 0.55, 0.45), f);
        gl_FragColor = vec4(c, a);
      }`,
  });
  const mist = new THREE.Mesh(new THREE.PlaneGeometry(130, 130), mistMat);
  mist.rotation.x = -Math.PI / 2;
  mist.position.y = -9;
  scene.add(mist);
  updaters.push((t) => { mistMat.uniforms.uT.value = t; });

  // ================= vagalumes =================
  const nF = lo ? 60 : hi ? 260 : 140;
  const fGeo = new THREE.BufferGeometry();
  const fPos = new Float32Array(nF * 3);
  const fSeed = new Float32Array(nF);
  const fCol = new Float32Array(nF * 3);
  const c2 = new THREE.Color();
  for (let i = 0; i < nF; i++) {
    let x = 0, z = 0;
    do { x = (R() - 0.5) * 34; z = (R() - 0.5) * 30; } while (insideBoard(x, z, o.benchZ) && R() < 0.85);
    fPos.set([x, 0.3 + R() * 6, z], i * 3);
    fSeed[i] = R() * 100;
    c2.set(R() < 0.6 ? '#c8ff6a' : R() < 0.5 ? '#ffd86a' : '#7affe8');
    fCol.set([c2.r, c2.g, c2.b], i * 3);
  }
  fGeo.setAttribute('position', new THREE.BufferAttribute(fPos, 3));
  fGeo.setAttribute('aSeed', new THREE.BufferAttribute(fSeed, 1));
  fGeo.setAttribute('aCol', new THREE.BufferAttribute(fCol, 3));
  const fMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uT: { value: 0 }, uTex: { value: glowTexture() }, uScale: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute float aSeed; attribute vec3 aCol; uniform float uT; uniform float uScale; varying vec3 vC; varying float vA;
      void main(){
        vec3 p = position;
        p.x += sin(uT * 0.3 + aSeed) * 1.2; p.y += sin(uT * 0.7 + aSeed * 1.7) * 0.6; p.z += cos(uT * 0.25 + aSeed * 0.5) * 1.2;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vA = 0.35 + 0.65 * pow(0.5 + 0.5 * sin(uT * 2.2 + aSeed * 3.0), 3.0);
        vC = aCol;
        gl_PointSize = uScale * 26.0 / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uTex; varying vec3 vC; varying float vA;
      void main(){ vec4 t = texture2D(uTex, gl_PointCoord); gl_FragColor = vec4(vC * 2.2, t.a * vA); }`,
  });
  const flies = new THREE.Points(fGeo, fMat);
  scene.add(flies);
  updaters.push((t) => { fMat.uniforms.uT.value = t; fMat.uniforms.uScale.value = window.devicePixelRatio > 1 ? 2 : 1.4; });

  return {
    update: (t, dt) => { for (const u of updaters) u(t, dt); },
  };
}
