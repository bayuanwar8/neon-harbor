// NEON HARBOR — deterministic screenshot staging. ?shot=title|street|drive|wanted
// with ?seed=1 sets up a fixed scene so every screenshot is reproducible:
// the same seed always shows the same city, the same positions, the same chase.
// The game loop keeps running (traffic moves), but the staged state is fixed.
// v2: the streets are staged BUSY — more pedestrians around Kai, more traffic
// in frame on the drive and wanted shots — and the wanted shot stages the
// police helicopter so it reads at a glance.
import { TRAFFIC_DIRS } from './vehicles.js';
import { CFG } from './config.js';

// Snap the chase camera to its exact framing at once. main.js lerps the
// camera toward this same spot every frame, but a short virtual-time
// screenshot budget does not give it enough frames to settle from its
// spawn position (0, 8, 30) — the first frames come out as a high top-down
// view with the road running diagonally. Snapping here makes the first
// rendered frame already correctly framed.
function snapChaseCamera(camera, target, camYaw, camPitch) {
  const dist = CFG.CAM_CAR_DIST;
  const height = CFG.CAM_CAR_HEIGHT;
  const cx = target.x - Math.sin(camYaw) * dist * Math.cos(camPitch);
  const cz = target.z - Math.cos(camYaw) * dist * Math.cos(camPitch);
  const cy = height - camPitch * 14;
  camera.position.set(cx, cy, cz);
  camera.lookAt(target.x, target.y + 1.6, target.z);
}
export function parseShotParams() {
  const q = new URLSearchParams(window.location.search);
  return {
    shot: q.get('shot') || null,
    seed: parseInt(q.get('seed') || '1', 10) || 1,
  };
}

// Stage a screenshot. ctx: { state, player, cars, police, pedestrians, missions, camera }.
// Returns { camYaw, camPitch, cinematic } — camera setup for main.js.
export function stageShot(shot, ctx) {
  const { state, player, cars, police, pedestrians, missions, camera } = ctx;
  state.shotMode = shot;
  if (shot === 'title') {
    state.mode = 'title';
    // Player stands at the harbor overlook for the title backdrop.
    player.setPosition(0, 110, Math.PI);
    player.visible = true;
    return { camYaw: 0.35, camPitch: -0.12, cinematic: { pos: [14, 7, 132], look: [0, 6, 90] } };
  }
  if (shot === 'street') {
    state.mode = 'playing';
    missions.setMission(0);
    // Player on foot at the central intersection, crowd around.
    player.setPosition(4, 4, Math.PI * 0.75);
    player.visible = true;
    // Pull a crowd close to the player for a busy street: twelve walkers
    // clustered IN FRONT of Kai (northeast, the way the camera looks), so
    // the crowd is right in the frame, not scattered behind the camera.
    // Kai stands at (4, 4) facing yaw 0.6 (northeast); the crowd is 2–16
    // units ahead of him in that direction.
    const spots = [
      [8, 8], [12, 10], [6, 12], [15, 8], [10, 15], [4, 10],
      [12, 5], [8, 14], [18, 12], [6, 18], [14, 16], [10, 20],
    ];
    pedestrians.list.slice(0, 12).forEach((p, i) => {
      p.pos.set(spots[i][0], 0, spots[i][1]);
      p.state = 'walk';
      p.target = { x: spots[i][0] + 20, z: spots[i][1] + 10 };
    });
    // Traffic on the near cross streets (a quarter block out) so cars read
    // in the mid-ground, but none on the central intersection to block Kai.
    const nearRoads = [
      { x: -25, z: 0, dir: TRAFFIC_DIRS.east },
      { x: 25, z: 0, dir: TRAFFIC_DIRS.west },
      { x: 0, z: -25, dir: TRAFFIC_DIRS.north },
      { x: 0, z: 25, dir: TRAFFIC_DIRS.south },
      { x: -25, z: 50, dir: TRAFFIC_DIRS.east },
      { x: 25, z: -50, dir: TRAFFIC_DIRS.west },
    ];
    cars.traffic.forEach((c, i) => {
      if (i < nearRoads.length) {
        const r = nearRoads[i];
        if (r.dir === TRAFFIC_DIRS.north || r.dir === TRAFFIC_DIRS.south) {
          cars.stageTraffic(c, r.x, r.z, r.dir);
        } else {
          cars.stageTraffic(c, r.x, r.z, r.dir);
        }
        c.baseSpeed = 6; // cruise, so none drifts into the frame and blocks Kai
      } else {
        // The rest go out to the outer ring roads, as before.
        const ringRoads = [
          { x: 100, z: 0, dir: TRAFFIC_DIRS.north },
          { x: -100, z: 0, dir: TRAFFIC_DIRS.south },
          { x: 0, z: 100, dir: TRAFFIC_DIRS.west },
          { x: 0, z: -100, dir: TRAFFIC_DIRS.east },
        ];
        const r = ringRoads[i % ringRoads.length];
        const along = -80 + ((i * 37) % 160);
        if (r.dir === TRAFFIC_DIRS.north || r.dir === TRAFFIC_DIRS.south) {
          cars.stageTraffic(c, r.x, along, r.dir);
        } else {
          cars.stageTraffic(c, along, r.z, r.dir);
        }
        c.baseSpeed = 5;
      }
    });
    return { camYaw: 0.6, camPitch: -0.22, cinematic: null };
  }
  if (shot === 'drive') {
    state.mode = 'playing';
    missions.setMission(1); // pickup job: beacon at Dock 7
    // Player in a red car, driving east on the central road — at a crawl
    // (2 u/s), so the car stays on this road segment for the whole shot
    // (no intersection turn, no rear-ending the traffic ahead, which spun
    // the car sideways in earlier takes). The traffic cruises at the same
    // 2 u/s, so the formation holds and the road reads as busy, not empty.
    const rec = cars.parked[0] || null;
    if (rec) {
      cars.takeCar(rec);
      rec.pos.set(-40, 0, 0);
      rec.heading = Math.PI / 2;
      rec.speed = 2;
      player.setPosition(-40, 0, 0);
      player.visible = false;
      // Hide the player mesh outright — the update loop does not always
      // hide it when the player is in a car, so Kai would otherwise stand
      // on the car's roof in the photo.
      if (player.mesh) player.mesh.visible = false;
    }
    // Hide pedestrians for this shot, so none clips through the player's
    // car mid-frame (a walker crossing the road reads as standing on the
    // roof). The street shot carries the crowd.
    pedestrians.list.forEach((p) => {
      if (p.mesh) p.mesh.visible = false;
    });
    // A busy road: nine traffic cars in the near-mid range ahead (15–85
    // units), in the correct lanes, so they read large and the road looks
    // busy, not empty. They are PINNED (baseSpeed 0) — pinning guarantees
    // none drifts out of frame or turns away at an intersection before
    // the photo. Positions stay clear of intersections (x = 0, ±50) so no
    // car retargets and rotates in place.
    const driveCars = [
      [-25, 0, TRAFFIC_DIRS.east], [-12, 0, TRAFFIC_DIRS.east], [10, 0, TRAFFIC_DIRS.east],
      [20, 0, TRAFFIC_DIRS.east], [32, 0, TRAFFIC_DIRS.east], [44, 0, TRAFFIC_DIRS.east],
      [-18, 0, TRAFFIC_DIRS.west], [8, 0, TRAFFIC_DIRS.west], [30, 0, TRAFFIC_DIRS.west],
    ];
    driveCars.forEach((s, i) => {
      if (cars.traffic[i]) {
        cars.stageTraffic(cars.traffic[i], s[0], s[1], s[2]);
        cars.traffic[i].baseSpeed = 0; // pinned: hold this spot for the photo
      }
    });
    // Low chase angle (not the old steep -0.16 top-down look): the camera
    // sits low behind the car so its rear reads large and the road
    // stretches ahead. Snapped at once so the first frame is framed.
    if (rec) snapChaseCamera(camera, rec.pos, Math.PI / 2, -0.05);
    return { camYaw: Math.PI / 2, camPitch: -0.05, cinematic: null };
  }
  if (shot === 'wanted') {
    state.mode = 'playing';
    missions.setMission(2); // getaway job
    const rec = cars.parked[1] || cars.parked[0] || null;
    if (rec) {
      cars.takeCar(rec);
      rec.pos.set(-30, 0, 50);
      rec.heading = Math.PI / 2;
      rec.speed = 20;
      player.setPosition(-30, 0, 50);
      player.visible = false;
      // Hide the player mesh outright (see the drive shot note).
      if (player.mesh) player.mesh.visible = false;
    }
    // Three stars, two police cars flanking the player — PINNED IN
    // FORMATION beside the player's car (same x, 5 units to each side),
    // NOT fixed world spots behind it. The old staging put them 4–5 units
    // behind the player, between the chase camera and the player, so they
    // read huge and hid the player's car — and the chase AI would close
    // in and swarm the frame within a second anyway. A formation pin
    // (police.update holds a pinned car at playerPos + pinOffset) keeps
    // them flanking at a readable distance as the player drives, with the
    // player's car fully visible in the centre. 5 units clear of the
    // player: outside the 4.2 collision push and the 3.6 bust radius.
    police.clear();
    police.wanted = 3;
    const flankOffsets = [{ x: 0, z: -5 }, { x: 0, z: 5 }];
    const px = rec ? rec.pos.x : player.pos.x;
    const pz = rec ? rec.pos.z : player.pos.z;
    for (let i = 0; i < 2; i++) {
      const car = police._spawnCar(rec ? rec.pos : player.pos);
      car.pinned = true;
      car.pinOffset = { x: flankOffsets[i].x, z: flankOffsets[i].z };
      car.pos.set(px + flankOffsets[i].x, 0, pz + flankOffsets[i].z);
      car.heading = Math.PI / 2;
      car.speed = 0;
      car.mesh.position.copy(car.pos);
      car.mesh.rotation.y = car.heading - Math.PI / 2;
    }
    // The helicopter: spawn it now (the loop keeps it there) hovering ahead
    // of the player, in the chase camera's view, spotlight on the player.
    // Lock it to its hover point (no follow lag) so it is deterministically
    // in the frame for the photo.
    police._spawnHeli(rec ? rec.pos : player.pos);
    police.heliLock = true;
    // A busy road under the chase: ten traffic cars in the correct lanes,
    // clustered in the near-mid range ahead so they read large. They cruise
    // at 12 u/s so the fleeing player (20 u/s) does not rear-end them
    // mid-shot.
    const wantedCars = [
      [-10, 50, TRAFFIC_DIRS.east], [0, 50, TRAFFIC_DIRS.west], [10, 50, TRAFFIC_DIRS.east],
      [20, 50, TRAFFIC_DIRS.east], [30, 50, TRAFFIC_DIRS.west], [40, 50, TRAFFIC_DIRS.east],
      [-5, 50, TRAFFIC_DIRS.east], [50, 50, TRAFFIC_DIRS.east], [60, 50, TRAFFIC_DIRS.west],
      [25, 50, TRAFFIC_DIRS.east],
    ];
    wantedCars.forEach((s, i) => {
      if (cars.traffic[i]) {
        cars.stageTraffic(cars.traffic[i], s[0], s[1], s[2]);
        cars.traffic[i].baseSpeed = 12;
      }
    });
    // Snap the chase camera at once (see snapChaseCamera) so the first
    // frame is framed: low dramatic angle, player centred, police
    // flanking at the sides, helicopter above.
    if (rec) snapChaseCamera(camera, rec.pos, Math.PI / 2, 0.10);
    return { camYaw: Math.PI / 2, camPitch: 0.10, cinematic: null };
  }
  return { camYaw: 0, camPitch: -0.15, cinematic: null };
}
