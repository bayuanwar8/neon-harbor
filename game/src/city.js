// NEON HARBOR — the city. Builds a small dense neon harbor city: a street grid,
// towers with lit windows and neon signs, a harbor with water, docks, containers
// and cranes, plus streetlights and road markings. All procedural, seeded.
import * as THREE from 'three';
import { CFG } from './config.js';

const STREET_LINES = [-100, -50, 0, 50, 100];
const STREET_HALF = 7;

// Canvas texture: dark facade with a grid of lit windows.
function makeWindowTexture(rng, hue) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#11141f';
  g.fillRect(0, 0, 128, 256);
  const cols = 6;
  const rows = 14;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const lit = rng.chance(0.42);
      if (!lit) continue;
      const warm = rng.chance(0.6);
      g.fillStyle = warm ? 'rgba(255, 205, 110, 0.95)' : `hsla(${hue}, 90%, 65%, 0.95)`;
      g.fillRect(6 + x * 20, 8 + y * 17, 12, 9);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Canvas texture: a neon sign with text.
function makeSignTexture(text, color) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#05060f';
  g.fillRect(0, 0, 256, 64);
  g.strokeStyle = color;
  g.lineWidth = 3;
  g.strokeRect(4, 4, 248, 56);
  g.font = 'bold 30px Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = color;
  g.shadowBlur = 14;
  g.fillStyle = color;
  g.fillText(text, 128, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function box(w, h, d, mat, x, y, z, parent) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

export function buildCity(scene, rng) {
  const group = new THREE.Group();
  scene.add(group);
  const colliders = []; // {x0,z0,x1,z1} building footprints

  const asphalt = new THREE.MeshStandardMaterial({ color: CFG.COL.asphalt, roughness: 0.92, metalness: 0.05 });
  const sidewalkMat = new THREE.MeshStandardMaterial({ color: CFG.COL.sidewalk, roughness: 0.95 });
  const waterMat = new THREE.MeshStandardMaterial({ color: CFG.COL.water, roughness: 0.25, metalness: 0.6 });
  const concreteMat = new THREE.MeshStandardMaterial({ color: 0x3a3f52, roughness: 0.9 });
  const containerMats = [0xff7a3d, 0x00e5ff, 0xff2d78, 0x7dff9b, 0xffd23e].map(
    (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, metalness: 0.25 })
  );

  // ---- Ground: one big asphalt slab for the whole city ----
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(CFG.CITY_HALF * 2 + 60, CFG.CITY_HALF * 2 + 60), asphalt);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, 10);
  ground.receiveShadow = true;
  group.add(ground);

  // ---- Sidewalk strips along every street ----
  for (const s of STREET_LINES) {
    for (const along of [-1, 1]) {
      const stripV = new THREE.Mesh(new THREE.PlaneGeometry(2.4, CFG.CITY_HALF * 2), sidewalkMat);
      stripV.rotation.x = -Math.PI / 2;
      stripV.position.set(s + along * (STREET_HALF + 1.2), 0.02, 0);
      stripV.receiveShadow = true;
      group.add(stripV);
      const stripH = new THREE.Mesh(new THREE.PlaneGeometry(CFG.CITY_HALF * 2, 2.4), sidewalkMat);
      stripH.rotation.x = -Math.PI / 2;
      stripH.position.set(0, 0.02, s + along * (STREET_HALF + 1.2));
      stripH.receiveShadow = true;
      group.add(stripH);
    }
  }

  // ---- Road centre dashes ----
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xd8d8c8 });
  for (const s of STREET_LINES) {
    for (let t = -120; t <= 120; t += 12) {
      const d1 = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 4), dashMat);
      d1.rotation.x = -Math.PI / 2;
      d1.position.set(s, 0.03, t);
      group.add(d1);
      const d2 = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.5), dashMat);
      d2.rotation.x = -Math.PI / 2;
      d2.position.set(t, 0.03, s);
      group.add(d2);
    }
  }

  // ---- Buildings: one or two towers per block ----
  const windowTexA = makeWindowTexture(rng, 190);
  const windowTexB = makeWindowTexture(rng, 320);
  const windowTexC = makeWindowTexture(rng, 45);
  const winTexes = [windowTexA, windowTexB, windowTexC];
  const neonColors = [CFG.COL.neonCyan, CFG.COL.neonPink, CFG.COL.neonYellow, CFG.COL.neonGreen, CFG.COL.neonOrange];
  let signIdx = 0;

  const blockCenters = [];
  for (let i = 0; i < STREET_LINES.length - 1; i++) {
    for (let j = 0; j < STREET_LINES.length - 1; j++) {
      blockCenters.push({
        x: (STREET_LINES[i] + STREET_LINES[i + 1]) / 2,
        z: (STREET_LINES[j] + STREET_LINES[j + 1]) / 2,
      });
    }
  }

  for (const bc of blockCenters) {
    // Keep the four mission corners clear-ish (low buildings there).
    const nearCorner = Math.abs(Math.abs(bc.x) - 75) < 26 && Math.abs(Math.abs(bc.z) - 75) < 26;
    const towers = nearCorner ? 1 : rng.int(1, 2);
    for (let t = 0; t < towers; t++) {
      const w = rng.range(16, 26);
      const d = rng.range(16, 26);
      const h = nearCorner ? rng.range(7, 14) : rng.range(12, 46);
      const ox = towers === 1 ? 0 : (t === 0 ? -8 : 8);
      const oz = towers === 1 ? 0 : (t === 0 ? 6 : -6);
      const x = bc.x + ox;
      const z = bc.z + oz;
      const tex = rng.pick(winTexes);
      const mat = new THREE.MeshStandardMaterial({
        color: CFG.COL.buildingBase,
        roughness: 0.85,
        metalness: 0.1,
        emissive: 0xffffff,
        emissiveMap: tex,
        emissiveIntensity: 0.85,
      });
      const b = box(w, h, d, mat, x, h / 2, z, group);
      b.material = mat;
      colliders.push({ x0: x - w / 2, z0: z - d / 2, x1: x + w / 2, z1: z + d / 2 });
      // Neon roof edge.
      const edgeColor = rng.pick(neonColors);
      const edge = new THREE.Mesh(
        new THREE.BoxGeometry(w + 0.4, 0.35, d + 0.4),
        new THREE.MeshBasicMaterial({ color: edgeColor })
      );
      edge.position.set(x, h + 0.1, z);
      group.add(edge);
      // A neon sign on some towers.
      if (rng.chance(0.45)) {
        const text = CFG.SIGNS[signIdx++ % CFG.SIGNS.length];
        const signTex = makeSignTexture(text, '#' + edgeColor.toString(16).padStart(6, '0'));
        const sign = new THREE.Mesh(
          new THREE.PlaneGeometry(14, 3.5),
          new THREE.MeshBasicMaterial({ map: signTex, transparent: true })
        );
        sign.position.set(x, Math.min(h - 2, 12), z + d / 2 + 0.15);
        group.add(sign);
      }
    }
  }

  // ---- Harbor: water, pier, docks, containers, cranes ----
  const water = new THREE.Mesh(new THREE.PlaneGeometry(CFG.WATER_SIZE, 130), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, -0.4, CFG.HARBOR_Z + 65);
  group.add(water);

  // Pier deck along the south edge.
  const pier = box(240, 1.2, 18, concreteMat, 0, 0.6, CFG.HARBOR_Z + 4, group);
  pier.receiveShadow = true;
  colliders.push({ x0: -120, z0: CFG.HARBOR_Z - 5, x1: 120, z1: CFG.HARBOR_Z + 13 });

  // Shipping containers stacked on the docks.
  for (let i = 0; i < 14; i++) {
    const cx = -105 + i * 16 + rng.range(-3, 3);
    const cz = CFG.HARBOR_Z - 16 + (i % 2) * 8;
    const stack = rng.int(1, 3);
    for (let s = 0; s < stack; s++) {
      box(12, 2.6, 2.6, rng.pick(containerMats), cx, 1.5 + s * 2.7, cz, group);
    }
    if (i % 3 === 0) colliders.push({ x0: cx - 6, z0: cz - 2, x1: cx + 6, z1: cz + 2 });
  }

  // Two harbor cranes (simple gantry shapes).
  for (const cx of [-60, 60]) {
    const craneMat = new THREE.MeshStandardMaterial({ color: 0xffd23e, roughness: 0.6, metalness: 0.4 });
    box(2, 42, 2, craneMat, cx - 8, 21, CFG.HARBOR_Z + 2, group);
    box(2, 42, 2, craneMat, cx + 8, 21, CFG.HARBOR_Z + 2, group);
    box(20, 2, 2, craneMat, cx, 41, CFG.HARBOR_Z + 2, group);
    const jib = box(26, 1.4, 1.4, craneMat, cx + 12, 38, CFG.HARBOR_Z + 2, group);
    jib.rotation.z = -0.35;
    // Crane beacon light.
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff2b2b }));
    beacon.position.set(cx, 43, CFG.HARBOR_Z + 2);
    group.add(beacon);
  }

  // ---- Streetlights at intersections: bright lamp heads, a glow halo,
  // a cone of light and a warm pool of light on the road below, so the
  // night streets read as lit, not dead and dark. ----
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x222633, roughness: 0.6, metalness: 0.6 });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  const haloMat = new THREE.MeshBasicMaterial({
    color: 0xffe9a8, transparent: true, opacity: 0.28,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const coneMat = new THREE.MeshBasicMaterial({
    color: 0xffe9a8, transparent: true, opacity: 0.07,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  // Radial-gradient texture for the pool of light (shared by all lamps).
  const poolCanvas = document.createElement('canvas');
  poolCanvas.width = 128;
  poolCanvas.height = 128;
  const pg = poolCanvas.getContext('2d');
  const grad = pg.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255, 233, 168, 0.85)');
  grad.addColorStop(0.45, 'rgba(255, 210, 110, 0.35)');
  grad.addColorStop(1, 'rgba(255, 210, 110, 0)');
  pg.fillStyle = grad;
  pg.fillRect(0, 0, 128, 128);
  const poolTex = new THREE.CanvasTexture(poolCanvas);
  const poolMat = new THREE.MeshBasicMaterial({
    map: poolTex, transparent: true, opacity: 0.6,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  for (const sx of STREET_LINES) {
    for (const sz of STREET_LINES) {
      if (Math.abs(sx) > 100 || Math.abs(sz) > 100) continue;
      const px = sx + STREET_HALF + 2.4;
      const pz = sz + STREET_HALF + 2.4;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 6, 6), poleMat);
      pole.position.set(px, 3, pz);
      pole.castShadow = true;
      group.add(pole);
      // Bright lamp head.
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 10), lampMat);
      lamp.position.set(px, 6.1, pz);
      group.add(lamp);
      // Glow halo around the lamp.
      const halo = new THREE.Mesh(new THREE.SphereGeometry(1.25, 10, 10), haloMat);
      halo.position.set(px, 6.1, pz);
      group.add(halo);
      // Cone of light from the lamp down to the road.
      const cone = new THREE.Mesh(new THREE.ConeGeometry(4.2, 6, 12, 1, true), coneMat);
      cone.position.set(px, 3.1, pz);
      group.add(cone);
      // Warm pool of light on the ground below.
      const pool = new THREE.Mesh(new THREE.PlaneGeometry(13, 13), poolMat);
      pool.rotation.x = -Math.PI / 2;
      pool.position.set(px, 0.05, pz);
      group.add(pool);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 0.12), poleMat);
      arm.position.set(px - 0.7, 6, pz);
      group.add(arm);
    }
  }

  // ---- A few palm-ish harbor trees (simple cones on cylinders) ----
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3520, roughness: 1 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x1d7a4d, roughness: 0.9 });
  for (let i = 0; i < 10; i++) {
    const tx = rng.range(-115, 115);
    const tz = rng.range(-115, 115);
    // Keep trees off the roads.
    if (STREET_LINES.some((s) => Math.abs(tx - s) < 10) || STREET_LINES.some((s) => Math.abs(tz - s) < 10)) continue;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 4, 6), trunkMat);
    trunk.position.set(tx, 2, tz);
    trunk.castShadow = true;
    group.add(trunk);
    const top = new THREE.Mesh(new THREE.ConeGeometry(2.2, 3.5, 8), leafMat);
    top.position.set(tx, 5.4, tz);
    top.castShadow = true;
    group.add(top);
  }

  return { group, colliders, streetLines: STREET_LINES };
}

// Push a circle (player or car) out of building colliders. Returns true if pushed.
export function resolveColliders(pos, radius, colliders) {
  let pushed = false;
  for (const c of colliders) {
    const nx = Math.max(c.x0, Math.min(pos.x, c.x1));
    const nz = Math.max(c.z0, Math.min(pos.z, c.z1));
    const dx = pos.x - nx;
    const dz = pos.z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        pos.x = nx + (dx / d) * radius;
        pos.z = nz + (dz / d) * radius;
      } else {
        // Inside the box: push out along the smallest penetration axis.
        const pl = pos.x - c.x0, pr = c.x1 - pos.x, pt = pos.z - c.z0, pb = c.z1 - pos.z;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) pos.x = c.x0 - radius;
        else if (m === pr) pos.x = c.x1 + radius;
        else if (m === pt) pos.z = c.z0 - radius;
        else pos.z = c.z1 + radius;
      }
      pushed = true;
    }
  }
  return pushed;
}

// Clamp a position inside the playable city bounds.
export function clampToCity(pos, margin) {
  const lim = CFG.CITY_HALF + 6 - margin;
  pos.x = Math.max(-lim, Math.min(lim, pos.x));
  pos.z = Math.max(-lim, Math.min(lim, pos.z));
}
