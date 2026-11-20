import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';

export type Quality = 'alto' | 'medio' | 'baixo';

export const QUALITY_LABEL: Record<Quality, string> = { alto: 'Ultra', medio: 'Médio', baixo: 'Leve' };

export function loadQuality(): Quality {
  try {
    const q = localStorage.getItem('chapatron_quality');
    if (q === 'alto' || q === 'medio' || q === 'baixo') return q;
  } catch { /* */ }
  return integratedGpu() ? 'medio' : 'alto';
}

/** GPU integrada/fraca (Intel HD/UHD, celulares) → começa no Médio. */
export function integratedGpu(): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl2') as WebGL2RenderingContext | null;
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /intel|uhd|hd graphics|iris|mali|adreno|powervr|apple gpu|swiftshader|llvmpipe/i.test(name) && !/arc/i.test(name);
  } catch { return false; }
}
export function saveQuality(q: Quality) {
  try { localStorage.setItem('chapatron_quality', q); } catch { /* */ }
}

// vinheta + leve gradação de cor (contraste/saturação) depois do tone mapping
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uVignette: { value: 0.38 },
    uSat: { value: 1.12 },
    uContrast: { value: 1.06 },
    uTime: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uVignette, uSat, uContrast, uTime;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
      c.rgb = mix(vec3(l), c.rgb, uSat);
      c.rgb = (c.rgb - 0.5) * uContrast + 0.5;
      vec2 d = vUv - 0.5;
      float v = 1.0 - dot(d, d) * uVignette * 2.2;
      c.rgb *= mix(vec3(0.55, 0.42, 0.7), vec3(1.0), clamp(v, 0.0, 1.0));
      // grão de filme bem sutil
      float n = fract(sin(dot(vUv * 1000.0 + uTime, vec2(12.9898, 78.233))) * 43758.5453);
      c.rgb += (n - 0.5) * 0.015;
      gl_FragColor = c;
    }`,
};

export class Post {
  composer: EffectComposer;
  bloom: UnrealBloomPass;
  grade: ShaderPass;
  fxaa: ShaderPass;
  enabled = true;
  private w = 1; private h = 1; private dpr = 1;

  constructor(private renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 0 });
    this.composer = new EffectComposer(renderer, rt);
    this.composer.addPass(new RenderPass(scene, camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.55, 0.92);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);
    this.fxaa = new ShaderPass(FXAAShader);
    this.composer.addPass(this.fxaa);
  }

  setSize(w: number, h: number, dpr: number) {
    this.w = w; this.h = h; this.dpr = dpr;
    this.composer.setPixelRatio(dpr);
    this.composer.setSize(w, h);
    this.fxaa.uniforms.resolution.value.set(1 / (w * dpr), 1 / (h * dpr));
  }

  setQuality(q: Quality) {
    this.enabled = q !== 'baixo';
    this.bloom.enabled = true;
    this.bloom.strength = q === 'alto' ? 0.6 : 0.5;
    // Ultra: MSAA 4x de verdade; Médio: FXAA (bem mais barato em GPU integrada)
    const samples = q === 'alto' ? 4 : 0;
    (this.composer.renderTarget1 as THREE.WebGLRenderTarget).samples = samples;
    (this.composer.renderTarget2 as THREE.WebGLRenderTarget).samples = samples;
    this.fxaa.enabled = samples === 0;
    this.setSize(this.w, this.h, this.dpr);
  }

  render(scene: THREE.Scene, camera: THREE.Camera, t: number) {
    if (!this.enabled) { this.renderer.render(scene, camera); return; }
    this.grade.uniforms.uTime.value = t % 100;
    this.composer.render();
  }
}
