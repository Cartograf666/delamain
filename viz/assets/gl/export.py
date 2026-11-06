"""Export the accepted cp.py draw geometry; never export city raster pixels.
Run from the worktree root. Only ad art is copied. Source provenance is retained.
"""
import subprocess, ast, inspect, json, math, os, pathlib, random, shutil, hashlib
import numpy as np
from PIL import Image
ROOT=pathlib.Path(__file__).resolve().parent
SRC=pathlib.Path('./work/city/mock')
source=(SRC/'cp.py').read_text()
# Execute the authoritative placement, projection and palette sections verbatim.
prefix=source[:source.index('# ---------- ground in the source frame')]
ns={'__name__':'export_source','__file__':str(SRC/'cp.py')}
exec(prefix,ns)
ns['ACT']='idle'
exec(source[source.index('def edge_fade'):source.index('# ---------- signs decided')],ns)
class Null:
 def __getattr__(self,k): return lambda *a,**kw:None
null=Null()
signLayers=[]
commands=[]; windows=[]; machines=[]; owners={}; surfaces={}; layer=0
selected=json.loads(subprocess.check_output(['node',str(ROOT/'select-pads.cjs'),str(SRC/'prototype')],text=True))
class Recorder:
 def polygon(self,pts,fill=None,**kw):
  global layer
  layer+=1
  pts=[[round(x/2*.75,4),round(y/2*.75-40,4)] for x,y in pts]
  if not fill or len(pts)<3:return
  color=list(fill[:3]);caller=inspect.currentframe().f_back
  owner=ns.get('cur_t',-1);owners[layer]=owner
  if caller.f_code.co_name=='sign':
   signLayers.append(layer)
  if caller.f_code.co_name=='wall' and 'q' not in caller.f_locals:
   surfaces.setdefault(owner,[]).append({'kind':'wall','points':pts,'layer':layer})
  elif caller.f_code.co_name=='<module>' and len(pts)==4 and max(color)<80 and all(abs(abs((pts[(i+1)%4][1]-pts[i][1])/(pts[(i+1)%4][0]-pts[i][0] or 1e-9))-.5)<.01 for i in range(4)):
   surfaces.setdefault(owner,[]).append({'kind':'roof','points':pts,'layer':layer})
  if caller.f_code.co_name=='wall' and 'q' in caller.f_locals and len(pts)==4:
   windows.append([pts,color,layer,ns.get('cur_d',0)])
  else: commands.append(['p',pts,color,layer])
 def line(self,pts,fill=None,width=1,**kw):
  global layer
  layer+=1
  owner=ns.get('cur_t',-1);owners[layer]=owner
  if ns['boxes'][owner][5]=='b' and inspect.currentframe().f_back.f_code.co_name=='<module>' and max(fill[:3])>100:
   fill=(45,40,70)
  commands.append(['l',[[round(x/2*.75,4),round(y/2*.75-40,4)] for x,y in pts],list(fill[:3]),layer,width/2*.75])
 def ellipse(self,bbox,fill=None,**kw):
  x0,y0,x1,y1=bbox
  self.polygon([((x0+x1)/2+(x1-x0)/2*math.cos(i*math.tau/12),(y0+y1)/2+(y1-y0)/2*math.sin(i*math.tau/12)) for i in range(12)],fill)
ns.update(d=Recorder(),e=null,idd=null,bid=null,kdd=null,cur_t=0,cur_d=0,pads=[],ants=[],owner_top=None,kcount=0,owner_kid=0)
# Source's initial per-building PRNG state, without raster shadow/pool operations.
info=source[source.index('info = {}'):source.index('    q = [P(x0, y0)',source.index('info = {}'))]
info=info[info.index('info = {}'):].replace("pool = Image.new('RGB', (CW, CH), (0, 0, 0))",'pool = None').replace('pd_ = ImageDraw.Draw(pool)','pd_ = None').replace("shd = Image.new('L', (CW, CH), 0)",'shd = None').replace('sd = ImageDraw.Draw(shd)','sd = None')
# Ordinary facades share the same warm grid; landmark styles stay source-authored.
info=info.replace("    sign = c == 'b'", "    if c == 'b': style='warm'\n    sign = c == 'b'")
exec(info,ns)
exec(source[source.index('# ---------- painter order'):source.index('AS = ')],ns)
main=source[source.index('for t in seq:'):source.index('# ---------- reflections, bloom, fog')]
# Raster-only notable exceptions become geometry on the exact placed footprints.
a=main.index('        if not m.get(\'grp\'):')
b=main.index("        if m.get('grp'):")
main=main[:a]+main[b:]
a=main.index("        if m.get('art'):")
b=main.index("    key = c in",a)
replacement='''        # Non-GRP source sprites: retain site/footprint; use a small geometric silhouette.
        if 'landing-pad' in c:
            hh_ = .6
            top = [P(x0,y0,hh_),P(x1,y0,hh_),P(x1,y1,hh_),P(x0,y1,hh_)]
            d.polygon(top, fill=tone(T_,cx,cy,f))
            d.line(top+[top[0]],fill=tuple(int(v*.4*f) for v in acc),width=SS)
            d.line([P(x0+3,cy,hh_),P(x1-3,cy,hh_)],fill=tuple(int(v*.5*f) for v in acc),width=SS)
        else:
            for level in range(4):
                inset=(x1-x0)*level*.105
                hh_=h*(.25+level*.25)
                X0_,Y0_,X1_,Y1_=x0+inset,y0+inset,x1-inset,y1-inset
                wall(X0_,Y1_,X1_,Y1_,hh_,L_,r,'warm',act,acc,f,1.4,cx,cy)
                wall(X1_,Y1_,X1_,Y0_,hh_,R_,r,'warm',act,acc,f,1.1,cx,cy)
                top=[P(X0_,Y0_,hh_),P(X1_,Y0_,hh_),P(X1_,Y1_,hh_),P(X0_,Y1_,hh_)]
                d.polygon(top,fill=tone(T_,cx,cy,f))
        continue
'''
main=main[:a]+replacement+main[b:]
# Repair the source's two-face roof equipment. Keep both exposed walls and top.
# Clear complete equipment groups on selected landing roofs, not just the marker pixels.
needle='''            d.polygon([P(ux, uy + 3, h)'''
start=main.index(needle);end=main.index('    if h >= 9',start)
main=main[:start]+'''            roof_equipment(ux,uy,h,hh,cx,cy,f,top,t)
'''+main[end:]
def roof_equipment(ux,uy,h,hh,cx,cy,f,roof,building):
 P=ns['P'];tone=ns['tone'];D=ns['d'];center=[sum(p[0] for p in roof)/len(roof)*.375,sum(p[1] for p in roof)/len(roof)*.375-40]
 if any(math.hypot(center[0]-p['p'][0],center[1]-p['p'][1])<.2 for p in selected): return
 faces=[[P(ux,uy+3,h),P(ux+3,uy+3,h),P(ux+3,uy+3,hh),P(ux,uy+3,hh)],
        [P(ux+3,uy+3,h),P(ux+3,uy,h),P(ux+3,uy,hh),P(ux+3,uy+3,hh)],
        [P(ux,uy,hh),P(ux+3,uy,hh),P(ux+3,uy+3,hh),P(ux,uy+3,hh)]]
 layers=[]
 for face,color in zip(faces,[(24,23,44),(15,15,32),(36,34,62)]):
  D.polygon(face,fill=tone(color,cx,cy,f));layers.append(layer)
 machines.append({'building':building,'roofCenter':center,'layers':layers,'faces':[[[x*.375,y*.375-40] for x,y in f] for f in faces]})
ns['roof_equipment']=roof_equipment
def on_pad_roof(roof):
 center=[sum(p[0] for p in roof)/len(roof)*.375,sum(p[1] for p in roof)/len(roof)*.375-40]
 return any(math.hypot(center[0]-p['p'][0],center[1]-p['p'][1])<.2 for p in selected)
ns['on_pad_roof']=on_pad_roof
main=main.replace('if h >= 9 and r.random() < .22 and not key:', 'if h >= 9 and r.random() < .22 and not key and not on_pad_roof(top):')
exec(main,ns)
meta=json.loads((SRC/'aq-idle.json').read_text())
def screen(q):return [round(q[0]*.75,4),round(q[1]*.75-40,4)]
# Use the prototype's already visibility-filtered optional windows, tower windows, roofs and ads.
# Depth lookup finds the original emitting facade, so overlays cannot bleed through a nearer wall.
def inside(p,poly):
 x,y=p;hit=False
 for a,b in zip(poly,poly[1:]+poly[:1]):
  if (a[1]>y)!=(b[1]>y) and x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]:hit=not hit
 return hit
faces=[c for c in commands if c[0]=='p']
def front(q):
 p=[sum(v[0] for v in q)/len(q),sum(v[1] for v in q)/len(q)]
 for c in reversed(faces):
  xs=[v[0] for v in c[1]];ys=[v[1] for v in c[1]]
  if min(xs)<=p[0]<=max(xs) and min(ys)<=p[1]<=max(ys) and inside(p,c[1]):return c[3]+.15
 return layer+1
optional=[]
for key in ['wins','kwins']:
 for i,w in enumerate(meta[key]):
  q=[screen(w[j:j+2]) for j in range(0,8,2)]
  x,y=np.mean(q,axis=0);X=(x/.75-ns['ox']/2+2*((y+40)/.75-ns['oy']/2))/2;Y=X-(x/.75-ns['ox']/2)
  di=ns['dist_id'](X,Y)
  optional.append([q,[150,225,255] if key=='kwins' else [255,168,84],front(q),di,key=='kwins'])
ads=[]
for i,w in enumerate(meta['ads']):
 q=[screen(w[j:j+2]) for j in range(0,8,2)];ads.append([q,front(q)])
geo=json.loads((ROOT.parent/'live/aquarium/geometry.json').read_text())
out={'w':1800,'h':780,'commands':commands,'windows':windows,'optional':optional,'ads':ads,'maxLayer':layer+100,'land':geo['land'],'roads':ns['roads'],'trees':ns['trees'],'projection':{'ox':meta['ox'],'oy':meta['oy'],'g':meta['g'],'center':meta['center']},'sq':screen(meta['sq']),'hero':screen(meta['hero']),'pads':meta['pads'],'sources':{f:hashlib.sha256((SRC/f).read_bytes()).hexdigest() for f in ['cp.py','city.json','aq-idle.json','aq-full.json','pack_aq.py']}}
prototype=json.loads((SRC/'prototype/data.js').read_text().split('=',1)[1].rstrip(';\n'))
out['signLayers']=signLayers
out['equipment']=machines;out['landingPads']=selected;out['owners']=owners
out['buildings']=[{'id':i,'kind':b[5],'ground':screen([v/2 for v in ns['P']((b[0]+b[2])/2,(b[1]+b[3])/2)]),'surfaces':surfaces.get(i,[])} for i,b in enumerate(ns['boxes'])]
out['prototypeRoofs']=prototype['roofs'];out['prototypePads']=prototype['pads']
(ROOT/'scene.json').write_text(json.dumps(out,separators=(',',':')))
(ROOT/'art').mkdir(exist_ok=True)
for f in (SRC/'prototype/art').glob('ad-*.png'):shutil.copyfile(f,ROOT/'art'/f.name)
prototype.pop('events',None)
(ROOT/'live-data.json').write_text(json.dumps(prototype,separators=(',',':')))
for f in (SRC/'prototype/art').glob('c-*.png'):shutil.copyfile(f,ROOT/'art'/f.name)
print('Equipment',len(machines),'cleared selected roofs',len(selected))
print('Exported',len(ns['boxes']),'boxes',len(commands),'commands',len(windows),'base windows',len(optional),'optional windows')
