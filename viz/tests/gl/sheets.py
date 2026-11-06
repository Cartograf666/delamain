from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import json
P=Path('./work/shots');font=ImageFont.truetype('/System/Library/Fonts/Menlo.ttc',19)
def sheet(name,tiles,cols=2,w=1280,h=720):
 rows=(len(tiles)+cols-1)//cols;out=Image.new('RGB',(cols*w,rows*(h+38)),(6,6,16));d=ImageDraw.Draw(out)
 for i,(file,label)in enumerate(tiles):
  x=i%cols*w;y=i//cols*(h+38);im=Image.open(P/file).convert('RGB').resize((w,h),Image.Resampling.LANCZOS);out.paste(im,(x,y+38));d.text((x+16,y+9),label,font=font,fill=(190,210,235))
 out.save(P/name)
# Native-pixel 6x crops: no upscaling of UI evidence.
def crop(file,name,x,y,w,h):
 im=Image.open(P/file);x=max(0,min(im.width-w,round(x)));y=max(0,min(im.height-h,round(y)));im.crop((x,y,x+w,y+h)).save(P/name)
d=json.loads((P/'gl2-visual.json').read_text());trace=d['trace'];sample=min(trace,key=lambda r:abs(r['t']-trace[0]['t']-1100));tx,ty=d['landingSetup']['target'];k=2*max(1920/1800,1080/780)*6;px=(sample['x']-(tx-110))*k;py=(sample['y']-sample['z']-(ty-90))*k
crop('gl2-gpu-roofs.png','gl2-crop-roofs.png',400,0,1280,720)
crop('gl2-gpu-junction.png','gl2-crop-junction.png',900,0,1280,720)
crop('gl2-trail6.png','gl2-crop-trail.png',px-640,py-360,1280,720)
crop('gl2-question6.png','gl2-crop-question.png',1180,600,1280,720)
scene=json.loads(Path('viz/assets/gl/scene.json').read_text());bid=d['uplight'][0]['building'];b=next(b for b in scene['buildings']if b['id']==bid);pts=[p for f in b['surfaces']for p in f['points']];cx=(min(p[0]for p in pts)+max(p[0]for p in pts))/2;cy=(min(p[1]for p in pts)+max(p[1]for p in pts))/2;k=2*max(1920/1800,1080/780)
for ms in [200,800,1400]:crop(f'gl2-uplight-{ms}.jpg',f'gl2-uplight-detail-{ms}.png',(cx-206.6666667)*k-960,cy*k-540,1920,1080)
sheet('gl2-vs-prototype.png',[(f'gl2-{kind}-{view}.png',label) for view in ['full','plaza'] for kind,label in [('prototype',f'PROTOTYPE / {view}'),('gpu',f'GPU / {view}')]])
sheet('gl2-zoom6.png', [('gl2-crop-roofs.png','6x / complete roof boxes and clear pads'),('gl2-crop-junction.png','6x / single-colour rounded roads'),('gl2-crop-trail.png','6x / continuous tapered trails'),('gl2-crop-question.png','6x / continuous question glyph')])
sheet('gl2-landing.png',[(f'gl2-landing-{phase}.png',label) for phase,label in [('approach','Final approach'),('aligned','Aligned vertical descent'),('parked','Touchdown')]]+[(f'gl2-uplight-detail-{ms}.png',f'Facade uplight / +{ms} ms')for ms in [200,800,1400]],3,960,540)
names=['CORE','DOCKS','SPRAWL','FOUNDRY','RIVIERA','WASTES','BAZAAR','HEIGHTS','SMELTER'];sheet('gl2-material.png',[(f'gl2-material-{i}.png',n+' / ordinary shared material; landmarks exempt') for i,n in enumerate(names)],3,960,540)
d=json.loads((P/'gl2-visual.json').read_text());trace=d['trace'];descent=[p for p in trace if p.get('land')];proof={'durationSeconds':(trace[-1]['t']-trace[0]['t'])/1000,'maxAlignedHorizontalError':max(p['error'] for p in descent),'verticalMonotone':all(a['z']>=b['z'] for a,b in zip(descent,descent[1:])),'touchdownError':trace[-1]['error'],'touchdownHeightError':trace[-1]['z']-trace[-1]['roof'],'finalState':trace[-1]['state'],'uplight':d.get('uplight'),'errors':d['errors']};assert proof['maxAlignedHorizontalError']<1.3;assert proof['verticalMonotone'];assert proof['touchdownError']<.01;assert proof['finalState']=='park';(P/'gl2-landing-checks.json').write_text(json.dumps(proof,indent=2));print(proof)
