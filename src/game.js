import * as THREE from 'three';
import {
  badgeTexture, signTexture, radialTexture, ringTexture, puffTexture, glowTexture, alertMarkTexture,
  facadeAtlas, shopAtlas, roofTexture, groundTexture, vendTexture, cardboardTexture, posterTexture, skyMaterial,
} from './textures.js';
import { Post } from './post.js';
import { CHARACTERS } from './characters.js';

export const T = 2;               // 1マスの大きさ（ワールド単位）
const PLAYER_R = 0.42;
const BASE_AURA = 1.2;            // 染みついた匂い（マス）
const MAX_AURA = { cig: 7.0, heat: 3.6 };
const NIC_GAIN = { cig: 100, heat: 70 };
const SMOKE_TIME = { cig: 3.0, heat: 2.6 };
const HEAT_WARMUP = 1.4;
const CROUCH_SIGHT = 0.65;        // しゃがむと見つかりにくい（視線の届く距離）
const WALK_Y = 0.1;               // 歩道の高さ（車道は0）

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

// テーマごとの空・光・街の作り
const LOOK = {
  street: {
    sky: [0x6d8aa6, 0xc4ccd0, 0x7c7f82], fog: 0xb3bcc1, fogNear: 34, fogFar: 130,
    sun: 0xfff0da, sunI: 2.5, sunDir: [-0.55, 0.62, 0.48], hemi: [0xdce6ee, 0x4a4438, 0.35], env: 0.55,
    heights: [4.8, 7.2, 9.6, 12, 14.4, 19.2], facades: ['office', 'apart', 'tile'], emi: 0.35,
    tints: [0xffffff, 0xeef0f2, 0xf3eee4, 0xe4e9ee, 0xdedcd6], filler: true, shops: true, poles: true,
  },
  rain: {
    sky: [0x2e353d, 0x5a636b, 0x2f3338], fog: 0x4f5860, fogNear: 12, fogFar: 72,
    sun: 0xc8d4e0, sunI: 0.55, sunDir: [-0.3, 0.86, 0.32], hemi: [0x9fb0c0, 0x26262c, 0.55], env: 0.75,
    heights: [4.8, 7.2, 7.2, 9.6], facades: ['tile', 'apart', 'tile'], emi: 1.25,
    tints: [0xffffff, 0xece6dc, 0xe2e6ea], filler: true, shops: true, poles: true, wet: true,
  },
  station: {
    sky: [0x1b1f22, 0x2a2f33, 0x1b1f22], fog: 0x2a3033, fogNear: 22, fogFar: 85,
    sun: 0xf0fff4, sunI: 0.85, sunDir: [-0.15, 1, 0.22], hemi: [0xe8f5ee, 0x5c5e58, 1.05], env: 0.55,
    heights: [6.0], facades: ['station'], emi: 0.9, tints: [0xffffff], ceiling: 6.0,
  },
  garden: {
    sky: [0x7ba0c6, 0xf0d2a6, 0x7d6c58], fog: 0xe3cba5, fogNear: 34, fogFar: 140,
    sun: 0xffcd94, sunI: 2.7, sunDir: [-0.72, 0.4, 0.34], hemi: [0xdde6f0, 0x5a4a36, 0.4], env: 0.6,
    heights: [7.2], facades: ['venue'], emi: 0.45, tints: [0xffffff], filler: true,
  },
};

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
function hashStr(s) { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }
function hash2(x, y, salt = 0) {
  let h = Math.imul(x * 374761393 + y * 668265263 + salt * 2246822519, 3266489917) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0;
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
const fmtClock = (start, min) => {
  const [h, m] = start.split(':').map(Number);
  const t = h * 60 + m + Math.floor(min);
  return `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};

// インスタンスごとにテクスチャの位置をずらす（同じ窓の並びが続かないように）
function withInstUv(mat) {
  mat.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 instUv;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_MAP\nvMapUv += instUv;\n#endif\n#ifdef USE_EMISSIVEMAP\nvEmissiveMapUv += instUv;\n#endif');
  };
  mat.customProgramCacheKey = () => 'instUv';
  return mat;
}

// テクスチャはステージをまたいで使い回す
const TEX = {};
const tex = (key, fn) => TEX[key] || (TEX[key] = fn());

export class Game {
  constructor(renderer, ui, audio) {
    this.renderer = renderer;
    this.ui = ui;
    this.audio = audio;
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.12, 400);
    this.post = new Post(renderer);
    this.puffTex = puffTexture();
    this.auraTex = radialTexture('rgba(150,100,210,0.42)', 'rgba(130,95,190,0.16)');
    this.auraRingTex = ringTexture('rgba(190,140,255,A)');
    this.markTex = { '!': alertMarkTexture('!'), '?': alertMarkTexture('?') };
    this.camState = { yaw: 0, pitch: 0.3, dist: 5.6, cur: 5.6, fov: 55 };
    this.time = 0;
  }

  resize(w, h) {
    this.camera.aspect = w / h;
    this.baseFov = w < h ? 70 : 55;
    this.camera.fov = this.baseFov;
    this.camera.updateProjectionMatrix();
    this.post.setSize();
  }

  // ------------------------------------------------------------------ build
  load(stage, ghost) {
    this.stage = stage;
    this.theme = THEME[stage.id] || 'street';
    this.look = LOOK[this.theme];
    this.map = stage.map.map(r => r.split(''));
    this.H = this.map.length;
    this.W = this.map[0].length;
    this.rand = rng(hashStr(stage.id));
    this.runRand = rng((Date.now() ^ hashStr(stage.id)) >>> 0);

    if (this.scene) this.dispose();
    const scene = (this.scene = new THREE.Scene());
    this.buildSky();

    this.places = [];      // 喫煙所や店などの使える場所
    this.markers = [];
    this.hmap = new Map(); // 建物の高さ（カメラのめり込み防止用）
    this.storeTiles = new Map(); // 店先・喫煙所の奥側（カメラが入らないように）
    this.fadeProps = [];         // カメラが近いと隠す小物
    this.buildGround();
    this.buildBuildings();
    this.buildProps();
    this.buildStreetFurniture();
    this.buildPlayer();
    this.buildNpcs();
    this.buildAura();
    if (this.theme === 'rain') this.buildRain();
    this.ghost = null;
    if (ghost && ghost.frames && ghost.frames.length > 4) this.buildGhost(ghost);

    // 状態
    const p = this.player;
    const ch = this.character || CHARACTERS[0];
    this.stats = ch.stats;
    Object.assign(p, {
      nic: 40, mental: 100, aura: BASE_AURA, mode: ch.start.mode, cigs: ch.start.cigs, battery: ch.start.battery, money: ch.start.money,
      sprays: ch.start.sprays, gums: ch.start.gums, hasSmoked: false, smoking: null, torch: false,
      curse: 0, tsk: 0, running: false, crouch: false, streetConfirm: 0, lastCause: '', inLegal: false, contactCd: 0,
    });
    this.elapsed = 0;
    this.extraMin = 0;
    this.windIdx = 0;
    this.setWind(stage.wind[0]);
    this.over = false;
    this.cleared = false;
    this.endT = 0;
    this.record = [];
    this.recordT = 0;
    this.shake = 0;
    this.alertT = 0;
    this.cautionT = 0;
    this.phase = 'normal';
    const cs = this.camState;
    cs.pitch = 0.3;
    cs.autoPitch = null;
    cs.yaw = p.facing + Math.PI;
    cs.cur = cs.dist;
    this.objective = '喫煙所を探して一服しろ';
    this.titleMode = false;
    this.post.setGrade(this.theme);
    this.ui.radarInit(this);
    this.ui.toast(stage.intro, 4200);
  }

  dispose() {
    this.scene.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose());
    });
    if (this.envRT) { this.envRT.dispose(); this.envRT = null; }
    this.ui.clearBubbles();
  }

  tile(tx, ty) { return (ty < 0 || ty >= this.H || tx < 0 || tx >= this.W) ? '#' : this.map[ty][tx]; }
  solidTile(tx, ty) { const c = this.tile(tx, ty); return c === '#' || c === 'T'; }
  sightBlock(tx, ty) { const c = this.tile(tx, ty); return c === '#' || c === 'T'; }
  w2t(v) { return Math.floor(v / T); }
  tc(tx) { return tx * T + T / 2; }
  walkable(c) { return c !== '#' && c !== 'T'; }
  groundY(x, z) { return this.tile(this.w2t(x), this.w2t(z)) === '.' ? 0 : WALK_Y; }

  // 道路側を向く方向（店の向き）
  facingOf(tx, ty) {
    const dirs = [[0, 1], [1, 0], [-1, 0], [0, -1]];
    for (const [dx, dy] of dirs) {
      const c = this.tile(tx + dx, ty + dy);
      if ('.,g'.includes(c)) return [dx, dy];
    }
    return [0, 1];
  }

  // ------------------------------------------------------------------ sky / light
  buildSky() {
    const L = this.look;
    const scene = this.scene;
    scene.background = new THREE.Color(L.sky[1]);
    scene.fog = new THREE.Fog(L.fog, L.fogNear, L.fogFar);
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), skyMaterial(...L.sky));
    this.sky.renderOrder = -10;
    this.sky.frustumCulled = false;
    scene.add(this.sky);

    // 映り込み用の環境マップ（空のグラデーション＋太陽の明るい板）
    const envScene = new THREE.Scene();
    envScene.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), skyMaterial(...L.sky)));
    const sunCol = new THREE.Color(L.sun).multiplyScalar(this.theme === 'rain' ? 1.5 : 6);
    const sunPanel = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.MeshBasicMaterial({ color: sunCol, side: THREE.DoubleSide }));
    sunPanel.position.set(...L.sunDir).multiplyScalar(40);
    sunPanel.lookAt(0, 0, 0);
    envScene.add(sunPanel);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const win = new THREE.Mesh(new THREE.PlaneGeometry(3, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd9a0).multiplyScalar(L.emi * 1.5), side: THREE.DoubleSide }));
      win.position.set(Math.cos(a) * 30, 4, Math.sin(a) * 30);
      win.lookAt(0, 4, 0);
      envScene.add(win);
    }
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envRT = pmrem.fromScene(envScene, 0.03);
    pmrem.dispose();
    envScene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    scene.environment = this.envRT.texture;
    scene.environmentIntensity = L.env;

    const hemi = new THREE.HemisphereLight(L.hemi[0], L.hemi[1], L.hemi[2]);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(L.sun, L.sunI);
    this.sunDir = new THREE.Vector3(...L.sunDir).normalize();
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -30; sc.right = 30; sc.top = 30; sc.bottom = -30; sc.near = 1; sc.far = 160;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    scene.add(sun, sun.target);
    this.sun = sun;
    this.hemi = hemi;
  }

  // ------------------------------------------------------------------ ground
  buildGround() {
    const L = this.look;
    const rain = !!L.wet;
    const kinds = {
      road:  { tex: tex(rain ? 'wet' : 'asphalt', () => groundTexture(rain ? 'wet' : 'asphalt')), rough: rain ? 0.16 : 0.92, top: 0, cells: [] },
      side:  { tex: tex('pavers', () => groundTexture('pavers')), rough: rain ? 0.32 : 0.86, top: WALK_Y, cells: [] },
      grass: { tex: tex('grass', () => groundTexture('grass')), rough: 1, top: WALK_Y, cells: [] },
      floor: { tex: tex('floor', () => groundTexture('floor')), rough: 0.28, top: WALK_Y, cells: [] },
    };
    for (let y = 0; y < this.H; y++) for (let x = 0; x < this.W; x++) {
      const c = this.tile(x, y);
      if (c === '#') continue;
      let k = 'side';
      if (c === '.') k = 'road';
      else if (c === 'g' || (c === 'T' && this.theme === 'garden')) k = 'grass';
      else if (this.theme === 'station') k = 'floor';
      kinds[k].cells.push([x, y]);
    }
    const m = new THREE.Matrix4();
    const col = new THREE.Color();
    for (const [name, k] of Object.entries(kinds)) {
      if (!k.cells.length) continue;
      const h = 0.4;
      const geo = new THREE.BoxGeometry(T, h, T);
      geo.translate(0, k.top - h / 2, 0);
      const mat = new THREE.MeshStandardMaterial({ map: k.tex, roughness: k.rough, metalness: 0 });
      const inst = new THREE.InstancedMesh(geo, mat, k.cells.length);
      k.cells.forEach(([x, y], i) => {
        m.makeTranslation(this.tc(x), 0, this.tc(y));
        inst.setMatrixAt(i, m);
        const v = 0.94 + hash2(x, y, 7) * 0.08;
        col.setRGB(v, v, v);
        if (name === 'side' && 'SXHKCOPG'.includes(this.tile(x, y))) col.setRGB(0.86, 0.85, 0.82);
        if (name === 'floor' && 'PG'.includes(this.tile(x, y))) col.setRGB(0.7, 0.78, 0.92);
        inst.setColorAt(i, col);
      });
      inst.receiveShadow = true;
      this.scene.add(inst);
    }
    // 外側の地面（地平線の切れ目を隠す）
    const outer = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshStandardMaterial({ color: this.theme === 'garden' ? 0x51683c : 0x3b3e42, roughness: 1 }));
    outer.rotation.x = -Math.PI / 2;
    outer.position.set(this.W, -0.05, this.H);
    outer.receiveShadow = true;
    this.scene.add(outer);

    // 道路の白線
    if (this.theme === 'street' || this.theme === 'rain') {
      const lineMat = new THREE.MeshStandardMaterial({ color: 0xdedbd2, roughness: 0.7 });
      const lg = new THREE.PlaneGeometry(0.9, 0.12);
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
        m.setPosition(x, 0.012, z);
        li.setMatrixAt(i, m);
      });
      li.count = pts.length;
      li.receiveShadow = true;
      this.scene.add(li);
    }

    // 雨：水たまり
    if (rain) {
      const pm = new THREE.MeshStandardMaterial({ color: 0x15181c, roughness: 0.02, metalness: 0.2 });
      for (let i = 0; i < 40; i++) {
        const x = Math.floor(this.rand() * this.W), y = Math.floor(this.rand() * this.H);
        if (!'.,'.includes(this.tile(x, y))) continue;
        const pd = new THREE.Mesh(new THREE.CircleGeometry(0.4 + this.rand() * 0.8, 20), pm);
        pd.rotation.x = -Math.PI / 2;
        pd.scale.set(1, 0.5 + this.rand() * 0.6, 1);
        pd.position.set(this.tc(x) + (this.rand() - 0.5), this.groundY(this.tc(x), this.tc(y)) + 0.006, this.tc(y) + (this.rand() - 0.5));
        pd.receiveShadow = true;
        this.scene.add(pd);
      }
    }
  }

  // ------------------------------------------------------------------ buildings
  facadeMat(kind) {
    const atlas = tex(`facade-${kind}`, () => facadeAtlas(kind, kind.length * 13));
    return withInstUv(new THREE.MeshStandardMaterial({
      map: atlas.map, emissiveMap: atlas.emi, emissive: 0xffffff, emissiveIntensity: this.look.emi, roughness: 0.8, metalness: 0.05,
    }));
  }

  buildBuildings() {
    const L = this.look;
    const groups = new Map();
    const hedges = [];
    const add = (x, y, inMap) => {
      let hi, fi, tint;
      if (this.theme === 'garden') {
        if (inMap && !(y <= 6 && x >= 8 && x <= 21)) { hedges.push([x, y]); this.hmap.set(`${x},${y}`, 1.8); return; }
        if (!inMap) {
          // 式場の外：低い街並み
          const h = [4.8, 7.2, 9.6][Math.floor(hash2(Math.floor(x / 3), Math.floor(y / 3), 3) * 3)];
          const key = `${h}|apart`;
          if (!groups.has(key)) groups.set(key, { h, kind: 'apart', list: [] });
          groups.get(key).list.push([x, y, 0xf0ece4]);
          this.hmap.set(`${x},${y}`, h);
          return;
        }
        hi = 0; fi = 0; tint = 0xffffff;
      } else {
        const lx = Math.floor((x + 7) / 3), ly = Math.floor((y + 5) / 3);
        hi = Math.floor(hash2(lx, ly, 1) * L.heights.length);
        if (!inMap) hi = Math.min(L.heights.length - 1, hi + 1);
        fi = Math.floor(hash2(lx, ly, 2) * L.facades.length);
        tint = L.tints[Math.floor(hash2(lx, ly, 4) * L.tints.length)];
      }
      const h = L.heights[hi];
      const kind = L.facades[fi];
      const key = `${h}|${kind}`;
      if (!groups.has(key)) groups.set(key, { h, kind, list: [] });
      groups.get(key).list.push([x, y, tint]);
      this.hmap.set(`${x},${y}`, h);
    };
    for (let y = 0; y < this.H; y++) for (let x = 0; x < this.W; x++) if (this.tile(x, y) === '#') add(x, y, true);
    if (L.filler) {
      const R = 6;
      for (let y = -R; y < this.H + R; y++) for (let x = -R; x < this.W + R; x++) {
        if (x >= 0 && y >= 0 && x < this.W && y < this.H) continue;
        add(x, y, false);
      }
    }

    const roof = new THREE.MeshStandardMaterial({ map: tex('roof', roofTexture), roughness: 0.95 });
    const sideMats = {};
    const m = new THREE.Matrix4();
    const col = new THREE.Color();
    for (const { h, kind, list } of groups.values()) {
      const side = sideMats[kind] || (sideMats[kind] = this.facadeMat(kind));
      const geo = new THREE.BoxGeometry(T, h, T);
      geo.translate(0, h / 2, 0);
      const uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) {
        const face = Math.floor(i / 4);
        if (face === 2 || face === 3) continue;
        uv.setXY(i, uv.getX(i) * 0.25, uv.getY(i) * (h / 2.4) * 0.25);
      }
      const inst = new THREE.InstancedMesh(geo, [side, side, roof, roof, side, side], list.length);
      const off = new Float32Array(list.length * 2);
      list.forEach(([x, y, tint], i) => {
        m.makeTranslation(this.tc(x), 0, this.tc(y));
        inst.setMatrixAt(i, m);
        col.setHex(tint);
        inst.setColorAt(i, col);
        off[i * 2] = Math.floor(hash2(x, y, 11) * 4) * 0.25;
        off[i * 2 + 1] = Math.floor(hash2(x, y, 12) * 4) * 0.25;
      });
      geo.setAttribute('instUv', new THREE.InstancedBufferAttribute(off, 2));
      inst.castShadow = true;
      inst.receiveShadow = true;
      this.scene.add(inst);
    }

    // 生け垣（結婚式場）
    if (hedges.length) {
      const geo = new THREE.BoxGeometry(T, 1.8, T);
      geo.translate(0, 0.9, 0);
      const mat = new THREE.MeshStandardMaterial({ map: tex('grass', () => groundTexture('grass')), color: 0x5d8a4c, roughness: 1 });
      const inst = new THREE.InstancedMesh(geo, mat, hedges.length);
      hedges.forEach(([x, y], i) => { m.makeTranslation(this.tc(x), 0, this.tc(y)); inst.setMatrixAt(i, m); });
      inst.castShadow = inst.receiveShadow = true;
      this.scene.add(inst);
    }

    // 1階の店先（道に面した壁に貼る）
    if (L.shops) {
      const fronts = [];
      for (let y = 0; y < this.H; y++) for (let x = 0; x < this.W; x++) {
        if (this.tile(x, y) !== '#') continue;
        for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1]]) {
          if ('.,'.includes(this.tile(x + dx, y + dy))) fronts.push([x, y, dx, dy]);
        }
      }
      const atlas = tex('shops', () => shopAtlas(5));
      const geo = new THREE.PlaneGeometry(T, 2.6);
      geo.translate(0, 1.3, 0);
      const uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) / 8);
      const mat = withInstUv(new THREE.MeshStandardMaterial({ map: atlas.map, emissiveMap: atlas.emi, emissive: 0xffffff, emissiveIntensity: Math.min(1.0, L.emi * 0.9), roughness: 0.6 }));
      const inst = new THREE.InstancedMesh(geo, mat, fronts.length);
      const off = new Float32Array(fronts.length * 2);
      const q = new THREE.Quaternion();
      const up = new THREE.Vector3(0, 1, 0);
      const awn = [];
      fronts.forEach(([x, y, dx, dy], i) => {
        q.setFromAxisAngle(up, Math.atan2(dx, dy));
        m.compose(new THREE.Vector3(this.tc(x) + dx * (T / 2 + 0.02), 0, this.tc(y) + dy * (T / 2 + 0.02)), q, new THREE.Vector3(1, 1, 1));
        inst.setMatrixAt(i, m);
        off[i * 2] = Math.floor(hash2(x * 3 + dx, y * 3 + dy, 21) * 8) / 8;
        if (hash2(x, y, 22) < 0.35) awn.push([x, y, dx, dy]);
      });
      geo.setAttribute('instUv', new THREE.InstancedBufferAttribute(off, 2));
      inst.receiveShadow = true;
      this.scene.add(inst);
      // ひさし
      if (awn.length) {
        const ag = new THREE.BoxGeometry(T * 0.96, 0.08, 0.7);
        const ai = new THREE.InstancedMesh(ag, new THREE.MeshStandardMaterial({ roughness: 0.7 }), awn.length);
        awn.forEach(([x, y, dx, dy], i) => {
          const qq = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.22, Math.atan2(dx, dy), 0, 'YXZ'));
          m.compose(new THREE.Vector3(this.tc(x) + dx * (T / 2 + 0.36), 2.72, this.tc(y) + dy * (T / 2 + 0.36)), qq, new THREE.Vector3(1, 1, 1));
          ai.setMatrixAt(i, m);
          col.setHSL(hash2(x, y, 23), 0.45, 0.38);
          ai.setColorAt(i, col);
        });
        ai.castShadow = true;
        this.scene.add(ai);
      }
    }

    // 駅：天井と蛍光灯
    if (L.ceiling) {
      const ceil = new THREE.Mesh(new THREE.PlaneGeometry(this.W * T + 4, this.H * T + 4), new THREE.MeshStandardMaterial({ color: 0x3a3e42, roughness: 0.9 }));
      ceil.rotation.x = Math.PI / 2;
      ceil.position.set(this.W * T / 2, L.ceiling, this.H * T / 2);
      this.scene.add(ceil);
      const lights = [];
      for (let y = 0; y < this.H; y++) for (let x = 0; x < this.W; x++) {
        if (this.walkable(this.tile(x, y)) && x % 3 === 1 && y % 2 === 0) lights.push([x, y]);
      }
      const lg = new THREE.BoxGeometry(0.35, 0.06, T * 1.4);
      const li = new THREE.InstancedMesh(lg, new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xf2fff6, emissiveIntensity: 3.2 }), lights.length);
      lights.forEach(([x, y], i) => { m.makeTranslation(this.tc(x), L.ceiling - 0.04, this.tc(y)); li.setMatrixAt(i, m); });
      this.scene.add(li);
    }
  }

  // ------------------------------------------------------------------ props
  addSprite(tex, x, y, z, sx, sy = sx) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false }));
    s.position.set(x, y, z);
    s.scale.set(sx, sy, 1);
    this.scene.add(s);
    return s;
  }

  addMarker(text, bg, x, z, kind, place) {
    const s = this.addSprite(badgeTexture(text, bg), x, 3.6, z, 0.05);
    s.material.sizeAttenuation = false;
    s.material.depthTest = false;
    s.material.transparent = true;
    s.renderOrder = 10;
    const mk = { sprite: s, kind, place, x, z, bob: this.rand() * 6 };
    this.markers.push(mk);
    return mk;
  }

  storefront(x, y, color, label) {
    const [dx, dy] = this.facingOf(x, y);
    const g = new THREE.Group();
    const back = new THREE.Mesh(new THREE.BoxGeometry(T, 3.4, T * 0.4), new THREE.MeshStandardMaterial({ color: 0xe8e2d6, roughness: 0.8 }));
    back.position.set(0, 1.7, -T * 0.3);
    const door = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2.1), new THREE.MeshStandardMaterial({ color: 0x1d2328, roughness: 0.05, metalness: 0.4, emissive: 0xffd8a0, emissiveIntensity: 0.25 * this.look.emi + 0.1 }));
    door.position.set(0, 1.05, -T * 0.09);
    const awn = new THREE.Mesh(new THREE.BoxGeometry(T, 0.12, T * 0.55), new THREE.MeshStandardMaterial({ color, roughness: 0.6 }));
    awn.position.set(0, 2.5, -T * 0.05);
    awn.rotation.x = 0.25;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(T * 0.95, 0.6), new THREE.MeshStandardMaterial({ map: signTexture(label, '#' + new THREE.Color(color).getHexString()), emissive: 0xffffff, emissiveIntensity: 0.55, emissiveMap: null }));
    sign.material.emissiveMap = sign.material.map;
    sign.position.set(0, 3.0, -T * 0.09);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(T * 0.9, 0.04, 0.04), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffe6c0, emissiveIntensity: 2.5 }));
    strip.position.set(0, 2.32, T * 0.12);
    g.add(back, door, awn, sign, strip);
    back.castShadow = awn.castShadow = true;
    g.position.set(this.tc(x), 0, this.tc(y));
    g.rotation.y = Math.atan2(dx, dy);
    this.scene.add(g);
    this.storeTiles.set(`${x},${y}`, [dx, dy, 3.5]);
    // カメラが店先の真上・真後ろに来たら、ひさしと看板は隠す
    for (const o of [awn, sign, strip]) this.fadeProps.push({ obj: o, x: this.tc(x), z: this.tc(y), r: 2.4 });
    return g;
  }

  smokingSpot(x, y, indoor) {
    const g = new THREE.Group();
    const dark = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, metalness: 0.6, roughness: 0.35 });
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 1.0, 16), dark);
    stand.position.y = 0.5 + WALK_Y;
    const topm = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.08, 16), new THREE.MeshStandardMaterial({ color: 0x8a8a8a, metalness: 0.9, roughness: 0.25 }));
    topm.position.y = 1.04 + WALK_Y;
    const panelMat = new THREE.MeshStandardMaterial({ color: indoor ? 0xaad4ec : 0x5f7352, transparent: indoor, opacity: indoor ? 0.4 : 1, roughness: indoor ? 0.05 : 0.7, metalness: indoor ? 0.3 : 0 });
    const p1 = new THREE.Mesh(new THREE.BoxGeometry(T * 0.95, 2.0, 0.08), panelMat);
    p1.position.set(0, 1.0 + WALK_Y, -T * 0.45);
    const p2 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.0, T * 0.6), panelMat);
    p2.position.set(-T * 0.45, 1.0 + WALK_Y, -T * 0.15);
    const roofP = new THREE.Mesh(new THREE.BoxGeometry(T * 0.98, 0.08, T * 0.7), new THREE.MeshStandardMaterial({ color: 0x4a5444, roughness: 0.6 }));
    roofP.position.set(0, 2.06 + WALK_Y, -T * 0.12);
    const lines = new THREE.Mesh(new THREE.RingGeometry(T * 0.62, T * 0.68, 4, 1, Math.PI / 4), new THREE.MeshBasicMaterial({ color: 0xf2c94c }));
    lines.rotation.x = -Math.PI / 2;
    lines.position.y = WALK_Y + 0.012;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.5), new THREE.MeshStandardMaterial({ map: signTexture('喫煙所', '#2f6b3a'), emissive: 0xffffff, emissiveIntensity: 0.6 }));
    sign.material.emissiveMap = sign.material.map;
    sign.position.set(0, 1.7 + WALK_Y, -T * 0.4);
    g.add(stand, topm, p1, p2, roofP, lines, sign);
    [stand, p1, p2, roofP].forEach(o => (o.castShadow = true));
    g.position.set(this.tc(x), 0, this.tc(y));
    const [dx, dy] = this.facingOf(x, y);
    g.rotation.y = Math.atan2(dx, dy);
    this.scene.add(g);
    this.storeTiles.set(`${x},${y}`, [dx, dy, 2.3]);
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
            slab.position.y = WALK_Y + 0.03;
            const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.12, 6), new THREE.MeshStandardMaterial({ color: 0x555555 }));
            bolt.position.set(0.1, WALK_Y + 0.08, 0.05);
            const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.55), new THREE.MeshBasicMaterial({ map: signTexture('灰皿は撤去しました', '#8a3b2e') }));
            sign.position.set(0, 1.4, -T * 0.4);
            const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.4, 6), new THREE.MeshStandardMaterial({ color: 0x888888 }));
            pole.position.set(0, 0.7, -T * 0.42);
            // 三角コーン
            const cone = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.6, 12), new THREE.MeshStandardMaterial({ color: 0xff5a1f, roughness: 0.6 }));
            cone.position.set(-0.5, WALK_Y + 0.3, 0.3);
            ruin.add(slab, bolt, sign, pole, cone);
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
          const sign = this.addSprite(signTexture('14:30発 のぞみ', '#1f4e8c'), wx, 4.5, wz, 2.6, 0.98);
          sign.material.depthWrite = true;
          const edge = new THREE.Mesh(new THREE.BoxGeometry(T, 0.05, 0.25), new THREE.MeshStandardMaterial({ color: 0xf2c94c, emissive: 0xf2c94c, emissiveIntensity: 0.4 }));
          edge.position.set(wx, WALK_Y + 0.03, wz - T * 0.35);
          this.scene.add(edge);
        }
        this.goal = { x, y, key };
        this.goal.marker = this.addMarker(label, '#c0392b', wx, wz, 'goal', this.goal);
      } else if (c === 'P') {
        this.addSprite(signTexture('到着ホーム', '#1f4e8c'), wx, 4.5, wz, 2.6, 0.98);
      } else if (c === 'T') {
        this.tree(x, y);
      }
    }
    if (!this.goal) {
      // 職場がスタート地点を兼ねる
      for (let y = 0; y < this.H; y++) for (let x = 0; x < this.W; x++) if (this.tile(x, y) === 'O') this.goal = { x, y };
    }
    // 自販機
    if (this.theme === 'street' || this.theme === 'rain' || this.theme === 'station') {
      const vm = [0xc0392b, 0x2e86c1, 0xe8e8e8].map(c => {
        const t = tex(`vend-${c}`, () => vendTexture('#' + new THREE.Color(c).getHexString()));
        const body = new THREE.MeshStandardMaterial({ color: c, roughness: 0.45, metalness: 0.2 });
        const front = new THREE.MeshStandardMaterial({ map: t.map, emissiveMap: t.emi, emissive: 0xffffff, emissiveIntensity: 1.2, roughness: 0.3 });
        return [body, body, body, body, front, body];
      });
      const vg = new THREE.BoxGeometry(0.9, 1.85, 0.62);
      for (let i = 0; i < 22; i++) {
        const x = Math.floor(this.rand() * this.W), y = Math.floor(this.rand() * this.H);
        if (this.tile(x, y) !== '#') continue;
        const [dx, dy] = this.facingOf(x, y);
        if (!'.,'.includes(this.tile(x + dx, y + dy))) continue;
        const v = new THREE.Mesh(vg, vm[i % 3]);
        v.position.set(this.tc(x) + dx * (T / 2 + 0.31) + dy * 0.45, 0.93 + this.groundY(this.tc(x + dx), this.tc(y + dy)), this.tc(y) + dy * (T / 2 + 0.31) + dx * 0.45);
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
      obj = new THREE.Group();
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(T * 0.7, this.look.ceiling, T * 0.7), new THREE.MeshStandardMaterial({ color: 0xd9d6cf, roughness: 0.5 }));
      pillar.position.y = this.look.ceiling / 2;
      pillar.castShadow = pillar.receiveShadow = true;
      obj.add(pillar);
      const words = ['駅弁フェア', 'のりかえ', '新発売', '旅にでよう'];
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        const pst = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.8), new THREE.MeshStandardMaterial({ map: posterTexture(words[(x + y + i) % 4], ((x * 37 + y * 11 + i * 70) % 360)), emissive: 0xffffff, emissiveIntensity: 0.45 }));
        pst.material.emissiveMap = pst.material.map;
        pst.position.set(Math.sin(a) * (T * 0.35 + 0.01), 1.9, Math.cos(a) * (T * 0.35 + 0.01));
        pst.rotation.y = a;
        obj.add(pst);
      }
      obj.position.set(wx, 0, wz);
    } else if (this.theme === 'garden') {
      obj = new THREE.Group();
      const leafMat = new THREE.MeshStandardMaterial({ color: 0x3f7a3a, roughness: 1, flatShading: true });
      const base = new THREE.Mesh(new THREE.BoxGeometry(T * 0.95, 1.3, T * 0.8), leafMat);
      base.position.y = 0.75;
      const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 1), leafMat);
      ball.position.y = 1.75;
      base.castShadow = ball.castShadow = true;
      obj.add(base, ball);
      // 花
      const fl = new THREE.MeshStandardMaterial({ color: [0xf4f0f0, 0xf2a7c0, 0xfff2b0][(x + y) % 3], roughness: 0.8 });
      for (let i = 0; i < 6; i++) {
        const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 0), fl);
        f.position.set((this.rand() - 0.5) * 1.6, 1.42, (this.rand() - 0.5) * 1.2);
        obj.add(f);
      }
      obj.position.set(wx, 0, wz);
    } else {
      obj = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.2, 2.4, 8), new THREE.MeshStandardMaterial({ color: 0x5a4434, roughness: 1 }));
      trunk.position.y = 1.2;
      const leafMat = new THREE.MeshStandardMaterial({ color: this.theme === 'rain' ? 0x35562f : 0x456f3a, flatShading: true, roughness: 0.9 });
      obj.add(trunk);
      for (let i = 0; i < 4; i++) {
        const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.7 + this.rand() * 0.35, 1), leafMat);
        leaf.position.set((this.rand() - 0.5) * 0.9, 2.6 + this.rand() * 0.8, (this.rand() - 0.5) * 0.9);
        leaf.castShadow = true;
        obj.add(leaf);
      }
      trunk.castShadow = true;
      // 植え込みの枠
      const curb = new THREE.Mesh(new THREE.BoxGeometry(T * 0.9, 0.25, T * 0.9), new THREE.MeshStandardMaterial({ color: 0x8d877c }));
      curb.position.y = WALK_Y + 0.12;
      curb.receiveShadow = true;
      obj.add(curb);
      obj.position.set(wx, 0, wz);
    }
    this.scene.add(obj);
  }

  // 電柱・電線・街灯・段ボール
  buildStreetFurniture() {
    const L = this.look;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const one = new THREE.Vector3(1, 1, 1);

    if (L.poles) {
      const poles = [];
      for (let y = 0; y < this.H; y++) for (let x = 0; x < this.W; x++) {
        if (!'.,'.includes(this.tile(x, y))) continue;
        if ((x * 7 + y * 3) % 5 !== 0) continue;
        for (const [dx, dy] of [[0, -1], [-1, 0], [0, 1], [1, 0]]) {
          if (this.tile(x + dx, y + dy) !== '#') continue;
          poles.push({ x: this.tc(x) + dx * (T / 2 - 0.22), z: this.tc(y) + dy * (T / 2 - 0.22), dx, dy, gy: this.groundY(this.tc(x), this.tc(y)) });
          break;
        }
      }
      const H = 7.4;
      const concrete = new THREE.MeshStandardMaterial({ color: 0x9d9a92, roughness: 0.85 });
      const dark = new THREE.MeshStandardMaterial({ color: 0x2c2e30, roughness: 0.6, metalness: 0.4 });
      const lampMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffe2b8, emissiveIntensity: this.theme === 'rain' ? 4 : 1.2 });
      const pole = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.11, 0.15, H, 8).translate(0, H / 2, 0), concrete, poles.length);
      const bar = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 0.1, 1.5), dark, poles.length);
      const arm = new THREE.InstancedMesh(new THREE.BoxGeometry(0.06, 0.06, 1.3), dark, poles.length);
      const head = new THREE.InstancedMesh(new THREE.BoxGeometry(0.26, 0.1, 0.5), lampMat, poles.length);
      const trans = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.22, 0.22, 0.7, 10), concrete, poles.length);
      poles.forEach((p, i) => {
        const ang = Math.atan2(p.dx, p.dy);
        q.setFromAxisAngle(up, ang);
        m.compose(new THREE.Vector3(p.x, p.gy, p.z), q, one); pole.setMatrixAt(i, m);
        m.compose(new THREE.Vector3(p.x, p.gy + H - 0.6, p.z), q, one); bar.setMatrixAt(i, m);
        m.compose(new THREE.Vector3(p.x - p.dx * 0.65, p.gy + 4.6, p.z - p.dy * 0.65), q, one); arm.setMatrixAt(i, m);
        m.compose(new THREE.Vector3(p.x - p.dx * 1.25, p.gy + 4.55, p.z - p.dy * 1.25), q, one); head.setMatrixAt(i, m);
        m.compose(new THREE.Vector3(p.x + p.dy * 0.3, p.gy + H - 1.6, p.z - p.dx * 0.3), q, i % 3 ? new THREE.Vector3(0, 0, 0) : one); trans.setMatrixAt(i, m);
      });
      [pole, bar, trans].forEach(o => { o.castShadow = true; this.scene.add(o); });
      this.scene.add(arm, head);

      // 電線（同じ列に並んだ電柱どうしをたるませてつなぐ）
      const pts = [];
      for (let i = 0; i < poles.length; i++) for (let j = i + 1; j < poles.length; j++) {
        const a = poles[i], b = poles[j];
        const dxw = b.x - a.x, dzw = b.z - a.z;
        const d = Math.hypot(dxw, dzw);
        if (d < 3 || d > 13) continue;
        if (Math.abs(dxw) > 0.3 && Math.abs(dzw) > 0.3) continue;
        const mid = this.tile(this.w2t((a.x + b.x) / 2), this.w2t((a.z + b.z) / 2));
        if (mid === '#') continue;
        for (const o of [-0.6, 0, 0.6]) {
          const ox = a.dx * o, oz = a.dy * o;
          const seg = 10;
          for (let k = 0; k < seg; k++) {
            const t0 = k / seg, t1 = (k + 1) / seg;
            const y0 = a.gy + H - 0.55 - Math.sin(t0 * Math.PI) * 0.55, y1 = a.gy + H - 0.55 - Math.sin(t1 * Math.PI) * 0.55;
            pts.push(a.x + dxw * t0 + ox, y0, a.z + dzw * t0 + oz, a.x + dxw * t1 + ox, y1, a.z + dzw * t1 + oz);
          }
        }
      }
      if (pts.length) {
        const wg = new THREE.BufferGeometry();
        wg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
        this.scene.add(new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: 0x1c1c1c, transparent: true, opacity: 0.8 })));
      }
      // 雨の夜は街灯の下に光だまり
      if (this.theme === 'rain') {
        const gm = new THREE.MeshBasicMaterial({ map: tex('glow', () => glowTexture()), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
        const gg = new THREE.PlaneGeometry(5, 5);
        gg.rotateX(-Math.PI / 2);
        const gi = new THREE.InstancedMesh(gg, gm, poles.length);
        poles.forEach((p, i) => { m.makeTranslation(p.x - p.dx * 1.25, p.gy + 0.02, p.z - p.dy * 1.25); gi.setMatrixAt(i, m); });
        gi.renderOrder = 1;
        this.scene.add(gi);
      }
    }

    // 段ボール箱（どこかで見たような…）
    if (this.theme !== 'garden') {
      const bm = new THREE.MeshStandardMaterial({ map: tex('cardboard', cardboardTexture), roughness: 0.9 });
      const bg = new THREE.BoxGeometry(0.78, 0.6, 0.6);
      let n = 0;
      for (let i = 0; i < 60 && n < 7; i++) {
        const x = Math.floor(this.rand() * this.W), y = Math.floor(this.rand() * this.H);
        if (!'.,'.includes(this.tile(x, y))) continue;
        const dirs = [[0, 1], [1, 0], [-1, 0], [0, -1]].filter(([dx, dy]) => this.tile(x + dx, y + dy) === '#');
        if (!dirs.length) continue;
        const [dx, dy] = dirs[0];
        const gy = this.groundY(this.tc(x), this.tc(y));
        const stack = 1 + (this.rand() < 0.4 ? 1 : 0);
        for (let s = 0; s < stack; s++) {
          const b = new THREE.Mesh(bg, bm);
          b.position.set(this.tc(x) + dx * (T / 2 - 0.36) + dy * (this.rand() - 0.5), gy + 0.3 + s * 0.6, this.tc(y) + dy * (T / 2 - 0.36) + dx * (this.rand() - 0.5));
          b.rotation.y = Math.atan2(dx, dy) + (this.rand() - 0.5) * 0.4;
          b.castShadow = b.receiveShadow = true;
          this.scene.add(b);
        }
        n++;
      }
    }

    // 結婚式場：花のアーチと灯り
    if (this.theme === 'garden' && this.goal) {
      const gx = this.tc(this.goal.x), gz = this.tc(this.goal.y);
      const [fx, fy] = this.facingOf(this.goal.x, this.goal.y);
      const arch = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.1, 8, 24, Math.PI), new THREE.MeshStandardMaterial({ color: 0xf6f1ea, roughness: 0.6 }));
      arch.position.set(gx + fx * 4.0, WALK_Y, gz + fy * 4.0);
      arch.rotation.y = Math.atan2(fy, -fx);
      arch.scale.set(1, 1.85, 1);
      this.fadeProps.push({ obj: arch, x: arch.position.x, z: arch.position.z, r: 2.3 });
      arch.castShadow = true;
      this.scene.add(arch);
      const fm = new THREE.MeshStandardMaterial({ color: 0xf2b8c8, roughness: 0.8 });
      for (let i = 0; i < 14; i++) {
        const a = (i / 13) * Math.PI;
        const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0), fm);
        f.scale.set(1, 0.55, 1);
        f.position.set(Math.cos(a) * 1.5, Math.sin(a) * 1.5, 0);
        arch.add(f);
      }
    }
  }

  // ------------------------------------------------------------------ people
  makePerson({ body = 0x2c3e50, legs = 0x22252b, head = 0xe6be9c, hair = 0x2b2420, shoes = 0x1a1a1c, scale = 1, skirt = false, longHair = false, hairStyle = 'short', extra } = {}) {
    if (longHair) hairStyle = 'long';
    const cloth = (c, r = 0.82) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
    const mBody = cloth(body), mLegs = cloth(legs), mSkin = cloth(head, 0.6), mHair = cloth(hair, 0.7), mShoe = cloth(shoes, 0.4);
    const mesh = (g, m, shadow = false) => { const o = new THREE.Mesh(g, m); o.castShadow = shadow; return o; };
    const root = new THREE.Group();
    const hips = new THREE.Group();
    hips.position.y = 0.98;
    root.add(hips);
    const pelvis = mesh(new THREE.BoxGeometry(0.42, 0.2, 0.26), mLegs, true);
    pelvis.position.y = -0.02;
    hips.add(pelvis);
    const leg = side => {
      const thigh = new THREE.Group();
      thigh.position.set(side * 0.12, -0.06, 0);
      hips.add(thigh);
      const tm = mesh(new THREE.CapsuleGeometry(0.095, 0.3, 4, 8), mLegs, true);
      tm.position.y = -0.22;
      thigh.add(tm);
      const knee = new THREE.Group();
      knee.position.y = -0.44;
      thigh.add(knee);
      const sm = mesh(new THREE.CapsuleGeometry(0.08, 0.3, 4, 8), skirt ? mSkin : mLegs, true);
      sm.position.y = -0.21;
      knee.add(sm);
      const shoe = mesh(new THREE.BoxGeometry(0.15, 0.1, 0.3), mShoe);
      shoe.position.set(0, -0.44, 0.05);
      knee.add(shoe);
      return { thigh, knee };
    };
    const spine = new THREE.Group();
    spine.position.y = 0.06;
    hips.add(spine);
    const torso = mesh(new THREE.BoxGeometry(0.5, 0.56, 0.28), mBody, true);
    torso.position.y = 0.32;
    const chest = mesh(new THREE.CapsuleGeometry(0.13, 0.3, 4, 8), mBody);
    chest.rotation.z = Math.PI / 2;
    chest.position.y = 0.55;
    const neck = mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.14, 8), mSkin);
    neck.position.y = 0.68;
    spine.add(torso, chest, neck);
    const headG = new THREE.Group();
    headG.position.y = 0.72;
    spine.add(headG);
    const hm = mesh(new THREE.SphereGeometry(0.165, 16, 12), mSkin, true);
    hm.scale.set(1, 1.12, 1.06);
    hm.position.y = 0.17;
    let tailRef = null;
    const capLen = hairStyle === 'bob' ? 0.62 : hairStyle === 'buzz' ? 0.42 : 0.55;
    const hr = mesh(new THREE.SphereGeometry(0.178, 16, 10, 0, Math.PI * 2, 0, Math.PI * capLen), mHair);
    hr.scale.set(hairStyle === 'bob' ? 1.1 : 1, 1.08, hairStyle === 'bob' ? 1.14 : 1.1);
    hr.position.set(0, hairStyle === 'buzz' ? 0.19 : 0.2, -0.02);
    const nose = mesh(new THREE.BoxGeometry(0.04, 0.06, 0.05), mSkin);
    nose.position.set(0, 0.15, 0.17);
    headG.add(hm, hr, nose);
    if (hairStyle === 'long') {
      const back = mesh(new THREE.BoxGeometry(0.32, 0.46, 0.1), mHair);
      back.position.set(0, 0.03, -0.14);
      headG.add(back);
      for (const sx of [-1, 1]) {
        const side = mesh(new THREE.BoxGeometry(0.05, 0.3, 0.16), mHair);
        side.position.set(sx * 0.165, 0.1, -0.04);
        headG.add(side);
      }
    } else if (hairStyle === 'bob') {
      const back = mesh(new THREE.BoxGeometry(0.36, 0.2, 0.14), mHair);
      back.position.set(0, 0.1, -0.12);
      headG.add(back);
      for (const sx of [-1, 1]) {
        const side = mesh(new THREE.BoxGeometry(0.06, 0.2, 0.22), mHair);
        side.position.set(sx * 0.17, 0.1, -0.01);
        headG.add(side);
      }
    } else if (hairStyle === 'ponytail') {
      const knot = mesh(new THREE.SphereGeometry(0.07, 10, 8), mHair);
      knot.position.set(0, 0.24, -0.17);
      const tail = mesh(new THREE.CapsuleGeometry(0.05, 0.22, 4, 8), mHair);
      tail.position.set(0, 0.08, -0.21);
      tail.rotation.x = 0.25;
      headG.add(knot, tail);
      tailRef = tail;
      for (const sx of [-1, 1]) {
        const lock = mesh(new THREE.BoxGeometry(0.05, 0.2, 0.08), mHair);
        lock.position.set(sx * 0.16, 0.12, 0.06);
        headG.add(lock);
      }
      const fringe = mesh(new THREE.BoxGeometry(0.26, 0.06, 0.06), mHair);
      fringe.position.set(0.03, 0.3, 0.14);
      fringe.rotation.z = -0.25;
      headG.add(fringe);
    }
    const arm = side => {
      const sh = new THREE.Group();
      sh.position.set(side * 0.31, 0.56, 0);
      spine.add(sh);
      const um = mesh(new THREE.CapsuleGeometry(0.068, 0.22, 4, 8), mBody, true);
      um.position.y = -0.16;
      sh.add(um);
      const el = new THREE.Group();
      el.position.y = -0.33;
      sh.add(el);
      const fm = mesh(new THREE.CapsuleGeometry(0.06, 0.2, 4, 8), mBody);
      fm.position.y = -0.14;
      el.add(fm);
      const hand = new THREE.Group();
      hand.position.y = -0.3;
      el.add(hand);
      hand.add(mesh(new THREE.SphereGeometry(0.068, 10, 8), mSkin));
      return { sh, el, hand, side };
    };
    if (skirt) {
      const sk = mesh(new THREE.CylinderGeometry(0.22, 0.34, 0.5, 14, 1, true), mBody);
      sk.material = mBody.clone();
      sk.material.side = THREE.DoubleSide;
      sk.position.y = -0.22;
      hips.add(sk);
    }
    const rig = { hips, spine, head: headG, legL: leg(-1), legR: leg(1), armL: arm(-1), armR: arm(1), amt: 0, crouch: 0, tail: tailRef, mats: [mBody, mLegs, mSkin, mHair, mShoe] };
    root.userData = rig;
    if (extra) extra(root, cloth, rig);
    root.scale.setScalar(scale);
    return root;
  }

  setCharacter(c) {
    this.character = c || CHARACTERS[0];
    if (this.player && this.scene) {
      // 選択画面：その場で見た目だけ差し替える
      const old = this.player.mesh;
      this.scene.remove(old);
      old.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
      this.player.mesh = this.makePlayerMesh();
      this.player.opacity = 1;
      this.scene.add(this.player.mesh);
    }
  }

  makePlayerMesh() {
    const L = (this.character || CHARACTERS[0]).look;
    return this.makePerson({
      body: L.body, legs: L.legs, hair: L.hair, head: L.skin ?? 0xe6be9c, hairStyle: L.hairStyle, skirt: !!L.skirt, scale: L.scale ?? 1,
      extra: (g, mat, rig) => {
        if (L.shirt) {
          const shirt = new THREE.Mesh(new THREE.BoxGeometry(L.tie ? 0.2 : 0.24, L.tie ? 0.18 : 0.14, 0.02), mat(L.shirt));
          shirt.position.set(0, L.tie ? 0.56 : 0.58, 0.145);
          rig.spine.add(shirt);
          rig.mats.push(shirt.material);
        }
        if (L.tie) {
          const tie = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.42, 0.02), mat(L.tie, 0.5));
          tie.position.set(0, 0.36, 0.15);
          rig.spine.add(tie);
          rig.mats.push(tie.material);
        }
        if (L.glasses) {
          const gl = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.03), mat(0x151515, 0.3));
          gl.position.set(0, 0.2, 0.17);
          rig.head.add(gl);
          rig.mats.push(gl.material);
        }
        if (L.bag) {
          const bag = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.4), mat(L.bag, 0.5));
          bag.position.set(0, -0.12, 0);
          bag.castShadow = true;
          rig.armL.hand.add(bag);
          rig.bag = bag;
          rig.mats.push(bag.material);
        }
        const cig = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.24, 6), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }));
        cig.rotation.x = Math.PI / 2;
        cig.position.set(0.04, 0.12, 0.27);
        cig.visible = false;
        const ember = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 6), new THREE.MeshStandardMaterial({ color: 0xff5a1f, emissive: 0xff5a1f, emissiveIntensity: 6 }));
        ember.position.set(0.04, 0.12, 0.39);
        ember.visible = false;
        rig.head.add(cig, ember);
        rig.cig = cig; rig.ember = ember;
      },
    });
  }

  buildPlayer() {
    const mesh = this.makePlayerMesh();
    let sx = 0, sy = 0;
    for (let y = 0; y < this.H; y++) for (let x = 0; x < this.W; x++) if ('OP'.includes(this.tile(x, y))) { sx = x; sy = y; }
    const [fx, fy] = this.facingOf(sx, sy);
    let px = this.tc(sx) + fx * 0.6, pz = this.tc(sy) + fy * 0.6;  // 元の開始位置
    let [bestScore, facing] = this.viewScore(px, pz);
    // 3人称カメラが窮屈なら、職場のすぐ近く（車道から離れたマス）で見通しのいい場所から始める
    const nearRoad = (x, y) => { for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (this.tile(x + i, y + j) === '.') return true; return false; };
    // 巡回ルートから十分離れていること（開始直後に見つかる難しさを変えない）
    const segD = (x, z, a, b) => {
      const ax = this.tc(a[0]), az = this.tc(a[1]), bx = this.tc(b[0]), bz = this.tc(b[1]);
      const vx = bx - ax, vz = bz - az, L = vx * vx + vz * vz || 1;
      const t = clamp(((x - ax) * vx + (z - az) * vz) / L, 0, 1);
      return Math.hypot(x - ax - vx * t, z - az - vz * t);
    };
    const npcClear = (x, z) => this.stage.npcs.every(n => {
      if (n.type === 'ally') return true;
      const pts = n.path;
      if (pts.length === 1) return segD(x, z, pts[0], pts[0]) > 5;
      for (let i = 0; i < pts.length - 1; i++) if (segD(x, z, pts[i], pts[i + 1]) <= 5) return false;
      return n.mode !== 'loop' || segD(x, z, pts[pts.length - 1], pts[0]) > 5;
    });
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const tx = sx + dx, ty = sy + dy;
      const c = this.tile(tx, ty);
      if (Game.ORIGINAL_SPAWN) break; // 検証用：元の開始位置に固定
      if (!this.walkable(c) || c === '.' || 'SXHKCOG'.includes(c) || nearRoad(tx, ty) || !npcClear(this.tc(tx), this.tc(ty))) continue;
      const [sc, f] = this.viewScore(this.tc(tx), this.tc(ty));
      if (sc - Math.hypot(dx, dy) * 0.5 > bestScore + 1) { bestScore = sc - Math.hypot(dx, dy) * 0.5; facing = f; px = this.tc(tx); pz = this.tc(ty); }
    }
    this.player = { mesh, pos: new THREE.Vector3(px, 0, pz), facing, walk: 0, moving: false, gy: WALK_Y };
    mesh.position.copy(this.player.pos);
    this.scene.add(mesh);
    this.puffs = [];
  }

  buildNpcs() {
    const looks = {
      walker: () => ({ body: [0x8e5b3a, 0x5d6d7e, 0xa04040, 0x3d7a5a, 0x6c5b7b, 0xb0a07a][Math.floor(this.rand() * 6)], legs: [0x3a3f4a, 0x2f3540, 0x5a4a3a][Math.floor(this.rand() * 3)], hair: [0x2b2420, 0x4a3524, 0x777777][Math.floor(this.rand() * 3)] }),
      parent: () => ({ body: 0xd48aa0, legs: 0x4a4f5a, skirt: true, longHair: true, hair: 0x4a3020 }),
      sensitive: () => ({ body: 0xe8e8e8, legs: 0x5a5f6a, longHair: this.rand() < 0.5 }),
      guide: () => ({ body: 0x3b5b8c, legs: 0x2a2f3a }),
      relative: () => ({ body: 0x141414, legs: 0x141414, hair: [0x777777, 0x2b2420][Math.floor(this.rand() * 2)] }),
      ally: () => ({ body: 0x7a7468, legs: 0x3a3a3a, hair: 0x555555 }),
    };
    this.npcs = [];
    for (const def of this.stage.npcs) {
      const cfg = NPC_TYPES[def.type];
      const look = looks[def.type]();
      const mesh = this.makePerson({
        ...look,
        extra: (g, mat, rig) => {
          if (def.type === 'guide') {
            const vest = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.5, 0.32), new THREE.MeshStandardMaterial({ color: 0xf5d90a, emissive: 0x3a3300, roughness: 0.5 }));
            vest.position.y = 0.36;
            const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.05, 0.34), new THREE.MeshStandardMaterial({ color: 0xdddddd, emissive: 0x888888, metalness: 0.6, roughness: 0.2 }));
            stripe.position.y = 0.28;
            rig.spine.add(vest, stripe);
            const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.12, 14), mat(0x2c3e50));
            cap.position.set(0, 0.32, 0.0);
            const brim = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.02, 0.16), mat(0x1c2733));
            brim.position.set(0, 0.27, 0.18);
            rig.head.add(cap, brim);
            const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.32), new THREE.MeshBasicMaterial({ map: signTexture('路上喫煙禁止', '#c0392b'), side: THREE.DoubleSide }));
            const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.9, 6), mat(0x888888));
            stick.position.y = 0.35;
            sign.position.y = 0.9;
            rig.armR.hand.add(stick, sign);
            rig.holdSign = true;
          }
          if (def.type === 'sensitive') {
            const mask = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.13, 0.05), mat(0xffffff));
            mask.position.set(0, 0.11, 0.17);
            rig.head.add(mask);
          }
          if (def.type === 'relative') {
            const tie = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.07, 0.03), mat(0xffffff));
            tie.position.set(0, 0.58, 0.15);
            rig.spine.add(tie);
          }
          if (def.type === 'parent') {
            const kid = this.makePerson({ body: 0xf2c94c, legs: 0x3c6e9e, scale: 0.55 });
            kid.position.set(0.7, 0, 0.1);
            g.add(kid);
            rig.kid = kid;
          }
          if (def.type === 'ally') {
            const cig = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.24, 6), mat(0xffffff));
            cig.rotation.x = Math.PI / 2;
            cig.position.set(0.04, 0.12, 0.27);
            const ember = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 6), new THREE.MeshStandardMaterial({ color: 0xff5a1f, emissive: 0xff5a1f, emissiveIntensity: 6 }));
            ember.position.set(0.04, 0.12, 0.39);
            rig.head.add(cig, ember);
            rig.smoker = true;
          }
        },
      });
      const path = def.path.map(([x, y]) => new THREE.Vector3(this.tc(x), 0, this.tc(y)));
      const npc = {
        type: def.type, cfg, mode: def.mode, path, idx: 1 % path.length, dir: 1,
        pos: path[0].clone(), facing: 0, pause: this.rand() * 1.5, sus: 0, cd: 0, bubbleCd: 0,
        state: 'patrol', chaseT: 0, mesh, walk: this.rand() * 10, lookT: 0, hinted: false, moving: false, headYaw: 0,
      };
      if (path.length > 1) npc.facing = Math.atan2(path[1].x - path[0].x, path[1].z - path[0].z);
      else { const [fx, fy] = this.facingOf(def.path[0][0], def.path[0][1]); npc.facing = Math.atan2(-fx, -fy) + Math.PI; }
      mesh.position.copy(npc.pos);
      this.scene.add(mesh);
      if (!cfg.friendly) {
        const n = 26;
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((n + 2) * 3), 3));
        const cols = new Float32Array((n + 2) * 4);
        cols.set([1, 1, 1, 0.38], 0);
        for (let i = 1; i < n + 2; i++) cols.set([1, 1, 1, 0.03], i * 4);
        geo.setAttribute('color', new THREE.BufferAttribute(cols, 4));
        const idx = [];
        for (let i = 1; i <= n; i++) idx.push(0, i, i + 1);
        geo.setIndex(idx);
        const cone = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffe066, vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false }));
        cone.frustumCulled = false;
        cone.renderOrder = 2;
        const edgeGeo = new THREE.BufferGeometry();
        edgeGeo.setAttribute('position', geo.attributes.position);
        const edge = new THREE.LineLoop(edgeGeo, new THREE.LineBasicMaterial({ color: 0xffd000, transparent: true, opacity: 0.5 }));
        edge.frustumCulled = false;
        edge.renderOrder = 3;
        this.scene.add(cone, edge);
        npc.cone = cone;
        npc.edge = edge;
        npc.rays = n;
        // 「！」「？」
        const mark = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.markTex['!'], depthWrite: false, transparent: true }));
        mark.visible = false;
        mark.renderOrder = 12;
        this.scene.add(mark);
        npc.mark = { sprite: mark, t: 0, ch: '' };
      }
      this.npcs.push(npc);
    }
    // ゴールに立つ上司／母
    if (this.goal && this.stage.id !== 's4') {
      const who = this.stage.goalCheck.who;
      const boss = this.makePerson({
        body: who === '母' ? 0x8e44ad : 0x1c2833, legs: 0x1c2833, hair: who === '母' ? 0x4a3020 : 0x777777, skirt: who === '母', longHair: who === '母',
        extra: (g, mat, rig) => {
          const gl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, 0.04), mat(0x111111, 0.3));
          gl.position.set(0, 0.2, 0.17);
          rig.head.add(gl);
          rig.armsCrossed = true;
        },
      });
      const [fx, fy] = this.facingOf(this.goal.x, this.goal.y);
      boss.position.set(this.tc(this.goal.x) - fy * 0.7 + fx * 0.2, WALK_Y, this.tc(this.goal.y) + fx * 0.7 + fy * 0.2);
      boss.rotation.y = Math.atan2(fx, fy);
      this.scene.add(boss);
      this.boss = boss;
    } else this.boss = null;
  }

  buildAura() {
    const geo = new THREE.PlaneGeometry(2, 2);
    geo.rotateX(-Math.PI / 2);
    this.auraMesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: this.auraTex, transparent: true, depthWrite: false, opacity: 0.9, fog: false }));
    this.auraMesh.renderOrder = 1;
    this.auraRing = new THREE.Mesh(geo.clone(), new THREE.MeshBasicMaterial({ map: this.auraRingTex, transparent: true, depthWrite: false, opacity: 0.9, fog: false }));
    this.auraRing.renderOrder = 1;
    this.scene.add(this.auraMesh, this.auraRing);
  }

  buildRain() {
    const n = 2600;
    const pos = new Float32Array(n * 6);
    this.rainSpeed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (Math.random() - 0.5) * 50, y = Math.random() * 20, z = (Math.random() - 0.5) * 50;
      pos.set([x, y, z, x + 0.08, y + 0.7, z], i * 6);
      this.rainSpeed[i] = 18 + Math.random() * 8;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.rain = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xc8d4e0, transparent: true, opacity: 0.35 }));
    this.rain.frustumCulled = false;
    this.scene.add(this.rain);
  }

  buildGhost(ghost) {
    // VR訓練風のホログラム
    const mesh = this.makePerson({});
    const holo = new THREE.MeshBasicMaterial({ color: 0x5fd8ff, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending });
    const wire = new THREE.MeshBasicMaterial({ color: 0x9feaff, wireframe: true, transparent: true, opacity: 0.25, depthWrite: false });
    const extra = [];
    mesh.traverse(o => {
      if (o.isMesh) {
        o.material = holo;
        o.castShadow = false;
        const w = new THREE.Mesh(o.geometry, wire);
        extra.push([o, w]);
      }
    });
    extra.forEach(([o, w]) => o.add(w));
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

  // カメラ用：そのマスの障害物の高さ
  heightAt(tx, ty) {
    const h = this.hmap.get(`${tx},${ty}`);
    if (h !== undefined) return h;
    const c = this.tile(tx, ty);
    if (c === 'T') return this.theme === 'station' ? this.look.ceiling : this.theme === 'garden' ? 2.0 : 3.6;
    if (tx < 0 || ty < 0 || tx >= this.W || ty >= this.H) return this.look.filler ? 0 : 99;
    return 0;
  }
  heightAtXZ(x, z) {
    const tx = this.w2t(x), ty = this.w2t(z);
    const st = this.storeTiles && this.storeTiles.get(`${tx},${ty}`);
    if (st) return (x - this.tc(tx)) * st[0] + (z - this.tc(ty)) * st[1] < -T * 0.12 ? st[2] : 0;
    return this.heightAt(tx, ty);
  }
  blockedAt(x, y, z, pad = 0.22) {
    for (const [ox, oz] of [[-pad, -pad], [pad, -pad], [-pad, pad], [pad, pad]]) {
      if (this.heightAtXZ(x + ox, z + oz) > y - pad) return true;
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

  // その場所の見通し：前方の開け具合＋背後のカメラの余裕。いちばん良い向きも返す
  viewScore(x, z) {
    const ray = (yaw, y, dy, max) => {
      const dx = Math.sin(yaw), dz = Math.cos(yaw);
      for (let d = 0.3; d <= max; d += 0.2) if (this.blockedAt(x + dx * d, y + dy * d, z + dz * d, 0.2)) return d;
      return max;
    };
    let best = -1, bestF = 0;
    for (let i = 0; i < 16; i++) {
      const f = (i / 16) * Math.PI * 2;
      const score = Math.min(ray(f, 1.6, 0, 12), 10) + Math.min(ray(f + Math.PI, 1.8, Math.sin(0.3), 5.6), 4.5) * 1.5;
      if (score > best) { best = score; bestF = f; }
    }
    return [best, bestF];
  }

  // ------------------------------------------------------------------ camera input
  lookBy(dx, dy) {
    const cs = this.camState;
    cs.yaw -= dx * 0.0032;
    cs.pitch = clamp(cs.pitch + dy * 0.0026, -0.25, 1.15);
  }
  turnCamera(v) { this.camState.yaw -= v; }

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

  toggleCrouch() {
    const p = this.player;
    if (this.over || this.cleared) return;
    p.crouch = !p.crouch;
    this.audio.rustle();
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
    this.time += dt;
    if (this.over || this.cleared) { this.endT += dt; this.updateVisuals(dt); return; }
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
    const drain = (100 / 105) * (p.curse > 0 ? 2 : 1) * (p.running ? 1.5 : 1) * this.stats.drain;
    p.curse = Math.max(0, p.curse - dt);
    if (!p.smoking) p.nic = Math.max(0, p.nic - drain * dt);
    if (p.nic <= 0) {
      p.mental -= 1.4 * dt;
      p.lastCause = 'ニコチン切れのイライラ';
    }
    p.streetConfirm = Math.max(0, p.streetConfirm - dt);
    p.contactCd = Math.max(0, p.contactCd - dt);

    // 匂いの減衰（雨だと早く消える）
    const tau = (this.theme === 'rain' ? 30 : 40) / this.stats.fade;
    p.aura = BASE_AURA + (p.aura - BASE_AURA) * Math.exp(-dt / tau);

    // カメラの左右回転（キーボード）
    if (input.turn) this.turnCamera(input.turn * dt * 2.4);

    // 喫煙中
    if (p.smoking) { this.updateSmoking(dt); p.moving = false; }
    else this.movePlayer(dt, input);

    const ptx = this.w2t(p.pos.x), pty = this.w2t(p.pos.z);
    const here = this.places.find(pl => pl.x === ptx && pl.y === pty);
    p.inLegal = !!(here && ['S', 'H', 'K'].includes(here.type) && !here.closed);
    p.indoor = !!(here && ['H', 'K', 'C'].includes(here.type));

    this.updateReveals();
    this.updateNpcs(dt);
    this.checkGoal(ptx, pty);

    // 警戒フェーズ（演出）
    const wasAlert = this.alertT > 0;
    this.alertT = Math.max(0, this.alertT - dt);
    if (wasAlert && this.alertT <= 0) this.cautionT = Math.max(this.cautionT, 6);
    this.cautionT = Math.max(0, this.cautionT - dt);
    this.phase = this.alertT > 0 ? 'alert' : this.cautionT > 0 ? 'caution' : 'normal';

    // 時間切れ・メンタル
    if (!this.over && this.gameMin() >= st.minutes) this.fail(TIMEOUT_TEXT[st.id], 'time');
    if (!this.over && p.mental <= 0) this.fail(p.lastCause || '心が折れた', 'mental');

    // ゴースト用の記録
    this.recordT += dt;
    if (this.recordT >= 0.1) {
      this.recordT = 0;
      this.record.push([+p.pos.x.toFixed(2), +p.pos.z.toFixed(2), +p.facing.toFixed(2)]);
    }

    this.audio.tension = clamp(Math.max(1 - p.nic / 40, 1 - p.mental / 50, this.phase === 'alert' ? 0.85 : 0, 0), 0, 1);
    this.updateVisuals(dt);
    this.ui.hud(this);
  }

  movePlayer(dt, input) {
    const p = this.player;
    const yaw = this.camState.yaw;
    const ix = input.x, iy = input.y;
    // カメラの向きを基準に動く
    let mx = ix * Math.cos(yaw) + iy * Math.sin(yaw);
    let mz = -ix * Math.sin(yaw) + iy * Math.cos(yaw);
    const len = Math.hypot(mx, mz);
    p.running = input.run && len > 0.1;
    if (p.running && p.crouch) p.crouch = false;
    p.moving = len > 0.1;
    if (len > 0.1) {
      mx /= Math.max(1, len); mz /= Math.max(1, len);
      if (p.nic <= 0) {
        // 手ブレ：入力方向がぶれる
        const j = Math.sin(this.elapsed * 7.3) * 0.5 + (Math.random() - 0.5) * 0.4;
        const c = Math.cos(j), s = Math.sin(j);
        [mx, mz] = [mx * c - mz * s, mx * s + mz * c];
      }
      const speed = 4.4 * this.stats.speed * (p.running ? 1.45 : 1) * (p.crouch ? 0.5 : 1) * (p.nic <= 0 ? 0.55 : 1);
      const nx = p.pos.x + mx * speed * dt;
      if (!this.collide(nx, p.pos.z)) p.pos.x = nx;
      const nz = p.pos.z + mz * speed * dt;
      if (!this.collide(p.pos.x, nz)) p.pos.z = nz;
      const target = Math.atan2(mx, mz);
      p.facing += angDiff(target, p.facing) * Math.min(1, dt * 12);
      p.walk += dt * speed * (p.crouch ? 3.4 : 2.0);
    }
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
      for (let i = 0; i < 14; i++) this.spawnPuff(0xe6e0ee, 1);
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
    this.ui.radarDirty = true;
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

  showMark(n, ch, dur) {
    if (!n.mark) return;
    const mk = n.mark;
    if (mk.ch === '!' && mk.t > 0 && ch === '?') return;
    mk.ch = ch;
    mk.t = dur;
    mk.dur = dur;
    mk.sprite.material.map = this.markTex[ch];
    mk.sprite.visible = true;
  }

  updateNpcs(dt) {
    const p = this.player;
    const sm = this.smellCenter();
    const rainMul = this.theme === 'rain' ? 0.75 : 1;
    const crouchMul = p.crouch ? CROUCH_SIGHT : 1;
    for (const n of this.npcs) {
      const cfg = n.cfg;
      n.cd = Math.max(0, n.cd - dt);
      n.bubbleCd = Math.max(0, n.bubbleCd - dt);
      if (cfg.friendly) {
        n.mesh.position.set(n.pos.x, this.groundY(n.pos.x, n.pos.z), n.pos.z);
        n.mesh.rotation.y = n.facing;
        this.animatePerson(n.mesh, 0, { dt, t: this.time, smoke: true });
        continue;
      }

      const toP = new THREE.Vector3(p.pos.x - n.pos.x, 0, p.pos.z - n.pos.z);
      const dist = toP.length();
      const range = cfg.range * T * rainMul * crouchMul;
      const half = (cfg.fov * Math.PI) / 360;
      const ang = Math.atan2(toP.x, toP.z);
      const sees = !p.indoor && dist < range && Math.abs(angDiff(ang, n.facing)) < half && this.los(n.pos.x, n.pos.z, p.pos.x, p.pos.z);
      const sd = Math.hypot(n.pos.x - sm.x, n.pos.z - sm.z);
      const inSmell = !p.indoor && (sd < sm.r * cfg.smellMul && this.los(n.pos.x, n.pos.z, sm.x, sm.z) || dist < 1.4 && p.aura > BASE_AURA + 0.2);

      // 路上喫煙を目撃
      if (p.smoking && !p.smoking.legal && p.smoking.wait <= 0 && sees) {
        if (n.type === 'guide') { this.showMark(n, '!', 3); this.audio.exclaim(); this.fail('路上喫煙で指導', 'guide', n); return; }
        if (n.cd <= 0) this.tsk(n, 1.6, 'えっ、ここで吸う？');
      }

      let moving = true;
      if (inSmell) {
        const before = n.sus;
        n.sus = Math.min(1.4, n.sus + dt * cfg.sens * (0.8 + (p.aura - BASE_AURA) * 0.12));
        if (n.sus > 0.25) {
          if (before <= 0.25) this.showMark(n, '?', 1.2);
          this.cautionT = Math.max(this.cautionT, 3);
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
        this.alertT = Math.max(this.alertT, 2.5);
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
          n.running = true;
          if (dist < 1.1 && p.contactCd <= 0) { p.contactCd = 2.5; this.tsk(n, 1, 'くっさ！！'); }
          moving = false;
        }
      } else n.running = false;

      n.moving = n.state === 'chase';
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
            n.walk += dt * cfg.speed * 2.2;
            n.moving = true;
          }
        }
      }
      // 怪しいと思ったら頭だけこちらを向く
      const wantHead = n.sus > 0.25 ? clamp(angDiff(ang, n.facing), -1.1, 1.1) : 0;
      n.headYaw += (wantHead - n.headYaw) * Math.min(1, dt * 6);
      n.mesh.position.set(n.pos.x, this.groundY(n.pos.x, n.pos.z), n.pos.z);
      n.mesh.rotation.y = n.facing;
      this.animatePerson(n.mesh, n.walk, { dt, t: this.time + n.walk * 0.1, moving: n.moving, run: n.running, head: n.headYaw });
      this.updateCone(n, range, half);
    }
  }

  tsk(n, mul = 1, line) {
    const p = this.player;
    const cfg = n.cfg;
    n.cd = 3.5;
    n.sus = 0.3;
    n.bubbleCd = 2;
    p.mental -= cfg.dmg * mul * this.stats.dmg;
    p.tsk += 1;
    p.lastCause = cfg.cause;
    this.ui.bubble(n.mesh, line || cfg.lines[Math.floor(Math.random() * cfg.lines.length)], 'tsk', 1.4);
    this.ui.flash();
    this.showMark(n, '!', 1.6);
    this.audio.exclaim();
    this.audio.tsk();
    this.alertT = Math.max(this.alertT, 8);
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
    this.endT = 0;
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
    this.endT = 0;
    this.shake = 0.6;
    this.alertT = 0;
    this.audio.fail();
    if (npc) this.ui.bubble(npc.mesh, `ちょっと${(this.character || CHARACTERS[0]).call}！`, 'tsk', 3);
    this.ui.onFail({ cause, kind, tsk: this.player.tsk, clock: this.clock(), stage: this.stage });
  }

  // ------------------------------------------------------------------ visuals
  animatePerson(mesh, walk, o = {}) {
    const u = mesh.userData;
    const dt = o.dt ?? 0.016;
    u.amt += ((o.moving ? 1 : 0) - u.amt) * Math.min(1, dt * 10);
    u.crouch += ((o.crouch ? 1 : 0) - u.crouch) * Math.min(1, dt * 9);
    const a = u.amt, cr = u.crouch, run = o.run ? 1 : 0;
    const s = Math.sin(walk), c = Math.cos(walk);
    const swing = (0.55 + run * 0.3) * a * (1 - cr * 0.4);
    const kneeAmp = (0.95 + run * 0.5) * a * (1 - cr * 0.3);
    u.legL.thigh.rotation.x = -s * swing - cr * 1.15;
    u.legR.thigh.rotation.x = s * swing - cr * 1.15;
    u.legL.knee.rotation.x = Math.max(0, c) * kneeAmp + cr * 1.9 + 0.04;
    u.legR.knee.rotation.x = Math.max(0, -c) * kneeAmp + cr * 1.9 + 0.04;
    u.hips.position.y = 0.98 - cr * 0.38 + Math.abs(c) * (0.03 + run * 0.04) * a;
    const breathe = Math.sin((o.t ?? 0) * 2.1) * 0.015 * (1 - a);
    u.spine.rotation.x = cr * 0.5 + run * 0.22 * a + 0.04 * a + breathe;
    u.spine.rotation.y = s * 0.08 * a;
    u.head.rotation.x = -cr * 0.35 - run * 0.15 * a;
    u.head.rotation.y = o.head ?? 0;
    const armSwing = swing * 0.9;
    u.armL.sh.rotation.set(s * armSwing - cr * 0.45, 0, -0.07);
    u.armR.sh.rotation.set(-s * armSwing - cr * 0.45, 0, 0.07);
    const elb = -0.22 - run * 1.1 * a - cr * 0.6 - a * 0.12;
    u.armL.el.rotation.x = elb;
    u.armR.el.rotation.x = elb;
    if (u.bag) { u.armL.sh.rotation.x *= 0.3; u.armL.el.rotation.x = -0.05; }
    if (o.smoke || u.smoker) {
      // 口元に手をあてる
      u.armR.sh.rotation.set(-1.25, 0, 0.45);
      u.armR.el.rotation.x = -1.9;
    }
    if (u.holdSign) { u.armR.sh.rotation.set(-0.35, 0, 0.12); u.armR.el.rotation.x = -1.2; }
    if (u.armsCrossed) {
      u.armL.sh.rotation.set(-0.5, 0, 0.3); u.armL.el.rotation.x = -1.9;
      u.armR.sh.rotation.set(-0.5, 0, -0.3); u.armR.el.rotation.x = -1.9;
    }
    if (u.tail) u.tail.rotation.x = 0.25 + Math.sin(walk * 2) * 0.12 * a + run * 0.35 * a + cr * 0.3;
    if (u.kid) this.animatePerson(u.kid, walk * 1.4, { ...o, head: 0 });
  }

  updateCone(n, range, half) {
    const pos = n.cone.geometry.attributes.position;
    const y = 0.14;
    pos.setXYZ(0, n.pos.x, y, n.pos.z);
    for (let i = 0; i <= n.rays; i++) {
      const a = n.facing - half + (i / n.rays) * half * 2;
      const dx = Math.sin(a), dz = Math.cos(a);
      let d = 0.4;
      while (d < range) {
        const x = n.pos.x + dx * d, z = n.pos.z + dz * d;
        if (this.sightBlock(this.w2t(x), this.w2t(z))) break;
        d += 0.3;
      }
      pos.setXYZ(i + 1, n.pos.x + dx * d, y, n.pos.z + dz * d);
    }
    pos.needsUpdate = true;
    n.cone.geometry.computeBoundingSphere();
    const s = clamp(n.sus, 0, 1);
    const c = n.cone.material.color;
    if (n.cd > 2.5 || n.state === 'chase') c.setRGB(1, 0.12, 0.08);
    else c.setRGB(1, 0.86 - s * 0.66, 0.18 - s * 0.1);
    n.edge.material.color.copy(c);
    n.cone.material.opacity = 0.6 + s * 0.4;
    n.edge.material.opacity = 0.22 + s * 0.4;
  }

  spawnPuff(color, size) {
    const p = this.player;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.puffTex, color, transparent: true, depthWrite: false, opacity: 0.8 }));
    const hy = p.gy + 1.8 - p.mesh.userData.crouch * 0.5;
    s.position.set(p.pos.x + Math.sin(p.facing) * 0.3 + (Math.random() - 0.5) * 0.3, hy + Math.random() * 0.2, p.pos.z + Math.cos(p.facing) * 0.3 + (Math.random() - 0.5) * 0.3);
    const sc = 0.35 + Math.random() * 0.4 * size;
    s.scale.set(sc, sc, 1);
    s.material.rotation = Math.random() * Math.PI * 2;
    s.userData = { life: 1.8 + Math.random(), age: 0, vx: (Math.random() - 0.5) * 0.5, vz: (Math.random() - 0.5) * 0.5, grow: 1 + size, spin: (Math.random() - 0.5) * 0.8 };
    this.scene.add(s);
    this.puffs.push(s);
  }

  updateVisuals(dt) {
    const p = this.player;
    // プレイヤー
    const gyT = this.groundY(p.pos.x, p.pos.z);
    p.gy += (gyT - p.gy) * Math.min(1, dt * 14);
    p.mesh.position.set(p.pos.x, p.gy, p.pos.z);
    p.mesh.rotation.y = p.facing;
    const smoking = !!(p.smoking && p.smoking.wait <= 0 && p.smoking.warm <= 0);
    this.animatePerson(p.mesh, p.walk, { dt, t: this.time, moving: p.moving && !this.over && !this.cleared, run: p.running, crouch: p.crouch, smoke: !!p.smoking });
    const rig = p.mesh.userData;
    rig.cig.visible = smoking || !!(p.smoking && p.smoking.mode === 'heat');
    rig.cig.material.color.setHex(p.smoking && p.smoking.mode === 'heat' ? 0x6a6a70 : 0xffffff);
    rig.ember.visible = smoking && p.smoking.mode === 'cig';
    if (rig.ember.visible) rig.ember.material.emissiveIntensity = 4 + Math.sin(this.time * 9) * 2;
    if (p.smoking && p.smoking.error > 0) p.mesh.position.x += Math.sin(this.time * 60) * 0.05;

    // 匂いオーラと煙
    const sm = this.smellCenter();
    const res = this.residual();
    this.auraMesh.position.set(sm.x, 0.13, sm.z);
    this.auraMesh.scale.set(sm.r, 1, sm.r);
    const showAura = this.titleMode ? 0 : 1;
    this.auraMesh.material.opacity = (0.12 + res * 0.7) * showAura;
    this.auraRing.position.set(sm.x, 0.135, sm.z);
    this.auraRing.scale.set(sm.r, 1, sm.r);
    this.auraRing.material.opacity = (0.22 + res * 0.65 + Math.sin(this.time * 3) * 0.06) * showAura;
    if (!this.over && Math.random() < dt * res * 10) this.spawnPuff(0xcfc0e6, res);
    for (let i = this.puffs.length - 1; i >= 0; i--) {
      const s = this.puffs[i];
      const u = s.userData;
      u.age += dt;
      s.position.x += (u.vx + this.wind.x * 1.6) * dt;
      s.position.z += (u.vz + this.wind.z * 1.6) * dt;
      s.position.y += 0.55 * dt;
      s.material.rotation += u.spin * dt;
      s.scale.multiplyScalar(1 + u.grow * dt * 0.7);
      s.material.opacity = 0.7 * (1 - u.age / u.life);
      if (u.age >= u.life) { this.scene.remove(s); s.material.dispose(); this.puffs.splice(i, 1); }
    }

    // 目的地マーカー（近いと薄く）
    for (const mk of this.markers) {
      mk.bob += dt * 2;
      mk.sprite.position.y = 3.6 + Math.sin(mk.bob) * 0.15;
      const d = Math.hypot(mk.x - p.pos.x, mk.z - p.pos.z);
      mk.sprite.material.opacity = this.titleMode ? 0 : clamp((d - 3) / 6, 0.12, 0.9);
    }

    // 「！」「？」
    if (this.npcs) for (const n of this.npcs) {
      if (!n.mark || !n.mark.sprite.visible) continue;
      const mk = n.mark;
      mk.t -= dt;
      if (mk.t <= 0) { mk.sprite.visible = false; mk.ch = ''; continue; }
      const age = mk.dur - mk.t;
      const pop = age < 0.12 ? 0.4 + (age / 0.12) * 0.9 : 1.3 - Math.min(0.3, (age - 0.12) * 2);
      const sz = (mk.ch === '!' ? 0.95 : 0.75) * pop;
      mk.sprite.scale.set(sz, sz, 1);
      mk.sprite.position.set(n.pos.x, n.mesh.position.y + 2.55 + Math.min(age, 0.15), n.pos.z);
      mk.sprite.material.opacity = Math.min(1, mk.t * 3);
    }

    // 雨（カメラのまわりに降らせる）
    if (this.rain) {
      const cx = this.camera.position.x, cz = this.camera.position.z;
      const pos = this.rain.geometry.attributes.position;
      for (let i = 0; i < this.rainSpeed.length; i++) {
        let y = pos.getY(i * 2) - this.rainSpeed[i] * dt;
        let x = pos.getX(i * 2), z = pos.getZ(i * 2);
        if (y < 0 || Math.abs(x - cx) > 26 || Math.abs(z - cz) > 26) { y = 14 + Math.random() * 8; x = cx + (Math.random() - 0.5) * 50; z = cz + (Math.random() - 0.5) * 50; }
        pos.setXYZ(i * 2, x, y, z);
        pos.setXYZ(i * 2 + 1, x + 0.08, y + 0.7, z);
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
      g.position.set(gx, this.groundY(gx, gz), gz);
      g.rotation.y = gf;
      const moved = prev.distanceTo(g.position);
      g.userData.wk = (g.userData.wk || 0) + moved * 2.0;
      this.animatePerson(g, g.userData.wk, { dt, moving: moved > 0.01 });
    }

    // 太陽の影はプレイヤー周辺だけ（くっきりさせる）
    this.sun.target.position.set(p.pos.x, 0, p.pos.z);
    this.sun.position.copy(this.sun.target.position).addScaledVector(this.sunDir, 80);

    this.updateCamera(dt);
    this.updatePostFx(dt);
  }

  updateCamera(dt) {
    const p = this.player;
    if (this.hemi) { this.hemi.intensity = this.look.hemi[2]; this.scene.environmentIntensity = this.look.env; }
    const cs = this.camState;
    const cam = this.camera;
    const ending = this.over || this.cleared;
    if (ending) cs.yaw += dt * 0.22;
    const crouch = p.mesh.userData.crouch;
    let dist = cs.dist * (p.smoking ? 0.7 : 1) * (ending ? 0.85 : 1) * (1 - crouch * 0.12);
    const pitch = ending ? 0.22 : cs.pitch;
    const yaw = cs.yaw;
    const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    const base = new THREE.Vector3(p.pos.x, p.gy + 1.72 - crouch * 0.55, p.pos.z);
    // 肩越しのオフセット（壁にめり込まない範囲で）
    let sh = ending ? 0 : 0.55;
    for (let s = 0.1; s <= sh; s += 0.05) {
      if (this.blockedAt(base.x + right.x * s, base.y, base.z + right.z * s, 0.12)) { sh = Math.max(0, s - 0.2); break; }
    }
    const pivot = base.clone().addScaledVector(right, sh);
    const free = pt => {
      const cp = Math.cos(pt), sp = Math.sin(pt);
      for (let d = 0.3; d <= dist; d += 0.1) {
        if (this.blockedAt(pivot.x + Math.sin(yaw) * cp * d, pivot.y + sp * d, pivot.z + Math.cos(yaw) * cp * d, 0.2)) return Math.max(0.5, d - 0.3);
      }
      return dist;
    };
    // 背後が狭いときはカメラを持ち上げて見下ろす
    let want = pitch, hit = free(pitch);
    if (hit < 2.6 && !this.look.ceiling) {
      for (let pt = pitch + 0.15; pt <= 1.52; pt += 0.15) {
        const h = free(pt);
        if (h > hit + 0.3) { hit = h; want = pt; }
        if (h >= 3.2) break;
      }
    }
    cs.autoPitch = cs.autoPitch ?? pitch;
    cs.autoPitch += (want - cs.autoPitch) * Math.min(1, dt * 5);
    const ep = Math.max(pitch, cs.autoPitch);
    const dir = new THREE.Vector3(Math.sin(yaw) * Math.cos(ep), Math.sin(ep), Math.cos(yaw) * Math.cos(ep));
    hit = Math.min(hit, free(ep));
    cs.cur = hit < cs.cur ? cs.cur + (hit - cs.cur) * Math.min(1, dt * 25) : cs.cur + (hit - cs.cur) * Math.min(1, dt * 3);
    const cp = pivot.clone().addScaledVector(dir, cs.cur);
    if (this.look.ceiling) cp.y = Math.min(cp.y, this.look.ceiling - 0.4);
    cp.y = Math.max(cp.y, p.gy + 0.35);
    cam.position.copy(cp);
    this.shake = Math.max(0, this.shake - dt);
    const nicShake = p.nic <= 0 && !ending ? 0.05 : 0;
    const sk = this.shake * 0.35 + nicShake;
    if (sk > 0) cam.position.add(new THREE.Vector3((Math.random() - 0.5) * sk, (Math.random() - 0.5) * sk, (Math.random() - 0.5) * sk));
    cam.lookAt(pivot.x, pivot.y - 0.05, pivot.z);
    const wantFov = this.baseFov + (p.running ? 7 : 0) - (p.smoking ? 6 : 0);
    if (Math.abs(cam.fov - wantFov) > 0.05) {
      cam.fov += (wantFov - cam.fov) * Math.min(1, dt * 4);
      cam.updateProjectionMatrix();
    }
    this.sky.position.copy(cam.position);
    // カメラが人の体に入りこんだら、その人は隠す
    if (this.npcs) for (const n of this.npcs) n.mesh.visible = Math.hypot(n.pos.x - cp.x, n.pos.z - cp.z) > 0.75;
    if (this.boss) this.boss.visible = Math.hypot(this.boss.position.x - cp.x, this.boss.position.z - cp.z) > 0.75;
    for (const f of this.fadeProps) f.obj.visible = Math.hypot(f.x - cp.x, f.z - cp.z) > f.r;

    // カメラが近すぎるときは主人公を半透明に
    const op = clamp((cs.cur - 0.7) / 0.9, 0.2, 1);
    if (Math.abs(op - (p.opacity ?? 1)) > 0.01) {
      p.opacity = op;
      for (const m of p.mesh.userData.mats) { m.transparent = op < 1; m.opacity = op; m.depthWrite = op >= 1; }
    }
  }

  // タイトル画面：開けた交差点に主人公を立たせ、まわりをゆっくり回る
  setupTitle() {
    let best = null, bestD = -1;
    for (let y = 0; y < this.H; y++) for (let x = 0; x < this.W; x++) {
      if (!this.walkable(this.tile(x, y))) continue;
      let d = 0;
      while (d < 6 && [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dy]) => this.walkable(this.tile(x + dx * (d + 1), y + dy * (d + 1))))) d++;
      if (d > bestD) { bestD = d; best = [x, y]; }
    }
    if (!best) return;
    const p = this.player;
    p.pos.set(this.tc(best[0]) + 1, 0, this.tc(best[1]) + 1);
    p.facing = 0.6;
    this.titleMode = true;
    this.charaYaw = undefined;
  }

  titleCam(t) {
    const p = this.player;
    const cs = this.camState;
    const keep = [cs.yaw, cs.pitch, cs.dist];
    cs.yaw = p.facing + 0.9 + Math.sin(t * 0.1) * 0.8;
    cs.pitch = 0.1 + Math.sin(t * 0.07) * 0.05;
    cs.dist = 4.6;
    this.updateCamera(0.016);
    [cs.yaw, cs.pitch, cs.dist] = keep;
  }

  // キャラクター選択：カメラは開けた方向に固定し、キャラをターンテーブルのように回す
  charaCam(t) {
    const p = this.player;
    if (this.charaYaw === undefined) {
      let best = 0, bestD = -1;
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        let d = 0.4;
        while (d < 6 && !this.blockedAt(p.pos.x + Math.sin(a) * d, 1.5, p.pos.z + Math.cos(a) * d, 0.35)) d += 0.2;
        if (d > bestD) { bestD = d; best = a; }
      }
      this.charaYaw = best;
    }
    const yaw = this.charaYaw;
    p.facing = yaw + Math.sin(t * 0.6) * 0.75;
    const cam = this.camera;
    const d = 3.3, h = p.gy + 1.15;
    const side = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)).multiplyScalar(0.55);
    cam.position.set(p.pos.x + Math.sin(yaw) * d - side.x, h + 0.3, p.pos.z + Math.cos(yaw) * d - side.z);
    cam.lookAt(p.pos.x - side.x, h, p.pos.z - side.z);
    this.sky.position.copy(cam.position);
    // 選択画面は少し明るく（ライトを増やすとシェーダーが重くなるので、環境光を上げる）
    this.hemi.intensity = this.look.hemi[2] * 2.6;
    this.scene.environmentIntensity = this.look.env * 2.2;
    if (p.opacity !== 1) { p.opacity = 1; for (const m of p.mesh.userData.mats) { m.transparent = false; m.opacity = 1; m.depthWrite = true; } }
    p.mesh.visible = true;
  }

  updatePostFx(dt) {
    const p = this.player;
    const fx = this.post.fx;
    const playing = !this.over && !this.cleared && this.elapsed > 0;
    const alert = playing && this.phase === 'alert' ? 0.28 + Math.sin(this.time * 6) * 0.1 : 0;
    const caution = playing && this.phase === 'caution' ? 0.14 : 0;
    fx.alert += (alert - fx.alert) * Math.min(1, dt * 6);
    fx.caution += (caution - fx.caution) * Math.min(1, dt * 4);
    fx.wobble += ((playing && p.nic <= 0 ? 1 : 0) - fx.wobble) * Math.min(1, dt * 2);
    fx.aberr = this.shake * 0.08 + fx.wobble * 0.02;
    fx.vigExtra = playing && p.mental < 30 ? 0.25 : 0;
    fx.fade = this.over ? Math.max(0.55, 1 - this.endT * 0.3) : 1;
  }

  render() {
    this.post.render(this.scene, this.camera, this.time);
  }
}
