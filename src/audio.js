// 効果音とBGMはすべてWeb Audioで合成（音声ファイル不要）
export class Audio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.bgmTimer = null;
    this.step = 0;
    this.tension = 0; // 0..1 ニコチン切れ・危険時にテンポと音程が上がる
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.6;
      this.master.connect(this.ctx.destination);
      this.noiseBuf = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.5, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.6;
  }

  tone(freq, dur, { type = 'square', vol = 0.15, slide = 0, delay = 0 } = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  noise(dur, { freq = 3000, q = 1, vol = 0.3, delay = 0, type = 'bandpass' } = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.master);
    s.start(t);
    s.stop(t + dur + 0.02);
  }

  tsk() { // 舌打ち
    this.noise(0.04, { freq: 4200, q: 6, vol: 0.9 });
    this.noise(0.03, { freq: 2600, q: 8, vol: 0.5, delay: 0.05 });
  }
  lighter() {
    this.noise(0.03, { freq: 6000, q: 3, vol: 0.6 });
    this.noise(0.35, { freq: 900, q: 0.7, vol: 0.18, delay: 0.05 });
  }
  exhale() { this.noise(0.9, { freq: 500, q: 0.5, vol: 0.25, type: 'lowpass' }); }
  beep() { this.tone(880, 0.08, { vol: 0.08 }); }
  ok() { this.tone(660, 0.08, { vol: 0.1 }); this.tone(990, 0.12, { vol: 0.1, delay: 0.08 }); }
  bad() { this.tone(300, 0.25, { type: 'sawtooth', vol: 0.12, slide: -150 }); }
  alert() { this.tone(1200, 0.07, { vol: 0.12 }); this.tone(1600, 0.1, { vol: 0.12, delay: 0.08 }); }
  error() { for (let i = 0; i < 3; i++) this.tone(180, 0.06, { type: 'square', vol: 0.12, delay: i * 0.09 }); }
  spray() { this.noise(0.5, { freq: 7000, q: 0.4, vol: 0.25, type: 'highpass' }); }
  fail() {
    [523, 415, 330, 247].forEach((f, i) => this.tone(f, 0.22, { type: 'triangle', vol: 0.18, delay: i * 0.16 }));
  }
  clear() {
    [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.18, { type: 'square', vol: 0.1, delay: i * 0.1 }));
  }

  startBgm() {
    if (!this.ctx || this.bgmTimer) return;
    const bass = [55, 55, 65.4, 55, 49, 49, 58.3, 61.7];
    const tick = () => {
      if (!this.ctx) return;
      const s = this.step++;
      const n = bass[Math.floor(s / 2) % bass.length] * (1 + this.tension * 0.06);
      if (s % 2 === 0) this.tone(n, 0.22, { type: 'triangle', vol: 0.16 });
      if (s % 4 === 2) this.noise(0.04, { freq: 8000, q: 1, vol: 0.06, type: 'highpass' });
      if (s % 8 === 4) this.noise(0.08, { freq: 1800, q: 1.2, vol: 0.08 });
      if (this.tension > 0.6 && s % 4 === 0) this.tone(n * 8, 0.05, { vol: 0.03 });
      const bpm = 104 + this.tension * 40;
      this.bgmTimer = setTimeout(tick, (60 / bpm / 2) * 1000);
    };
    tick();
  }
  stopBgm() {
    clearTimeout(this.bgmTimer);
    this.bgmTimer = null;
  }
}
