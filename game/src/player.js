// NEON HARBOR — the player on foot. A small procedural character (no imported
// model): torso, head, swinging arms and legs. Moves with WASD relative to the
// camera, runs with Shift, collides with buildings.
import * as THREE from 'three';
import { CFG } from './config.js';
import { resolveColliders, clampToCity } from './city.js';

export function makePersonMesh(jacketColor, pantsColor, skinColor) {
  const g = new THREE.Group();
  const jacket = new THREE.MeshStandardMaterial({ color: jacketColor, roughness: 0.8 });
  const pants = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.9 });
  const skin = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.7 });
  const capMat = new THREE.MeshStandardMaterial({ color: 0x11131c, roughness: 0.6 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), jacket);
  torso.position.y = 1.08;
  torso.castShadow = true;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.38, 0.38), skin);
  head.position.y = 1.66;
  head.castShadow = true;
  g.add(head);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.12, 0.44), capMat);
  cap.position.y = 1.88;
  g.add(cap);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.72, 0.24), pants);
  legL.position.set(-0.16, 0.36, 0);
  legL.castShadow = true;
  g.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.16;
  g.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.62, 0.18), jacket);
  armL.position.set(-0.4, 1.1, 0);
  armL.castShadow = true;
  g.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.4;
  g.add(armR);
  // A thin neon stripe on the jacket so the player reads at night.
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(0.64, 0.06, 0.36),
    new THREE.MeshBasicMaterial({ color: CFG.COL.neonCyan })
  );
  stripe.position.y = 1.3;
  g.add(stripe);
  g.userData = { legL, legR, armL, armR };
  return g;
}

// Kai — the player. His OWN silhouette, deliberately different from the NPC
// box-person: a long pale trench coat, a hood up, a backpack, and strong
// glowing cyan trim so he reads instantly as the hero, even at night.
// NPCs keep using makePersonMesh (see pedestrians.js); Kai never shares it.
export function makePlayerMesh() {
  const g = new THREE.Group();
  // Coat: a saturated sky-blue — light enough to stand out from the dark
  // night city, saturated enough to hold its hue under the magenta neon
  // (a pale/desaturated coat turns pink under this lighting and reads as an
  // NPC pink jacket). No NPC jacket uses this steel sky-blue.
  const coat = new THREE.MeshStandardMaterial({ color: 0x6fb3d9, roughness: 0.7 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1a2027, roughness: 0.85 });
  const packMat = new THREE.MeshStandardMaterial({ color: 0x27313d, roughness: 0.8 });
  const faceMat = new THREE.MeshStandardMaterial({ color: 0x0b0e14, roughness: 0.9 });
  const neon = new THREE.MeshBasicMaterial({ color: CFG.COL.neonCyan });

  // --- trench-coat skirt (flared, down to the knees) ---
  const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.58, 0.52), coat);
  skirt.position.y = 0.64;
  skirt.castShadow = true;
  g.add(skirt);
  // --- coat torso ---
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.78, 0.4), coat);
  torso.position.y = 1.28;
  torso.castShadow = true;
  g.add(torso);
  // --- raised coat collar around the neck ---
  const collar = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.16, 0.46), coat);
  collar.position.y = 1.72;
  g.add(collar);
  // --- glowing hem trim (bottom edge of the coat) ---
  const hem = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.09, 0.54), neon);
  hem.position.y = 0.38;
  g.add(hem);
  // --- glowing front placket (vertical strip down the coat torso) ---
  const placket = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.62, 0.03), neon);
  placket.position.set(0, 1.28, 0.215);
  g.add(placket);
  // --- hood UP (a bulky hood, not the NPC flat cap) ---
  const hood = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.54, 0.52), coat);
  hood.position.y = 1.95;
  hood.castShadow = true;
  g.add(hood);
  // --- face (dark opening inside the hood) ---
  const face = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.32, 0.12), faceMat);
  face.position.set(0, 1.95, 0.24);
  g.add(face);
  // --- glowing visor line across the face ---
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 0.03), neon);
  visor.position.set(0, 1.98, 0.31);
  g.add(visor);
  // --- backpack (bulk on the back silhouette) ---
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.58, 0.22), packMat);
  pack.position.set(0, 1.32, -0.3);
  pack.castShadow = true;
  g.add(pack);
  // --- glowing trim across the top of the backpack ---
  const packTrim = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.06, 0.24), neon);
  packTrim.position.set(0, 1.6, -0.3);
  g.add(packTrim);
  // --- arms (coat sleeves, swing with the walk cycle) ---
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.68, 0.2), coat);
  armL.position.set(-0.44, 1.28, 0);
  armL.castShadow = true;
  g.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.44;
  g.add(armR);
  // --- lower legs + boots (visible below the coat skirt) ---
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.44, 0.24), dark);
  legL.position.set(-0.17, 0.22, 0);
  legL.castShadow = true;
  g.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.17;
  g.add(legR);

  g.userData = { legL, legR, armL, armR };
  return g;
}

export class Player {
  constructor(scene) {
    this.mesh = makePlayerMesh();
    scene.add(this.mesh);
    this.pos = new THREE.Vector3(0, 0, 40);
    this.heading = Math.PI; // facing north (toward -z)
    this.walkPhase = 0;
    this.moving = false;
    this.visible = true;
  }

  // Move on foot. moveVec is {x, z} in camera space; camYaw is the camera yaw.
  // Returns the actual speed (0 when idle).
  update(dt, moveVec, camYaw, colliders, running) {
    const speed = running ? CFG.RUN_SPEED : CFG.WALK_SPEED;
    let vx = 0;
    let vz = 0;
    if (moveVec.x !== 0 || moveVec.z !== 0) {
      // Camera space: forward is -z rotated by camYaw.
      const sin = Math.sin(camYaw);
      const cos = Math.cos(camYaw);
      // moveVec.z is +1 forward, moveVec.x is +1 right.
      const fx = -sin * moveVec.z + cos * moveVec.x;
      const fz = -cos * moveVec.z - sin * moveVec.x;
      vx = fx * speed;
      vz = fz * speed;
      this.moving = true;
      const targetHeading = Math.atan2(fx, fz);
      // Turn toward movement direction.
      let dh = targetHeading - this.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      this.heading += dh * Math.min(1, dt * 12);
    } else {
      this.moving = false;
    }
    this.pos.x += vx * dt;
    this.pos.z += vz * dt;
    resolveColliders(this.pos, CFG.PLAYER_RADIUS, colliders);
    clampToCity(this.pos, 2);
    // Walk cycle.
    if (this.moving) this.walkPhase += dt * (running ? 11 : 7);
    const swing = this.moving ? Math.sin(this.walkPhase) * 0.55 : 0;
    const u = this.mesh.userData;
    u.legL.rotation.x = swing;
    u.legR.rotation.x = -swing;
    u.armL.rotation.x = -swing * 0.8;
    u.armR.rotation.x = swing * 0.8;
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.heading;
    this.mesh.visible = this.visible;
    return this.moving ? speed : 0;
  }

  setPosition(x, z, heading) {
    this.pos.set(x, 0, z);
    if (heading !== undefined) this.heading = heading;
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.heading;
  }
}
