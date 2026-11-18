// NEON HARBOR — wanted level and police. Crimes raise stars; police cars spawn
// at the city edge and chase the player; touch one too long and you are busted.
import * as THREE from 'three';
import { CFG } from './config.js';
import { makeCarMesh } from './vehicles.js';
import { resolveColliders, clampToCity } from './city.js';

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

  // Remove all police cars (after busted / wanted cleared).
  clear() {
    for (const c of this.cars) this.scene.remove(c.mesh);
    this.cars = [];
    this.wanted = 0;
    this.bustTimer = 0;
    this.decayTimer = 0;
  }

  update(dt, playerPos, playerSpeed, onFoot) {
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
