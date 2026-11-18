// NEON HARBOR — bootstrap, renderer, game loop and state machine.
// Title -> playing -> (busted | paused | end) -> free roam. All original code.
import * as THREE from 'three';
import { CFG } from './config.js';
import { makeRng, hashSeed } from './random.js';
import { buildCity } from './city.js';
import { Player } from './player.js';
import { CarManager } from './vehicles.js';
import { Pedestrians } from './pedestrians.js';
import { Police } from './police.js';
import { Missions } from './missions.js';
import { Combat } from './combat.js';
import { SoundBank } from './audio.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { saveGame, loadGame, hasSave, clearSave } from './save.js';
import { parseShotParams, stageShot } from './shots.js';

const params = parseShotParams();
const seed = params.seed || 1;
const rng = makeRng(hashSeed('neon-harbor-' + seed));

// ---------- Renderer / scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.35;
renderer.domElement.classList.add('webgl');
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(CFG.COL.sky);
scene.fog = new THREE.FogExp2(CFG.COL.fog, 0.0032);

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
camera.position.set(0, 8, 30);

// ---------- Lights ----------
scene.add(new THREE.HemisphereLight(0x8a7bff, 0x1a1e30, 0.9));
const moon = new THREE.DirectionalLight(0x9db8ff, 1.4);
moon.position.set(80, 140, -60);
moon.castShadow = true;
moon.shadow.mapSize.set(2048, 2048);
moon.shadow.camera.left = -160;
moon.shadow.camera.right = 160;
moon.shadow.camera.top = 160;
moon.shadow.camera.bottom = -160;
moon.shadow.camera.far = 400;
moon.shadow.bias = -0.0004;
scene.add(moon);
const harborGlow = new THREE.PointLight(0x00e5ff, 900, 120, 1.8);
harborGlow.position.set(0, 18, 130);
scene.add(harborGlow);
const plazaGlow = new THREE.PointLight(0xff2d78, 700, 110, 1.8);
plazaGlow.position.set(0, 16, 0);
scene.add(plazaGlow);

// ---------- World and actors ----------
const city = buildCity(scene, rng);
const player = new Player(scene);
const cars = new CarManager(scene, rng, city.colliders);
const pedestrians = new Pedestrians(scene, rng);
const police = new Police(scene, rng, city.colliders);
const missions = new Missions(scene);
const combat = new Combat();
const sound = new SoundBank();
const input = new Input();
const ui = new UI();

// ---------- Game state ----------
const state = {
  mode: 'title', // title | playing | busted | paused | end
  cash: CFG.START_CASH,
  lifetimeEarned: 0,
  health: 100,
  shotMode: null,
  muted: false,
  elapsed: 0,
  saveTimer: 0,
  healthRegen: 0,
  endShown: false,
  camYaw: 0,
  camPitch: -0.18,
  cinematic: null,
  titleOrbit: 0,
};

// The UI and the save code read the subsystems off state.
state.police = police;
state.missions = missions;
state.cars = cars;
state.player = player;

// The actor position: the car when driving, the player on foot.
function actorPos() {
  return cars.playerCar ? cars.playerCar.pos : player.pos;
}

function earnCash(amount) {
  state.cash += amount;
  state.lifetimeEarned += amount;
  sound.coin();
}

// ---------- Menus / flow ----------
function startNewGame() {
  clearSave();
  state.cash = CFG.START_CASH;
  state.lifetimeEarned = 0;
  state.health = 100;
  state.endShown = false;
  police.clear();
  missions.setMission(0);
  if (cars.playerCar) cars.dropCar();
  player.setPosition(0, 40, Math.PI);
  player.visible = true;
  state.camYaw = Math.PI;
  state.mode = 'playing';
  ui.showMenu(null);
  ui.showHUD(true);
  sound.ensure();
  ui.toast('Meet Rook at Pier 9 — follow the yellow beacon.');
}

function continueGame() {
  const d = loadGame();
  if (!d) { startNewGame(); return; }
  state.cash = d.cash;
  state.lifetimeEarned = d.lifetimeEarned;
  state.health = 100;
  state.endShown = false;
  police.clear();
  police.wanted = d.wanted || 0;
  missions.index = d.missionIndex || 0;
  missions.stage = d.missionStage || 0;
  missions.hasPackage = !!d.hasPackage;
  missions.done = !!d.storyDone;
  if (missions.done) missions._startCourier();
  else missions.setMission(missions.index);
  if (d.car && d.inCar) {
    const rec = cars.nearestParked(new THREE.Vector3(d.car.x, 0, d.car.z), 500) || cars.parked[0];
    if (rec) {
      cars.takeCar(rec);
      rec.pos.set(d.car.x, 0, d.car.z);
      rec.heading = d.car.heading;
      player.setPosition(d.car.x, 0, d.car.z);
      player.visible = false;
    }
  } else {
    player.setPosition(d.player.x, d.player.z, d.player.heading);
    player.visible = true;
  }
  state.mode = 'playing';
  ui.showMenu(null);
  ui.showHUD(true);
  sound.ensure();
  ui.toast('Welcome back to Neon Harbor.');
}

function doBusted(reason) {
  const fine = Math.min(CFG.BUST_FINE, state.cash);
  state.cash -= fine;
  state.health = 100;
  police.clear();
  if (cars.playerCar) cars.dropCar();
  player.setPosition(0, 40, Math.PI);
  player.visible = true;
  state.mode = 'busted';
  ui.setBustedText(reason === 'wreck'
    ? 'Your car is scrap and the clinic bill is $200. The debt is still yours, Kai.'
    : `They took $${fine} in fines. The debt is still yours, Kai.`);
  ui.showMenu('busted');
  ui.showHUD(false);
  sound.busted();
  sound.siren(false);
  saveGame(state);
}

function doStoryComplete() {
  state.mode = 'end';
  ui.showMenu('end');
  ui.showHUD(false);
  sound.missionDone();
  saveGame(state);
}

ui.el['btn-start'].addEventListener('click', startNewGame);
ui.el['btn-continue'].addEventListener('click', continueGame);
ui.el['btn-retry'].addEventListener('click', () => {
  state.mode = 'playing';
  ui.showMenu(null);
  ui.showHUD(true);
  sound.ensure();
});
ui.el['btn-freeroam'].addEventListener('click', () => {
  state.mode = 'playing';
  ui.showMenu(null);
  ui.showHUD(true);
  sound.ensure();
  ui.toast('Free roam — courier runs pay $300 each.');
});
ui.el['btn-resume'].addEventListener('click', () => {
  state.mode = 'playing';
  ui.showMenu(null);
  ui.showHUD(true);
});
ui.el['btn-save'].addEventListener('click', () => {
  saveGame(state);
  ui.toast('Game saved.');
});
ui.el['btn-quit'].addEventListener('click', () => {
  saveGame(state);
  state.mode = 'title';
  ui.showMenu('title');
  ui.showHUD(false);
  ui.el['btn-continue'].classList.toggle('hidden', !hasSave());
});
if (hasSave()) ui.el['btn-continue'].classList.remove('hidden');

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- Interaction (E key) ----------
function interact() {
  const pos = actorPos();
  // 1. Mission objective first.
  if (missions.distToTarget(pos) < 5) {
    const res = missions.advance();
    if (res) {
      if (res.reward > 0) earnCash(res.reward);
      ui.toast(res.message, 3200);
      sound.missionDone();
      const m = missions.current();
      if (m && m.wantedOnStart) {
        police.wanted = m.wantedOnStart;
        ui.toast('It was a setup — the police are coming!', 3200);
      }
      if (res.storyDone && !state.endShown) {
        state.endShown = true;
        setTimeout(doStoryComplete, 900);
      }
      saveGame(state);
    }
    return;
  }
  // 2. Enter / steal a car (on foot).
  if (!cars.playerCar) {
    const near = cars.nearestParked(player.pos, 4);
    if (near) {
      const wasOwn = !!near.wasPlayer;
      cars.takeCar(near);
      player.visible = false;
      player.setPosition(near.pos.x, near.pos.z, near.heading);
      sound.steal();
      // Re-entering your own dropped car is free; stealing a stranger's is a crime.
      if (!wasOwn && police.wanted < CFG.WANTED_MAX) {
        police.addCrime(1);
        ui.toast('Car stolen! Wanted +1 ★');
      }
      return;
    }
  } else {
    // 3. Get out of the car.
    const car = cars.playerCar;
    cars.dropCar();
    player.setPosition(car.pos.x + Math.sin(car.heading + Math.PI / 2) * 2.4, car.pos.z + Math.cos(car.heading + Math.PI / 2) * 2.4, car.heading);
    player.visible = true;
  }
}

// ---------- Camera ----------
function updateCamera(dt) {
  if (state.cinematic) {
    camera.position.set(state.cinematic.pos[0], state.cinematic.pos[1], state.cinematic.pos[2]);
    camera.lookAt(state.cinematic.look[0], state.cinematic.look[1], state.cinematic.look[2]);
    return;
  }
  const look = input.takeLook();
  state.camYaw += look.yaw;
  state.camPitch = Math.max(-0.55, Math.min(0.25, state.camPitch + look.pitch));
  const target = actorPos();
  const inCar = !!cars.playerCar;
  const dist = inCar ? CFG.CAM_CAR_DIST : CFG.CAM_FOOT_DIST;
  const height = inCar ? CFG.CAM_CAR_HEIGHT : CFG.CAM_FOOT_HEIGHT;
  // Ease the yaw behind the actor's heading when moving.
  const heading = inCar ? cars.playerCar.heading : player.heading;
  let dy = heading - state.camYaw;
  while (dy > Math.PI) dy -= Math.PI * 2;
  while (dy < -Math.PI) dy += Math.PI * 2;
  const moving = inCar ? Math.abs(cars.playerCar.speed) > 2 : player.moving;
  if (moving) state.camYaw += dy * Math.min(1, dt * 1.6);
  const cx = target.x - Math.sin(state.camYaw) * dist * Math.cos(state.camPitch);
  const cz = target.z - Math.cos(state.camYaw) * dist * Math.cos(state.camPitch);
  const cy = height - state.camPitch * 14;
  camera.position.lerp(new THREE.Vector3(cx, cy, cz), Math.min(1, dt * 8));
  camera.lookAt(target.x, target.y + 1.6, target.z);
}

// ---------- Screenshot staging ----------
if (params.shot) {
  const staged = stageShot(params.shot, { state, player, cars, police, pedestrians, missions, camera });
  state.camYaw = staged.camYaw;
  state.camPitch = staged.camPitch;
  state.cinematic = staged.cinematic;
  state.shotMode = params.shot;
  if (params.shot === 'title') {
    ui.showMenu('title');
    ui.showHUD(false);
    ui.el['btn-continue'].classList.add('hidden');
  } else {
    ui.showMenu(null);
    ui.showHUD(true);
  }
  // Let the world settle one frame before the screenshot is taken.
  renderer.render(scene, camera);
}

// ---------- Main loop ----------
const clock = new THREE.Clock();
let firstFrame = true;

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05);
  const time = clock.elapsedTime;

  if (state.mode === 'playing') {
    state.elapsed += dt;
    // --- Input: mute / pause ---
    if (input.hit('KeyM')) {
      state.muted = !state.muted;
      sound.setMuted(state.muted);
      ui.toast(state.muted ? 'Sound off' : 'Sound on');
    }
    if (input.hit('KeyP') || input.hit('Escape')) {
      state.mode = 'paused';
      ui.showMenu('pause');
      ui.showHUD(false);
      input.endFrame();
      renderer.render(scene, camera);
      return;
    }
    sound.ensure();

    const inCar = !!cars.playerCar;
    const move = input.moveVector();

    // --- Player / car ---
    if (inCar) {
      const throttle = move.z;
      const steer = -move.x;
      const brake = input.down('Space');
      const crashed = cars.drivePlayer(dt, throttle, steer, brake);
      if (crashed) {
        state.health = Math.max(0, state.health - 12);
        sound.crash();
        ui.damageFlash();
      }
      if (input.hit('KeyR')) cars.resetPlayerCar();
      player.pos.copy(cars.playerCar.pos);
      player.heading = cars.playerCar.heading;
      sound.engine(Math.abs(cars.playerCar.speed) / CFG.CAR_TOP_SPEED, true);
      // Running over pedestrians.
      if (Math.abs(cars.playerCar.speed) > 6) {
        const hit = pedestrians.knockDown(cars.playerCar.pos, 2.6);
        if (hit) {
          police.addCrime(1);
          pedestrians.scare(cars.playerCar.pos, 18);
          sound.crash();
          ui.damageFlash();
          ui.toast('You hit a pedestrian! Wanted +1 ★');
        }
      }
      // Bumping traffic / police.
      if (cars.resolveCarCollisions([...cars.traffic, ...police.cars])) {
        if (Math.abs(cars.playerCar.speed) > 10) {
          state.health = Math.max(0, state.health - 6);
          sound.crash();
          ui.damageFlash();
        }
      }
    } else {
      sound.engine(0, false);
      const running = input.down('ShiftLeft') || input.down('ShiftRight');
      player.update(dt, move, state.camYaw, city.colliders, running);
    }

    // --- Interact / combat ---
    if (input.hit('KeyE')) interact();
    if (input.hit('KeyF') && !inCar) {
      const ped = combat.tryPunch(player.pos, player.heading, pedestrians);
      if (ped) {
        pedestrians.knockDown(ped.pos, 1);
        pedestrians.scare(player.pos, 16);
        police.addCrime(1);
        sound.punch();
        ui.toast('Assault! Wanted +1 ★');
      } else if (combat.swing > 0.9) {
        sound.punch();
      }
    }
    combat.update(dt);

    // --- World AI ---
    cars.updateTraffic(dt, [...cars.traffic, ...police.cars, ...(cars.playerCar ? [cars.playerCar] : [])]);
    pedestrians.update(dt, city.colliders);
    // NB: read cars.playerCar live here — interact() (E) may have just
    // stolen / dropped the car, so the frame-top `inCar` can be stale.
    const pres = police.update(dt, actorPos(), cars.playerCar ? Math.abs(cars.playerCar.speed) : 0, !cars.playerCar);
    sound.siren(police.wanted > 0);
    missions.update(dt, time);

    // --- Health regen / wrecked ---
    if (state.health < 100) {
      state.healthRegen += dt;
      if (state.healthRegen > 3) state.health = Math.min(100, state.health + dt * 4);
    } else state.healthRegen = 0;
    if (state.health <= 0) { doBusted('wreck'); input.endFrame(); return; }
    if (pres.busted) { doBusted('caught'); input.endFrame(); return; }

    // --- Interaction prompt ---
    const pos = actorPos();
    if (missions.distToTarget(pos) < 5) {
      ui.setPrompt('E — ' + (missions.hasPackage || missions.stage === 1 ? 'DELIVER PACKAGE' : (missions.current() && missions.current().id === 'pickup' ? 'PICK UP PACKAGE' : 'START JOB')));
    } else if (!inCar && cars.nearestParked(player.pos, 4)) {
      ui.setPrompt('E — STEAL CAR');
    } else if (inCar) {
      ui.setPrompt('E — GET OUT');
    } else {
      ui.setPrompt(null);
    }

    // --- Autosave ---
    state.saveTimer += dt;
    if (state.saveTimer > 20) {
      state.saveTimer = 0;
      saveGame(state);
    }

    updateCamera(dt);
    ui.updateHUD(state, state.elapsed / 60);
    ui.drawMinimap(state, city);
  } else if (state.mode === 'title') {
    // Slow orbit around the harbor for the title backdrop.
    state.titleOrbit += dt * 0.05;
    const r = 95;
    camera.position.set(Math.sin(state.titleOrbit) * r, 26, 60 + Math.cos(state.titleOrbit) * r * 0.4);
    camera.lookAt(0, 8, 40);
    cars.updateTraffic(dt, [...cars.traffic]);
    pedestrians.update(dt, city.colliders);
    missions.update(dt, time);
  }

  input.endFrame();
  renderer.render(scene, camera);
  if (firstFrame) {
    firstFrame = false;
    // Expose a hook so screenshot tooling knows the first frame is done.
    window.__neonHarborReady = true;
  }
}

// Debug/testing hook: lets automated play-tests drive the game.
window.__neon = { state, player, cars, police, pedestrians, missions, city, sound };

tick();
