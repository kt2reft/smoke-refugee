import * as THREE from 'three';

// すべての画像はCanvasで生成する（素材ファイルなし）
const FONT = '"Noto Sans JP","Hiragino Kaku Gothic ProN","Yu Gothic","Meiryo",sans-serif';
const MONO = '"Share Tech Mono","Consolas",monospace';

function mk(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}
function toTex(c, { repeat = false, srgb = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  return t;
}
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
function speckle(g, w, h, n, r, alpha, light = false) {
  for (let i = 0; i < n; i++) {
    const v = light ? 255 : 0;
    g.fillStyle = `rgba(${v},${v},${v},${Math.random() * alpha})`;
    g.fillRect(Math.random() * w, Math.random() * h, r * Math.random() + 0.6, r * Math.random() + 0.6);
  }
}

// ---------------------------------------------------------------- markers / signs

// 丸いバッジ型のマーカー（地図アイコン）
export function badgeTexture(text, bg, fg = '#fff') {
  const [c, g] = mk(128, 128);
  g.fillStyle = 'rgba(0,0,0,0.45)';
  g.beginPath(); g.arc(64, 68, 54, 0, Math.PI * 2); g.fill();
  g.fillStyle = bg;
  g.beginPath(); g.arc(64, 62, 50, 0, Math.PI * 2); g.fill();
  g.lineWidth = 5; g.strokeStyle = 'rgba(255,255,255,0.9)';
  g.stroke();
  g.lineWidth = 2; g.strokeStyle = 'rgba(255,255,255,0.45)';
  g.beginPath(); g.arc(64, 62, 58, 0, Math.PI * 2); g.stroke();
  g.fillStyle = fg;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const size = text.length > 2 ? 32 : text.length > 1 ? 42 : 58;
  g.font = `900 ${size}px ${FONT}`;
  g.fillText(text, 64, 64);
  return toTex(c);
}

// 看板（横長テキスト）
export function signTexture(text, bg, fg = '#fff', w = 256, h = 96) {
  const [c, g] = mk(w, h);
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, 'rgba(255,255,255,0.18)');
  gr.addColorStop(1, 'rgba(0,0,0,0.25)');
  g.fillStyle = gr;
  g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(255,255,255,0.8)';
  g.lineWidth = 6;
  g.strokeRect(3, 3, w - 6, h - 6);
  g.fillStyle = fg;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  let size = 52;
  g.font = `900 ${size}px ${FONT}`;
  while (g.measureText(text).width > w - 24 && size > 16) {
    size -= 2;
    g.font = `900 ${size}px ${FONT}`;
  }
  g.fillText(text, w / 2, h / 2 + 2);
  return toTex(c);
}

// 発見マーク「！」「？」
export function alertMarkTexture(ch) {
  const [c, g] = mk(128, 128);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `900 112px ${FONT}`;
  g.lineJoin = 'round';
  g.lineWidth = 14; g.strokeStyle = '#120a08';
  g.strokeText(ch, 64, 70);
  g.lineWidth = 6; g.strokeStyle = '#fff';
  g.strokeText(ch, 64, 70);
  g.fillStyle = ch === '!' ? '#ff2a1a' : '#ffd23a';
  g.fillText(ch, 64, 70);
  return toTex(c);
}

// 匂いオーラ用の放射グラデーション
export function radialTexture(inner, outer) {
  const [c, g] = mk(256, 256);
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, inner);
  gr.addColorStop(0.7, outer);
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 256, 256);
  return toTex(c);
}

// 匂いの輪（縁が濃いリング）
export function ringTexture(color) {
  const [c, g] = mk(256, 256);
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, 'rgba(0,0,0,0)');
  gr.addColorStop(0.55, color.replace('A', '0.10'));
  gr.addColorStop(0.86, color.replace('A', '0.35'));
  gr.addColorStop(0.93, color.replace('A', '0.9'));
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 256, 256);
  return toTex(c);
}

// 煙の粒
export function puffTexture() {
  const [c, g] = mk(64, 64);
  for (let i = 0; i < 5; i++) {
    const x = 22 + Math.random() * 20, y = 22 + Math.random() * 20, r = 14 + Math.random() * 14;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(235,232,245,0.45)');
    gr.addColorStop(1, 'rgba(200,195,215,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
  }
  return toTex(c);
}

// 地面の光だまり（街灯の下）
export function glowTexture(rgb = '255,210,150') {
  const [c, g] = mk(128, 128);
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, `rgba(${rgb},0.55)`);
  gr.addColorStop(0.5, `rgba(${rgb},0.18)`);
  gr.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  return toTex(c);
}

// ---------------------------------------------------------------- buildings

// 外壁アトラス：4スパン × 4フロア。1スパン=2m幅、1フロア=2.4m
// 返り値 { map, emi }。インスタンスごとにUVをずらして単調さを消す
export function facadeAtlas(kind, seed = 1) {
  const BW = 128, FH = 154, W = BW * 4, H = FH * 4;
  const [c, g] = mk(W, H);
  const [ce, ge] = mk(W, H);
  const r = rng(seed * 977 + kind.length * 31);
  ge.fillStyle = '#000'; ge.fillRect(0, 0, W, H);

  const base = { office: '#b8bdc2', apart: '#d6cebf', tile: '#8c6e5a', station: '#d9d6cf', venue: '#f2eee6', shutter: '#9aa1a8' }[kind] || '#bbb';
  g.fillStyle = base; g.fillRect(0, 0, W, H);
  speckle(g, W, H, 5000, 2, 0.08);
  speckle(g, W, H, 2500, 2, 0.06, true);

  if (kind === 'tile') {
    g.strokeStyle = 'rgba(40,25,15,0.25)'; g.lineWidth = 1;
    for (let y = 0; y < H; y += 9) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    for (let y = 0; y < H; y += 9) for (let x = (y / 9) % 2 ? 0 : 9; x < W; x += 18) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 9); g.stroke(); }
  }

  const glass = (x, y, w, h, lit) => {
    const gr = g.createLinearGradient(x, y, x + w, y + h);
    if (lit) { gr.addColorStop(0, '#d9c9a2'); gr.addColorStop(1, '#a89676'); }
    else { gr.addColorStop(0, '#2b3843'); gr.addColorStop(0.55, '#45576a'); gr.addColorStop(1, '#202a33'); }
    g.fillStyle = gr; g.fillRect(x, y, w, h);
    if (!lit) {
      g.fillStyle = 'rgba(210,225,235,0.16)';
      g.beginPath(); g.moveTo(x + w * 0.15, y + h); g.lineTo(x + w * 0.45, y); g.lineTo(x + w * 0.6, y); g.lineTo(x + w * 0.3, y + h); g.fill();
    } else {
      // 室内のブラインド・人影
      g.fillStyle = 'rgba(60,50,40,0.25)';
      for (let i = 0; i < h; i += 6) g.fillRect(x, y + i, w, 2);
      const ec = r() < 0.5 ? '255,226,170' : '215,240,255';
      ge.fillStyle = `rgba(${ec},${0.55 + r() * 0.4})`;
      ge.fillRect(x, y, w, h);
    }
  };

  for (let fy = 0; fy < 4; fy++) for (let bx = 0; bx < 4; bx++) {
    const x0 = bx * BW, y0 = fy * FH;
    const lit = r() < ({ office: 0.3, apart: 0.22, tile: 0.18 }[kind] ?? 0.1);
    if (kind === 'office') {
      g.fillStyle = 'rgba(70,78,86,0.55)'; g.fillRect(x0, y0 + FH - 30, BW, 30); // スパンドレル
      glass(x0 + 6, y0 + 10, BW - 12, FH - 46, lit);
      g.fillStyle = '#9aa3ab'; g.fillRect(x0 + BW / 2 - 2, y0 + 10, 4, FH - 46);
      g.fillStyle = '#d9dee2'; g.fillRect(x0, y0 + 6, BW, 4);
    } else if (kind === 'apart') {
      glass(x0 + 20, y0 + 22, BW - 40, 72, lit);
      g.strokeStyle = '#efeae0'; g.lineWidth = 5; g.strokeRect(x0 + 20, y0 + 22, BW - 40, 72);
      g.fillStyle = '#efeae0'; g.fillRect(x0 + BW / 2 - 2, y0 + 22, 4, 72);
      // ベランダの手すり
      g.fillStyle = 'rgba(70,66,60,0.85)'; g.fillRect(x0 + 4, y0 + 104, BW - 8, 6);
      g.fillStyle = 'rgba(90,86,80,0.7)';
      for (let i = x0 + 8; i < x0 + BW - 6; i += 7) g.fillRect(i, y0 + 110, 2, 34);
      g.fillStyle = 'rgba(60,56,50,0.5)'; g.fillRect(x0 + 4, y0 + 144, BW - 8, 4);
      if (r() < 0.5) { g.fillStyle = '#e8e6e0'; g.fillRect(x0 + BW - 34, y0 + 116, 24, 20); g.fillStyle = '#9b9890'; g.fillRect(x0 + BW - 30, y0 + 120, 16, 12); }
      if (r() < 0.35) { g.fillStyle = ['#c86f6f', '#6f8fc8', '#e8d58a', '#f2f2f2'][Math.floor(r() * 4)]; g.fillRect(x0 + 18 + r() * 40, y0 + 112, 22, 18); } // 洗濯物
    } else if (kind === 'tile') {
      glass(x0 + 16, y0 + 26, 36, 82, lit);
      glass(x0 + BW - 52, y0 + 26, 36, 82, r() < 0.2);
      g.fillStyle = 'rgba(230,225,215,0.8)';
      g.fillRect(x0 + 12, y0 + 108, 44, 6); g.fillRect(x0 + BW - 56, y0 + 108, 44, 6);
    } else if (kind === 'station') {
      // 駅の壁：白いタイル＋広告
      g.strokeStyle = 'rgba(80,80,80,0.18)'; g.lineWidth = 1;
      for (let y = y0; y < y0 + FH; y += 16) { g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + BW, y); g.stroke(); }
      for (let x = x0; x < x0 + BW; x += 16) { g.beginPath(); g.moveTo(x, y0); g.lineTo(x, y0 + FH); g.stroke(); }
      if (fy % 2 === 1 && r() < 0.6) {
        const hue = Math.floor(r() * 360);
        g.fillStyle = '#e8e8e8'; g.fillRect(x0 + 14, y0 + 20, BW - 28, FH - 50);
        g.fillStyle = `hsl(${hue},45%,45%)`; g.fillRect(x0 + 18, y0 + 24, BW - 36, FH - 58);
        g.fillStyle = 'rgba(255,255,255,0.75)'; g.fillRect(x0 + 26, y0 + FH - 64, BW - 52, 8);
        ge.fillStyle = 'rgba(255,255,255,0.35)'; ge.fillRect(x0 + 18, y0 + 24, BW - 36, FH - 58);
      }
      g.fillStyle = '#5d636a'; g.fillRect(x0, y0 + FH - 10, BW, 10);
    } else if (kind === 'venue') {
      glass(x0 + 26, y0 + 18, BW - 52, 100, lit);
      g.strokeStyle = '#fbf8f2'; g.lineWidth = 8; g.strokeRect(x0 + 26, y0 + 18, BW - 52, 100);
      g.beginPath(); g.arc(x0 + BW / 2, y0 + 22, (BW - 52) / 2, Math.PI, 0); g.stroke();
      g.fillStyle = 'rgba(180,170,150,0.4)'; g.fillRect(x0, y0 + FH - 8, BW, 8);
    }
    // 雨だれの汚れ
    const st = g.createLinearGradient(0, y0 + FH - 40, 0, y0 + FH);
    st.addColorStop(0, 'rgba(0,0,0,0)'); st.addColorStop(1, 'rgba(0,0,0,0.12)');
    g.fillStyle = st; g.fillRect(x0, y0 + FH - 40, BW, 40);
  }
  return { map: toTex(c, { repeat: true }), emi: toTex(ce, { repeat: true }) };
}

// 1階の店先アトラス（6種類を横に並べる）
const SHOP_WORDS = ['クリーニング', '不動産', '理容', '酒・たばこ', '薬局', '古書', 'お弁当', '靴修理', '定食', 'カラオケ', '整骨院', '質'];
export function shopAtlas(seed = 3) {
  const SW = 256, SH = 320, N = 8;
  const [c, g] = mk(SW * N, SH);
  const [ce, ge] = mk(SW * N, SH);
  ge.fillStyle = '#000'; ge.fillRect(0, 0, SW * N, SH);
  const r = rng(seed);
  for (let i = 0; i < N; i++) {
    const x0 = i * SW;
    const kind = i % 3;
    g.fillStyle = '#4a4d52'; g.fillRect(x0, 0, SW, SH);
    // 看板の帯
    const hue = Math.floor(r() * 360);
    g.fillStyle = `hsl(${hue},40%,${28 + r() * 18}%)`;
    g.fillRect(x0, 0, SW, 64);
    g.fillStyle = 'rgba(255,255,255,0.92)';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `900 34px ${FONT}`;
    const word = SHOP_WORDS[(i * 5 + seed) % SHOP_WORDS.length];
    g.fillText(word, x0 + SW / 2, 34);
    ge.fillStyle = `hsla(${hue},60%,60%,0.55)`; ge.fillRect(x0, 0, SW, 64);
    ge.fillStyle = 'rgba(255,255,255,0.85)'; ge.font = `900 34px ${FONT}`; ge.textAlign = 'center'; ge.textBaseline = 'middle'; ge.fillText(word, x0 + SW / 2, 34);
    g.fillStyle = '#2b2d30'; g.fillRect(x0, 64, SW, 8);
    if (kind === 0) {
      // シャッター
      g.fillStyle = '#9ea3a8'; g.fillRect(x0 + 8, 72, SW - 16, SH - 72);
      for (let y = 76; y < SH; y += 7) { g.fillStyle = 'rgba(40,40,40,0.35)'; g.fillRect(x0 + 8, y, SW - 16, 2); }
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x0 + 8, 72, SW - 16, 10);
      // 落書き風の汚れ
      speckle(g, SW, SH, 0, 1, 0);
      g.fillStyle = 'rgba(60,40,30,0.15)'; g.fillRect(x0 + 8, SH - 40, SW - 16, 40);
    } else if (kind === 1) {
      // ショーウィンドウ
      const gr = g.createLinearGradient(0, 80, 0, SH);
      gr.addColorStop(0, '#e8c98f'); gr.addColorStop(1, '#8a6a44');
      g.fillStyle = gr; g.fillRect(x0 + 12, 80, SW - 24, SH - 92);
      for (let s = 0; s < 3; s++) {
        g.fillStyle = 'rgba(70,50,30,0.6)'; g.fillRect(x0 + 16, 120 + s * 60, SW - 32, 5);
        for (let k = 0; k < 7; k++) { g.fillStyle = `hsl(${Math.floor(r() * 360)},45%,${40 + r() * 30}%)`; g.fillRect(x0 + 22 + k * 31, 96 + s * 60, 20, 24); }
      }
      g.fillStyle = 'rgba(30,30,30,0.9)'; g.fillRect(x0 + SW / 2 - 3, 80, 6, SH - 92);
      ge.fillStyle = 'rgba(255,214,150,0.75)'; ge.fillRect(x0 + 12, 80, SW - 24, SH - 92);
    } else {
      // ガラス扉の入口
      g.fillStyle = '#20262c'; g.fillRect(x0 + 20, 82, SW - 40, SH - 82);
      g.strokeStyle = '#a9b0b6'; g.lineWidth = 6; g.strokeRect(x0 + 20, 82, SW - 40, SH - 82);
      g.fillStyle = '#a9b0b6'; g.fillRect(x0 + SW / 2 - 3, 82, 6, SH - 82);
      g.fillStyle = 'rgba(200,215,225,0.14)';
      g.beginPath(); g.moveTo(x0 + 30, SH); g.lineTo(x0 + 90, 90); g.lineTo(x0 + 120, 90); g.lineTo(x0 + 60, SH); g.fill();
      ge.fillStyle = 'rgba(180,200,215,0.25)'; ge.fillRect(x0 + 26, 88, SW - 52, SH - 88);
    }
  }
  return { map: toTex(c, { repeat: true }), emi: toTex(ce, { repeat: true }) };
}

export function roofTexture() {
  const [c, g] = mk(128, 128);
  g.fillStyle = '#6b6a66'; g.fillRect(0, 0, 128, 128);
  speckle(g, 128, 128, 1800, 2, 0.15);
  g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 2; g.strokeRect(2, 2, 124, 124);
  return toTex(c, { repeat: true });
}

// ---------------------------------------------------------------- ground

export function groundTexture(kind) {
  const S = 256;
  const [c, g] = mk(S, S);
  if (kind === 'asphalt' || kind === 'wet') {
    g.fillStyle = kind === 'wet' ? '#34383e' : '#4a4d52'; g.fillRect(0, 0, S, S);
    speckle(g, S, S, 9000, 1.6, 0.35);
    speckle(g, S, S, 4000, 1.4, 0.2, true);
    g.strokeStyle = 'rgba(15,15,15,0.35)'; g.lineWidth = 1.2;
    for (let i = 0; i < 2; i++) {
      g.beginPath(); let x = Math.random() * S, y = Math.random() * S; g.moveTo(x, y);
      for (let k = 0; k < 8; k++) { x += (Math.random() - 0.5) * 40; y += (Math.random() - 0.5) * 40; g.lineTo(x, y); }
      g.stroke();
    }
  } else if (kind === 'pavers') {
    g.fillStyle = '#7d786e'; g.fillRect(0, 0, S, S);
    const bw = 64, bh = 32;
    for (let row = 0; row < S / bh; row++) {
      const off = row % 2 ? bw / 2 : 0;
      for (let x = -bw; x < S + bw; x += bw) {
        const v = 150 + Math.floor(Math.random() * 30);
        g.fillStyle = `rgb(${v + 8},${v + 2},${v - 10})`;
        g.fillRect(x + off + 2, row * bh + 2, bw - 4, bh - 4);
      }
    }
    speckle(g, S, S, 5000, 1.5, 0.12);
  } else if (kind === 'grass') {
    g.fillStyle = '#4f7a3b'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 7000; i++) {
      const v = Math.random();
      g.strokeStyle = `rgba(${60 + v * 60},${100 + v * 70},${40 + v * 30},0.55)`;
      const x = Math.random() * S, y = Math.random() * S;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + (Math.random() - 0.5) * 3, y - 4 - Math.random() * 4); g.stroke();
    }
  } else if (kind === 'floor') {
    g.fillStyle = '#cfcac0'; g.fillRect(0, 0, S, S);
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
      const v = 200 + Math.floor(Math.random() * 14);
      g.fillStyle = `rgb(${v},${v - 4},${v - 12})`;
      g.fillRect(x * 128 + 2, y * 128 + 2, 124, 124);
    }
    speckle(g, S, S, 2500, 1.2, 0.08);
  } else if (kind === 'tactile') {
    g.fillStyle = '#d9b11c'; g.fillRect(0, 0, S, S);
    g.fillStyle = 'rgba(0,0,0,0.18)';
    for (let i = 0; i < 4; i++) g.fillRect(24 + i * 56, 12, 22, S - 24);
  }
  return toTex(c, { repeat: true });
}

// ---------------------------------------------------------------- props

export function vendTexture(body) {
  const [c, g] = mk(128, 256);
  const [ce, ge] = mk(128, 256);
  g.fillStyle = body; g.fillRect(0, 0, 128, 256);
  ge.fillStyle = '#000'; ge.fillRect(0, 0, 128, 256);
  g.fillStyle = '#dfe6ea'; g.fillRect(10, 12, 108, 130);
  ge.fillStyle = 'rgba(230,240,255,0.9)'; ge.fillRect(10, 12, 108, 130);
  for (let row = 0; row < 3; row++) for (let k = 0; k < 6; k++) {
    const col = `hsl(${Math.floor(Math.random() * 360)},65%,50%)`;
    g.fillStyle = col; g.fillRect(14 + k * 17, 18 + row * 42, 13, 28);
    g.fillStyle = '#ff3b2f'; g.fillRect(16 + k * 17, 50 + row * 42, 8, 4);
  }
  g.fillStyle = '#1a1a1a'; g.fillRect(16, 196, 96, 30);
  g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillRect(96, 156, 14, 26);
  return { map: toTex(c), emi: toTex(ce) };
}

export function cardboardTexture() {
  const [c, g] = mk(128, 128);
  g.fillStyle = '#a77d4c'; g.fillRect(0, 0, 128, 128);
  speckle(g, 128, 128, 1500, 1.5, 0.12);
  g.fillStyle = 'rgba(210,190,150,0.8)'; g.fillRect(56, 0, 16, 128);
  g.strokeStyle = 'rgba(60,40,20,0.5)'; g.lineWidth = 2; g.strokeRect(1, 1, 126, 126);
  g.fillStyle = 'rgba(60,40,20,0.75)'; g.font = `900 16px ${FONT}`; g.textAlign = 'center';
  g.fillText('ワレモノ', 30, 100);
  g.fillText('↑↑', 100, 30);
  return toTex(c);
}

export function posterTexture(text, hue) {
  const [c, g] = mk(128, 256);
  g.fillStyle = '#f1efe9'; g.fillRect(0, 0, 128, 256);
  g.fillStyle = `hsl(${hue},55%,42%)`; g.fillRect(8, 8, 112, 170);
  g.fillStyle = 'rgba(255,255,255,0.9)';
  g.font = `900 22px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  [...text].forEach((ch, i) => g.fillText(ch, 64, 40 + i * 28));
  g.fillStyle = '#333'; g.fillRect(16, 196, 96, 6); g.fillRect(16, 210, 70, 6);
  return toTex(c);
}

// ---------------------------------------------------------------- sky

export function skyMaterial(top, horizon, bottom) {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: { top: { value: new THREE.Color(top) }, horizon: { value: new THREE.Color(horizon) }, bottom: { value: new THREE.Color(bottom) } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom; varying vec3 vDir;
      void main(){ float h = vDir.y; vec3 c = h > 0.0 ? mix(horizon, top, pow(smoothstep(0.0, 0.7, h), 0.8)) : mix(horizon, bottom, smoothstep(0.0, -0.2, h));
      gl_FragColor = vec4(c, 1.0); }`,
  });
}

export { MONO };
