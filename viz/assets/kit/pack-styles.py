"""Crop the generated flat 4x3 atlas; preserve its artwork and extract two pane masks."""
from pathlib import Path
from PIL import Image
import json,numpy as np
R=Path(__file__).parent
im=Image.open(R/'_raw/pilot2-styles.png').convert('RGBA');m=json.loads((R/'kit.json').read_text())
base=Image.new('RGBA',(4*34,3*30));em=Image.new('RGBA',base.size);modules={}
styles=['glass-tower','glass-slab','office-band','house-row']
for col,style in enumerate(styles):
 for row,slot in enumerate(['ground','mid','top']):
  source=(col*384,round(row*1024/3),(col+1)*384,round((row+1)*1024/3))
  tile=im.crop(source).resize((32,28),Image.Resampling.LANCZOS)
  # Explicit interiors avoid cornices/lintels; two large windows, stable across all floors.
  rects=([(1,2,14,25),(17,2,14,25)] if col==0 else [(1,10,14,13),(17,10,14,13)] if col==1 else [(4,9,10,14),(18,9,10,14)] if col==2 else [(4,8,10,15),(19,8,10,15)])
  if row==2 and col in (1,2):rects=[(x,y+1,w,h-1) for x,y,w,h in rects]
  x,y=col*34+1,row*30+1;base.paste(tile,(x,y));e=Image.new('RGBA',(32,28));arr=np.asarray(tile).copy()
  ea=np.zeros_like(arr)
  for wx,wy,ww,hh in rects:
   # Use source-reflection variation in the cool emission, never generate new facade detail.
   q=arr[wy:wy+hh,wx:wx+ww,:3].astype(float);v=.8+.2*q[:,:,2]/255
   ea[wy:wy+hh,wx:wx+ww,:3]=(v[:,:,None]*np.array([133,180,216])).astype('uint8');ea[wy:wy+hh,wx:wx+ww,3]=255
  em.paste(Image.fromarray(ea),(x,y));modules[style+'-'+slot]={'rect':[x,y,32,28],'windows':[{'rect':list(r),'threshold':25+50*i} for i,r in enumerate(rects)],'source':list(source)}
m['styleAtlas']={'base':'styles-base.png','emissive':'styles-emissive.png','size':list(base.size),'source':'_raw/pilot2-styles.png'};m['styleModules']=modules
for style,bay in [('glass-tower',10),('glass-slab',14),('office-band',11),('house-row',8)]:
 s=m['styles'][style];s['bay']=bay;s['floor']=bay*28/32;s['emission']=.42;s['cap']=2 if style=='glass-tower' else 1
 s['facade']={r:style+'-'+r for r in ['ground','mid','top']};s['leftTint']='rgba(42,104,166,0.05)';s['rightTint']='rgba(1,13,36,0.40)'
 if style=='office-band':s.pop('band',None)
# Geometry/roof/corner recipe metadata in kit.json is retained on repack.
base.save(R/'styles-base.png');em.save(R/'styles-emissive.png');(R/'kit.json').write_text(json.dumps(m,indent=2)+'\n')
