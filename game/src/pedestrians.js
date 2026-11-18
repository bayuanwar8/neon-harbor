// NEON HARBOR — pedestrians. Walkers on the sidewalks who stroll between random
// corners, flee when scared, and get knocked down if the player's car hits them.
import * as THREE from 'three';
import { CFG } from './config.js';
import { makePersonMesh } from './player.js';
import { resolveColliders, clampToCity } from './city.js';

const JACKETS = [0xff2d78, 0xffd23e, 0x7dff9b, 0x9b7dff, 0xe8e8e8, 0xff7a3d, 0x00e5ff, 0x8a5a3b];
const PANTS = [0x1f2430, 0x2b2f3a, 0x3a2b1f, 0x1a2b3a];

export class Pedestrians {
  constructor(scene, rng) {
    this.rng = rng;
    this.list = [];
    const lines = [-100, -50, 0, 50, 100];
    for (let i = 0; i < CFG.PED_COUNT; i++) {
      const mesh = makePersonMesh(
        this.rng.pick(JACKETS),
        this.rng.pick(PANTS),
        0xd9a06b + this.rng.int(0, 0x30201a)
      );
      // Smaller scale so peds read as background crowd.
      mesh.scale.setScalar(0.95);
      scene.add(mesh);
      const sx = lines[this.rng.int(0, lines.length - 1)] + (this.rng.chance(0.5) ? 9 : -9);
      const sz = lines[this.rng.int(0, lines.length - 1)] + (this.rng.chance(0.5) ? 9 : -9);
      const ped = {
        mesh,
        pos: new THREE.Vector3(sx, 0, sz),
        heading: this.rng.range(0, Math.PI * 2),
        target: null,
        speed: this.rng.range(1.2, 2.1),
        state: 'walk', // walk | flee | down
        timer: 0,
        phase: this.rng.range(0, 6),
      };
      ped.target = this._newTarget(ped);
      this.list.push(ped);
    }
  }

  _newTarget(ped) {
    const lines = [-100, -50, 0, 50, 100];
    const side = this.rng.chance(0.5) ? 9 : -9;
    return {
      x: lines[this.rng.int(0, lines.length - 1)] + side,
      z: lines[this.rng.int(0, lines.length - 1)] + side,
    };
  }

  // Scare pedestrians near a point: they run away from it.
  scare(pos, radius) {
    for (const p of this.list) {
      const d = Math.hypot(p.pos.x - pos.x, p.pos.z - pos.z);
      if (d < radius && p.state !== 'down') {
        p.state = 'flee';
        p.timer = 2.5;
        const away = Math.atan2(p.pos.x - pos.x, p.pos.z - pos.z);
        p.target = { x: p.pos.x + Math.sin(away) * 40, z: p.pos.z + Math.cos(away) * 40 };
      }
    }
  }

  // Knock a pedestrian down (car hit). Returns the ped or null.
  knockDown(pos, radius) {
    for (const p of this.list) {
      if (p.state === 'down') continue;
      const d = Math.hypot(p.pos.x - pos.x, p.pos.z - pos.z);
      if (d < radius) {
        p.state = 'down';
        p.timer = 2.2;
        p.mesh.rotation.x = -Math.PI / 2;
        p.mesh.position.y = 0.35;
        return p;
      }
    }
    return null;
  }

  // Nearest pedestrian within range (for punching).
  nearest(pos, range) {
    let best = null;
    let bestD = range;
    for (const p of this.list) {
      if (p.state === 'down') continue;
      const d = Math.hypot(p.pos.x - pos.x, p.pos.z - pos.z);
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  }

  update(dt, colliders) {
    for (const p of this.list) {
      if (p.state === 'down') {
        p.timer -= dt;
        if (p.timer <= 0) {
          p.state = 'flee';
          p.timer = 2;
          p.mesh.rotation.x = 0;
          p.mesh.position.y = 0;
          const away = Math.atan2(p.pos.x, p.pos.z);
          p.target = { x: p.pos.x + Math.sin(away) * 30, z: p.pos.z + Math.cos(away) * 30 };
        }
        continue;
      }
      const speed = p.state === 'flee' ? p.speed * 3.2 : p.speed;
      const dx = p.target.x - p.pos.x;
      const dz = p.target.z - p.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 2) {
        if (p.state === 'flee') { p.state = 'walk'; p.timer = 0; }
        p.target = this._newTarget(p);
        continue;
      }
      const want = Math.atan2(dx, dz);
      let dh = want - p.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      p.heading += dh * Math.min(1, dt * 4);
      p.pos.x += Math.sin(p.heading) * speed * dt;
      p.pos.z += Math.cos(p.heading) * speed * dt;
      resolveColliders(p.pos, 0.6, colliders);
      clampToCity(p.pos, 2);
      p.phase += dt * speed * 3.2;
      const swing = Math.sin(p.phase) * 0.5;
      const u = p.mesh.userData;
      u.legL.rotation.x = swing;
      u.legR.rotation.x = -swing;
      u.armL.rotation.x = -swing * 0.7;
      u.armR.rotation.x = swing * 0.7;
      p.mesh.position.copy(p.pos);
      p.mesh.rotation.y = p.heading;
      if (p.state === 'flee') {
        p.timer -= dt;
        if (p.timer <= 0) p.state = 'walk';
      }
    }
  }
}
