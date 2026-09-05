/**
 * The hero's looping motion layer.
 *
 * A continuously flowing molten-gold field, rendered as a fullscreen fragment
 * shader. It loops forever because it is driven by time rather than by a clip,
 * so there is no seam and no megabytes of video to download.
 *
 * If the showroom later drops a real film at /assets/video/hero.mp4 it is used
 * instead — see attachVideoUpgrade() at the bottom.
 *
 * Performance: the shader renders to a reduced-resolution buffer (the effect is
 * soft, so upscaling is invisible) and pauses whenever the hero scrolls out of
 * view or the tab is hidden.
 */
import * as THREE from '/vendor/three/three.module.js';
import { reducedMotion } from './lib.js';

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform vec2  uRes;
  varying vec2  vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i),               hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }

  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p = p * 2.03 + vec2(1.7, 9.2);
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 uv = vUv;
    vec2 p  = uv * vec2(uRes.x / max(uRes.y, 1.0), 1.0) * 2.3;
    float t = uTime * 0.045;

    // Two rounds of domain warping give the slow, liquid, non-repeating drift.
    vec2 q = vec2(fbm(p + vec2(0.0, t)),
                  fbm(p + vec2(5.2, 1.3) - t));
    vec2 r = vec2(fbm(p + 3.0 * q + vec2(1.7, 9.2) + t * 1.35),
                  fbm(p + 3.0 * q + vec2(8.3, 2.8) - t * 1.10));
    float f = fbm(p + 3.2 * r);

    float ribbon = smoothstep(0.26, 0.82, f + 0.24 * r.x);
    float spec   = pow(smoothstep(0.54, 1.0, f + 0.30 * q.y), 3.0);

    // Champagne silk on paper — light and warm, but with enough depth in the
    // folds that the movement actually reads against a cream page.
    vec3 paper     = vec3(0.988, 0.972, 0.944);
    vec3 champagne = vec3(0.937, 0.860, 0.716);
    vec3 gold      = vec3(0.816, 0.635, 0.271);
    vec3 deepGold  = vec3(0.541, 0.376, 0.106);
    vec3 hot       = vec3(1.000, 0.992, 0.960);

    vec3 col = mix(paper, champagne, smoothstep(0.06, 0.62, f));
    col = mix(col, gold, ribbon * 0.92);
    col = mix(col, deepGold, pow(ribbon, 2.6) * 0.55);   // folds in the silk
    col = mix(col, hot, spec * 0.65);                    // highlight, not bloom

    // A soft warm vignette — darkens barely, keeps the corners from going flat.
    vec2 c = uv - 0.5;
    col *= 1.0 - dot(c, c) * 0.26;
    col += (hash(uv * uRes + fract(uTime)) - 0.5) * 0.016;  // grain kills banding

    gl_FragColor = vec4(col, 1.0);
  }
`;

export function initHeroBackground(canvas) {
  if (!canvas) return null;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'low-power' });
  } catch {
    // No WebGL — the CSS gradient scrim behind it is a perfectly good fallback.
    canvas.style.display = 'none';
    return null;
  }

  const scene = new THREE.Scene();
  const camera = new THREE.Camera();
  const uniforms = {
    uTime: { value: 0 },
    uRes: { value: new THREE.Vector2(1, 1) },
  };

  scene.add(
    new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms, depthTest: false })
    )
  );

  const isSmall = () => window.innerWidth < 860;

  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    // Deliberately under-render: this effect has no hard edges to lose.
    const scale = isSmall() ? 0.5 : 0.68;
    renderer.setPixelRatio(1);
    renderer.setSize(Math.max(2, Math.round(w * scale)), Math.max(2, Math.round(h * scale)), false);
    uniforms.uRes.value.set(w, h);
  }

  resize();
  window.addEventListener('resize', resize, { passive: true });

  // --- render loop, paused when not needed ---------------------------------
  let raf = 0;
  let running = false;
  let visible = true;
  let last = performance.now();
  let clock = 0;

  const frame = (now) => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    clock += dt;
    uniforms.uTime.value = clock;
    renderer.render(scene, camera);
  };

  function start() {
    if (running || !visible || document.hidden) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }

  if (reducedMotion()) {
    // One still frame — the composition still reads, nothing moves.
    uniforms.uTime.value = 12;
    renderer.render(scene, camera);
  } else {
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(
        ([entry]) => {
          visible = entry.isIntersecting;
          visible ? start() : stop();
        },
        { threshold: 0 }
      ).observe(canvas);
    }
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
    start();
  }

  return { start, stop, renderer };
}

/**
 * If a real hero film exists, prefer it. We probe with HEAD so a missing file
 * costs one 404 and never shows a broken player.
 */
export async function attachVideoUpgrade(video, src = '/assets/video/hero.mp4') {
  if (!video || reducedMotion()) return false;
  try {
    const res = await fetch(src, { method: 'HEAD' });
    if (!res.ok) return false;
    video.src = src;
    await video.play().catch(() => {});
    video.classList.add('is-live');
    return true;
  } catch {
    return false;
  }
}
