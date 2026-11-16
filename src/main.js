import * as THREE from 'three';
import { Game } from './game.js';
import { UI } from './ui.js';
import { Audio } from './audio.js';
import { STAGES } from './stages.js';

const $ = id => document.getElementById(id);
const SAVE_KEY = 'smokeRefugee.save.v1';
const GHOST_KEY = id => `smokeRefugee.ghost.${id}`;

// ------------------------------------------------------------ save data
function loadSave() {
  try { return { unlocked: 1, best: {}, muted: false, ...JSON.parse(localStorage.getItem(SAVE_KEY) || '{}') }; }
  catch { return { unlocked: 1, best: {}, muted: false }; }
}
function writeSave() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* 保存できなくても遊べる */ } }
function loadGhost(id) { try { return JSON.parse(localStorage.getItem(GHOST_KEY(id)) || 'null'); } catch { return null; } }
function writeGhost(id, g) { try { localStorage.setItem(GHOST_KEY(id), JSON.stringify(g)); } catch { /* 容量不足など */ } }

const save = loadSave();
// ?all=1 で全ステージ解放（デバッグ・配信用）
if (new URLSearchParams(location.search).has('all')) save.unlocked = STAGES.length;

// ------------------------------------------------------------ setup
const canvas = $('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: false });
const coarse = matchMedia('(pointer: coarse)').matches;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, coarse ? 1.5 : 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const ui = new UI();
const audio = new Audio();
audio.setMuted(save.muted);
const game = new Game(renderer, ui, audio);

let state = 'title';
let stageIdx = 0;
let lastResult = null;
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (isTouch) document.body.classList.add('touch');
const RANK_CODE = { S: 'CODENAME: GHOST', A: 'CODENAME: FOX', B: 'CODENAME: HOUND', C: 'CODENAME: CHICKEN' };

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  game.resize(w, h);
}
window.addEventListener('resize', resize);
resize();

// タイトル背景用にステージ1を表示
game.load(STAGES[0], null);
game.setupTitle();
ui.toast('', 1);
ui.hud_visible(false);

// ------------------------------------------------------------ flow
function updateSoundBtn() { $('btn-sound').textContent = `音：${save.muted ? 'OFF' : 'ON'}`; }
updateSoundBtn();

function renderStageList() {
  const list = $('stage-list');
  list.innerHTML = '';
  STAGES.forEach((st, i) => {
    const b = document.createElement('button');
    b.className = 'stage-card';
    const best = save.best[st.id];
    const locked = i >= save.unlocked;
    b.disabled = locked;
    b.innerHTML = `<span class="no">${st.sub}</span><span class="nm">${locked ? '？？？' : st.name}</span>
      <span class="ds">${locked ? '前のステージをクリアすると解放' : st.intro}</span>
      <span class="bs">${best ? `<b>${best.rank}</b>${best.score}点` : locked ? '' : '未クリア'}</span>`;
    b.addEventListener('click', () => startStage(i));
    list.appendChild(b);
  });
}

function startStage(i) {
  audio.unlock();
  stageIdx = i;
  const st = STAGES[i];
  game.load(st, loadGhost(st.id));
  state = 'play';
  ui.hideScreens();
  ui.hud_visible(true);
  ui.letterbox(false);
  $('touch').classList.toggle('hidden', !isTouch);
  touch.run = false;
  document.querySelectorAll('.tb.on').forEach(b => b.classList.remove('on'));
  audio.startBgm();
  canvas.focus();
  lockPointer();
}

function toMenu() {
  state = 'select';
  unlockPointer();
  game.setupTitle();
  ui.letterbox(false);
  ui.hud_visible(false);
  $('touch').classList.add('hidden');
  ui.clearBubbles();
  audio.stopBgm();
  renderStageList();
  ui.show('select');
}

function pause(on) {
  if (on && state === 'play') { state = 'pause'; ui.show('pause'); audio.stopBgm(); unlockPointer(); }
  else if (!on && state === 'pause') { state = 'play'; ui.hideScreens(); audio.startBgm(); lockPointer(); }
}

ui.onFailCb = f => {
  state = 'fail';
  unlockPointer();
  ui.letterbox(true);
  setTimeout(() => { if (state === 'fail') ui.hud_visible(false); }, 500);
  audio.stopBgm();
  $('fail-cause').textContent = f.cause;
  const kind = { time: '時間切れ', mental: 'メンタル崩壊', guide: '即アウト', smell: '匂いチェック不合格' }[f.kind] || '';
  $('fail-sub').textContent = `${f.stage.name}　${f.clock}　${kind}　舌打ち ${f.tsk} 回`;
  setTimeout(() => { if (state === 'fail') ui.show('fail'); }, 650);
};

ui.onClearCb = r => {
  state = 'result';
  unlockPointer();
  ui.letterbox(true);
  setTimeout(() => { if (state === 'result') ui.hud_visible(false); }, 700);
  audio.stopBgm();
  lastResult = r;
  const st = r.stage;
  const prev = save.best[st.id];
  const isBest = !prev || r.score > prev.score;
  if (isBest) {
    save.best[st.id] = { score: r.score, rank: r.rank };
    writeGhost(st.id, r.ghost);
  }
  save.unlocked = Math.max(save.unlocked, Math.min(STAGES.length, stageIdx + 2));
  writeSave();
  $('res-rank').textContent = r.rank;
  $('res-code').textContent = RANK_CODE[r.rank] || '';
  $('res-stage').textContent = st.name;
  $('res-clock').textContent = r.clock;
  $('res-remain').textContent = `${Math.floor(r.remain)} 分`;
  $('res-tsk').textContent = `${r.tsk} 回`;
  $('res-res').textContent = `${Math.round(r.residual * 100)} %`;
  $('res-score').textContent = `${r.score} 点`;
  $('res-best').textContent = isBest ? (prev ? '自己ベスト更新！ 次回からゴーストが一緒に走ります' : '初クリア！ 次回からゴーストが一緒に走ります') : `自己ベスト ${prev.rank} / ${prev.score}点`;
  $('btn-next').classList.toggle('hidden', stageIdx >= STAGES.length - 1);
  setTimeout(() => { if (state === 'result') ui.show('result'); }, 900);
};

// ------------------------------------------------------------ share
function shareText(r) {
  return `SMOKE REFUGEE「${r.stage.name}」をランク${r.rank}でクリア。舌打ち${r.tsk}回、残り香${Math.round(r.residual * 100)}%。たった一服のために、ここまでやる。 #SMOKEREFUGEE`;
}

function shareImage(r) {
  const c = document.createElement('canvas');
  c.width = 1200; c.height = 630;
  const g = c.getContext('2d');
  // 背景にゲーム画面を敷く
  game.render();
  g.drawImage(renderer.domElement, 0, 0, 1200, 630);
  const grd = g.createLinearGradient(0, 0, 1200, 0);
  grd.addColorStop(0, 'rgba(4,8,6,0.92)');
  grd.addColorStop(0.62, 'rgba(4,8,6,0.75)');
  grd.addColorStop(1, 'rgba(4,8,6,0.35)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 1200, 630);
  g.strokeStyle = 'rgba(169,240,184,0.6)';
  g.lineWidth = 3;
  g.strokeRect(30, 30, 1140, 570);
  g.fillStyle = '#a9f0b8';
  g.font = '400 24px "Share Tech Mono", monospace';
  g.fillText('MISSION COMPLETE  //  本日の一服', 70, 90);
  g.fillStyle = '#eef3ec';
  g.font = '400 70px "Black Ops One", sans-serif';
  g.fillText('SMOKE REFUGEE', 70, 170);
  g.font = '700 34px "Noto Sans JP", sans-serif';
  g.fillText(`${r.stage.sub}　${r.stage.name}`, 70, 240);
  const rows = [['帰着時刻', r.clock], ['残り時間', `${Math.floor(r.remain)} 分`], ['舌打ち', `${r.tsk} 回`], ['残り香', `${Math.round(r.residual * 100)} %`], ['スコア', `${r.score} 点`]];
  g.font = '700 32px "Noto Sans JP", sans-serif';
  rows.forEach(([k, v], i) => {
    g.fillStyle = 'rgba(244,239,230,0.7)'; g.fillText(k, 70, 320 + i * 54);
    g.fillStyle = '#f4efe6'; g.fillText(v, 270, 320 + i * 54);
  });
  g.fillStyle = '#ffc23a';
  g.font = '400 300px "Black Ops One", sans-serif';
  g.fillText(r.rank, 830, 450);
  g.font = '400 26px "Share Tech Mono", monospace';
  g.fillText(RANK_CODE[r.rank] || '', 800, 510);
  g.fillStyle = 'rgba(244,239,230,0.6)';
  g.font = '700 22px "Noto Sans JP", sans-serif';
  g.fillText('#SMOKEREFUGEE  TACTICAL SMOKING ACTION', 70, 575);
  const a = document.createElement('a');
  a.download = `smoke-refugee-${r.stage.id}-${r.rank}.png`;
  a.href = c.toDataURL('image/png');
  a.click();
}

// ------------------------------------------------------------ buttons
const on = (id, fn) => $(id).addEventListener('click', e => { e.currentTarget.blur(); audio.unlock(); fn(); });
on('btn-start', () => { renderStageList(); state = 'select'; ui.show('select'); });
on('btn-howto', () => ui.show('howto'));
on('btn-sound', () => { save.muted = !save.muted; audio.setMuted(save.muted); writeSave(); updateSoundBtn(); });
document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => { state = b.dataset.go; ui.show(b.dataset.go); }));
on('btn-pause', () => pause(true));
on('btn-resume', () => pause(false));
on('btn-retry-p', () => startStage(stageIdx));
on('btn-menu-p', toMenu);
on('btn-retry-f', () => startStage(stageIdx));
on('btn-menu-f', toMenu);
on('btn-retry-r', () => startStage(stageIdx));
on('btn-menu-r', toMenu);
on('btn-next', () => startStage(Math.min(STAGES.length - 1, stageIdx + 1)));
on('btn-share-img', () => lastResult && shareImage(lastResult));
on('btn-share-x', () => {
  if (!lastResult) return;
  const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText(lastResult))}&url=${encodeURIComponent(location.href.split('?')[0])}`;
  window.open(url, '_blank', 'noopener');
});

// ------------------------------------------------------------ input
const keys = new Set();
const input = { x: 0, y: 0, run: false, turn: 0 };

// マウス視点（クリックでポインタロック）
let pointerWanted = false;
function lockPointer() {
  if (isTouch || !canvas.requestPointerLock) return;
  pointerWanted = true;
  try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch { /* 使えない環境ではドラッグで回す */ }
}
function unlockPointer() {
  pointerWanted = false;
  if (document.pointerLockElement && document.exitPointerLock) document.exitPointerLock();
}
const locked = () => document.pointerLockElement === canvas;
canvas.addEventListener('mousedown', () => { if (state === 'play' && !locked()) lockPointer(); });
document.addEventListener('mousemove', e => {
  if (state !== 'play') return;
  if (locked()) game.look(e.movementX, e.movementY);
  else if (e.buttons & 1 && e.target === canvas) game.look(e.movementX * 1.2, e.movementY * 1.2);
});
let lastUnlock = 0;
document.addEventListener('pointerlockchange', () => {
  $('lookhint').classList.toggle('hidden', locked());
  if (!locked()) lastUnlock = performance.now();
  if (!locked() && pointerWanted && state === 'play') pause(true);
});
canvas.addEventListener('contextmenu', e => e.preventDefault());
window.addEventListener('keydown', e => {
  if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.repeat) { keys.add(e.code); return; }
  keys.add(e.code);
  audio.unlock();
  if (e.code === 'Escape' && performance.now() - lastUnlock < 400) return;
  if (e.code === 'Escape' || e.code === 'KeyP') { if (state === 'play') pause(true); else if (state === 'pause') pause(false); return; }
  if (e.code === 'KeyR' && ['play', 'pause', 'fail', 'result'].includes(state)) { startStage(stageIdx); return; }
  if (e.code === 'KeyM') { save.muted = !save.muted; audio.setMuted(save.muted); writeSave(); updateSoundBtn(); return; }
  if (state === 'result' && (e.code === 'Enter' || e.code === 'Space') && stageIdx < STAGES.length - 1) { startStage(stageIdx + 1); return; }
  if (state === 'fail' && (e.code === 'Enter' || e.code === 'Space')) { startStage(stageIdx); return; }
  if (state !== 'play') return;
  if (e.code === 'Space' || e.code === 'Enter') game.action();
  if (e.code === 'Tab') game.toggleMode();
  if (e.code === 'KeyC') game.toggleCrouch();
  if (e.code === 'KeyQ') game.useSpray();
  if (e.code === 'KeyE') game.useGum();
});
window.addEventListener('keyup', e => keys.delete(e.code));
window.addEventListener('blur', () => { keys.clear(); pause(true); });

// タッチ操作
const touch = { x: 0, y: 0, run: false, id: null };
const stick = $('stick'), knob = $('knob');
stick.addEventListener('pointerdown', e => { touch.id = e.pointerId; stick.setPointerCapture(e.pointerId); moveStick(e); });
stick.addEventListener('pointermove', e => { if (e.pointerId === touch.id) moveStick(e); });
const endStick = () => { touch.id = null; touch.x = touch.y = 0; knob.style.transform = ''; };
stick.addEventListener('pointerup', endStick);
stick.addEventListener('pointercancel', endStick);
function moveStick(e) {
  const r = stick.getBoundingClientRect();
  let dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
  let dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
  const l = Math.hypot(dx, dy);
  if (l > 1) { dx /= l; dy /= l; }
  touch.x = dx; touch.y = dy;
  knob.style.transform = `translate(${dx * 40}px, ${dy * 40}px)`;
}
document.querySelectorAll('.tb').forEach(b => b.addEventListener('pointerdown', e => {
  e.preventDefault();
  audio.unlock();
  if (state !== 'play') return;
  const a = b.dataset.act;
  if (a === 'smoke') game.action();
  if (a === 'mode') game.toggleMode();
  if (a === 'spray') game.useSpray();
  if (a === 'gum') game.useGum();
  if (a === 'run') { touch.run = !touch.run; b.classList.toggle('on', touch.run); }
  if (a === 'crouch') { game.toggleCrouch(); b.classList.toggle('on', game.player.crouch); }
}));

// タッチ：画面右側のドラッグで視点
const look = { id: null, x: 0, y: 0 };
canvas.addEventListener('pointerdown', e => {
  if (e.pointerType !== 'touch' || state !== 'play' || look.id !== null) return;
  look.id = e.pointerId; look.x = e.clientX; look.y = e.clientY;
});
canvas.addEventListener('pointermove', e => {
  if (e.pointerId !== look.id) return;
  game.look((e.clientX - look.x) * 1.8, (e.clientY - look.y) * 1.8);
  look.x = e.clientX; look.y = e.clientY;
});
const endLook = e => { if (e.pointerId === look.id) look.id = null; };
canvas.addEventListener('pointerup', endLook);
canvas.addEventListener('pointercancel', endLook);

function readInput() {
  let x = 0, y = 0;
  if (keys.has('KeyA')) x -= 1;
  if (keys.has('KeyD')) x += 1;
  input.turn = (keys.has('ArrowRight') ? 1 : 0) - (keys.has('ArrowLeft') ? 1 : 0);
  if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
  input.x = x + touch.x;
  input.y = y + touch.y;
  input.run = keys.has('ShiftLeft') || keys.has('ShiftRight') || touch.run;
  return input;
}

// ------------------------------------------------------------ loop
let last = performance.now();
let titleT = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (state === 'play') game.update(dt, readInput());
  else if (state === 'fail' || state === 'result') game.update(dt, { x: 0, y: 0, run: false });
  else if (state === 'title' || state === 'select' || state === 'howto') {
    // タイトル背景：街をゆっくり眺める
    titleT += dt;
    game.time += dt;
    game.updateVisuals(dt);
    game.titleCam(titleT);
  }
  if (state !== 'pause') ui.updateBubbles(game.camera);
  game.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// テスト・デバッグ用の窓口
window.__SR = { game, startStage, STAGES, get state() { return state; } };
