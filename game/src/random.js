// Seeded random numbers (mulberry32) so the city, traffic and pedestrians are
// reproducible from a seed — screenshots with ?seed=1 always show the same city.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Small helper bag around one rng instance.
export function makeRng(seed) {
  const rand = mulberry32(seed);
  return {
    next: rand,
    range: (lo, hi) => lo + rand() * (hi - lo),
    int: (lo, hi) => Math.floor(lo + rand() * (hi - lo + 1)),
    pick: (arr) => arr[Math.floor(rand() * arr.length)],
    chance: (p) => rand() < p,
  };
}

// Hash a short string into a 32-bit seed.
export function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
