"""Stage A. Owner's red centrelines + colour markup -> clean road graph (junctions, streets, classes)."""
from PIL import Image, ImageDraw
import numpy as np, math, json, sys
from collections import defaultdict

from pathlib import Path
OUT = str(Path(__file__).resolve().parents[1]) + '/'
W0 = OUT
src = Image.open(W0 + 'refs/owner-src.webp').convert('RGB')
Wd, Hd = src.size
o = np.asarray(Image.open(W0 + 'refs/owner-roads.webp').convert('RGB')).astype(int)
red = (o[:, :, 0] > 190) & (o[:, :, 1] < 70) & (o[:, :, 2] < 70)


def thin(img):
    img = img.astype(np.uint8)
    while True:
        ch = False
        for step in (0, 1):
            P = np.pad(img, 1)
            p2, p3, p4, p5, p6, p7, p8, p9 = (P[:-2, 1:-1], P[:-2, 2:], P[1:-1, 2:], P[2:, 2:], P[2:, 1:-1], P[2:, :-2], P[1:-1, :-2], P[:-2, :-2])
            B = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9
            seq = [p2, p3, p4, p5, p6, p7, p8, p9, p2]
            A = sum(((seq[i] == 0) & (seq[i + 1] == 1)).astype(np.uint8) for i in range(8))
            c = ((p2 * p4 * p6 == 0) & (p4 * p6 * p8 == 0)) if step == 0 else ((p2 * p4 * p8 == 0) & (p2 * p6 * p8 == 0))
            m = (img == 1) & (B >= 2) & (B <= 6) & (A == 1) & c
            if m.any():
                img[m] = 0
                ch = True
        if not ch:
            return img.astype(bool)


sk = thin(red)
ys, xs = np.nonzero(sk)
pts = set(zip(xs.tolist(), ys.tolist()))
RING = [(0, -1), (1, -1), (1, 0), (1, 1), (0, 1), (-1, 1), (-1, 0), (-1, -1)]

# strip staircase corners: a pixel between two perpendicular neighbours adds nothing to connectivity
for x, y in sorted(pts):
    for (ax, ay), (bx, by) in (((0, -1), (1, 0)), ((1, 0), (0, 1)), ((0, 1), (-1, 0)), ((-1, 0), (0, -1))):
        if (x + ax, y + ay) in pts and (x + bx, y + by) in pts \
                and (x - ax, y - ay) not in pts and (x - bx, y - by) not in pts and (x - ax - bx, y - ay - by) not in pts:
            pts.discard((x, y))
            break


def deg8(p):
    return sum((p[0] + dx, p[1] + dy) in pts for dx, dy in RING)


# staircase pixels also get 3 neighbours: they become 2-branch nodes and merge away later
node_px = {p for p in pts if deg8(p) != 2}
# cluster junction pixels that touch
cl, cid = {}, 0
for p in node_px:
    if p in cl:
        continue
    st = [p]
    cl[p] = cid
    while st:
        q = st.pop()
        for dx, dy in RING:
            n = (q[0] + dx, q[1] + dy)
            if n in node_px and n not in cl:
                cl[n] = cid
                st.append(n)
    cid += 1


def nb(p):
    return [(p[0] + dx, p[1] + dy) for dx, dy in RING if (p[0] + dx, p[1] + dy) in pts]


visited = set()
edges = []  # [a, b, [(x, y)...]]
for p in node_px:
    for n in nb(p):
        if n in node_px or n in visited:
            continue
        path = [p, n]
        visited.add(n)
        prev, cur, end = p, n, None
        while True:
            nx = [q for q in nb(cur) if q != prev]
            if not nx:
                break
            q = nx[0]
            if q in node_px:
                end = q
                path.append(q)
                break
            if q in visited:
                break
            visited.add(q)
            path.append(q)
            prev, cur = cur, q
        if end is not None:
            edges.append([cl[p], cl[end], path])
# adjacent junction clusters with no pixel between them
print('skeleton', len(pts), 'junction px', len(node_px), 'raw edges', len(edges))

pos = defaultdict(list)
for p, c in cl.items():
    pos[c].append(p)
npos = {c: (sum(a for a, _ in v) / len(v), sum(b for _, b in v) / len(v)) for c, v in pos.items()}


def plen(p):
    return sum(math.hypot(p[i + 1][0] - p[i][0], p[i + 1][1] - p[i][1]) for i in range(len(p) - 1))


# collapse short edges: two Y-junctions a few px apart are one crossing
par = {c: c for c in npos}


def fnd(x):
    while par[x] != x:
        par[x] = par[par[x]]
        x = par[x]
    return x


for a, b, p in edges:
    if plen(p) < 16:
        par[fnd(a)] = fnd(b)
# cluster nodes lying very close to each other as well
ids = list(npos)
for i in range(len(ids)):
    for j in range(i + 1, len(ids)):
        if math.hypot(npos[ids[i]][0] - npos[ids[j]][0], npos[ids[i]][1] - npos[ids[j]][1]) < 12:
            par[fnd(ids[i])] = fnd(ids[j])
grp = defaultdict(list)
for c in npos:
    grp[fnd(c)].append(npos[c])
gpos = {k: (sum(a for a, _ in v) / len(v), sum(b for _, b in v) / len(v)) for k, v in grp.items()}
E = []
for a, b, p in edges:
    A, B = fnd(a), fnd(b)
    if A == B and plen(p) < 60:
        continue
    E.append([A, B, p])


def degree(E):
    d = defaultdict(int)
    for a, b, _ in E:
        d[a] += 1
        d[b] += 1
    return d


def merge_deg2(E):
    changed = True
    while changed:
        changed = False
        d = degree(E)
        inc = defaultdict(list)
        for i, e in enumerate(E):
            inc[e[0]].append(i)
            inc[e[1]].append(i)
        for n, l in inc.items():
            if d[n] == 2 and len(set(l)) == 2:
                i, j = l
                ei, ej = E[i], E[j]
                pi = ei[2] if ei[1] == n else ei[2][::-1]
                pj = ej[2] if ej[0] == n else ej[2][::-1]
                a = ei[0] if ei[1] == n else ei[1]
                b = ej[1] if ej[0] == n else ej[0]
                E[i] = [a, b, pi + pj[1:]]
                E.pop(j)
                changed = True
                break
    return E


for _ in range(4):
    d = degree(E)
    E = [e for e in E if not ((d[e[0]] == 1 or d[e[1]] == 1) and plen(e[2]) < 26)]
    E = merge_deg2(E)
print('edges after cleanup', len(E), 'nodes', len(degree(E)))


def rdp(points, eps):
    if len(points) < 3:
        return points
    (x1, y1), (x2, y2) = points[0], points[-1]
    L = math.hypot(x2 - x1, y2 - y1) or 1
    dm, ix = 0, 0
    for i in range(1, len(points) - 1):
        dd = abs((x2 - x1) * (y1 - points[i][1]) - (x1 - points[i][0]) * (y2 - y1)) / L
        if dd > dm:
            dm, ix = dd, i
    if dm > eps:
        return rdp(points[:ix + 1], eps)[:-1] + rdp(points[ix:], eps)
    return [points[0], points[-1]]


for e in E:
    p = [(float(x), float(y)) for x, y in e[2]]
    p = rdp(p, 2.2)
    if e[0] in gpos:
        p[0] = gpos[e[0]]
    if e[1] in gpos:
        p[-1] = gpos[e[1]]
    e[2] = p

# join dead ends that stop just short of another road
d = degree(E)
for e in E:
    for side, n in ((0, e[0]), (-1, e[1])):
        if d[n] != 1:
            continue
        x, y = e[2][side]
        best = None
        for f in E:
            if f is e:
                continue
            for q in range(len(f[2]) - 1):
                (ax, ay), (bx, by) = f[2][q], f[2][q + 1]
                dx, dy = bx - ax, by - ay
                t = max(0, min(1, ((x - ax) * dx + (y - ay) * dy) / ((dx * dx + dy * dy) or 1)))
                px, py = ax + t * dx, ay + t * dy
                dist = math.hypot(px - x, py - y)
                if best is None or dist < best[0]:
                    best = (dist, px, py)
        if best and 0.5 < best[0] < 24:
            if side == 0:
                e[2].insert(0, (best[1], best[2]))
            else:
                e[2].append((best[1], best[2]))

# through streets: straightest pair at every junction
inc = defaultdict(list)
for i, e in enumerate(E):
    inc[e[0]].append(i)
    inc[e[1]].append(i)


def heading(e, n):
    p = e[2] if e[0] == n else e[2][::-1]
    acc = 0
    for i in range(len(p) - 1):
        acc += math.hypot(p[i + 1][0] - p[i][0], p[i + 1][1] - p[i][1])
        if acc >= 30 or i == len(p) - 2:
            return math.atan2(p[i + 1][1] - p[0][1], p[i + 1][0] - p[0][0])


sp = list(range(len(E)))


def sf(x):
    while sp[x] != x:
        sp[x] = sp[sp[x]]
        x = sp[x]
    return x


for n, l in inc.items():
    pairs = []
    for i in range(len(l)):
        for j in range(i + 1, len(l)):
            if l[i] == l[j]:
                continue
            a1, a2 = heading(E[l[i]], n), heading(E[l[j]], n)
            dev = math.pi - abs((a1 - a2 + math.pi) % (2 * math.pi) - math.pi)
            if dev < math.radians(32):
                pairs.append((dev, l[i], l[j]))
    used = set()
    for dev, i, j in sorted(pairs):
        if i not in used and j not in used:
            used |= {i, j}
            sp[sf(i)] = sf(j)
strokes = defaultdict(list)
for i in range(len(E)):
    strokes[sf(i)].append(i)

# class from the owner's colour markup
c = np.asarray(Image.open(W0 + 'refs/owner-classes.webp').convert('RGB')).astype(int)
Hc = c.shape[0]
CL = np.full((Hd, Wd, 3), 255, dtype=int)
CL[1:1 + min(Hd - 1, Hc)] = c[:min(Hd - 1, Hc)]
R, G, B = CL[:, :, 0], CL[:, :, 1], CL[:, :, 2]
m_red = (R > 200) & (G < 105) & (B < 105)
m_org = (R > 215) & (G > 105) & (G < 195) & (B < 95)
m_blu = (B > 195) & (R < 135) & (G > 125)
wh = (R > 240) & (G > 240) & (B > 240)
wimg = Image.fromarray((wh * 255).astype(np.uint8))
from PIL import ImageFilter
wd = np.asarray(wimg.filter(ImageFilter.MaxFilter(11))) > 128
m_red &= ~wd
m_org &= ~wd


def votes(p):
    """Length-weighted colour votes along a road, ignoring the crossings at its ends."""
    v = [0.0, 0.0, 0.0]
    total = plen(p)
    run = 0.0
    for i in range(len(p) - 1):
        (ax, ay), (bx, by) = p[i], p[i + 1]
        L = math.hypot(bx - ax, by - ay)
        n = max(1, int(L / 3))
        for t in range(n):
            d_ = run + L * t / n
            if total > 40 and (d_ < 12 or d_ > total - 12):
                continue
            x = int(ax + (bx - ax) * t / n)
            y = int(ay + (by - ay) * t / n)
            s_ = (slice(max(0, y - 2), y + 3), slice(max(0, x - 2), x + 3))
            r_, o_, b_ = m_red[s_].sum(), m_org[s_].sum(), m_blu[s_].sum()
            if r_ + o_ + b_ == 0:
                continue
            v[int(np.argmax([b_, o_, r_]))] += 3
        run += L
    return v


ev = [votes(e[2]) for e in E]
ecl = [1] * len(E)
for k, l in strokes.items():
    tot = [sum(ev[i][q] for i in l) for q in range(3)]
    sc = 1 + int(np.argmax(tot)) if sum(tot) else 1
    for i in l:
        s_ = sum(ev[i])
        own = 1 + int(np.argmax(ev[i])) if s_ else sc
        ecl[i] = own if (s_ > 0 and max(ev[i]) / s_ > .6 and plen(E[i][2]) > 28) else sc
# an isolated short piece takes the class of the street on both sides of it
for _ in range(2):
    for i, e in enumerate(E):
        if plen(e[2]) >= 60:
            continue
        side = [ecl[j] for j in inc[e[0]] + inc[e[1]] if j != i and sf(j) == sf(i)]
        if len(side) >= 2 and side[0] == side[1]:
            ecl[i] = side[0]


def chaikin(p, it=2):
    for _ in range(it):
        q = [p[0]]
        for i in range(len(p) - 1):
            a, b = p[i], p[i + 1]
            q += [(.75 * a[0] + .25 * b[0], .75 * a[1] + .25 * b[1]), (.25 * a[0] + .75 * b[0], .25 * a[1] + .75 * b[1])]
        q.append(p[-1])
        p = q
    return p


# the owner repainted the south arc orange over an older red line, so the vote there reads red
for i, e in enumerate(E):
    mx_ = sum(q[0] for q in e[2]) / len(e[2])
    my_ = sum(q[1] for q in e[2]) / len(e[2])
    if ecl[i] == 3 and 800 < mx_ < 985 and 868 < my_ < 975:
        ecl[i] = 2


NAME = {1: 'street', 2: 'collector', 3: 'avenue'}
roads = [{'class': NAME[ecl[i]], 'street': sf(i), 'points': [[round(x, 1), round(y, 1)] for x, y in chaikin(e[2])]} for i, e in enumerate(E)]
json.dump({'size': [Wd, Hd], 'roads': roads}, open(OUT + 'roads.json', 'w'))

chk = src.copy()
dr = ImageDraw.Draw(chk)
COL = {'street': (40, 190, 255), 'collector': (255, 150, 30), 'avenue': (255, 30, 60)}
WID = {'street': 3, 'collector': 6, 'avenue': 10}
for r in sorted(roads, key=lambda r: WID[r['class']]):
    dr.line([tuple(p) for p in r['points']], fill=COL[r['class']], width=WID[r['class']], joint='curve')
chk.save(OUT + 'roads-check.png')
print('roads', len(roads), 'through streets', len(strokes), {n: sum(1 for r in roads if r['class'] == n) for n in NAME.values()})
