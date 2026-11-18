// NEON HARBOR — deterministic screenshot staging. ?shot=title|street|drive|wanted
// with ?seed=1 sets up a fixed scene so every screenshot is reproducible:
// the same seed always shows the same city, the same positions, the same chase.
// The game loop keeps running (traffic moves), but the staged state is fixed.
import { TRAFFIC_DIRS } from './vehicles.js';
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
  const { state, player, cars, police, pedestrians, missions } = ctx;
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
    // Pull a few pedestrians close to the player for a busy street.
    const spots = [[-4, -6], [8, -2], [-2, 10], [12, 6], [-10, 2]];
    pedestrians.list.slice(0, 5).forEach((p, i) => {
      p.pos.set(spots[i][0], 0, spots[i][1]);
      p.state = 'walk';
      p.target = { x: spots[i][0] + 20, z: spots[i][1] + 10 };
    });
    // Keep traffic off the central intersection so no car drives through
    // the frame and blocks Kai: send every traffic car out to the outer
    // ring roads, where it stays for the length of the shot.
    const ringRoads = [
      { x: 100, z: 0, dir: TRAFFIC_DIRS.north },
      { x: -100, z: 0, dir: TRAFFIC_DIRS.south },
      { x: 0, z: 100, dir: TRAFFIC_DIRS.west },
      { x: 0, z: -100, dir: TRAFFIC_DIRS.east },
    ];
    cars.traffic.forEach((c, i) => {
      const r = ringRoads[i % ringRoads.length];
      const along = -80 + ((i * 37) % 160);
      if (r.dir === TRAFFIC_DIRS.north || r.dir === TRAFFIC_DIRS.south) {
        cars.stageTraffic(c, r.x, along, r.dir);
      } else {
        cars.stageTraffic(c, along, r.z, r.dir);
      }
      c.baseSpeed = 5; // slow cruise on the ring, so none drifts back in
    });
    return { camYaw: 0.6, camPitch: -0.22, cinematic: null };
  }
  if (shot === 'drive') {
    state.mode = 'playing';
    missions.setMission(1); // pickup job: beacon at Dock 7
    // Player in a red car, driving east on the central road.
    const rec = cars.parked[0] || null;
    if (rec) {
      cars.takeCar(rec);
      rec.pos.set(-40, 0, 0);
      rec.heading = Math.PI / 2;
      rec.speed = 16;
      player.setPosition(-40, 0, 0);
      player.visible = false;
    }
    // Traffic in frame, in the correct lanes: one ahead in our lane, one
    // oncoming in the opposite lane, one further ahead in our lane.
    if (cars.traffic[0]) cars.stageTraffic(cars.traffic[0], -8, 0, TRAFFIC_DIRS.east);
    if (cars.traffic[1]) cars.stageTraffic(cars.traffic[1], 28, 0, TRAFFIC_DIRS.west);
    if (cars.traffic[2]) cars.stageTraffic(cars.traffic[2], 45, 0, TRAFFIC_DIRS.east);
    return { camYaw: Math.PI / 2, camPitch: -0.16, cinematic: null };
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
    }
    // Three stars, three police cars closing in — placed in a triangle
    // around the player so the chase reads in the frame: two behind on the
    // flanks (visible low in the frame, right on the player's tail) and one
    // ahead on the road.
    police.clear();
    police.wanted = 3;
    const spots = [[-42, 44], [-42, 56], [-16, 50]];
    for (let i = 0; i < 3; i++) {
      const car = police._spawnCar(rec ? rec.pos : player.pos);
      car.pos.set(spots[i][0], 0, spots[i][1]);
      car.heading = Math.PI / 2;
      car.speed = 22;
    }
    // Traffic in frame, in the correct lanes: one ahead in our lane, one
    // oncoming in the opposite lane, one further ahead in our lane.
    if (cars.traffic[0]) cars.stageTraffic(cars.traffic[0], 0, 50, TRAFFIC_DIRS.east);
    if (cars.traffic[1]) cars.stageTraffic(cars.traffic[1], 20, 50, TRAFFIC_DIRS.west);
    if (cars.traffic[2]) cars.stageTraffic(cars.traffic[2], 38, 50, TRAFFIC_DIRS.east);
    return { camYaw: Math.PI / 2, camPitch: -0.18, cinematic: null };
  }
  return { camYaw: 0, camPitch: -0.15, cinematic: null };
}
