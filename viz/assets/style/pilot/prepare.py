"""Cut the generated strip and clean its matte; does not synthesize lighting states."""
from pathlib import Path
import json
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont
ROOT=Path(__file__).resolve().parents[1]
SHOTS=Path('./work/shots')
raw=Image.open(ROOT/'raw/core-sky-a-strip-03.png').convert('RGBA')
# Manual architectural outline, viewed on the source; slight inset removes exterior bloom.
# Shared silhouette is a cutout matte, not proof that interior generation is pixel-identical.
poly=[(244,27),(271,39),(271,53),(316,74),(316,128),(335,140),(335,216),(365,229),(365,498),(396,511),(396,620),(228,699),(58,620),(58,515),(89,499),(89,238),(134,216),(134,152),(163,136),(163,76),(215,49),(215,38)]
# Translate the front vertex to canonical (216,700), canvas 432x724.
poly=[(x-12,y+1) for x,y in poly]
mask=Image.new('L',(432*4,724*4));ImageDraw.Draw(mask).polygon([(x*4,y*4) for x,y in poly],fill=255)
mask=mask.resize((432,724),Image.Resampling.LANCZOS)
m=np.array(mask); inside=m>=250
# Common 3px edge band is replaced with nearest inward opaque RGB to remove matte colours.
inner=np.array(mask.filter(ImageFilter.MinFilter(7)))>=250
edge=(m>0)&~inner
states=[0,25,50,75,100];sprites=[];stats=[]
for i,state in enumerate(states):
    # Source cells are shifted by about 5px per cell; use measured plinth-front anchors.
    left=i*434+12-i*5
    c=raw.crop((left,-1,left+432,723));a=np.array(c)
    ys,xs=np.where(edge | ((m>0)&(a[:,:,3]<240)))
    for y,x in zip(ys,xs):
        y0=max(0,y-10);y1=min(724,y+11);x0=max(0,x-10);x1=min(432,x+11)
        yy,xx=np.where(inner[y0:y1,x0:x1]&(a[y0:y1,x0:x1,3]>=240))
        if len(xx):
            yy+=y0;xx+=x0;j=np.argmin((yy-y)**2+(xx-x)**2);a[y,x,:3]=a[yy[j],xx[j],:3]
    # Material is represented in RGB; architectural matte supplies consistent opaque coverage.
    a[:,:,3]=m;a[m==0,:3]=0
    sprite=Image.fromarray(a);sprite.save(ROOT/f'core-sky-a-{state}.png');sprites.append(sprite)
    stats.append({'state':state,'sourceCrop':[left,-1,left+432,723], 'meanRGBInside':np.round(a[inner,:3].mean(axis=0),3).tolist(),'sourceTransparentPixelsInsideMatte':int(((np.array(c)[:,:,3]<240)&inner).sum())})
# Presentation: no invented building lights; separate ground-only light spill for review.
font=ImageFont.truetype('/System/Library/Fonts/Menlo.ttc',14)
small=ImageFont.truetype('/System/Library/Fonts/Menlo.ttc',11)
sheet=Image.new('RGB',(1100,660),'#101c2b');d=ImageDraw.Draw(sheet)
d.text((24,18),'CORE / CASCADE  |  five drawn load states',font=font,fill='#e0e9ef')
d.text((24,46),'1x = measured 1600 x 1000 overview; 3x = enlarged inspection. No runtime integration.',font=small,fill='#9eafc0')
basewidth=338;worldwidth=3.536;K=7.549019607843137
for row,mul in enumerate([1,3]):
    baseline=[205,550][row];scale=worldwidth*K/basewidth*mul
    for i,(state,sprite) in enumerate(zip(states,sprites)):
        cx=110+i*220
        w=round(432*scale);h=round(724*scale);anchor=(round(216*scale),round(700*scale))
        pos=(cx-anchor[0],baseline-anchor[1])
        if state:
            spill=Image.new('RGBA',sheet.size);sd=ImageDraw.Draw(spill)
            rx=round(20*mul);ry=round(7*mul)
            sd.ellipse((cx-rx,baseline-ry,cx+rx,baseline+ry),fill=(92,193,220,round(34*state/100)))
            spill=spill.filter(ImageFilter.GaussianBlur(4*mul));sheet.paste(spill,(0,0),spill)
        scaled=sprite.resize((w,h),Image.Resampling.LANCZOS);sheet.paste(scaled,pos,scaled)
        d=ImageDraw.Draw(sheet);d.text((cx-34,baseline+16),f'{state:3d}% / {mul}x',font=small,fill='#d0dce7')
d.text((24,611),'Review candidate: silhouette matte locked; interior facade drift and camera residual remain.',font=small,fill='#f0c58c')
d.text((24,632),'3 generator calls / budget exhausted. Ground spill is a separate presentation layer.',font=small,fill='#9eafc0')
sheet.save(SHOTS/'core-sky-a-states.png')
# Full-resolution light/dark matte control, without ground spill.
qa=Image.new('RGB',(432*5,724*2),'#101c2b');qa.paste('#e5e7eb',(0,724,2160,1448))
for i,s in enumerate(sprites):
    qa.paste(s,(i*432,0),s);qa.paste(s,(i*432,724),s)
qa.save(SHOTS/'core-sky-a-matte-check.png')
meta={'status':'checkpoint candidate; not production accepted','source':'raw/core-sky-a-strip-03.png','generatorCalls':3,'canvas':[432,724],'anchor':[216,700],'baseVertices':{'left':[46,621],'front':[216,700],'right':[384,621],'backInferred':[214,542]},'measuredBaseWidthPx':338,'measuredBaseDepthPx':158,'measuredRatio':338/158,'targetRatio':2,'baseWorld':[3.536,1.768],'overviewBaseCSS':[26.6933333333,13.3466666667],'scaleOverview':worldwidth*K/basewidth,'cameraDepthResidualCSS':(169-158)*worldwidth*K/basewidth,'measuredRoofLiftWorldApprox':(542-28)*worldwidth/basewidth,'outline':'common manually cut matte; interior geometry remains generated, small drift','matte':'shared antialiased polygon; nearest inward RGB in 3px edge band; no whole-image recolouring','states':stats}
(ROOT/'pilot/core-sky-a.json').write_text(json.dumps(meta,indent=2)+'\n')
print(json.dumps(meta,indent=2))
