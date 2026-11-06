"""Stage D. Isometric night render: water, land, glowing roads, glass buildings, soft shadows, bloom, fading edges."""
from PIL import Image, ImageDraw, ImageFilter, ImageChops
import numpy as np, math, json, random, sys

from pathlib import Path
OUT = str(Path(__file__).resolve().parents[1]) + '/'
W0 = OUT
city = json.load(open(OUT + 'city.json'))
roads = json.load(open(OUT + 'roads.json'))
Wd, Hd = roads['size']
roads = roads['roads']
land = np.asarray(Image.open(OUT + 'land.png')) > 128
g = math.radians(city['g'])
CX, CY = city['center']
boxes, trees = city['boxes'], city['trees']
for b in boxes:
    b[4] = b[4] ** 1.25     # towers stretch, houses stay low: streets stay visible
rnd = random.Random(5)

FW, FH = 2400, 1200          # final frame
SS = 2
CW, CH = FW * SS, FH * SS
K = 0.80                     # source px -> final px along a grid axis
KK = 1.0 * SS
HZ = 6.5 * SS                # px per height unit
cu, cv = city['core']
ox = CW / 2 - (cu - cv) * KK
oy = CH * .54 - (cu + cv) * KK / 2


def to_f(x, y):
    dx, dy = x - CX, y - CY
    return dx * math.cos(g) + dy * math.sin(g), -dx * math.sin(g) + dy * math.cos(g)


def P(X, Y, h=0.0):
    return (ox + (X - Y) * KK, oy + (X + Y) * KK / 2 - h * HZ)


# ---------- ground in the source frame ----------
S = 2
BG = np.array((7, 11, 20), dtype=float)
sh, sw = Hd * S, Wd * S
land2 = np.asarray(Image.fromarray((land * 255).astype(np.uint8)).resize((sw, sh), Image.BICUBIC).filter(ImageFilter.GaussianBlur(2.2))).astype(float) / 255
yy, xx = np.mgrid[0:sh, 0:sw].astype(np.float32)
noise = (np.sin(xx * .013 + 1) * np.cos(yy * .011) + .6 * np.sin((xx + yy) * .0071) + .4 * np.sin(xx * .031) * np.sin(yy * .027))
landc = np.array((15, 44, 32), dtype=np.float32)[None, None, :] * (1 + .22 * noise[:, :, None])
waterc = np.array((10, 42, 96), dtype=np.float32)[None, None, :] * (1 + .035 * np.sin(yy * .05 + noise * 2)[:, :, None] + .05 * noise[:, :, None])
lm = np.clip((land2 - .5) * 6 + .5, 0, 1)[:, :, None]
ground = landc * lm + waterc * (1 - lm)
shore = np.exp(-((land2 - .5) / .16) ** 2)[:, :, None]
ground = ground + shore * np.array((26, 66, 88), dtype=np.float32) * .55

# roads as vectors at high resolution
WIDTH = {'avenue': 12, 'collector': 7, 'street': 3.5}
COL = {'avenue': (255, 186, 74), 'collector': (244, 160, 58), 'street': (214, 146, 58)}
CORE = {'avenue': (255, 232, 170), 'collector': (255, 206, 120), 'street': None}
rd = Image.new('RGB', (sw, sh), (0, 0, 0))
rm = Image.new('L', (sw, sh), 0)
d = ImageDraw.Draw(rd)
dm = ImageDraw.Draw(rm)
order = sorted(roads, key=lambda r: WIDTH[r['class']])
for r in order:
    w = WIDTH[r['class']] * S
    pts = [(x * S, y * S) for x, y in r['points']]
    d.line(pts, fill=COL[r['class']], width=int(w), joint='curve')
    dm.line(pts, fill=255, width=int(w), joint='curve')
    for x, y in (pts[0], pts[-1]):
        d.ellipse([x - w / 2, y - w / 2, x + w / 2, y + w / 2], fill=COL[r['class']])
        dm.ellipse([x - w / 2, y - w / 2, x + w / 2, y + w / 2], fill=255)
for r in order:
    if CORE[r['class']]:
        d.line([(x * S, y * S) for x, y in r['points']], fill=CORE[r['class']], width=max(2, int(WIDTH[r['class']] * S * .3)), joint='curve')
rda = np.asarray(rd).astype(np.float32)
rma = np.asarray(rm).astype(np.float32)[:, :, None] / 255
ground = ground * (1 - rma) + rda * rma

# detail and light fall away towards the frame of the map
edge = np.minimum.reduce([xx, sw - xx, yy, sh - yy]) / S
fade = np.clip(edge / 210, 0, 1) ** 1.0
fade = (fade * fade * (3 - 2 * fade))[:, :, None]
ground = BG + (ground - BG) * fade
gi = Image.fromarray(np.clip(ground, 0, 255).astype(np.uint8))
emi_g = Image.fromarray(np.clip(rda * rma * fade, 0, 255).astype(np.uint8))

# source -> canvas affine, inverted for PIL
ca, sa = math.cos(g), math.sin(g)
# canvas = ox + (X - Y) KK ; X = dx ca + dy sa ; Y = -dx sa + dy ca
a11, a12 = (ca + sa) * KK, (sa - ca) * KK
a21, a22 = (ca - sa) * KK / 2, (sa + ca) * KK / 2
det = a11 * a22 - a12 * a21
i11, i12, i21, i22 = a22 / det, -a12 / det, -a21 / det, a11 / det


def to_canvas(im, fill):
    # output (u, v) -> source*S
    c0 = -(i11 * ox + i12 * oy)
    c1 = -(i21 * ox + i22 * oy)
    co = (i11 * S, i12 * S, (c0 + CX) * S, i21 * S, i22 * S, (c1 + CY) * S)
    return im.transform((CW, CH), Image.AFFINE, co, resample=Image.BICUBIC, fillcolor=fill)


base = to_canvas(gi, tuple(int(v) for v in BG))
emis = to_canvas(emi_g, (0, 0, 0))
street_glow = emis.resize((CW // 4, CH // 4), Image.BILINEAR).filter(ImageFilter.GaussianBlur(5))

# ---------- painter order for axis-aligned boxes ----------
boxes.sort(key=lambda b: (b[2] + b[3], b[0] + b[1]))
nb = len(boxes)
after = [[] for _ in range(nb)]
indeg = [0] * nb
E = 1e-6


def behind(A, B):
    return (A[2] <= B[0] + E and A[1] < B[3] - E and A[3] > B[1] + E) or (A[3] <= B[1] + E and A[0] < B[2] - E and A[2] > B[0] + E)


for p in range(nb):
    A = boxes[p]
    for q in range(p + 1, nb):
        B = boxes[q]
        if B[0] + B[1] > A[2] + A[3] + 90:
            pass
        if behind(A, B):
            after[p].append(q)
            indeg[q] += 1
        elif behind(B, A):
            after[q].append(p)
            indeg[p] += 1
ready = [i for i in range(nb) if indeg[i] == 0]
seq = []
while ready:
    ready.sort(key=lambda t: -(boxes[t][2] + boxes[t][3]))
    t = ready.pop()
    seq.append(t)
    for u in after[t]:
        indeg[u] -= 1
        if indeg[u] == 0:
            ready.append(u)
if len(seq) < nb:
    s_ = set(seq)
    seq += [i for i in range(nb) if i not in s_]
print('painter order', len(seq), 'of', nb)

# ---------- soft cast shadows and light pools on the ground ----------
shd = Image.new('L', (CW, CH), 0)
sd = ImageDraw.Draw(shd)
pool = Image.new('L', (CW, CH), 0)
pd = ImageDraw.Draw(pool)
amber = Image.new('L', (CW, CH), 0)
ad = ImageDraw.Draw(amber)
for b in boxes:
    x0, y0, x1, y1, h, c = b
    q = [P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1)]
    L = h * HZ * .55
    off = (L * .9, L * .28)
    cast = q + [(a + off[0], b_ + off[1]) for a, b_ in q]
    # convex hull of two footprints: draw the swept quads
    for i in range(4):
        a_, b2 = q[i], q[(i + 1) % 4]
        sd.polygon([a_, b2, (b2[0] + off[0], b2[1] + off[1]), (a_[0] + off[0], a_[1] + off[1])], fill=int(min(255, 120 + h * 10)))
    sd.polygon(q, fill=255)
    if c == 'land':
        ad.polygon(q, fill=255)
    elif h >= 5 or c == 'hero':
        pd.polygon(q, fill=int(min(255, 60 + h * 16)))
shd = shd.filter(ImageFilter.GaussianBlur(9 * SS))
pool = pool.filter(ImageFilter.GaussianBlur(20 * SS))
amber = amber.filter(ImageFilter.GaussianBlur(26 * SS))
ba = np.asarray(base).astype(np.float32)
ba *= (1 - .62 * np.asarray(shd).astype(np.float32) / 255)[:, :, None]
ba += (np.asarray(pool).astype(np.float32) / 255)[:, :, None] * np.array((30, 74, 170), dtype=np.float32) * .75
ba += (np.asarray(amber).astype(np.float32) / 255)[:, :, None] * np.array((200, 130, 40), dtype=np.float32) * .9
base = Image.fromarray(np.clip(ba, 0, 255).astype(np.uint8))

d = ImageDraw.Draw(base)
e = ImageDraw.Draw(emis)

# ---------- trees ----------
for t in trees:
    x, y = P(t[0], t[1])
    if not (0 <= x < CW and 0 <= y < CH):
        continue
    fx = _f = 1.0
    r = t[2] * SS * .85
    d.ellipse([x - r, y - r * .8, x + r, y + r * .8], fill=(10, 30, 22))
    d.ellipse([x - r * .8, y - r * 1.5, x + r * .8, y - r * .1], fill=(20, 66, 44))


def edge_fade(X, Y):
    x = CX + X * ca - Y * sa
    y = CY + X * sa + Y * ca
    m = min(x, Wd - x, y, Hd - y)
    m = max(0.0, min(1.0, m / 210))
    return m * m * (3 - 2 * m)


def mix(c, f):
    return tuple(int(BG[i] + (c[i] - BG[i]) * f) for i in range(3))


PAL = {  # left face, right face, roof, lit window
    'low': ((36, 52, 104), (25, 37, 78), (58, 80, 138), (255, 196, 120)),
    'mid': ((44, 86, 178), (30, 60, 132), (86, 136, 224), (200, 226, 255)),
    'high': ((70, 136, 236), (44, 96, 190), (170, 216, 255), (232, 244, 255)),
    'hero': ((130, 196, 255), (82, 146, 240), (236, 248, 255), (255, 255, 255)),
    'land': ((226, 158, 62), (168, 112, 40), (255, 214, 130), (255, 244, 200)),
}


def quad(dr, a, b, c, dd, col):
    dr.polygon([a, b, c, dd], fill=col)


def face(p0, p1, X0, Y0, X1, Y1, h, base_c, win_c, lit, f, floors, seed, emissive):
    """One vertical wall from (X0,Y0) to (X1,Y1), with a floor-by-floor window grid."""
    r = random.Random(seed)
    A, B = P(X0, Y0), P(X1, Y1)
    At, Bt = P(X0, Y0, h), P(X1, Y1, h)
    d.polygon([A, B, Bt, At], fill=mix(base_c, f))
    e.polygon([A, B, Bt, At], fill=(0, 0, 0))
    wlen = math.hypot(X1 - X0, Y1 - Y0)
    cols = max(1, int(wlen / 3.2))
    for i in range(floors):
        z0 = h * (i + .22) / floors
        z1 = h * (i + .78) / floors
        grad = 1.0 + .55 * (1 - i / max(1, floors)) ** 2       # brighter at the street, as in the target
        for j in range(cols):
            if r.random() > lit:
                continue
            t0, t1 = (j + .18) / cols, (j + .82) / cols
            a = (X0 + (X1 - X0) * t0, Y0 + (Y1 - Y0) * t0)
            b = (X0 + (X1 - X0) * t1, Y0 + (Y1 - Y0) * t1)
            q = [P(a[0], a[1], z0), P(b[0], b[1], z0), P(b[0], b[1], z1), P(a[0], a[1], z1)]
            wc = tuple(min(255, int(v * .8 * grad)) for v in win_c)
            d.polygon(q, fill=mix(wc, f))
            if emissive:
                e.polygon(q, fill=tuple(int(v * emissive * f) for v in win_c))


for t in seq:
    x0, y0, x1, y1, h, c = boxes[t]
    f = edge_fade((x0 + x1) / 2, (y0 + y1) / 2)
    if f < .02:
        continue
    k = c if c in ('hero', 'land') else ('low' if h < 3 else ('mid' if h < 8 else 'high'))
    left, right, roof, win = PAL[k]
    seed = int(x0 * 13 + y0 * 7)
    # load of this building (a real state later): how many windows burn
    lit = {'hero': .92, 'land': .9, 'high': .34 + (seed % 7) * .08, 'mid': .22 + (seed % 5) * .09, 'low': .10 + (seed % 4) * .06}[k]
    floors = max(1, int(h * .95))
    em = {'hero': 1.0, 'land': 1.0, 'high': .40, 'mid': .24, 'low': .14}[k]
    # visible walls: y1 side (faces left-down) and x1 side (faces right-down)
    face(None, None, x0, y1, x1, y1, h, left, win, lit, f, floors, seed, em)
    face(None, None, x1, y1, x1, y0, h, right, win, lit * .8, f, floors, seed + 1, em * .75)
    top = [P(x0, y0, h), P(x1, y0, h), P(x1, y1, h), P(x0, y1, h)]
    d.polygon(top, fill=mix(roof, f))
    e.polygon(top, fill=tuple(int(v * {'hero': .8, 'land': .8, 'high': .30, 'mid': .12, 'low': .03}[k] * f) for v in roof))
    # light line on the corner and along the roof edge
    ec = tuple(min(255, v + 46) for v in roof)
    d.line([P(x1, y1), P(x1, y1, h)], fill=mix(ec, f), width=SS)
    d.line(top + [top[0]], fill=mix(ec, f), width=SS if k != 'low' else 1)
    if k in ('hero', 'land'):
        e.line([P(x1, y1), P(x1, y1, h)], fill=(255, 255, 255) if k == 'hero' else (255, 220, 150), width=2 * SS)
        e.line(top + [top[0]], fill=(255, 255, 255) if k == 'hero' else (255, 220, 150), width=2 * SS)

# ---------- bloom ----------
small = emis.resize((CW // 4, CH // 4), Image.BILINEAR)
acc = np.zeros((CH // 4, CW // 4, 3), dtype=np.float32)
for rad, wgt in ((2.5, .55), (8, .4), (24, .34)):
    acc += np.asarray(small.filter(ImageFilter.GaussianBlur(rad))).astype(np.float32) * wgt
acc += np.asarray(street_glow).astype(np.float32) * .55   # light of the streets rises between the buildings
bloom = Image.fromarray(np.clip(acc, 0, 255).astype(np.uint8)).resize((CW, CH), Image.BICUBIC)
out = 255 - (255 - np.asarray(base).astype(np.float32)) * (255 - np.asarray(bloom).astype(np.float32)) / 255
img = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).resize((FW, FH), Image.LANCZOS)
# frame vignette
vy, vx = np.mgrid[0:FH, 0:FW].astype(np.float32)
r = np.hypot((vx - FW / 2) / (FW * .62), (vy - FH * .52) / (FH * .62))
v = np.clip(1.08 - r ** 3 * .55, .35, 1)[:, :, None]
fin = np.asarray(img).astype(np.float32) * v
Image.fromarray(np.clip(fin, 0, 255).astype(np.uint8)).save(sys.argv[1])
print('saved', sys.argv[1])
