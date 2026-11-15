"""SMOKE REFUGEE のステージを作るスクリプト。
マップ（文字）とNPCの巡回ルートを検証し、src/stages.js を書き出す。  使い方: python3 tools/genmaps.py"""
import json, sys
from collections import deque

W, H = 30, 20
WALK = set('.,gOPGSXHKC')

def base():
    return [['#'] * W for _ in range(H)]

def rect(g, x0, y0, x1, y1, c):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            g[y][x] = c

def put(g, pts, c):
    for x, y in pts:
        g[y][x] = c

stages = {}

# ---------- Stage 1: office district lunch break ----------
g = base()
for r in [(1, 4, 28, 5), (1, 12, 28, 13), (6, 1, 7, 18), (16, 1, 17, 18), (24, 1, 25, 18)]:
    rect(g, *r, '.')
rect(g, 2, 8, 5, 9, ',')
put(g, [(2, 8)], 'O')
put(g, [(8, 6)], 'X')
put(g, [(18, 10)], 'S')
put(g, [(26, 15)], 'S')
put(g, [(15, 7)], 'C')
put(g, [(4, 9)], 'T')
stages['s1'] = g

# ---------- Stage 2: station rotary ----------
g = base()
rect(g, 12, 1, 17, 4, ',')      # station front
rect(g, 8, 5, 21, 6, '.')       # ring top
rect(g, 8, 13, 21, 14, '.')     # ring bottom
rect(g, 8, 5, 9, 14, '.')       # ring left
rect(g, 20, 5, 21, 14, '.')     # ring right
rect(g, 10, 7, 19, 12, ',')     # plaza
rect(g, 2, 9, 7, 10, '.')       # road to office
rect(g, 14, 15, 15, 18, '.')    # road south
rect(g, 22, 9, 28, 10, '.')     # road east
rect(g, 24, 1, 25, 8, '.')      # road north-east
put(g, [(1, 9)], 'O')
put(g, [(15, 10)], 'S')
put(g, [(11, 3)], 'X')
put(g, [(23, 11)], 'H')
put(g, [(7, 11)], 'C')
put(g, [(26, 11)], 'K')
put(g, [(16, 17)], 'S')
put(g, [(11, 8), (18, 8), (11, 11), (18, 11)], 'T')
stages['s2'] = g

# ---------- Stage 3: rainy shopping street ----------
g = base()
for r in [(2, 9, 28, 10), (5, 1, 6, 18), (15, 1, 16, 18), (24, 1, 25, 18), (1, 3, 28, 3), (1, 15, 28, 16)]:
    rect(g, *r, '.')
put(g, [(3, 8)], 'O')
put(g, [(9, 8)], 'K')
put(g, [(20, 11)], 'K')
put(g, [(12, 11)], 'S')
put(g, [(27, 4)], 'S')
put(g, [(18, 8)], 'H')
put(g, [(8, 14)], 'X')
put(g, [(13, 8)], 'C')
stages['s3'] = g

# ---------- Stage 4: shinkansen transfer ----------
g = base()
rect(g, 1, 6, 28, 13, ',')      # concourse
rect(g, 1, 14, 4, 18, ',')      # arrival platform corridor
rect(g, 25, 1, 28, 5, ',')      # departure platform corridor
rect(g, 7, 2, 9, 5, ',')        # smoking room corridor A
rect(g, 20, 14, 22, 17, ',')    # smoking room corridor B
put(g, [(2, 17)], 'P')
put(g, [(27, 2)], 'G')
put(g, [(8, 1)], 'S')
put(g, [(21, 18)], 'S')
put(g, [(14, 14)], 'H')
put(g, [(5, 5)], 'C')
put(g, [(6, 9), (10, 9), (18, 9), (22, 9), (11, 11), (14, 11), (20, 11)], 'T')
stages['s4'] = g

# ---------- Stage 5: relative's wedding ----------
g = base()
rect(g, 2, 7, 27, 16, 'g')      # garden
rect(g, 1, 17, 28, 17, '.')     # road
rect(g, 26, 1, 27, 6, ',')      # back path to smoking corner
rect(g, 13, 7, 15, 16, ',')     # central path
rect(g, 2, 12, 27, 12, ',')     # cross path
put(g, [(14, 6)], 'O')
put(g, [(28, 2)], 'S')
put(g, [(4, 8)], 'X')
put(g, [(10, 18)], 'C')
put(g, [(x, 10) for x in range(5, 11)] + [(x, 10) for x in range(18, 24)] + [(x, 14) for x in range(4, 9)] + [(x, 14) for x in range(20, 25)], 'T')
stages['s5'] = g

npcs = {
    's1': [
        ('walker', [(1, 4), (28, 4)], 'pingpong'),
        ('walker', [(6, 1), (6, 18)], 'pingpong'),
        ('walker', [(17, 18), (17, 1)], 'pingpong'),
        ('walker', [(28, 13), (1, 13)], 'pingpong'),
        ('walker', [(7, 5), (16, 5), (16, 12), (7, 12)], 'loop'),
        ('walker', [(24, 1), (24, 18)], 'pingpong'),
        ('walker', [(17, 4), (25, 4), (25, 12), (17, 12)], 'loop'),
        ('parent', [(18, 13), (28, 13)], 'pingpong'),
    ],
    's2': [
        ('guide', [(10, 7), (19, 7), (19, 12), (10, 12)], 'loop'),
        ('guide', [(2, 10), (7, 10)], 'pingpong'),
        ('walker', [(14, 1), (14, 18)], 'pingpong'),
        ('walker', [(17, 1), (17, 14)], 'pingpong'),
        ('walker', [(8, 5), (21, 5), (21, 14), (8, 14)], 'loop'),
        ('walker', [(9, 14), (9, 6), (20, 6), (20, 14)], 'loop'),
        ('walker', [(22, 9), (28, 9)], 'pingpong'),
        ('walker', [(28, 10), (22, 10)], 'pingpong'),
        ('walker', [(24, 1), (24, 8)], 'pingpong'),
        ('parent', [(10, 12), (19, 12)], 'pingpong'),
    ],
    's3': [
        ('walker', [(2, 9), (28, 9)], 'pingpong'),
        ('walker', [(28, 10), (2, 10)], 'pingpong'),
        ('walker', [(5, 1), (5, 18)], 'pingpong'),
        ('walker', [(16, 18), (16, 1)], 'pingpong'),
        ('walker', [(24, 1), (24, 18)], 'pingpong'),
        ('walker', [(1, 15), (28, 15)], 'pingpong'),
        ('walker', [(1, 3), (28, 3)], 'pingpong'),
        ('parent', [(6, 9), (14, 9)], 'pingpong'),
        ('parent', [(17, 10), (25, 10)], 'pingpong'),
        ('sensitive', [(5, 16), (25, 16)], 'pingpong'),
        ('sensitive', [(15, 3), (15, 15)], 'pingpong'),
        ('ally', [(22, 10)], 'still'),
    ],
    's4': [
        ('walker', [(1, 6), (28, 6)], 'pingpong'),
        ('walker', [(28, 7), (1, 7)], 'pingpong'),
        ('walker', [(1, 8), (28, 8)], 'pingpong'),
        ('walker', [(28, 10), (1, 10)], 'pingpong'),
        ('walker', [(1, 12), (28, 12)], 'pingpong'),
        ('walker', [(28, 13), (1, 13)], 'pingpong'),
        ('walker', [(3, 18), (3, 6)], 'pingpong'),
        ('walker', [(26, 13), (26, 1)], 'pingpong'),
        ('walker', [(8, 2), (8, 13)], 'pingpong'),
        ('guide', [(12, 6), (24, 6), (24, 13), (12, 13)], 'loop'),
        ('parent', [(5, 12), (20, 12)], 'pingpong'),
    ],
    's5': [
        ('relative', [(3, 9), (12, 9), (12, 13), (3, 13)], 'loop'),
        ('relative', [(16, 8), (25, 8), (25, 13), (16, 13)], 'loop'),
        ('relative', [(6, 15), (22, 15)], 'pingpong'),
        ('parent', [(2, 16), (27, 16)], 'pingpong'),
        ('sensitive', [(17, 7), (17, 16)], 'pingpong'),
        ('walker', [(1, 17), (28, 17)], 'pingpong'),
        ('relative', [(26, 7), (26, 11)], 'pingpong'),
    ],
}

ok = True
for sid, g in stages.items():
    rows = [''.join(r) for r in g]
    # connectivity from start
    start = None
    for y in range(H):
        for x in range(W):
            if g[y][x] in 'OP':
                start = (x, y)
    seen = {start}
    q = deque([start])
    while q:
        x, y = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < W and 0 <= ny < H and (nx, ny) not in seen and g[ny][nx] in WALK:
                seen.add((nx, ny))
                q.append((nx, ny))
    for y in range(H):
        for x in range(W):
            if g[y][x] in 'SXHKCG' and (x, y) not in seen:
                print(sid, 'UNREACHABLE', g[y][x], (x, y)); ok = False
    for t, path, mode in npcs[sid]:
        pts = path + ([path[0]] if mode == 'loop' else [])
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            if x0 != x1 and y0 != y1:
                print(sid, 'DIAGONAL', t, path); ok = False
            n = max(abs(x1 - x0), abs(y1 - y0))
            for i in range(n + 1):
                x = x0 + (x1 - x0) * i // max(n, 1)
                y = y0 + (y1 - y0) * i // max(n, 1)
                if g[y][x] not in WALK or g[y][x] in 'SXHKC':
                    print(sid, 'BLOCKED', t, path, (x, y), g[y][x]); ok = False
        if mode == 'still' and g[path[0][1]][path[0][0]] not in WALK:
            print(sid, 'BLOCKED still', path); ok = False
    print(sid)
    print('\n'.join(rows))

import os; os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
print('OK' if ok else 'ERRORS')

# ---------- write src/stages.js ----------
config = {
 's1': dict(name='オフィス街の昼休み', sub='STAGE 1', intro='まずは基本。灰皿で一服して、匂いを消して職場に戻れ。',
            startClock='12:00', minutes=60, secPerMin=2.6, wind=[[1,0,0.6]], rain=False,
            goalCheck=dict(who='上司', threshold=3.0, fail='上司「…タバコ吸ってきた？」'),
            events={}, closures=[], allyHint=''),
 's2': dict(name='駅前ロータリー', sub='STAGE 2', intro='路上喫煙指導員が巡回中。喫煙所の外で吸っているところを見られたら即アウト。',
            startClock='12:00', minutes=60, secPerMin=2.8, wind=[[1,0,0.6],[-1,0,0.7]], rain=False,
            goalCheck=dict(who='上司', threshold=3.0, fail='上司「…タバコ吸ってきた？」'),
            events={'15,10':'full'}, closures=[], allyHint=''),
 's3': dict(name='雨の商店街', sub='STAGE 3', intro='雨で屋外の喫煙所では紙巻きに火がつかない。加熱式か、喫茶店か、それとも…。',
            startClock='12:00', minutes=60, secPerMin=2.8, wind=[[0,0,0]], rain=True,
            goalCheck=dict(who='上司', threshold=3.0, fail='上司「…タバコ吸ってきた？」'),
            events={'20,11':'boss'}, closures=[], allyHint='雨か。ほら、ターボライター貸すよ。外の灰皿でも火がつく'),
 's4': dict(name='新幹線の乗り換え', sub='STAGE 4', intro='乗り換え時間は25分。喫煙ルームで一服して、匂いを落としてから乗車せよ。',
            startClock='14:05', minutes=25, secPerMin=4.4, wind=[[0,0,0]], rain=False,
            goalCheck=dict(who='隣の席の客', threshold=3.0, fail='隣の客が無言で席を移った'),
            events={}, closures=['8,1','21,18'], allyHint=''),
 's5': dict(name='親戚の結婚式', sub='STAGE 5', intro='披露宴の合間の45分。式場の喫煙所は庭の奥。母のチェックは厳しい。',
            startClock='13:30', minutes=45, secPerMin=3.2, wind=[[0,-1,0.5],[1,0,0.6]], rain=False,
            goalCheck=dict(who='母', threshold=2.2, fail='母「あんた、礼服がタバコ臭いよ」'),
            events={}, closures=[], allyHint=''),
}
out = ['// Generated by tools/genmaps.py. マップは文字で編集できます。',
       '// 凡例: # 建物  . 道路  , 歩道・広場  g 芝生  T 木・柱  O 職場（スタート兼ゴール）',
       '//       P スタート  G ゴール  S 喫煙所  X 撤去済み灰皿（地図には載っている）',
       '//       H 加熱式専用店  K 喫茶店（喫煙可）  C コンビニ',
       '// NPC: type = walker 通行人 / parent 子連れ / sensitive 匂いに敏感な人 / guide 路上喫煙指導員 / relative 親戚 / ally 愛煙家',
       'export const STAGES = [']
for sid in ['s1','s2','s3','s4','s5']:
    c = dict(config[sid]); c['id'] = sid
    c['map'] = [''.join(r) for r in stages[sid]]
    c['npcs'] = [dict(type=t, path=[list(p) for p in path], mode=m) for t, path, m in npcs[sid]]
    out.append('  ' + json.dumps(c, ensure_ascii=False, indent=2).replace('\n', '\n  ') + ',')
out.append('];\n')
open('src/stages.js', 'w').write('\n'.join(out))
