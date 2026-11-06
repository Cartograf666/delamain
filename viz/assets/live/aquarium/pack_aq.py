"""Aquarium pack: idle base, one light layer per district, building cut-out, pads, roads, flyer sprites, real events (time and district only)."""
from PIL import Image, ImageFilter
import numpy as np, json, glob, math, os, datetime as D, collections

M = './work/city/mock/'
SP = glob.glob('/private/tmp/claude-501/*/64d3ecf1-797a-434b-82f4-56e55d9060dc/scratchpad')[0]
OUT = SP + '/aq/'
os.makedirs(OUT + 'art', exist_ok=True)
meta = json.load(open(M + 'aq-idle.json'))
full = json.load(open(M + 'aq-full.json'))
FW, FH = meta['frame']
W, H = 3600, 1800
sc = FW / W
TOP, CH = 80, 1560
idle = np.asarray(Image.open(M + 'aq-idle-hi.png').convert('RGB')).astype(np.float32)
neon = np.asarray(Image.open(M + 'aq-full-hi.png').convert('RGB')).astype(np.float32)
ids = np.asarray(Image.open(M + 'aq-idle-ids.png').resize((W, H), Image.NEAREST)).astype(np.int32)
kid = np.asarray(Image.open(M + 'aq-full-kid.png')).astype(np.int32)
seeds = meta['seeds']
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
fx, fy = xx * sc, yy * sc
a_, b_ = fx - meta['ox'], 2 * (fy - meta['oy'])
X, Y = (a_ + b_) / 2, (b_ - a_) / 2
ground = np.stack([(X - s[0]) ** 2 + (Y - s[1]) ** 2 for s in seeds]).argmin(axis=0) + 1
diff = np.clip(neon - idle, 0, 255)
Image.fromarray(idle[TOP:TOP + CH].astype(np.uint8)).save(OUT + 'art/idle.jpg', quality=84)
top = Image.fromarray(idle.astype(np.uint8)).convert('RGBA')
top.putalpha(Image.fromarray(((ids > 0) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1)))
top.crop((0, TOP, W, TOP + CH)).save(OUT + 'art/top.webp', quality=84)
for i in range(len(seeds)):
    mb = (ids == i + 1).astype(np.float32)
    mg = np.asarray(Image.fromarray(((ground == i + 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(60))).astype(np.float32) / 255
    w_ = np.where(ids > 0, mb, mg) * (kid == 0)
    Image.fromarray((diff * w_[:, :, None])[TOP:TOP + CH].astype(np.uint8)).save(OUT + f'art/l{i}.jpg', quality=76)


sc, TOP, W, CH = FW / 1800, 40, 1800, 780


for j in range(1, full['keys'] + 1):
    w_ = np.asarray(Image.fromarray(((kid == j) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1))).astype(np.float32) / 255
    Image.fromarray((diff * w_[:, :, None])[TOP * 2:TOP * 2 + CH * 2].astype(np.uint8)).save(OUT + f'art/k{j - 1}.jpg', quality=78)


def px(p):
    return [round(p[0] / sc, 1), round(p[1] / sc - TOP, 1)]


pads = [{'p': px(q[:2]), 'g': px(q[5]), 'd': q[2], 'k': q[3], 'h': q[4], 'kid': q[6]} for q in meta['pads']]
ants = [px(q[:2]) + [q[2]] for q in meta['ants']]

G, (CX, CY) = math.radians(meta['g']), meta['center']


def scr(x, y):
    dx, dy = x - CX, y - CY
    X_, Y_ = dx * math.cos(G) + dy * math.sin(G), -dx * math.sin(G) + dy * math.cos(G)
    return px((meta['ox'] + (X_ - Y_), meta['oy'] + (X_ + Y_) / 2))


rj = json.load(open(M + '../roads.json'))['roads']
CL = {'avenue': 0, 'collector': 1, 'street': 2}
roads = [{'c': CL[r['class']], 'p': [scr(*q) for q in r['points']]} for r in rj if r['class'] != 'street']

# real journal lines, district by the page's own rule: named home, else next free district, then round robin
HOME = {'claude-agent-hub': 'CORE', 'santinel': 'FOUNDRY', 'dolya': 'DOCKS', 'project-estimator': 'SPRAWL', 'personal-fin-assistant': 'HEIGHTS', 'raft-ceo-workspace': 'BAZAAR'}
SPARE = ['BAZAAR', 'SPRAWL', 'HEIGHTS', 'SMELTER', 'RIVIERA', 'DOCKS', 'FOUNDRY', 'CORE']
names = ['CORE', 'DOCKS', 'SPRAWL', 'FOUNDRY', 'RIVIERA', 'WASTES', 'BAZAAR', 'HEIGHTS', 'SMELTER']
L = sorted(json.load(open(SP + '/hist.json'))['lines'], key=lambda x: x['at'])
home, ev, cnt = {}, [], collections.Counter()
for x in L:
    if x['tag'] in ('pace', 'watchdog'):
        continue
    r = x.get('repo') or x['stage']
    if r not in home:
        free = [n for n in SPARE if n not in home.values()]
        home[r] = HOME[r] if r in HOME and HOME[r] not in home.values() else (free[0] if free else SPARE[len(home) % 8])
    d_ = names.index(home[r])
    ev.append([int(D.datetime.fromisoformat(x['at'].replace('Z', '+00:00')).timestamp()), d_])
    cnt[home[r]] += 1
print('events', len(ev), cnt.most_common(), 'repos', len(home))

FS = './viz/assets/'
for n in ('sport', 'van', 'limo', 'bike', 'police', ''):
    Image.open(FS + ('flyer-' + n if n else 'flyer') + '.png').convert('RGBA').resize((192, 192), Image.LANCZOS).save(OUT + f"art/f-{n or 'car'}.png")
Image.open(FS + 'holo.png').convert('RGBA').resize((320, 320), Image.LANCZOS).save(OUT + 'art/holo.png')
A2 = './viz/assets/art2/'
for n in ('ad-wide-split', 'ad-wide-bars', 'ad-wide-circle', 'ad-wide-wave', 'ad-tall-circle', 'ad-tall-split', 'ad-tall-chevrons', 'ad-tall-disc-block', 'koi-hologram', 'small-boat', 'container-ship'):
    Image.open(A2 + n + '.png').convert('RGBA').save(OUT + f'art/{n}.png')
TINT = [(20, 225, 255), (20, 240, 190), (255, 70, 150), (255, 120, 30), (130, 70, 255), (255, 170, 80), (255, 36, 200), (20, 225, 255), (255, 36, 70)]
# boats: routes through open water, breadth first on a coarse mask
from collections import deque
import random as _r
wm = np.asarray(Image.open(M + 'aq-idle-water.png')).astype(np.float32) / 255
wm = np.asarray(Image.fromarray((wm * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(7))) > 170
cell = 6
gh, gw = wm.shape[0] // cell, wm.shape[1] // cell
gmsk = wm[:gh * cell, :gw * cell].reshape(gh, cell, gw, cell).mean(axis=(1, 3)) > .9
ys, xs = np.nonzero(gmsk)
cells = list(zip(ys.tolist(), xs.tolist()))
rr = _r.Random(8)


def bfs(a, b):
    prev = {a: None}
    q = deque([a])
    while q:
        c = q.popleft()
        if c == b:
            break
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1), (1, -1), (-1, 1)):
            n = (c[0] + dy, c[1] + dx)
            if 0 <= n[0] < gh and 0 <= n[1] < gw and gmsk[n] and n not in prev:
                prev[n] = c
                q.append(n)
    if b not in prev:
        return None
    out = []
    c = b
    while c:
        out.append(c)
        c = prev[c]
    return out[::-1]


boats = []
for _ in range(80):
    if len(boats) >= 5:
        break
    a, b = rr.choice(cells), rr.choice(cells)
    if math.hypot(a[0] - b[0], a[1] - b[1]) < 26:
        continue
    pth = bfs(a, b)
    if not pth or len(pth) < 24:
        continue
    pts = [px(((c[1] + .5) * cell * FW / 1200, (c[0] + .5) * cell * FH / 600)) for c in pth[::3]]
    for _s in range(2):
        pts = [pts[0]] + [[(pts[i - 1][0] + pts[i][0] * 2 + pts[i + 1][0]) / 4, (pts[i - 1][1] + pts[i][1] * 2 + pts[i + 1][1]) / 4] for i in range(1, len(pts) - 1)] + [pts[-1]]
    boats.append([[round(x, 1), round(y, 1)] for x, y in pts])
print('boats', len(boats), [len(b) for b in boats])

# monorail: the longest avenue chain in the city
bys = collections.defaultdict(list)
for r in rj:
    if r['class'] == 'avenue':
        bys[r['street']].append([scr(*q) for q in r['points']])
ln = lambda p: sum(math.hypot(p[i + 1][0] - p[i][0], p[i + 1][1] - p[i][1]) for i in range(len(p) - 1))
best = []
for sid, ps in bys.items():
    ps = sorted(ps, key=ln, reverse=True)
    ch = ps.pop(0)
    moved = True
    while moved and ps:
        moved = False
        for q in list(ps):
            for a_, b_ in ((q, ch), (q[::-1], ch)):
                if math.hypot(a_[-1][0] - ch[0][0], a_[-1][1] - ch[0][1]) < 8:
                    ch = a_ + ch
                    ps.remove(q)
                    moved = True
                    break
                if math.hypot(a_[0][0] - ch[-1][0], a_[0][1] - ch[-1][1]) < 8:
                    ch = ch + a_
                    ps.remove(q)
                    moved = True
                    break
            if moved:
                break
    if ln(ch) > ln(best or [[0, 0], [0, 0]]):
        best = ch
rail = best[::3] + [best[-1]]
print('rail length', round(ln(rail)), len(rail))
signs = [px(q[:2]) + [q[2]] for q in full['signs']]
data = {'w': W, 'h': CH, 'names': names, 'tints': TINT, 'pads': pads, 'ants': ants, 'roads': roads, 'events': ev, 'boats': boats, 'signs': signs, 'ads': [[v for i in range(4) for v in px(w[i * 2:i * 2 + 2])] for w in meta['ads']], 'sq': px(meta['sq']), 'hero': px(meta['hero']), 'wins': [[v for i in range(4) for v in px(w[i * 2:i * 2 + 2])] for w in meta['wins']], 'keys': full['keys'], 'ownerKid': full['ownerKid']}
open(OUT + 'data.js', 'w').write('window.CITY=' + json.dumps(data, separators=(',', ':')) + ';')
print(len(pads), len(ants), sum(os.path.getsize(OUT + 'art/' + f) for f in os.listdir(OUT + 'art')) // 1024, 'KB', os.path.getsize(OUT + 'data.js') // 1024, 'KB data')
print(OUT)
