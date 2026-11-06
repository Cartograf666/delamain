"""Compile the accepted fixed map. Never regenerates roads, buildings or heights.
Python 3 + Pillow + numpy. Run from any directory; outputs live beside city.json.
"""
from pathlib import Path
import json, math, heapq
from collections import defaultdict
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
city=json.loads((ROOT/'city.json').read_text()); roads=json.loads((ROOT/'roads.json').read_text())
g=math.radians(city['g']);ca,sa=math.cos(g),math.sin(g);cx,cy=city['center']
def grid(p):
 x,y=p[0]-cx,p[1]-cy
 return [x*ca+y*sa,-x*sa+y*ca]
def source(p):return [cx+p[0]*ca-p[1]*sa,cy+p[0]*sa+p[1]*ca]
def near(p,a,b):
 dx,dy=b[0]-a[0],b[1]-a[1];ll=dx*dx+dy*dy
 t=max(0,min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(ll or 1)))
 q=[a[0]+t*dx,a[1]+t*dy];return math.dist(p,q),t,q
segs=[];buckets=defaultdict(set)
for ri,r in enumerate(roads['roads']):
 for si,(a,b) in enumerate(zip(r['points'],r['points'][1:])):
  if math.dist(a,b)<1e-7:continue
  i=len(segs);segs.append(dict(a=a,b=b,road=ri,cls=r['class'],cuts=[0.,1.]))
  for x in range(math.floor((min(a[0],b[0])-9)/32),math.floor((max(a[0],b[0])+9)/32)+1):
   for y in range(math.floor((min(a[1],b[1])-9)/32),math.floor((max(a[1],b[1])+9)/32)+1):buckets[x,y].add(i)
def candidates(p):return buckets[math.floor(p[0]/32),math.floor(p[1]/32)]
# Split every actual centreline crossing, including long polylines.
pairs=set()
for ids in buckets.values():
 ids=sorted(ids)
 for k,i in enumerate(ids):
  for j in ids[k+1:]:pairs.add((i,j))
for i,j in sorted(pairs):
 a,b=segs[i],segs[j];p,q=a['a'],b['a'];r=[a['b'][k]-p[k] for k in (0,1)];s=[b['b'][k]-q[k] for k in (0,1)]
 cross=lambda x,y:x[0]*y[1]-x[1]*y[0]
 den=cross(r,s)
 if abs(den)<1e-10:continue
 qp=[q[k]-p[k] for k in (0,1)];t,u=cross(qp,s)/den,cross(qp,r)/den
 if -1e-9<=t<=1+1e-9 and -1e-9<=u<=1+1e-9:a['cuts'].append(max(0,min(1,t)));b['cuts'].append(max(0,min(1,u)))
# Endpoints touching another painted road: retain axes, add only a corridor-contained connector.
width={'avenue':12,'collector':7,'street':3.5};snaps=[]
for ri,r in enumerate(roads['roads']):
 for p in [r['points'][0],r['points'][-1]]:
  options=[]
  for i in sorted(candidates(p)):
   s=segs[i]
   if s['road']==ri:continue
   distance,t,q=near(p,s['a'],s['b'])
   if distance<=width[s['cls']]/2+width[r['class']]/2 and distance<=8:options.append((distance,i,t,q))
  if options:
   distance,i,t,q=min(options,key=lambda v:(v[0],v[1]));segs[i]['cuts'].append(t)
   if distance>1e-5:snaps.append((p,q,ri,segs[i]['road']))
nodes=[];lookup={};edges=[];edgelook=set()
def node(p):
 key=tuple(round(v,5) for v in p)
 if key not in lookup:lookup[key]=len(nodes);nodes.append(list(key))
 return lookup[key]
def edge(a,b,ri,connector=False,other=None):
 ai,bi=node(a),node(b)
 if ai==bi:return
 key=tuple(sorted((ai,bi)))
 if key in edgelook:return
 edgelook.add(key);edges.append([ai,bi,ri,connector,other])
for s in segs:
 cuts=sorted(set(round(t,10) for t in s['cuts']));pts=[[s['a'][k]+(s['b'][k]-s['a'][k])*t for k in (0,1)] for t in cuts]
 for a,b in zip(pts,pts[1:]):edge(a,b,s['road'])
for a,b,ri,other in snaps:edge(a,b,ri,True,other)
adj=[[] for _ in nodes]
for a,b,ri,_,_ in edges:
 length=math.dist(nodes[a],nodes[b]);adj[a].append((b,length,ri));adj[b].append((a,length,ri))
components=[];seen=set()
for i in range(len(nodes)):
 if i in seen:continue
 todo=[i];seen.add(i);comp=[]
 while todo:
  a=todo.pop();comp.append(a)
  for b,_,_ in adj[a]:
   if b not in seen:seen.add(b);todo.append(b)
 components.append(comp)
components.sort(key=lambda c:-len(c));main=set(components[0])
# Seeds lie on the accepted land lobes. Geodesic nearest-seed regions follow streets and bridges.
seeds={'core':source(city['core']),'foundry':[680,95],'docks':[430,460],'bazaar':[1090,310],
 'heights':[1500,440],'sprawl':[1000,820],'smelter':[1510,890],'riviera':[125,845],'wastes':[1820,160]}
seednodes={k:min(range(len(nodes)),key=lambda i:math.dist(nodes[i],p)) for k,p in seeds.items()}
regions=[None]*len(nodes);distance=[float('inf')]*len(nodes);todo=[]
for d,i in seednodes.items():distance[i]=0;regions[i]=d;heapq.heappush(todo,(0,d,i))
while todo:
 dd,d,a=heapq.heappop(todo)
 if dd!=distance[a] or d!=regions[a]:continue
 for b,l,ri in adj[a]:
  nd=dd+l
  if nd<distance[b]:distance[b]=nd;regions[b]=d;heapq.heappush(todo,(nd,d,b))
for i,d in enumerate(regions):
 if d is None:regions[i]=min(seeds,key=lambda d:math.dist(nodes[i],seeds[d]))
# Closest road assignment also handles building-only islands without inventing road links.
assign=[]
for b in city['boxes']:
 p=source([(b[0]+b[2])/2,(b[1]+b[3])/2]);i=min(range(len(nodes)),key=lambda i:math.dist(nodes[i],p));assign.append(regions[i])
# Match render.py's exact painter order, preserving original box IDs for stable windows.
boxes=[[i,*b[:4],b[4]**1.25,b[5]] for i,b in enumerate(city['boxes'])]
boxes.sort(key=lambda b:(b[3]+b[4],b[1]+b[2]));after=[[] for _ in boxes];indeg=[0]*len(boxes)
def behind(a,b):return (a[3]<=b[1]+1e-6 and a[2]<b[4]-1e-6 and a[4]>b[2]+1e-6) or (a[4]<=b[2]+1e-6 and a[1]<b[3]-1e-6 and a[3]>b[1]+1e-6)
for i,a in enumerate(boxes):
 for j in range(i+1,len(boxes)):
  b=boxes[j]
  if behind(a,b):after[i].append(j);indeg[j]+=1
  elif behind(b,a):after[j].append(i);indeg[i]+=1
ready=[i for i,d in enumerate(indeg) if d==0];seq=[]
while ready:
 ready.sort(key=lambda i:-(boxes[i][3]+boxes[i][4]));i=ready.pop();seq.append(boxes[i][0])
 for j in after[i]:
  indeg[j]-=1
  if not indeg[j]:ready.append(j)
seq.extend(b[0] for b in boxes if b[0] not in set(seq))
# Exact reference ground, cast shadows, trees and street glow, before architectural rendering.
script=(ROOT/'pipeline/render.py').read_text();prefix=script.split('def edge_fade(')[0]
# Skip quadratic order a second time; ground uses no painter sequence.
start=prefix.index('# ---------- painter order');end=prefix.index('# ---------- soft cast shadows')
prefix=prefix[:start]+prefix[end:]
ns={'__file__':str(ROOT/'pipeline/render.py')};exec(compile(prefix,'render-ground','exec'),ns)
base=ns['base'];base.save(ROOT/'ground.png');ns['street_glow'].save(ROOT/'street-glow.png')
# Reference roof emission, occluded in the same painter order, without any load-dependent windows.
from PIL import ImageDraw, ImageFilter
import numpy as np
em=Image.new('RGB',base.size,(0,0,0));dr=ImageDraw.Draw(em);P=ns['P'];SS=ns['SS']
roofpal={'low':(58,80,138),'mid':(86,136,224),'high':(170,216,255),'hero':(236,248,255),'land':(255,214,130)}
for bid in seq:
 x0,y0,x1,y1,raw,kind=city['boxes'][bid];h=raw**1.25
 sx,sy=source([(x0+x1)/2,(y0+y1)/2]);v=max(0,min(1,min(sx,2000-sx,sy,1125-sy)/210));f=v*v*(3-2*v)
 if f<.02:continue
 k=kind if kind in ('hero','land') else 'low' if h<3 else 'mid' if h<8 else 'high'
 dr.polygon([P(x0,y1),P(x1,y1),P(x1,y1,h),P(x0,y1,h)],fill=(0,0,0))
 dr.polygon([P(x1,y1),P(x1,y0),P(x1,y0,h),P(x1,y1,h)],fill=(0,0,0))
 roof=[P(x0,y0,h),P(x1,y0,h),P(x1,y1,h),P(x0,y1,h)]
 dr.polygon(roof,fill=tuple(int(v*{'hero':.8,'land':.8,'high':.30,'mid':.12,'low':.03}[k]*f) for v in roofpal[k]))
 if k in ('hero','land'):
  col=(255,255,255) if k=='hero' else (255,220,150)
  dr.line([P(x1,y1),P(x1,y1,h)],fill=col,width=2*SS);dr.line(roof+[roof[0]],fill=col,width=2*SS)
small=em.resize((base.width//4,base.height//4),Image.BILINEAR);acc=np.zeros((small.height,small.width,3),dtype=np.float32)
for radius,weight in [(2.5,.55),(8,.4),(24,.34)]:acc+=np.asarray(small.filter(ImageFilter.GaussianBlur(radius)))*weight
Image.fromarray(np.clip(acc,0,255).astype('uint8')).resize(base.size,Image.BICUBIC).save(ROOT/'roof-glow.png')
pack={'schema':1,'scale':12,'referenceSize':[2400,1200],'order':seq,'districts':assign,'seeds':seeds,
 'seedNodes':seednodes,'keys':{'owner':488,'hubs':[463,477,1910,2332,3032,1853]},
 'graph':{'nodes':nodes,'edges':edges,'districts':regions,'components':components,
 'isolatedRoads':sorted(set(e[2] for e in edges if e[0] not in main))}}
(ROOT/'pack.json').write_text(json.dumps(pack,separators=(',',':')))
print('Packed',len(nodes),'nodes',len(edges),'edges; components',[len(c) for c in components],'; isolated roads',pack['graph']['isolatedRoads'])
