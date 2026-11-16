// 操作キャラクター。stats は 1.0 が標準（煙山タケシ＝元のゲームと同じ性能）
//   speed   : 移動の速さ
//   drain   : ニコチンの減り（小さいほど長持ち）
//   dmg     : 舌打ちで受けるメンタルダメージ（小さいほど打たれ強い）
//   fade    : 残り香の消え方（大きいほど早く消える）
// look は見た目。hair: short / long / bob / ponytail / buzz
export const CHARACTERS = [
  {
    id: 'takeshi', name: '煙山 タケシ', kana: 'ケムヤマ タケシ', role: '営業課長', age: 42, gender: 'm', call: 'お兄さん',
    profile: '喫煙歴20年。会社の灰皿が消えた日から、昼休みのすべてを一服に捧げている。',
    trait: 'バランス型', traitText: 'すべてが標準。迷ったらこの人。',
    stats: { speed: 1.0, drain: 1.0, dmg: 1.0, fade: 1.0 },
    start: { cigs: 3, battery: 2, sprays: 1, gums: 2, money: 800, mode: 'cig' },
    look: { body: 0x2a2e37, legs: 0x23262e, hair: 0x1e1a18, hairStyle: 'short', shirt: 0xf2f2f2, tie: 0xb3261e, bag: 0x2a1f18 },
  },
  {
    id: 'misaki', name: '灰原 ミサキ', kana: 'ハイバラ ミサキ', role: '営業部エース', age: 31, gender: 'f', call: 'お姉さん',
    profile: '外回りで鍛えた脚が自慢。商談の合間の一服を、誰にも気づかれずに済ませてきた。',
    trait: '俊足', traitText: '移動が12%速い。ただしニコチンの減りも10%早い。',
    stats: { speed: 1.12, drain: 1.1, dmg: 1.0, fade: 1.0 },
    start: { cigs: 3, battery: 2, sprays: 1, gums: 2, money: 800, mode: 'cig' },
    look: { body: 0x1f2b44, legs: 0x1f2b44, hair: 0x3a2618, hairStyle: 'ponytail', shirt: 0xf4f1ea, bag: 0x5a2a22, skin: 0xedc9a8 },
  },
  {
    id: 'yuki', name: '白石 ユキ', kana: 'シライシ ユキ', role: '総務部・新人', age: 24, gender: 'f', call: 'お姉さん',
    profile: '紙巻きの匂いが苦手で加熱式派。新人らしさを武器に、どこにでも溶け込む。',
    trait: '加熱式派', traitText: '加熱式でスタート、電池が1回分多い（紙巻きは1本）。ガムも多め。',
    stats: { speed: 1.0, drain: 1.0, dmg: 1.0, fade: 1.0 },
    start: { cigs: 1, battery: 3, sprays: 1, gums: 3, money: 600, mode: 'heat' },
    look: { body: 0xc9b79a, legs: 0x3b3a40, hair: 0x5a3a24, hairStyle: 'bob', shirt: 0xffffff, skirt: true, skin: 0xf0cfb0, bag: 0xd8c8b0 },
  },
  {
    id: 'gou', name: '鬼塚 ゴウ', kana: 'オニヅカ ゴウ', role: '総務部長', age: 55, gender: 'm', call: 'お兄さん',
    profile: '社内の喫煙所撤去を決めた張本人。立場上、絶対に吸っているところを見られてはならない。',
    trait: '鉄の心臓', traitText: '舌打ちのダメージが25%少ない。所持金も多い。ただし足は8%遅い。',
    stats: { speed: 0.92, drain: 1.0, dmg: 0.75, fade: 1.0 },
    start: { cigs: 3, battery: 2, sprays: 1, gums: 2, money: 1500, mode: 'cig' },
    look: { body: 0xeceae4, legs: 0x5a5d63, hair: 0x8a8a8a, hairStyle: 'buzz', tie: 0x1f3b6b, scale: 1.08, glasses: true, bag: 0x1a1a1a },
  },
  {
    id: 'rei', name: '霧島 レイ', kana: 'キリシマ レイ', role: 'デザイナー', age: 35, gender: 'f', call: 'お姉さん',
    profile: '香水と換気には一家言ある。匂いの消し方なら社内の誰よりも詳しい。',
    trait: '残り香ケア', traitText: '残り香が約40%早く消える。ただし消臭スプレーを持っていない。',
    stats: { speed: 1.0, drain: 1.0, dmg: 1.0, fade: 1.4 },
    start: { cigs: 3, battery: 2, sprays: 0, gums: 2, money: 800, mode: 'cig' },
    look: { body: 0x18181b, legs: 0x2e2c30, hair: 0x0e0d10, hairStyle: 'long', skin: 0xe8c4a2, bag: 0x7a6a58, glasses: true },
  },
];

export const charById = id => CHARACTERS.find(c => c.id === id) || CHARACTERS[0];

// 選択画面用の5段階評価
export function statStars(c) {
  const s = c.stats, st = c.start;
  const r = v => Math.max(1, Math.min(5, Math.round(v)));
  return [
    ['足の速さ', r(3 + (s.speed - 1) * 16)],
    ['ニコチン持ち', r(3 - (s.drain - 1) * 16)],
    ['打たれ強さ', r(3 + (1 - s.dmg) * 8)],
    ['匂いの消え', r(3 + (s.fade - 1) * 5)],
    ['持ち物', r(1 + (st.sprays + st.gums + st.cigs + st.battery) / 2.4)],
  ];
}
