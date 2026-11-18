// NEON HARBOR — synthesized sound. No audio files: every sound is a WebAudio
// oscillator/noise patch built at runtime, so the game ships zero audio assets.
export class SoundBank {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOn = false;
    this.sirenOscA = null;
    this.sirenOscB = null;
    this.sirenGain = null;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
    } catch (e) {
      this.ctx = null;
    }
  }

  setMuted(m) {
    this.muted = m;
    if (this.ctx) this.ctx.suspend();
    if (!m && this.ctx) this.ctx.resume();
  }

  _tone(freq, dur, type, vol, slideTo) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(this.ctx.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  _noise(dur, vol, filterFreq) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filterFreq || 800;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.ctx.destination);
    src.start(t);
  }

  blip() { this._tone(880, 0.12, 'sine', 0.18, 1320); }
  pickup() { this._tone(660, 0.1, 'triangle', 0.2, 990); setTimeout(() => this._tone(990, 0.14, 'triangle', 0.2, 1320), 90); }
  punch() { this._noise(0.12, 0.3, 500); this._tone(140, 0.1, 'square', 0.15, 70); }
  coin() { this._tone(1046, 0.09, 'sine', 0.2); setTimeout(() => this._tone(1568, 0.18, 'sine', 0.2), 80); }
  missionDone() {
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this._tone(f, 0.22, 'triangle', 0.22), i * 110));
  }
  crash() { this._noise(0.3, 0.4, 400); this._tone(90, 0.25, 'sawtooth', 0.2, 45); }
  busted() { this._tone(220, 0.5, 'sawtooth', 0.25, 110); setTimeout(() => this._tone(165, 0.6, 'sawtooth', 0.25, 82), 250); }
  steal() { this._tone(300, 0.08, 'square', 0.15, 600); }

  // Continuous engine hum; call every frame with speed 0..1.
  engine(speed01, on) {
    if (!this.ctx || this.muted) return;
    if (!on) {
      if (this.engineOsc) {
        try { this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1); } catch (e) {}
      }
      return;
    }
    if (!this.engineOsc) {
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 420;
      this.engineOsc.connect(f);
      f.connect(this.engineGain);
      this.engineGain.connect(this.ctx.destination);
      this.engineOsc.start();
    }
    const t = this.ctx.currentTime;
    this.engineOsc.frequency.setTargetAtTime(55 + speed01 * 130, t, 0.08);
    this.engineGain.gain.setTargetAtTime(0.05 + speed01 * 0.06, t, 0.1);
  }

  // Two-tone police siren; call with on=true/false.
  siren(on) {
    if (!this.ctx || this.muted) { on = false; }
    if (on === this.sirenOn) return;
    this.sirenOn = on;
    if (!on) {
      if (this.sirenOscA) {
        try { this.sirenOscA.stop(); this.sirenOscB.stop(); } catch (e) {}
        this.sirenOscA = null;
        this.sirenOscB = null;
      }
      return;
    }
    if (!this.ctx) return;
    this.sirenOscA = this.ctx.createOscillator();
    this.sirenOscB = this.ctx.createOscillator();
    this.sirenOscA.type = 'sine';
    this.sirenOscB.type = 'sine';
    this.sirenOscA.frequency.value = 700;
    this.sirenOscB.frequency.value = 950;
    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.value = 0.045;
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 1.4;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 0.03;
    lfo.connect(lfoGain);
    lfoGain.connect(this.sirenGain.gain);
    this.sirenOscA.connect(this.sirenGain);
    this.sirenOscB.connect(this.sirenGain);
    this.sirenGain.connect(this.ctx.destination);
    this.sirenOscA.start();
    this.sirenOscB.start();
    lfo.start();
  }
}
