import * as THREE from 'three';
import type { Effect } from '../replay';

// Efeitos de habilidade com shaders próprios: círculos rúnicos, ondas de choque, explosões
// volumétricas, colunas de luz, bolhas de escudo, raios do céu, rachaduras e redemoinhos.
// Tudo aditivo e "HDR" (acima de 1.0) para estourar no bloom.

export interface VfxHost {
  scene: THREE.Scene;
  /** posição dos pés de uma unidade do combate (null se não existe mais) */
  unitPos(uid: number, now: number, out: THREE.Vector3): THREE.Vector3 | null;
  hexPos(r: number, c: number, out: THREE.Vector3): THREE.Vector3;
  emit(pos: THREE.Vector3, o: { vel?: THREE.Vector3; spread?: number; life?: number; s0?: number; s1?: number; color?: string; alpha?: number; additive?: boolean }): void;
  shake(k: number): void;
  lights: boolean;
}

interface Item {
  start: number;
  dur: number;
  obj: THREE.Object3D;
  update(p: number, now: number, dt: number): void;
  dispose: (() => void)[];
}

const hdr = (c: THREE.ColorRepresentation, k: number) => new THREE.Color(c).multiplyScalar(k);
const additive = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false } as const;

// ---------------- texturas desenhadas uma vez ----------------
const texCache = new Map<string, THREE.Texture>();
function canvasTex(key: string, size: number, draw: (x: CanvasRenderingContext2D, s: number) => void) {
  let t = texCache.get(key);
  if (t) return t;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d')!;
  draw(x, size);
  t = new THREE.CanvasTexture(c);
  t.anisotropy = 4;
  texCache.set(key, t);
  return t;
}

function runeTex() {
  return canvasTex('rune', 512, (x, s) => {
    const c = s / 2;
    x.translate(c, c);
    x.strokeStyle = x.fillStyle = '#fff';
    x.shadowColor = '#fff';
    x.shadowBlur = 8;
    const ring = (r: number, w: number) => { x.lineWidth = w; x.beginPath(); x.arc(0, 0, r, 0, Math.PI * 2); x.stroke(); };
    ring(c * 0.96, 6);
    ring(c * 0.86, 3);
    ring(c * 0.5, 4);
    ring(c * 0.42, 2);
    // marcas entre os anéis
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      const l = i % 4 === 0 ? 0.08 : 0.04;
      x.lineWidth = i % 4 === 0 ? 4 : 2;
      x.beginPath();
      x.moveTo(Math.cos(a) * c * 0.86, Math.sin(a) * c * 0.86);
      x.lineTo(Math.cos(a) * c * (0.86 - l), Math.sin(a) * c * (0.86 - l));
      x.stroke();
    }
    // "glifos" (folhinhas e símbolos) no anel externo
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + 0.1;
      x.save();
      x.rotate(a);
      x.translate(c * 0.66, 0);
      x.rotate(Math.PI / 2);
      x.lineWidth = 3;
      x.beginPath();
      const k = Math.floor(rnd() * 4);
      if (k === 0) { x.arc(0, 0, 10, 0, Math.PI * 2); x.moveTo(0, -16); x.lineTo(0, 16); }
      else if (k === 1) { x.moveTo(-12, 10); x.lineTo(0, -14); x.lineTo(12, 10); x.closePath(); }
      else if (k === 2) { for (let j = -2; j <= 2; j++) { x.moveTo(0, 12); x.lineTo(Math.sin(j * 0.6) * 16, 12 - Math.cos(j * 0.6) * 22); } }
      else { x.moveTo(-12, -12); x.lineTo(12, 12); x.moveTo(12, -12); x.lineTo(-12, 12); x.moveTo(-14, 0); x.lineTo(14, 0); }
      x.stroke();
      x.restore();
    }
    // hexagrama central
    x.lineWidth = 4;
    for (const off of [0, Math.PI / 3]) {
      x.beginPath();
      for (let i = 0; i <= 3; i++) {
        const a = off + (i / 3) * Math.PI * 2 - Math.PI / 2;
        const px = Math.cos(a) * c * 0.42, py = Math.sin(a) * c * 0.42;
        if (i === 0) x.moveTo(px, py); else x.lineTo(px, py);
      }
      x.stroke();
    }
    ring(c * 0.12, 3);
  });
}

function crackTex() {
  return canvasTex('cracks', 512, (x, s) => {
    const c = s / 2;
    x.translate(c, c);
    x.strokeStyle = '#fff';
    x.shadowColor = '#fff';
    x.shadowBlur = 10;
    x.lineCap = 'round';
    let seed = 3;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const branch = (px: number, py: number, a: number, len: number, w: number, depth: number) => {
      x.lineWidth = w;
      x.beginPath();
      x.moveTo(px, py);
      const steps = 6;
      for (let i = 0; i < steps; i++) {
        a += (rnd() - 0.5) * 0.7;
        px += Math.cos(a) * (len / steps);
        py += Math.sin(a) * (len / steps);
        x.lineTo(px, py);
        if (depth > 0 && rnd() < 0.25) {
          const sx = px, sy = py;
          x.stroke();
          branch(sx, sy, a + (rnd() - 0.5) * 1.6, len * 0.45, w * 0.6, depth - 1);
          x.lineWidth = w;
          x.beginPath();
          x.moveTo(sx, sy);
        }
        w *= 0.88;
        x.lineWidth = w;
      }
      x.stroke();
    };
    for (let i = 0; i < 11; i++) branch(0, 0, (i / 11) * Math.PI * 2 + rnd() * 0.3, c * (0.6 + rnd() * 0.35), 9, 2);
    const g = x.createRadialGradient(0, 0, 0, 0, 0, c * 0.35);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(-c, -c, s, s);
  });
}

function plusTex() {
  return canvasTex('plus', 64, (x, s) => {
    x.fillStyle = '#fff';
    x.shadowColor = '#fff';
    x.shadowBlur = 8;
    const w = s * 0.2, l = s * 0.62;
    x.fillRect((s - w) / 2, (s - l) / 2, w, l);
    x.fillRect((s - l) / 2, (s - w) / 2, l, w);
  });
}

// ---------------- shaders ----------------
const NOISE = /* glsl */ `
  float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float noise(vec3 x) {
    vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float fbm(vec3 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
`;

const UV_VERT = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

function shockMat(color: THREE.Color) {
  return new THREE.ShaderMaterial({
    ...additive,
    side: THREE.DoubleSide,
    uniforms: { uP: { value: 0 }, uColor: { value: color }, uA: { value: 1 } },
    vertexShader: UV_VERT,
    fragmentShader: /* glsl */ `
      uniform float uP, uA; uniform vec3 uColor; varying vec2 vUv;
      void main() {
        float r = length(vUv * 2.0 - 1.0);
        float edge = uP;
        float ring = smoothstep(edge - 0.22, edge, r) * (1.0 - smoothstep(edge, edge + 0.025, r));
        float fill = (1.0 - smoothstep(0.0, edge, r)) * 0.08;
        float a = (ring * 1.6 + fill) * uA;
        gl_FragColor = vec4(uColor * a, a);
      }`,
  });
}

function fireballMat(color: THREE.Color) {
  return new THREE.ShaderMaterial({
    ...additive,
    uniforms: { uP: { value: 0 }, uT: { value: 0 }, uColor: { value: color } },
    vertexShader: /* glsl */ `
      uniform float uP, uT; varying float vD; varying vec3 vN; varying vec3 vV;
      ${NOISE}
      void main() {
        float d = fbm(normal * 3.2 + vec3(0.0, -uT * 2.5, uT));
        vD = d;
        vec3 p = position * (0.75 + d * 0.6);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uP; uniform vec3 uColor; varying float vD; varying vec3 vN; varying vec3 vV;
      void main() {
        float face = pow(abs(dot(vN, vV)), 0.6);
        float heat = clamp(vD * 1.3 + pow(face, 3.0) * 0.7 - uP * 1.3, 0.0, 1.0);
        vec3 col = mix(uColor * 0.45, uColor * 2.2, smoothstep(0.1, 0.5, heat));
        col = mix(col, vec3(4.0, 3.7, 3.2), smoothstep(0.62, 1.0, heat));
        float a = (1.0 - smoothstep(0.3, 0.95, uP)) * (0.25 + face * 0.75);
        a *= smoothstep(uP * 0.75, uP * 0.75 + 0.18, vD); // dissolve: vira fumaça rasgada ao sumir
        gl_FragColor = vec4(col * a, a);
      }`,
  });
}

function pillarMat(color: THREE.Color) {
  return new THREE.ShaderMaterial({
    ...additive,
    side: THREE.DoubleSide,
    uniforms: { uT: { value: 0 }, uA: { value: 0 }, uColor: { value: color } },
    vertexShader: UV_VERT,
    fragmentShader: /* glsl */ `
      uniform float uT, uA; uniform vec3 uColor; varying vec2 vUv;
      void main() {
        float fadeUp = pow(1.0 - vUv.y, 1.6);
        float streak = smoothstep(0.55, 1.0, sin(vUv.x * 6.2831 * 7.0 + vUv.y * 4.0 - uT * 3.0) * 0.5 + 0.5);
        float bands = smoothstep(0.7, 1.0, fract(vUv.y * 3.0 - uT * 1.6));
        float a = fadeUp * (0.35 + streak * 0.55 + bands * 0.4) * uA;
        gl_FragColor = vec4(uColor * a, a);
      }`,
  });
}

function bubbleMat(color: THREE.Color) {
  return new THREE.ShaderMaterial({
    ...additive,
    side: THREE.FrontSide,
    uniforms: { uT: { value: 0 }, uA: { value: 0 }, uColor: { value: color } },
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main() {
        vP = position;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uT, uA; uniform vec3 uColor; varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main() {
        float f = pow(1.0 - abs(dot(vN, vV)), 2.4);
        // padrão hexagonal aproximado
        vec3 q = vP * 9.0;
        float hex = smoothstep(0.82, 0.97, max(abs(sin(q.x + q.y * 0.5)), max(abs(sin(q.y - q.z * 0.5)), abs(sin(q.z + q.x * 0.5)))));
        float sweep = smoothstep(0.12, 0.0, abs(vP.y - (fract(uT * 0.7) * 2.4 - 1.2)));
        float a = (f * 1.3 + hex * 0.22 + sweep * 0.35 + 0.04) * uA;
        gl_FragColor = vec4(uColor * a, a);
      }`,
  });
}

function beamMat(color: THREE.Color) {
  return new THREE.ShaderMaterial({
    ...additive,
    side: THREE.DoubleSide,
    uniforms: { uT: { value: 0 }, uA: { value: 0 }, uColor: { value: color } },
    vertexShader: UV_VERT,
    fragmentShader: /* glsl */ `
      uniform float uT, uA; uniform vec3 uColor; varying vec2 vUv;
      void main() {
        float pulse = smoothstep(0.4, 1.0, sin(vUv.y * 40.0 + uT * 22.0) * 0.5 + 0.5);
        float a = (0.45 + pulse * 0.8) * uA;
        gl_FragColor = vec4(uColor * a, a);
      }`,
  });
}

// ---------------- geometrias compartilhadas ----------------
const G = {
  plane: new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2),
  ball: new THREE.IcosahedronGeometry(1, 5),
  bubble: new THREE.IcosahedronGeometry(1, 4),
  pillar: new THREE.CylinderGeometry(1, 1, 1, 32, 1, true).translate(0, 0.5, 0),
  beam: new THREE.CylinderGeometry(1, 1, 1, 12, 1, true).translate(0, 0.5, 0),
  seg: new THREE.CylinderGeometry(1, 1, 1, 6, 1, true).translate(0, 0.5, 0),
};
const UP = new THREE.Vector3(0, 1, 0);

export class Vfx {
  private items: Item[] = [];
  private spawned = new WeakSet<Effect>();
  private lights: { l: THREE.PointLight; until: number; start: number; peak: number }[] = [];
  private last = 0;
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(private host: VfxHost) {
    // luzes de impacto em pool (quantidade fixa → sem recompilar shaders)
    if (host.lights) {
      for (let i = 0; i < 2; i++) {
        const l = new THREE.PointLight('#ffffff', 0, 7, 1.6);
        host.scene.add(l);
        this.lights.push({ l, until: 0, start: 0, peak: 0 });
      }
    }
  }

  /** chamado para cada efeito do replay; cria só os tipos que este sistema conhece (uma vez) */
  handle(f: Effect, now: number): boolean {
    if (this.spawned.has(f)) return true;
    const known = f.k === 'rune' || f.k === 'nova' || f.k === 'pillar' || f.k === 'bubble' || f.k === 'drain' || f.k === 'strike' || f.k === 'slam' || f.k === 'swirl' || f.k === 'plus' || f.k === 'meteor';
    if (!known) return false;
    if (now < f.start) return true;
    this.spawned.add(f);
    switch (f.k) {
      case 'rune': this.rune(f); break;
      case 'nova': this.nova(f); break;
      case 'pillar': this.pillar(f); break;
      case 'bubble': this.bubble(f); break;
      case 'drain': this.drain(f); break;
      case 'strike': this.strike(f); break;
      case 'slam': this.slam(f); break;
      case 'swirl': this.swirl(f); break;
      case 'plus': this.plus(f); break;
      case 'meteor': this.meteor(f); break;
    }
    return true;
  }

  update(now: number) {
    const dt = Math.min(0.05, (now - (this.last || now)) / 1000);
    this.last = now;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      const p = (now - it.start) / it.dur;
      if (p >= 1) { this.kill(it); this.items.splice(i, 1); continue; }
      if (p >= 0) { it.obj.visible = true; it.update(p, now, dt); } else it.obj.visible = false;
    }
    for (const L of this.lights) {
      if (now >= L.until) { L.l.intensity = 0; continue; }
      const k = (now - L.start) / (L.until - L.start);
      L.l.intensity = L.peak * Math.pow(1 - k, 2);
    }
  }

  clear() {
    for (const it of this.items) this.kill(it);
    this.items = [];
    for (const L of this.lights) { L.l.intensity = 0; L.until = 0; }
  }

  // ---------------- utilitários ----------------
  private kill(it: Item) {
    this.host.scene.remove(it.obj);
    for (const d of it.dispose) d();
  }
  private add(start: number, dur: number, obj: THREE.Object3D, update: Item['update'], dispose: (() => void)[]) {
    obj.visible = false;
    obj.traverse((o) => { o.frustumCulled = false; o.renderOrder = 5; });
    this.host.scene.add(obj);
    this.items.push({ start, dur, obj, update, dispose });
  }
  private flash(pos: THREE.Vector3, color: THREE.ColorRepresentation, peak: number, dur: number, now: number) {
    if (!this.lights.length) return;
    const L = this.lights.reduce((a, b) => (a.until < b.until ? a : b));
    L.l.color.set(color);
    L.l.position.copy(pos).add(this.v1.set(0, 1.2, 0));
    L.start = now;
    L.until = now + dur;
    L.peak = peak;
  }
  private where(f: { u?: number; r?: number; c?: number }, now: number, out: THREE.Vector3) {
    if (f.u !== undefined) { const p = this.host.unitPos(f.u, now, out); if (p) return p; }
    if (f.r !== undefined && f.c !== undefined) return this.host.hexPos(f.r, f.c, out);
    return out.set(0, 0, 0);
  }
  private shock(pos: THREE.Vector3, color: THREE.ColorRepresentation, radius: number, start: number, dur: number, k = 2.4) {
    const mat = shockMat(hdr(color, k));
    const m = new THREE.Mesh(G.plane, mat);
    m.position.copy(pos).setY(0.16);
    m.scale.setScalar(radius);
    this.add(start, dur, m, (p) => {
      const e = 1 - Math.pow(1 - p, 3);
      mat.uniforms.uP.value = 0.08 + e * 0.92;
      mat.uniforms.uA.value = 1 - p * p;
    }, [() => mat.dispose()]);
  }

  // ---------------- efeitos ----------------
  /** círculo mágico no chão (embaixo de quem conjura ou no alvo da área) */
  private rune(f: Extract<Effect, { k: 'rune' }>) {
    const g = new THREE.Group();
    const col = hdr(f.color, 2.2);
    const mk = (s: number, op: number) => {
      const mat = new THREE.MeshBasicMaterial({ map: runeTex(), color: col, opacity: op, ...additive, side: THREE.DoubleSide });
      const m = new THREE.Mesh(G.plane, mat);
      m.scale.setScalar(s);
      g.add(m);
      return m;
    };
    const outer = mk(f.rad, 1);
    const inner = mk(f.rad * 0.55, 0.8);
    inner.position.y = 0.01;
    const glowMat = shockMat(hdr(f.color, 0.9));
    glowMat.uniforms.uP.value = 1;
    const glow = new THREE.Mesh(G.plane, glowMat);
    glow.scale.setScalar(f.rad * 1.05);
    g.add(glow);
    const follow = f.u;
    this.add(f.start, f.dur, g, (p, now) => {
      this.where(f, now, g.position);
      g.position.y = 0.17;
      const inK = Math.min(1, p / 0.18);
      const outK = p > 0.75 ? 1 - (p - 0.75) / 0.25 : 1;
      const s = (0.4 + 0.6 * (1 - Math.pow(1 - inK, 3))) * (1 + (1 - outK) * 0.15);
      g.scale.setScalar(s);
      outer.rotation.y = p * 2.2;
      inner.rotation.y = -p * 3.5;
      (outer.material as THREE.MeshBasicMaterial).opacity = outK;
      (inner.material as THREE.MeshBasicMaterial).opacity = outK * 0.8;
      glowMat.uniforms.uA.value = outK * 0.6;
      if (follow !== undefined && Math.random() < 0.5) {
        const a = Math.random() * Math.PI * 2;
        this.host.emit(this.v2.copy(g.position).add(this.v1.set(Math.cos(a) * f.rad * 0.8, 0.05, Math.sin(a) * f.rad * 0.8)),
          { vel: this.v1.set(0, 1.4, 0).clone(), spread: 0.2, life: 0.6, s0: 0.18, s1: 0.02, color: f.color, alpha: 0.9, additive: true });
      }
    }, [() => g.traverse((o) => { const m = (o as THREE.Mesh).material as THREE.Material | undefined; m?.dispose(); })]);
  }

  /** explosão volumétrica + onda de choque + faíscas + luz */
  private nova(f: Extract<Effect, { k: 'nova' }>) {
    const pos = this.where(f, f.start, new THREE.Vector3());
    const mat = fireballMat(new THREE.Color(f.color));
    const ball = new THREE.Mesh(G.ball, mat);
    ball.position.copy(pos).setY(0.6 + f.rad * 0.15);
    const R = 0.45 + f.rad * 0.6;
    this.add(f.start, f.dur, ball, (p, now) => {
      mat.uniforms.uP.value = p;
      mat.uniforms.uT.value = now / 1000;
      const e = 1 - Math.pow(1 - Math.min(1, p * 1.6), 3);
      ball.scale.setScalar(R * (0.25 + e * 0.75));
    }, [() => mat.dispose()]);
    this.shock(pos, f.color, R * 1.7, f.start, f.dur * 0.8, 1.8);
    this.shock(pos, '#ffffff', R * 1.1, f.start, f.dur * 0.5, 1.1);
    const n = Math.round(10 + f.rad * 14);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 2 + Math.random() * 3.5 * (0.6 + f.rad * 0.4);
      this.host.emit(this.v1.copy(pos).setY(0.6), {
        vel: new THREE.Vector3(Math.cos(a) * sp, 1 + Math.random() * 3, Math.sin(a) * sp), spread: 0.2, life: 0.5 + Math.random() * 0.4,
        s0: 0.22, s1: 0.02, color: Math.random() < 0.3 ? '#ffffff' : f.color, alpha: 1, additive: true,
      });
    }
    this.flash(pos, f.color, 18 + f.rad * 14, Math.min(500, f.dur), f.start);
    if (f.rad >= 1.5) this.host.shake(0.15 + f.rad * 0.08);
  }

  /** coluna de luz subindo (cura / buffs) */
  private pillar(f: Extract<Effect, { k: 'pillar' }>) {
    const g = new THREE.Group();
    const mat = pillarMat(hdr(f.color, 2.4));
    const outer = new THREE.Mesh(G.pillar, mat);
    outer.scale.set(0.62, 3.4, 0.62);
    const mat2 = pillarMat(hdr('#ffffff', 1.6));
    const inner = new THREE.Mesh(G.pillar, mat2);
    inner.scale.set(0.3, 2.6, 0.3);
    g.add(outer, inner);
    const base = shockMat(hdr(f.color, 1.6));
    base.uniforms.uP.value = 0.9;
    const disc = new THREE.Mesh(G.plane, base);
    disc.scale.setScalar(0.9);
    disc.position.y = 0.02;
    g.add(disc);
    this.add(f.start, f.dur, g, (p, now) => {
      this.where(f, now, g.position);
      g.position.y = 0.15;
      const a = Math.min(1, p / 0.15) * (p > 0.6 ? 1 - (p - 0.6) / 0.4 : 1);
      mat.uniforms.uA.value = a;
      mat2.uniforms.uA.value = a * 0.7;
      mat.uniforms.uT.value = mat2.uniforms.uT.value = now / 1000;
      base.uniforms.uA.value = a;
      outer.scale.x = outer.scale.z = 0.5 + Math.min(1, p / 0.2) * 0.15;
      if (Math.random() < 0.6) {
        const ang = Math.random() * Math.PI * 2;
        this.host.emit(this.v2.copy(g.position).add(this.v1.set(Math.cos(ang) * 0.45, 0.1, Math.sin(ang) * 0.45)),
          { vel: new THREE.Vector3(0, 2.2 + Math.random(), 0), spread: 0.15, life: 0.8, s0: 0.16, s1: 0.02, color: f.color, alpha: 1, additive: true });
      }
    }, [() => { mat.dispose(); mat2.dispose(); base.dispose(); }]);
  }

  /** bolha de escudo hexagonal */
  private bubble(f: Extract<Effect, { k: 'bubble' }>) {
    const mat = bubbleMat(hdr(f.color, 1.8));
    const m = new THREE.Mesh(G.bubble, mat);
    this.add(f.start, f.dur, m, (p, now) => {
      this.where(f, now, m.position);
      m.position.y = 1.0;
      const inK = Math.min(1, p / 0.15);
      const pop = p > 0.85 ? (p - 0.85) / 0.15 : 0;
      const s = 1.15 * (0.6 + 0.4 * (1 - Math.pow(1 - inK, 3)) + Math.sin(inK * Math.PI) * 0.12 + pop * 0.25);
      m.scale.set(s, s * 1.05, s);
      mat.uniforms.uA.value = inK * (1 - pop);
      mat.uniforms.uT.value = now / 1000;
    }, [() => mat.dispose()]);
    const pos = this.where(f, f.start, new THREE.Vector3());
    this.shock(pos, f.color, 2.0, f.start, 450);
  }

  /** raio que suga vida do alvo para quem conjura */
  private drain(f: Extract<Effect, { k: 'drain' }>) {
    const g = new THREE.Group();
    const mat = beamMat(hdr(f.color, 2.6));
    const outer = new THREE.Mesh(G.beam, mat);
    const core = new THREE.Mesh(G.beam, new THREE.MeshBasicMaterial({ color: hdr('#ffffff', 3), ...additive }));
    g.add(outer, core);
    const a = new THREE.Vector3(), b = new THREE.Vector3(), d = new THREE.Vector3();
    this.add(f.start, f.dur, g, (p, now) => {
      if (!this.host.unitPos(f.to, now, a) || !this.host.unitPos(f.from, now, b)) return;
      a.y += 1.0; b.y += 1.1;
      d.subVectors(b, a);
      const len = d.length();
      g.position.copy(a);
      g.quaternion.setFromUnitVectors(UP, d.normalize());
      const w = Math.sin(Math.min(1, p / 0.15) * Math.PI * 0.5) * (p > 0.8 ? 1 - (p - 0.8) / 0.2 : 1);
      outer.scale.set(0.11 * w, len, 0.11 * w);
      core.scale.set(0.035 * w, len, 0.035 * w);
      mat.uniforms.uA.value = w;
      mat.uniforms.uT.value = now / 1000;
      // gotas de energia viajando até quem suga
      const q = Math.random();
      this.host.emit(this.v2.copy(a).lerp(b, q), { vel: d.clone().multiplyScalar(len * 1.6), spread: 0.25, life: 0.25, s0: 0.25, s1: 0.04, color: f.color, alpha: 1, additive: true });
    }, [() => { mat.dispose(); (core.material as THREE.Material).dispose(); }]);
    const pos = this.host.unitPos(f.to, f.start, new THREE.Vector3());
    if (pos) this.flash(pos, f.color, 12, f.dur, f.start);
  }

  /** raio caindo do céu no alvo */
  private strike(f: Extract<Effect, { k: 'strike' }>) {
    const g = new THREE.Group();
    const coreMat = new THREE.MeshBasicMaterial({ color: hdr('#ffffff', 4), ...additive });
    const glowMat = new THREE.MeshBasicMaterial({ color: hdr(f.color, 2.5), ...additive, opacity: 0.6 });
    const N = 9;
    const cores: THREE.Mesh[] = [], glows: THREE.Mesh[] = [];
    for (let i = 0; i < N; i++) { const c = new THREE.Mesh(G.seg, coreMat); const gl = new THREE.Mesh(G.seg, glowMat); g.add(c, gl); cores.push(c); glows.push(gl); }
    const pts: THREE.Vector3[] = Array.from({ length: N + 1 }, () => new THREE.Vector3());
    const d = new THREE.Vector3();
    let nextJit = 0;
    const base = new THREE.Vector3();
    this.add(f.start, f.dur, g, (p, now) => {
      this.where(f, now, base);
      if (now >= nextJit) {
        nextJit = now + 45;
        for (let i = 0; i <= N; i++) {
          const k = i / N;
          pts[i].set(base.x + (i > 0 && i < N ? (Math.random() - 0.5) * 0.8 : 0), 9 * (1 - k) + 0.15, base.z + (i > 0 && i < N ? (Math.random() - 0.5) * 0.8 : 0));
        }
      }
      const w = p < 0.1 ? p / 0.1 : 1 - (p - 0.1) / 0.9;
      for (let i = 0; i < N; i++) {
        d.subVectors(pts[i + 1], pts[i]);
        const len = d.length();
        for (const [m, r] of [[cores[i], 0.06], [glows[i], 0.2]] as const) {
          m.position.copy(pts[i]);
          m.quaternion.setFromUnitVectors(UP, d.clone().normalize());
          m.scale.set(r * w, len, r * w);
        }
      }
      glowMat.opacity = 0.6 * w;
    }, [() => { coreMat.dispose(); glowMat.dispose(); }]);
    const pos = this.where(f, f.start, new THREE.Vector3());
    this.shock(pos, f.color, 2.2, f.start, 500);
    this.flash(pos, f.color, 30, 350, f.start);
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2;
      this.host.emit(this.v1.copy(pos).setY(0.3), { vel: new THREE.Vector3(Math.cos(a) * 3, 1 + Math.random() * 2.5, Math.sin(a) * 3), spread: 0.2, life: 0.4, s0: 0.18, s1: 0.02, color: '#ffffff', alpha: 1, additive: true });
    }
    this.host.shake(0.12);
  }

  /** pancada no chão: rachaduras brilhando + ondas + poeira */
  private slam(f: Extract<Effect, { k: 'slam' }>) {
    const pos = this.where(f, f.start, new THREE.Vector3());
    const mat = new THREE.MeshBasicMaterial({ map: crackTex(), color: hdr(f.color, 2.4), ...additive });
    const m = new THREE.Mesh(G.plane, mat);
    m.position.copy(pos).setY(0.165);
    m.rotation.y = Math.random() * Math.PI * 2;
    const R = 0.6 + f.rad * 1.1;
    this.add(f.start, f.dur, m, (p) => {
      const e = Math.min(1, p / 0.08);
      m.scale.setScalar(R * (0.5 + e * 0.5));
      mat.opacity = p < 0.08 ? e : Math.pow(1 - (p - 0.08) / 0.92, 1.5);
    }, [() => mat.dispose()]);
    this.shock(pos, f.color, R * 1.8, f.start, f.dur * 0.5, 3);
    this.shock(pos, '#ffffff', R * 1.2, f.start + 80, f.dur * 0.45, 1.8);
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2;
      this.host.emit(this.v1.copy(pos).add(this.v2.set(Math.cos(a) * 0.4, 0.2, Math.sin(a) * 0.4)), {
        vel: new THREE.Vector3(Math.cos(a) * 3.2, 0.5 + Math.random() * 0.8, Math.sin(a) * 3.2), spread: 0.4, life: 0.9, s0: 0.35, s1: 1.1, alpha: 0.45, color: '#d8c8b0',
      });
      if (i % 2 === 0) this.host.emit(this.v1.copy(pos).setY(0.3), {
        vel: new THREE.Vector3(Math.cos(a) * 1.5, 3 + Math.random() * 3, Math.sin(a) * 1.5), spread: 0.5, life: 0.7, s0: 0.14, s1: 0.03, color: '#a89a8a', alpha: 1,
      });
    }
    this.flash(pos, f.color, 22, 400, f.start);
    this.host.shake(0.32);
  }

  /** redemoinho de energia subindo (velocidade de ataque) */
  private swirl(f: Extract<Effect, { k: 'swirl' }>) {
    const g = new THREE.Group();
    this.add(f.start, f.dur, g, (p, now) => {
      this.where(f, now, g.position);
      for (let k = 0; k < 3; k++) {
        const a = now / 120 + (k / 3) * Math.PI * 2;
        const y = 0.2 + ((now / 400 + k / 3) % 1) * 2.2;
        const r = 0.65 - y * 0.12;
        this.host.emit(this.v1.copy(g.position).add(this.v2.set(Math.cos(a) * r, y, Math.sin(a) * r)), {
          vel: new THREE.Vector3(0, 0.8, 0), spread: 0.05, life: 0.35, s0: 0.22 * (1 - p * 0.5), s1: 0.03, color: f.color, alpha: 1, additive: true,
        });
      }
    }, []);
    const pos = this.where(f, f.start, new THREE.Vector3());
    this.shock(pos, f.color, 1.8, f.start, 500);
  }

  /** "+" verdinhos subindo da cura */
  private plus(f: Extract<Effect, { k: 'plus' }>) {
    const g = new THREE.Group();
    const mats: THREE.SpriteMaterial[] = [];
    const sp: { s: THREE.Sprite; x: number; z: number; d: number; v: number }[] = [];
    for (let i = 0; i < 6; i++) {
      const m = new THREE.SpriteMaterial({ map: plusTex(), color: hdr('#7dff9a', 2.2), ...additive });
      mats.push(m);
      const s = new THREE.Sprite(m);
      g.add(s);
      sp.push({ s, x: (Math.random() - 0.5) * 1.1, z: (Math.random() - 0.5) * 1.1, d: Math.random() * 0.4, v: 1.4 + Math.random() * 0.8 });
    }
    this.add(f.start, f.dur, g, (p, now) => {
      this.where(f, now, g.position);
      for (const q of sp) {
        const k = Math.max(0, (p - q.d) / (1 - q.d));
        q.s.position.set(q.x, 0.5 + k * q.v * 1.6, q.z);
        const sc = 0.3 * Math.sin(Math.min(1, k * 1.4) * Math.PI) + 0.001;
        q.s.scale.setScalar(sc);
        (q.s.material as THREE.SpriteMaterial).opacity = k > 0 ? 1 - k : 0;
      }
    }, [() => mats.forEach((m) => m.dispose())]);
  }

  /** meteoro em chamas caindo na diagonal com rastro */
  private meteor(f: Extract<Effect, { k: 'meteor' }>) {
    const target = this.host.hexPos(f.r, f.c, new THREE.Vector3());
    const mat = fireballMat(new THREE.Color('#ff7a2e'));
    const rock = new THREE.Mesh(G.ball, mat);
    const coreMat = new THREE.MeshBasicMaterial({ color: hdr('#ffd6a0', 3.5), ...additive });
    const core = new THREE.Mesh(G.ball, coreMat);
    core.scale.setScalar(0.45);
    rock.add(core);
    const fall = 0.42;
    this.add(f.start, f.dur * fall, rock, (p, now) => {
      const q = p;
      rock.position.set(target.x - 4.5 * (1 - q), 0.4 + 11 * (1 - q), target.z - 4.5 * (1 - q));
      rock.scale.setScalar(0.75);
      mat.uniforms.uP.value = 0.15;
      mat.uniforms.uT.value = now / 1000;
      for (let i = 0; i < 2; i++) {
        this.host.emit(rock.position, { vel: new THREE.Vector3(0.6, 1.2, 0.6), spread: 0.5, life: 0.6, s0: 0.9, s1: 0.15, color: i ? '#ffb35d' : '#ff5a1f', alpha: 0.9, additive: true });
      }
      if (Math.random() < 0.4) this.host.emit(rock.position, { vel: new THREE.Vector3(1.5, 2, 1.5), spread: 0.4, life: 1.2, s0: 0.6, s1: 1.4, color: '#4a3a40', alpha: 0.35 });
    }, [() => { mat.dispose(); coreMat.dispose(); }]);
    this.flash(target, '#ff8a3d', 10, f.dur * fall, f.start);
  }
}
