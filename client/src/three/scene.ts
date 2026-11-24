import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { UNITS, sellValue } from '../../../shared/data';
import { ITEMS } from '../../../shared/items';
import { BENCH_SIZE, BOARD_ROWS, COLS, COMBAT_ROWS } from '../../../shared/hex';
import type { Loc, OwnedUnit } from '../../../shared/types';
import { net } from '../net';
import { AB_COLOR, Replay, type Effect, type RU } from '../replay';
import { sfx } from '../sfx';
import { store } from '../store';
import { buildRobot, disposeRobot, type FaceExpr, type RobotModel } from './models';
import { addRim, envMapFor, glowTexture, noiseTexture } from './env';
import { Post, loadQuality, saveQuality, type Quality } from './post';
import { buildWorld, type World } from './world';
import { Vfx } from './vfx';
import { itemCanvas } from '../itemIcons';
import { onSkin, skin } from '../skins';
import { avatarColor, buildAvatar, type AvatarModel } from './avatar';

/** canto do tabuleiro onde a Fumacinha fica parada */
const AV_HOME = new THREE.Vector3(-6.5, 0.08, 5.5);

interface Av { m: AvatarModel; pos: THREE.Vector3; target: THREE.Vector3; yaw: number; moving: boolean; pickedAt: number }
interface Orb { mesh: THREE.Mesh; mat: THREE.MeshStandardMaterial; item: string | null; gold: number; born: number; x: number; z: number }
interface Pop { text: string; pos: THREE.Vector3; start: number; color: string }

export interface HoverInfo {
  defId: string;
  star: number;
  hp?: number;
  maxHp?: number;
  mana?: number;
  maxMana?: number;
  ownedId?: string;
  items?: string[];
}

export interface BoardCallbacks {
  hover: (info: HoverInfo | null, x: number, y: number) => void;
  dragging: (on: boolean, value: number) => void;
  overSell: (x: number, y: number) => boolean;
  /** clique direito num robô: abre o painel de detalhes */
  inspect?: (key: string | null) => void;
}

/** cor "acima do branco" para estourar no bloom */
const hdr = (c: THREE.ColorRepresentation, k: number) => new THREE.Color(c).multiplyScalar(k);
const SQ3 = Math.sqrt(3);
const TILE_Y = 0.08;
const BENCH_Z = 1.5 * 7 - 5.25 + 2.9;

export function hexWorld(r: number, c: number, out = new THREE.Vector3()) {
  return out.set(SQ3 * (c + 0.5 * (r & 1)) - SQ3 * 3.25, TILE_Y, 1.5 * r - 5.25);
}
export function benchWorld(i: number, out = new THREE.Vector3()) {
  return out.set((i - (BENCH_SIZE - 1) / 2) * 1.95, TILE_Y, BENCH_Z);
}

interface UV {
  key: string;
  defId: string;
  star: number;
  model: RobotModel;
  pos: THREE.Vector3;
  yaw: number;
  seen: boolean;
  lastSmoke: number;
  seed: number;
  spinners: THREE.Object3D[];
  swayers: THREE.Object3D[];
  flashing: boolean;
  lastTarget: THREE.Vector3;
  bounceAt: number;
  starAt: number;
  lastShot: number;
  lastCast: number;
  ghost?: boolean;
}

interface Desired {
  key: string;
  defId: string;
  star: number;
  target: THREE.Vector3;
  yaw: number;
  instant?: boolean;
  ru?: RU;
  info: HoverInfo;
  hovered?: boolean;
  fade?: number; // 0..1 (morte)
}

interface Particle {
  sprite: THREE.Sprite;
  mat: THREE.SpriteMaterial;
  vel: THREE.Vector3;
  life: number;
  age: number;
  s0: number;
  s1: number;
  a0: number;
  active: boolean;
}

const DEMO = ['rastamech', 'bigbongbang', 'mestrebob', 'donalarica', 'cogumelox', 'djchapadao', 'tragatron', 'ferrovelho', 'hackerverde'];

export class Scene3D {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(36, 1, 0.1, 200);
  overlay: HTMLCanvasElement;
  octx: CanvasRenderingContext2D;
  W = 1; H = 1; dpr = 1;
  area = { cx: 0, cy: 0, w: 1, h: 1 };
  camTarget = new THREE.Vector3(0, 0, 1.4);
  camDir = new THREE.Vector3();
  camDist = 20;
  active = false;
  hoveredOwnedId: string | null = null;
  hoverShown = false;
  drag: { unit: OwnedUnit; x: number; y: number } | null = null;
  itemDragPos: { x: number; y: number } | null = null;
  replay: Replay | null = null;
  replayKey = '';

  quality: Quality = 'alto';
  private post!: Post;
  private world: World | null = null;
  private vfx!: Vfx;
  private gapMats: THREE.MeshStandardMaterial[] = [];
  private skinMats: { neon?: THREE.MeshStandardMaterial; gold?: THREE.MeshStandardMaterial } = {};
  private tiles: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>[][] = [];
  private benchPads: THREE.Mesh[] = [];
  private units = new Map<string, UV>();
  private keyInfo = new Map<string, HoverInfo>();
  private particles: Particle[] = [];
  private fxObjs = new Map<Effect, THREE.Object3D>();
  private fxDone = new WeakSet<Effect>();
  private raycaster = new THREE.Raycaster();
  private ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), -TILE_Y);
  private last = performance.now();
  private tmp = new THREE.Vector3();
  private tmp2 = new THREE.Vector3();
  // Fumacinha (avatar), carrossel e orbes de saque
  private avatars = new Map<string, Av>();
  private myWalk = AV_HOME.clone();
  private orbWalk = false;
  private orbs: Orb[] = [];
  private orbGeo = new THREE.IcosahedronGeometry(0.26, 2);
  private lootSeen = 0;
  private pops: Pop[] = [];
  private carDeco: { ring: THREE.Mesh; barrier: THREE.Mesh; pole: THREE.Group } | null = null;
  private lastPhase = '';

  constructor(container: HTMLElement, private cb: BoardCallbacks) {
    this.quality = loadQuality();
    this.renderer = new THREE.WebGLRenderer({ antialias: this.quality === 'baixo', powerPreference: 'high-performance' });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap; // PCF + radius: suave e bem mais barato que PCFSoft
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    const gl = this.renderer.domElement;
    gl.className = 'stage-layer';
    container.appendChild(gl);
    this.overlay = document.createElement('canvas');
    this.overlay.className = 'stage-layer';
    container.appendChild(this.overlay);
    this.octx = this.overlay.getContext('2d')!;

    this.post = new Post(this.renderer, this.scene, this.camera);
    this.post.setQuality(this.quality);
    this.buildWorld();
    this.vfx = new Vfx({
      scene: this.scene,
      unitPos: (uid, now, out) => { const u = this.replay?.units.get(uid); return u ? this.ruWorld(u, now, out) : null; },
      hexPos: (r, c, out) => hexWorld(r, c, out),
      emit: (p, o) => this.emit(p, o),
      shake: (k) => { if (this.replay) this.replay.shake = Math.max(this.replay.shake, k); },
      lights: this.quality !== 'baixo',
    });

    window.addEventListener('resize', () => this.layout());
    this.overlay.addEventListener('pointerdown', (e) => this.onDown(e));
    this.overlay.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (!this.active) return;
      this.cb.inspect?.(this.unitUnder(e.clientX, e.clientY));
    });
    window.addEventListener('pointermove', (e) => this.onMove(e));
    window.addEventListener('pointerup', (e) => this.onUp(e));
    this.overlay.addEventListener('contextmenu', (e) => e.preventDefault());
    this.layout();
  }

  // =================== mundo ===================

  private buildWorld() {
    const s = this.scene;
    s.background = new THREE.Color('#0c0618');
    s.fog = new THREE.FogExp2('#1a0d2e', 0.0085);
    s.environment = envMapFor(this.renderer);
    s.environmentIntensity = 0.55;

    // ---- luzes: céu, sol quente, contraluz fria e neons ----
    s.add(new THREE.HemisphereLight('#cbb8ff', '#1f4a2a', 0.9));
    const sun = new THREE.DirectionalLight('#fff1dc', 2.6);
    sun.position.set(7, 18, 9);
    sun.castShadow = true;
    const sm = this.quality === 'baixo' ? 1024 : 2048;
    sun.shadow.mapSize.set(sm, sm);
    Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 60 });
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.02;
    sun.shadow.radius = this.quality === 'baixo' ? 1 : 3;
    s.add(sun);
    const back = new THREE.DirectionalLight('#9f7aff', 1.6);
    back.position.set(-6, 8, -14);
    s.add(back);
    const g1 = new THREE.PointLight('#5dff7a', 22, 30, 1.6);
    g1.position.set(-10, 5, 3);
    const g2 = new THREE.PointLight('#ff5d9e', 22, 30, 1.6);
    g2.position.set(10, 5, -3);
    s.add(g1, g2);

    this.world = buildWorld(s, { quality: this.quality, benchZ: BENCH_Z, emit: (p, o) => this.emit(p, o) });

    // ---- plataforma de pedra com borda dourada e neon ----
    const stone = noiseTexture('platform', '#3a2f55', ['#4f4270', '#251d3a', '#5d4f80'], 256, 1);
    stone.repeat.set(3, 3);
    const platMat = addRim(new THREE.MeshStandardMaterial({ color: '#8a7ab0', map: stone, roughness: 0.85, metalness: 0.05 }), '#9b7aff', 0.2);
    const gold = addRim(new THREE.MeshStandardMaterial({ color: '#d9a94a', metalness: 0.95, roughness: 0.28 }), '#ffe2a0', 0.35);
    const platform = new THREE.Mesh(new RoundedBoxGeometry(14.6, 0.7, 13.4, 5, 0.3), platMat);
    platform.position.y = -0.36;
    platform.receiveShadow = true;
    platform.castShadow = true;
    s.add(platform);
    const trim = new THREE.Mesh(new RoundedBoxGeometry(14.9, 0.14, 13.7, 4, 0.07), gold);
    trim.position.y = -0.13;
    trim.receiveShadow = true;
    s.add(trim);
    const neon = new THREE.Mesh(new RoundedBoxGeometry(15.0, 0.06, 13.8, 4, 0.03), new THREE.MeshStandardMaterial({ color: '#5dff7a', emissive: '#5dff7a', emissiveIntensity: 2.2 }));
    neon.position.y = -0.62;
    s.add(neon);
    this.skinMats.neon = neon.material as THREE.MeshStandardMaterial;
    this.skinMats.gold = gold as THREE.MeshStandardMaterial;
    // runas brilhando nas laterais
    const runeMat = new THREE.MeshStandardMaterial({ color: '#b98bff', emissive: '#b98bff', emissiveIntensity: 2.0 });
    for (let i = 0; i < 12; i++) {
      const side = i % 4;
      const k = (Math.floor(i / 4) - 1) * 4;
      const r = new THREE.Mesh(new THREE.CircleGeometry(0.16, 6), runeMat);
      if (side < 2) { r.position.set(k, -0.38, side === 0 ? 6.71 : -6.71); r.rotation.y = side === 0 ? 0 : Math.PI; }
      else { r.position.set(side === 2 ? 7.31 : -7.31, -0.38, k); r.rotation.y = side === 2 ? Math.PI / 2 : -Math.PI / 2; }
      s.add(r);
    }

    // rejunte brilhante: a luz passa entre os hexágonos
    const glowMine = new THREE.Mesh(new THREE.PlaneGeometry(13.6, 6.1), new THREE.MeshStandardMaterial({ color: '#000', emissive: '#4dff8a', emissiveIntensity: 0.5 }));
    glowMine.rotation.x = -Math.PI / 2;
    glowMine.position.set(0, 0.0, 3.0);
    const glowEnemy = new THREE.Mesh(new THREE.PlaneGeometry(13.6, 6.1), new THREE.MeshStandardMaterial({ color: '#000', emissive: '#b06bff', emissiveIntensity: 0.5 }));
    glowEnemy.rotation.x = -Math.PI / 2;
    glowEnemy.position.set(0, 0.0, -3.0);
    s.add(glowMine, glowEnemy);
    this.gapMats = [glowMine.material, glowEnemy.material];
    onSkin((sk) => {
      this.skinMats.neon?.color.set(sk.neon); this.skinMats.neon?.emissive.set(sk.neon);
      this.skinMats.gold?.color.set(sk.trim);
      this.gapMats[0]?.emissive.set(sk.gapMine); this.gapMats[1]?.emissive.set(sk.gapEnemy);
    });

    // ---- banco ----
    const benchBase = new THREE.Mesh(new RoundedBoxGeometry(19.0, 0.5, 2.8, 5, 0.22), platMat);
    benchBase.position.set(0, -0.3, BENCH_Z);
    benchBase.receiveShadow = true;
    benchBase.castShadow = true;
    s.add(benchBase);
    const benchTrim = new THREE.Mesh(new RoundedBoxGeometry(19.3, 0.1, 3.1, 4, 0.05), gold);
    benchTrim.position.set(0, -0.14, BENCH_Z);
    s.add(benchTrim);
    const benchNeon = new THREE.Mesh(new RoundedBoxGeometry(19.4, 0.05, 3.2, 4, 0.02), new THREE.MeshStandardMaterial({ color: '#ff5d9e', emissive: '#ff5d9e', emissiveIntensity: 2.0 }));
    benchNeon.position.set(0, -0.5, BENCH_Z);
    s.add(benchNeon);

    // ---- hexágonos de pedra chanfrados ----
    const hex = new THREE.Shape();
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 2 + (i * Math.PI) / 3;
      const x = Math.cos(a) * 0.88, y = Math.sin(a) * 0.88;
      if (i === 0) hex.moveTo(x, y); else hex.lineTo(x, y);
    }
    hex.closePath();
    const tileGeo = new THREE.ExtrudeGeometry(hex, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 3, curveSegments: 1 });
    tileGeo.rotateX(-Math.PI / 2);
    tileGeo.translate(0, -0.08, 0);
    // UV planar no topo para a textura de pedra
    {
      const pos = tileGeo.attributes.position as THREE.BufferAttribute;
      const uv = tileGeo.attributes.uv as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) * 0.35 + 0.5, pos.getZ(i) * 0.35 + 0.5);
    }
    const tileTex = noiseTexture('tile', '#9a92b0', ['#c9c2dc', '#6f6788', '#b0a8c8', '#7d8a9a'], 256, 1.1);
    for (let r = 0; r < COMBAT_ROWS; r++) {
      const row: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>[] = [];
      for (let c = 0; c < COLS; c++) {
        const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', map: tileTex, roughness: 0.78, metalness: 0.05, emissive: '#000000' });
        mat.map = tileTex.clone();
        mat.map.offset.set(((r * 7 + c) * 0.37) % 1, ((r * 3 + c * 5) * 0.29) % 1);
        mat.map.needsUpdate = true;
        const m = new THREE.Mesh(tileGeo, mat);
        hexWorld(r, c, m.position);
        m.position.y = 0.06;
        m.receiveShadow = true;
        m.castShadow = true;
        s.add(m);
        row.push(m);
      }
      this.tiles.push(row);
    }
    const divider = new THREE.Mesh(new THREE.BoxGeometry(13.2, 0.04, 0.07), new THREE.MeshStandardMaterial({ color: '#fff', emissive: '#e6ffcf', emissiveIntensity: 2.5 }));
    divider.position.set(0, 0.13, 0);
    s.add(divider);

    const padGeo = new RoundedBoxGeometry(1.7, 0.16, 1.7, 3, 0.1);
    for (let i = 0; i < BENCH_SIZE; i++) {
      const p = new THREE.Mesh(padGeo, new THREE.MeshStandardMaterial({ color: '#4a3a78', map: tileTex, roughness: 0.7, metalness: 0.1, emissive: '#000000' }));
      benchWorld(i, p.position);
      p.position.y = 0;
      p.receiveShadow = true;
      s.add(p);
      this.benchPads.push(p);
    }

    // partículas (fumaça / brilhos)
    const tex = glowTexture();
    const nP = this.quality === 'baixo' ? 260 : 600;
    for (let i = 0; i < nP; i++) {
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0, fog: false });
      const sprite = new THREE.Sprite(mat);
      sprite.visible = false;
      s.add(sprite);
      this.particles.push({ sprite, mat, vel: new THREE.Vector3(), life: 1, age: 0, s0: 0.2, s1: 0.6, a0: 0.5, active: false });
    }
  }

  setQuality(q: Quality) {
    saveQuality(q);
    location.reload();
  }

  emit(pos: THREE.Vector3, o: { vel?: THREE.Vector3; spread?: number; life?: number; s0?: number; s1?: number; color?: string; alpha?: number; additive?: boolean }) {
    const p = this.particles.find((x) => !x.active);
    if (!p) return;
    p.active = true;
    p.age = 0;
    p.life = o.life ?? 1.4;
    p.s0 = o.s0 ?? 0.2;
    p.s1 = o.s1 ?? 0.7;
    p.a0 = o.alpha ?? 0.5;
    const sp = o.spread ?? 0.15;
    p.vel.copy(o.vel ?? new THREE.Vector3(0, 0.6, 0)).add(new THREE.Vector3((Math.random() - 0.5) * sp, (Math.random() - 0.5) * sp, (Math.random() - 0.5) * sp));
    p.sprite.position.copy(pos);
    p.mat.color.set(o.color ?? '#d8d0f0');
    if (o.additive) p.mat.color.multiplyScalar(2.4); // HDR: brilha no bloom
    p.mat.blending = o.additive ? THREE.AdditiveBlending : THREE.NormalBlending;
    p.sprite.visible = true;
  }

  private updateParticles(dt: number) {
    for (const p of this.particles) {
      if (!p.active) continue;
      p.age += dt;
      const k = p.age / p.life;
      if (k >= 1) { p.active = false; p.sprite.visible = false; continue; }
      p.sprite.position.addScaledVector(p.vel, dt);
      p.vel.multiplyScalar(1 - dt * 0.8);
      const s = p.s0 + (p.s1 - p.s0) * k;
      p.sprite.scale.set(s, s, s);
      p.mat.opacity = p.a0 * (1 - k) * Math.min(1, k * 6);
    }
  }

  // =================== layout / câmera ===================

  layout() {
    this.dpr = this.quality === 'alto' ? Math.min(2, window.devicePixelRatio || 1) : 1;
    this.W = window.innerWidth;
    this.H = window.innerHeight;
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(this.W, this.H);
    this.post.setSize(this.W, this.H, this.dpr);
    this.overlay.width = this.W * this.dpr;
    this.overlay.height = this.H * this.dpr;
    this.overlay.style.width = `${this.W}px`;
    this.overlay.style.height = `${this.H}px`;

    let top = 0, bottom = this.H, left = 0, right = this.W;
    if (this.active) {
      const rect = (id: string) => document.getElementById(id)?.getBoundingClientRect();
      const tb = rect('topbar'), sb = rect('shopbar'), tr = rect('traits'), sd = rect('sidebar');
      if (tb) top = tb.bottom;
      if (sb) bottom = sb.top;
      if (tr && tr.width > 0) left = tr.right;
      if (sd && sd.width > 0) right = sd.left;
    }
    this.area = { cx: (left + right) / 2, cy: (top + bottom) / 2, w: Math.max(50, right - left - 16), h: Math.max(50, bottom - top - 8) };
    this.fitCamera();
  }

  private fitCamera() {
    const el = THREE.MathUtils.degToRad(this.active ? 54 : 38);
    this.camDir.set(0, Math.sin(el), Math.cos(el));
    const pts = [
      new THREE.Vector3(-7.2, 0, -6.6), new THREE.Vector3(7.2, 0, -6.6),
      new THREE.Vector3(-7.2, 2.2, -6.6), new THREE.Vector3(7.2, 2.2, -6.6),
      new THREE.Vector3(-9.6, 0, BENCH_Z + 1.3), new THREE.Vector3(9.6, 0, BENCH_Z + 1.3),
      new THREE.Vector3(-9.6, 1.8, BENCH_Z - 0.9), new THREE.Vector3(9.6, 1.8, BENCH_Z - 0.9),
    ];
    const cam = this.camera;
    cam.aspect = this.W / this.H;
    cam.clearViewOffset();
    const measure = (d: number) => {
      cam.position.copy(this.camTarget).addScaledVector(this.camDir, d);
      cam.lookAt(this.camTarget);
      cam.updateMatrixWorld();
      cam.updateProjectionMatrix();
      let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
      for (const p of pts) {
        const v = p.clone().project(cam);
        minx = Math.min(minx, v.x); maxx = Math.max(maxx, v.x);
        miny = Math.min(miny, v.y); maxy = Math.max(maxy, v.y);
      }
      return { w: ((maxx - minx) / 2) * this.W, h: ((maxy - miny) / 2) * this.H, cx: (minx + maxx) / 2, cy: (miny + maxy) / 2 };
    };
    const aw = this.active ? this.area.w : this.W * 0.9;
    const ah = this.active ? this.area.h : this.H * 0.9;
    let lo = 4, hi = 120;
    for (let i = 0; i < 30; i++) {
      const mid = (lo + hi) / 2;
      const m = measure(mid);
      if (m.w > aw || m.h > ah) lo = mid; else hi = mid;
    }
    this.camDist = hi;
    const m = measure(hi);
    const sx = ((m.cx + 1) / 2) * this.W;
    const sy = ((1 - m.cy) / 2) * this.H;
    const acx = this.active ? this.area.cx : this.W / 2;
    const acy = this.active ? this.area.cy : this.H * 0.58;
    cam.setViewOffset(this.W, this.H, sx - acx, sy - acy, this.W, this.H);
    cam.updateProjectionMatrix();
  }

  /** projeta um ponto do mundo para pixels da tela */
  project(v: THREE.Vector3) {
    const p = this.tmp2.copy(v).project(this.camera);
    return { x: ((p.x + 1) / 2) * this.W, y: ((1 - p.y) / 2) * this.H, behind: p.z > 1 };
  }

  // =================== estado ===================

  get me() { return store.state?.me; }
  get phase() { return store.state?.phase; }
  get inCombatView() {
    return this.phase === 'combat' && !!store.combat && store.combat.round === store.state?.round;
  }

  ownedAt(loc: Loc): OwnedUnit | undefined {
    const me = this.me;
    if (!me) return;
    if (loc.zone === 'bench') return me.units.find((u) => u.loc.zone === 'bench' && u.loc.i === loc.i);
    if (loc.r < BOARD_ROWS) return;
    const lr = loc.r - BOARD_ROWS;
    return me.units.find((u) => u.loc.zone === 'board' && u.loc.r === lr && u.loc.c === loc.c);
  }

  scouting() {
    const id = store.scoutId;
    if (!id || id === store.youId || this.phase !== 'planning') return null;
    return store.state?.players.find((p) => p.id === id) ?? null;
  }

  // =================== input ===================

  private ndc(x: number, y: number) {
    return new THREE.Vector2((x / this.W) * 2 - 1, -(y / this.H) * 2 + 1);
  }

  private groundPoint(x: number, y: number): THREE.Vector3 | null {
    this.raycaster.setFromCamera(this.ndc(x, y), this.camera);
    const out = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(this.ground, out) ? out : null;
  }

  private unitUnder(x: number, y: number): string | null {
    this.raycaster.setFromCamera(this.ndc(x, y), this.camera);
    const roots = [...this.units.values()].filter((u) => u.model.root.visible).map((u) => u.model.root);
    const hits = this.raycaster.intersectObjects(roots, true);
    for (const h of hits) {
      let o: THREE.Object3D | null = h.object;
      while (o && !o.userData.key) o = o.parent;
      if (o && (!this.drag || o.userData.key !== `o:${this.drag.unit.id}`)) return o.userData.key as string;
    }
    return null;
  }

  /** Informações atuais de um robô na tela (para o painel de detalhes). */
  infoOf(key: string) { return this.keyInfo.get(key) ?? null; }

  /** Id da unidade própria sob o cursor (para equipar itens). */
  ownedIdAt(x: number, y: number): string | null {
    const key = this.unitUnder(x, y);
    if (key?.startsWith('o:')) return key.slice(2);
    const loc = this.pick(x, y);
    if (!loc || (loc.zone === 'board' && (this.inCombatView || this.scouting()))) return null;
    return this.ownedAt(loc)?.id ?? null;
  }

  pick(x: number, y: number): Loc | null {
    const g = this.groundPoint(x, y);
    if (!g) return null;
    for (let i = 0; i < BENCH_SIZE; i++) {
      const p = benchWorld(i, this.tmp);
      if (Math.abs(g.x - p.x) < 0.97 && Math.abs(g.z - p.z) < 1.1) return { zone: 'bench', i };
    }
    let best: { r: number; c: number } | null = null;
    let bd = Infinity;
    for (let r = 0; r < COMBAT_ROWS; r++) for (let c = 0; c < COLS; c++) {
      const p = hexWorld(r, c, this.tmp);
      const d = Math.hypot(g.x - p.x, g.z - p.z);
      if (d < bd) { bd = d; best = { r, c }; }
    }
    return best && bd < 1.0 ? { zone: 'board', r: best.r, c: best.c } : null;
  }

  private onDown(e: PointerEvent) {
    if (!this.active || !this.me || e.button !== 0) return;
    const key = this.unitUnder(e.clientX, e.clientY);
    let u: OwnedUnit | undefined;
    if (key?.startsWith('o:')) u = this.me.units.find((x) => `o:${x.id}` === key);
    if (!u) {
      const loc = this.pick(e.clientX, e.clientY);
      if (loc && !(loc.zone === 'board' && (this.inCombatView || this.scouting()))) u = this.ownedAt(loc);
    }
    if (!u) { this.groundClick(e.clientX, e.clientY); return; }
    if (u.loc.zone === 'board' && (this.phase !== 'planning' || this.inCombatView)) {
      if (this.phase === 'carousel') this.groundClick(e.clientX, e.clientY);
      return;
    }
    this.drag = { unit: u, x: e.clientX, y: e.clientY };
    this.cb.dragging(true, sellValue(UNITS[u.defId].cost, u.star));
    this.cb.hover(null, 0, 0);
    sfx('click');
  }

  private onMove(e: PointerEvent) {
    if (this.drag) { this.drag.x = e.clientX; this.drag.y = e.clientY; return; }
    if (!this.active || e.target !== this.overlay) {
      this.hoveredOwnedId = null;
      if (this.hoverShown) { this.cb.hover(null, 0, 0); this.hoverShown = false; }
      return;
    }
    const key = this.unitUnder(e.clientX, e.clientY);
    const info = key ? this.keyInfo.get(key) ?? null : null;
    this.cb.hover(info, e.clientX, e.clientY);
    this.hoverShown = !!info;
    this.hoveredOwnedId = info?.ownedId ?? null;
  }

  private onUp(e: PointerEvent) {
    const d = this.drag;
    if (!d) return;
    this.drag = null;
    this.cb.dragging(false, 0);
    if (this.cb.overSell(e.clientX, e.clientY)) {
      net.send({ t: 'sell', id: d.unit.id });
      sfx('sell');
      if (this.me) this.me.units = this.me.units.filter((x) => x.id !== d.unit.id);
      return;
    }
    const loc = this.pick(e.clientX, e.clientY);
    if (!loc) return;
    let to: Loc;
    if (loc.zone === 'bench') to = loc;
    else {
      if (loc.r < BOARD_ROWS || this.phase !== 'planning') { sfx('error'); return; }
      to = { zone: 'board', r: loc.r - BOARD_ROWS, c: loc.c };
    }
    const from = d.unit.loc;
    if (JSON.stringify(from) === JSON.stringify(to)) return;
    const me = this.me!;
    const other = me.units.find((x) => JSON.stringify(x.loc) === JSON.stringify(to));
    if (!other && to.zone === 'board' && from.zone === 'bench' && me.units.filter((x) => x.loc.zone === 'board').length >= me.level) {
      sfx('error');
      net.send({ t: 'move', id: d.unit.id, to });
      return;
    }
    if (other) other.loc = from;
    d.unit.loc = to;
    net.send({ t: 'move', id: d.unit.id, to });
    sfx('click');
  }

  // =================== unidades ===================

  private syncReplay(now: number) {
    const cm = store.combat;
    if (!cm) { this.replay = null; return; }
    const key = `${cm.round}:${store.room}:${cm.result.duration}`;
    if (key !== this.replayKey) {
      this.replayKey = key;
      this.replay = new Replay(cm.result.events, cm.result.units, cm.mySide, store.combatStartedAt || now, cm.result.duration, cm.result.winner);
    }
  }

  private ruWorld(u: RU, now: number, out: THREE.Vector3) {
    const p = Math.min(1, (now - u.moveStart) / u.moveDur);
    const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
    const a = hexWorld(u.fr, u.fc, new THREE.Vector3());
    const b = hexWorld(u.r, u.c, new THREE.Vector3());
    out.copy(a).lerp(b, e);
    if (p < 1) out.y += Math.sin(p * Math.PI) * u.arc;
    const lp = (now - u.lungeAt) / 260;
    if (lp >= 0 && lp < 1 && u.lungeTo && this.replay) {
      const t = this.replay.units.get(u.lungeTo);
      if (t) {
        const tp = hexWorld(t.r, t.c, new THREE.Vector3());
        out.lerp(tp, Math.sin(lp * Math.PI) * 0.32);
      }
    }
    return out;
  }

  private desired(now: number): Desired[] {
    const list: Desired[] = [];
    const st = store.state;
    if (!this.active || !st) {
      DEMO.forEach((id, i) => {
        const r = 4 + (i % 2) * 1 + (i >= 6 ? 2 : 0);
        const c = [3, 1, 5, 2, 4, 0, 6, 3, 1][i];
        const target = hexWorld(r - 2, c);
        list.push({ key: `d:${i}`, defId: id, star: 1 + (i % 3 === 0 ? 1 : 0), target, yaw: Math.sin(now / 1400 + i) * 0.5, info: { defId: id, star: 1 } });
      });
      return list;
    }
    const combat = this.inCombatView && this.replay;
    const itemHover = this.itemDragPos ? this.ownedIdAt(this.itemDragPos.x, this.itemDragPos.y) : null;
    if (combat) {
      const rp = this.replay!;
      for (const u of rp.units.values()) {
        const deadFor = u.alive ? 0 : now - u.deathAt;
        if (!u.alive && deadFor > 1100) continue;
        const target = this.ruWorld(u, now, new THREE.Vector3());
        let yaw = u.mine ? Math.PI : 0;
        const tgt = u.tg ? rp.units.get(u.tg) : null;
        if (tgt && tgt.alive) {
          const tp = hexWorld(tgt.r, tgt.c, this.tmp);
          yaw = Math.atan2(tp.x - target.x, tp.z - target.z);
        }
        list.push({
          key: `c:${u.init.uid}`, defId: u.init.defId, star: u.init.star, target, yaw, instant: true, ru: u,
          fade: u.alive ? 0 : deadFor / 1100,
          info: { defId: u.init.defId, star: u.init.star, hp: u.hp, maxHp: u.maxHp, mana: u.mana, maxMana: u.maxMana, items: u.init.items },
        });
      }
    } else if (this.phase === 'carousel' && store.carousel) {
      // carrossel: robôs girando no centro; quem já foi pego segue o dono
      store.carousel.units.forEach((cu, i) => {
        const owner = cu.taken ? this.avatars.get(cu.taken) : null;
        let target: THREE.Vector3, yaw: number;
        if (owner) {
          const out = owner.pos.clone().setY(0);
          if (out.lengthSq() < 0.01) out.set(0, 0, 1);
          out.normalize();
          target = owner.pos.clone().addScaledVector(out, 0.8).setY(TILE_Y);
          yaw = Math.atan2(-out.x, -out.z);
        } else {
          target = this.carouselSpot(i, now);
          yaw = Math.atan2(target.x, target.z);
        }
        list.push({ key: `k:${i}:${cu.defId}`, defId: cu.defId, star: 1, target, yaw, instant: !owner, info: { defId: cu.defId, star: 1, items: [cu.item] } });
      });
    } else {
      const sc = this.scouting();
      if (sc) {
        sc.board.forEach((b, i) => {
          list.push({ key: `s:${sc.id}:${i}:${b.defId}`, defId: b.defId, star: b.star, target: hexWorld(BOARD_ROWS + b.r, b.c), yaw: 0, info: { defId: b.defId, star: b.star, items: b.items } });
        });
      } else {
        for (const u of this.me?.units ?? []) {
          if (u.loc.zone !== 'board') continue;
          list.push({
            key: `o:${u.id}`, defId: u.defId, star: u.star, target: hexWorld(BOARD_ROWS + u.loc.r, u.loc.c), yaw: 0,
            info: { defId: u.defId, star: u.star, ownedId: u.id, items: u.items }, hovered: u.id === this.hoveredOwnedId || u.id === itemHover,
          });
        }
      }
    }
    for (const u of this.me?.units ?? []) {
      if (u.loc.zone !== 'bench') continue;
      list.push({
        key: `o:${u.id}`, defId: u.defId, star: u.star, target: benchWorld(u.loc.i), yaw: 0,
        info: { defId: u.defId, star: u.star, ownedId: u.id, items: u.items }, hovered: u.id === this.hoveredOwnedId || u.id === itemHover,
      });
    }
    // arrastando: segue o mouse
    if (this.drag) {
      const g = this.groundPoint(this.drag.x, this.drag.y);
      const d = list.find((x) => x.key === `o:${this.drag!.unit.id}`);
      if (d && g) { d.target = g.add(new THREE.Vector3(0, 0.7, 0)); d.instant = true; }
      else if (!d && g) {
        const u = this.drag.unit;
        list.push({ key: `o:${u.id}`, defId: u.defId, star: u.star, target: g.add(new THREE.Vector3(0, 0.7, 0)), yaw: 0, instant: true, info: { defId: u.defId, star: u.star, ownedId: u.id } });
      }
    }
    return list;
  }

  private unitScale(defId: string, star: number) {
    const cost = UNITS[defId]?.cost ?? 1;
    return 1.65 + (star - 1) * 0.22 + (cost - 1) * 0.06;
  }

  private syncUnits(list: Desired[], now: number, dt: number) {
    for (const uv of this.units.values()) uv.seen = false;
    this.keyInfo.clear();
    for (const d of list) {
      this.keyInfo.set(d.key, d.info);
      let uv = this.units.get(d.key);
      let prevStar: number | undefined;
      // o visual muda com a estrela: reconstrói o modelo ao evoluir
      if (uv && (uv.defId !== d.defId || uv.star !== d.star)) { if (uv.defId === d.defId) prevStar = uv.star; this.removeUnit(uv); uv = undefined; }
      if (!uv) {
        const udef = UNITS[d.defId];
        const model = buildRobot(udef.look, udef.role, d.star);
        model.root.userData.key = d.key;
        const spinners: THREE.Object3D[] = [];
        const swayers: THREE.Object3D[] = [];
        model.root.traverse((o) => { if (o.userData.spin) spinners.push(o); if (o.userData.sway) swayers.push(o); });
        this.scene.add(model.root);
        uv = {
          key: d.key, defId: d.defId, star: prevStar ?? d.star, model, pos: d.target.clone(), yaw: d.yaw, seen: true, lastSmoke: 0,
          seed: Math.random() * 10, spinners, swayers, flashing: false, lastTarget: d.target.clone(),
          bounceAt: d.key.startsWith('o:') ? now : -1e9, starAt: -1e9, lastShot: -1e9, lastCast: -1e9,
        };
        this.units.set(d.key, uv);
      }
      uv.seen = true;
      if (d.star > uv.star && d.key.startsWith('o:')) {
        uv.starAt = now;
        this.starBurst(uv.pos, d.star);
      }
      uv.star = d.star;
      this.animateUnit(uv, d, now, dt);
    }
    for (const uv of [...this.units.values()]) if (!uv.seen) this.removeUnit(uv);
  }

  private removeUnit(uv: UV) {
    this.scene.remove(uv.model.root);
    disposeRobot(uv.model);
    this.units.delete(uv.key);
  }

  private starBurst(pos: THREE.Vector3, star: number) {
    const color = star >= 3 ? '#ffd23f' : '#e3ecf7';
    // coluna de luz subindo + anel no chão
    for (let i = 0; i < (star >= 3 ? 36 : 22); i++) {
      this.emit(pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.5, Math.random() * 0.4, (Math.random() - 0.5) * 0.5)), {
        vel: new THREE.Vector3(0, 3 + Math.random() * 3, 0), spread: 0.2, life: 0.9 + Math.random() * 0.5, s0: 0.5, s1: 0.1,
        color: star >= 3 ? '#fff2a8' : '#c8f0ff', alpha: 0.9, additive: true,
      });
    }
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2;
      this.emit(pos.clone().add(new THREE.Vector3(Math.cos(a) * 0.3, 0.1, Math.sin(a) * 0.3)), {
        vel: new THREE.Vector3(Math.cos(a) * 3.2, 0.2, Math.sin(a) * 3.2), spread: 0.1, life: 0.7, s0: 0.3, s1: 0.5, color, alpha: 0.8, additive: true,
      });
    }
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2;
      this.emit(pos.clone().add(new THREE.Vector3(0, 0.6, 0)), {
        vel: new THREE.Vector3(Math.cos(a) * 2.2, 1.5 + Math.random() * 2.5, Math.sin(a) * 2.2),
        spread: 0.6, life: 1.1, s0: 0.35, s1: 0.05, color, alpha: 1, additive: true,
      });
    }
    sfx('star');
  }

  private worldOf(obj: THREE.Object3D, out: THREE.Vector3) {
    obj.updateWorldMatrix(true, false);
    return obj.getWorldPosition(out);
  }

  private animateUnit(uv: UV, d: Desired, now: number, dt: number) {
    const t = now / 1000;
    const m = uv.model;
    if (d.instant) uv.pos.copy(d.target);
    else uv.pos.lerp(d.target, 1 - Math.exp(-dt * 14));
    if (!d.instant && uv.lastTarget.distanceToSquared(d.target) > 0.09) uv.bounceAt = now + 110;
    uv.lastTarget.copy(d.target);
    m.root.position.copy(uv.pos);
    // rotação suave
    let diff = d.yaw - uv.yaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    uv.yaw += diff * (1 - Math.exp(-dt * 12));
    m.root.rotation.y = uv.yaw;

    const ru = d.ru;
    const def = UNITS[d.defId];
    let scale = this.unitScale(d.defId, d.star) * (d.hovered ? 1.08 : 1);
    let squash = 0;
    let face: FaceExpr = 'chill';

    // ---------- pose base (idle chill) ----------
    const [armL, armR] = m.arms;
    const breath = Math.sin(t * 2.2 + uv.seed);
    m.rig.position.set(0, breath * 0.02, 0);
    m.rig.rotation.set(0, 0, Math.sin(t * 1.3 + uv.seed) * 0.035);
    m.head.rotation.set(Math.sin(t * 1.7 + uv.seed) * 0.05, Math.sin(t * 0.6 + uv.seed) * 0.28, Math.sin(t * 1.1 + uv.seed) * 0.07);
    armL.rotation.set(Math.sin(t * 1.3 + uv.seed) * 0.1, 0, -0.05 - breath * 0.04);
    armR.rotation.set(-Math.sin(t * 1.3 + uv.seed) * 0.1, 0, 0.05 + breath * 0.04);
    for (const l of m.legs) l.rotation.set(0, 0, 0);

    if (ru) {
      const el = now - ru.moveStart;
      const moving = el >= 0 && el < ru.moveDur;
      // ---------- andar / saltar ----------
      if (moving && !ru.jump) {
        const ph = (el / ru.moveDur) * Math.PI * 2;
        const sw = Math.sin(ph);
        if (m.legs.length) { m.legs[0].rotation.x = sw * 0.75; m.legs[1].rotation.x = -sw * 0.75; }
        armL.rotation.x = -sw * 0.65;
        armR.rotation.x = sw * 0.65;
        m.rig.position.y += Math.abs(Math.cos(ph)) * 0.07;
        m.rig.rotation.x = 0.14;
        for (const w of m.wheels) w.rotation.x += dt * 14;
      } else if (moving && ru.jump) {
        const p = el / ru.moveDur;
        m.rig.rotation.y = p * Math.PI * 2;
        armL.rotation.z = -2.6; armR.rotation.z = 2.6;
        for (const l of m.legs) l.rotation.x = -1.0 * Math.sin(p * Math.PI);
        if (Math.random() < 0.6) this.emit(this.worldOf(m.rig, this.tmp).add(new THREE.Vector3(0, 0.6, 0)), { vel: new THREE.Vector3(0, 0, 0), life: 0.5, s0: 0.4, s1: 0.1, color: '#9bff5d', alpha: 0.6, additive: true });
      }

      // ---------- ataque corpo a corpo ----------
      const lp = (now - ru.lungeAt) / 260;
      if (lp >= 0 && lp < 1) {
        const k = Math.sin(lp * Math.PI);
        const arm = ru.atkCount % 2 ? armR : armL;
        arm.rotation.x = -0.4 - k * 1.5;
        arm.rotation.z *= 1 - k;
        m.rig.rotation.x = k * 0.32;
        m.rig.rotation.y = (ru.atkCount % 2 ? -1 : 1) * k * 0.35;
        squash = -k * 0.05;
        face = 'angry';
      }

      // ---------- ataque à distância (mira + recuo + clarão) ----------
      const sp = now - ru.shotAt;
      if (sp >= 0 && sp < 650 && def.range > 1) {
        const ap = def.role === 'apcaster' || def.role === 'support';
        const recoil = Math.max(0, 1 - Math.max(0, sp - 60) / 160) * (sp >= 60 ? 1 : 0);
        armR.rotation.set(-1.5 + recoil * 0.45, 0, 0);
        if (ap) armL.rotation.set(-1.4 + recoil * 0.4, 0, 0);
        m.rig.position.z -= recoil * 0.07;
        m.rig.rotation.x = -recoil * 0.06;
        if (sp < 380) face = 'angry';
        if (sp >= 60 && uv.lastShot !== ru.shotAt) {
          uv.lastShot = ru.shotAt;
          const mz = this.worldOf(m.muzzle, new THREE.Vector3());
          const col = ap ? '#d6a8ff' : ru.mine ? '#c8ff9e' : '#ffb0c0';
          for (let i = 0; i < 7; i++) this.emit(mz, { vel: new THREE.Vector3(0, 0.3, 0), spread: 1.6, life: 0.22, s0: 0.45, s1: 0.05, color: col, alpha: 1, additive: true });
        }
      }

      // ---------- habilidade ----------
      const cdur = def.range > 1 ? 700 : 520;
      const cp = (now - ru.castAt) / cdur;
      if (cp >= 0 && cp < 1) {
        const kind = ru.castKind;
        const up = Math.min(1, cp / 0.35);
        face = kind === 'heal' || kind === 'teamHeal' || kind === 'teamShield' || kind === 'teamAS' || kind === 'buffAS' ? 'happy' : 'angry';
        if (kind === 'aoeStun') {
          // pula e esmaga o chão
          const j = cp < 0.55 ? Math.sin((cp / 0.55) * Math.PI * 0.5) : Math.max(0, 1 - (cp - 0.55) / 0.12);
          m.rig.position.y += j * 0.7;
          armL.rotation.set(-2.8 * j, 0, -0.3); armR.rotation.set(-2.8 * j, 0, 0.3);
          if (cp > 0.62) squash = Math.max(0, 0.18 * (1 - (cp - 0.62) / 0.38));
        } else if (kind === 'shield') {
          armL.rotation.set(-1.35 * up, 0, 0.9 * up); armR.rotation.set(-1.35 * up, 0, -0.9 * up);
          squash = -0.04 * up;
        } else if (kind === 'heal' || kind === 'teamHeal' || kind === 'teamShield' || kind === 'teamAS' || kind === 'buffAS') {
          const wave = Math.sin(cp * Math.PI * 4) * 0.25;
          armL.rotation.set(0, 0, -2.5 * up + wave); armR.rotation.set(0, 0, 2.5 * up - wave);
          m.rig.position.y += Math.sin(cp * Math.PI) * 0.25;
          m.head.rotation.x = -0.35 * up;
        } else if (def.range > 1) {
          // conjurador: carrega a energia acima da cabeça e arremessa
          if (cp < 0.38) {
            armL.rotation.set(-2.9 * up, 0, -0.25); armR.rotation.set(-2.9 * up, 0, 0.25);
            m.head.rotation.x = -0.4 * up;
            if (Math.random() < 0.8) {
              const cpos = this.worldOf(m.castPoint, new THREE.Vector3());
              this.emit(cpos, { vel: new THREE.Vector3(0, 0.1, 0), spread: 0.9, life: 0.35, s0: 0.15, s1: 0.6 * up + 0.2, color: ru.castColor, alpha: 0.9, additive: true });
            }
          } else {
            const th = Math.min(1, (cp - 0.38) / 0.2);
            armL.rotation.set(-2.9 + th * 1.8, 0, -0.1); armR.rotation.set(-2.9 + th * 1.8, 0, 0.1);
            m.rig.rotation.x = th * 0.3 * (1 - (cp - 0.38) / 0.62);
          }
        } else {
          // golpe especial corpo a corpo: levanta e esmaga
          const k = cp < 0.45 ? cp / 0.45 : 1 - (cp - 0.45) / 0.55;
          const slam = cp < 0.45 ? -3.0 * k : -3.0 + (1 - k) * 2.4;
          armL.rotation.set(slam, 0, -0.2); armR.rotation.set(slam, 0, 0.2);
          m.rig.rotation.x = cp < 0.45 ? -0.2 * k : 0.35 * k;
          m.rig.position.y += cp < 0.45 ? 0.2 * k : 0;
        }
        if (uv.lastCast !== ru.castAt) {
          uv.lastCast = ru.castAt;
          const p0 = this.worldOf(m.rig, new THREE.Vector3()).add(new THREE.Vector3(0, 0.2, 0));
          for (let i = 0; i < 18; i++) {
            const a = (i / 18) * Math.PI * 2;
            this.emit(p0, { vel: new THREE.Vector3(Math.cos(a) * 1.6, 0.5, Math.sin(a) * 1.6), life: 0.55, s0: 0.3, s1: 0.05, color: ru.castColor, alpha: 0.9, additive: true });
          }
        }
      }

      // ---------- tomou dano ----------
      const hp = Math.max(0, 1 - (now - ru.hitAt) / 200);
      if (hp > 0 && ru.alive) {
        m.rig.rotation.x -= hp * 0.16;
        m.head.rotation.x -= hp * 0.25;
        if (face === 'chill') face = 'shock';
      }

      // ---------- atordoado ----------
      if (ru.alive && now < ru.stunUntil) {
        m.head.rotation.y = Math.sin(t * 6) * 0.6;
        m.head.rotation.z = Math.sin(t * 3) * 0.25;
        armL.rotation.set(0.15, 0, -0.1); armR.rotation.set(0.15, 0, 0.1);
        m.rig.rotation.z = Math.sin(t * 3) * 0.12;
        face = 'dizzy';
      }

      // ---------- morte: cai pra trás e some ----------
      if (d.fade) {
        const f = d.fade;
        const fall = Math.min(1, f / 0.45);
        m.rig.rotation.set(-fall * 1.45, 0, fall * 0.2);
        m.rig.position.y = Math.sin(fall * Math.PI) * 0.25;
        armL.rotation.set(-1.2 * fall, 0, -0.9 * fall); armR.rotation.set(-1.2 * fall, 0, 0.9 * fall);
        if (f > 0.6) scale *= 1 - (f - 0.6) / 0.4;
      }
      if (d.fade || !ru.alive) face = 'dead';

      // ---------- dança da vitória ----------
      const rp = this.replay;
      if (rp && rp.ended && ru.alive) {
        const b = t * 7 + uv.seed;
        m.rig.position.y = Math.abs(Math.sin(b)) * 0.28;
        m.rig.rotation.y = Math.sin(b * 0.5) * 0.5;
        armL.rotation.set(0, 0, -2.3 - Math.sin(b) * 0.4);
        armR.rotation.set(0, 0, 2.3 + Math.sin(b) * 0.4);
        m.head.rotation.z = Math.sin(b) * 0.2;
        face = 'happy';
      }

      // invisível (fumaça / escuridão): fica translúcido
      const ghost = ru.alive && now < ru.stealthUntil;
      if (ghost !== !!uv.ghost) {
        uv.ghost = ghost;
        m.mats.forEach((mat) => { mat.transparent = ghost; mat.opacity = ghost ? 0.3 : 1; mat.needsUpdate = true; });
      }
      // invocação brotando do chão
      const sp2 = (now - ru.spawnAt) / 450;
      if (sp2 >= 0 && sp2 < 1) { scale *= 0.2 + 0.8 * sp2 + Math.sin(sp2 * Math.PI) * 0.25; face = 'happy'; }
      m.stunRing.visible = ru.alive && now < ru.stunUntil;
      if (m.stunRing.visible) m.stunRing.rotation.y = t * 4;
      // flash de dano / buff
      const flash = Math.max(0, 1 - (now - ru.flashAt) / 110);
      const buff = now < ru.buffUntil ? 0.12 + Math.sin(t * 10) * 0.08 : 0;
      if (flash > 0 || buff > 0) {
        m.mats.forEach((mat, i) => {
          mat.emissive.copy(m.baseEmissive[i]).lerp(new THREE.Color(flash > 0 ? '#ff9a9a' : '#ffcc33'), Math.max(flash * 0.35, buff));
        });
        uv.flashing = true;
      } else if (uv.flashing) {
        m.mats.forEach((mat, i) => mat.emissive.copy(m.baseEmissive[i]));
        uv.flashing = false;
      }
    } else {
      m.stunRing.visible = false;
      if (uv.flashing) { m.mats.forEach((mat, i) => mat.emissive.copy(m.baseEmissive[i])); uv.flashing = false; }
      // pulinho ao ser colocado
      const bp = (now - uv.bounceAt) / 380;
      if (bp >= 0 && bp < 1) {
        m.rig.position.y += Math.sin(bp * Math.PI) * 0.35 * (1 - bp);
        squash = Math.sin(bp * Math.PI * 2) * 0.12 * (1 - bp);
        face = 'happy';
      }
      if (d.hovered) face = 'happy';
      // evolução: brilho dourado + crescer
      const sp = (now - uv.starAt) / 900;
      if (sp >= 0 && sp < 1) {
        scale *= 1 + Math.sin(sp * Math.PI) * 0.35;
        m.rig.rotation.y = sp * Math.PI * 4;
        face = 'happy';
      }
      // dança no menu
      if (!this.active) {
        const b = t * 3 + uv.seed;
        face = Math.sin(t * 0.4 + uv.seed * 3) > 0.3 ? 'relax' : 'happy';
        m.rig.position.y += Math.abs(Math.sin(b)) * 0.08;
        armL.rotation.z = -0.4 - Math.sin(b) * 0.3;
        armR.rotation.z = 0.4 + Math.sin(b + 1) * 0.3;
      }
    }
    m.root.scale.set(scale * (1 + squash * 0.6), scale * (1 - squash), scale * (1 + squash * 0.6));
    m.tick(t, face);
    for (const o of uv.spinners) o.rotation.z = t * 1.5;
    for (const o of uv.swayers) o.rotation.x = Math.sin(t * 2 + uv.seed) * 0.15;

    // fumaça dos baseados / bongs
    if (m.emitters.length && t - uv.lastSmoke > 0.24 && !(ru && !ru.alive)) {
      uv.lastSmoke = t;
      for (const em of m.emitters) {
        em.getWorldPosition(this.tmp);
        this.emit(this.tmp, { vel: new THREE.Vector3(0.05, 0.55, 0), spread: 0.18, life: 1.7, s0: 0.1 * scale, s1: 0.55 * scale, alpha: 0.35 });
      }
    }
  }

  // =================== efeitos ===================

  private fxPos(uid: number, now: number, out: THREE.Vector3) {
    const u = this.replay?.units.get(uid);
    if (!u) return out.set(0, 0, 0);
    this.ruWorld(u, now, out);
    out.y += 0.75;
    return out;
  }

  /** origem de um disparo: cano no pulso ou ponto de magia acima da cabeça */
  private fxOrigin(uid: number, now: number, kind: 'muzzle' | 'cast', out: THREE.Vector3) {
    const uv = this.units.get(`c:${uid}`);
    if (uv) return this.worldOf(kind === 'cast' ? uv.model.castPoint : uv.model.muzzle, out);
    return this.fxPos(uid, now, out);
  }

  private updateFx(now: number) {
    const rp = this.replay;
    if (!rp || !this.inCombatView) this.vfx.clear();
    this.vfx.update(now);
    const live = new Set<Effect>();
    if (rp && this.inCombatView) {
      for (const f of rp.fx) {
        if (this.vfx.handle(f, now)) continue;
        if (now < f.start) continue;
        live.add(f);
        const p = Math.min(1, (now - f.start) / f.dur);
        switch (f.k) {
          case 'proj': {
            let o = this.fxObjs.get(f);
            if (!o) {
              if (f.bolt) {
                // raio laser alongado
                const g = new THREE.Group();
                const core = new THREE.Mesh(new THREE.CapsuleGeometry(f.big ? 0.06 : 0.035, f.big ? 0.75 : 0.5, 3, 6), new THREE.MeshBasicMaterial({ color: hdr('#ffffff', 3), toneMapped: false }));
                const glow = new THREE.Mesh(new THREE.CapsuleGeometry(f.big ? 0.12 : 0.075, f.big ? 0.8 : 0.55, 3, 8), new THREE.MeshBasicMaterial({ color: hdr(f.color, 2.6), transparent: true, opacity: 0.55, toneMapped: false, depthWrite: false, blending: THREE.AdditiveBlending }));
                core.rotation.x = glow.rotation.x = Math.PI / 2;
                g.add(core, glow);
                o = g;
              } else {
                const g = new THREE.Group();
                const core = new THREE.Mesh(new THREE.SphereGeometry(f.big ? 0.2 : 0.11, 12, 10), new THREE.MeshBasicMaterial({ color: hdr('#ffffff', 3), toneMapped: false }));
                const glow = new THREE.Mesh(new THREE.SphereGeometry(f.big ? 0.36 : 0.2, 12, 10), new THREE.MeshBasicMaterial({ color: hdr(f.color, 2.6), transparent: true, opacity: 0.5, toneMapped: false, depthWrite: false, blending: THREE.AdditiveBlending }));
                g.add(core, glow);
                o = g;
              }
              this.scene.add(o);
              this.fxObjs.set(f, o);
            }
            const a = this.fxOrigin(f.from, now, f.fromCast ? 'cast' : 'muzzle', new THREE.Vector3());
            const b = this.fxPos(f.to, now, new THREE.Vector3());
            const arc = f.bolt ? 0 : Math.sin(p * Math.PI) * (f.big ? 0.6 : 0.3);
            o.position.copy(a).lerp(b, p);
            o.position.y += arc;
            if (f.bolt) o.lookAt(b);
            else o.scale.setScalar(1 + Math.sin(now / 40) * 0.12);
            const n = f.big ? 2 : 1;
            for (let i = 0; i < n; i++) {
              this.emit(o.position, { vel: new THREE.Vector3(0, 0.15, 0), spread: 0.3, life: f.bolt ? 0.18 : 0.4, s0: f.big ? 0.4 : 0.22, s1: 0.04, color: f.color, alpha: 0.85, additive: true });
            }
            if (p >= 0.97 && !this.fxDone.has(f)) {
              this.fxDone.add(f);
              for (let i = 0; i < (f.big ? 14 : 6); i++) this.emit(b, { vel: new THREE.Vector3(0, 0.5, 0), spread: f.big ? 3 : 1.8, life: 0.3, s0: f.big ? 0.5 : 0.3, s1: 0.05, color: f.color, alpha: 1, additive: true });
            }
            break;
          }
          case 'beam': {
            let o = this.fxObjs.get(f);
            if (!o) {
              o = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), new THREE.MeshBasicMaterial({ color: hdr(f.color, 3), toneMapped: false }));
              this.scene.add(o);
              this.fxObjs.set(f, o);
            }
            const a = this.fxOrigin(f.from, now, 'cast', new THREE.Vector3());
            const b = this.fxPos(f.to, now, new THREE.Vector3());
            o.position.copy(a).lerp(b, p);
            o.position.y += Math.sin(p * Math.PI) * 1.2;
            this.emit(o.position, { vel: new THREE.Vector3(0, 0.2, 0), life: 0.45, s0: 0.3, s1: 0.05, color: f.color, alpha: 0.8, additive: true });
            break;
          }
          case 'zap': {
            let o = this.fxObjs.get(f) as THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial> | undefined;
            if (!o) {
              o = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: hdr(f.color, 3.5), transparent: true, toneMapped: false }));
              this.scene.add(o);
              this.fxObjs.set(f, o);
            }
            const a = this.fxPos(f.from, now, new THREE.Vector3());
            const b = this.fxPos(f.to, now, new THREE.Vector3());
            const pts: THREE.Vector3[] = [];
            for (let i = 0; i <= 7; i++) {
              const q = a.clone().lerp(b, i / 7);
              if (i > 0 && i < 7) q.add(new THREE.Vector3((Math.random() - 0.5) * 0.35, (Math.random() - 0.5) * 0.35, (Math.random() - 0.5) * 0.35));
              pts.push(q);
            }
            o.geometry.setFromPoints(pts);
            o.material.opacity = 1 - p;
            break;
          }
          case 'ring': {
            let o = this.fxObjs.get(f) as THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial> | undefined;
            if (!o) {
              o = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 48), new THREE.MeshBasicMaterial({ color: hdr(f.color, 2.4), transparent: true, side: THREE.DoubleSide, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }));
              o.rotation.x = -Math.PI / 2;
              hexWorld(f.r, f.c, o.position);
              o.position.y = 0.14;
              this.scene.add(o);
              this.fxObjs.set(f, o);
            }
            o.scale.setScalar(f.rad * 1.6 * (0.3 + 0.7 * p));
            o.material.opacity = 1 - p;
            break;
          }
          case 'puff': {
            if (!this.fxDone.has(f)) {
              this.fxDone.add(f);
              const c = hexWorld(f.r, f.c, new THREE.Vector3());
              const n = f.big ? 22 : 12;
              for (let i = 0; i < n; i++) {
                const a = (i / n) * Math.PI * 2;
                this.emit(c.clone().add(new THREE.Vector3(0, 0.4, 0)), {
                  vel: new THREE.Vector3(Math.cos(a) * 1.4, 0.8 + Math.random() * 0.8, Math.sin(a) * 1.4),
                  spread: 0.5, life: 1.2, s0: 0.4, s1: f.big ? 1.6 : 1.1, alpha: 0.55, color: '#d8d0f0',
                });
              }
            }
            break;
          }
        }
      }
    }
    for (const [f, o] of this.fxObjs) {
      if (!live.has(f)) {
        this.scene.remove(o);
        o.traverse((x) => {
          if (x instanceof THREE.Mesh || x instanceof THREE.Line) { x.geometry.dispose(); (x.material as THREE.Material).dispose(); }
        });
        this.fxObjs.delete(f);
      }
    }
  }

  // =================== loop ===================

  frame(now: number) {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    const t = now / 1000;
    if (this.active && store.state) this.syncReplay(now);
    const combat = this.active && this.inCombatView && this.replay;
    if (combat) this.replay!.update(now);

    this.syncAvatars(now, dt);
    this.syncUnits(this.desired(now), now, dt);
    this.updateOrbs(now, dt);
    this.updateFx(now);
    this.updateParticles(dt);
    this.updateTiles(t, !!combat);
    this.world?.update(t, dt);

    // câmera (balanço leve no menu, tremida em explosões)
    const cam = this.camera;
    if (!this.active) {
      const a = Math.sin(t * 0.15) * 0.18;
      const dir = this.camDir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), a);
      cam.position.copy(this.camTarget).addScaledVector(dir, this.camDist);
      cam.lookAt(this.camTarget);
    } else {
      cam.position.copy(this.camTarget).addScaledVector(this.camDir, this.camDist);
      if (this.replay && this.replay.shake > 0.005) {
        cam.position.add(new THREE.Vector3((Math.random() - 0.5) * this.replay.shake, (Math.random() - 0.5) * this.replay.shake, 0));
        this.replay.shake *= 0.9;
      }
      cam.lookAt(this.camTarget);
    }

    this.post.render(this.scene, cam, t);
    this.drawOverlay(now, !!combat);
  }

  private updateTiles(t: number, combat: boolean) {
    const sc = this.scouting();
    let hl: Loc | null = null;
    let valid = false;
    if (this.drag) {
      hl = this.pick(this.drag.x, this.drag.y);
      valid = !!hl && (hl.zone === 'bench' || (hl.r >= BOARD_ROWS && this.phase === 'planning'));
    }
    for (let r = 0; r < COMBAT_ROWS; r++) for (let c = 0; c < COLS; c++) {
      const m = this.tiles[r][c].material;
      const mine = r >= BOARD_ROWS;
      const pulse = 0.5 + Math.sin(t * 1.6 + r * 0.6 + c * 0.4) * 0.5;
      const sk = skin();
      let color = mine ? (sc ? '#6f8fd0' : sk.mine[(r + c) % 2 ? 0 : 1]) : combat ? '#a86a9a' : sk.enemy[(r + c) % 2 ? 0 : 1];
      let glow = 0.02 + pulse * 0.04;
      if (hl && hl.zone === 'board' && hl.r === r && hl.c === c) { color = valid ? '#7dff9a' : '#ff5d5d'; glow = 0.9; }
      m.color.set(color);
      m.emissive.set(color).multiplyScalar(glow);
    }
    const gp = 0.75 + Math.sin(t * 1.3) * 0.25;
    if (this.gapMats.length) {
      this.gapMats[0].emissiveIntensity = 0.55 * gp;
      this.gapMats[1].emissiveIntensity = (combat ? 0.7 : 0.5) * (1.5 - gp * 0.5);
    }
    this.benchPads.forEach((p, i) => {
      const m = p.material as THREE.MeshStandardMaterial;
      const on = hl && hl.zone === 'bench' && hl.i === i;
      m.color.set(on ? '#7dff9a' : '#6a58a0');
      m.emissive.set(on ? '#2f8f55' : '#000000');
    });
  }

  // =================== Fumacinha / carrossel / orbes ===================

  private carouselSpot(i: number, now: number, out = new THREE.Vector3()) {
    const car = store.carousel!;
    const a = car.angle + (car.spin * (now - store.carouselAt)) / 1000 + (i / car.units.length) * Math.PI * 2;
    return out.set(Math.cos(a) * car.radius, TILE_Y, Math.sin(a) * car.radius);
  }

  /** clique no chão vazio: anda com a Fumacinha (no carrossel o servidor decide a posição) */
  private groundClick(x: number, y: number) {
    const g = this.groundPoint(x, y);
    if (!g) return;
    if (this.phase === 'carousel' && store.carousel) {
      const me = store.carousel.avatars.find((a) => a.id === store.youId);
      if (!me || me.picked >= 0) return;
      net.send({ t: 'walk', x: g.x, z: g.z });
    } else {
      if (this.scouting() || this.phase === 'gameover') return;
      this.myWalk.set(Math.max(-6.8, Math.min(6.8, g.x)), TILE_Y, Math.max(-6.0, Math.min(6.2, g.z)));
      this.orbWalk = false;
    }
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      this.emit(g.clone().setY(0.15), { vel: new THREE.Vector3(Math.cos(a) * 1.6, 0.3, Math.sin(a) * 1.6), life: 0.4, s0: 0.25, s1: 0.05, color: '#9bff5d', alpha: 0.8, additive: true });
    }
  }

  private ensureCarouselDeco() {
    if (this.carDeco) return this.carDeco;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(2.55, 3.45, 64),
      new THREE.MeshBasicMaterial({ color: '#ffd23f', transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.2;
    const barrier = new THREE.Mesh(
      new THREE.CylinderGeometry(4.2, 4.2, 1.4, 64, 1, true),
      new THREE.MeshBasicMaterial({ color: '#ff5d9e', transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }),
    );
    barrier.position.y = 0.75;
    // mastro central com chapéu girando
    const pole = new THREE.Group();
    const gold = new THREE.MeshStandardMaterial({ color: '#d9a94a', metalness: 0.9, roughness: 0.3, emissive: '#5a3a00' });
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 1.9, 12), gold);
    stick.position.y = 0.95;
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.45, 12), new THREE.MeshStandardMaterial({ color: '#ff5d9e', emissive: '#ff5d9e', emissiveIntensity: 0.5, roughness: 0.5 }));
    hat.position.y = 2.05;
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 12), new THREE.MeshStandardMaterial({ color: '#9bff5d', emissive: '#9bff5d', emissiveIntensity: 1.6 }));
    ball.position.y = 2.35;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.75, 0.22, 24), gold);
    base.position.y = 0.2;
    pole.add(stick, hat, ball, base);
    pole.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
    this.scene.add(ring, barrier, pole);
    this.carDeco = { ring, barrier, pole };
    return this.carDeco;
  }

  private syncAvatars(now: number, dt: number) {
    const st = store.state;
    const phase = this.phase ?? '';
    if (phase !== this.lastPhase) {
      if (this.lastPhase === 'carousel' || phase === 'planning') { this.myWalk.copy(AV_HOME); this.orbWalk = false; }
      this.lastPhase = phase;
    }
    const car = this.active && phase === 'carousel' ? store.carousel : null;
    // decoração do carrossel
    if (car || this.carDeco) {
      const deco = this.ensureCarouselDeco();
      deco.ring.visible = deco.pole.visible = !!car;
      deco.barrier.visible = !!car && car.locked.includes(store.youId);
      if (car) {
        deco.pole.rotation.y += car.spin * dt;
        (deco.barrier.material as THREE.MeshBasicMaterial).opacity = 0.1 + Math.sin(now / 180) * 0.04;
      }
    }
    const want = new Map<string, { pos: THREE.Vector3; picked: boolean }>();
    if (this.active && st && phase !== 'gameover') {
      if (car) for (const a of car.avatars) want.set(a.id, { pos: new THREE.Vector3(a.x, TILE_Y, a.z), picked: a.picked >= 0 });
      else if (!this.scouting() && st.me.alive) want.set(store.youId, { pos: this.myWalk, picked: false });
    }
    for (const [id, av] of this.avatars) {
      if (want.has(id)) continue;
      this.scene.remove(av.m.root);
      av.m.dispose();
      this.avatars.delete(id);
    }
    const t = now / 1000;
    for (const [id, w] of want) {
      let av = this.avatars.get(id);
      if (!av) {
        const m = buildAvatar(avatarColor(id));
        m.root.scale.setScalar(id === store.youId ? 1.55 : 1.3);
        this.scene.add(m.root);
        const start = id === store.youId && this.lastPhase !== 'carousel' ? AV_HOME : w.pos;
        av = { m, pos: start.clone(), target: w.pos.clone(), yaw: 0, moving: false, pickedAt: -1e9 };
        this.avatars.set(id, av);
      }
      if (w.picked && av.pickedAt < 0) av.pickedAt = now;
      if (!w.picked) av.pickedAt = -1e9;
      av.target.copy(w.pos);
      const dx = av.target.x - av.pos.x, dz = av.target.z - av.pos.z;
      const d = Math.hypot(dx, dz);
      const speed = car ? Math.max(5.2, d * 4) : 4.6;
      av.moving = d > 0.04;
      if (av.moving) {
        const k = Math.min(1, (speed * dt) / d);
        av.pos.x += dx * k;
        av.pos.z += dz * k;
        const want = Math.atan2(dx, dz);
        let diff = want - av.yaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        av.yaw += diff * Math.min(1, dt * 12);
        if (Math.random() < dt * 14) this.emit(av.pos.clone().setY(0.25), { vel: new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.5, (Math.random() - 0.5) * 0.4), life: 0.8, s0: 0.25, s1: 0.6, color: '#d8ccff', alpha: 0.35 });
      } else av.yaw *= 1 - Math.min(1, dt * 4);
      av.m.root.position.copy(av.pos);
      av.m.root.rotation.y = av.yaw;
      av.m.tick(t, av.moving, now - av.pickedAt < 1400);
    }
  }

  private updateOrbs(now: number, dt: number) {
    // novos saques viram orbes caindo no seu lado do tabuleiro
    while (this.lootSeen < store.loot.length) {
      const l = store.loot[this.lootSeen++];
      const drops: { item: string | null; gold: number }[] = l.items.map((item) => ({ item, gold: 0 }));
      if (l.gold > 0) drops.push({ item: null, gold: l.gold });
      for (const dr of drops) {
        const it = dr.item ? ITEMS[dr.item] : null;
        const color = !it ? '#ffd23f' : it.special ? '#3dffb0' : it.component ? '#7ad7ff' : '#c58bff';
        const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.1, roughness: 0.25, metalness: 0.2, transparent: true, opacity: 0.92 });
        const mesh = new THREE.Mesh(this.orbGeo, mat);
        const x = (Math.random() - 0.5) * 9.5, z = 1.3 + Math.random() * 3.6;
        mesh.position.set(x, 5, z);
        mesh.castShadow = true;
        this.scene.add(mesh);
        this.orbs.push({ mesh, mat, item: dr.item, gold: dr.gold, born: now + this.orbs.length * 180, x, z });
      }
    }
    if (!this.orbs.length) {
      if (this.orbWalk) { this.orbWalk = false; this.myWalk.copy(AV_HOME); }
      return;
    }
    const me = this.avatars.get(store.youId);
    const t = now / 1000;
    let nearest: Orb | null = null, nd = Infinity;
    for (const o of [...this.orbs]) {
      const age = (now - o.born) / 1000;
      // queda com quique
      const fall = Math.max(0, age);
      const h = fall < 0.6 ? 5 * (1 - (fall / 0.6) ** 2) : Math.abs(Math.sin((fall - 0.6) * 7)) * 0.5 * Math.exp(-(fall - 0.6) * 3);
      o.mesh.position.set(o.x, 0.45 + h + (fall > 1.4 ? Math.sin(t * 3 + o.x) * 0.08 : 0), o.z);
      o.mesh.rotation.y += dt * 1.5;
      o.mat.emissiveIntensity = 0.9 + Math.sin(t * 5 + o.z) * 0.35;
      if (age > 0.8 && Math.random() < dt * 4) this.emit(o.mesh.position.clone(), { vel: new THREE.Vector3(0, 0.8, 0), spread: 0.25, life: 0.6, s0: 0.2, s1: 0.02, color: '#' + o.mat.color.getHexString(), alpha: 0.8, additive: true });
      const close = me && Math.hypot(me.pos.x - o.x, me.pos.z - o.z) < 0.7;
      if ((close && age > 0.6) || age > 14) { this.collectOrb(o, now); continue; }
      if (me && age > 0.6) {
        const d = Math.hypot(me.pos.x - o.x, me.pos.z - o.z);
        if (d < nd) { nd = d; nearest = o; }
      }
    }
    // a Fumacinha vai sozinha buscar os orbes (fora do carrossel)
    if (nearest && this.phase !== 'carousel' && (this.orbWalk || this.myWalk.distanceTo(AV_HOME) < 0.1)) {
      this.orbWalk = true;
      this.myWalk.set(nearest.x, TILE_Y, nearest.z);
    }
  }

  private collectOrb(o: Orb, now: number) {
    this.orbs.splice(this.orbs.indexOf(o), 1);
    this.scene.remove(o.mesh);
    o.mat.dispose();
    const p = o.mesh.position.clone();
    const color = '#' + o.mat.color.getHexString();
    for (let i = 0; i < 18; i++) {
      this.emit(p, { vel: new THREE.Vector3((Math.random() - 0.5) * 3, 1 + Math.random() * 2.5, (Math.random() - 0.5) * 3), life: 0.7, s0: 0.3, s1: 0.04, color, alpha: 0.9, additive: true });
    }
    const it = o.item ? ITEMS[o.item] : null;
    this.pops.push({ text: it ? `${it.icon} ${it.name}` : `+${o.gold} 💰`, pos: p, start: now, color: it ? color : '#ffd23f' });
    sfx(it ? 'equip' : 'buy');
  }

  private drawAvatarOverlay(now: number, unit: number) {
    const ctx = this.octx;
    const st = store.state!;
    ctx.save();
    ctx.textAlign = 'center';
    // nomes no carrossel
    const car = this.phase === 'carousel' ? store.carousel : null;
    if (car) {
      for (const [id, av] of this.avatars) {
        const p = this.project(this.tmp.copy(av.pos).setY(1.35 * av.m.root.scale.x));
        const pl = st.players.find((x) => x.id === id);
        const locked = car.locked.includes(id);
        const label = `${locked ? '🔒 ' : ''}${pl?.name ?? '?'}`;
        ctx.font = `800 ${unit * (id === store.youId ? 1.1 : 0.95)}px Nunito, sans-serif`;
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(10,5,20,0.85)';
        ctx.fillStyle = id === store.youId ? '#9bff5d' : locked ? '#b8a8d8' : '#ffffff';
        ctx.strokeText(label, p.x, p.y);
        ctx.fillText(label, p.x, p.y);
      }
      // aviso central
      const mine = car.avatars.find((a) => a.id === store.youId);
      let msg = '', color = '#ffffff';
      if (!mine) msg = '';
      else if (mine.picked >= 0) { const cu = car.units[mine.picked]; msg = `✅ Você pegou ${UNITS[cu.defId]?.name ?? ''}!`; color = '#9bff5d'; }
      else if (car.locked.includes(store.youId)) { msg = '🔒 Aguarde sua vez — quem tem menos vida escolhe primeiro'; color = '#ffb3d6'; }
      else { msg = '🏃 LIBERADO! Clique no chão para andar até um robô'; color = '#ffe066'; }
      if (msg) {
        const p = this.project(new THREE.Vector3(0, 0, -6.4));
        ctx.font = `${unit * 1.25}px Bungee, sans-serif`;
        const tw = ctx.measureText(msg).width + 30;
        ctx.fillStyle = 'rgba(15,8,30,0.78)';
        ctx.beginPath();
        ctx.roundRect(p.x - tw / 2, p.y - unit * 1.5, tw, unit * 2.3, 12);
        ctx.fill();
        ctx.fillStyle = color;
        ctx.fillText(msg, p.x, p.y + unit * 0.15);
      }
    }
    // textos dos orbes coletados
    this.pops = this.pops.filter((pp) => now - pp.start < 1700);
    for (const pp of this.pops) {
      const k = (now - pp.start) / 1700;
      const p = this.project(this.tmp.copy(pp.pos).setY(pp.pos.y + 0.6 + k * 1.4));
      ctx.globalAlpha = Math.min(1, (1 - k) * 2.5);
      ctx.font = `900 ${unit * 1.25 * (1 + Math.max(0, 0.3 - k) * 1.5)}px Nunito, sans-serif`;
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(10,5,20,0.85)';
      ctx.fillStyle = pp.color;
      ctx.strokeText(pp.text, p.x, p.y);
      ctx.fillText(pp.text, p.x, p.y);
    }
    ctx.restore();
  }

  // =================== overlay 2D ===================

  private drawOverlay(now: number, combat: boolean) {
    const ctx = this.octx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.W, this.H);
    if (!this.active || !store.state) return;
    const unit = Math.max(9, Math.min(16, this.area.h / 48));

    // barras / estrelas
    for (const uv of this.units.values()) {
      const info = this.keyInfo.get(uv.key);
      if (!info) continue;
      if (this.drag && uv.key === `o:${this.drag.unit.id}`) continue;
      const head = this.tmp.copy(uv.pos);
      head.y += uv.model.height * uv.model.root.scale.x + 0.3;
      const p = this.project(head);
      if (uv.key.startsWith('c:')) {
        const ru = this.replay?.units.get(Number(uv.key.slice(2)));
        if (ru && ru.alive) {
          this.bars(p.x, p.y, ru.init.star, ru.mine, ru.hp, ru.maxHp, ru.shield, ru.mana, ru.maxMana, unit, ru.init.uid);
          if (info.items?.length) this.itemRow(p.x, p.y + unit * 1.55, info.items, unit);
        }
      } else {
        this.stars(p.x, p.y, info.star, unit);
        if (info.items?.length) this.itemRow(p.x, p.y + unit * 0.9, info.items, unit);
      }
    }

    // textos de combate
    if (combat && this.replay) {
      for (const f of this.replay.fx) {
        if (f.k !== 'text' && f.k !== 'label') continue;
        const p = Math.max(0, (now - f.start) / f.dur);
        const u = this.replay.units.get(f.u);
        if (!u) continue;
        const w = this.ruWorld(u, now, this.tmp);
        w.y += 2.0;
        const s = this.project(w);
        ctx.save();
        ctx.textAlign = 'center';
        if (f.k === 'text') {
          ctx.globalAlpha = 1 - p * p;
          // números grandes "estouram" ao aparecer
          const popK = f.size > 1.1 ? 1 + Math.max(0, 1 - p * 5) * 0.55 : 1;
          ctx.font = `900 ${unit * 1.5 * f.size * popK}px Nunito, sans-serif`;
          ctx.lineWidth = 4;
          ctx.strokeStyle = 'rgba(0,0,0,0.85)';
          const x = s.x + f.dx * unit * 4, y = s.y - p * unit * 3.5;
          ctx.strokeText(f.text, x, y);
          ctx.fillStyle = f.color;
          ctx.fillText(f.text, x, y);
        } else {
          ctx.globalAlpha = Math.min(1, (1 - p) * 3);
          ctx.font = `${unit * 1.05}px Bungee, sans-serif`;
          const y = s.y - unit * 2.4 - p * unit;
          const tw = ctx.measureText(f.text).width + 14;
          ctx.fillStyle = 'rgba(20,10,40,0.88)';
          ctx.beginPath();
          ctx.roundRect(s.x - tw / 2, y - unit * 1.05, tw, unit * 1.5, 7);
          ctx.fill();
          ctx.fillStyle = '#ecdcff';
          ctx.fillText(f.text, s.x, y);
        }
        ctx.restore();
      }
    }

    this.drawAvatarOverlay(now, unit);

    // rótulos
    ctx.textAlign = 'center';
    const sc = this.scouting();
    ctx.font = `${unit * 1.2}px Bungee, sans-serif`;
    if (!combat && !sc && this.phase === 'planning') {
      const p = this.project(hexWorld(1, 3).setY(0.2));
      ctx.fillStyle = 'rgba(210,190,255,0.28)';
      ctx.fillText(store.state.pve ? 'DRONES DA PATRULHA A CAMINHO' : 'ZONA INIMIGA', p.x, p.y + unit);
    }
    const front = this.project(new THREE.Vector3(0, 0, 6.85));
    if (sc) {
      ctx.fillStyle = '#9fc2ff';
      ctx.fillText(`👀 ESPIANDO: ${sc.name.toUpperCase()} (Esc para voltar)`, front.x, front.y);
    }

    // resultado
    if (combat && this.replay && this.replay.ended) {
      const rp = this.replay;
      const won = rp.winner === rp.mySide;
      const draw = rp.winner === -1;
      const k = Math.min(1, (now - rp.start - rp.duration - 300) / 300);
      // entra "carimbando": começa grande e assenta
      const pop = 1 + (1 - k) * 0.6 + Math.sin(Math.min(1, k * 1.4) * Math.PI) * 0.08;
      const mid = this.project(new THREE.Vector3(0, 1, 0));
      const color = draw ? '#ffe066' : won ? '#5dff7a' : '#ff5d73';
      ctx.save();
      ctx.globalAlpha = k;
      // faixa atrás do texto
      const bandH = unit * 7.5;
      const grad = ctx.createLinearGradient(0, mid.y - bandH / 2, 0, mid.y + bandH / 2);
      grad.addColorStop(0, 'rgba(10,5,20,0)');
      grad.addColorStop(0.5, 'rgba(10,5,20,0.62)');
      grad.addColorStop(1, 'rgba(10,5,20,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, mid.y - bandH / 2 - unit * 1.2, this.W, bandH);
      ctx.translate(mid.x, mid.y);
      ctx.scale(pop, pop);
      ctx.font = `${unit * 4.2}px Bungee, sans-serif`;
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 30;
      ctx.lineWidth = 6;
      ctx.strokeStyle = 'rgba(10,5,20,0.8)';
      const txt = draw ? 'EMPATE' : won ? 'VITÓRIA!' : 'DERROTA';
      ctx.strokeText(txt, 0, 0);
      ctx.fillText(txt, 0, 0);
      ctx.restore();
      // destaque do combate: robô que mais causou dano do seu lado
      const mvp = this.combatMvp(rp);
      if (mvp) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, (now - rp.start - rp.duration - 700) / 300));
        ctx.font = `800 ${unit * 1.35}px Nunito, sans-serif`;
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(10,5,20,0.85)';
        ctx.fillStyle = '#ffe9a8';
        const line2 = `👑 Destaque: ${mvp.name} · ${mvp.dmg.toLocaleString('pt-BR')} de dano`;
        ctx.strokeText(line2, mid.x, mid.y + unit * 2.6);
        ctx.fillText(line2, mid.x, mid.y + unit * 2.6);
        ctx.restore();
      }
    }
  }

  private mvpCache: { rp: unknown; v: { name: string; dmg: number } | null } = { rp: null, v: null };
  private combatMvp(rp: NonNullable<Scene3D['replay']>) {
    if (this.mvpCache.rp === rp) return this.mvpCache.v;
    const dmg = new Map<number, number>();
    for (const e of rp.events) if (e.k === 'dmg' && e.s !== undefined) dmg.set(e.s, (dmg.get(e.s) ?? 0) + e.amt);
    let best: { name: string; dmg: number } | null = null;
    for (const [uid, d] of dmg) {
      const u = rp.units.get(uid);
      if (!u || !u.mine) continue;
      if (!best || d > best.dmg) best = { name: UNITS[u.init.defId].name, dmg: d };
    }
    this.mvpCache = { rp, v: best };
    return best;
  }

  private itemRow(x: number, y: number, items: string[], unit: number) {
    const ctx = this.octx;
    const s = unit * 1.25;
    const gap = 2;
    const total = items.length * s + (items.length - 1) * gap;
    ctx.save();
    ctx.imageSmoothingQuality = 'high';
    items.forEach((id, i) => {
      if (!ITEMS[id]) return;
      const bx = x - total / 2 + i * (s + gap);
      ctx.drawImage(itemCanvas(id), bx, y, s, s);
    });
    ctx.restore();
  }

  private stars(x: number, y: number, star: number, unit: number) {
    const ctx = this.octx;
    const colors = ['#d98c4a', '#e3ecf7', '#ffd23f'];
    const s = unit * 0.55;
    ctx.save();
    ctx.fillStyle = colors[star - 1];
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < star; i++) {
      const sx = x + (i - (star - 1) / 2) * s * 2.1;
      starPath(ctx, sx, y, s);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  /** vida "fantasma" que desce devagar depois do dano (rastro amarelo, igual TFT) */
  private hpLag = new Map<number, number>();

  private bars(x: number, y: number, star: number, mine: boolean, hp: number, maxHp: number, shield: number, mana: number, maxMana: number, unit: number, uid: number) {
    const ctx = this.octx;
    const w = unit * 4.4, h = Math.max(6, unit * 0.55);
    const bx = x - w / 2;
    const total = Math.max(maxHp, hp + shield);
    let lag = this.hpLag.get(uid) ?? hp;
    lag = hp >= lag ? hp : lag - Math.max(total * 0.004, (lag - hp) * 0.07);
    this.hpLag.set(uid, lag);
    // moldura
    ctx.fillStyle = 'rgba(8,6,16,0.92)';
    ctx.beginPath(); ctx.roundRect(bx - 2.5, y - 2.5, w + 5, h * 1.8 + 6, 3); ctx.fill();
    ctx.strokeStyle = mine ? 'rgba(120,255,150,0.55)' : 'rgba(255,110,140,0.55)';
    ctx.lineWidth = 1;
    ctx.stroke();
    // vida, rastro e escudo
    if (lag > hp) { ctx.fillStyle = '#ffe9a8'; ctx.fillRect(bx + (w * hp) / total, y, (w * (lag - hp)) / total, h); }
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, mine ? '#8dff9e' : '#ff8aa0');
    g.addColorStop(1, mine ? '#2fb44a' : '#d6304e');
    ctx.fillStyle = g;
    ctx.fillRect(bx, y, (w * hp) / total, h);
    if (shield > 0) {
      ctx.fillStyle = '#e8f6ff';
      ctx.fillRect(bx + (w * hp) / total, y, (w * shield) / total, h);
    }
    // divisões: finas a cada 100, grossas a cada 1000
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    if (total < 6000) for (let v = 100; v < total; v += 100) ctx.fillRect(bx + (w * v) / total, y, 1, v % 1000 === 0 ? h : h * 0.45);
    else for (let v = 1000; v < total; v += 1000) ctx.fillRect(bx + (w * v) / total, y, 1.5, h);
    // mana (brilha quando está cheia)
    if (maxMana < 900) {
      const full = mana >= maxMana;
      ctx.fillStyle = full ? `rgba(130,200,255,${0.75 + Math.sin(performance.now() / 90) * 0.25})` : '#3d8bff';
      ctx.fillRect(bx, y + h + 1.5, (w * Math.min(mana, maxMana)) / maxMana, h * 0.7);
    }
    this.stars(x, y - unit * 0.75, star, unit);
  }
}

function starPath(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 ? r * 0.45 : r;
    const px = x + Math.cos(a) * rad, py = y + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

export { AB_COLOR };
