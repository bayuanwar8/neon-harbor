// NEON HARBOR — melee combat. The player punches (F) on foot: a short-range
// swing that knocks a nearby pedestrian down and scares the crowd. Hitting
// someone is a crime, so it raises the wanted level.
import { CFG } from './config.js';

export class Combat {
  constructor() {
    this.cooldown = 0;
    this.swing = 0; // 0..1 swing animation progress (1 = just swung)
  }

  update(dt) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.swing = Math.max(0, this.swing - dt * 2.4);
  }

  get ready() { return this.cooldown <= 0; }

  // Try a punch from the player's position and heading.
  // Returns the pedestrian hit, or null.
  tryPunch(playerPos, heading, pedestrians) {
    if (!this.ready) return null;
    this.cooldown = CFG.PUNCH_COOLDOWN;
    this.swing = 1;
    const fx = Math.sin(heading);
    const fz = Math.cos(heading);
    const ped = pedestrians.nearest(playerPos, CFG.PUNCH_RANGE + 0.6);
    if (!ped) return null;
    // Must be roughly in front.
    const dx = ped.pos.x - playerPos.x;
    const dz = ped.pos.z - playerPos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.01) return ped;
    const dot = (dx * fx + dz * fz) / d;
    if (dot < 0.2) return null;
    return ped;
  }
}
