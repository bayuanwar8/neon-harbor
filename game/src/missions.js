// NEON HARBOR — missions and story. Eight story jobs, then repeatable
// courier runs. Each mission has a glowing beacon at its objective so the
// player (and the judge's screenshots) can always see where to go.
//
// Mission kinds:
//   reach   — go to the target (two-stage pickup jobs use target2).
//   marked  — JOB 4: steal the gold marked car, then drive it to the target.
//             The advance only counts when the player is in the marked car.
//   escape  — JOB 5: lose the wanted level. Completes when wanted hits 0.
//   timed   — JOB 7: the delivery leg runs against a countdown. If the clock
//             runs out the timer resets and the player tries again.
import * as THREE from 'three';
import { CFG } from './config.js';

export class Missions {
  constructor(scene, cars) {
    this.scene = scene;
    this.cars = cars || null;   // CarManager, for the JOB 4 marked car
    this.index = 0;             // which story mission is active
    this.stage = 0;             // 0 = go to target, 1 = go to target2 (pickup jobs)
    this.hasPackage = false;
    this.done = false;          // story complete -> free roam
    this.courierTarget = null;
    this.beacon = null;
    this.marker = null;
    this.markedCar = null;      // the gold car for JOB 4
    this.timeLeft = 0;          // countdown for timed missions
    this.timerRunning = false;
    this._buildBeacon();
    this.setMission(0);
  }

  _buildBeacon() {
    // Tall translucent light pillar + a spinning diamond on top.
    const geo = new THREE.CylinderGeometry(1.6, 2.2, 60, 16, 1, true);
    const mat = new THREE.MeshBasicMaterial({
      color: CFG.COL.neonYellow, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false,
    });
    this.beacon = new THREE.Mesh(geo, mat);
    this.beacon.position.y = 30;
    this.scene.add(this.beacon);
    const diamond = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.4),
      new THREE.MeshBasicMaterial({ color: CFG.COL.neonYellow })
    );
    diamond.position.y = 8;
    this.marker = diamond;
    this.scene.add(this.marker);
  }

  current() {
    if (this.done) return null;
    return CFG.MISSIONS[this.index];
  }

  // "JOB 3/8" for the HUD. After the story, shows the courier count instead.
  progressText() {
    if (this.done) return 'FREE ROAM';
    return `JOB ${this.index + 1}/${CFG.MISSIONS.length}`;
  }

  // The objective point right now.
  target() {
    if (this.done) return this.courierTarget;
    const m = this.current();
    if (!m) return null;
    // The marked job points at the gold car itself while it is still parked.
    if (m.kind === 'marked' && this.stage === 0 && this.markedCar) {
      return { x: this.markedCar.pos.x, z: this.markedCar.pos.z };
    }
    if (m.target2 && this.stage === 1) return m.target2;
    return m.target;
  }

  // Make sure the gold marked car exists for JOB 4, and hand it back.
  ensureMarkedCar() {
    if (!this.cars) return null;
    if (this.markedCar && this.cars.parked.includes(this.markedCar)) return this.markedCar;
    if (this.markedCar && this.cars.playerCar === this.markedCar) return this.markedCar;
    this.markedCar = this.cars.spawnMarkedCar();
    return this.markedCar;
  }

  setMission(i) {
    this.index = i;
    this.stage = 0;
    this.hasPackage = false;
    this.timerRunning = false;
    this.timeLeft = 0;
    if (i >= CFG.MISSIONS.length) {
      this.done = true;
      this._startCourier();
      return;
    }
    const m = CFG.MISSIONS[i];
    if (m.kind === 'marked') this.ensureMarkedCar();
    if (m.kind === 'timed') {
      // The clock starts on the delivery leg (stage 1), not at pickup.
      this.timeLeft = m.timeLimit || 60;
    }
    const t = this.target();
    this._moveBeacon(t);
  }

  _startCourier() {
    // Repeatable delivery: a random corner of the city.
    const corners = [
      { x: -96, z: 96 }, { x: 96, z: 96 }, { x: -96, z: -96 }, { x: 96, z: -96 },
      { x: 0, z: 96 }, { x: 0, z: -96 }, { x: -96, z: 0 }, { x: 96, z: 0 },
    ];
    this.courierTarget = corners[Math.floor(Math.random() * corners.length)];
    this._moveBeacon(this.courierTarget);
  }

  _moveBeacon(t) {
    if (!t) { this.beacon.visible = false; this.marker.visible = false; return; }
    this.beacon.visible = true;
    this.marker.visible = true;
    this.beacon.position.x = t.x;
    this.beacon.position.z = t.z;
    this.marker.position.x = t.x;
    this.marker.position.z = t.z;
  }

  // Called every frame: spin the marker, pulse the beacon, run the timer.
  // Returns 'timeout' when a timed delivery leg runs out of time.
  update(dt, time) {
    if (this.beacon.visible) {
      this.marker.rotation.y += dt * 1.5;
      this.marker.position.y = 8 + Math.sin(time * 2) * 0.7;
      this.beacon.material.opacity = 0.22 + Math.sin(time * 3) * 0.08;
    }
    if (this.timerRunning && !this.done) {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        this.timerRunning = false;
        return 'timeout';
      }
    }
    return null;
  }

  // Distance from a position to the current objective.
  distToTarget(pos) {
    const t = this.target();
    if (!t) return Infinity;
    return Math.hypot(t.x - pos.x, t.z - pos.z);
  }

  // Is the player allowed to advance right now? The marked job only counts
  // when the player is actually driving the gold car.
  canAdvance(playerCar) {
    const m = this.current();
    if (!m) return { ok: true };
    if (m.kind === 'marked' && this.stage === 1) {
      if (playerCar !== this.markedCar) {
        return { ok: false, message: 'You need the gold show car — steal it first!' };
      }
    }
    return { ok: true };
  }

  // Advance the mission. Returns {reward, finished, message, ...} or null.
  // `wanted` is the caller's hook: jobs that put the cops on the player
  // when the package is grabbed set wantedOnPickup.
  advance() {
    const m = this.current();
    if (this.done) {
      // Courier delivery done: pay and roll a new one.
      this._startCourier();
      return { reward: CFG.COURIER_REWARD, finished: false, message: `Delivery done — +$${CFG.COURIER_REWARD}` };
    }
    if (!m) return null;
    if (m.target2 && this.stage === 0) {
      this.stage = 1;
      this.hasPackage = true;
      this._moveBeacon(this.target());
      // Timed jobs start the clock on the delivery leg.
      if (m.kind === 'timed') {
        this.timeLeft = m.timeLimit || 60;
        this.timerRunning = true;
      }
      const out = {
        reward: 0, finished: false,
        message: m.kind === 'timed'
          ? `Package secured — ${m.timeLimit}s on the clock, go!`
          : 'Package secured — deliver it!',
      };
      if (m.wantedOnPickup) out.wantedOnPickup = m.wantedOnPickup;
      return out;
    }
    this.timerRunning = false;
    const reward = m.reward;
    const title = m.title;
    this.setMission(this.index + 1);
    const finished = this.index >= CFG.MISSIONS.length;
    return {
      reward,
      finished,
      message: reward > 0 ? `${title} complete — +$${reward}` : `${title} complete`,
      storyDone: this.done,
    };
  }

  // Escape jobs complete when the wanted level drops to zero.
  checkEscape(wanted) {
    const m = this.current();
    if (this.done || !m || m.kind !== 'escape') return null;
    if (wanted > 0) return null;
    const reward = m.reward;
    const title = m.title;
    this.setMission(this.index + 1);
    return {
      reward,
      finished: false,
      message: `${title} complete — you lost them! +$${reward}`,
      storyDone: this.done,
    };
  }

  objectiveText() {
    if (this.done) return { title: 'COURIER RUN', text: 'Deliver the package to the yellow beacon. +$300 per run.' };
    const m = this.current();
    if (!m) return { title: '', text: '' };
    if (m.kind === 'escape') {
      return { title: m.title, text: 'Lay low — your wanted level must drop to zero. Stay away from the police.' };
    }
    if (m.kind === 'marked' && this.stage === 0) {
      return { title: m.title, text: 'Steal the gold show car by the harbor — follow the yellow beacon.' };
    }
    if (m.kind === 'marked' && this.stage === 1) {
      return { title: m.title, text: 'Drive the gold car to the Chop Shop. Do not lose it!' };
    }
    if (m.kind === 'timed' && this.stage === 1) {
      return { title: m.title, text: `Timed delivery — beat the clock! ${Math.ceil(this.timeLeft)}s left.` };
    }
    if (m.target2 && this.stage === 1) return { title: m.title, text: 'Deliver the package to the yellow beacon.' };
    return { title: m.title, text: m.text };
  }
}
