import * as THREE from 'three';
import { buildAvatar, lookKey, type AvatarModel } from './three/avatar';
import { myLook } from './avatarPicker';
import { sfx } from './sfx';

// Pequena Lenda girando no meio do menu (clique para ela dançar).

let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;
let model: AvatarModel | null = null;
let modelKey = '';
let raf = 0;
let danceUntil = 0;
let ring: THREE.Mesh | null = null;
let lastSync = -1e9;

function ensure(canvas: HTMLCanvasElement) {
  if (renderer) return;
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
  renderer.toneMapping = THREE.NeutralToneMapping;
  scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#e8dcff', '#2a4a30', 1.5));
  const sun = new THREE.DirectionalLight('#fff1dc', 2.4);
  sun.position.set(3, 6, 5);
  scene.add(sun);
  const rim = new THREE.DirectionalLight('#9bff5d', 1.6);
  rim.position.set(-4, 3, -5);
  scene.add(rim);
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.4, 0.16, 48), new THREE.MeshStandardMaterial({ color: '#2a2045', roughness: 0.6, metalness: 0.3 }));
  pad.position.y = -0.08;
  scene.add(pad);
  ring = new THREE.Mesh(new THREE.TorusGeometry(1.32, 0.035, 8, 64), new THREE.MeshBasicMaterial({ color: '#9bff5d', transparent: true, opacity: 0.8 }));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.01;
  scene.add(ring);
  camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0, 1.7, 5.4);
  camera.lookAt(0, 0.8, 0);
  canvas.addEventListener('pointerdown', () => { danceUntil = performance.now() + 2000; sfx('buff'); });
}

function syncModel() {
  if (!scene) return;
  const look = myLook();
  const key = lookKey(look);
  if (model && key === modelKey) return;
  if (model) { scene.remove(model.root); model.dispose(); }
  model = buildAvatar(look);
  model.root.scale.setScalar(1.7);
  scene.add(model.root);
  modelKey = key;
}

/** Liga a prévia (chamado ao abrir o menu); para sozinha quando o menu some. */
export function startMenuHero(canvas: HTMLCanvasElement, visible: () => boolean) {
  ensure(canvas);
  lastSync = -1e9;
  cancelAnimationFrame(raf);
  const loop = (now: number) => {
    if (!visible() || !renderer || !scene || !camera) return;
    if (now - lastSync > 500) { lastSync = now; syncModel(); }
    const cv = renderer.domElement;
    const w = cv.clientWidth, h = cv.clientHeight;
    if (w && h && (cv.width !== Math.round(w * renderer.getPixelRatio()) || cv.height !== Math.round(h * renderer.getPixelRatio()))) {
      renderer.setSize(w, h, false);
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
    }
    const t = now / 1000;
    if (model) {
      model.root.rotation.y = Math.sin(t * 0.6) * 0.6;
      model.tick(t, false, false, 0, danceUntil > now ? 1 : 0);
    }
    if (ring) (ring.material as THREE.MeshBasicMaterial).opacity = 0.5 + Math.sin(t * 2) * 0.3;
    renderer.render(scene, camera);
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
}
