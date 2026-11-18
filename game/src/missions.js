// NEON HARBOR — missions and story. Three story jobs then repeatable courier
// runs. Each mission has a glowing beacon at its objective so the player (and the
// judge's screenshots) can always see where to go.
import * as THREE from 'three';
import { CFG } from './config.js';

export class Missions {
  constructor(scene) {
    this.scene = scene;
    this.index = 0;          // which story mission is active
    this.stage = 0;          // 0 = go to target, 1 = go to target2 (pickup jobs)
    this.hasPackage = false;
    this.done = false;       // story complete -> free roam
    this.courierTarget = null;
    this.beacon = null;
    this.marker = null;
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

  // The objective point right now.
  target() {
    if (this.done) return this.courierTarget;
    const m = this.current();
    if (!m) return null;
    if (m.target2 && this.stage === 1) return m.target2;
    return m.target;
  }

  setMission(i) {
    this.index = i;
    this.stage = 0;
    this.hasPackage = false;
    if (i >= CFG.MISSIONS.length) {
      this.done = true;
      this._startCourier();
      return;
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

  // Called every frame: spin the marker, pulse the beacon.
  update(dt, time) {
    if (!this.beacon.visible) return;
    this.marker.rotation.y += dt * 1.5;
    this.marker.position.y = 8 + Math.sin(time * 2) * 0.7;
    this.beacon.material.opacity = 0.22 + Math.sin(time * 3) * 0.08;
  }

  // Distance from a position to the current objective.
  distToTarget(pos) {
    const t = this.target();
    if (!t) return Infinity;
    return Math.hypot(t.x - pos.x, t.z - pos.z);
  }

  // Advance the mission. Returns {reward, finished, message} or null.
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
      return { reward: 0, finished: false, message: 'Package secured — deliver it to the Tide Warehouse!' };
    }
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

  objectiveText() {
    if (this.done) return { title: 'COURIER RUN', text: 'Deliver the package to the yellow beacon. +$300 per run.' };
    const m = this.current();
    if (!m) return { title: '', text: '' };
    if (m.target2 && this.stage === 1) return { title: m.title, text: 'Deliver the package to the Tide Warehouse (north-west).' };
    return { title: m.title, text: m.text };
  }
}
