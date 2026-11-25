import * as THREE from 'three';
import { AVATAR_COLORS, AVATAR_SPECIES, buildAvatar, lookKey, parseLook, type AvatarLook, type AvatarModel } from './three/avatar';
import { net } from './net';
import { sfx } from './sfx';
import { store } from './store';

// Escolha da Pequena Lenda (espécie + cor), com prévia 3D girando.

const KEY = 'chapatron_avatar';

function lsGet() { try { return localStorage.getItem(KEY); } catch { return null; } }
function lsSet(v: string) { try { localStorage.setItem(KEY, v); } catch { /* */ } }

export function myLook(): AvatarLook {
  const saved = lsGet();
  if (saved) return parseLook(saved);
  const l: AvatarLook = { species: 'nuvem', color: Math.floor(Math.random() * AVATAR_COLORS.length) };
  lsSet(lookKey(l));
  return l;
}
export const myLookKey = () => lookKey(myLook());

let root: HTMLElement | null = null;
let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;
let model: AvatarModel | null = null;
let raf = 0;
let cur: AvatarLook = myLook();

export const isPickerOpen = () => !!root && !root.classList.contains('hidden');

function setModel() {
  if (!scene) return;
  if (model) { scene.remove(model.root); model.dispose(); }
  model = buildAvatar(cur);
  model.root.scale.setScalar(1.6);
  scene.add(model.root);
}

function render() {
  if (!root) return;
  const sp = AVATAR_SPECIES.find((s) => s.id === cur.species)!;
  root.querySelector('.ap-species')!.innerHTML = AVATAR_SPECIES.map((s) =>
    `<button class="ap-sp ${s.id === cur.species ? 'on' : ''}" data-sp="${s.id}"><span>${s.icon}</span>${s.name}</button>`).join('');
  root.querySelector('.ap-colors')!.innerHTML = AVATAR_COLORS.map((c, i) =>
    `<button class="ap-c ${i === cur.color ? 'on' : ''}" data-c="${i}" style="--c:${c}" title="Cor ${i + 1}"></button>`).join('');
  root.querySelector('.ap-desc')!.textContent = sp.desc;
}

function save() {
  const key = lookKey(cur);
  lsSet(key);
  if (store.room) net.send({ t: 'avatar', look: key });
}

export function openPicker() {
  cur = myLook();
  if (!root) {
    root = document.createElement('div');
    root.id = 'avatarPicker';
    root.innerHTML = `<div class="gd-box ap-box">
      <div class="gd-head"><h2>🎨 Sua Pequena Lenda</h2><span class="pf-sub">ela anda no tabuleiro, pega robôs no carrossel e apanha quando você perde</span><button class="gd-close btn small ghost" title="Fechar (Esc)">✖</button></div>
      <div class="ap-body">
        <div class="ap-stage"><canvas></canvas><button class="ap-dance btn small" title="Dancinha">💃 Dançar</button></div>
        <div class="ap-side">
          <h4>Espécie</h4><div class="ap-species"></div>
          <p class="ap-desc"></p>
          <h4>Cor</h4><div class="ap-colors"></div>
          <button class="btn primary ap-ok">Pronto!</button>
        </div>
      </div>
    </div>`;
    document.body.appendChild(root);
    root.addEventListener('click', (e) => {
      const el = e.target as HTMLElement;
      if (el === root || el.closest('.gd-close') || el.closest('.ap-ok')) { closePicker(); return; }
      const sp = el.closest('.ap-sp') as HTMLElement | null;
      const c = el.closest('.ap-c') as HTMLElement | null;
      if (sp) { cur = { ...cur, species: sp.dataset.sp as AvatarLook['species'] }; sfx('click'); setModel(); render(); save(); }
      if (c) { cur = { ...cur, color: Number(c.dataset.c) }; sfx('click'); setModel(); render(); save(); }
      if (el.closest('.ap-dance')) { danceUntil = performance.now() + 1800; sfx('buff'); }
    });
    const canvas = root.querySelector('canvas')!;
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.toneMapping = THREE.NeutralToneMapping;
    scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight('#e8dcff', '#2a4a30', 1.4));
    const sun = new THREE.DirectionalLight('#fff1dc', 2.2);
    sun.position.set(3, 6, 5);
    scene.add(sun);
    const rim = new THREE.DirectionalLight('#9f7aff', 1.5);
    rim.position.set(-4, 3, -5);
    scene.add(rim);
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.5, 0.14, 40), new THREE.MeshStandardMaterial({ color: '#3a2f55', roughness: 0.8 }));
    pad.position.y = -0.07;
    scene.add(pad);
    camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
    camera.position.set(0, 1.9, 5.2);
    camera.lookAt(0, 0.75, 0);
  }
  root.classList.remove('hidden');
  setModel();
  render();
  cancelAnimationFrame(raf);
  const loop = (now: number) => {
    if (!isPickerOpen() || !renderer || !scene || !camera || !model) return;
    const cv = renderer.domElement;
    const w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== Math.round(w * renderer.getPixelRatio()) || cv.height !== Math.round(h * renderer.getPixelRatio())) {
      renderer.setSize(w, h, false);
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
    }
    const t = now / 1000;
    model.root.rotation.y = Math.sin(t * 0.7) * 0.7;
    model.tick(t, false, false, 0, danceUntil > now ? 1 : 0);
    renderer.render(scene, camera);
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
}
let danceUntil = 0;

export function closePicker() {
  root?.classList.add('hidden');
  cancelAnimationFrame(raf);
}
