import * as THREE from 'three';
import { Game } from './game.js';
import { UI } from './ui.js';
import { Audio } from './audio.js';
import { STAGES } from './stages.js';
import { CHARACTERS, charById, statStars } from './characters.js';

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
let chara = charById(save.chara);
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
game.setCharacter(chara);

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

// ミッションごとの説明（ブリーフィング）
const MISSION_INFO = {
  s1: { place: 'オフィス街', news: ['基本操作', '撤去済みの灰皿', '上司の匂いチェック'] },
  s2: { place: '駅前ロータリー', news: ['路上喫煙指導員（見られたら即アウト）', '満員の喫煙所', '風向きの変化'] },
  s3: { place: '雨の商店街', news: ['雨で紙巻きに火がつかない', '匂いに敏感な人', '喫茶店で上司に遭遇'] },
  s4: { place: '新幹線の乗り換え', news: ['25分の乗り換え時間', '喫煙ルームのどちらかが閉鎖'] },
  s5: { place: '親戚の結婚式', news: ['親戚の視線', '母の厳しい匂いチェック'] },
};
const NPC_NAME = { walker: '通行人', parent: '子連れ', sensitive: '匂いに敏感な人', guide: '路上喫煙指導員', relative: '親戚', ally: '愛煙家（味方）' };
let selIdx = 0;

function renderStageList() {
  const list = $('stage-list');
  list.innerHTML = '';
  STAGES.forEach((st, i) => {
    const b = document.createElement('button');
    b.className = `m-card${i === selIdx ? ' on' : ''}`;
    const best = save.best[st.id];
    b.innerHTML = `<span class="no">MISSION 0${i + 1}</span><span class="nm">${st.name}</span>
      <span class="rk${best ? '' : ' none'}">${best ? best.rank : 'NEW'}</span>`;
    b.addEventListener('click', () => { if (selIdx === i) startStage(i); else { selIdx = i; renderStageList(); audio.beep(); } });
    list.appendChild(b);
  });
  renderBrief();
}

function renderBrief() {
  const st = STAGES[selIdx];
  const info = MISSION_INFO[st.id] || { place: st.name, news: [] };
  const best = save.best[st.id];
  const counts = {};
  st.npcs.forEach(n => { counts[n.type] = (counts[n.type] || 0) + 1; });
  const threat = Object.entries(counts).map(([t, n]) => `<span class="${['guide', 'sensitive', 'relative'].includes(t) ? 'hi' : ''}">${NPC_NAME[t] || t} ×${n}</span>`).join('');
  const goal = { s4: '新幹線に乗車', s5: '式場に戻る' }[st.id] || '職場に戻る';
  $('m-brief').innerHTML = `<div class="no">MISSION 0${selIdx + 1} ／ ${st.sub}</div><h3>${st.name}</h3>
    <p class="intro">${st.intro}</p>
    <dl>
      <dt>LOCATION</dt><dd>${info.place}</dd>
      <dt>TIME</dt><dd>${st.startClock} 開始　制限 ${st.minutes} 分</dd>
      <dt>OBJECTIVE</dt><dd>喫煙所で一服 → 匂いを消して${goal}</dd>
      <dt>CHECK</dt><dd>${st.goalCheck.who}の匂いチェック</dd>
      <dt>WEATHER</dt><dd>${st.rain ? '雨（紙巻きに火がつかない）' : '晴れ'}${st.wind.length > 1 ? '　風向きが変わる' : ''}</dd>
      <dt>THREAT</dt><dd class="threat">${threat}</dd>
      <dt>NEW</dt><dd>${info.news.join('、')}</dd>
      <dt>OPERATIVE</dt><dd>${chara.name}（${chara.trait}）</dd>
      <dt>BEST</dt><dd>${best ? `ランク ${best.rank}　${best.score}点` : '未クリア'}</dd>
    </dl>`;
}

function renderCharaList() {
  const list = $('chara-list');
  list.innerHTML = '';
  CHARACTERS.forEach((c, i) => {
    const b = document.createElement('button');
    b.className = `chara-card${c.id === chara.id ? ' on' : ''}`;
    b.innerHTML = `<span class="no">OPERATIVE 0${i + 1}</span><span class="nm">${c.name}</span><span class="rl">${c.role}・${c.age}歳</span><span class="tr">${c.trait}</span>`;
    b.addEventListener('click', () => {
      if (chara.id === c.id) { goMissions(); return; }
      chara = c;
      game.setCharacter(c);
      audio.beep();
      renderCharaList();
    });
    list.appendChild(b);
  });
  const st = chara.start;
  $('chara-info').innerHTML = `<div class="kana">${chara.kana}</div><h3>${chara.name}</h3>
    <div class="rl">${chara.role}・${chara.age}歳</div>
    <p class="pf">${chara.profile}</p>
    <div class="trait"><b>特性：${chara.trait}</b>${chara.traitText}</div>
    ${statStars(chara).map(([k, v]) => `<div class="stat-row"><span>${k}</span><span class="pips">${[1, 2, 3, 4, 5].map(n => `<i class="${n <= v ? 'on' : ''}"></i>`).join('')}</span></div>`).join('')}
    <div class="kit">初期装備：${st.mode === 'cig' ? '紙巻き' : '加熱式'}／紙巻き${st.cigs}本・加熱式 電池${st.battery}回<br>消臭スプレー×${st.sprays}　ミントガム×${st.gums}　¥${st.money}</div>`;
}

function goChara() { state = 'chara'; renderCharaList(); ui.show('chara'); }
function goMissions() {
  save.chara = chara.id;
  writeSave();
  state = 'select';
  renderStageList();
  ui.show('select');
}

function startStage(i) {
  audio.unlock();
  stageIdx = i;
  selIdx = i;
  const st = STAGES[i];
  game.setCharacter(chara);
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
  writeSave();
  $('res-rank').textContent = r.rank;
  $('res-code').textContent = RANK_CODE[r.rank] || '';
  $('res-stage').textContent = st.name;
  $('res-chara').textContent = chara.name;
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
  return `SMOKE REFUGEE「${r.stage.name}」を${chara.name}でランク${r.rank}でクリア。舌打ち${r.tsk}回、残り香${Math.round(r.residual * 100)}%。たった一服のために、ここまでやる。 #SMOKEREFUGEE`;
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
on('btn-start', goChara);
on('btn-chara-ok', goMissions);
on('btn-to-chara', goChara);
on('btn-sortie', () => startStage(selIdx));
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
  else if (state === 'title' || state === 'select' || state === 'howto' || state === 'chara') {
    // タイトル背景：街をゆっくり眺める
    titleT += dt;
    game.time += dt;
    game.updateVisuals(dt);
    if (state === 'chara') game.charaCam(titleT); else game.titleCam(titleT);
  }
  if (state !== 'pause') ui.updateBubbles(game.camera);
  game.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// テスト・デバッグ用の窓口
window.__SR = { game, startStage, STAGES, get state() { return state; } };
