import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

// Mapa de ambiente (reflexos) compartilhado + materiais estilizados com "rim light".

const envCache = new WeakMap<THREE.WebGLRenderer, THREE.Texture>();

export function envMapFor(renderer: THREE.WebGLRenderer) {
  let tex = envCache.get(renderer);
  if (!tex) {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    // tinge o ambiente com as cores do jogo (roxo/verde)
    room.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshBasicMaterial | undefined;
      if (m && 'color' in m && m.color) {
        const lum = m.color.r + m.color.g + m.color.b;
        if (lum > 2.5) m.color.multiply(new THREE.Color(o.position.x > 0 ? '#ffd9f4' : '#d9ffe4'));
      }
    });
    tex = pmrem.fromScene(room, 0.04).texture;
    pmrem.dispose();
    envCache.set(renderer, tex);
  }
  return tex;
}

/** Adiciona brilho de borda (fresnel) ao material — dá o visual "premium" de jogo estilizado. */
export function addRim(m: THREE.MeshStandardMaterial, color: THREE.ColorRepresentation = '#c9b8ff', strength = 0.45, power = 3.0) {
  const rim = { value: new THREE.Color(color) };
  const str = { value: strength };
  const pw = { value: power };
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uRim = rim;
    sh.uniforms.uRimStr = str;
    sh.uniforms.uRimPow = pw;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uRim;\nuniform float uRimStr;\nuniform float uRimPow;')
      .replace(
        '#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\nfloat rimF = pow(1.0 - saturate(abs(dot(normalize(vViewPosition), normal))), uRimPow);\ntotalEmissiveRadiance += uRim * rimF * uRimStr;',
      );
  };
  m.customProgramCacheKey = () => 'rim-v1';
  m.userData.rim = { rim, str };
  return m;
}

/** Textura procedural de pedra/ruído (canvas). */
const texCache = new Map<string, THREE.Texture>();
export function noiseTexture(key: string, base: string, spots: string[], size = 256, scale = 1): THREE.Texture {
  const hit = texCache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d')!;
  x.fillStyle = base;
  x.fillRect(0, 0, size, size);
  let seed = key.split('').reduce((s, ch) => s * 31 + ch.charCodeAt(0), 7) >>> 0;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 1400 * scale; i++) {
    const r = (0.5 + rnd() * 3.5) * (size / 256);
    x.globalAlpha = 0.05 + rnd() * 0.12;
    x.fillStyle = spots[Math.floor(rnd() * spots.length)];
    x.beginPath();
    x.arc(rnd() * size, rnd() * size, r, 0, Math.PI * 2);
    x.fill();
  }
  // rachaduras
  x.globalAlpha = 0.18;
  x.strokeStyle = 'rgba(0,0,0,0.6)';
  x.lineWidth = size / 256;
  for (let i = 0; i < 10 * scale; i++) {
    x.beginPath();
    let px = rnd() * size, py = rnd() * size;
    x.moveTo(px, py);
    for (let k = 0; k < 5; k++) { px += (rnd() - 0.5) * size * 0.12; py += (rnd() - 0.5) * size * 0.12; x.lineTo(px, py); }
    x.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  texCache.set(key, tex);
  return tex;
}

/** Sprite circular suave (partículas, vagalumes). */
let glowTex: THREE.Texture | null = null;
export function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d')!;
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.8)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.18)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c);
  return glowTex;
}
