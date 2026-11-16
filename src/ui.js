import * as THREE from 'three';

const $ = id => document.getElementById(id);

// アイテムのアイコン（SVG）
const ICON = {
  spray: `<svg viewBox="0 0 40 40"><rect x="13" y="12" width="14" height="24" rx="2" fill="#cfd8dc" stroke="#e6eee4" stroke-width="1.2"/><rect x="13" y="20" width="14" height="8" fill="#5fb3e0"/><rect x="16" y="6" width="8" height="6" fill="#9aa4a8"/><rect x="22" y="6" width="7" height="3" fill="#9aa4a8"/><circle cx="33" cy="6" r="1.2" fill="#e6eee4"/><circle cx="35" cy="9" r="1" fill="#e6eee4"/><circle cx="33" cy="11" r="0.8" fill="#e6eee4"/></svg>`,
  gum: `<svg viewBox="0 0 40 40"><rect x="7" y="13" width="26" height="14" rx="2" fill="#7fe0c4" stroke="#e6eee4" stroke-width="1.2"/><rect x="7" y="17" width="26" height="6" fill="#e6fff6"/><path d="M14 20h12" stroke="#2f9c7c" stroke-width="2"/></svg>`,
  cig: `<svg viewBox="0 0 40 40"><g transform="rotate(-30 20 20)"><rect x="4" y="17" width="26" height="6" fill="#f2f2ee" stroke="#e6eee4"/><rect x="4" y="17" width="9" height="6" fill="#d9944a"/><rect x="30" y="17" width="3" height="6" fill="#ff5a1f"/></g><circle cx="34" cy="9" r="2" fill="rgba(220,220,230,.6)"/><circle cx="31" cy="5" r="2.6" fill="rgba(220,220,230,.4)"/></svg>`,
  heat: `<svg viewBox="0 0 40 40"><rect x="14" y="8" width="13" height="28" rx="4" fill="#3d4148" stroke="#e6eee4" stroke-width="1.2"/><rect x="17" y="3" width="7" height="8" fill="#e8e6dc"/><circle cx="20.5" cy="25" r="2.2" fill="#5fe0ff"/></svg>`,
};

export class UI {
  constructor() {
    this.bubbles = [];
    this.toastTimer = null;
    this.typeTimer = null;
    this.radarDirty = true;
    this.rc = $('radar').getContext('2d');
    this.v = new THREE.Vector3();
    this.cache = {};
    this.onClearCb = () => {};
    this.onFailCb = () => {};
    $('ico-spray').innerHTML = ICON.spray;
    $('ico-gum').innerHTML = ICON.gum;
  }

  show(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('show', s.id === id));
  }
  hideScreens() { document.querySelectorAll('.screen').forEach(s => s.classList.remove('show')); }
  hud_visible(v) { $('hud').classList.toggle('hidden', !v); }
  letterbox(on) { $('letterbox').classList.toggle('on', on); }

  // 無線風に1文字ずつ表示
  toast(text, ms = 2400) {
    const t = $('toast');
    const el = $('toast-text');
    clearInterval(this.typeTimer);
    clearTimeout(this.toastTimer);
    if (!text) { t.classList.remove('show'); return; }
    let i = 0;
    el.textContent = '';
    this.typeTimer = setInterval(() => {
      i += 2;
      el.textContent = text.slice(0, i);
      if (i >= text.length) clearInterval(this.typeTimer);
    }, 16);
    t.classList.add('show');
    this.toastTimer = setTimeout(() => t.classList.remove('show'), ms + text.length * 8);
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
      this.v.y += 3.05 * b.obj.scale.y;
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
    this.wind = w;
    const arrow = $('wind-arrow');
    if (w.s < 0.05) {
      arrow.textContent = '・';
      $('wind-text').textContent = '無風';
      return;
    }
    arrow.textContent = '➤';
    $('wind-text').textContent = w.s > 0.65 ? '強' : '中';
  }

  // ---------------------------------------------------------------- radar
  radarInit(game) {
    this.game = game;
    this.radarDirty = true;
  }

  buildRadarBase(game, k) {
    const W = game.W * 2, H = game.H * 2; // ワールド単位
    const pad = 40;
    const b = document.createElement('canvas');
    b.width = Math.ceil((W + pad * 2) * k);
    b.height = Math.ceil((H + pad * 2) * k);
    const g = b.getContext('2d');
    const ts = 2 * k;
    const o = pad * k;
    // マップ外は壁扱い
    g.fillStyle = 'rgba(80,200,120,0.32)';
    g.fillRect(0, 0, b.width, b.height);
    g.clearRect(o, o, W * k, H * k);
    for (let y = 0; y < game.H; y++) for (let x = 0; x < game.W; x++) {
      const ch = game.tile(x, y);
      if (ch === '#') { g.fillStyle = 'rgba(80,200,120,0.32)'; g.fillRect(o + x * ts, o + y * ts, ts + 0.5, ts + 0.5); }
      else if (ch === 'T') { g.fillStyle = 'rgba(80,200,120,0.5)'; g.beginPath(); g.arc(o + (x + 0.5) * ts, o + (y + 0.5) * ts, ts * 0.35, 0, Math.PI * 2); g.fill(); }
      else if (ch === '.') { g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(o + x * ts, o + y * ts, ts + 0.5, ts + 0.5); }
    }
    // 建物の輪郭
    g.strokeStyle = 'rgba(150,255,180,0.75)';
    g.lineWidth = 1.5;
    g.beginPath();
    for (let y = -1; y <= game.H; y++) for (let x = -1; x <= game.W; x++) {
      if (!game.solidTile(x, y) || game.tile(x, y) === 'T') continue;
      const px = o + x * ts, py = o + y * ts;
      if (!game.solidTile(x, y - 1) && y - 1 >= 0) { g.moveTo(px, py); g.lineTo(px + ts, py); }
      if (!game.solidTile(x, y + 1) && y + 1 < game.H) { g.moveTo(px, py + ts); g.lineTo(px + ts, py + ts); }
      if (!game.solidTile(x - 1, y) && x - 1 >= 0) { g.moveTo(px, py); g.lineTo(px, py + ts); }
      if (!game.solidTile(x + 1, y) && x + 1 < game.W) { g.moveTo(px + ts, py); g.lineTo(px + ts, py + ts); }
    }
    g.stroke();
    // 場所
    const dot = (x, y, color, r = ts * 0.32) => { g.fillStyle = color; g.beginPath(); g.arc(o + (x + 0.5) * ts, o + (y + 0.5) * ts, r, 0, Math.PI * 2); g.fill(); };
    for (const pl of game.places) {
      if (pl.type === 'S' || pl.type === 'X') {
        if (pl.revealed) {
          g.strokeStyle = '#ff5a40'; g.lineWidth = 2.5;
          const cx = o + (pl.x + 0.5) * ts, cy = o + (pl.y + 0.5) * ts, r = ts * 0.3;
          g.beginPath(); g.moveTo(cx - r, cy - r); g.lineTo(cx + r, cy + r); g.moveTo(cx + r, cy - r); g.lineTo(cx - r, cy + r); g.stroke();
        } else { dot(pl.x, pl.y, '#4cff7a'); g.strokeStyle = '#4cff7a'; g.lineWidth = 1.5; g.beginPath(); g.arc(o + (pl.x + 0.5) * ts, o + (pl.y + 0.5) * ts, ts * 0.5, 0, Math.PI * 2); g.stroke(); }
      } else dot(pl.x, pl.y, { H: '#c89aff', K: '#e0a070', C: '#6cc8ff' }[pl.type]);
    }
    if (game.goal) {
      g.strokeStyle = '#ff5a40'; g.lineWidth = 2.5;
      g.strokeRect(o + game.goal.x * ts + 2, o + game.goal.y * ts + 2, ts - 4, ts - 4);
    }
    this.base = b;
    this.baseK = k;
    this.basePad = pad;
    this.radarDirty = false;
  }

  drawRadar(game) {
    const c = this.rc;
    const S = c.canvas.width, R = S / 2;
    const k = R / 24; // 半径24m
    if (this.radarDirty || !this.base || this.baseK !== k || this.baseGame !== game.stage) { this.buildRadarBase(game, k); this.baseGame = game.stage; }
    const p = game.player;
    const yaw = game.camState.yaw;
    const t = performance.now() / 1000;
    const phase = game.phase;

    c.save();
    c.fillStyle = phase === 'alert' ? '#1a0606' : phase === 'caution' ? '#141006' : '#04120a';
    c.fillRect(0, 0, S, S);
    // 固定の格子
    c.strokeStyle = 'rgba(120,255,160,0.08)';
    c.lineWidth = 1;
    for (let i = 0; i <= S; i += S / 8) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, S); c.moveTo(0, i); c.lineTo(S, i); c.stroke(); }

    // ワールドを回転させて描く（カメラの前が上）
    c.translate(R, R);
    c.rotate(yaw);
    c.translate(-p.pos.x * k, -p.pos.z * k);
    const o = this.basePad * k;
    c.drawImage(this.base, -o, -o);

    // 匂いの輪
    const sm = game.smellCenter();
    c.fillStyle = 'rgba(179,140,255,0.16)';
    c.strokeStyle = 'rgba(200,160,255,0.85)';
    c.lineWidth = 2;
    c.beginPath(); c.arc(sm.x * k, sm.z * k, sm.r * k, 0, Math.PI * 2); c.fill(); c.stroke();

    // 視線と人
    for (const n of game.npcs) {
      if (n.cone) {
        const pos = n.cone.geometry.attributes.position;
        const sus = Math.min(1, n.sus);
        const red = n.cd > 2.5 || n.state === 'chase';
        c.fillStyle = red ? 'rgba(255,60,40,0.42)' : `rgba(255,${Math.round(220 - sus * 170)},60,${0.16 + sus * 0.25})`;
        c.beginPath();
        c.moveTo(pos.getX(0) * k, pos.getZ(0) * k);
        for (let i = 1; i < pos.count; i++) c.lineTo(pos.getX(i) * k, pos.getZ(i) * k);
        c.closePath();
        c.fill();
      }
      const x = n.pos.x * k, z = n.pos.z * k;
      c.fillStyle = n.cfg.friendly ? '#6cd0ff' : n.type === 'guide' ? '#ffd23a' : '#ff4a3a';
      c.beginPath(); c.arc(x, z, 7, 0, Math.PI * 2); c.fill();
      c.strokeStyle = 'rgba(0,0,0,0.7)'; c.lineWidth = 2; c.stroke();
      if (n.type === 'guide') { c.strokeStyle = '#ffd23a'; c.lineWidth = 2; c.beginPath(); c.arc(x, z, 11, 0, Math.PI * 2); c.stroke(); }
    }
    if (game.boss) {
      c.fillStyle = '#ff9a3a';
      c.fillRect(game.boss.position.x * k - 6, game.boss.position.z * k - 6, 12, 12);
    }
    c.restore();

    // 自分（中央）
    const cs = Math.cos(yaw), sn = Math.sin(yaw);
    const fx = Math.sin(p.facing), fz = Math.cos(p.facing);
    const ax = fx * cs - fz * sn, ay = fx * sn + fz * cs;
    // カメラの視野
    const fov = (game.camera.fov * game.camera.aspect * Math.PI) / 360;
    const vg = c.createRadialGradient(R, R, 0, R, R, R * 0.8);
    vg.addColorStop(0, 'rgba(169,240,184,0.18)');
    vg.addColorStop(1, 'rgba(169,240,184,0)');
    c.fillStyle = vg;
    c.beginPath(); c.moveTo(R, R); c.arc(R, R, R * 0.8, -Math.PI / 2 - Math.min(1.2, fov), -Math.PI / 2 + Math.min(1.2, fov)); c.closePath(); c.fill();
    c.save();
    c.translate(R, R);
    c.rotate(Math.atan2(ay, ax) + Math.PI / 2);
    c.fillStyle = '#ffffff';
    c.strokeStyle = '#04120a';
    c.lineWidth = 2;
    c.beginPath(); c.moveTo(0, -13); c.lineTo(9, 9); c.lineTo(0, 4); c.lineTo(-9, 9); c.closePath(); c.fill(); c.stroke();
    c.restore();

    // 目的地が外にあるときは縁に矢印
    const targets = [];
    if (p.hasSmoked && game.goal) targets.push([game.tc(game.goal.x), game.tc(game.goal.y), '#ff5a40']);
    else for (const pl of game.places) if ((pl.type === 'S' || pl.type === 'X') && !pl.revealed) targets.push([game.tc(pl.x), game.tc(pl.y), '#4cff7a']);
    for (const [wx, wz, col] of targets) {
      const dx = wx - p.pos.x, dz = wz - p.pos.z;
      const sx = (dx * cs - dz * sn) * k, sy = (dx * sn + dz * cs) * k;
      const m = Math.max(Math.abs(sx), Math.abs(sy));
      if (m < R - 10) continue;
      const f = (R - 12) / m;
      c.save();
      c.translate(R + sx * f, R + sy * f);
      c.rotate(Math.atan2(sy, sx));
      c.fillStyle = col;
      c.beginPath(); c.moveTo(9, 0); c.lineTo(-6, -7); c.lineTo(-6, 7); c.closePath(); c.fill();
      c.restore();
    }

    // 風向き
    if (this.wind && this.wind.s >= 0.05) {
      const wx = this.wind.x, wz = this.wind.z;
      const a = Math.atan2(wx * sn + wz * cs, wx * cs - wz * sn);
      $('wind-arrow').style.transform = `rotate(${(a * 180) / Math.PI}deg)`;
    }

    // スキャンの帯
    const sw = (t * 1.6) % (Math.PI * 2);
    const sg = c.createConicGradient ? c.createConicGradient(sw - 0.6, R, R) : null;
    if (sg) {
      sg.addColorStop(0, 'rgba(120,255,160,0)');
      sg.addColorStop(0.09, 'rgba(120,255,160,0.16)');
      sg.addColorStop(0.0955, 'rgba(120,255,160,0)');
      sg.addColorStop(1, 'rgba(120,255,160,0)');
      c.fillStyle = sg;
      c.fillRect(0, 0, S, S);
    }

    // 警戒中はノイズ
    if (phase === 'alert') {
      c.fillStyle = 'rgba(255,40,30,0.14)';
      c.fillRect(0, 0, S, S);
      for (let i = 0; i < 26; i++) {
        c.fillStyle = `rgba(255,${Math.random() * 120},${Math.random() * 80},${Math.random() * 0.35})`;
        c.fillRect(0, Math.random() * S, S, 1 + Math.random() * 4);
      }
    } else if (phase === 'caution') {
      c.fillStyle = 'rgba(255,176,32,0.08)';
      c.fillRect(0, 0, S, S);
    }
    // 外周
    c.strokeStyle = phase === 'alert' ? 'rgba(255,59,47,0.8)' : phase === 'caution' ? 'rgba(255,176,32,0.7)' : 'rgba(169,240,184,0.5)';
    c.lineWidth = 3;
    c.strokeRect(1.5, 1.5, S - 3, S - 3);
  }

  // ---------------------------------------------------------------- HUD
  set(id, prop, val) {
    const key = id + prop;
    if (this.cache[key] === val) return;
    this.cache[key] = val;
    const el = $(id);
    if (prop === 'text') el.textContent = val;
    else if (prop === 'html') el.innerHTML = val;
    else if (prop === 'width') el.style.width = val;
    else if (prop === 'left') el.style.left = val;
    else if (prop === 'class') el.className = val;
  }

  hud(game) {
    const p = game.player;
    const st = game.stage;
    this.set('hud-stage', 'text', `${st.sub}　${st.name}`);
    this.set('hud-clock', 'text', game.clock());
    const remain = st.minutes - game.gameMin();
    this.set('hud-clock', 'class', remain < 10 ? 'hud-clock warn' : 'hud-clock');
    this.set('hud-limit', 'text', `残り ${Math.max(0, Math.ceil(remain))} 分`);
    this.set('hud-objective', 'text', game.objective);
    const setBar = (id, v, low) => {
      this.set(id, 'width', `${Math.max(0, Math.min(100, v)).toFixed(1)}%`);
      const g = $(id).parentElement.parentElement;
      if (g.classList.contains('low') !== low) g.classList.toggle('low', low);
    };
    setBar('g-nic', p.nic, p.nic < 15);
    setBar('g-men', p.mental, p.mental < 30);
    setBar('g-aura', game.residual() * 100, false);
    const th = (st.goalCheck.threshold - 1.2) / (7.0 - 1.2) * 100;
    this.set('g-line', 'left', `${th}%`);
    $('g-line').title = `${st.goalCheck.who}のチェック基準`;

    // 装備とアイテム
    this.set('eq-icon', 'html', p.mode === 'cig' ? ICON.cig : ICON.heat);
    this.set('eq-name', 'text', p.mode === 'cig' ? '紙巻き' : '加熱式');
    this.set('eq-count', 'text', String(p.mode === 'cig' ? p.cigs : p.battery));
    this.set('eq-sub', 'text', (p.mode === 'cig' ? `加熱式 電池${p.battery}` : `紙巻き ${p.cigs}本`) + (p.torch ? '　ライター' : ''));
    this.set('n-spray', 'text', String(p.sprays));
    this.set('n-gum', 'text', String(p.gums));
    this.set('box-spray', 'class', `item-box frame${p.sprays ? '' : ' empty'}`);
    this.set('box-gum', 'class', `item-box frame${p.gums ? '' : ' empty'}`);
    this.set('money', 'text', `¥${p.money}`);
    const stance = p.running ? ['RUN', 'stance run'] : p.crouch ? ['CROUCH', 'stance crouch'] : ['STAND', 'stance'];
    this.set('stance', 'text', stance[0]);
    this.set('stance', 'class', stance[1]);

    // 警戒フェーズ
    const ph = game.phase;
    this.set('phase', 'text', ph === 'alert' ? 'ALERT' : ph === 'caution' ? 'CAUTION' : 'RADAR');
    const tt = ph === 'alert' ? game.alertT : ph === 'caution' ? game.cautionT : 0;
    this.set('phase-t', 'text', tt > 0 ? tt.toFixed(2).padStart(5, '0') : '');
    const rb = document.querySelector('.radar-box');
    if (rb.dataset.ph !== ph) { rb.dataset.ph = ph; rb.classList.toggle('alert', ph === 'alert'); rb.classList.toggle('caution', ph === 'caution'); }

    // その場でできること
    const pl = game.placeAt();
    let hint = '';
    const K = s => `<b>${s}</b>`;
    if (p.smoking) hint = p.smoking.error > 0 ? `${K('SPACE')}連打！` : p.smoking.wait > 0 ? '並んでいる…' : '一服中…';
    else if (pl) {
      if ((pl.type === 'X' && pl.revealed) || pl.closed) hint = '使えない…';
      else if (pl.type === 'S' || pl.type === 'X') hint = `${K('SPACE')}一服する`;
      else if (pl.type === 'H') hint = `${K('SPACE')}一服する（加熱式のみ）`;
      else if (pl.type === 'K') hint = `${K('SPACE')}コーヒーを頼んで一服（500円）`;
      else if (pl.type === 'C') hint = `${K('SPACE')}手洗い＋消臭スプレー購入`;
    } else if (p.streetConfirm > 0) hint = `${K('SPACE')}もう一度で路上喫煙を強行`;
    else if (p.hasSmoked && p.aura > st.goalCheck.threshold && Math.hypot(game.tc(game.goal.x) - p.pos.x, game.tc(game.goal.y) - p.pos.z) < 8) hint = `まだ臭う！ ${st.goalCheck.who}にバレる`;
    this.set('hint', 'html', hint);
    const hel = $('hint');
    if (hel.classList.contains('show') !== !!hint) hel.classList.toggle('show', !!hint);
    this.drawRadar(game);
  }

  onClear(r) { this.onClearCb(r); }
  onFail(f) { this.onFailCb(f); }
}
