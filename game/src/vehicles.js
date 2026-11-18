// NEON HARBOR — vehicles. Player car (arcade physics), traffic that drives the
// street grid, parked cars you can steal, and the car mesh builder.
// v2: a gold "marked" car for JOB 4 (Hot Wheels) — spawnMarkedCar() puts the
// unmistakable gold show car at its fixed spot by the harbor.
import * as THREE from 'three';
import { CFG } from './config.js';
import { resolveColliders, clampToCity } from './city.js';

// "POLICE" text texture (canvas, created once) for door/rear decals.
let _policeTextTex = null;
function policeTextTexture() {
  if (_policeTextTex) return _policeTextTex;
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 512, 128);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 92px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('POLICE', 256, 68);
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  _policeTextTex = tex;
  return tex;
}

export function makeCarMesh(color, opts = {}) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.7 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x0a1626, roughness: 0.15, metalness: 0.9 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x0c0e14, roughness: 0.9 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(CFG.CAR_LENGTH, 0.62, CFG.CAR_WIDTH), bodyMat);
  body.position.y = 0.55;
  body.castShadow = true;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.55, 1.7), glassMat);
  cabin.position.set(-0.25, 1.1, 0);
  cabin.castShadow = true;
  g.add(cabin);
  // Wheels.
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 12);
  wheelGeo.rotateX(Math.PI / 2);
  const wheelPos = [[1.45, 0.85], [1.45, -0.85], [-1.45, 0.85], [-1.45, -0.85]];
  const wheels = [];
  for (const [wx, wz] of wheelPos) {
    const w = new THREE.Mesh(wheelGeo, darkMat);
    w.position.set(wx, 0.36, wz);
    w.castShadow = true;
    g.add(w);
    wheels.push(w);
  }
  // Headlights / taillights. Mesh forward is local +X (headlights at +X,
  // taillights at -X), so callers must set rotation.y = heading - Math.PI/2
  // to face the direction of travel (three.js maps local +X to (cos φ, -sin φ)).
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff6c8 });
  for (const hz of [-0.62, 0.62]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.4), headMat);
    h.position.set(CFG.CAR_LENGTH / 2 + 0.02, 0.6, hz);
    g.add(h);
  }
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2b2b });
  for (const tz of [-0.62, 0.62]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.4), tailMat);
    t.position.set(-CFG.CAR_LENGTH / 2 - 0.02, 0.6, tz);
    g.add(t);
  }
  // Neon underglow.
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(CFG.CAR_LENGTH + 0.4, CFG.CAR_WIDTH + 0.5),
    new THREE.MeshBasicMaterial({ color: opts.glow || 0x00e5ff, transparent: true, opacity: 0.35 })
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.08;
  g.add(glow);

  // Police livery — bold black-and-white, built to read as a police car at a
  // glance (traffic cars have none of this: no black doors, no POLICE decals,
  // no push bar, no long nose, a smaller light bar).
  let lightBar = null;
  if (opts.police) {
    const blackMat = new THREE.MeshStandardMaterial({ color: 0x0a0c10, roughness: 0.5, metalness: 0.4 });
    const darkMetal = new THREE.MeshStandardMaterial({ color: 0x1a1d22, roughness: 0.4, metalness: 0.8 });
    // Black doors on both sides (the classic black-and-white livery) with a
    // white POLICE decal on each door.
    for (const sz of [-1, 1]) {
      const door = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.5, 0.04), blackMat);
      door.position.set(-0.1, 0.55, sz * (CFG.CAR_WIDTH / 2 + 0.02));
      g.add(door);
      const decal = new THREE.Mesh(
        new THREE.PlaneGeometry(1.9, 0.42),
        new THREE.MeshBasicMaterial({ map: policeTextTexture(), transparent: true })
      );
      decal.position.set(-0.1, 0.55, sz * (CFG.CAR_WIDTH / 2 + 0.05));
      if (sz < 0) decal.rotation.y = Math.PI;
      g.add(decal);
    }
    // Black hood panel (exposed body top ahead of the cabin).
    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.06, CFG.CAR_WIDTH - 0.1), blackMat);
    hood.position.set(1.5, 0.87, 0);
    g.add(hood);
    // Longer nose: a lower hood extension so the silhouette differs from
    // traffic (stays below the headlights so they stay visible).
    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.28, 1.8), bodyMat);
    nose.position.set(CFG.CAR_LENGTH / 2 + 0.3, 0.3, 0);
    nose.castShadow = true;
    g.add(nose);
    // Push bar / bull bar at the very front (below the headlights).
    const pushBar = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.28, 1.9), darkMetal);
    pushBar.position.set(CFG.CAR_LENGTH / 2 + 0.68, 0.32, 0);
    g.add(pushBar);
    for (const pz of [-0.85, 0.85]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 0.12), darkMetal);
      post.position.set(CFG.CAR_LENGTH / 2 + 0.68, 0.45, pz);
      g.add(post);
    }
    // POLICE on the rear, between the taillights.
    const rearDecal = new THREE.Mesh(
      new THREE.PlaneGeometry(1.1, 0.35),
      new THREE.MeshBasicMaterial({ map: policeTextTexture(), transparent: true })
    );
    rearDecal.position.set(-CFG.CAR_LENGTH / 2 - 0.04, 0.65, 0);
    rearDecal.rotation.y = -Math.PI / 2;
    g.add(rearDecal);
    // Bigger, brighter light bar on a dark base.
    const barBase = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.1, 2.1), darkMetal);
    barBase.position.set(-0.2, 1.42, 0);
    g.add(barBase);
    lightBar = new THREE.Group();
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.36, 1.0), new THREE.MeshBasicMaterial({ color: 0xff2b2b }));
    red.position.set(0, 0, -0.5);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.36, 1.0), new THREE.MeshBasicMaterial({ color: 0x2b6bff }));
    blue.position.set(0, 0, 0.5);
    lightBar.add(red);
    lightBar.add(blue);
    lightBar.position.set(-0.2, 1.62, 0);
    lightBar.userData = { red, blue };
    g.add(lightBar);
  }
  g.userData = { wheels, lightBar, glow };
  return g;
}

function makeCarRecord(mesh, pos, heading) {
  return {
    mesh,
    pos: pos.clone(),
    heading,
    speed: 0,
    steer: 0,
    color: 0xffffff,
    isPolice: false,
    isPlayer: false,
    parked: false,
    marked: false, // the gold show car for JOB 4 (Hot Wheels)
    wasPlayer: false, // was dropped by the player — re-entering it is free
    // traffic AI
    target: null,
    baseSpeed: 9,
    flashPhase: Math.random() * 10,
  };
}

// ---- Lane-aware traffic (right-hand traffic) ----
// Streets run on the grid lines [-100,-50,0,50,100]. A traffic car drives
// along one street in its right-hand lane (3.5 units right of the road
// centre), facing the direction of its lane, and at each intersection it
// goes straight, left or right (never a U-turn). This keeps every car on
// the correct side of the road, facing the way its lane goes.
const STREET_LINES = [-100, -50, 0, 50, 100];
const LANE_OFF = 3.5;
export const TRAFFIC_DIRS = {
  north: { x: 0, z: 1 },   // +z
  south: { x: 0, z: -1 },  // -z
  east: { x: 1, z: 0 },    // +x
  west: { x: -1, z: 0 },   // -x
};
const DIRS = [TRAFFIC_DIRS.north, TRAFFIC_DIRS.south, TRAFFIC_DIRS.east, TRAFFIC_DIRS.west];

export function dirHeading(dir) {
  return Math.atan2(dir.x, dir.z);
}

// Right-hand lane offset for a direction of travel.
export function laneOffset(dir) {
  return { x: dir.z * LANE_OFF, z: -dir.x * LANE_OFF };
}

// The next intersection along dir from (x,z), or null past the city edge.
function nextIntersection(x, z, dir) {
  if (dir.x === 1) {
    for (const s of STREET_LINES) if (s > x + 1) return { x: s, z };
  } else if (dir.x === -1) {
    for (let i = STREET_LINES.length - 1; i >= 0; i--) {
      if (STREET_LINES[i] < x - 1) return { x: STREET_LINES[i], z };
    }
  } else if (dir.z === 1) {
    for (const s of STREET_LINES) if (s > z + 1) return { x, z: s };
  } else {
    for (let i = STREET_LINES.length - 1; i >= 0; i--) {
      if (STREET_LINES[i] < z - 1) return { x, z: STREET_LINES[i] };
    }
  }
  return null;
}

export class CarManager {
  constructor(scene, rng, colliders) {
    this.scene = scene;
    this.rng = rng;
    this.colliders = colliders;
    this.traffic = [];
    this.parked = [];
    this.playerCar = null;
    this.carColors = [0xff2d78, 0x00e5ff, 0xffd23e, 0x7dff9b, 0xff7a3d, 0x9b7dff, 0xe8e8e8, 0x2b2f3a];
    this._spawnTraffic();
    this._spawnParked();
  }

  _spawnTraffic() {
    for (let i = 0; i < CFG.TRAFFIC_COUNT; i++) {
      const color = this.rng.pick(this.carColors);
      const mesh = makeCarMesh(color, { glow: 0x224455 });
      this.scene.add(mesh);
      // Pick a random street and a random direction along it, then start at
      // a random point along the street — in the right-hand lane, facing
      // the direction of travel (never a random heading).
      const vertical = this.rng.chance(0.5);
      const line = this.rng.pick(STREET_LINES);
      const dir = vertical
        ? this.rng.pick([TRAFFIC_DIRS.north, TRAFFIC_DIRS.south])
        : this.rng.pick([TRAFFIC_DIRS.east, TRAFFIC_DIRS.west]);
      const along = this.rng.range(-100, 100);
      const off = laneOffset(dir);
      const x = vertical ? line + off.x : along;
      const z = vertical ? along : line + off.z;
      const rec = makeCarRecord(mesh, new THREE.Vector3(x, 0, z), dirHeading(dir));
      rec.baseSpeed = this.rng.range(7.5, 10.5);
      rec.dir = dir;
      // First target: the next intersection along dir, in this lane.
      const nxt = nextIntersection(x, z, dir);
      if (nxt) rec.target = { x: nxt.x + off.x, z: nxt.z + off.z };
      else rec.target = { x: x + dir.x * 50, z: z + dir.z * 50 };
      this.traffic.push(rec);
    }
  }

  // Place a traffic car at a road point (x,z) driving in dir, in its
  // right-hand lane. Used by screenshot staging so traffic is in frame.
  stageTraffic(car, x, z, dir) {
    const off = laneOffset(dir);
    car.pos.set(x + off.x, 0, z + off.z);
    car.heading = dirHeading(dir);
    car.dir = dir;
    const nxt = nextIntersection(x, z, dir);
    if (nxt) car.target = { x: nxt.x + off.x, z: nxt.z + off.z };
    else car.target = { x: x + dir.x * 50 + off.x, z: z + dir.z * 50 + off.z };
    car.mesh.position.copy(car.pos);
    car.mesh.rotation.y = car.heading - Math.PI / 2;
  }

  // Spawn the gold marked car for JOB 4 (Hot Wheels) at its fixed spot by
  // the harbor. If it already exists (parked or player-driven), reuse it.
  // The gold paint + bright underglow make it unmistakable on the street.
  spawnMarkedCar() {
    const existing = [...this.parked, ...(this.playerCar ? [this.playerCar] : [])].find((c) => c.marked);
    if (existing) return existing;
    const spot = CFG.MARKED_CAR_SPOT;
    const mesh = makeCarMesh(CFG.MARKED_CAR_COLOR, { glow: 0xffd23e });
    this.scene.add(mesh);
    const rec = makeCarRecord(mesh, new THREE.Vector3(spot.x, 0, spot.z), 0);
    rec.parked = true;
    rec.color = CFG.MARKED_CAR_COLOR;
    rec.marked = true;
    rec.mesh.userData.glow.material.color.setHex(0xffd23e);
    rec.mesh.userData.glow.material.opacity = 0.55;
    rec.mesh.position.copy(rec.pos);
    rec.mesh.rotation.y = rec.heading - Math.PI / 2;
    this.parked.push(rec);
    return rec;
  }

  // Pick the next leg at an intersection (ix,iz): straight, left or right
  // (never a U-turn). Returns { dir, x, z } of the next intersection.
  _pickNextLeg(ix, iz, dir) {
    const straight = dir;
    const left = { x: -dir.z, z: dir.x };
    const right = { x: dir.z, z: -dir.x };
    const cands = [];
    const consider = (d, w) => {
      const n = nextIntersection(ix, iz, d);
      if (n) cands.push({ dir: d, x: n.x, z: n.z, w });
    };
    consider(straight, 5);
    consider(left, 2);
    consider(right, 2);
    if (!cands.length) return null;
    let total = 0;
    for (const c of cands) total += c.w;
    let r = Math.random() * total;
    for (const c of cands) {
      r -= c.w;
      if (r <= 0) return c;
    }
    return cands[0];
  }

  _spawnParked() {
    // Parked cars along street edges, clear of intersections and mission corners.
    const spots = [
      { x: -50, z: -32, h: 0 }, { x: 20, z: -57, h: Math.PI / 2 }, { x: 57, z: 20, h: 0 },
      { x: -7, z: 57, h: Math.PI / 2 }, { x: -57, z: -20, h: 0 }, { x: 82, z: -57, h: Math.PI / 2 },
      { x: 32, z: 82, h: 0 }, { x: -82, z: 32, h: Math.PI / 2 }, { x: 7, z: -82, h: 0 },
    ];
    for (const s of spots) {
      const color = this.rng.pick(this.carColors);
      const mesh = makeCarMesh(color, { glow: 0x113344 });
      this.scene.add(mesh);
      const rec = makeCarRecord(mesh, new THREE.Vector3(s.x, 0, s.z), s.h);
      rec.parked = true;
      rec.color = color;
      this.parked.push(rec);
    }
  }

  // Nearest parked car within range of a point, or null.
  nearestParked(pos, range) {
    let best = null;
    let bestD = range;
    for (const c of this.parked) {
      const d = Math.hypot(c.pos.x - pos.x, c.pos.z - pos.z);
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  }

  // Steal / enter a parked car: it becomes the player car.
  takeCar(rec) {
    const i = this.parked.indexOf(rec);
    if (i >= 0) this.parked.splice(i, 1);
    rec.parked = false;
    rec.isPlayer = true;
    rec.wasPlayer = false;
    rec.speed = 0;
    this.playerCar = rec;
    // Brighten the underglow so the player's car reads.
    rec.mesh.userData.glow.material.color.setHex(0x00e5ff);
    rec.mesh.userData.glow.material.opacity = 0.5;
    return rec;
  }

  // The player gets out: the car becomes parked where it stands.
  dropCar() {
    const rec = this.playerCar;
    if (!rec) return;
    rec.isPlayer = false;
    rec.parked = true;
    rec.wasPlayer = true;
    rec.speed = 0;
    this.parked.push(rec);
    this.playerCar = null;
  }

  // Arcade driving for the player car. throttle -1..1, steer -1..1.
  drivePlayer(dt, throttle, steer, brake) {
    const car = this.playerCar;
    if (!car) return 0;
    if (brake) {
      car.speed *= Math.max(0, 1 - 4 * dt);
      if (Math.abs(car.speed) < 0.5) car.speed = 0;
    } else {
      car.speed += throttle * CFG.CAR_ACCEL * dt;
      // Drag + rolling resistance.
      car.speed *= Math.max(0, 1 - 0.35 * dt);
      car.speed = Math.max(-CFG.CAR_REVERSE_SPEED, Math.min(CFG.CAR_TOP_SPEED, car.speed));
    }
    const spd = Math.abs(car.speed);
    const steerAuthority = spd > 0.5 ? Math.min(1, spd / 12) : 0;
    car.heading += steer * CFG.CAR_STEER * steerAuthority * (car.speed >= 0 ? 1 : -1) * dt;
    const fx = Math.sin(car.heading);
    const fz = Math.cos(car.heading);
    car.pos.x += fx * car.speed * dt;
    car.pos.z += fz * car.speed * dt;
    const hitWall = resolveColliders(car.pos, 2.1, this.colliders);
    if (hitWall && Math.abs(car.speed) > 9) {
      car.speed *= 0.45;
      return 1; // crashed hard
    }
    if (hitWall) car.speed *= 0.7;
    clampToCity(car.pos, 3);
    car.mesh.position.copy(car.pos);
    car.mesh.rotation.y = car.heading - Math.PI / 2;
    // Spin wheels.
    const spin = car.speed * dt * 1.4;
    for (const w of car.mesh.userData.wheels) w.rotation.z += spin;
    // Steer the front wheels visually.
    car.mesh.userData.wheels[0].rotation.y = steer * 0.35;
    car.mesh.userData.wheels[1].rotation.y = steer * 0.35;
    return 0;
  }

  // Reset the player car upright at its spot (after a flip or getting stuck).
  resetPlayerCar() {
    const car = this.playerCar;
    if (!car) return;
    car.speed = 0;
    car.mesh.position.copy(car.pos);
    car.mesh.rotation.set(0, car.heading - Math.PI / 2, 0);
  }

  updateTraffic(dt, allCars) {
    for (const car of this.traffic) {
      if (!car.target || !car.dir) continue;
      const dx = car.target.x - car.pos.x;
      const dz = car.target.z - car.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 4) {
        // Reached the intersection: pick the next leg (straight / left /
        // right) and retarget onto the new lane.
        const off = laneOffset(car.dir);
        const ix = car.target.x - off.x;
        const iz = car.target.z - off.z;
        const next = this._pickNextLeg(ix, iz, car.dir);
        if (next) {
          car.dir = next.dir;
          const noff = laneOffset(next.dir);
          car.target = { x: next.x + noff.x, z: next.z + noff.z };
        }
        continue;
      }
      const wantHeading = Math.atan2(dx, dz);
      let dh = wantHeading - car.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      car.heading += dh * Math.min(1, dt * 2.2);
      // Slow down if another car is close ahead.
      let speed = car.baseSpeed;
      for (const other of allCars) {
        if (other === car) continue;
        const ox = other.pos.x - car.pos.x;
        const oz = other.pos.z - car.pos.z;
        const od = Math.hypot(ox, oz);
        if (od < 7) {
          // Only brake for cars roughly ahead.
          const ahead = ox * Math.sin(car.heading) + oz * Math.cos(car.heading);
          if (ahead > 0) speed = Math.min(speed, 2.5);
        }
      }
      car.speed = speed;
      car.pos.x += Math.sin(car.heading) * speed * dt;
      car.pos.z += Math.cos(car.heading) * speed * dt;
      car.mesh.position.copy(car.pos);
      car.mesh.rotation.y = car.heading - Math.PI / 2;
      const spin = speed * dt * 1.4;
      for (const w of car.mesh.userData.wheels) w.rotation.z += spin;
    }
    // Parked cars just sit.
    for (const car of this.parked) {
      car.mesh.position.copy(car.pos);
      car.mesh.rotation.y = car.heading - Math.PI / 2;
    }
  }

  // Simple circle push between the player car and traffic/police cars.
  resolveCarCollisions(policeCars) {
    const pc = this.playerCar;
    if (!pc) return 0;
    let hit = 0;
    const others = [...this.traffic, ...policeCars];
    for (const o of others) {
      const dx = pc.pos.x - o.pos.x;
      const dz = pc.pos.z - o.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 4.2 && d > 0.01) {
        const push = (4.2 - d) / 2;
        const nx = dx / d;
        const nz = dz / d;
        pc.pos.x += nx * push;
        pc.pos.z += nz * push;
        o.pos.x -= nx * push;
        o.pos.z -= nz * push;
        pc.speed *= 0.82;
        o.speed = Math.max(0, o.speed * 0.8);
        hit = 1;
      }
    }
    return hit;
  }
}
