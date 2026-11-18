// NEON HARBOR — keyboard + mouse input. Tracks held keys, edge-triggered presses,
// and drag-to-look camera yaw/pitch.
export class Input {
  constructor() {
    this.keys = new Set();
    this.pressed = new Set();
    this.yawDelta = 0;
    this.pitchDelta = 0;
    this.dragging = false;
    this._onKeyDown = (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressed.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    };
    this._onKeyUp = (e) => this.keys.delete(e.code);
    this._onMouseDown = (e) => { this.dragging = true; };
    this._onMouseUp = () => { this.dragging = false; };
    this._onMouseMove = (e) => {
      if (!this.dragging) return;
      this.yawDelta -= e.movementX * 0.004;
      this.pitchDelta -= e.movementY * 0.003;
    };
    this._onBlur = () => { this.keys.clear(); this.dragging = false; };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('blur', this._onBlur);
  }

  down(code) { return this.keys.has(code); }
  // True once, on the frame the key went down. Consumed by endFrame().
  hit(code) { return this.pressed.has(code); }
  axis(neg, pos) { return (this.keys.has(pos) ? 1 : 0) - (this.keys.has(neg) ? 1 : 0); }
  // WASD + arrows, as a normalized {x, z} in camera space (x right, z forward).
  moveVector() {
    const x = this.axis('KeyA', 'KeyD') + this.axis('ArrowLeft', 'ArrowRight');
    const z = this.axis('KeyS', 'KeyW') + this.axis('ArrowDown', 'ArrowUp');
    const len = Math.hypot(x, z);
    if (len < 0.01) return { x: 0, z: 0 };
    return { x: x / len, z: z / len };
  }
  takeLook() {
    const y = this.yawDelta;
    const p = this.pitchDelta;
    this.yawDelta = 0;
    this.pitchDelta = 0;
    return { yaw: y, pitch: p };
  }
  endFrame() { this.pressed.clear(); }
}
