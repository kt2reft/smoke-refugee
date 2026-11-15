import * as THREE from 'three';
import { badgeTexture, signTexture, radialTexture, puffTexture, windowTexture } from './textures.js';

export const T = 2;               // 1マスの大きさ（ワールド単位）
const PLAYER_R = 0.42;
const BASE_AURA = 1.2;            // 染みついた匂い（マス）
const MAX_AURA = { cig: 7.0, heat: 3.6 };
const NIC_GAIN = { cig: 100, heat: 70 };
const SMOKE_TIME = { cig: 3.0, heat: 2.6 };
const HEAT_WARMUP = 1.4;

const NPC_TYPES = {
  walker:    { speed: 1.5, fov: 62, range: 5.0, dmg: 10, sens: 1.0, smellMul: 1.0, cause: '通りすがりの舌打ち',
               lines: ['チッ', '…くさっ', 'チッ…'] },
  parent:    { speed: 1.0, fov: 70, range: 5.0, dmg: 28, sens: 1.4, smellMul: 1.1, cause: '風下に子ども連れ',
               lines: ['子どもいるんですけど', '…行こ', 'ちょっと…'] },
  sensitive: { speed: 1.4, fov: 62, range: 6.0, dmg: 18, sens: 1.8, smellMul: 1.6, cause: '嗅覚の鋭い人に追い詰められた',
               lines: ['ゲホッ！', 'うわ、くっさ', '誰！？'], chase: true },
  guide:     { speed: 1.4, fov: 52, range: 7.0, dmg: 15, sens: 1.0, smellMul: 1.0, cause: '路上喫煙指導員の注意',
               lines: ['ちょっと、におい…', 'ん？'] },
  relative:  { speed: 0.9, fov: 80, range: 5.0, dmg: 25, sens: 1.3, smellMul: 1.1, cause: '親戚の冷たい視線',
               lines: ['あら…', '…まあ', 'タバコ？'] },
  ally:      { speed: 0, still: true, friendly: true },
};

const TIMEOUT_TEXT = {
  s1: '昼休み終了（遅刻）', s2: '昼休み終了（遅刻）', s3: '昼休み終了（遅刻）',
  s4: '新幹線が発車した', s5: '乾杯に間に合わなかった',
};
const GOAL_LABEL = { s1: '職場', s2: '職場', s3: '職場', s4: '乗車', s5: '式場' };
const THEME = { s1: 'street', s2: 'street', s3: 'rain', s4: 'station', s5: 'garden' };

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
function hashStr(s) { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
const fmtClock = (start, min) => {
  const [h, m] = start.split(':').map(Number);
  const t = h * 60 + m + Math.floor(min);
  return `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};

export class Game {
  constructor(renderer, ui, audio) {
    this.renderer = renderer;
    this.ui = ui;
    this.audio = audio;
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.5, 300);
    this.puffTex = puffTexture();
    this.auraTex = radialTexture('rgba(170,130,210,0.55)', 'rgba(150,120,190,0.25)');
    this.winTex = windowTexture();
  }

  resize(w, h) {
    this.camera.aspect = w / h;
    this.camera.fov = w < h ? 50 : 34;
    this.camera.updateProjectionMatrix();
  }

  // ------------------------------------------------------------------ build
  load(stage, ghost) {
    this.stage = stage;
    this.theme = THEME[stage.id] || 'street';
    this.map = stage.map.map(r => r.split(''));
    this.H = this.map.length;
    this.W = this.map[0].length;
    this.rand = rng(hashStr(stage.id));
    this.runRand = rng((Date.now() ^ hashStr(stage.id)) >>> 0);

    if (this.scene) this.dispose();
    const scene = (this.scene = new THREE.Scene());
    const sky = { street: 0xbcd7ee, rain: 0x6f7b88, station: 0x9aa3ad, garden: 0xcfe6f0 }[this.theme];
    scene.background = new THREE.Color(sky);
    scene.fog = new THREE.Fog(sky, 40, this.theme === 'rain' ? 70 : 110);

    const hemi = new THREE.HemisphereLight(0xeef3ff, 0x5c5446, this.theme === 'rain' ? 1.0 : 1.25);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(this.theme === 'garden' ? 0xffe6c4 : 0xfff3e0, this.theme === 'rain' ? 0.7 : this.theme === 'station' ? 0.9 : 1.7);
    sun.position.set(-20, 40, 18);
    sun.target.position.set(this.W * T / 2, 0, this.H * T / 2);
    sun.position.add(sun.target.position);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -45; sc.right = 45; sc.top = 40; sc.bottom = -40; sc.near = 1; sc.far = 140;
    sun.shadow.bias = -0.0008;
    scene.add(sun, sun.target);

    this.places = [];      // 喫煙所や店などの使える場所
    this.markers = [];
    this.buildGround();
    this.buildBuildings();
    this.buildProps();
    this.buildPlayer();
    this.buildNpcs();
    this.buildAura();
    if (this.theme === 'rain') this.buildRain();
    this.ghost = null;
    if (ghost && ghost.frames && ghost.frames.length > 4) this.buildGhost(ghost);

    // 状態
    const p = this.player;
    Object.assign(p, {
      nic: 40, mental: 100, aura: BASE_AURA, mode: 'cig', cigs: 3, battery: 2, money: 800,
      sprays: this.stage.id === 's1' ? 1 : 1, gums: 2, hasSmoked: false, smoking: null, torch: false,
      curse: 0, tsk: 0, running: false, streetConfirm: 0, lastCause: '', inLegal: false, contactCd: 0,
    });
    this.elapsed = 0;
    this.extraMin = 0;
    this.windIdx = 0;
    this.setWind(stage.wind[0]);
    this.over = false;
    this.cleared = false;
    this.record = [];
    this.recordT = 0;
    this.shake = 0;
    this.camPos = null;
    this.objective = '喫煙所を探して一服しろ';
    this.ui.minimapInit(this);
    this.ui.toast(stage.intro, 4200);
  }

  dispose() {
    this.scene.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose());
    });
    this.ui.clearBubbles();
  }

  tile(tx, ty) { return (ty < 0 || ty >= this.H || tx < 0 || tx >= this.W) ? '#' : this.map[ty][tx]; }
  solidTile(tx, ty) { const c = this.tile(tx, ty); return c === '#' || c === 'T'; }
  sightBlock(tx, ty) { const c = this.tile(tx, ty); return c === '#' || c === 'T'; }
  w2t(v) { return Math.floor(v / T); }
  tc(tx) { return tx * T + T / 2; }

  // 道路側を向く方向（店の向き）
  facingOf(tx, ty) {
    const dirs = [[0, 1], [1, 0], [-1, 0], [0, -1]];
    for (const [dx, dy] of dirs) {
      const c = this.tile(tx + dx, ty + dy);
      if ('.,g'.includes(c)) return [dx, dy];
    }
    return [0, 1];
  }

  buildGround() {
    const colors = {
      '.': this.theme === 'rain' ? 0x3b4048 : 0x4a4e57,
      ',': this.theme === 'station' ? 0xc9c4b8 : 0xa59f93,
      'g': 0x6f9b4f,
    };
    const geo = new THREE.BoxGeometry(T, 0.2, T);
    const mat = new THREE.MeshStandardMaterial({ roughness: this.theme === 'rain' ? 0.35 : 0.95, metalness: 0 });
    const cells = [];
    for (let y = 0; y < this.H; y++) for (let x = 0; x < this.W; x++) cells.push([x, y]);
    const inst = new THREE.InstancedMesh(geo, mat, cells.length);
    const m = new THREE.Matrix4();
    const col = new THREE.Color();
    cells.forEach(([x, y], i) => {
      const c = this.tile(x, y);
      let hex = colors[c] ?? colors[','];
      if (c === '#' || c === 'T') hex = this.theme === 'garden' ? 0x6f9b4f : 0x8d877c;
      if ('SX'.includes(c)) hex = 0x8a8478;
      if (c === 'G' || c === 'P') hex = 0x5d7fa8;
      col.setHex(hex);
      const v = ((x * 7 + y * 13) % 5) * 0.012;
      col.offsetHSL(0, 0, v - 0.02);
      m.makeTranslation(this.tc(x), -0.1, this.tc(y));
      inst.setMatrixAt(i, m);
      inst.setColorAt(i, col);
    });
    inst.receiveShadow = true;
    this.scene.add(inst);

    // 道路の白線（車道らしさ）
    if (this.theme !== 'station' && this.theme !== 'garden') {
      const lineMat = new THREE.MeshBasicMaterial({ color: 0xd8d8d0 });
      const lg = new THREE.PlaneGeometry(0.6, 0.12);
      lg.rotateX(-Math.PI / 2);
      const pts = [];
      for (let y = 0; y < this.H; y++) for (let x = 0; x < this.W; x++) {
        if (this.tile(x, y) !== '.') continue;
        const hz = this.tile(x, y + 1) === '.' && this.tile(x, y - 1) !== '.';
        const vt = this.tile(x + 1, y) === '.' && this.tile(x - 1, y) !== '.';
        if (hz && this.tile(x - 1, y) === '.' && this.tile(x + 1, y) === '.') pts.push([this.tc(x), (y + 1) * T, 0]);
        if (vt && this.tile(x, y - 1) === '.' && this.tile(x, y + 1) === '.') pts.push([(x + 1) * T, this.tc(y), 1]);
      }
      const li = new THREE.InstancedMesh(lg, lineMat, Math.max(1, pts.length));
      pts.forEach(([x, z, r], i) => {
        m.makeRotationY(r ? Math.PI / 2 : 0);
        m.setPosition(x, 0.011, z);
        li.setMatrixAt(i, m);
      });
      li.count = pts.length;
      this.scene.add(li);
    }
  }

  buildBuildings() {
    const r = this.rand;
    const palette = {
      street: [0xd9d4c7, 0xc4ccd6, 0xe3d7c1, 0xb7c2b0, 0xcfc2c9, 0xa9b4c2, 0xe6e1d8],
      rain: [0x9aa1a8, 0x8f9a8f, 0xa39a8e, 0x8e96a3, 0xb0a698],
      station: [0xb8bcc2],
      garden: [0xf1ece2],
    }[this.theme];
    const heights = this.theme === 'station' ? [3.0] : this.theme === 'garden' ? [4.0] : [3.0, 4.5, 6.0, 7.5];
    const cells = heights.map(() => []);
    for (let y = 0; y < this.H; y++) for (let x = 0; x < this.W; x++) {
      if (this.tile(x, y) !== '#') continue;
      // 建物は道沿いほど低め、奥ほど高め
      const nearRoad = [[0, 1], [1, 0], [-1, 0], [0, -1]].some(([dx, dy]) => '.,g'.includes(this.tile(x + dx, y + dy)));
      let hi = Math.floor(r() * heights.length);
      if (nearRoad && hi > 1 && r() < 0.5) hi -= 1;
      if (this.theme === 'garden' && !(y <= 6 && x >= 8 && x <= 21)) {
        cells[0].push([x, y, 'hedge']);
        continue;
      }
      cells[hi].push([x, y]);
    }
    this.buildingInst = [];
    const side = new THREE.MeshStandardMaterial({ map: this.theme === 'station' ? null : this.winTex, roughness: 0.85 });
    const top = new THREE.MeshStandardMaterial({ color: 0x9c978e, roughness: 0.9 });
    const m = new THREE.Matrix4();
    const col = new THREE.Color();
    heights.forEach((h, hi) => {
      const list = cells[hi].filter(c => !c[2]);
      if (!list.length) return;
      const geo = new THREE.BoxGeometry(T, h, T);
      geo.translate(0, h / 2, 0);
      const uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) {
        const face = Math.floor(i / 4);
        if (face === 2 || face === 3) continue;
        uv.setXY(i, uv.getX(i), uv.getY(i) * (h / 2.4));
      }
      const inst = new THREE.InstancedMesh(geo, [side, side, top, top, side, side], list.length);
      list.forEach(([x, y], i) => {
        m.makeTranslation(this.tc(x), 0, this.tc(y));
        inst.setMatrixAt(i, m);
        col.setHex(palette[Math.floor(r() * palette.length)]);
        inst.setColorAt(i, col);
      });
      inst.castShadow = true;
      inst.receiveShadow = true;
      this.scene.add(inst);
      this.buildingInst.push({ inst, list, h, cur: list.map(() => 1) });
    });
    // 結婚式場の生け垣（周囲）
    const hedges = cells[0].filter(c => c[2] === 'hedge');
    if (hedges.length) {
      const geo = new THREE.BoxGeometry(T, 1.8, T);
      geo.translate(0, 0.9, 0);
      const inst = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: 0x3f6e3a, roughness: 1 }), hedges.length);
      hedges.forEach(([x, y], i) => { m.makeTranslation(this.tc(x), 0, this.tc(y)); inst.setMatrixAt(i, m); });
      inst.castShadow = inst.receiveShadow = true;
      this.scene.add(inst);
    }
  }

  addSprite(tex, x, y, z, sx, sy = sx) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false }));
    s.position.set(x, y, z);
    s.scale.set(sx, sy, 1);
    this.scene.add(s);
    return s;
  }

  addMarker(text, bg, x, z, kind, place) {
    const s = this.addSprite(badgeTexture(text, bg), x, 8, z, 2.1);
    s.material.depthTest = false;
    s.renderOrder = 10;
    const mk = { sprite: s, kind, place, x, z, bob: this.rand() * 6 };
    this.markers.push(mk);
    return mk;
  }

  storefront(x, y, color, label) {
    const [dx, dy] = this.facingOf(x, y);
    const g = new THREE.Group();
    const back = new THREE.Mesh(new THREE.BoxGeometry(T, 3.4, T * 0.4), new THREE.MeshStandardMaterial({ color: 0xe8e2d6 }));
    back.position.set(0, 1.7, -T * 0.3);
    const awn = new THREE.Mesh(new THREE.BoxGeometry(T, 0.15, T * 0.55), new THREE.MeshStandardMaterial({ color }));
    awn.position.set(0, 2.5, -T * 0.05);
    awn.rotation.x = 0.25;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(T * 0.95, 0.6), new THREE.MeshBasicMaterial({ map: signTexture(label, '#' + new THREE.Color(color).getHexString()) }));
    sign.position.set(0, 3.0, -T * 0.09);
    g.add(back, awn, sign);
    back.castShadow = awn.castShadow = true;
    g.position.set(this.tc(x), 0, this.tc(y));
    g.rotation.y = Math.atan2(dx, dy);
    this.scene.add(g);
    return g;
  }

  smokingSpot(x, y, indoor) {
    const g = new THREE.Group();
    const dark = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, metalness: 0.5, roughness: 0.4 });
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 1.0, 12), dark);
    stand.position.y = 0.5;
    const topm = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.08, 12), new THREE.MeshStandardMaterial({ color: 0x777777, metalness: 0.8, roughness: 0.3 }));
    topm.position.y = 1.04;
    const panelMat = new THREE.MeshStandardMaterial({ color: indoor ? 0xaad4ec : 0x6b7f5a, transparent: indoor, opacity: indoor ? 0.45 : 1 });
    const p1 = new THREE.Mesh(new THREE.BoxGeometry(T * 0.95, 1.8, 0.1), panelMat);
    p1.position.set(0, 0.9, -T * 0.45);
    const p2 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.8, T * 0.6), panelMat);
    p2.position.set(-T * 0.45, 0.9, -T * 0.15);
    const lines = new THREE.Mesh(new THREE.RingGeometry(T * 0.62, T * 0.68, 4, 1, Math.PI / 4), new THREE.MeshBasicMaterial({ color: 0xf2c94c }));
    lines.rotation.x = -Math.PI / 2;
    lines.position.y = 0.02;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.5), new THREE.MeshBasicMaterial({ map: signTexture('喫煙所', '#2f6b3a') }));
    sign.position.set(0, 2.1, -T * 0.39);
    g.add(stand, topm, p1, p2, lines, sign);
    [stand, p1, p2].forEach(o => (o.castShadow = true));
    g.position.set(this.tc(x), 0, this.tc(y));
    const [dx, dy] = this.facingOf(x, y);
    g.rotation.y = Math.atan2(dx, dy);
    this.scene.add(g);
    return g;
  }

  buildProps() {
    const st = this.stage;
    const closedKey = st.closures.length ? st.closures[Math.floor(this.runRand() * st.closures.length)] : null;
    for (let y = 0; y < this.H; y++) for (let x = 0; x < this.W; x++) {
      const c = this.tile(x, y);
      const wx = this.tc(x), wz = this.tc(y);
      const key = `${x},${y}`;
      if (c === 'S' || c === 'X') {
        const grp = this.smokingSpot(x, y, this.theme === 'station');
        const place = { type: c, x, y, key, group: grp, revealed: false, event: st.events[key], closed: key === closedKey };
        place.marker = this.addMarker('喫', '#2f6b3a', wx, wz, 'smoke', place);
        if (c === 'X' || place.closed) {
          // 近づくと正体がわかる
          const ruin = new THREE.Group();
          if (c === 'X') {
            const slab = new THREE.Mesh(new THREE.BoxGeometry(T * 0.8, 0.06, T * 0.8), new THREE.MeshStandardMaterial({ color: 0xbdb8ae }));
            slab.position.y = 0.03;
            const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.12, 6), new THREE.MeshStandardMaterial({ color: 0x555555 }));
            bolt.position.set(0.1, 0.08, 0.05);
            const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.55), new THREE.MeshBasicMaterial({ map: signTexture('灰皿は撤去しました', '#8a3b2e') }));
            sign.position.set(0, 1.4, -T * 0.4);
            const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.4, 6), new THREE.MeshStandardMaterial({ color: 0x888888 }));
            pole.position.set(0, 0.7, -T * 0.42);
            ruin.add(slab, bolt, sign, pole);
          } else {
            const barMat = new THREE.MeshStandardMaterial({ color: 0xf2c94c });
            for (let i = 0; i < 2; i++) {
              const bar = new THREE.Mesh(new THREE.BoxGeometry(T * 0.9, 0.12, 0.08), barMat);
              bar.position.set(0, 0.6 + i * 0.35, T * 0.3);
              ruin.add(bar);
            }
            const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.55), new THREE.MeshBasicMaterial({ map: signTexture('全面禁煙になりました', '#8a3b2e') }));
            sign.position.set(0, 1.5, T * 0.3);
            ruin.add(sign);
          }
          ruin.visible = false;
          ruin.position.copy(grp.position);
          ruin.rotation.copy(grp.rotation);
          this.scene.add(ruin);
          place.ruin = ruin;
        }
        this.places.push(place);
      } else if (c === 'H') {
        this.storefront(x, y, 0x7a4fa0, '加熱式専用');
        const place = { type: 'H', x, y, key };
        place.marker = this.addMarker('加', '#7a4fa0', wx, wz, 'shop', place);
        this.places.push(place);
      } else if (c === 'K') {
        this.storefront(x, y, 0x7b4a2a, '喫茶 けむり');
        const place = { type: 'K', x, y, key, event: st.events[key] };
        place.marker = this.addMarker('茶', '#7b4a2a', wx, wz, 'shop', place);
        this.places.push(place);
      } else if (c === 'C') {
        this.storefront(x, y, 0x2f7fb5, 'コンビニ');
        const place = { type: 'C', x, y, key };
        place.marker = this.addMarker('コ', '#2f7fb5', wx, wz, 'shop', place);
        this.places.push(place);
      } else if (c === 'O' || c === 'G') {
        const label = GOAL_LABEL[st.id];
        if (c === 'O') this.storefront(x, y, this.theme === 'garden' ? 0xb98bb0 : 0x34495e, this.theme === 'garden' ? '披露宴会場' : 'オフィス');
        else {
          const sign = this.addSprite(signTexture('14:30発 のぞみ', '#1f4e8c'), wx, 3.2, wz, 3.2, 1.2);
          sign.material.depthWrite = true;
          const edge = new THREE.Mesh(new THREE.BoxGeometry(T, 0.05, 0.25), new THREE.MeshBasicMaterial({ color: 0xf2c94c }));
          edge.position.set(wx, 0.03, wz - T * 0.35);
          this.scene.add(edge);
        }
        this.goal = { x, y, key };
        this.goal.marker = this.addMarker(label, '#c0392b', wx, wz, 'goal', this.goal);
      } else if (c === 'P') {
        this.addSprite(signTexture('到着ホーム', '#1f4e8c'), wx, 3.2, wz, 3.2, 1.2);
      } else if (c === 'T') {
        this.tree(x, y);
      }
    }
    if (!this.goal) {
      // 職場がスタート地点を兼ねる
      for (let y = 0; y < this.H; y++) for (let x = 0; x < this.W; x++) if (this.tile(x, y) === 'O') this.goal = { x, y };
    }
    // 街の小物（自販機・ベンチ・植え込み）で生活感を出す
    if (this.theme === 'street' || this.theme === 'rain') {
      const vend = new THREE.MeshStandardMaterial({ color: 0xc0392b });
      for (let i = 0; i < 18; i++) {
        const x = Math.floor(this.rand() * this.W), y = Math.floor(this.rand() * this.H);
        if (this.tile(x, y) !== '#') continue;
        const [dx, dy] = this.facingOf(x, y);
        if (!'.,'.includes(this.tile(x + dx, y + dy))) continue;
        const v = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.8, 0.6), i % 3 ? vend : new THREE.MeshStandardMaterial({ color: 0x2e86c1 }));
        v.position.set(this.tc(x) + dx * (T / 2 + 0.3), 0.9, this.tc(y) + dy * (T / 2 + 0.3));
        v.rotation.y = Math.atan2(dx, dy);
        v.castShadow = true;
        this.scene.add(v);
      }
    }
  }

  tree(x, y) {
    const wx = this.tc(x), wz = this.tc(y);
    let obj;
    if (this.theme === 'station') {
      obj = new THREE.Mesh(new THREE.BoxGeometry(T * 0.7, 3.4, T * 0.7), new THREE.MeshStandardMaterial({ color: 0xd9d6cf }));
      obj.position.set(wx, 1.7, wz);
    } else if (this.theme === 'garden') {
      obj = new THREE.Mesh(new THREE.BoxGeometry(T, 1.6, T * 0.8), new THREE.MeshStandardMaterial({ color: 0x3f7a3a, roughness: 1 }));
      obj.position.set(wx, 0.8, wz);
    } else {
      obj = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 1.4, 6), new THREE.MeshStandardMaterial({ color: 0x6b4f3a }));
      trunk.position.y = 0.7;
      const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1, 0), new THREE.MeshStandardMaterial({ color: 0x4f8a45, flatShading: true }));
      leaf.position.y = 2.1;
      trunk.castShadow = leaf.castShadow = true;
      obj.add(trunk, leaf);
      obj.position.set(wx, 0, wz);
    }
    obj.castShadow = true;
    this.scene.add(obj);
  }

  makePerson({ body = 0x2c3e50, legs = 0x22252b, head = 0xf1c9a5, hair = 0x2b2420, scale = 1, extra } = {}) {
    const g = new THREE.Group();
    const mat = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 });
    const legGeo = new THREE.BoxGeometry(0.22, 0.75, 0.24);
    const l1 = new THREE.Mesh(legGeo, mat(legs)); l1.position.set(-0.14, 0.38, 0);
    const l2 = new THREE.Mesh(legGeo, mat(legs)); l2.position.set(0.14, 0.38, 0);
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.78, 0.36), mat(body)); torso.position.y = 1.15;
    const hd = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), mat(head)); hd.position.y = 1.78;
    const hr = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.16, 0.46), mat(hair)); hr.position.y = 2.02;
    const a1 = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.66, 0.2), mat(body)); a1.position.set(-0.4, 1.18, 0);
    const a2 = a1.clone(); a2.position.x = 0.4;
    g.add(l1, l2, torso, hd, hr, a1, a2);
    g.userData = { l1, l2, a1, a2, torso, hd };
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    if (extra) extra(g, mat);
    g.scale.setScalar(scale);
    return g;
  }

  buildPlayer() {
    const mesh = this.makePerson({
      body: 0x2b2f3a, legs: 0x23262e,
      extra: (g, mat) => {
        const tie = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.04), mat(0xc0392b));
        tie.position.set(0, 1.18, 0.19);
        const shirt = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, 0.03), mat(0xf4f4f4));
        shirt.position.set(0, 1.45, 0.185);
        const cig = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.3, 6), mat(0xffffff));
        cig.rotation.x = Math.PI / 2;
        cig.position.set(0.08, 1.72, 0.32);
        cig.visible = false;
        const ember = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), new THREE.MeshBasicMaterial({ color: 0xff5a1f }));
        ember.position.set(0.08, 1.72, 0.47);
        ember.visible = false;
        g.add(tie, shirt, cig, ember);
        g.userData.cig = cig; g.userData.ember = ember;
      },
    });
    // 足元の位置リング（見失わないため）
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.7, 24), new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.8 }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    mesh.add(ring);
    let sx = 0, sy = 0;
    for (let y = 0; y < this.H; y++) for (let x = 0; x < this.W; x++) if ('OP'.includes(this.tile(x, y))) { sx = x; sy = y; }
    const [fx, fy] = this.facingOf(sx, sy);
    this.player = { mesh, pos: new THREE.Vector3(this.tc(sx) + fx * 0.6, 0, this.tc(sy) + fy * 0.6), facing: Math.atan2(fx, fy), walk: 0 };
    mesh.position.copy(this.player.pos);
    this.scene.add(mesh);
    this.puffs = [];
  }

  buildNpcs() {
    const looks = {
      walker: () => ({ body: [0x8e5b3a, 0x5d6d7e, 0xa04040, 0x3d7a5a, 0x6c5b7b, 0xb0a07a][Math.floor(this.rand() * 6)], legs: 0x3a3f4a }),
      parent: () => ({ body: 0xd48aa0, legs: 0x4a4f5a }),
      sensitive: () => ({ body: 0xe8e8e8, legs: 0x5a5f6a }),
      guide: () => ({ body: 0x3b5b8c, legs: 0x2a2f3a }),
      relative: () => ({ body: 0x141414, legs: 0x141414 }),
      ally: () => ({ body: 0x7a7468, legs: 0x3a3a3a }),
    };
    this.npcs = [];
    for (const def of this.stage.npcs) {
      const cfg = NPC_TYPES[def.type];
      const look = looks[def.type]();
      const mesh = this.makePerson({
        ...look,
        extra: (g, mat) => {
          if (def.type === 'guide') {
            const vest = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.6, 0.4), mat(0xf5d90a));
            vest.position.y = 1.2;
            const cap = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.56), mat(0x2c3e50));
            cap.position.set(0, 2.08, 0.04);
            g.add(vest, cap);
            const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.35), new THREE.MeshBasicMaterial({ map: signTexture('路上喫煙禁止', '#c0392b'), side: THREE.DoubleSide }));
            sign.position.set(0.55, 2.3, 0);
            g.add(sign);
          }
          if (def.type === 'sensitive') {
            const mask = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.16, 0.05), mat(0xffffff));
            mask.position.set(0, 1.72, 0.22);
            g.add(mask);
          }
          if (def.type === 'relative') {
            const tie = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 0.04), mat(0xffffff));
            tie.position.set(0, 1.5, 0.19);
            g.add(tie);
          }
          if (def.type === 'parent') {
            const kid = this.makePerson({ body: 0xf2c94c, legs: 0x3c6e9e, scale: 0.55 });
            kid.position.set(0.7, 0, 0.1);
            g.add(kid);
            g.userData.kid = kid;
          }
          if (def.type === 'ally') {
            const cig = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.3, 6), mat(0xffffff));
            cig.rotation.x = Math.PI / 2;
            cig.position.set(0.08, 1.72, 0.32);
            g.add(cig);
          }
        },
      });
      const path = def.path.map(([x, y]) => new THREE.Vector3(this.tc(x), 0, this.tc(y)));
      const npc = {
        type: def.type, cfg, mode: def.mode, path, idx: 1 % path.length, dir: 1,
        pos: path[0].clone(), facing: 0, pause: this.rand() * 1.5, sus: 0, cd: 0, bubbleCd: 0,
        state: 'patrol', chaseT: 0, mesh, walk: this.rand() * 10, lookT: 0, hinted: false,
      };
      if (path.length > 1) npc.facing = Math.atan2(path[1].x - path[0].x, path[1].z - path[0].z);
      else { const [fx, fy] = this.facingOf(def.path[0][0], def.path[0][1]); npc.facing = Math.atan2(-fx, -fy) + Math.PI; }
      mesh.position.copy(npc.pos);
      this.scene.add(mesh);
      if (!cfg.friendly) {
        const n = 22;
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((n + 2) * 3), 3));
        const idx = [];
        for (let i = 1; i <= n; i++) idx.push(0, i, i + 1);
        geo.setIndex(idx);
        const cone = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
        cone.frustumCulled = false;
        cone.renderOrder = 2;
        const edgeGeo = new THREE.BufferGeometry();
        edgeGeo.setAttribute('position', geo.attributes.position);
        const edge = new THREE.LineLoop(edgeGeo, new THREE.LineBasicMaterial({ color: 0xffd000, transparent: true, opacity: 0.9, toneMapped: false }));
        edge.frustumCulled = false;
        edge.renderOrder = 3;
        this.scene.add(cone, edge);
        npc.cone = cone;
        npc.edge = edge;
        npc.rays = n;
      }
      this.npcs.push(npc);
    }
    // ゴールに立つ上司／母
    if (this.goal && this.stage.id !== 's4') {
      const who = this.stage.goalCheck.who;
      const boss = this.makePerson({
        body: who === '母' ? 0x8e44ad : 0x1c2833, legs: 0x1c2833, hair: who === '母' ? 0x4a3020 : 0x777777,
        extra: (g, mat) => {
          const gl = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.08, 0.05), mat(0x111111));
          gl.position.set(0, 1.82, 0.22);
          g.add(gl);
        },
      });
      const [fx, fy] = this.facingOf(this.goal.x, this.goal.y);
      boss.position.set(this.tc(this.goal.x) - fy * 0.7 + fx * 0.2, 0, this.tc(this.goal.y) + fx * 0.7 + fy * 0.2);
      boss.rotation.y = Math.atan2(fx, fy);
      this.scene.add(boss);
      this.boss = boss;
    } else this.boss = null;
  }

  buildAura() {
    const geo = new THREE.PlaneGeometry(2, 2);
    geo.rotateX(-Math.PI / 2);
    this.auraMesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: this.auraTex, transparent: true, depthWrite: false, opacity: 0.9, toneMapped: false }));
    this.auraMesh.position.y = 0.04;
    this.auraMesh.renderOrder = 1;
    this.scene.add(this.auraMesh);
  }

  buildRain() {
    const n = 1600;
    const pos = new Float32Array(n * 6);
    this.rainSpeed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (Math.random() - 0.5) * 60, y = Math.random() * 30, z = (Math.random() - 0.5) * 50;
      pos.set([x, y, z, x + 0.15, y + 0.9, z], i * 6);
      this.rainSpeed[i] = 22 + Math.random() * 8;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.rain = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xc8d4e0, transparent: true, opacity: 0.45 }));
    this.rain.frustumCulled = false;
    this.scene.add(this.rain);
  }

  buildGhost(ghost) {
    const mesh = this.makePerson({ body: 0x9fd3ff, legs: 0x9fd3ff, head: 0x9fd3ff, hair: 0x9fd3ff });
    mesh.traverse(o => { if (o.isMesh) { o.material.transparent = true; o.material.opacity = 0.3; o.castShadow = false; } });
    this.scene.add(mesh);
    this.ghost = { mesh, frames: ghost.frames };
  }

  // ------------------------------------------------------------------ helpers
  setWind(w) {
    const [x, y, s] = w;
    const len = Math.hypot(x, y) || 1;
    this.wind = { x: (x / len) * s, z: (y / len) * s, s };
    this.ui.setWind(this.wind);
  }

  los(ax, az, bx, bz) {
    const dx = bx - ax, dz = bz - az;
    const d = Math.hypot(dx, dz);
    const steps = Math.ceil(d / 0.35);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (this.sightBlock(this.w2t(ax + dx * t), this.w2t(az + dz * t))) return false;
    }
    return true;
  }

  collide(x, z) {
    const r = PLAYER_R;
    const tx0 = this.w2t(x - r), tx1 = this.w2t(x + r), tz0 = this.w2t(z - r), tz1 = this.w2t(z + r);
    for (let ty = tz0; ty <= tz1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      if (!this.solidTile(tx, ty)) continue;
      const cx = clamp(x, tx * T, tx * T + T), cz = clamp(z, ty * T, ty * T + T);
      if ((x - cx) ** 2 + (z - cz) ** 2 < r * r) return true;
    }
    return false;
  }

  smellCenter() {
    const p = this.player;
    const r = p.aura * T;
    return { x: p.pos.x + this.wind.x * r * 0.55, z: p.pos.z + this.wind.z * r * 0.55, r: r * (this.theme === 'rain' ? 0.85 : 1) };
  }

  gameMin() { return this.elapsed / this.stage.secPerMin + this.extraMin; }
  clock() { return fmtClock(this.stage.startClock, this.gameMin()); }

  placeAt() {
    const tx = this.w2t(this.player.pos.x), ty = this.w2t(this.player.pos.z);
    return this.places.find(p => p.x === tx && p.y === ty) || null;
  }

  // ------------------------------------------------------------------ actions
  action() {
    const p = this.player;
    if (this.over || this.cleared) return;
    if (p.smoking) {
      if (p.smoking.error > 0) {
        p.smoking.error -= 1;
        this.audio.beep();
        this.ui.bubble(p.mesh, p.smoking.error > 0 ? 'ブルブル…' : '直った！', 'me', 0.6);
        if (p.smoking.error <= 0) this.audio.ok();
      }
      return;
    }
    const pl = this.placeAt();
    const legalSmoke = (opts = {}) => this.startSmoke(true, opts);
    if (pl) {
      if ((pl.type === 'X' && pl.revealed) || pl.closed) {
        this.ui.toast(pl.type === 'X' ? '灰皿はもう無い。コンクリートの跡だけだ。' : '全面禁煙。張り紙が冷たい。');
        this.audio.bad();
        return;
      }
      if (pl.type === 'S') {
        if (this.stage.rain && p.mode === 'cig' && !p.torch) {
          this.ui.toast('雨で火がつかない…（加熱式に切り替えるか、屋内へ）');
          this.audio.bad();
          return;
        }
        return legalSmoke({ event: pl.event, place: pl });
      }
      if (pl.type === 'H') {
        if (p.mode === 'cig') { this.ui.toast('ここは加熱式専用です（Tabで切り替え）'); this.audio.bad(); return; }
        return legalSmoke({ place: pl });
      }
      if (pl.type === 'K') {
        if (p.money < 500) { this.ui.toast('コーヒー代（500円）が足りない…'); this.audio.bad(); return; }
        p.money -= 500;
        this.extraMin += 4;
        this.ui.toast('ブレンドを注文（-500円、4分）。店内なら誰にも見られない。');
        return legalSmoke({ event: pl.event, place: pl, indoor: true });
      }
      if (pl.type === 'C') {
        this.extraMin += 2;
        p.aura = BASE_AURA + (p.aura - BASE_AURA) * 0.6;
        if (p.money >= 300) { p.money -= 300; p.sprays += 1; this.ui.toast('トイレで手を洗い、消臭スプレーを買った（-300円、2分）'); }
        else this.ui.toast('トイレで手を洗った（2分）。お金が無いのでスプレーは買えない。');
        this.audio.spray();
        return;
      }
    }
    // 路上喫煙（二度押しで強行）
    if (this.stage.rain && p.mode === 'cig' && !p.torch) {
      this.ui.toast('雨で火がつかない…');
      this.audio.bad();
      return;
    }
    if (p.streetConfirm > 0) {
      p.streetConfirm = 0;
      return this.startSmoke(false, {});
    }
    p.streetConfirm = 1.6;
    this.ui.toast('ここは路上だ。もう一度押すと強行する（見られたら…）', 1600);
    this.audio.alert();
  }

  startSmoke(legal, { event, place, indoor } = {}) {
    const p = this.player;
    if (p.mode === 'cig' && p.cigs <= 0) { this.ui.toast('紙巻きが切れた。加熱式に切り替えろ（Tab）'); this.audio.bad(); return; }
    if (p.mode === 'heat' && p.battery <= 0) { this.ui.toast('加熱式のバッテリーが切れた（Tab）'); this.audio.bad(); return; }
    let wait = 0;
    if (event === 'full') { wait = 2.0; this.extraMin += 6; this.ui.toast('喫煙所は満員。行列に並ぶ…（6分）'); }
    if (event === 'boss') { this.extraMin += 8; this.ui.toast('店内に上司がいた。世間話に捕まった…（8分）'); this.audio.bad(); }
    const err = p.mode === 'heat' && this.runRand() < 0.3 ? 4 : 0;
    p.smoking = { t: 0, wait, legal, mode: p.mode, warm: p.mode === 'heat' ? HEAT_WARMUP : 0, error: 0, pendingErr: err, indoor: !!indoor, place };
    p.streetConfirm = 0;
    if (p.mode === 'cig') this.audio.lighter(); else this.audio.beep();
  }

  toggleMode() {
    const p = this.player;
    if (p.smoking || this.over) return;
    p.mode = p.mode === 'cig' ? 'heat' : 'cig';
    this.audio.beep();
    this.ui.toast(p.mode === 'cig' ? '紙巻き：回復大・匂い大' : '加熱式：匂い小・ときどきエラー', 1300);
  }

  useSpray() {
    const p = this.player;
    if (this.over || p.smoking) return;
    if (p.sprays <= 0) { this.ui.toast('消臭スプレーが無い（コンビニで買える）'); this.audio.bad(); return; }
    p.sprays -= 1;
    p.aura = BASE_AURA + (p.aura - BASE_AURA) * 0.25;
    this.audio.spray();
    this.ui.bubble(p.mesh, 'シュッシュッ', 'me', 0.8);
    for (let i = 0; i < 10; i++) this.spawnPuff(0xffffff, 0.6);
  }

  useGum() {
    const p = this.player;
    if (this.over || p.smoking) return;
    if (p.gums <= 0) { this.ui.toast('ミントガムが無い'); this.audio.bad(); return; }
    p.gums -= 1;
    p.mental = Math.min(100, p.mental + 20);
    p.aura = Math.max(BASE_AURA, p.aura - 0.3);
    this.audio.ok();
    this.ui.bubble(p.mesh, 'スーッ…', 'me', 0.8);
  }

  // ------------------------------------------------------------------ update
  update(dt, input) {
    if (this.over || this.cleared) { this.updateVisuals(dt); return; }
    const p = this.player;
    const st = this.stage;
    this.elapsed += dt;

    // 風向きの変化
    if (st.wind.length > 1) {
      const next = Math.min(st.wind.length - 1, Math.floor((this.gameMin() / st.minutes) * st.wind.length));
      if (next !== this.windIdx) {
        this.windIdx = next;
        this.setWind(st.wind[next]);
        this.ui.toast('風向きが変わった！');
        this.audio.alert();
      }
    }

    // ニコチン
    const drain = (100 / 105) * (p.curse > 0 ? 2 : 1) * (p.running ? 1.5 : 1);
    p.curse = Math.max(0, p.curse - dt);
    if (!p.smoking) p.nic = Math.max(0, p.nic - drain * dt);
    if (p.nic <= 0) {
      p.mental -= 1.4 * dt;
      p.lastCause = 'ニコチン切れのイライラ';
    }
    p.streetConfirm = Math.max(0, p.streetConfirm - dt);
    p.contactCd = Math.max(0, p.contactCd - dt);

    // 匂いの減衰（雨だと早く消える）
    const tau = this.theme === 'rain' ? 30 : 40;
    p.aura = BASE_AURA + (p.aura - BASE_AURA) * Math.exp(-dt / tau);

    // 喫煙中
    if (p.smoking) this.updateSmoking(dt);
    else this.movePlayer(dt, input);

    const ptx = this.w2t(p.pos.x), pty = this.w2t(p.pos.z);
    const here = this.places.find(pl => pl.x === ptx && pl.y === pty);
    p.inLegal = !!(here && ['S', 'H', 'K'].includes(here.type) && !here.closed);
    p.indoor = !!(here && ['H', 'K', 'C'].includes(here.type));

    this.updateReveals();
    this.updateNpcs(dt);
    this.checkGoal(ptx, pty);

    // 時間切れ・メンタル
    if (!this.over && this.gameMin() >= st.minutes) this.fail(TIMEOUT_TEXT[st.id], 'time');
    if (!this.over && p.mental <= 0) this.fail(p.lastCause || '心が折れた', 'mental');

    // ゴースト用の記録
    this.recordT += dt;
    if (this.recordT >= 0.1) {
      this.recordT = 0;
      this.record.push([+p.pos.x.toFixed(2), +p.pos.z.toFixed(2), +p.facing.toFixed(2)]);
    }

    this.audio.tension = clamp(Math.max(1 - p.nic / 40, 1 - p.mental / 50, 0), 0, 1);
    this.updateVisuals(dt);
    this.ui.hud(this);
  }

  movePlayer(dt, input) {
    const p = this.player;
    let mx = input.x, mz = input.y;
    const len = Math.hypot(mx, mz);
    p.running = input.run && len > 0.1;
    if (len > 0.1) {
      mx /= Math.max(1, len); mz /= Math.max(1, len);
      if (p.nic <= 0) {
        // 手ブレ：入力方向がぶれる
        const j = Math.sin(this.elapsed * 7.3) * 0.5 + (Math.random() - 0.5) * 0.4;
        const c = Math.cos(j), s = Math.sin(j);
        [mx, mz] = [mx * c - mz * s, mx * s + mz * c];
      }
      const speed = 4.4 * (p.running ? 1.45 : 1) * (p.nic <= 0 ? 0.55 : 1);
      const nx = p.pos.x + mx * speed * dt;
      if (!this.collide(nx, p.pos.z)) p.pos.x = nx;
      const nz = p.pos.z + mz * speed * dt;
      if (!this.collide(p.pos.x, nz)) p.pos.z = nz;
      const target = Math.atan2(mx, mz);
      p.facing += angDiff(target, p.facing) * Math.min(1, dt * 14);
      p.walk += dt * speed * 2.2;
    } else p.walk *= 0.9;
  }

  updateSmoking(dt) {
    const p = this.player;
    const s = p.smoking;
    if (s.wait > 0) { s.wait -= dt; return; }
    if (s.warm > 0) {
      s.warm -= dt;
      if (s.warm <= 0 && s.pendingErr) {
        s.error = s.pendingErr;
        s.pendingErr = 0;
        this.audio.error();
        this.ui.toast('エラー！ 本体を振れ（一服キー連打）', 1500);
      }
      return;
    }
    if (s.error > 0) return;
    const dur = SMOKE_TIME[s.mode];
    const gain = NIC_GAIN[s.mode];
    s.t += dt;
    p.nic = Math.min(100, p.nic + (gain / dur) * dt);
    if (Math.random() < dt * 6) this.spawnPuff(0xdddddd, 0.4);
    if (s.t >= dur) {
      p.smoking = null;
      if (s.mode === 'cig') p.cigs -= 1; else p.battery -= 1;
      const max = MAX_AURA[s.mode] * (s.indoor ? 0.8 : 1);
      p.aura = Math.max(p.aura, max);
      this.extraMin += 2;
      this.audio.exhale();
      for (let i = 0; i < 12; i++) this.spawnPuff(0xe6e0ee, 1);
      if (!p.hasSmoked) {
        p.hasSmoked = true;
        this.objective = `匂いを消して${GOAL_LABEL[this.stage.id]}へ戻れ`;
        this.ui.toast(`ふぅ……。生き返った。だが匂いがすごい。${GOAL_LABEL[this.stage.id]}へ戻れ。`, 3000);
      }
      if (!s.legal) p.lastCause = '路上喫煙';
    }
  }

  updateReveals() {
    const p = this.player;
    for (const pl of this.places) {
      if (pl.type !== 'X' && !pl.closed) continue;
      if (pl.revealed) continue;
      const d = Math.hypot(this.tc(pl.x) - p.pos.x, this.tc(pl.y) - p.pos.z) / T;
      if (d < 2.6) this.reveal(pl, true);
    }
    for (const n of this.npcs) {
      if (n.type !== 'ally' || n.hinted) continue;
      if (n.pos.distanceTo(p.pos) < T * 2) {
        n.hinted = true;
        if (this.stage.allyHint) {
          this.ui.bubble(n.mesh, this.stage.allyHint, 'ally', 4);
          p.torch = true;
          this.ui.toast('ターボライターを借りた！ 雨でも紙巻きに火がつく', 3000);
          this.audio.ok();
        } else {
          this.ui.bubble(n.mesh, 'あっちの灰皿、先月撤去されたよ', 'ally', 3.5);
          this.places.filter(x => x.type === 'X').forEach(x => this.reveal(x, false));
        }
      }
    }
  }

  reveal(pl, inPerson) {
    pl.revealed = true;
    if (pl.ruin) { pl.ruin.visible = true; pl.group.visible = false; }
    pl.marker.sprite.material.map = badgeTexture('✕', '#8a3b2e');
    this.ui.minimapDirty = true;
    if (!inPerson) return;
    const p = this.player;
    if (pl.type === 'X') {
      p.curse = 25;
      p.mental -= 8;
      p.lastCause = '撤去済みの灰皿で心が折れた';
      this.ui.toast('撤去済み……。地図アプリを信じた自分が憎い（ニコチン減少2倍）', 3200);
    } else {
      p.mental -= 8;
      this.ui.toast('「全面禁煙になりました」……先月まで吸えたのに。', 3000);
    }
    this.audio.bad();
    this.shake = 0.4;
  }

  updateNpcs(dt) {
    const p = this.player;
    const sm = this.smellCenter();
    const rainMul = this.theme === 'rain' ? 0.75 : 1;
    for (const n of this.npcs) {
      const cfg = n.cfg;
      n.cd = Math.max(0, n.cd - dt);
      n.bubbleCd = Math.max(0, n.bubbleCd - dt);
      if (cfg.friendly) { this.animatePerson(n.mesh, 0); n.mesh.rotation.y = n.facing; continue; }

      const toP = new THREE.Vector3(p.pos.x - n.pos.x, 0, p.pos.z - n.pos.z);
      const dist = toP.length();
      const range = cfg.range * T * rainMul;
      const half = (cfg.fov * Math.PI) / 360;
      const ang = Math.atan2(toP.x, toP.z);
      const sees = !p.indoor && dist < range && Math.abs(angDiff(ang, n.facing)) < half && this.los(n.pos.x, n.pos.z, p.pos.x, p.pos.z);
      const sd = Math.hypot(n.pos.x - sm.x, n.pos.z - sm.z);
      const inSmell = !p.indoor && (sd < sm.r * cfg.smellMul && this.los(n.pos.x, n.pos.z, sm.x, sm.z) || dist < 1.4 && p.aura > BASE_AURA + 0.2);

      // 路上喫煙を目撃
      if (p.smoking && !p.smoking.legal && p.smoking.wait <= 0 && sees) {
        if (n.type === 'guide') { this.fail('路上喫煙で指導', 'guide', n); return; }
        if (n.cd <= 0) this.tsk(n, 1.6, 'えっ、ここで吸う？');
      }

      let moving = true;
      if (inSmell) {
        n.sus = Math.min(1.4, n.sus + dt * cfg.sens * (0.8 + (p.aura - BASE_AURA) * 0.12));
        if (n.sus > 0.25) {
          n.facing += angDiff(ang, n.facing) * Math.min(1, dt * 2.6);
          moving = false;
          if (cfg.chase && n.sus > 0.35) { n.state = 'chase'; n.chaseT = 5; }
          if (n.bubbleCd <= 0 && n.cd <= 0 && n.sus < 0.9) {
            this.ui.bubble(n.mesh, n.type === 'parent' ? 'なんか臭う…' : '…ん？', 'npc', 1.1);
            n.bubbleCd = 3;
          }
        }
      } else n.sus = Math.max(0, n.sus - dt * 0.45);

      if (n.sus >= 1 && sees && n.cd <= 0) this.tsk(n, p.inLegal ? 0.3 : 1);

      if (n.state === 'chase') {
        n.chaseT -= dt;
        if (inSmell) n.chaseT = Math.max(n.chaseT, 2);
        if (n.chaseT <= 0) n.state = 'patrol';
        else {
          const sp = cfg.speed * 1.25;
          const d = toP.clone().normalize();
          const nx = n.pos.x + d.x * sp * dt, nz = n.pos.z + d.z * sp * dt;
          if (!this.solidTile(this.w2t(nx), this.w2t(n.pos.z))) n.pos.x = nx;
          if (!this.solidTile(this.w2t(n.pos.x), this.w2t(nz))) n.pos.z = nz;
          n.facing += angDiff(ang, n.facing) * Math.min(1, dt * 5);
          n.walk += dt * sp * 2.2;
          if (dist < 1.1 && p.contactCd <= 0) { p.contactCd = 2.5; this.tsk(n, 1, 'くっさ！！'); }
          moving = false;
        }
      }

      if (moving && n.state === 'patrol' && n.path.length > 1) {
        if (n.pause > 0) {
          n.pause -= dt;
          n.lookT += dt;
          n.facing += Math.sin(n.lookT * 2.2) * dt * 1.4;
        } else {
          const tgt = n.path[n.idx];
          const d = tgt.clone().sub(n.pos);
          const L = d.length();
          if (L < 0.08) {
            n.pause = 0.5 + this.rand() * 1.2;
            if (n.mode === 'loop') n.idx = (n.idx + 1) % n.path.length;
            else {
              if (n.idx + n.dir >= n.path.length || n.idx + n.dir < 0) n.dir *= -1;
              n.idx += n.dir;
            }
          } else {
            const step = Math.min(L, cfg.speed * dt);
            n.pos.addScaledVector(d.normalize(), step);
            n.facing += angDiff(Math.atan2(d.x, d.z), n.facing) * Math.min(1, dt * 6);
            n.walk += dt * cfg.speed * 2.4;
          }
        }
      }
      n.mesh.position.copy(n.pos);
      n.mesh.rotation.y = n.facing;
      this.animatePerson(n.mesh, n.walk);
      this.updateCone(n, range, half);
    }
  }

  tsk(n, mul = 1, line) {
    const p = this.player;
    const cfg = n.cfg;
    n.cd = 3.5;
    n.sus = 0.3;
    n.bubbleCd = 2;
    p.mental -= cfg.dmg * mul;
    p.tsk += 1;
    p.lastCause = cfg.cause;
    this.ui.bubble(n.mesh, line || cfg.lines[Math.floor(Math.random() * cfg.lines.length)], 'tsk', 1.4);
    this.ui.flash();
    this.audio.tsk();
    this.shake = Math.max(this.shake, 0.25);
  }

  checkGoal(tx, ty) {
    const p = this.player;
    if (!this.goal || !p.hasSmoked || p.smoking) return;
    if (tx !== this.goal.x || ty !== this.goal.y) return;
    const gc = this.stage.goalCheck;
    if (p.aura > gc.threshold) {
      this.fail(gc.fail, 'smell');
      if (this.boss) this.ui.bubble(this.boss, 'クンクン…', 'tsk', 3);
      return;
    }
    this.clear();
  }

  residual() { return clamp((this.player.aura - BASE_AURA) / (MAX_AURA.cig - BASE_AURA), 0, 1); }

  clear() {
    const p = this.player;
    this.cleared = true;
    const remain = Math.max(0, this.stage.minutes - this.gameMin());
    const res = this.residual();
    const score = Math.round(remain * 100 + (1 - res) * 500 + Math.max(0, p.mental) * 5 - p.tsk * 200);
    let rank = 'C';
    if (p.tsk === 0 && remain >= 8 && res < 0.2) rank = 'S';
    else if (p.tsk <= 1 && remain >= 4) rank = 'A';
    else if (p.tsk <= 3) rank = 'B';
    if (this.boss) this.ui.bubble(this.boss, 'おかえり', 'npc', 3);
    this.audio.clear();
    this.result = {
      stage: this.stage, score, rank, remain, residual: res, tsk: p.tsk, mental: Math.max(0, Math.round(p.mental)),
      usedMin: Math.round(this.gameMin()), clock: this.clock(), ghost: { frames: this.record },
    };
    this.ui.onClear(this.result);
  }

  fail(cause, kind, npc) {
    if (this.over) return;
    this.over = true;
    this.shake = 0.6;
    this.audio.fail();
    if (npc) this.ui.bubble(npc.mesh, 'ちょっとお兄さん！', 'tsk', 3);
    this.ui.onFail({ cause, kind, tsk: this.player.tsk, clock: this.clock(), stage: this.stage });
  }

  // ------------------------------------------------------------------ visuals
  animatePerson(mesh, walk) {
    const u = mesh.userData;
    const s = Math.sin(walk) * 0.5;
    u.l1.rotation.x = s; u.l2.rotation.x = -s;
    u.a1.rotation.x = -s * 0.8; u.a2.rotation.x = s * 0.8;
    if (u.kid) this.animatePerson(u.kid, walk * 1.4);
  }

  updateCone(n, range, half) {
    const pos = n.cone.geometry.attributes.position;
    pos.setXYZ(0, n.pos.x, 0.06, n.pos.z);
    for (let i = 0; i <= n.rays; i++) {
      const a = n.facing - half + (i / n.rays) * half * 2;
      const dx = Math.sin(a), dz = Math.cos(a);
      let d = 0.4;
      while (d < range) {
        const x = n.pos.x + dx * d, z = n.pos.z + dz * d;
        if (this.sightBlock(this.w2t(x), this.w2t(z))) break;
        d += 0.3;
      }
      pos.setXYZ(i + 1, n.pos.x + dx * d, 0.06, n.pos.z + dz * d);
    }
    pos.needsUpdate = true;
    n.cone.geometry.computeBoundingSphere();
    const s = clamp(n.sus, 0, 1);
    const c = n.cone.material.color;
    c.setRGB(1, 0.82 - s * 0.62, 0.1);
    n.edge.material.color.copy(c);
    n.cone.material.opacity = 0.28 + s * 0.25 + (n.cd > 2.5 ? 0.2 : 0);
  }

  spawnPuff(color, size) {
    const p = this.player;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.puffTex, color, transparent: true, depthWrite: false, opacity: 0.8 }));
    s.position.set(p.pos.x + (Math.random() - 0.5) * 0.4, 1.8 + Math.random() * 0.3, p.pos.z + (Math.random() - 0.5) * 0.4);
    const sc = 0.5 + Math.random() * 0.5 * size;
    s.scale.set(sc, sc, 1);
    s.userData = { life: 1.6 + Math.random(), age: 0, vx: (Math.random() - 0.5) * 0.6, vz: (Math.random() - 0.5) * 0.6, grow: 1 + size };
    this.scene.add(s);
    this.puffs.push(s);
  }

  updateVisuals(dt) {
    const p = this.player;
    // プレイヤー
    p.mesh.position.copy(p.pos);
    p.mesh.rotation.y = p.facing;
    this.animatePerson(p.mesh, p.walk);
    const smoking = !!(p.smoking && p.smoking.wait <= 0 && p.smoking.warm <= 0);
    p.mesh.userData.cig.visible = smoking || !!(p.smoking && p.smoking.mode === 'heat');
    p.mesh.userData.ember.visible = smoking && p.smoking.mode === 'cig';
    p.mesh.userData.a2.rotation.x = p.smoking ? -2.2 : p.mesh.userData.a2.rotation.x;
    if (p.smoking && p.smoking.error > 0) p.mesh.position.x += Math.sin(this.elapsed * 60) * 0.05;

    // 匂いオーラと煙
    const sm = this.smellCenter();
    this.auraMesh.position.set(sm.x, 0.04, sm.z);
    this.auraMesh.scale.set(sm.r, 1, sm.r);
    this.auraMesh.material.opacity = 0.35 + this.residual() * 0.6;
    if (!this.over && Math.random() < dt * this.residual() * 10) this.spawnPuff(0xcfc6dc, this.residual());
    for (let i = this.puffs.length - 1; i >= 0; i--) {
      const s = this.puffs[i];
      const u = s.userData;
      u.age += dt;
      s.position.x += (u.vx + this.wind.x * 1.6) * dt;
      s.position.z += (u.vz + this.wind.z * 1.6) * dt;
      s.position.y += 0.6 * dt;
      const k = 1 + u.grow * dt * 0.8;
      s.scale.multiplyScalar(k);
      s.material.opacity = 0.75 * (1 - u.age / u.life);
      if (u.age >= u.life) { this.scene.remove(s); s.material.dispose(); this.puffs.splice(i, 1); }
    }

    // マーカーのゆらぎ
    for (const mk of this.markers) {
      mk.bob += dt * 2;
      mk.sprite.position.y = 8 + Math.sin(mk.bob) * 0.25;
    }

    // 手前の建物を低くして主人公を見せる
    const px = p.pos.x, pz = p.pos.z;
    const m = new THREE.Matrix4();
    for (const b of this.buildingInst) {
      let changed = false;
      b.list.forEach(([x, y], i) => {
        const wx = this.tc(x), wz = this.tc(y);
        const occl = wz > pz + 0.5 && wz - pz < T * 4.5 && Math.abs(wx - px) < T * 2.1;
        const target = occl ? 0.18 : 1;
        const cur = b.cur[i];
        if (Math.abs(cur - target) > 0.01) {
          b.cur[i] = cur + (target - cur) * Math.min(1, dt * 8);
          m.makeScale(1, b.cur[i], 1);
          m.setPosition(wx, 0, wz);
          b.inst.setMatrixAt(i, m);
          changed = true;
        }
      });
      if (changed) b.inst.instanceMatrix.needsUpdate = true;
    }

    // 雨
    if (this.rain) {
      const pos = this.rain.geometry.attributes.position;
      for (let i = 0; i < this.rainSpeed.length; i++) {
        let y = pos.getY(i * 2) - this.rainSpeed[i] * dt;
        let x = pos.getX(i * 2), z = pos.getZ(i * 2);
        if (y < 0) { y = 25 + Math.random() * 5; x = px + (Math.random() - 0.5) * 60; z = pz + (Math.random() - 0.5) * 50; }
        pos.setXYZ(i * 2, x, y, z);
        pos.setXYZ(i * 2 + 1, x + 0.15, y + 0.9, z);
      }
      pos.needsUpdate = true;
    }

    // ゴースト
    if (this.ghost) {
      const f = this.ghost.frames;
      const i = Math.min(f.length - 1, Math.floor(this.elapsed * 10));
      const [gx, gz, gf] = f[i];
      const g = this.ghost.mesh;
      const prev = g.position.clone();
      g.position.set(gx, 0, gz);
      g.rotation.y = gf;
      this.animatePerson(g, (g.userData.wk = (g.userData.wk || 0) + prev.distanceTo(g.position) * 2.2));
    }

    // カメラ
    const tgt = new THREE.Vector3(px, 0, pz);
    const off = new THREE.Vector3(0, 30, 14);
    const want = tgt.clone().add(off);
    if (!this.camPos) this.camPos = want.clone();
    this.camPos.lerp(want, Math.min(1, dt * 5));
    this.camera.position.copy(this.camPos);
    this.shake = Math.max(0, this.shake - dt);
    const nicShake = p.nic <= 0 && !this.over ? 0.12 : 0;
    const sk = this.shake * 0.8 + nicShake;
    if (sk > 0) this.camera.position.add(new THREE.Vector3((Math.random() - 0.5) * sk, (Math.random() - 0.5) * sk, (Math.random() - 0.5) * sk));
    this.camera.lookAt(this.camPos.x, 0, this.camPos.z - off.z + 0.5);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
