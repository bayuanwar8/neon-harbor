// NEON HARBOR — save/load via localStorage. Saves cash, mission progress,
// wanted level and the player's position/car so Continue drops you back in.
const KEY = 'neon-harbor-save-v1';

export function saveGame(state) {
  try {
    const data = {
      v: 1,
      cash: state.cash,
      lifetimeEarned: state.lifetimeEarned,
      missionIndex: state.missions.index,
      missionStage: state.missions.stage,
      hasPackage: state.missions.hasPackage,
      storyDone: state.missions.done,
      wanted: state.police.wanted,
      player: { x: state.player.pos.x, z: state.player.pos.z, heading: state.player.heading },
      inCar: !!state.cars.playerCar,
      car: state.cars.playerCar
        ? { x: state.cars.playerCar.pos.x, z: state.cars.playerCar.pos.z, heading: state.cars.playerCar.heading, color: state.cars.playerCar.color }
        : null,
      savedAt: Date.now(),
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d || d.v !== 1) return null;
    return d;
  } catch (e) {
    return null;
  }
}

export function hasSave() {
  return loadGame() !== null;
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch (e) {}
}
