// NEON HARBOR — tuning and world constants. All values chosen for this game.
// The city is a small dense grid: 5x5 blocks with a harbor on the south edge.
// One unit is roughly one metre.
export const CFG = {
  // City layout
  BLOCK: 36,          // block side length
  STREET: 14,         // street width
  BLOCKS: 5,          // blocks per side
  // City spans from -CITY_HALF to +CITY_HALF on x and z (roads included).
  // CITY_HALF = BLOCKS * (BLOCK + STREET) / 2 + STREET / 2
  CITY_HALF: 130,
  HARBOR_Z: 130,      // water starts beyond this z
  WATER_SIZE: 320,

  // Player on foot
  WALK_SPEED: 7,
  RUN_SPEED: 12,
  PLAYER_RADIUS: 0.7,
  PLAYER_HEIGHT: 1.8,

  // Cars
  CAR_TOP_SPEED: 34,        // units per second (~122 km/h at scale)
  CAR_ACCEL: 16,
  CAR_BRAKE: 30,
  CAR_REVERSE_SPEED: 10,
  CAR_STEER: 1.9,           // radians per second at low speed
  CAR_LENGTH: 4.4,
  CAR_WIDTH: 2.0,

  // Traffic
  TRAFFIC_COUNT: 22,
  TRAFFIC_SPEED: 9,

  // Pedestrians
  PED_COUNT: 26,
  PED_SPEED: 1.6,

  // Wanted / police
  WANTED_MAX: 5,
  WANTED_DECAY_SEC: 22,     // one star fades after this long with no crime
  POLICE_TOP_SPEED: 36,
  POLICE_SPAWN_DIST: 90,
  BUST_TIME: 1.6,           // seconds a police car must touch you to bust you
  BUST_FINE: 200,

  // Combat
  PUNCH_RANGE: 2.4,
  PUNCH_COOLDOWN: 0.45,
  PUNCH_DAMAGE: 25,

  // Missions
  MISSIONS: [
    {
      id: 'meet',
      title: 'JOB 1 — MEET ROOK',
      text: 'Rook is waiting at Pier 9. Get to the yellow beacon — on foot or in a car.',
      target: { x: -96, z: 96 },
      reward: 0,
    },
    {
      id: 'pickup',
      title: 'JOB 2 — HARBOR PICKUP',
      text: 'Pick up the package at Dock 7, then deliver it to the Tide Warehouse.',
      target: { x: 96, z: 96 },
      target2: { x: -96, z: -96 },
      reward: 500,
    },
    {
      id: 'getaway',
      title: 'JOB 3 — GETAWAY',
      text: 'The pickup was a setup — the police are on you. Lose them and reach the Safehouse.',
      target: { x: 96, z: -96 },
      reward: 800,
      wantedOnStart: 2,
    },
  ],
  COURIER_REWARD: 300,

  // Economy
  START_CASH: 50,
  DEBT: 2000,

  // Camera
  CAM_FOOT_DIST: 7.5,
  CAM_FOOT_HEIGHT: 3.2,
  CAM_CAR_DIST: 10.5,
  CAM_CAR_HEIGHT: 4.2,

  // Colours (hex)
  COL: {
    sky: 0x141a38,
    fog: 0x141a38,
    asphalt: 0x252a3a,
    sidewalk: 0x3a3f52,
    buildingBase: 0x1a2033,
    water: 0x06283d,
    neonCyan: 0x00e5ff,
    neonPink: 0xff2d78,
    neonYellow: 0xffd23e,
    neonGreen: 0x7dff9b,
    neonOrange: 0xff7a3d,
    policeRed: 0xff2b2b,
    policeBlue: 0x2b6bff,
  },

  // Neon sign texts (all original names)
  SIGNS: ['NEON HARBOR', 'PIER 9', 'ANCHOR BAR', 'TIDE HOTEL', 'CRANE CO', 'DOCK 7', 'RAMEN 24', 'TAXI', 'CASINO', 'NOODLE BAR', 'FERRY', 'WAREHOUSE'],
};

// Rep tiers by cash earned (lifetime).
export function repTier(lifetimeEarned) {
  if (lifetimeEarned >= 1500) return 'King of the Harbor';
  if (lifetimeEarned >= 800) return 'Harbor Regular';
  if (lifetimeEarned >= 300) return 'Runner';
  return 'Street';
}
