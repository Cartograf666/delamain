from PIL import Image
import numpy as np, json
from pathlib import Path
W0 = str(Path(__file__).resolve().parents[1]) + '/'
im = Image.open(W0 + 'render-v3.png')
im.crop((780, 180, 1680, 840)).save(W0 + 'qa-zoom.png')

# plan vs the owner's render, side by side and numerically
src = Image.open(W0 + 'refs/owner-src.webp').convert('RGB')
plan = Image.open(W0 + 'plan.png').convert('RGB')
sheet = Image.new('RGB', (2000, 563 * 2 + 10), (0, 0, 0))
sheet.paste(src.resize((1000, 563)), (0, 0))
sheet.paste(plan.resize((1000, 563)), (1000, 0))
sheet.paste(Image.blend(src, plan, .5).resize((1000, 563)), (0, 573))
sheet.crop((0, 0, 2000, 1136)).save(W0 + 'qa-compare.png')

a = np.asarray(src).astype(float).mean(axis=2)
land = np.asarray(Image.open(W0 + 'land.png')) > 128
cream = a > 205
print('cream px classified as water', round(float((cream & ~land).sum() / cream.sum()), 3))
print('land px that are cream in source', round(float((~cream & land).sum() and (cream & land).sum() / land.sum()), 3))

r = json.load(open(W0 + 'roads.json'))['roads']
c = json.load(open(W0 + 'city.json'))
from collections import Counter
print('roads', len(r), Counter(x['class'] for x in r), 'streets', len({x['street'] for x in r}))
print('buildings', len(c['boxes']), Counter(b[5] for b in c['boxes']), 'max', max(b[4] for b in c['boxes']))
hs = sorted(b[4] for b in c['boxes'] if b[5] == 'b')
print('height p50/p90/p99/max', hs[len(hs) // 2], hs[int(len(hs) * .9)], hs[int(len(hs) * .99)], hs[-1])
