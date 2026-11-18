// NEON HARBOR — wanted level, police cars, and the police helicopter.
// Crimes raise stars; police cars spawn at the city edge and chase the
// player; touch one too long and you are busted. At wanted 3+ a helicopter
// joins the hunt: it hovers above the player, follows them, and pins them
// in a visible spotlight cone.
import * as THREE from 'three';
import { CFG } from './config.js';
import { makeCarMesh } from './vehicles.js';
import { resolveColliders, clampToCity } from './city.js';

function makeHeliMesh() {
  const g = new THREE.Group();
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xe8edf2, roughness: 0.35, metalness: 0.6 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x14181f, roughness: 0.5, metalness: 0.5 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x0a2036, roughness: 0.15, metalness: 0.9 });
  // Body: a chunky fuselage with a dark police stripe.
  const body = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.3, 1.7), whiteMat);
  body.position.y = 0;
  body.castShadow = true;
  g.add(body);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(3.42, 0.34, 1.72), darkMat);
  stripe.position.y = -0.18;
  g.add(stripe);
  // Nose glass.
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.8, 1.5), glassMat);
  nose.position.set(1.85, 0.1, 0);
  g.add(nose);
  // Tail boom + tail fin.
  const tail = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.5, 0.5), whiteMat);
  tail.position.set(-3.0, 0.35, 0);
  g.add(tail);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.3, 0.12), darkMat);
  fin.position.set(-4.4, 0.8, 0);
  g.add(fin);
  // Tail rotor (small vertical disc, spins).
  const tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.1, 0.08), darkMat);
  tailRotor.position.set(-4.4, 0.5, 0.32);
  g.add(tailRotor);
  // Main rotor: two long blades on a mast, spinning around Y.
  const rotor = new THREE.Group();
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.7, 8), darkMat);
  mast.position.y = 0.95;
  rotor.add(mast);
  const bladeMat = new THREE.MeshBasicMaterial({ color: 0x22262e });
  for (const bx of [-3.4, 3.4]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.06, 0.42), bladeMat);
    blade.position.set(bx, 1.3, 0);
    rotor.add(blade);
  }
  g.add(rotor);
  // Skids.
  for (const sz of [-0.8, 0.8]) {
    const skid = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.08, 0.12), darkMat);
    skid.position.set(0, -0.95, sz);
    g.add(skid);
  }
  // Searchlight under the nose + red/blue strobes on the belly.
  const lamp = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xfff6c8 })
  );
  lamp.position.set(1.4, -0.8, 0);
  g.add(lamp);
  const strobeR = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.14, 0.3), new THREE.MeshBasicMaterial({ color: 0xff2b2b }));
  strobeR.position.set(0, -0.72, -0.5);
  g.add(strobeR);
  const strobeB = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.14, 0.3), new THREE.MeshBasicMaterial({ color: 0x2b6bff }));
  strobeB.position.set(0, -0.72, 0.5);
  g.add(strobeB);
  g.userData = { rotor, tailRotor, strobeR, strobeB };
  return g;
}

export class Police {
  constructor(scene, rng, colliders) {
    this.scene = scene;
    this.rng = rng;
    this.colliders = colliders;
    this.wanted = 0;
    this.cars = [];
    this.bustTimer = 0;
    this.decayTimer = 0;
    this.flashT = 0;
    // Helicopter (null until wanted reaches HELI_MIN_WANTED).
    this.heli = null;
    this.heliCone = null;
    this.heliPool = null;
    this.heliPos = new THREE.Vector3(0, CFG.HELI_HEIGHT, 0);
    // When true (set by the wanted screenshot staging), the helicopter
    // snaps exactly to its hover point each frame instead of lerping, so
    // it sits at a deterministic spot in the frame for the photo.
    this.heliLock = false;
  }

  addCrime(levels) {
    if (this.wanted >= CFG.WANTED_MAX) return;
    this.wanted = Math.min(CFG.WANTED_MAX, this.wanted + levels);
    this.decayTimer = 0;
  }

  // Desired number of active police cars for the current wanted level.
  _desiredCount() {
    if (this.wanted <= 0) return 0;
    return Math.min(this.wanted + 1, 5);
  }

  _spawnCar(playerPos) {
    // Spawn at a city edge, away from the player.
    const edges = [
      { x: -115, z: -115 }, { x: 115, z: -115 }, { x: -115, z: 115 }, { x: 115, z: 115 },
      { x: 0, z: -115 }, { x: 0, z: 115 }, { x: -115, z: 0 }, { x: 115, z: 0 },
    ];
    let best = edges[0];
    let bestD = -1;
    for (const e of edges) {
      const d = Math.hypot(e.x - playerPos.x, e.z - playerPos.z);
      if (d > bestD) { bestD = d; best = e; }
    }
    const mesh = makeCarMesh(0xdfe6ee, { police: true, glow: 0xff2b2b });
    this.scene.add(mesh);
    const car = {
      mesh,
      pos: new THREE.Vector3(best.x, 0, best.z),
      heading: Math.atan2(playerPos.x - best.x, playerPos.z - best.z),
      speed: 0,
      flashPhase: this.rng.range(0, 10),
    };
    this.cars.push(car);
    return car;
  }

  // Spawn the helicopter above the player with its spotlight cone.
  _spawnHeli(playerPos) {
    const mesh = makeHeliMesh();
    this.scene.add(mesh);
    // Spotlight cone: apex at the helicopter, wide base on the ground.
    // ConeGeometry puts the apex at +height/2, so hang it below the heli.
    const coneH = CFG.HELI_HEIGHT;
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(9, coneH, 20, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xfff2b0, transparent: true, opacity: 0.16,
        side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
      })
    );
    cone.position.y = -coneH / 2;
    mesh.add(cone);
    // Pool of light on the ground under the player — small and subtle, so
    // it reads as a spotlight without washing out the road.
    const pool = new THREE.Mesh(
      new THREE.CircleGeometry(5, 24),
      new THREE.MeshBasicMaterial({
        color: 0xfff2b0, transparent: true, opacity: 0.12,
        depthWrite: false, blending: THREE.AdditiveBlending,
      })
    );
    pool.rotation.x = -Math.PI / 2;
    pool.position.y = 0.12;
    this.scene.add(pool);
    this.heli = mesh;
    this.heliCone = cone;
    this.heliPool = pool;
    this.heliPos.set(playerPos.x, CFG.HELI_HEIGHT, playerPos.z);
    mesh.position.copy(this.heliPos);
  }

  _removeHeli() {
    if (!this.heli) return;
    this.scene.remove(this.heli);
    this.scene.remove(this.heliPool);
    this.heli = null;
    this.heliCone = null;
    this.heliPool = null;
  }

  // Remove all police cars and the helicopter (after busted / wanted cleared).
  clear() {
    for (const c of this.cars) this.scene.remove(c.mesh);
    this.cars = [];
    this._removeHeli();
    this.wanted = 0;
    this.bustTimer = 0;
    this.decayTimer = 0;
  }

  update(dt, playerPos, playerSpeed, onFoot, playerHeading) {
    // Spawn / despawn to match wanted level.
    const want = this._desiredCount();
    while (this.cars.length < want) this._spawnCar(playerPos);
    while (this.cars.length > want) {
      const c = this.cars.pop();
      this.scene.remove(c.mesh);
    }
    this.flashT += dt;

    let nearestDist = Infinity;
    for (const car of this.cars) {
      const dx = playerPos.x - car.pos.x;
      const dz = playerPos.z - car.pos.z;
      const dist = Math.hypot(dx, dz);
      nearestDist = Math.min(nearestDist, dist);
      if (car.pinned && car.pinOffset) {
        // Screenshot staging (wanted shot): hold a fixed formation offset
        // beside the player instead of chasing. The chase AI closes in
        // and swarms the player within a second, crowding the frame; the
        // formation pin keeps the police flanking at a readable distance
        // for the photo. Only set by shots.js staging, never in gameplay.
        car.pos.set(playerPos.x + car.pinOffset.x, 0, playerPos.z + car.pinOffset.z);
        car.heading = playerHeading;
        car.speed = 0;
      } else {
        // Chase: steer toward the player, faster than the player's top speed.
        const wantHeading = Math.atan2(dx, dz);
        let dh = wantHeading - car.heading;
        while (dh > Math.PI) dh -= Math.PI * 2;
        while (dh < -Math.PI) dh += Math.PI * 2;
        car.heading += dh * Math.min(1, dt * 2.6);
        const targetSpeed = dist > 25 ? CFG.POLICE_TOP_SPEED : CFG.POLICE_TOP_SPEED * 0.82;
        car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 0.9);
        car.pos.x += Math.sin(car.heading) * car.speed * dt;
        car.pos.z += Math.cos(car.heading) * car.speed * dt;
        resolveColliders(car.pos, 2.1, this.colliders);
        clampToCity(car.pos, 3);
      }
      car.mesh.position.copy(car.pos);
      car.mesh.rotation.y = car.heading - Math.PI / 2;
      const spin = car.speed * dt * 1.4;
      for (const w of car.mesh.userData.wheels) w.rotation.z += spin;
      // Flash the light bar (alternate red/blue).
      const lb = car.mesh.userData.lightBar;
      if (lb) {
        const on = Math.sin(this.flashT * 10 + car.flashPhase) > 0;
        lb.userData.red.material.color.setHex(on ? 0xff2b2b : 0x550000);
        lb.userData.blue.material.color.setHex(on ? 0x0a1a55 : 0x2b6bff);
      }
    }

    // --- Helicopter: in at wanted 3+, out below it. ---
    if (this.wanted >= CFG.HELI_MIN_WANTED && !this.heli) {
      this._spawnHeli(playerPos);
    } else if (this.wanted < CFG.HELI_MIN_WANTED && this.heli) {
      this._removeHeli();
    }
    if (this.heli) {
      // Hover ahead of the player (in their direction of travel) so the
      // chase camera catches it, and track the player as they move.
      // When heliLock is set (wanted screenshot), snap exactly to the
      // hover point — no lag, so the heli is deterministically in frame.
      const hd = playerHeading || 0;
      const tx = playerPos.x + Math.sin(hd) * CFG.HELI_AHEAD;
      const tz = playerPos.z + Math.cos(hd) * CFG.HELI_AHEAD;
      const k = this.heliLock ? 1 : Math.min(1, dt * CFG.HELI_FOLLOW);
      this.heliPos.x += (tx - this.heliPos.x) * k;
      this.heliPos.z += (tz - this.heliPos.z) * k;
      this.heliPos.y = CFG.HELI_HEIGHT + Math.sin(this.flashT * 1.4) * 0.8;
      this.heli.position.copy(this.heliPos);
      this.heli.rotation.y = hd - Math.PI / 2;
      // Spin the rotors; pulse the cone and strobes.
      const u = this.heli.userData;
      u.rotor.rotation.y += dt * 22;
      u.tailRotor.rotation.x += dt * 30;
      const on = Math.sin(this.flashT * 8) > 0;
      u.strobeR.material.color.setHex(on ? 0xff2b2b : 0x550000);
      u.strobeB.material.color.setHex(on ? 0x0a1a55 : 0x2b6bff);
      this.heliCone.material.opacity = 0.13 + Math.sin(this.flashT * 3) * 0.04;
      // The light pool stays on the player on the ground.
      this.heliPool.position.x = playerPos.x;
      this.heliPool.position.z = playerPos.z;
      this.heliPool.material.opacity = 0.10 + Math.sin(this.flashT * 3) * 0.03;
    }

    // Bust check: a police car touching the player.
    if (this.cars.length > 0 && nearestDist < 3.6) {
      this.bustTimer += dt;
    } else {
      this.bustTimer = Math.max(0, this.bustTimer - dt * 2);
    }
    const busted = this.bustTimer >= CFG.BUST_TIME;

    // Wanted decay: no crime and no police nearby for a while.
    if (this.wanted > 0 && nearestDist > 45) {
      this.decayTimer += dt;
      if (this.decayTimer >= CFG.WANTED_DECAY_SEC) {
        this.wanted -= 1;
        this.decayTimer = 0;
      }
    } else {
      this.decayTimer = 0;
    }
    return { busted, nearestDist };
  }
}
