# neon-harbor

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/bayuanwar8/neon-harbor/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/bayuanwar8/neon-harbor/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

NEON HARBOR — an original open-world crime game in the browser, built for make.fun's “Make GTA 6” bounty ($1,666 in USDC). You are Kai, a courier who owes the Harbor Syndicate $2,000. Pay it off in a neon-lit harbor city at dusk: run jobs for Rook, steal cars, outrun the police, and climb from Nobody to Harbor Legend.

## What is in the game

- **A small, dense city** — a 5×5 street grid with a harbor, a pier, container yards, cranes, neon signs, streetlights and a central plaza. Everything is procedural (three.js, no image assets), so the whole city is built from code.
- **On foot and by car** — walk the sidewalks, then steal any parked car (E) and drive it. Arcade handling: acceleration, steering, braking, reverse.
- **Traffic and pedestrians** — cars follow the street grid with working intersections; pedestrians stroll the sidewalks, flee when scared, and get knocked down if you hit them.
- **Wanted level and police** — stealing a car, hitting a pedestrian or punching someone raises your stars (up to 5). Police cars spawn at the city edge, chase you with flashing light bars, and bust you if they stay on you too long. Lay low and the heat fades.
- **Missions and story** — three story jobs with a glowing yellow beacon at each objective: meet Rook at Pier 9, pick up a package at Dock 7 and deliver it to the Tide Warehouse, then a getaway with two stars on you from the start. Finish the debt and the city opens up into repeatable courier runs ($300 each).
- **Combat** — punch (F) on foot. It hurts your reputation with the law, so use it wisely.
- **HUD and minimap** — cash, wanted stars, health, reputation tier, the current objective, a live clock, a speedometer while driving, and a top-down minimap showing the roads, the harbor, traffic, police, and your objective.
- **Start screen, pause, and save** — title screen with New Game / Continue, pause (P), and autosave plus manual save to localStorage. Progress (cash, missions, wanted level, position, car) survives a reload.

## Run it

```sh
# serve the game locally, then open http://localhost:8080
node serve.ts

# or open game/index.html directly in a desktop browser
```

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Walk / drive (W accelerate, S brake/reverse, A/D steer) |
| Mouse drag | Look around (third-person camera) |
| E | Steal / enter car, get out, start and finish jobs |
| F | Punch (on foot) |
| Space | Handbrake |
| Shift | Sprint (on foot) |
| R | Reset car |
| P / Esc | Pause |
| M | Mute |

## Screenshots

Deterministic modes for the screenshots in `screenshots/` — the same seed always shows the same scene:

```sh
# title, on-foot street, driving, and a police chase
http://localhost:8080/?shot=title&seed=1
http://localhost:8080/?shot=street&seed=1
http://localhost:8080/?shot=drive&seed=1
http://localhost:8080/?shot=wanted&seed=1
```

## Tech

- three.js (vendored under `game/vendor/three/`, no network requests)
- Plain ES modules, no build step, desktop Chrome
- WebAudio synthesized sounds only — no audio files
- `main.ts` (Node 22, stdlib only) copies `game/` + `screenshots/` to `/output` and writes `dossier.json` via the vendored make.fun library
- All game code is original, written for this bounty. No Rockstar / GTA names, logos, maps or music.

---

<sub>Entered on [make.fun](https://make.fun/?ref=psxszbrd&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
