"""Cut generated sheets, align existing windows, correct seams, separate emission.
No facade/roof artwork is generated here. All output pixels derive from raw PNGs.
"""
from pathlib import Path
import json, hashlib
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parent
FAMILIES=['glass','office','house']
SLOTS=[(r,c,v) for r in ['ground','mid','top'] for c in ['edgeL','middle','edgeR'] for v in range(1,(3 if r=='mid' and c=='middle' else 2)+1)]
WINS=[(3,8),(10,15),(17,22),(24,29)]

def bright(a):
    r,g,b=a[:,:,0],a[:,:,1],a[:,:,2]
    return (r>130)&(g>105)&(((r>b*1.08)&(g>b*.95))|((b>145)&(g>135)))

def normalize(tile):
    a=np.array(tile.convert('RGB')).astype(float); h,w=a.shape[:2]
    m=bright(a);m[:int(h*.2)]=False;m[int(h*.96):]=False
    src=[0.];dst=[0.];bounds=[]
    for i,(lo,hi) in enumerate(WINS):
        x0,x1=int(i*w/4),int((i+1)*w/4)
        counts=m[:,x0:x1].sum(axis=0)
        xs=np.where(counts>h*.12)[0]+x0
        if len(xs)<w*.06:raise ValueError('Missing generated window')
        l,r=int(xs[0]),int(xs[-1]+1);bounds.append((l,r));src.extend([l,r]);dst.extend([lo,hi])
    src.append(w);dst.append(32)
    ys=np.where(m.sum(axis=1)>w*.25)[0]
    if len(ys)<h*.15:raise ValueError('Missing window row')
    # Ignore isolated bright cornice lines; join small mullion/door-bar gaps.
    runs=np.split(ys,np.where(np.diff(ys)>10)[0]+1)
    pane=max(runs,key=lambda run:run[-1]-run[0])
    top,bottom=int(pane[0]),int(pane[-1]+1)
    # Inverse piecewise sampling moves existing source details onto a shared grid.
    xx=np.clip(np.interp(np.arange(256)/8+.0625,dst,src).astype(int),0,w-1)
    yy=np.clip(np.interp(np.arange(128)/8+.0625,[0,4,12,16],[0,top,bottom,h]).astype(int),0,h-1)
    return Image.fromarray(a[yy[:,None],xx].astype('uint8')).resize((32,16),Image.Resampling.LANCZOS)

modules=[];tiles=[];emissions=[];audit=[]
for family in FAMILIES:
    sheet=Image.open(ROOT/'_raw'/f'{family}.png').convert('RGB');sw,sh=sheet.size
    family_tiles=[]
    for i,(row,col,design) in enumerate(SLOTS):
        rect=[round(i%4*sw/4),round(i//4*sh/5),round((i%4+1)*sw/4),round((i//4+1)*sh/5)]
        tile=normalize(sheet.crop(rect));family_tiles.append(np.array(tile))
        audit.append({'id':f'{family}-{row}-{col}-{design}','source':f'_raw/{family}.png','crop':rect})
    # Canonical seam pixels are sampled from generated mid/middle art, not painted.
    ref=family_tiles[8];side=ref[2:14,0].mean(axis=0).astype('uint8');band=ref[0,2:30].mean(axis=0).astype('uint8')
    for i,(row,col,design) in enumerate(SLOTS):
        a=family_tiles[i];a[:,0]=side;a[:,-1]=side;a[0]=band;a[-1]=band
        ident=f'{family}-{row}-{col}-{design}'
        base=a.copy();emit=np.zeros((16,32,4),dtype='uint8');windows=[]
        # Assign a stable permutation so each level adds exactly one generated pane.
        order=sorted(range(4),key=lambda k:hashlib.sha256(f'{ident}:{k}'.encode()).digest())
        for k,(lo,hi) in enumerate(WINS):
            lo,hi=lo-1,hi+1
            region=a[3:13,lo:hi];mask=bright(region.astype(float))
            dark=(region.astype(float)*np.array([.14,.22,.32])).astype('uint8')
            base[3:13,lo:hi][mask]=dark[mask]
            e=emit[3:13,lo:hi];e[:,:,:3]=region;e[:,:,3]=mask*255
            windows.append({'rect':[lo,3,hi-lo,10],'threshold':(order.index(k)+1)*25})
        # Stray generated door highlights outside the canonical panes are unlit structure.
        stray=bright(base.astype(float));base[stray]=(base[stray]*np.array([.14,.22,.32])).astype('uint8')
        modules.append({'id':ident,'family':family,'row':row,'column':col,'design':design,'size':[32,16],'windows':windows})
        tiles.append(Image.fromarray(base).convert('RGBA'));emissions.append(Image.fromarray(emit))

sheet=Image.open(ROOT/'_raw/roofs.png').convert('RGB');sw,sh=sheet.size
for f,family in enumerate(FAMILIES):
    for j,name in enumerate(['flat','machinery','helipad' if family=='glass' else 'setback']):
        rect=[round(j*sw/3),round(f*sh/3),round((j+1)*sw/3),round((f+1)*sh/3)]
        source=sheet.crop(rect)
        # Flat field comes from inside the generated parapet; machinery/helipad retain plan detail.
        if name=='flat':
            w,h=source.size;source=source.crop((round(w*.1),round(h*.1),round(w*.9),round(h*.9)))
        a=np.array(source.resize((32,32),Image.Resampling.LANCZOS));m=bright(a.astype(float))
        # White H is paint, not a light. Roof emission is optional and disabled here.
        edge=np.mean([a[0,0],a[0,-1],a[-1,0],a[-1,-1]],axis=0).astype('uint8')
        a[0]=edge;a[-1]=edge;a[:,0]=edge;a[:,-1]=edge
        ident=f'{family}-roof-{name}'
        modules.append({'id':ident,'family':family,'row':'roof','column':name,'design':1,'size':[32,32],'windows':[]})
        tiles.append(Image.fromarray(a).convert('RGBA'));emissions.append(Image.new('RGBA',(32,32)))
        audit.append({'id':ident,'source':'_raw/roofs.png','crop':rect})

# 34-pixel cells include a duplicated 1px gutter, preventing neighbouring atlas bleed.
size=(272,306);base=Image.new('RGBA',size);emit=Image.new('RGBA',size)
for i,(module,t,e) in enumerate(zip(modules,tiles,emissions)):
    x,y=i%8*34+1,i//8*34+1;w,h=t.size;module['rect']=[x,y,w,h]
    for atlas,img in [(base,t),(emit,e)]:
        atlas.paste(img,(x,y));atlas.paste(img.crop((0,0,w,1)),(x,y-1));atlas.paste(img.crop((0,h-1,w,h)),(x,y+h));atlas.paste(img.crop((0,0,1,h)),(x-1,y));atlas.paste(img.crop((w-1,0,w,h)),(x+w,y))
base.save(ROOT/'atlas-base.png');emit.save(ROOT/'atlas-emissive.png')
manifest={'version':1,'grid':{'bay':32,'floor':16,'roof':32,'worldBay':1,'floorsPerHeight':2},'states':[0,25,50,75,100],'atlas':{'base':'atlas-base.png','emissive':'atlas-emissive.png','size':size,'decodedBytes':size[0]*size[1]*4*2},'families':FAMILIES,'modules':modules,'generationCount':4,'sources':audit}
(ROOT/'kit.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps({'modules':len(modules),'walls':57,'roof':9,'decodedBytes':manifest['atlas']['decodedBytes']}))
