/**
 * The 3D collection viewer.
 *
 * Four pieces built from real geometry and lit by a procedurally generated
 * environment map, so the gold reflects an actual surrounding rather than being
 * painted yellow. Drag to rotate; it idles with a slow turn.
 *
 * There are no product photographs, so nothing here pretends to be a specific
 * item in stock — these are honest representations of the forms we retail.
 */
import * as THREE from '/vendor/three/three.module.js';
import { reducedMotion } from './lib.js';

export const PIECES = {
  bar: {
    supportsFinish: false,
    name: '24K Gold Biscuit',
    copy: 'A 999 fine biscuit — the plainest way to own gold. No design, no making charge to speak of, nothing between you and the metal.',
    spec: [
      ['Purity', '24K · 999 fine'],
      ['Available in', '1 g to 100 g'],
      ['Making charge', 'Lowest of everything we sell'],
    ],
  },
  ring: {
    supportsFinish: true,
    name: '22K Ring',
    copy: 'A 916 band with a single set stone. The shank is finished by hand, which is where most of the making charge on a ring actually goes.',
    spec: [
      ['Purity', '22K · 916 hallmarked'],
      ['Typical weight', '2 g to 15 g'],
      ['Making charge', 'Rises with the setting work'],
    ],
  },
  bangle: {
    supportsFinish: true,
    name: '22K Bangle',
    copy: 'A plain round kada. Weight is the whole conversation here — a heavier bangle is not a better one, it is simply more gold.',
    spec: [
      ['Purity', '22K · 916 hallmarked'],
      ['Typical weight', '10 g to 40 g'],
      ['Making charge', 'Lower on plain, higher on carved'],
    ],
  },
  coin: {
    supportsFinish: false,
    name: '24K Gold Coin',
    copy: 'A stamped 999 coin. Popular at Dhanteras and for gifting, and easy to sell on precisely because the weight and purity are legible.',
    spec: [
      ['Purity', '24K · 999 fine'],
      ['Available in', '1 g to 50 g'],
      ['Making charge', 'Marginally above a biscuit'],
    ],
  },
};

// ---------------------------------------------------------------------------
// Procedural environment — a "studio" for the metal to reflect.
// ---------------------------------------------------------------------------

function buildEnvironment(renderer) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const g = c.getContext('2d');

  // A bright studio: pale ceiling, a broad softbox, warm bounce, sand floor.
  // Gold needs somewhere light to reflect or it just reads as brown.
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.0, '#eef2f2');
  grad.addColorStop(0.30, '#ffffff');  // the softbox band that makes gold read as gold
  grad.addColorStop(0.46, '#fff7e6');
  // A hard horizon. Polished metal needs one sharp light/dark edge to reflect,
  // or it reads as flat orange plastic no matter how bright the studio is.
  grad.addColorStop(0.560, '#ffeec9');
  grad.addColorStop(0.566, '#7a6647');
  grad.addColorStop(0.78, '#a8895a');
  grad.addColorStop(1.0, '#5d4e39');
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 256);

  // Two warm highlights give the surface something to catch as it turns.
  for (const [x, y, r, a] of [
    [110, 74, 86, 0.85],
    [372, 108, 104, 0.55],
  ]) {
    const hl = g.createRadialGradient(x, y, 0, x, y, r);
    hl.addColorStop(0, `rgba(255,255,255,${a})`);
    hl.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = hl;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;

  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromEquirectangular(tex).texture;
  pmrem.dispose();
  tex.dispose();
  return env;
}

/** Stamp face for the biscuit and the coin. */
function stampTexture({ round = false, w = 512, h = 320 } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');

  g.fillStyle = '#e7c473';
  if (round) {
    g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'destination-in';
    g.beginPath();
    g.arc(w / 2, h / 2, Math.min(w, h) / 2, 0, Math.PI * 2);
    g.fill();
    g.globalCompositeOperation = 'source-over';
  } else {
    g.fillRect(0, 0, w, h);
  }

  const ink = '#9d6f1d';
  g.strokeStyle = ink;
  g.fillStyle = ink;
  g.textAlign = 'center';

  // Nothing is stamped on these but the fineness — no brand, no maker's mark.
  if (round) {
    g.lineWidth = 3;
    g.beginPath();
    g.arc(w / 2, h / 2, Math.min(w, h) / 2 - 16, 0, Math.PI * 2);
    g.stroke();
    g.font = '600 54px Georgia, serif';
    g.fillText('999.0', w / 2, h / 2 + 19);
  } else {
    g.lineWidth = 3;
    g.strokeRect(20, 20, w - 40, h - 40);

    g.font = '600 64px Georgia, serif';
    g.fillText('999.0', w / 2, h / 2 - 4);

    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(w / 2 - 96, h / 2 + 24);
    g.lineTo(w / 2 + 96, h / 2 + 24);
    g.stroke();

    g.font = '500 30px Georgia, serif';
    g.fillText('FINE GOLD', w / 2, h / 2 + 64);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

function roundedRectShape(w, h, r) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2 + r, -h / 2);
  s.lineTo(w / 2 - r, -h / 2);
  s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  s.lineTo(w / 2, h / 2 - r);
  s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  s.lineTo(-w / 2 + r, h / 2);
  s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
  s.lineTo(-w / 2, -h / 2 + r);
  s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  return s;
}

/** Maps the extruded cap faces to 0..1 so the stamp lands squarely on them. */
function capUVGenerator(w, h) {
  const at = (vertices, i) =>
    new THREE.Vector2((vertices[i * 3] + w / 2) / w, (vertices[i * 3 + 1] + h / 2) / h);
  return {
    generateTopUV: (_g, v, a, b, c) => [at(v, a), at(v, b), at(v, c)],
    generateSideWallUV: () => [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(1, 0),
      new THREE.Vector2(1, 1),
      new THREE.Vector2(0, 1),
    ],
  };
}

/**
 * `tintable` marks the pieces whose colour the finish switch may change. The
 * biscuit and the coin are 24K, which has no alloy in it and therefore no rose
 * variant, so their materials are deliberately left out of it.
 */
function goldMaterial(extra = {}, tintable = false) {
  const m = new THREE.MeshPhysicalMaterial({
    color: 0xffc85c,
    metalness: 1,
    roughness: 0.17,
    envMapIntensity: 1.75,
    clearcoat: 0.18,
    clearcoatRoughness: 0.3,
    ...extra,
  });
  m.userData.tintable = tintable;
  return m;
}

function buildBar() {
  const W = 2.15;
  const H = 1.32;
  const shape = roundedRectShape(W, H, 0.1);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.3,
    bevelEnabled: true,
    bevelThickness: 0.075,
    bevelSize: 0.075,
    bevelSegments: 3,
    curveSegments: 10,
    UVGenerator: capUVGenerator(W, H),
  });
  geo.center();

  const stamp = stampTexture({ round: false });
  const mesh = new THREE.Mesh(geo, [
    goldMaterial({ map: stamp, roughness: 0.3 }),
    goldMaterial({ roughness: 0.2 }),
  ]);
  mesh.rotation.x = -0.42;
  return mesh;
}

function buildRing() {
  const group = new THREE.Group();

  const band = new THREE.Mesh(new THREE.TorusGeometry(0.86, 0.17, 40, 140), goldMaterial({ roughness: 0.16 }, true));
  group.add(band);

  // Four-claw setting with a faceted stone.
  const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 0.16, 28), goldMaterial({}, true));
  seat.position.y = 0.94;
  group.add(seat);

  // Reflective rather than refractive: `transmission` needs something behind the
  // canvas to bend, and on a transparent canvas it just renders an opaque cone.
  const gemMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0,
    roughness: 0,
    envMapIntensity: 4.2,
    clearcoat: 1,
    clearcoatRoughness: 0,
    iridescence: 0.6,
    iridescenceIOR: 2.0,
    emissive: 0xdff0ff,
    emissiveIntensity: 0.16, // keeps the facets from reading as grey shards
  });

  // Cut like a real stone: a deep pavilion below the girdle, a short crown and a
  // flat table on top. An 8-sided octahedron on its own just looks like a shard.
  const pavilion = new THREE.Mesh(new THREE.ConeGeometry(0.185, 0.26, 8), gemMat);
  pavilion.rotation.x = Math.PI; // point downwards, into the setting
  pavilion.position.y = 1.06;
  group.add(pavilion);

  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.185, 0.075, 8), gemMat);
  crown.position.y = 1.226;
  group.add(crown);

  group.rotation.x = 0.34;
  return group;
}

function buildBangle() {
  const group = new THREE.Group();
  group.add(new THREE.Mesh(new THREE.TorusGeometry(1.22, 0.145, 32, 180), goldMaterial({ roughness: 0.14 }, true)));

  // A pair of raised bands, the way a plain kada is usually finished.
  for (const y of [-0.62, 0.62]) {
    const ridge = new THREE.Mesh(new THREE.TorusGeometry(1.22, 0.028, 16, 180), goldMaterial({ roughness: 0.32 }, true));
    ridge.position.z = y * 0.14;
    group.add(ridge);
  }

  group.rotation.x = 1.06;
  group.rotation.z = 0.2;
  return group;
}

function buildCoin() {
  const stamp = stampTexture({ round: true, w: 384, h: 384 });
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.98, 0.98, 0.14, 96), [
    goldMaterial({ roughness: 0.34 }), // rim
    goldMaterial({ map: stamp, roughness: 0.3 }), // top
    goldMaterial({ map: stamp, roughness: 0.3 }), // bottom
  ]);
  mesh.rotation.x = -1.16;
  return mesh;
}

// ---------------------------------------------------------------------------

export function initShowcase(canvas, { onReady } = {}) {
  if (!canvas) return null;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch {
    return null;
  }

  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92; // the studio env is bright; hold the highlights

  const scene = new THREE.Scene();
  scene.environment = buildEnvironment(renderer);

  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  camera.position.set(0, 0, 6.2);

  // The env map does the heavy lifting; these add a little directional sparkle.
  scene.add(new THREE.AmbientLight(0xfff4e2, 0.3));
  const key = new THREE.DirectionalLight(0xfff6e4, 1.35);
  key.position.set(3, 4, 5);
  scene.add(key);
  // A cool counter-light so the shadow side doesn't die into the pale stage.
  const rim = new THREE.DirectionalLight(0x9fc4d6, 0.5);
  rim.position.set(-4, -1, -3);
  scene.add(rim);

  const pivot = new THREE.Group();
  scene.add(pivot);

  const meshes = {
    bar: buildBar(),
    ring: buildRing(),
    bangle: buildBangle(),
    coin: buildCoin(),
  };
  Object.values(meshes).forEach((m) => {
    m.visible = false;
    pivot.add(m);
  });

  let current = 'bar';
  meshes.bar.visible = true;

  // --- interaction ---------------------------------------------------------
  let yaw = 0.35;
  let pitch = -0.1;
  let velYaw = 0.0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let interacted = false;
  let swapT = 1; // 0..1 scale-in progress

  const onDown = (e) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.setPointerCapture?.(e.pointerId);
    if (!interacted) {
      interacted = true;
      document.getElementById('showcaseHint')?.classList.add('is-hidden');
    }
  };
  const onMove = (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    yaw += dx * 0.008;
    pitch = Math.max(-0.9, Math.min(0.9, pitch + dy * 0.006));
    velYaw = dx * 0.008;
  };
  const onUp = (e) => {
    dragging = false;
    canvas.releasePointerCapture?.(e.pointerId);
  };

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('pointerleave', onUp);

  // --- sizing --------------------------------------------------------------
  function resize() {
    const w = canvas.clientWidth || 480;
    const h = canvas.clientHeight || 400;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  // --- loop ----------------------------------------------------------------
  let raf = 0;
  let running = false;
  let visible = true;
  let t = 0;
  let last = performance.now();

  function render(now) {
    raf = requestAnimationFrame(render);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    t += dt;

    if (!dragging) {
      // Inertia after a flick, then a slow idle turn.
      velYaw *= 0.94;
      yaw += velYaw + (reducedMotion() ? 0 : dt * 0.22);
    }

    if (swapT < 1) {
      swapT = Math.min(1, swapT + dt * 3.4);
      const s = 0.72 + 0.28 * (1 - Math.pow(1 - swapT, 3));
      meshes[current].scale.setScalar(s);
    }

    pivot.rotation.y = yaw;
    pivot.rotation.x = pitch;
    // A slight bob keeps it feeling like an object in space, not a decal.
    pivot.position.y = reducedMotion() ? 0 : Math.sin(t * 0.9) * 0.045;

    renderer.render(scene, camera);
  }

  function start() {
    if (running || !visible || document.hidden) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(render);
  }
  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }

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
  onReady?.();

  return {
    setPiece(name) {
      if (!meshes[name] || name === current) return;
      meshes[current].visible = false;
      current = name;
      meshes[current].visible = true;
      meshes[current].scale.setScalar(0.72);
      swapT = 0;
      velYaw = 0.05;
    },

    /** Recolour only the alloyed pieces — see goldMaterial()'s note on 24K. */
    setFinish(hex) {
      const colour = new THREE.Color(hex);
      for (const piece of Object.values(meshes)) {
        piece.traverse((node) => {
          const mats = Array.isArray(node.material) ? node.material : node.material ? [node.material] : [];
          for (const m of mats) {
            if (m.userData?.tintable) m.color.copy(colour);
          }
        });
      }
    },

    get current() {
      return current;
    },
    stop,
    start,
  };
}
