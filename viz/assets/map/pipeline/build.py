"""Stage B+C. Water/land masks, city blocks between the roads, lots and heights by zoning rules."""
from PIL import Image, ImageDraw, ImageFilter
import numpy as np, math, json, random
from collections import deque

from pathlib import Path
OUT = str(Path(__file__).resolve().parents[1]) + '/'
W0 = OUT
rnd = random.Random(11)
src = Image.open(W0 + 'refs/owner-src.webp').convert('RGB')
Wd, Hd = src.size
roads = json.load(open(OUT + 'roads.json'))['roads']
WIDTH = {'avenue': 12, 'collector': 7, 'street': 3.5}


def gauss(m, s):
    im = Image.fromarray((np.clip(m, 0, 1) * 255).astype(np.uint8))
    return np.asarray(im.filter(ImageFilter.GaussianBlur(s))).astype(float) / 255


a = np.asarray(src).astype(float)
lum = a.mean(axis=2)
rb = a[:, :, 0] - a[:, :, 2]

# ---- water: the cream areas. Shadows of towers falling on the water are thin spikes: opening removes them
water0 = gauss(lum > 197, 1.5) > .5
land0 = ~water0
er = gauss(land0, 11) > .93
op = (gauss(er, 12) > .12) & land0
water = ~op
water = gauss(water, 2.5) > .5
# drop specks of water inside land and islets of land smaller than a block
def components(m, minsize):
    s2 = m[::2, ::2]
    h, w = s2.shape
    lab = np.zeros((h, w), dtype=np.int32)
    keep = np.zeros_like(s2)
    cur = 0
    for y in range(h):
        row = s2[y]
        for x in np.nonzero(row)[0]:
            if lab[y, x]:
                continue
            cur += 1
            q = deque([(y, int(x))])
            lab[y, x] = cur
            cells = []
            while q:
                cy, cx = q.popleft()
                cells.append((cy, cx))
                for ny, nx in ((cy + 1, cx), (cy - 1, cx), (cy, cx + 1), (cy, cx - 1)):
                    if 0 <= ny < h and 0 <= nx < w and s2[ny, nx] and not lab[ny, nx]:
                        lab[ny, nx] = cur
                        q.append((ny, nx))
            if len(cells) >= minsize:
                ys_, xs_ = zip(*cells)
                keep[list(ys_), list(xs_)] = True
    return np.kron(keep, np.ones((2, 2), dtype=bool))[:m.shape[0], :m.shape[1]]


water = components(water, 700)
land = components(~water, 500)
water = ~land
print('water share', round(float(water.mean()), 3))

# ---- grid orientation straight from the road segments
z = 0j
for r in roads:
    p = r['points']
    for i in range(len(p) - 1):
        dx, dy = p[i + 1][0] - p[i][0], p[i + 1][1] - p[i][1]
        L = math.hypot(dx, dy)
        z += L * np.exp(4j * math.atan2(dy, dx))
g = math.degrees(np.angle(z)) / 4 % 90
print('grid direction', round(g, 1))
G = math.radians(g)
CX, CY = Wd / 2, Hd / 2


def to_f(x, y):
    dx, dy = x - CX, y - CY
    return dx * math.cos(G) + dy * math.sin(G), -dx * math.sin(G) + dy * math.cos(G)


def from_f(X, Y):
    return CX + X * math.cos(G) - Y * math.sin(G), CY + X * math.sin(G) + Y * math.cos(G)


cs = [to_f(0, 0), to_f(Wd, 0), to_f(0, Hd), to_f(Wd, Hd)]
X0, X1 = min(c[0] for c in cs), max(c[0] for c in cs)
Y0, Y1 = min(c[1] for c in cs), max(c[1] for c in cs)
Fw, Fh = int(X1 - X0) + 2, int(Y1 - Y0) + 2


def warp(im, fill=0):
    # output pixel (u, v) in the grid frame -> source pixel
    ca, sa = math.cos(G), math.sin(G)
    c = CX + X0 * ca - Y0 * sa
    f = CY + X0 * sa + Y0 * ca
    return im.transform((Fw, Fh), Image.AFFINE, (ca, -sa, c, sa, ca, f), resample=Image.BILINEAR, fillcolor=fill)


def rast(width_add):
    im = Image.new('L', (Wd, Hd), 0)
    d = ImageDraw.Draw(im)
    for r in roads:
        w = WIDTH[r['class']] + width_add
        pts = [tuple(p) for p in r['points']]
        d.line(pts, fill=255, width=max(1, int(round(w))), joint='curve')
        for x, y in (pts[0], pts[-1]):
            d.ellipse([x - w / 2, y - w / 2, x + w / 2, y + w / 2], fill=255)
    return im


# ---- fields in the grid frame
shadow = ((lum <= 84) | ((lum < 150) & (rb >= 11))) & land
asph = (lum > 84) & (lum < 118) & (rb < 11)
detail = np.abs(lum - np.asarray(Image.fromarray(lum.astype(np.uint8)).filter(ImageFilter.GaussianBlur(3))).astype(float)) > 9
built_raw = (shadow | (detail & ~asph)) & land
dens_s = gauss(built_raw, 11)
tall_s = gauss(shadow.astype(float), 38)


def F(m):
    return np.asarray(warp(Image.fromarray((np.clip(m, 0, 1) * 255).astype(np.uint8)))).astype(float) / 255


valid = F(np.ones((Hd, Wd))) > .9
landF = (F(land.astype(float)) > .5) & valid
densF = F(dens_s / max(dens_s.max(), 1e-6))
tallF = F(tall_s / max(tall_s.max(), 1e-6))
clear = np.asarray(warp(rast(8))) > 110
free = landF & ~clear

# edge of the picture: details thin out long before the frame ends
xx, yy = np.meshgrid(np.arange(Wd), np.arange(Hd))
edge = np.minimum.reduce([xx, Wd - xx, yy, Hd - yy]).astype(float)
edgeF = F(np.clip(edge / 150, 0, 1))

# centre of the city = weighted centre of the tall field
wgt = tallF ** 3
cu, cv = (wgt * np.arange(Fw)[None, :]).sum() / wgt.sum(), (wgt * np.arange(Fh)[:, None]).sum() / wgt.sum()
print('core (grid frame)', int(cu), int(cv), 'source', [int(v) for v in from_f(cu + X0, cv + Y0)])

# ---- blocks = connected free land between roads
S = 2
fs = free[::S, ::S]
h, w = fs.shape
lab = np.zeros((h, w), dtype=np.int32)
blocks = []
cur = 0
for y in range(h):
    for x in np.nonzero(fs[y])[0]:
        if lab[y, x]:
            continue
        cur += 1
        q = deque([(y, int(x))])
        lab[y, x] = cur
        n = 0
        x0 = x1 = int(x)
        y0 = y1 = y
        while q:
            cy, cx_ = q.popleft()
            n += 1
            x0, x1, y0, y1 = min(x0, cx_), max(x1, cx_), min(y0, cy), max(y1, cy)
            for ny, nx in ((cy + 1, cx_), (cy - 1, cx_), (cy, cx_ + 1), (cy, cx_ - 1)):
                if 0 <= ny < h and 0 <= nx < w and fs[ny, nx] and not lab[ny, nx]:
                    lab[ny, nx] = cur
                    q.append((ny, nx))
        if n >= 60:
            blocks.append((cur, n, x0 * S, y0 * S, (x1 + 1) * S, (y1 + 1) * S))
print('blocks', len(blocks))
ii = np.pad(free.astype(np.int64).cumsum(0).cumsum(1), ((1, 0), (1, 0)))


def cover(x0, y0, x1, y1):
    x0, y0, x1, y1 = int(x0), int(y0), int(x1), int(y1)
    x1, y1 = min(x1, Fw), min(y1, Fh)
    if x1 <= x0 or y1 <= y0:
        return 0
    return (ii[y1, x1] - ii[y0, x1] - ii[y1, x0] + ii[y0, x0]) / ((x1 - x0) * (y1 - y0))


def zone_h(x, y):
    """Height of the zone: main peak, district sub-centres from real tall areas, soft fall to the edge."""
    d = math.hypot(x - cu, y - cv)
    peak = 8.5 * math.exp(-(d / 170) ** 2)
    sub = 3.6 * float(tallF[min(Fh - 1, int(y)), min(Fw - 1, int(x))]) ** 1.8
    return 1.3 + peak + sub


def split(x0, y0, x1, y1, out, depth=0):
    w_, h_ = x1 - x0, y1 - y0
    H0 = zone_h((x0 + x1) / 2, (y0 + y1) / 2)
    t = 25 if H0 > 8 else (23 if H0 > 4.5 else 14)
    long_, short = max(w_, h_), min(w_, h_)
    slab = H0 < 8 and short <= t * .62 and long_ <= t * 3.2 and rnd.random() < .6   # long buildings stay long
    if (long_ <= t * rnd.uniform(.85, 1.45) or slab or depth > 18):
        out.append((x0, y0, x1, y1))
        return
    r = rnd.uniform(.36, .64)
    if w_ >= h_:
        m = x0 + w_ * r
        split(x0, y0, m, y1, out, depth + 1)
        split(m, y0, x1, y1, out, depth + 1)
    else:
        m = y0 + h_ * r
        split(x0, y0, x1, m, out, depth + 1)
        split(x0, m, x1, y1, out, depth + 1)


def sample(H0):
    z_ = min(1.0, H0 / 15)
    u = rnd.random()
    if u < .05 + .17 * z_ and H0 > 3.4:            # small building in a tall zone: rare, but it exists
        return rnd.uniform(1.0, 2.8)
    if u > 1 - .05 * (1 - z_) ** 2 and H0 < 4.5:   # lone tall building in a low zone: rarer
        return min(10.0, H0 * rnd.uniform(2.1, 3.2))
    if H0 > 6:
        return H0 * rnd.choice([.45, .6, .75, .9, 1.05, 1.2, 1.4, 1.6])
    return H0 * rnd.uniform(.72, 1.28)


boxes = []
occ = {}
CELL = 14


def neighbours(x0, y0, x1, y1):
    out = set()
    for gx in range(int(x0 - 6) // CELL, int(x1 + 6) // CELL + 1):
        for gy in range(int(y0 - 6) // CELL, int(y1 + 6) // CELL + 1):
            out |= set(occ.get((gx, gy), ()))
    return [boxes[i][4] for i in out]


for (lid, n, x0, y0, x1, y1) in sorted(blocks, key=lambda b: (b[2], b[3])):
    leaves = []
    split(x0, y0, x1, y1, leaves)
    for (a0, b0, a1, b1) in leaves:
        # shrink the lot until it sits fully on free land
        ok = None
        for ins in (1.5, 3, 5, 8):
            c0, d0, c1, d1 = a0 + ins, b0 + ins, a1 - ins, b1 - ins
            if c1 - c0 < 5 or d1 - d0 < 5:
                break
            if cover(c0, d0, c1, d1) > .985:
                ok = (c0, d0, c1, d1)
                break
        if ok is None:
            continue
        c0, d0, c1, d1 = ok
        mx, my = int((c0 + c1) / 2), int((d0 + d1) / 2)
        dn = float(densF[my, mx])
        ef = float(edgeF[my, mx])
        H0 = zone_h(mx, my)
        keep = min(1.0, max(0.0, (dn - .10) / .22)) * ef ** 1.2
        if H0 > 5:
            keep = max(keep, .74 * ef)
        if rnd.random() > keep:
            continue
        h_ = sample(H0)
        if H0 > 4.5:
            nbs = neighbours(c0, d0, c1, d1)
            for _ in range(16):
                if all(abs(h_ - v) >= max(1.3, .16 * h_) for v in nbs):
                    break
                h_ = sample(H0)
        area = (c1 - c0) * (d1 - d0)
        ratio = max(c1 - c0, d1 - d0) / max(1, min(c1 - c0, d1 - d0))
        if ratio > 2.2:
            h_ = min(h_, 4.5)                         # long slabs do not become towers
        if area < 140 and h_ > 9:
            h_ *= .7
        h_ = min(h_, 12.0)
        h_ *= .55 + .45 * ef
        h_ = max(.8, round(h_ * 4) / 4)
        i = len(boxes)
        boxes.append([c0, d0, c1, d1, h_, 'b'])
        for gx in range(int(c0) // CELL, int(c1) // CELL + 1):
            for gy in range(int(d0) // CELL, int(d1) // CELL + 1):
                occ.setdefault((gx, gy), []).append(i)

# ---- key objects: one peak, two spires, three amber landmarks
def near(x, y, rad):
    return [b for b in boxes if math.hypot((b[0] + b[2]) / 2 - x, (b[1] + b[3]) / 2 - y) < rad]


big = sorted(near(cu, cv, 95), key=lambda b: -(b[2] - b[0]) * (b[3] - b[1]))
hero = big[0]
hero[4], hero[5] = 27.0, 'hero'
hx, hy = (hero[0] + hero[2]) / 2, (hero[1] + hero[3]) / 2
for b in boxes:
    if b is hero:
        continue
    bx, by = (b[0] + b[2]) / 2, (b[1] + b[3]) / 2
    front = ((bx - hx) + (by - hy)) / 2
    lateral = abs((bx - hx) - (by - hy)) / 2
    if 0 < front < 190 and lateral < 62:       # view corridor: the street front of the peak stays lower
        b[4] = min(b[4], 3.0 + front * .03)
sp = sorted(near(cu, cv, 170), key=lambda b: -b[4])
sp = [b for b in sp if b is not hero and min(abs(b[0] - hero[2]), abs(hero[0] - b[2]), 999) < 90][:2]
for j, b in enumerate(sp):
    b[4], b[5] = 22.0 - 3 * j, 'hero'
cand = [b for b in boxes if b[5] == 'b' and 240 < math.hypot((b[0] + b[2]) / 2 - cu, (b[1] + b[3]) / 2 - cv) < 560 and (b[2] - b[0]) * (b[3] - b[1]) > 260]
cand.sort(key=lambda b: -b[4])
marks = []
for b in cand:
    bx, by = (b[0] + b[2]) / 2, (b[1] + b[3]) / 2
    if all(math.hypot(bx - m[0], by - m[1]) > 330 for m in marks):
        marks.append((bx, by))
        b[4], b[5] = 11.0, 'land'
    if len(marks) == 3:
        break

# ---- trees on free land without buildings
occg = np.zeros((Fh // 4 + 1, Fw // 4 + 1), dtype=bool)
for b in boxes:
    occg[int(b[1]) // 4:int(b[3]) // 4 + 1, int(b[0]) // 4:int(b[2]) // 4 + 1] = True
trees = []
for _ in range(90000):
    x, y = rnd.uniform(0, Fw - 1), rnd.uniform(0, Fh - 1)
    if not free[int(y), int(x)] or occg[int(y) // 4, int(x) // 4]:
        continue
    n_ = math.sin(x * .021 + 1) * math.cos(y * .017) + .6 * math.sin((x + y) * .011 + 2) + .5 * math.sin(x * .05) * math.sin(y * .043)
    if n_ < .1 and rnd.random() > .08:
        continue
    trees.append([round(x, 1), round(y, 1), round(rnd.uniform(1.6, 3.2), 1)])

for b in boxes:
    b[:4] = [round(b[0] + X0, 2), round(b[1] + Y0, 2), round(b[2] + X0, 2), round(b[3] + Y0, 2)]
trees = [[t[0] + X0, t[1] + Y0, t[2]] for t in trees]
Image.fromarray((land * 255).astype(np.uint8)).save(OUT + 'land.png')
json.dump({'g': g, 'center': [CX, CY], 'core': [cu + X0, cv + Y0], 'boxes': boxes, 'trees': trees}, open(OUT + 'city.json', 'w'))

# plan in the source frame, to compare with the owner's render
P = Image.new('RGB', (Wd, Hd), (10, 40, 84))
pa = np.asarray(P).copy()
pa[land] = (18, 44, 34)
P = Image.fromarray(pa)
d = ImageDraw.Draw(P)
for t in trees[::2]:
    x, y = from_f(t[0], t[1])
    d.ellipse([x - 1.5, y - 1.5, x + 1.5, y + 1.5], fill=(28, 74, 50))
CC = {'avenue': (255, 200, 90), 'collector': (240, 165, 60), 'street': (205, 140, 54)}
for r in sorted(roads, key=lambda r: WIDTH[r['class']]):
    d.line([tuple(p) for p in r['points']], fill=CC[r['class']], width=int(round(WIDTH[r['class']])), joint='curve')
for b in boxes:
    h_ = b[4]
    col = (250, 190, 90) if b[5] == 'land' else ((235, 248, 255) if b[5] == 'hero' else ((60, 84, 150) if h_ < 3 else ((72, 126, 230) if h_ < 8 else (165, 222, 255))))
    d.polygon([from_f(b[0], b[1]), from_f(b[2], b[1]), from_f(b[2], b[3]), from_f(b[0], b[3])], fill=col)
P.save(OUT + 'plan.png')
hs = [b[4] for b in boxes]
print('buildings', len(boxes), 'trees', len(trees), 'low/mid/high', sum(h < 3 for h in hs), sum(3 <= h < 8 for h in hs), sum(h >= 8 for h in hs), 'landmarks', len(marks))
