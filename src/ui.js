import * as THREE from 'three';

const $ = id => document.getElementById(id);

export class UI {
  constructor() {
    this.bubbles = [];
    this.toastTimer = null;
    this.minimapDirty = true;
    this.mm = $('minimap');
    this.mmCtx = this.mm.getContext('2d');
    this.v = new THREE.Vector3();
    this.onClearCb = () => {};
    this.onFailCb = () => {};
  }

  show(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('show', s.id === id));
  }
  hideScreens() { document.querySelectorAll('.screen').forEach(s => s.classList.remove('show')); }
  hud_visible(v) { $('hud').classList.toggle('hidden', !v); }

  toast(text, ms = 2400) {
    const t = $('toast');
    t.textContent = text;
    t.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => t.classList.remove('show'), ms);
  }

  bubble(obj, text, cls = 'npc', dur = 1.5) {
    const old = this.bubbles.find(b => b.obj === obj);
    if (old) { old.el.remove(); this.bubbles.splice(this.bubbles.indexOf(old), 1); }
    const el = document.createElement('div');
    el.className = `bubble ${cls}`;
    el.textContent = text;
    $('bubbles').appendChild(el);
    this.bubbles.push({ el, obj, until: performance.now() + dur * 1000 });
  }

  clearBubbles() {
    this.bubbles.forEach(b => b.el.remove());
    this.bubbles = [];
  }

  updateBubbles(camera) {
    const now = performance.now();
    const w = window.innerWidth, h = window.innerHeight;
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i];
      if (now > b.until) { b.el.remove(); this.bubbles.splice(i, 1); continue; }
      b.obj.getWorldPosition(this.v);
      this.v.y += 2.6 * b.obj.scale.y;
      this.v.project(camera);
      b.el.style.left = `${((this.v.x + 1) / 2) * w}px`;
      b.el.style.top = `${((1 - this.v.y) / 2) * h}px`;
      b.el.style.display = this.v.z > 1 ? 'none' : '';
    }
  }

  flash() {
    const f = $('flash');
    f.classList.add('on');
    requestAnimationFrame(() => requestAnimationFrame(() => f.classList.remove('on')));
  }

  setWind(w) {
    const arrow = $('wind-arrow');
    if (w.s < 0.05) {
      arrow.style.transform = 'none';
      arrow.textContent = '・';
      $('wind-text').textContent = '無風';
      return;
    }
    arrow.textContent = '➤';
    arrow.style.transform = `rotate(${(Math.atan2(w.z, w.x) * 180) / Math.PI}deg)`;
    $('wind-text').textContent = w.s > 0.65 ? '強い' : 'ふつう';
  }

  // ---------------------------------------------------------------- minimap
  minimapInit(game) {
    this.game = game;
    this.minimapDirty = true;
  }

  drawMinimap(game) {
    const c = this.mmCtx;
    const W = game.W, H = game.H;
    const s = Math.min(this.mm.width / W, this.mm.height / H);
    const ox = (this.mm.width - W * s) / 2, oy = (this.mm.height - H * s) / 2;
    if (this.minimapDirty || !this.base) {
      const b = document.createElement('canvas');
      b.width = this.mm.width; b.height = this.mm.height;
      const g = b.getContext('2d');
      const col = { '#': '#55575e', '.': '#24262b', ',': '#6f6b62', g: '#3e6a35', T: '#2d4a2d' };
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const ch = game.tile(x, y);
        g.fillStyle = col[ch] || '#6f6b62';
        g.fillRect(ox + x * s, oy + y * s, s + 0.5, s + 0.5);
      }
      const dot = (x, y, color, r = s * 0.9) => { g.fillStyle = color; g.beginPath(); g.arc(ox + (x + 0.5) * s, oy + (y + 0.5) * s, r, 0, Math.PI * 2); g.fill(); };
      for (const pl of game.places) {
        if (pl.type === 'S' || pl.type === 'X') {
          if (pl.revealed) {
            g.strokeStyle = '#e5533d'; g.lineWidth = 2;
            const cx = ox + (pl.x + 0.5) * s, cy = oy + (pl.y + 0.5) * s, r = s * 0.8;
            g.beginPath(); g.moveTo(cx - r, cy - r); g.lineTo(cx + r, cy + r); g.moveTo(cx + r, cy - r); g.lineTo(cx - r, cy + r); g.stroke();
          } else dot(pl.x, pl.y, '#4cd964');
        } else dot(pl.x, pl.y, { H: '#b07ae0', K: '#c08a5a', C: '#56b4f0' }[pl.type]);
      }
      if (game.goal) { g.fillStyle = '#e5533d'; g.fillRect(ox + game.goal.x * s - 1, oy + game.goal.y * s - 1, s + 2, s + 2); }
      this.base = b;
      this.minimapDirty = false;
    }
    c.clearRect(0, 0, this.mm.width, this.mm.height);
    c.drawImage(this.base, 0, 0);
    const p = game.player;
    const px = ox + (p.pos.x / 2) * s, py = oy + (p.pos.z / 2) * s;
    c.fillStyle = '#ffe066';
    c.beginPath(); c.arc(px, py, 3.5, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#ffe066'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(px, py); c.lineTo(px + Math.sin(p.facing) * 7, py + Math.cos(p.facing) * 7); c.stroke();
    // 匂いの輪
    const sm = game.smellCenter();
    c.strokeStyle = 'rgba(180,140,230,0.8)'; c.lineWidth = 1;
    c.beginPath(); c.arc(ox + (sm.x / 2) * s, oy + (sm.z / 2) * s, (sm.r / 2) * s, 0, Math.PI * 2); c.stroke();
  }

  // ---------------------------------------------------------------- HUD
  hud(game) {
    const p = game.player;
    const st = game.stage;
    $('hud-stage').textContent = `${st.sub}　${st.name}`;
    const clock = $('hud-clock');
    clock.textContent = game.clock();
    const remain = st.minutes - game.gameMin();
    clock.classList.toggle('warn', remain < 10);
    $('hud-limit').textContent = `残り ${Math.max(0, Math.ceil(remain))} 分`;
    $('hud-objective').textContent = game.objective;
    const setBar = (id, v, low) => {
      $(id).style.width = `${Math.max(0, Math.min(100, v))}%`;
      $(id).parentElement.parentElement.classList.toggle('low', low);
    };
    setBar('g-nic', p.nic, p.nic < 15);
    setBar('g-men', p.mental, p.mental < 30);
    const res = game.residual() * 100;
    setBar('g-aura', res, false);
    const th = (st.goalCheck.threshold - 1.2) / (7.0 - 1.2) * 100;
    $('g-line').style.left = `${th}%`;
    $('g-line').title = `${st.goalCheck.who}のチェック基準`;
    const mode = p.mode === 'cig'
      ? `<b>紙巻き</b> 残り${p.cigs}本　<span style="opacity:.6">加熱式 電池${p.battery}</span>`
      : `<b>加熱式</b> 電池${p.battery}回　<span style="opacity:.6">紙巻き ${p.cigs}本</span>`;
    $('inv-mode').innerHTML = mode + (p.torch ? '　🔥ライター' : '');
    $('inv-items').textContent = `Q 消臭スプレー×${p.sprays}　E ミントガム×${p.gums}　所持金 ${p.money}円`;

    // その場でできること
    const pl = game.placeAt();
    let hint = '';
    if (p.smoking) hint = p.smoking.error > 0 ? '連打！ Space' : p.smoking.wait > 0 ? '並んでいる…' : '一服中…';
    else if (pl) {
      if ((pl.type === 'X' && pl.revealed) || pl.closed) hint = '使えない…';
      else if (pl.type === 'S' || pl.type === 'X') hint = 'Space：一服する';
      else if (pl.type === 'H') hint = 'Space：一服する（加熱式のみ）';
      else if (pl.type === 'K') hint = 'Space：コーヒーを頼んで一服（500円）';
      else if (pl.type === 'C') hint = 'Space：手洗い＋消臭スプレー購入';
    } else if (p.streetConfirm > 0) hint = 'もう一度 Space で路上喫煙を強行';
    else if (p.hasSmoked && p.aura > st.goalCheck.threshold && Math.hypot(game.tc(game.goal.x) - p.pos.x, game.tc(game.goal.y) - p.pos.z) < 8) hint = `まだ臭う！ ${st.goalCheck.who}にバレる`;
    $('hint').textContent = hint;
    $('hint').classList.toggle('show', !!hint);
    this.drawMinimap(game);
  }

  onClear(r) { this.onClearCb(r); }
  onFail(f) { this.onFailCb(f); }
}
