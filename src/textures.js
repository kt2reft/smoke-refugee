import * as THREE from 'three';

const FONT = '"Noto Sans JP","Hiragino Kaku Gothic ProN","Yu Gothic","Meiryo",sans-serif';

// 丸いバッジ型のマーカー（地図アイコン）
export function badgeTexture(text, bg, fg = '#fff') {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.beginPath(); g.arc(64, 68, 56, 0, Math.PI * 2); g.fill();
  g.fillStyle = bg;
  g.beginPath(); g.arc(64, 62, 54, 0, Math.PI * 2); g.fill();
  g.lineWidth = 6; g.strokeStyle = '#fff';
  g.stroke();
  g.fillStyle = fg;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const size = text.length > 2 ? 34 : text.length > 1 ? 44 : 60;
  g.font = `900 ${size}px ${FONT}`;
  g.fillText(text, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// 看板（横長テキスト）
export function signTexture(text, bg, fg = '#fff', w = 256, h = 96) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = bg;
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
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// 匂いオーラ用の放射グラデーション
export function radialTexture(inner, outer) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, inner);
  gr.addColorStop(0.7, outer);
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// 煙の粒
export function puffTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(230,225,240,0.9)');
  gr.addColorStop(0.5, 'rgba(200,195,215,0.45)');
  gr.addColorStop(1, 'rgba(200,195,215,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// 建物の窓テクスチャ（タイル状に繰り返す）
export function windowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#c9d2dc';
  for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) g.fillRect(6 + x * 32, 8 + y * 32, 20, 18);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
