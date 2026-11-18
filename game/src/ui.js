// NEON HARBOR — HUD, minimap, menus and toasts. All DOM; the 3D scene never
// draws UI. The minimap is a 2D canvas top-down view of the city.
import { CFG, repTier } from './config.js';

export class UI {
  constructor() {
    this.el = {};
    const ids = ['hud', 'cash', 'stars', 'healthfill', 'rep', 'minimap', 'clock', 'obj-title', 'obj-text', 'prompt', 'speedo', 'speed', 'toast', 'damage', 'menu-title', 'menu-busted', 'menu-end', 'menu-pause', 'busted-text', 'btn-start', 'btn-continue', 'btn-retry', 'btn-freeroam', 'btn-resume', 'btn-save', 'btn-quit'];
    for (const id of ids) this.el[id] = document.getElementById(id);
    this.minimapCtx = this.el.minimap.getContext('2d');
    this.toastTimer = null;
    this.clockBase = 21 * 60 + 40; // 21:40 in minutes
  }

  showHUD(on) { this.el.hud.classList.toggle('hidden', !on); }

  showMenu(name) {
    for (const m of ['menu-title', 'menu-busted', 'menu-end', 'menu-pause']) {
      this.el[m].classList.add('hidden');
    }
    if (name) this.el['menu-' + name].classList.remove('hidden');
  }

  setBustedText(text) { this.el['busted-text'].textContent = text; }

  toast(text, ms) {
    const t = this.el.toast;
    t.textContent = text;
    t.style.opacity = '1';
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { t.style.opacity = '0'; }, ms || 2600);
  }

  setPrompt(text) {
    if (!text) { this.el.prompt.classList.add('hidden'); return; }
    this.el.prompt.textContent = text;
    this.el.prompt.classList.remove('hidden');
  }

  damageFlash() {
    const d = this.el.damage;
    d.style.transition = 'none';
    d.style.opacity = '1';
    requestAnimationFrame(() => {
      d.style.transition = 'opacity 0.6s';
      d.style.opacity = '0';
    });
  }

  updateHUD(state, elapsedMin) {
    this.el.cash.textContent = '$' + Math.floor(state.cash).toLocaleString('en-US');
    let stars = '';
    for (let i = 0; i < CFG.WANTED_MAX; i++) {
      stars += i < state.police.wanted ? '★' : '<span class="off">★</span>';
    }
    this.el.stars.innerHTML = stars;
    this.el.healthfill.style.width = Math.max(0, Math.min(100, state.health)) + '%';
    this.el.rep.textContent = 'REP: ' + repTier(state.lifetimeEarned) + '  ·  DEBT $' + Math.max(0, CFG.DEBT - state.lifetimeEarned).toLocaleString('en-US');
    const obj = state.missions.objectiveText();
    this.el['obj-title'].textContent = obj.title;
    this.el['obj-text'].textContent = obj.text;
    // In-game clock advances with play time (1 game hour per 4 real minutes).
    const mins = (this.clockBase + elapsedMin * 15) % (24 * 60);
    const hh = String(Math.floor(mins / 60)).padStart(2, '0');
    const mm = String(Math.floor(mins % 60)).padStart(2, '0');
    this.el.clock.textContent = `NEON HARBOR · ${hh}:${mm}`;
    if (state.cars.playerCar) {
      this.el.speedo.classList.remove('hidden');
      const kmh = Math.abs(state.cars.playerCar.speed) * 3.6;
      this.el.speed.textContent = Math.round(kmh);
    } else {
      this.el.speedo.classList.add('hidden');
    }
  }

  // Top-down minimap: roads, water, buildings, player, cars, police, objective.
  // Drawn large and bright so it still reads at the 190px display size.
  drawMinimap(state, city) {
    const ctx = this.minimapCtx;
    const S = 380;
    const scale = S / 300; // city -150..150 maps onto the canvas
    const toX = (x) => (x + 150) * scale;
    const toZ = (z) => (z + 150) * scale;
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = '#04061a';
    ctx.fillRect(0, 0, S, S);
    // Water (south).
    ctx.fillStyle = '#06324a';
    ctx.fillRect(0, toZ(130), S, S - toZ(130));
    // Buildings as light blocks so they read against the dark background.
    ctx.fillStyle = '#33415e';
    ctx.strokeStyle = 'rgba(90, 120, 170, 0.5)';
    ctx.lineWidth = 1;
    for (const c of city.colliders) {
      if (c.z0 > 128) continue; // pier colliders are the dock, skip
      ctx.fillRect(toX(c.x0), toZ(c.z0), (c.x1 - c.x0) * scale, (c.z1 - c.z0) * scale);
      ctx.strokeRect(toX(c.x0), toZ(c.z0), (c.x1 - c.x0) * scale, (c.z1 - c.z0) * scale);
    }
    // Roads: bright, thick, so the street grid is obvious.
    ctx.strokeStyle = 'rgba(170, 195, 225, 0.9)';
    ctx.lineWidth = 5;
    for (const s of city.streetLines) {
      ctx.beginPath(); ctx.moveTo(toX(s), 0); ctx.lineTo(toX(s), S); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, toZ(s)); ctx.lineTo(S, toZ(s)); ctx.stroke();
    }
    // Mission target: a big yellow diamond, white outline, pulsing ring.
    const t = state.missions.target();
    if (t) {
      const x = toX(t.x);
      const y = toZ(t.z);
      const pulse = 16 + Math.sin(performance.now() / 280) * 5;
      ctx.strokeStyle = 'rgba(255, 210, 62, 0.85)';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x, y, pulse, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#ffd23e';
      ctx.beginPath();
      ctx.moveTo(x, y - 13); ctx.lineTo(x + 12, y); ctx.lineTo(x, y + 13); ctx.lineTo(x - 12, y);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    // Traffic (white dots), parked (grey), police (flashing red/blue, outlined).
    const dot = (x, z, color, r) => {
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(toX(x), toZ(z), r, 0, Math.PI * 2); ctx.fill();
    };
    for (const c of state.cars.traffic) dot(c.pos.x, c.pos.z, '#dfe8f2', 4);
    for (const c of state.cars.parked) dot(c.pos.x, c.pos.z, '#7a8aa0', 4);
    const flash = Math.floor(performance.now() / 300) % 2 === 0;
    for (const c of state.police.cars) {
      dot(c.pos.x, c.pos.z, flash ? '#ff2b2b' : '#2b6bff', 6);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(toX(c.pos.x), toZ(c.pos.z), 6, 0, Math.PI * 2); ctx.stroke();
    }
    // Player arrow: big, bright cyan, with a bold ring.
    const px = toX(state.player.pos.x);
    const py = toZ(state.player.pos.z);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(-state.player.heading);
    ctx.fillStyle = '#00e5ff';
    ctx.beginPath();
    ctx.moveTo(0, -12); ctx.lineTo(9, 10); ctx.lineTo(-9, 10);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(px, py, 17, 0, Math.PI * 2); ctx.stroke();
  }
}
