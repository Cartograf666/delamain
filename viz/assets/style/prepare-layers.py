"""Repeatable, generation-free architectural cuts. Requires Pillow and numpy.

Run: python3 viz/assets/style/prepare-layers.py
QA:  python3 viz/assets/style/prepare-layers.py --preview ordinary|keys|native
      (base64 JPEG on stdout; no extra files are written).
Sources remain untouched. Manifest paths resolve relative to viz/.
"""
from pathlib import Path
import argparse
import base64
import hashlib
import io
import json
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent
PAD = 8
# Source-space front architectural contacts; broad facades keep their authored shape.
ORDINARY = [
    ('ord-01', (130,328), 260, 'Low warehouse'),
    ('ord-02', (548,325), 192, 'Office block'),
    ('ord-03', (897,339), 146, 'Residential tower'),
    ('ord-04', (1178,290), 280, 'L-shaped low block'),
    ('ord-05', (169,670), 281, 'Courtyard block'),
    ('ord-06', (532,678), 224, 'Stepped terrace'),
    ('ord-07', (894,673), 211, 'Midrise office'),
    ('ord-08', (1200,659), 286, 'Sawtooth workshop'),
    ('ord-09', (146,1016), 244, 'Tank utility'),
    ('ord-10', (511,1017), 241, 'Service workshop'),
    ('ord-11', (816,1040), 272, 'Residential slab'),
    ('ord-12', (1240,1034), 255, 'Stepped utility office'),
]
# Physical outline only: the blue/green circular plinth is architecture, exterior bloom is not.
BLUE = [(307,43),(314,43),(318,49),(318,62),(314,67),(315,113),(316,119),(316,181),
        (326,187),(328,211),(342,217),(359,245),(368,263),(369,424),(383,444),
        (384,548),(395,566),(396,735),(410,746),(423,761),(430,778),(429,796),
        (420,814),(404,829),(381,841),(348,850),(310,853),(273,849),(241,840),
        (216,825),(199,807),(191,789),(192,773),(199,758),(212,745),(222,736),
        (223,568),(233,553),(234,483),(249,454),(250,262),(257,242),(263,205),
        (282,163),(292,191),(300,187),(301,120),(303,113),(303,67),(300,61),(300,49)]
GREEN = [(886,43),(893,43),(897,49),(897,62),(892,68),(893,113),(895,120),(895,179),
         (905,185),(910,193),(925,201),(937,218),(940,234),(949,250),(949,424),
         (962,442),(963,549),(975,565),(976,737),(991,750),(1004,765),(1011,784),
         (1008,803),(997,821),(975,836),(946,847),(912,853),(876,853),(842,846),
         (814,835),(791,819),(775,799),(771,780),(777,762),(791,746),(801,738),
         (802,568),(813,551),(813,485),(828,455),(829,253),(840,230),(843,210),
         (857,197),(871,190),(872,181),(882,176),(882,119),(884,113),(884,68),
         (880,62),(880,49)]
OWNER_BODY = [(1457,103),(1533,143),(1533,159),(1585,184),(1585,202),(1603,211),
              (1604,302),(1628,317),(1628,340),(1624,348),(1624,458),(1648,474),
              (1648,495),(1644,504),(1644,596),(1665,608),(1665,630),(1662,635),
              (1662,716),(1668,724),(1665,733),(1665,772),(1458,875),(1248,774),
              (1249,736),(1245,727),(1251,718),(1251,633),(1249,627),(1249,609),
              (1269,598),(1270,502),(1268,494),(1268,475),(1289,461),(1290,349),
              (1288,341),(1289,318),(1311,304),(1311,214),(1325,202),(1326,184),
              (1351,170),(1351,150)]
KEYS = [
    ('key-blue', [BLUE], (310,853), 239, 5.712),
    ('key-green', [GREEN], (891,853), 240, 5.712),
    ('key-owner', [OWNER_BODY, [(1390,148),(1390,84),(1393,78),(1396,82),(1396,147)],
                   [(1455,105),(1455,27),(1458,24),(1461,27),(1461,106)],
                   [(1513,146),(1513,73),(1516,68),(1519,73),(1519,150)]], (1458,875), 420, 9.0),
]


def fill_holes(mask):
    # Flood only exterior black; retain every dark facade pixel as solid architecture.
    padded = Image.new('L', (mask.width + 2, mask.height + 2))
    padded.paste(mask, (1, 1))
    ImageDraw.floodfill(padded, (0, 0), 128)
    a = np.array(padded)[1:-1, 1:-1]
    return Image.fromarray(np.where(a == 128, 0, 255).astype('uint8'))


def ordinary_mask(crop):
    a = np.array(crop)[:, :, 3]
    mask = Image.fromarray(np.where(a >= 160, 255, 0).astype('uint8')).copy()
    # Select connected architecture, excluding stray source-matte flecks.
    yy, xx = np.where(a >= 240)
    j = np.argmin((xx-crop.width/2)**2 + (yy-crop.height/2)**2)
    ImageDraw.floodfill(mask, (int(xx[j]), int(yy[j])), 128)
    mask = Image.fromarray(np.where(np.array(mask) == 128, 255, 0).astype('uint8'))
    return fill_holes(mask).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(.45))


def clean(crop, mask):
    a = np.array(crop)
    m = np.array(mask)
    # Drop Lanczos sub-3% ringing outside the real contour, retain partial coverage.
    m[m < 8] = 0
    m[m > 247] = 255
    # Seal subpixel holes where the manually drawn antenna and roof masks meet.
    sealed = np.array(fill_holes(Image.fromarray(np.where(m > 0, 255, 0).astype('uint8'))))
    m[(sealed > 0) & (m == 0)] = 255
    mask = Image.fromarray(m)
    inner = np.array(mask.filter(ImageFilter.MinFilter(7))) >= 250
    repair = ((m > 0) & ~inner) | ((m > 0) & (a[:, :, 3] < 240))
    # Pilot nearest inward RGB method. Alpha comes from architecture, never brightness.
    good = inner & (a[:, :, 3] >= 240)
    for y, x in zip(*np.where(repair)):
        for radius in (10, 24, 48):
            y0, y1 = max(0,y-radius), min(a.shape[0],y+radius+1)
            x0, x1 = max(0,x-radius), min(a.shape[1],x+radius+1)
            yy, xx = np.where(good[y0:y1, x0:x1])
            if len(xx):
                yy += y0; xx += x0
                j = np.argmin((yy-y)**2 + (xx-x)**2)
                a[y,x,:3] = a[yy[j],xx[j],:3]
                break
    a[:,:,3] = m
    a[m == 0,:3] = 0
    return Image.fromarray(a)


def cut(source, crop_box, mask, name, anchor, base_width):
    sprite = clean(source.crop(crop_box), mask)
    bounds = sprite.getbbox()
    l,t,r,b = bounds
    sprite = sprite.crop((l-PAD,t-PAD,r+PAD,b+PAD))
    anchor = [anchor[0]-crop_box[0]-l+PAD, anchor[1]-crop_box[1]-t+PAD]
    file = name+'.png'
    sprite.save(ROOT/file)
    return {'file':'assets/style/'+file, 'anchor':anchor, 'size':list(sprite.size),
            'baseWidth':base_width, 'sourceCrop':list(crop_box), 'trimBounds':list(bounds)}


def build():
    source = Image.open(ROOT/'raw/ordinary-family.png').convert('RGBA')
    sprites = {'core-sky-a':{'worldWidth':3.536,'opacity':1,
        'states':{str(s):{'file':f'assets/style/core-sky-a-{s}.png','anchor':[216,700],
                         'size':[432,724],'baseWidth':338} for s in (0,25,50,75,100)}}}
    for i,(name,anchor,bw,label) in enumerate(ORDINARY):
        x,y = (i%4)*362,(i//4)*362
        box = (x,y,x+362,y+362)
        state = cut(source,box,ordinary_mask(source.crop(box)),name,anchor,bw)
        sprites[name] = {'label':label,'states':{'100':state},'worldWidth':3.536,
                         'widthFactor':.92,'opacity':.90}
    source = Image.open(ROOT/'raw/key-towers.png').convert('RGBA')
    keys = {}
    for name,polys,anchor,bw,ww in KEYS:
        points = [p for poly in polys for p in poly]
        l,t = min(p[0] for p in points)-PAD,min(p[1] for p in points)-PAD
        r,b = max(p[0] for p in points)+PAD+1,max(p[1] for p in points)+PAD+1
        mask = Image.new('L',((r-l)*4,(b-t)*4))
        d = ImageDraw.Draw(mask)
        for poly in polys:d.polygon([((x-l)*4,(y-t)*4) for x,y in poly],fill=255)
        mask = mask.resize((r-l,b-t),Image.Resampling.LANCZOS)
        state = cut(source,(l,t,r,b),mask,name,anchor,bw)
        keys[name] = {'states':{'100':state},'worldWidth':ww,'opacity':1}
    districts = {'core':['core-sky-a'],'foundry':['ord-08','ord-10','ord-09','ord-01'],
        'docks':['ord-01','ord-08','ord-10'],'bazaar':['ord-04','ord-05','ord-10'],
        'heights':['ord-03','ord-06','ord-02'],'sprawl':['ord-11','ord-05','ord-07','ord-12'],
        'smelter':['ord-09','ord-08','ord-10','ord-12'],'riviera':['ord-06','ord-04','ord-02'],
        'wastes':['ord-10','ord-01','ord-09']}
    manifest = {'schemaVersion':1,'status':'prototype-for-owner-review','pathBase':'viz/','load':{'workersAtFull':10,'hysteresis':.025},
      'layers':{
        'ground':{'center':'#172232','edge':'#101a29','gridAlpha':.11,'gridStep':4,'edgeStart':.62,'edgeEnd':1,'minScale':.58,'minDensity':.28,'color':'#172232','tileColor':'#1b293a','tileOpacity':.70,'gridColor':'#506078','gridOpacity':.11,'gridWidthCSS':.5},
        'roads':{'alpha':.64,'width':.42,'laneOffset':.14,'highwayAlpha':.85,'highwayColor':'#263447','highwayMarkOpacity':.55,'highwayMarkWidthCSS':.85,'highwayLaneOffset':.22,'pathMode':'fixed-existing-street-graph','color':'#101a29','opacity':.64,'minorWidthWorld':.42,'highwayWidthWorld':.90,'markColor':'#b48a51','markOpacity':.30,'markWidthCSS':.55},
        'buildings':{'sprites':sprites,'districts':districts,'sort':'architectural-foot-depth',
          'coreScaleRange':[.9,1.1],'coreScaleSeed':'stable-lot-id','allowRotation':False,'allowMirror':False,'uniformScaleOnly':True,
          'edge':{'startNormalizedRadius':.62,'endNormalizedRadius':1,'outerKeepProbability':.28,'outerWidthMultiplier':.58,'exemptDistricts':['core'],'exemptLiveKeys':True,'seed':'stable-lot-id'}},
        'keyBuildings':{'sprites':keys,'hubs':['key-blue','key-green'],'owner':'key-owner','staticState':'100'},
        'movers':{'visuals':'inherited-cabs','pathMode':'fixed-existing-street-graph','preserveHeadingSprites':True},
        'lightHaze':{'color':'#91a6bc','alpha':.035,'hazeColor':'#91a6bc','maxHazeOpacity':.035,'hazeRegion':'outer-city-only',
          'spillPass':'below-architecture','spillBlue':'#559dff','spillGreen':'#5bd7af','spillOwner':'#80cfe2','spillOwnerWarm':'#edba72',
          'hubSpillOpacity':.13,'ownerSpillOpacity':.11,'spillRadiusWidthFactor':1.35,'spillVerticalRadiusRatio':.5}},
      'preparation':{'script':'prepare-layers.py','method':'native ordinary alpha threshold, exterior flood and filled interiors; manual key polygons; pilot inward RGB repair; no generation or recolouring',
          'sourceSHA256':{p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for p in ['raw/ordinary-family.png','raw/key-towers.png']},
          'ordinaryAlphaThreshold':160,'ordinaryInsetPixels':1,'edgeRepairBandPixels':3,'paddingPixels':PAD,
          'keyOutlinesSourceSpace':{n:p for n,p,*_ in KEYS}}}
    (ROOT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    print('Prepared 12 ordinary sprites, 3 static key sprites and schemaVersion 1 manifest.')


def preview(kind):
    m = json.loads((ROOT/'manifest.json').read_text())
    if kind == 'keys': specs = m['layers']['keyBuildings']['sprites']
    else: specs = {k:v for k,v in m['layers']['buildings']['sprites'].items() if k != 'core-sky-a'}
    cols = 3 if kind == 'keys' else 4
    cw,ch = (330,520) if kind == 'keys' else (270,230)
    rows = (len(specs)+cols-1)//cols
    out = Image.new('RGB',(cols*cw,rows*ch*2),'#172232')
    d = ImageDraw.Draw(out);d.rectangle((0,rows*ch,out.width,out.height),fill='#e6e9ed')
    for i,(name,spec) in enumerate(specs.items()):
        s = spec['states']['100'];im = Image.open(ROOT/s['file'].split('/')[-1])
        for matte in (0,1):
            x,y = (i%cols)*cw,(i//cols)*ch+matte*rows*ch
            d.text((x+10,y+8),name,fill='#728397')
            # Actual CSS overview size and 3x, not a synthetic city or runtime proof.
            for j,mul in enumerate((1,3)):
                scale = spec['worldWidth']*7.549019607843137/s['baseWidth']*mul
                if kind == 'native':scale=1
                tile = im.resize((max(1,round(im.width*scale)),max(1,round(im.height*scale))),Image.Resampling.LANCZOS)
                if kind == 'native':tile.thumbnail((cw-20,ch-30))
                px = x+(55 if j==0 else cw-90)-tile.width//2
                py = y+ch-28-tile.height
                out.paste(tile,(px,py),tile)
                if kind == 'native':break
            d.text((x+12,y+ch-20),'1x overview / 3x inspection',fill='#728397')
    b = io.BytesIO();out.save(b,format='JPEG',quality=90)
    print(base64.b64encode(b.getvalue()).decode())


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--preview',choices=['ordinary','keys','native'])
    args = parser.parse_args()
    preview(args.preview) if args.preview else build()
