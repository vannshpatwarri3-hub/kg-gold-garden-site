/**
 * The 3D collection viewer.
 *
 * Four pieces built from real geometry and lit by a procedurally generated
 * environment map, so the gold reflects an actual surrounding rather than being
 * painted yellow. Drag to rotate; it idles with a slow turn.
 *
 * The ring and the bangle are modelled on two pieces in the catalogue — the
 * Emerald Knot ring and the Baguette Line bangle — so the shape, the setting and
 * the stone placement match. Both are made in yellow and rose; only the metal
 * changes between them, never the design.
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
    name: 'Emerald Knot Ring',
    copy: 'The piece from our collection, rebuilt in 3D — a split shank, two pavé arcs crossing over the finger, and an emerald-cut green stone held between them.',
    spec: [
      ['Centre stone', 'Emerald cut'],
      ['Setting', 'Pavé, two crossing rows'],
      ['Finish', 'Made in yellow and rose'],
    ],
  },
  bangle: {
    supportsFinish: true,
    name: 'Baguette Line Bangle',
    copy: 'A full circle of baguette-cut stones stood between two rails and held by bead claws, closed with a box clasp. Rebuilt in 3D from the piece itself.',
    spec: [
      ['Stones', 'Baguette cut, full circle'],
      ['Closure', 'Box clasp'],
      ['Finish', 'Made in yellow and rose'],
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

  // Bright spots for the metal to catch as it turns. More of them, and harder,
  // means more moving highlights — which is what reads to the eye as lustre.
  for (const [x, y, r, a] of [
    [110, 70, 76, 1.0],
    [372, 100, 92, 0.75],
    [248, 48, 44, 0.9],
    [64, 132, 38, 0.6],
    [458, 62, 40, 0.7],
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
    roughness: 0.1,          // polished, not satin — this is where the lustre comes from
    envMapIntensity: 2.15,
    clearcoat: 0.35,
    clearcoatRoughness: 0.12,
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

// ---------------------------------------------------------------------------
// Stones
//
// All reflective rather than refractive: `transmission` needs something behind
// the canvas to bend, and on a transparent canvas it renders as an opaque lump.
// Stone materials are never tintable — changing the metal must not change the
// stones, so the two finishes stay the same piece.
// ---------------------------------------------------------------------------

const brilliantMaterial = () =>
  new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0,
    roughness: 0,
    envMapIntensity: 5.2,
    clearcoat: 1,
    clearcoatRoughness: 0,
    iridescence: 0.7,
    iridescenceIOR: 2.2,
    emissive: 0xe6f3ff,
    emissiveIntensity: 0.2, // stops small facets reading as grey specks
  });

const emeraldMaterial = () =>
  new THREE.MeshPhysicalMaterial({
    color: 0x0f9b63,
    metalness: 0,
    roughness: 0.02,
    envMapIntensity: 4.6,
    clearcoat: 1,
    clearcoatRoughness: 0,
    emissive: 0x0a5c3a,
    emissiveIntensity: 0.34,
  });

/** An emerald cut's outline: a rectangle with the corners taken off. */
function emeraldCutGeometry(w, h, depth) {
  const c = Math.min(w, h) * 0.26;
  const s = new THREE.Shape();
  s.moveTo(-w / 2 + c, -h / 2);
  s.lineTo(w / 2 - c, -h / 2);
  s.lineTo(w / 2, -h / 2 + c);
  s.lineTo(w / 2, h / 2 - c);
  s.lineTo(w / 2 - c, h / 2);
  s.lineTo(-w / 2 + c, h / 2);
  s.lineTo(-w / 2, h / 2 - c);
  s.lineTo(-w / 2, -h / 2 + c);
  s.closePath();

  const geo = new THREE.ExtrudeGeometry(s, {
    depth,
    bevelEnabled: true,
    bevelThickness: depth * 0.42,
    bevelSize: Math.min(w, h) * 0.15,
    bevelSegments: 2,
  });
  geo.center();
  return geo;
}

/** A run of small stones following an arc — how a pavé row is actually set. */
function paveArc({ radius, count, from, to, size, material, z = 0 }) {
  const mesh = new THREE.InstancedMesh(new THREE.OctahedronGeometry(size, 0), material, count);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3(1, 0.6, 1);

  for (let i = 0; i < count; i++) {
    const t = from + (to - from) * (count === 1 ? 0.5 : i / (count - 1));
    p.set(Math.cos(t) * radius, Math.sin(t) * radius, z);
    q.setFromEuler(new THREE.Euler(Math.PI / 2, 0, t));
    m.compose(p, q, s);
    mesh.setMatrixAt(i, m);
  }
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

/**
 * The Emerald Knot ring: a split shank, two pavé-set arcs crossing over the
 * finger, and a rectangular green stone held between them.
 */
function buildRing() {
  const group = new THREE.Group();
  const gold = () => goldMaterial({ roughness: 0.13 }, true);
  const diamond = brilliantMaterial();

  // Split shank — two slim bands rather than one thick one.
  for (const z of [-0.085, 0.085]) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.86, 0.046, 20, 120), gold());
    band.position.z = z;
    group.add(band);
  }

  const head = new THREE.Group();
  head.position.y = 1.0;

  // The knot: two arcs crossing, each outlined in small stones.
  for (const [tilt, z] of [
    [0.6, 0.085],
    [-0.6, -0.085],
  ]) {
    const arc = new THREE.Mesh(
      new THREE.TorusGeometry(0.44, 0.04, 14, 72, Math.PI * 1.2),
      gold()
    );
    arc.rotation.z = tilt;
    arc.position.z = z;
    head.add(arc);

    const row = paveArc({
      radius: 0.44,
      count: 24,
      from: 0,
      to: Math.PI * 1.2,
      size: 0.035,
      material: diamond,
      z,
    });
    row.rotation.z = tilt;
    head.add(row);
  }

  // The centre stone in a plain rub-over seat.
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.1, 0.3), gold());
  head.add(seat);

  const stone = new THREE.Mesh(emeraldCutGeometry(0.4, 0.25, 0.2), emeraldMaterial());
  stone.rotation.x = -Math.PI / 2; // table upward
  stone.position.y = 0.1;
  head.add(stone);

  group.add(head);
  group.rotation.x = 0.3;
  return group;
}

/**
 * The Baguette Line bangle: a full circle of rectangular stones stood between
 * two rails, held by bead claws, closed with a box clasp.
 */
function buildBangle() {
  const group = new THREE.Group();
  const gold = () => goldMaterial({ roughness: 0.12 }, true);
  const diamond = brilliantMaterial();

  const R = 1.18;
  const COUNT = 44;

  for (const z of [-0.095, 0.095]) {
    const rail = new THREE.Mesh(new THREE.TorusGeometry(R, 0.03, 14, 200), gold());
    rail.position.z = z;
    group.add(rail);
  }

  // Baguettes are rectangular, set shoulder to shoulder all the way round.
  const stones = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.085, 0.13, 0.165),
    diamond,
    COUNT
  );
  const claws = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.024, 8, 8),
    gold(),
    COUNT * 2
  );

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);
  let c = 0;

  for (let i = 0; i < COUNT; i++) {
    const t = (i / COUNT) * Math.PI * 2;
    q.setFromEuler(new THREE.Euler(0, 0, t));

    p.set(Math.cos(t) * R, Math.sin(t) * R, 0);
    m.compose(p, q, one);
    stones.setMatrixAt(i, m);

    // A bead either side of every stone, sitting on the rails.
    const g = t + Math.PI / COUNT;
    for (const z of [-0.095, 0.095]) {
      p.set(Math.cos(g) * R, Math.sin(g) * R, z);
      m.compose(p, q, one);
      claws.setMatrixAt(c++, m);
    }
  }
  stones.instanceMatrix.needsUpdate = true;
  claws.instanceMatrix.needsUpdate = true;
  group.add(stones, claws);

  const clasp = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.18, 0.26), gold());
  clasp.position.set(R, 0, 0);
  group.add(clasp);

  group.rotation.x = 1.0;
  group.rotation.z = 0.25;
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
