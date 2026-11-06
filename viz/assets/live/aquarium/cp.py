"""Cyberpunk look test: same city data, style from the owner's board. One material for all buildings, light comes from points."""
from PIL import Image, ImageDraw, ImageFilter
import numpy as np, math, json, random, sys, os
ACT = os.environ.get("ACT", "")

W0 = './work/'
OUT, MOCK = W0 + 'city/', W0 + 'city/mock/'
city = json.load(open(MOCK + 'city.json'))
rj = json.load(open(OUT + 'roads.json'))
Wd, Hd = rj['size']
roads = rj['roads']
land = np.asarray(Image.open(MOCK + 'land.png')) > 128
g = math.radians(city['g'])
CX, CY = city['center']
boxes, trees = city['boxes'], city['trees']
for b in boxes:
    b[4] = b[4] ** 1.25
ca, sa = math.cos(g), math.sin(g)
NOT = './viz/assets/notable/'
MODELS = json.load(open(NOT + 'manifest.json'))['models']
A2 = './viz/assets/art2/'
for v_ in json.load(open(A2 + 'manifest.json'))['objects']:
    n_ = v_['id']
    if v_['footprint'][0]:
        MODELS[n_] = {'art': True, 'base': n_ + '-base.png', 'emis': v_['emissive'], 'size': v_['size'], 'anchor': v_['anchor'], 'resolution': 2.0,
                      'footprint': [v_['footprint'][0] / 2, v_['footprint'][0] / 2], 'height': v_['size'][1] / 2 * 6.5 / 6.5}
# landmarks are built from the city's own parts: boxes, windows, neon edges. Listed far to near, outer tier first.
GRP = {
 'port': [(-28, -22, 28, -10, 2.2, 'warm'), (-28, -6, 28, 6, 2.2, 'band'), (20, 10, 28, 18, 9, 'band'), (-28, 10, -16, 16, 1.2, 'field'), (-13, 10, -1, 16, 1.8, 'field'), (2, 10, 14, 16, 1.2, 'field')],
 'mall': [(-28, -20, 28, 20, 2.6, 'band'), (-20, -14, 20, 14, 5, 'warm'), (-10, -8, 10, 8, 7.5, 'band')],
 'plant': [(-26, -24, -6, -4, 3, 'dark'), (-24, -22, -8, -6, 6, 'dark'), (-22, -20, -10, -8, 9, 'band'), (2, -24, 22, -4, 3, 'dark'), (4, -22, 20, -6, 6, 'dark'), (6, -20, 18, -8, 9, 'band'), (-26, 4, 26, 22, 3, 'warm')],
 'temple': [(-24, -24, 24, 24, 1.6, 'warm'), (-17, -17, 17, 17, 3.2, 'warm'), (-11, -11, 11, 11, 5, 'band'), (-5, -5, 5, 5, 8, 'cool')],
 'stadium': [(-32, -32, 32, -20, 2.8, 'cool'), (-32, -20, -20, 20, 2.8, 'cool'), (-20, -20, 20, 20, .2, 'pitch'), (20, -20, 32, 20, 2.8, 'cool'), (-32, 20, 32, 32, 2.8, 'cool')],
 'data': [(-26, -24, 26, -12, 3.4, 'band'), (-26, -7, 26, 5, 3.4, 'band'), (-26, 10, 26, 22, 3.4, 'band')],
 'furnace': [(-24, -18, 24, 18, 3.4, 'warm'), (-15, -10, -8, -3, 13, 'band'), (-3, -10, 4, -3, 15, 'band'), (9, -10, 16, -3, 11, 'band')],
}
for n_, g_ in GRP.items():
    MODELS['grp-' + n_] = {'grp': n_, 'footprint': [max(abs(q[0]) for q in g_) * 2 + 2, max(abs(q[1]) for q in g_) * 2 + 2 + 0], 'height': max(q[4] for q in g_) * 6.5 * 1.5}
NSRC = [(470, 560, 'grp-port'), (930, 830, 'grp-mall'), (700, 80, 'grp-plant'), (700, 400, 'grp-temple'), (520, 810, 'spire'), (1450, 300, 'grp-stadium'), (1500, 560, 'grp-data'), (1500, 950, 'grp-furnace'),
        (1180, 420, 'landing-pad-cyan'), (860, 640, 'landing-pad-magenta'), (1290, 660, 'landing-pad-cyan'), (640, 500, 'landing-pad-magenta')]


def to_f(x, y):
    dx, dy = x - CX, y - CY
    return dx * ca + dy * sa, -dx * sa + dy * ca


RP = []
for r_ in roads:
    p_ = r_['points']
    for i_ in range(len(p_) - 1):
        n_ = max(1, int(math.hypot(p_[i_ + 1][0] - p_[i_][0], p_[i_ + 1][1] - p_[i_][1]) / 3))
        for k_ in range(n_):
            RP.append(to_f(p_[i_][0] + (p_[i_ + 1][0] - p_[i_][0]) * k_ / n_, p_[i_][1] + (p_[i_ + 1][1] - p_[i_][1]) * k_ / n_))
RPA = np.array(RP)


def clear(r, m=9):
    if ((RPA[:, 0] > r[0] - m) & (RPA[:, 0] < r[2] + m) & (RPA[:, 1] > r[1] - m) & (RPA[:, 1] < r[3] + m)).any():
        return False
    for ux, uy in ((r[0], r[1]), (r[2], r[1]), (r[0], r[3]), (r[2], r[3]), ((r[0] + r[2]) / 2, (r[1] + r[3]) / 2)):
        sx_, sy_ = CX + ux * ca - uy * sa, CY + ux * sa + uy * ca
        if not (0 <= int(sy_) < Hd and 0 <= int(sx_) < Wd and land[int(sy_), int(sx_)]):
            return False
    return True


taken = []
for sx, sy, name in NSRC:
    m = MODELS[name]
    X, Y = to_f(sx, sy)
    fw, fd = m['footprint']
    best = None
    for marg in (9, 5, 2):
        for ddx in range(-340, 341, 8):
            for ddy in range(-340, 341, 8):
                if best is not None and math.hypot(ddx, ddy) >= best[0]:
                    continue
                qx, qy = X + ddx, Y + ddy
                r = [qx - fw / 2, qy - fd / 2, qx + fw / 2, qy + fd / 2]
                if clear(r, marg) and all(r[2] < q_[0] - 6 or r[0] > q_[2] + 6 or r[3] < q_[1] - 6 or r[1] > q_[3] + 6 for q_ in taken):
                    best = (math.hypot(ddx, ddy), r)
        if best:
            break
    if not best:
        print('no place for', name)
        continue
    taken.append(best[1])
    print('placed', name, round(best[0]))
    r = best[1]
    boxes[:] = [b for b in boxes if b[5] in ('hero', 'land') or b[2] < r[0] - 2 or b[0] > r[2] + 2 or b[3] < r[1] - 2 or b[1] > r[3] + 2]
    boxes.append(r + [m['height'] / 6.5, 'n:' + name])

# plaza beside the centre: an open square, ad screens go on the facades around it
_o = max((b for b in boxes if b[5] == 'hero'), key=lambda b: b[4])
SQ = ((_o[0] + _o[2]) / 2 - 54, (_o[1] + _o[3]) / 2 + 85)
boxes[:] = [b for b in boxes if b[5] != 'b' or not (b[2] > SQ[0] - 24 and b[0] < SQ[0] + 24 and b[3] > SQ[1] - 24 and b[1] < SQ[1] + 24)]
FW, FH, SS = 2400, 1200, 2
CW, CH = FW * SS, FH * SS
KK, HZ = 1.0 * SS, 6.5 * SS
cu, cv = city['core']
ox = CW / 2 - (cu - cv) * KK
oy = CH * .54 - (cu + cv) * KK / 2


def P(X, Y, h=0.0):
    return (ox + (X - Y) * KK, oy + (X + Y) * KK / 2 - h * HZ)


MAG, CYA, VIO, ORG, RED, TEA, PNK, AMB = (255, 36, 200), (20, 225, 255), (130, 70, 255), (255, 120, 30), (255, 36, 70), (20, 240, 190), (255, 70, 150), (255, 170, 80)
SEEDS = [(cu, cv)] + [to_f(*s) for s in [(470, 560), (930, 830), (700, 80), (700, 400), (520, 810), (1450, 300), (1500, 560), (1500, 950)]]
# district: accents and how active it is in this frame (illustrative)
DS = [((CYA, MAG), 1.0), ((TEA, CYA), .7), ((PNK, MAG), .85), ((ORG, RED), .3), ((VIO, MAG), .75), ((ORG, AMB), .12), ((MAG, VIO), .95), ((CYA, VIO), .4), ((RED, ORG), .6)]


def dist_id(X, Y):
    return min(range(len(SEEDS)), key=lambda q: (SEEDS[q][0] - X) ** 2 + (SEEDS[q][1] - Y) ** 2)


# ---------- ground in the source frame ----------
S = 2
sw, sh = Wd * S, Hd * S
land2 = np.asarray(Image.fromarray((land * 255).astype(np.uint8)).resize((sw, sh), Image.BICUBIC).filter(ImageFilter.GaussianBlur(2))).astype(np.float32) / 255
yy, xx = np.mgrid[0:sh, 0:sw].astype(np.float32)
noise = np.sin(xx * .013 + 1) * np.cos(yy * .011) + .6 * np.sin((xx + yy) * .0071)
lm = np.clip((land2 - .5) * 6 + .5, 0, 1)[:, :, None]
landc = np.array((17, 17, 30), dtype=np.float32) * (1 + .12 * noise[:, :, None])
waterc = np.array((7, 20, 40), dtype=np.float32) * (1 + .15 * noise[:, :, None])
ground = landc * lm + waterc * (1 - lm)
shore = np.exp(-((land2 - .5) / .1) ** 2)[:, :, None]
ground = ground + shore * np.array((10, 34, 46), dtype=np.float32)
rd = Image.fromarray(np.clip(ground, 0, 255).astype(np.uint8))
em = Image.new('RGB', (sw, sh), (0, 0, 0))
d, de = ImageDraw.Draw(rd), ImageDraw.Draw(em)
RW = {'avenue': 9, 'collector': 6, 'street': 2.6}
for r in sorted(roads, key=lambda r: RW[r['class']]):
    pts = [(x * S, y * S) for x, y in r['points']]
    d.line(pts, fill={'avenue': (27, 25, 44), 'collector': (23, 22, 38), 'street': (21, 20, 34)}[r['class']], width=int(RW[r['class']] * S), joint='curve')


def offset(p, o):
    out = []
    for i, (x, y) in enumerate(p):
        a, b = p[max(0, i - 1)], p[min(len(p) - 1, i + 1)]
        tx, ty = b[0] - a[0], b[1] - a[1]
        L = math.hypot(tx, ty) or 1
        out.append(((x - ty / L * o) * S, (y + tx / L * o) * S))
    return out


for r in roads:
    if r['class'] == 'street':
        continue
    w = RW[r['class']] * .24
    k = 1.0 if r['class'] == 'avenue' else .6
    for o, c in ((w, (255, 40, 50)), (-w, (255, 214, 160))):
        q = offset(r['points'], o)
        col = tuple(int(v * k) for v in c)
        d.line(q, fill=col, width=2, joint='curve')
        de.line(q, fill=col, width=3, joint='curve')
edge = np.minimum.reduce([xx, sw - xx, yy, sh - yy]) / S
fade = np.clip(edge / 70, 0, 1)
fade = fade * fade * (3 - 2 * fade)
a11, a12 = (ca + sa) * KK, (sa - ca) * KK
a21, a22 = (ca - sa) * KK / 2, (sa + ca) * KK / 2
det = a11 * a22 - a12 * a21
i11, i12, i21, i22 = a22 / det, -a12 / det, -a21 / det, a11 / det


def to_canvas(im, fill):
    c0, c1 = -(i11 * ox + i12 * oy), -(i21 * ox + i22 * oy)
    return im.transform((CW, CH), Image.AFFINE, (i11 * S, i12 * S, (c0 + CX) * S, i21 * S, i22 * S, (c1 + CY) * S), resample=Image.BICUBIC, fillcolor=fill)


gmask = np.asarray(to_canvas(Image.fromarray((fade * 255).astype(np.uint8)), 0)).astype(np.float32) / 255
wmask = np.asarray(to_canvas(Image.fromarray(((1 - lm[:, :, 0]) * fade * 255).astype(np.uint8)), 0)).astype(np.float32) / 255
vy, vx = np.mgrid[0:CH, 0:CW].astype(np.float32)
sky = np.zeros((CH, CW, 3), dtype=np.float32) + np.array((6, 6, 16), dtype=np.float32)
cx0, cy0 = P(cu, cv)
hz = np.exp(-(((vx - cx0) / (CW * .46)) ** 2 + ((vy - cy0 * .86) / (CH * .34)) ** 2))[:, :, None]
sky += hz * np.array((26, 8, 46), dtype=np.float32)
gc = np.asarray(to_canvas(rd, (0, 0, 0))).astype(np.float32)
base = sky * (1 - gmask[:, :, None]) + gc * gmask[:, :, None]
emis = Image.fromarray((np.asarray(to_canvas(em, (0, 0, 0))).astype(np.float32) * gmask[:, :, None]).astype(np.uint8))


def edge_fade(X, Y):
    x, y = CX + X * ca - Y * sa, CY + X * sa + Y * ca
    m_ = max(0.0, min(1.0, min(x, Wd - x, y, Hd - y) / 60))
    return m_ * m_ * (3 - 2 * m_)


# ---------- signs decided first, so their light can fall on the ground ----------
info = {}
pool = Image.new('RGB', (CW, CH), (0, 0, 0))
pd_ = ImageDraw.Draw(pool)
shd = Image.new('L', (CW, CH), 0)
sd = ImageDraw.Draw(shd)
for i, b in enumerate(boxes):
    x0, y0, x1, y1, h, c = b
    seed = int(abs(x0) * 13 + abs(y0) * 7) + i
    r = random.Random(seed)
    di = dist_id((x0 + x1) / 2, (y0 + y1) / 2)
    (a1, a2), act = DS[di]
    act = {'idle': .05, 'full': 1.0}.get(ACT, act)
    if c in ('hero', 'land'):
        act = 1.0 if ACT != 'idle' else .05
    acc = a1 if r.random() < .65 else a2
    style = r.choices(['warm', 'band', 'cool', 'dark'], [.5, .2, .15, .15])[0]
    sign = c == 'b' and h >= 3 and r.random() < act * min(.75, .16 + h * .045)
    rim = c == 'b' and h >= 2 and r.random() < act * .34
    info[i] = (r, di, act, acc, style, sign, rim, seed)
    q = [P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1)]
    L = h * HZ * .5
    off = (L * .9, L * .28)
    for k in range(4):
        a_, b_ = q[k], q[(k + 1) % 4]
        sd.polygon([a_, b_, (b_[0] + off[0], b_[1] + off[1]), (a_[0] + off[0], a_[1] + off[1])], fill=min(255, 120 + int(h * 8)))
    if sign or rim:
        u, v = P(x1, y1)
        rr = (22 + h * 3) * SS
        pd_.ellipse([u - rr, v - rr / 2, u + rr, v + rr / 2], fill=tuple(int(q_ * (.55 if sign else .3)) for q_ in acc))
ba = base * (1 - .5 * np.asarray(shd.filter(ImageFilter.GaussianBlur(8 * SS))).astype(np.float32)[:, :, None] / 255)
sp = np.asarray(pool.resize((CW // 4, CH // 4)).filter(ImageFilter.GaussianBlur(9)).resize((CW, CH), Image.BICUBIC)).astype(np.float32)
ba += sp * gmask[:, :, None] * .8
img = Image.fromarray(np.clip(ba, 0, 255).astype(np.uint8))
emis_roads = emis.copy()
d, e = ImageDraw.Draw(img), ImageDraw.Draw(emis)

for t in trees:
    x, y = P(t[0], t[1])
    if 0 <= x < CW and 0 <= y < CH:
        r_ = t[2] * SS * .8
        d.ellipse([x - r_, y - r_ * 1.3, x + r_, y + r_ * .2], fill=(10, 24, 26))

# ---------- painter order ----------
idx = sorted(range(len(boxes)), key=lambda i: boxes[i][2] + boxes[i][3])
pos = {v: k for k, v in enumerate(idx)}
E = 1e-6


def behind(A, B):
    return (A[2] <= B[0] + E and A[1] < B[3] - E and A[3] > B[1] + E) or (A[3] <= B[1] + E and A[0] < B[2] - E and A[2] > B[0] + E)


nb = len(boxes)
after = [[] for _ in range(nb)]
indeg = [0] * nb
for p in range(nb):
    A = boxes[p]
    for q in range(p + 1, nb):
        B = boxes[q]
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
seq += [i for i in range(nb) if i not in set(seq)]

FOG = np.array((30, 18, 62), dtype=np.float32)
depth0 = min(b[0] + b[1] for b in boxes)
depth1 = cu + cv


def tone(c, X, Y, f):
    k = max(0.0, min(.55, (depth1 - (X + Y)) / (depth1 - depth0) * .6))
    v = np.array(c, dtype=np.float32) * (1 - k) + FOG * k
    return tuple(int(6 + (q - 6) * f) for q in v)


def quadw(X0, Y0, X1, Y1, t0, t1, z0, z1):
    a = (X0 + (X1 - X0) * t0, Y0 + (Y1 - Y0) * t0)
    b = (X0 + (X1 - X0) * t1, Y0 + (Y1 - Y0) * t1)
    return [P(a[0], a[1], z0), P(b[0], b[1], z0), P(b[0], b[1], z1), P(a[0], a[1], z1)]


signs = []
adc = []
cur_d = 0
tw_r = random.Random(77)
cand = []


def wall(X0, Y0, X1, Y1, h, body, r, style, act, acc, f, key, cx, cy):
    d.polygon([P(X0, Y0), P(X1, Y1), P(X1, Y1, h), P(X0, Y0, h)], fill=tone(body, cx, cy, f))
    e.polygon([P(X0, Y0), P(X1, Y1), P(X1, Y1, h), P(X0, Y0, h)], fill=(0, 0, 0))
    cols = max(1, int(math.hypot(X1 - X0, Y1 - Y0) / 4.2))
    floors = max(1, int(h * .9))
    warm = (255, 168, 84)
    cool = (150, 225, 255)
    for i in range(floors):
        z0, z1 = h * (i + .25) / floors, h * (i + .72) / floors
        if style == 'band':
            if r.random() < .16 + .3 * act:
                q = quadw(X0, Y0, X1, Y1, .06, .94, z0, z1)
                d.polygon(q, fill=tuple(int(v * .8 * f) for v in acc))
                e.polygon(q, fill=tuple(int(v * .55 * f) for v in acc))
            continue
        p_ = {'warm': .2 + .14 * act, 'cool': .2 + .14 * act, 'dark': .09}[style] * (key if style != 'dark' else 1)
        if r.random() < .35:
            p_ *= 2.6                       # a lit floor among dark ones
        col = cool if style == 'cool' else warm
        for j in range(cols):
            if r.random() > p_:
                if f > .7 and tw_r.random() < .45:
                    cand.append((cur_t, quadw(X0, Y0, X1, Y1, (j + .2) / cols, (j + .8) / cols, z0, z1)))
                continue
            q = quadw(X0, Y0, X1, Y1, (j + .2) / cols, (j + .8) / cols, z0, z1)
            cc = tuple(int(v * r.uniform(.55, 1) * f) for v in col)
            d.polygon(q, fill=cc)
            e.polygon(q, fill=tuple(int(v * .32) for v in cc))


def sign(X0, Y0, X1, Y1, h, r, acc, f):
    t0 = r.uniform(.12, .62)
    su, sv = P((X0 + X1) / 2, (Y0 + Y1) / 2, h * .62)
    signs.append([round(su / SS, 1), round(sv / SS, 1), cur_d])
    wdt = max(.14, min(.3, 5 / (math.hypot(X1 - X0, Y1 - Y0) + 1)))
    z0, z1 = h * r.uniform(.3, .5), h * r.uniform(.72, .96)
    q = quadw(X0, Y0, X1, Y1, t0, t0 + wdt, z0, z1)
    d.polygon(q, fill=tuple(int(v * f) for v in acc))
    e.polygon(q, fill=tuple(int(v * f) for v in acc))
    n = max(2, int((z1 - z0) / .7))
    for i in range(n):                      # dark marks, no readable text
        if r.random() < .55:
            za = z0 + (z1 - z0) * (i + .2) / n
            zb = z0 + (z1 - z0) * (i + .7) / n
            q2 = quadw(X0, Y0, X1, Y1, t0 + wdt * r.uniform(.15, .4), t0 + wdt * r.uniform(.6, .85), za, zb)
            d.polygon(q2, fill=(20, 8, 30))
            e.polygon(q2, fill=(0, 0, 0))


L_, R_, T_ = (19, 18, 38), (11, 11, 26), (27, 26, 50)
AS = './viz/assets/'
BB = Image.open(AS + 'billboard-tower.png').convert('RGBA')
bb_cache = {}


def billboard(px_, py_, size, flip, k, di):
    key_ = (size, flip)
    if key_ not in bb_cache:
        im = BB.resize((size, size), Image.LANCZOS)
        bb_cache[key_] = im.transpose(Image.FLIP_LEFT_RIGHT) if flip else im
    im = bb_cache[key_]
    a = np.asarray(im).astype(np.float32)
    pos = (int(px_ - size / 2), int(py_ - size * .93))
    box = pos + (pos[0] + size, pos[1] + size)
    sp2 = Image.fromarray(np.dstack([np.clip(a[:, :, :3] * k, 0, 255), a[:, :, 3]]).astype(np.uint8))
    img.paste(sp2, pos, sp2)
    idb.paste(di + 1, box, im.split()[3].point(lambda v: 255 if v > 90 else 0))
    if k > .6:
        glow = (a[:, :, :3] * (a[:, :, 3:4] / 255) * .3).astype(np.float32)
        emis.paste(Image.fromarray(np.clip(np.asarray(emis.crop(box)).astype(np.float32) + glow, 0, 255).astype(np.uint8)), box)


beams = []
idb = Image.new('L', (CW, CH), 0)
idd = ImageDraw.Draw(idb)
kdb = Image.new('L', (CW, CH), 0)
bib = Image.new('I', (CW, CH), 0)
bid = ImageDraw.Draw(bib)
kdd = ImageDraw.Draw(kdb)
kcount = 0
owner_kid = 0
pads, ants, owner_top = [], [], None
for t in seq:
    x0, y0, x1, y1, h, c = boxes[t]
    r, di, act, acc, style, sg, rim, seed = info[t]
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    f = edge_fade(cx, cy)
    if f < .02:
        continue
    hull = [P(x0, y1), P(x1, y1), P(x1, y0), P(x1, y0, h), P(x0, y0, h), P(x0, y1, h)]
    idd.polygon(hull, fill=di + 1)
    bid.polygon(hull, fill=t + 1)
    cur_t = t
    cur_d = di
    kid = 0
    if c in ('hero', 'land'):
        kcount += 1
        kid = kcount
        if c == 'hero' and h > 50:
            owner_kid = kid
    kdd.polygon(hull, fill=kid)
    u_, v_ = P(cx, cy, h)
    if c.startswith('n:') or c in ('hero', 'land'):
        pads.append([round(u_ / SS, 1), round(v_ / SS, 1), di, c[:4], round(h, 1), [round(q / SS, 1) for q in P(cx, cy)], kid])
    elif h >= 2 and (x1 - x0) * (y1 - y0) > 70 and f > .8:
        pads.append([round(u_ / SS, 1), round(v_ / SS, 1), di, 'b', round(h, 1), [round(q / SS, 1) for q in P(cx, cy)], 0])
    if c.startswith('n:'):
        m = MODELS[c[2:]]
        if not m.get('grp'):
            sc = KK / m['resolution']
            size = (int(m['size'][0] * sc), int(m['size'][1] * sc))
            u, v = P(cx, cy)
            at = (int(u - m['anchor'][0] * sc), int(v - m['anchor'][1] * sc))
        if m.get('grp'):
            for (ax_, ay_, bx_, by_, hh_, kd) in GRP[m['grp']]:
                hh_ *= 1.5
                X0_, Y0_, X1_, Y1_ = cx + ax_, cy + ay_, cx + bx_, cy + by_
                if kd == 'pitch':
                    q_ = [P(X0_, Y0_, .3), P(X1_, Y0_, .3), P(X1_, Y1_, .3), P(X0_, Y1_, .3)]
                    d.polygon(q_, fill=(14, 44, 44))
                    lit_ = tuple(int(v * (1 if ACT != 'idle' else .25)) for v in (120, 255, 210))
                    d.line(q_ + [q_[0]], fill=lit_, width=SS)
                    e.line(q_ + [q_[0]], fill=lit_, width=SS)
                    a_ = P((X0_ + X1_) / 2, Y0_, .3)
                    b_ = P((X0_ + X1_) / 2, Y1_, .3)
                    d.line([a_, b_], fill=lit_, width=SS)
                    continue
                st_ = 'warm' if kd == 'field' else kd
                wall(X0_, Y1_, X1_, Y1_, hh_, L_, r, st_, act, acc, f, 1.4, cx, cy)
                wall(X1_, Y1_, X1_, Y0_, hh_, R_, r, st_, act, acc, f, 1.1, cx, cy)
                tp = [P(X0_, Y0_, hh_), P(X1_, Y0_, hh_), P(X1_, Y1_, hh_), P(X0_, Y1_, hh_)]
                d.polygon(tp, fill=tone(acc if kd == 'field' else T_, cx, cy, f) if kd != 'field' or ACT != 'idle' else tone(T_, cx, cy, f))
                e.polygon(tp, fill=(0, 0, 0))
                col = tuple(int(v * f * (1 if ACT != 'idle' else .35)) for v in acc)
                d.line(tp + [tp[0]], fill=col, width=SS)
                e.line(tp + [tp[0]], fill=col, width=SS * 2)
                d.line([P(X1_, Y1_), P(X1_, Y1_, hh_)], fill=col, width=SS)
                e.line([P(X1_, Y1_), P(X1_, Y1_, hh_)], fill=col, width=SS)
            continue
        if m.get('art'):
            bimg = Image.open(A2 + m['base']).convert('RGBA').resize(size, Image.LANCZOS)
            img.paste(bimg, at, bimg)
            box = at + (at[0] + size[0], at[1] + size[1])
            idb.paste(di + 1, box, bimg.split()[3].point(lambda v: 255 if v > 90 else 0))
            ea = np.asarray(Image.open(A2 + m['emis']).convert('RGBA').resize(size, Image.LANCZOS)).astype(np.float32)
            ev = ea[:, :, :3] * (ea[:, :, 3:4] / 255) * (1.0 if ACT != 'idle' else .22)
            for tgt in (img, emis):
                tgt.paste(Image.fromarray(np.clip(np.asarray(tgt.crop(box)).astype(np.float32) + ev, 0, 255).astype(np.uint8)), box)
            continue
        a = np.asarray(Image.open(NOT + m['base']).convert('RGBA').resize(size, Image.LANCZOS)).astype(np.float32)
        lum = a[:, :, :3].mean(axis=2, keepdims=True) / 255
        rgb = lum * np.array((112, 104, 190), dtype=np.float32) + 6          # same dark material as the city
        sp_ = Image.fromarray(np.dstack([np.clip(rgb, 0, 255), a[:, :, 3]]).astype(np.uint8))
        img.paste(sp_, at, sp_)
        al = Image.fromarray(a[:, :, 3].astype(np.uint8))
        rimm = np.asarray(al.filter(ImageFilter.MaxFilter(3))).astype(np.float32) - np.asarray(al.filter(ImageFilter.MinFilter(3))).astype(np.float32)
        rimi = Image.fromarray(np.clip(rimm[:, :, None] / 255 * np.array(acc, dtype=np.float32) * max(.45, act), 0, 255).astype(np.uint8))
        bx_ = at + (at[0] + size[0], at[1] + size[1])
        for tgt in (img, emis):
            tgt.paste(Image.fromarray(np.clip(np.asarray(tgt.crop(bx_)).astype(np.float32) + np.asarray(rimi), 0, 255).astype(np.uint8)), bx_)
        w = np.asarray(Image.open(NOT + m['states']['50']).convert('RGBA').resize(size, Image.LANCZOS)).astype(np.float32)
        li = (w[:, :, :3].mean(axis=2) * w[:, :, 3] / 255)[:, :, None] / 255
        win = Image.fromarray(np.clip(li * np.array(acc, dtype=np.float32) * 2.2 * max(.5, act) ** .5, 0, 255).astype(np.uint8))
        box = at + (at[0] + size[0], at[1] + size[1])
        for tgt in (img, emis):
            tgt.paste(Image.fromarray(np.clip(np.asarray(tgt.crop(box)).astype(np.float32) + np.asarray(win), 0, 255).astype(np.uint8)), box)
        continue
    key = c in ('hero', 'land')
    is_owner = c == 'hero' and h > 50
    kact = 1.0 if ACT != 'idle' else (.3 if is_owner else .05)
    if c == 'hero':
        style, act, acc = 'cool', kact, (CYA if h > 34 else (MAG if seed % 2 else VIO))
    if c == 'land':
        style, act, acc = 'warm', kact, AMB
    dens = 2.6 if key else 1.0
    wall(x0, y1, x1, y1, h, L_, r, style, act, acc, f, dens, cx, cy)
    wall(x1, y1, x1, y0, h, R_, r, style, act, acc, f, dens * .8, cx, cy)
    top = [P(x0, y0, h), P(x1, y0, h), P(x1, y1, h), P(x0, y1, h)]
    d.polygon(top, fill=tone(T_, cx, cy, f))
    e.polygon(top, fill=(0, 0, 0))
    if c == 'b' and h >= 2.2 and math.hypot(cx - SQ[0], cy - SQ[1]) < 120:
        for (ax_, ay_, bx_, by_) in ((x0, y1, x1, y1), (x1, y1, x1, y0)):
            if math.hypot(bx_ - ax_, by_ - ay_) > 7:
                for z0_, z1_ in ((.22, .9), (.5, .9), (.22, .56)):
                    adc.append((t, quadw(ax_, ay_, bx_, by_, .1, .9, h * z0_, h * z1_), math.hypot(cx - SQ[0], cy - SQ[1]) + (0 if z1_ - z0_ > .5 else 14)))
    br = random.Random(seed + 5)
    dcore = math.hypot(cx - cu, cy - cv)
    if c == 'b' and 3 <= h <= 13 and (x1 - x0) * (y1 - y0) > 110 and False:
        u_, v_ = P(cx, cy, h)
        billboard(u_, v_ + 2, int((92 if dcore < 260 else 70) * SS * .72), br.random() < .5, .3 if ACT == 'idle' else 1.0, di)
    if (x1 - x0) * (y1 - y0) > 90 and h > 2 and not key:      # roof machinery
        for _ in range(r.randint(1, 3)):
            ux, uy = r.uniform(x0 + 1, x1 - 4), r.uniform(y0 + 1, y1 - 4)
            hh = h + r.uniform(.3, .8)
            d.polygon([P(ux, uy + 3, h), P(ux + 3, uy + 3, h), P(ux + 3, uy + 3, hh), P(ux, uy + 3, hh)], fill=tone((24, 23, 44), cx, cy, f))
            d.polygon([P(ux, uy, hh), P(ux + 3, uy, hh), P(ux + 3, uy + 3, hh), P(ux, uy + 3, hh)], fill=tone((36, 34, 62), cx, cy, f))
    if h >= 7 and r.random() < .5 and not key:                # antenna with a red light
        u, v = P(cx, cy, h)
        hh = (1.5 + h * .22) * HZ
        d.line([(u, v), (u, v - hh)], fill=tone((46, 44, 72), cx, cy, f), width=SS)
        d.ellipse([u - SS * 1.4, v - hh - SS * 1.4, u + SS * 1.4, v - hh + SS * 1.4], fill=(255, 40, 60))
        ants.append([round(u / SS, 1), round((v - hh) / SS, 1), seed % 97])
        e.ellipse([u - SS * 2, v - hh - SS * 2, u + SS * 2, v - hh + SS * 2], fill=(255, 40, 60))
    if sg:
        if r.random() < .6:
            sign(x0, y1, x1, y1, h, r, acc, f)
        else:
            sign(x1, y1, x1, y0, h, r, acc, f)
    if rim or (key and (ACT != 'idle' or is_owner)):
        col = tuple(int(v * f * (.4 if (key and ACT == 'idle') else 1)) for v in acc)
        wd = (2 if key else 1) * SS
        d.line(top + [top[0]], fill=col, width=wd)
        e.line(top + [top[0]], fill=col, width=wd * 2)
        if key or h > 5:
            for a_, b_ in ((P(x1, y1), P(x1, y1, h)),):
                d.line([a_, b_], fill=col, width=wd)
                e.line([a_, b_], fill=col, width=wd * 2)
    if c == 'hero':
        if h > 50 and ACT != 'idle':
            beams.append((P(cx, cy, h), acc, .8))
            bu, bv = P(cx, cy, h)
            kdd.rectangle([bu - 16 * SS, 0, bu + 16 * SS, bv], fill=kid)

# ---------- reflections, bloom, fog ----------
Q = 4
small = emis.resize((CW // Q, CH // Q), Image.BILINEAR)
sa_ = np.asarray(small).astype(np.float32)
sb_ = np.clip(sa_ - np.asarray(emis_roads.resize((CW // Q, CH // Q), Image.BILINEAR)).astype(np.float32) * 1.3, 0, 255)
acc_r = np.zeros_like(sa_)
for k in range(1, 58):
    sh_ = np.zeros_like(sb_)
    sh_[k:] = sb_[:-k]
    acc_r += sh_ * math.exp(-k / 22) * (.8 if k % 3 else .45)
acc_r = np.asarray(Image.fromarray(np.clip(acc_r * .22, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.6))).astype(np.float32)
refl = np.asarray(Image.fromarray(acc_r.astype(np.uint8)).resize((CW, CH), Image.BICUBIC)).astype(np.float32)
out = np.asarray(img).astype(np.float32)
bmask = np.asarray(idb.filter(ImageFilter.MaxFilter(3))).astype(np.float32) > 0
out += refl * (wmask * (~bmask))[:, :, None] * 1.25
bl = np.zeros_like(sa_)
for rad, w in ((2, .75), (7, .6), (22, .5), (60, .55)):
    bl += np.asarray(small.filter(ImageFilter.GaussianBlur(rad))).astype(np.float32) * w
bloom = np.asarray(Image.fromarray(np.clip(bl, 0, 255).astype(np.uint8)).resize((CW, CH), Image.BICUBIC)).astype(np.float32)
out = 255 - (255 - np.clip(out, 0, 255)) * (255 - bloom) / 255
for (u, v), col, k in beams:
    w = np.exp(-((vx - u) / (5 * SS)) ** 2) * np.clip((v - vy) / (v + 1), 0, 1) ** 0 * (vy < v) * np.exp(-(v - vy) / (420 * SS))
    out += (w * .75 * k)[:, :, None] * np.array(col, dtype=np.float32)
full_ = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))
res = full_.resize((FW, FH), Image.LANCZOS)
fy, fx = np.mgrid[0:FH, 0:FW].astype(np.float32)
vig = np.clip(1.06 - np.hypot((fx - FW / 2) / (FW * .66), (fy - FH * .5) / (FH * .66)) ** 3 * .6, .3, 1)[:, :, None]
Image.fromarray(np.clip(np.asarray(res).astype(np.float32) * vig, 0, 255).astype(np.uint8)).save(sys.argv[1])
ba_ = np.asarray(bib)
ads, used = [], []
for t_, q_, dq in sorted(adc, key=lambda a: a[2]):
    ok_ = True
    for k1 in (.03, .25, .5, .75, .97):
        for k2 in (.03, .25, .5, .75, .97):
            ux = q_[0][0] + (q_[1][0] - q_[0][0]) * k1 + (q_[3][0] - q_[0][0]) * k2
            uy = q_[0][1] + (q_[1][1] - q_[0][1]) * k1 + (q_[3][1] - q_[0][1]) * k2
            if not (0 <= int(uy) < CH and 0 <= int(ux) < CW and ba_[int(uy), int(ux)] == t_ + 1):
                ok_ = False
    bx = (min(p_[0] for p_ in q_) - 6, min(p_[1] for p_ in q_) - 6, max(p_[0] for p_ in q_) + 6, max(p_[1] for p_ in q_) + 6)
    if ok_ and not any(bx[0] < u[2] and bx[2] > u[0] and bx[1] < u[3] and bx[3] > u[1] for u in used) and len(ads) < 16:
        used.append(bx)
        ads.append([round(v / SS, 1) for p_ in q_ for v in p_])
print('ads', len(adc), len(ads))
wins = []
for t_, q_ in cand:
    mx = sum(p_[0] for p_ in q_) / 4
    my = sum(p_[1] for p_ in q_) / 4
    if 0 <= int(my) < CH and 0 <= int(mx) < CW and ba_[int(my), int(mx)] == t_ + 1:
        wins.append([round(v / SS, 1) for p_ in q_ for v in p_])
tw_r.shuffle(wins)
wins = wins[:8000]
print('windows', len(cand), len(wins))
Image.fromarray((wmask * (~bmask) * 255).astype(np.uint8)).resize((1200, 600), Image.BILINEAR).save(sys.argv[1].replace('.png', '-water.png'))
idb.resize((3600, 1800), Image.NEAREST).save(sys.argv[1].replace('.png', '-ids.png'))
kdb.resize((3600, 1800), Image.NEAREST).save(sys.argv[1].replace('.png', '-kid.png'))
_h = full_.resize((3600, 1800), Image.LANCZOS)
_a = np.asarray(_h).astype(np.float32)
_y, _x = np.mgrid[0:1800, 0:3600].astype(np.float32)
_v = np.clip(1.06 - np.hypot((_x - 1800) / (3600 * .66), (_y - 900) / (1800 * .66)) ** 3 * .6, .3, 1)[:, :, None]
Image.fromarray(np.clip(_a * _v, 0, 255).astype(np.uint8)).save(sys.argv[1].replace('.png', '-hi.png'))
json.dump({'frame': [FW, FH], 'ox': ox / SS, 'oy': oy / SS, 'seeds': [list(q) for q in SEEDS], 'pads': pads, 'ants': ants, 'hero': [round(q / SS, 1) for q in P(cu, cv)], 'wins': wins, 'signs': signs, 'ads': ads[:18], 'sq': [round(v / SS, 1) for v in P(SQ[0], SQ[1])], 'keys': kcount, 'ownerKid': owner_kid, 'g': city['g'], 'center': city['center']}, open(sys.argv[1].replace('.png', '.json'), 'w'))
print('saved', sys.argv[1], len(boxes), len(pads), len(ants))
