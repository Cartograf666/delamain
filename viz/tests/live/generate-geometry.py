from pathlib import Path
import json,math
from PIL import Image
M=Path('./work/city/mock');OUT=Path('viz/assets/live/aquarium')
# Reuse the accepted geometry mutation exactly; do not run its raster render.
source=(M/'cp.py').read_text();ns={};exec(source[:source.index('FW, FH, SS')],ns)
city=ns['city'];boxes=ns['boxes'];roads=ns['roads'];land=Image.open(M/'land.png').convert('L');step=3
w,h=land.size;nx,ny=(w+step-1)//step,(h+step-1)//step
on={(x,y) for y in range(ny) for x in range(nx) if land.getpixel((min(w-1,x*step),min(h-1,y*step)))>128}
edges={}
for x,y in on:
 for dx,dy,a,b in [(0,-1,(x,y),(x+1,y)),(1,0,(x+1,y),(x+1,y+1)),(0,1,(x+1,y+1),(x,y+1)),(-1,0,(x,y+1),(x,y))]:
  if (x+dx,y+dy) not in on:edges.setdefault(a,[]).append(b)
polys=[]
while edges:
 start=next(iter(edges));p=[start];q=start
 while q in edges:
  n=edges[q].pop()
  if not edges[q]:del edges[q]
  q=n
  if q==start:break
  p.append(q)
 if len(p)<8:continue
 # Keep corners, remove straight runs; geometry stays crisp at all zoom tiers.
 clean=[p[i] for i in range(len(p)) if (p[i][0]-p[i-1][0])*(p[(i+1)%len(p)][1]-p[i][1])!=(p[i][1]-p[i-1][1])*(p[(i+1)%len(p)][0]-p[i][0])]
 polys.append([[x*step,y*step] for x,y in clean])
(OUT/'geometry.json').write_text(json.dumps({'boxes':boxes,'trees':city['trees'],'roads':roads,'land':polys,'center':city['center'],'g':city['g'],'core':city['core'],'groups':ns.get('GRP',{}),'models':{k:v for k,v in ns['MODELS'].items() if v.get('art')}},separators=(',',':')))
# Refresh accepted pads/key ids and preserve source snapshot/provenance.
s=(M/'prototype/data.js').read_text();data=json.loads(s.split('=',1)[1].rstrip(';\n'));data.pop('events',None);(OUT/'data.json').write_text(json.dumps(data,separators=(',',':')))
(OUT/'accepted-source.html').write_text((M/'prototype/index.html').read_text());(OUT/'cp.py').write_text(source);(OUT/'pack_aq.py').write_text((M/'pack_aq.py').read_text())
import shutil
art=OUT/'art2';art.mkdir(exist_ok=True)
for m in ns['MODELS'].values():
 if m.get('art') and m['base'].startswith('landing-pad'):
  for f in [m['base'],m['emis']]:shutil.copy2(Path(ns['A2'])/f,art/f)
sq=ns.get('SQ');
if sq:(OUT/'plaza.json').write_text(json.dumps({'center':list(sq),'rect':[sq[0]-24,sq[1]-24,sq[0]+24,sq[1]+24],'source':'cp.py SQ'},indent=2))
print(len(boxes),len(polys),len(data['pads']))
