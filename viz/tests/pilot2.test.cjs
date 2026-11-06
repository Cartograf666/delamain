const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const {createCanvas,loadImage}=require('../assets/kit/node_modules/@napi-rs/canvas');
const F=require('../assets/kit/assemble.js'),S=require('../assets/kit/styles.js'),P=require('../assets/notable/placement.js');
const base=__dirname+'/../assets/',read=p=>JSON.parse(fs.readFileSync(base+p)),manifest=read('kit/kit.json'),data=read('map/city.json'),roads=read('map/roads.json'),pack=read('map/pack.json'),notable=read('notable/manifest.json'),landmarks=read('map/landmarks.json');
const digest=c=>crypto.createHash('sha256').update(c.getContext('2d').getImageData(0,0,c.width,c.height).data).digest('hex');
(async()=>{
 const kit=new F.Kit(manifest,await loadImage(base+'kit/atlas-base.png'),await loadImage(base+'kit/atlas-emissive.png'),createCanvas);
 kit.styleBaseAtlas=await loadImage(base+'kit/styles-base.png');kit.styleEmissiveAtlas=await loadImage(base+'kit/styles-emissive.png');
 const counts={},inputs=F.fromCity(data,pack.districts);let maxStretch=0;
 for(const input of inputs){const p=S.plan(input,manifest);counts[p.id]=(counts[p.id]||0)+1;assert.equal(p.H,input.h**1.25*6.5);
  const axes=[p.w,p.d,p.h];for(const t of p.tiers){const s=p.recipe,ww=input.w*(1-t.inset*(s.offset?2.5:2)),dd=input.d*(1-t.inset*(s.offset?1.5:2));axes.push(S.axis(ww,s.bay),S.axis(dd,s.bay),S.axis(Math.max(.3,p.H*(t.until-t.at)-Math.min(s.cap,p.H*.08)),s.floor));}
  for(const a of axes){maxStretch=Math.max(maxStretch,Math.abs(a.fit-1));assert.ok(a.fit>=.88&&a.fit<=1.12);}
 }
 let repetitions=0,nested=0;
 for(const style of Object.keys(manifest.styles))for(let sample=0;sample<3;sample++){
  const input={id:'deterministic-'+sample,w:10+sample*3,d:8+sample*2,h:[1.5,6,13][sample],zone:'core',type:'b',style};let previous=null,geometry=null;
  for(const state of F.STATES){kit.clearCache();const a=S.render(kit,input,state,2);kit.clearCache();const b=S.render(kit,input,state,2);assert.equal(digest(a.canvas),digest(b.canvas));repetitions++;
   const g=digest(a.base);if(geometry)assert.equal(g,geometry);geometry=g;
   const pixels=a.emissive.getContext('2d').getImageData(0,0,a.width,a.height).data;if(previous)for(let k=3;k<pixels.length;k+=4)if(previous[k])assert.ok(pixels[k]>=previous[k],style+' nested alpha');previous=pixels;nested++;
  }
 }
 let notableBytes=0;for(const [id,m]of Object.entries(notable.models)){
  assert.ok(m.bounds.min[0]>=-m.footprint[0]/2-1e-6&&m.bounds.max[0]<=m.footprint[0]/2+1e-6,id+' footprint x');assert.ok(m.bounds.min[2]>=-m.footprint[1]/2-1e-6&&m.bounds.max[2]<=m.footprint[1]/2+1e-6,id+' footprint z');
  const expected=[[0,0],[40,20],[-40,20],[0,-40]];m.projectionControl.forEach((p,i)=>{assert.ok(Math.hypot(p[0]-m.anchor[0]-expected[i][0],p[1]-m.anchor[1]-expected[i][1])<1e-8,id+' exact camera');});
  let prior=null;for(const file of [m.base,...Object.values(m.states)]){const img=await loadImage(base+'notable/'+file);assert.equal(img.width,m.size[0]);assert.equal(img.height,m.size[1]);notableBytes+=img.width*img.height*4;const c=createCanvas(img.width,img.height),x=c.getContext('2d');x.drawImage(img,0,0);const pix=x.getImageData(0,0,img.width,img.height).data;
   if(file===m.base){for(let i=0;i<img.width;i++)assert.equal(pix[i*4+3],0,id+' top not clipped');continue;}
   if(file.includes('-0.png'))assert.equal(pix.reduce((s,v,i)=>s+(i%4===3?v:0),0),0);
   if(prior)for(let k=3;k<pix.length;k+=4)if(prior[k])assert.ok(pix[k]>=prior[k],id+' nested pixels');prior=pix;
  }
 }
 const landImage=await loadImage(base+'map/land.png'),landCanvas=createCanvas(landImage.width,landImage.height);landCanvas.getContext('2d').drawImage(landImage,0,0);const land=landCanvas.getContext('2d').getImageData(0,0,landImage.width,landImage.height).data;
 const ca=Math.cos(data.g*Math.PI/180),sa=Math.sin(data.g*Math.PI/180);let landSamples=0;
 const onLand=r=>{for(let x=r[0];x<=r[2];x++)for(let y=r[1];y<=r[3];y++){const sx=Math.round(data.center[0]+x*ca-y*sa),sy=Math.round(data.center[1]+x*sa+y*ca);landSamples++;if(sx<0||sy<0||sx>=landImage.width||sy>=landImage.height||land[(sy*landImage.width+sx)*4]<=127)return false;}return true;};
 for(const l of landmarks.placements)assert.ok(onLand(P.rect(l,notable.models)),l.model+' plaza must stay on land');
 assert.equal(onLand(P.rect({model:'dome',position:[557.255,-340.455],plaza:3},notable.models)),false,'Rejected shore-overhang control');
 const projection=(b,H)=>[b[0]-b[3],(b[0]+b[1])/2-H,b[2]-b[1],(b[2]+b[3])/2];
 const keyIds=[pack.keys.owner,...pack.keys.hubs],owner=data.boxes[pack.keys.owner],ox=(owner[0]+owner[2]-owner[1]-owner[3])/2,oy=(owner[0]+owner[2]+owner[1]+owner[3])/4;
 for(const l of landmarks.placements){const r=P.rect(l,notable.models,false),v=projection(r,notable.models[l.model].height);
  for(const id of keyIds)assert.ok(!P.overlap(v,projection(data.boxes[id],data.boxes[id][4]**1.25*6.5)),l.model+' must not hide key '+id);
  assert.ok(!P.overlap(v,[ox-55,oy,ox+55,oy+450]),'Owner approach corridor');
 }
 const reserved=P.validate(data,roads,pack,landmarks.placements,notable.models);assert.ok(reserved.removed.length>0);
 const invalid={...landmarks.placements[0],position:[(data.boxes[488][0]+data.boxes[488][2])/2,(data.boxes[488][1]+data.boxes[488][3])/2]};assert.throws(()=>P.validate(data,roads,pack,[invalid],notable.models));
 const road= P.segments(data,roads)[100],badRoad={...landmarks.placements[0],position:road.a};assert.throws(()=>P.validate(data,roads,pack,[badRoad],notable.models),/road/);
 const removed=new Set(reserved.removed),boxes=data.boxes.map((box,id)=>({box,id})).filter(b=>!removed.has(b.id));landmarks.placements.forEach((l,i)=>boxes.push({id:'notable-'+i,box:P.rect(l,notable.models,false)}));const ordered=P.order(boxes),index=new Map(ordered.map((b,i)=>[b.id,i]));
 let depthPairs=0;for(const a of boxes)for(const b of boxes){const A=a.box,B=b.box;if((A[2]<=B[0]+1e-6&&A[1]<B[3]-1e-6&&A[3]>B[1]+1e-6)||(A[3]<=B[1]+1e-6&&A[0]<B[2]-1e-6&&A[2]>B[0]+1e-6)){assert.ok(index.get(a.id)<index.get(b.id));depthPairs++;}}
 assert.deepEqual(P.order(boxes).map(b=>b.id),ordered.map(b=>b.id));
 const result={pass:true,counts,maxStretch,repetitions,nested,notableBytes,atlasBytes:665856+manifest.styleAtlas.size[0]*manifest.styleAtlas.size[1]*8,reserved,depthPairs,landSamples,ordered:ordered.length};
 fs.mkdirSync(base+'notable/shots',{recursive:true});fs.writeFileSync(base+'notable/shots/tests.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
