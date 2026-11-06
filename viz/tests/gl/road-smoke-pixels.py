"""Paired native-view depth evidence, with a deliberately front-drawn positive control."""
import json
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
import math
import numpy as np
p=Path(sys.argv[1])
proof=json.loads((p/'smoke-depth.json').read_text())
a=np.array(Image.open(p/'smoke-depth-on.png').convert('RGB')).astype(int)
b=np.array(Image.open(p/'smoke-depth-off.png').convert('RGB')).astype(int)
c=np.array(Image.open(p/'smoke-depth-front-control.png').convert('RGB')).astype(int)
shape=(a.shape[1],a.shape[0]);buildings=np.zeros(a.shape[:2],dtype=bool)
# Erode each face separately: eroding a union would bridge subpixel street gaps.
for polygon in proof['polygons']:
 x0=max(0,math.floor(min(q[0] for q in polygon))-4);y0=max(0,math.floor(min(q[1] for q in polygon))-4)
 x1=min(shape[0],math.ceil(max(q[0] for q in polygon))+5);y1=min(shape[1],math.ceil(max(q[1] for q in polygon))+5)
 if x1<=x0 or y1<=y0:continue
 face=Image.new('L',(x1-x0,y1-y0));ImageDraw.Draw(face).polygon([(q[0]-x0,q[1]-y0) for q in polygon],fill=255)
 buildings[y0:y1,x0:x1]|=np.array(face.filter(ImageFilter.MinFilter(7)))>0
region=Image.new('L',shape);draw=ImageDraw.Draw(region)
for site in proof['sites']:draw.rectangle(site['box'],fill=255)
region=np.array(region)>0
changed=np.max(abs(a-b),axis=2)>2
control=np.max(abs(c-b),axis=2)>2
hidden=region&buildings
result={'hiddenBasePixelsChanged':int((changed&hidden).sum()),'frontControlHiddenPixelsChanged':int((control&hidden).sum()),'visibleUpperSmokePixels':int((changed&region&~buildings).sum()),'nativeZoom':proof['nativeZoom']}
assert result['hiddenBasePixelsChanged']==0,result
assert result['frontControlHiddenPixelsChanged']>100,result
assert result['visibleUpperSmokePixels']>1000,result
(p/'smoke-depth-pixels.json').write_text(json.dumps(result,indent=2))
print(result)
