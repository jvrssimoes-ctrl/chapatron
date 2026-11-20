import * as THREE from 'three';
import type { RobotLook } from '../../../shared/types';
import { buildRobot, disposeRobot } from './models';
import { envMapFor } from './env';
import { UNITS } from '../../../shared/data';

// Renderiza o modelo 3D de cada robô uma vez para usar como imagem nas cartas da loja/tooltip.

let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
const cache = new Map<string, string>();

function setup() {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(260, 200);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  scene = new THREE.Scene();
  scene.environment = envMapFor(renderer);
  scene.environmentIntensity = 0.7;
  scene.add(new THREE.HemisphereLight('#e6dcff', '#204030', 1.1));
  const back = new THREE.PointLight('#c08bff', 6, 10, 1);
  back.position.set(2.5, 2, -2);
  scene.add(back);
  const key = new THREE.DirectionalLight('#ffffff', 2.2);
  key.position.set(2, 4, 5);
  scene.add(key);
  const rimL = new THREE.PointLight('#5dff7a', 3, 10, 1);
  rimL.position.set(-2.5, 1.5, -1);
  scene.add(rimL);
  camera = new THREE.PerspectiveCamera(28, 260 / 200, 0.1, 50);
}

export function robotPortrait(defId: string, look: RobotLook): string {
  const hit = cache.get(defId);
  if (hit) return hit;
  if (!renderer) setup();
  const m = buildRobot(look, UNITS[defId]?.role);
  m.tick(0, 'happy');
  m.root.rotation.y = -0.5;
  scene.add(m.root);
  const cy = m.height * 0.5;
  const d = m.height * 2.6 + 0.6;
  camera.position.set(0, cy + 0.35, d);
  camera.lookAt(0, cy, 0);
  renderer!.render(scene, camera);
  const url = renderer!.domElement.toDataURL('image/png');
  scene.remove(m.root);
  disposeRobot(m);
  cache.set(defId, url);
  return url;
}
