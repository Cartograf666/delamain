const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../assets/kit');
const {createCanvas,loadImage}=require(path.join(root,'node_modules/@napi-rs/canvas'));
const {Kit,plan,fromCity,STATES}=require(path.join(root,'assemble.js'));
const pixels=c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data;
const digest=c=>crypto.createHash('sha256').update(pixels(c)).digest('hex');
(async()=>{
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'kit.json'))),[base,emissive]=await Promise.all(['atlas-base.png','atlas-emissive.png'].map(n=>loadImage(path.join(root,n))));
 const kit=new Kit(manifest,base,emissive,createCanvas,{cacheBytes:2*1024*1024});
 const buildings=fromCity(JSON.parse(fs.readFileSync(path.join(root,'../map/city.json'))));
 assert.equal(buildings.length,4367);assert.equal(manifest.modules.length,66);
 for(const family of manifest.families)for(const row of ['ground','mid','top'])for(const column of ['edgeL','middle','edgeR'])assert.equal(manifest.modules.filter(m=>m.family===family&&m.row===row&&m.column===column).length,row==='mid'&&column==='middle'?3:2);
 let maxStretch=0,maxResidual=0,tiers=0;
 for(const b of buildings){const p=plan(b);for(const axis of ['w','d','h']){assert.ok(p[axis].scale>=.88&&p[axis].scale<=1.12);maxStretch=Math.max(maxStretch,Math.abs(p[axis].scale-1));maxResidual=Math.max(maxResidual,Math.abs(p[axis].residual));}tiers+=p.tiers.length-1;for(const tier of p.tiers)for(const wall of tier.walls)for(const cell of wall.cells)assert.ok(kit.modules.has(cell.module));}
 const atlas=createCanvas(base.width,base.height);atlas.getContext('2d').drawImage(base,0,0);const data=pixels(atlas);
 const pixel=(x,y)=>Array.from(data.slice((y*atlas.width+x)*4,(y*atlas.width+x)*4+4));
 for(const family of manifest.families){const mods=manifest.modules.filter(m=>m.family===family&&m.row!=='roof'),ref=mods[0];for(const m of mods){const [x,y,w,h]=m.rect,[rx,ry]=ref.rect;for(let i=0;i<w;i++)assert.deepEqual(pixel(x+i,y),pixel(rx+i,ry));for(let j=0;j<h;j++){assert.deepEqual(pixel(x,y+j),pixel(x+w-1,y+j));}for(let i=0;i<w;i++)assert.deepEqual(pixel(x+i,y),pixel(x+i,y+h-1));}}
 let masksChecked=0;
 for(const m of manifest.modules)for(let phase=0;phase<4;phase++){
  let prev=null,baseHash=null;
  for(const state of STATES){const t=kit.tile(m.id,state,phase),p=pixels(t.emissive),bh=digest(t.base);if(m.row!=='roof'){assert.deepEqual(m.windows.map(w=>w.rect),[[2,3,7,10],[9,3,7,10],[16,3,7,10],[23,3,7,10]]);let panes=0;for(const win of m.windows){const [x,y,w,h]=win.rect;let lit=false;for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)lit ||=p[(yy*t.emissive.width+xx)*4+3]>0;if(lit)panes++;}assert.equal(panes,state/25,`${m.id} pane count`);}if(baseHash)assert.equal(bh,baseHash);baseHash=bh;
   if(state===0)assert.equal(p.some((v,i)=>i%4===3&&v>0),false);
   if(prev)for(let i=3;i<p.length;i+=4)if(prev[i])assert.ok(p[i]>=prev[i],`${m.id} light disappeared`);
   prev=p;masksChecked++;
  }
 }
 const probes=[0,488,1853,2367,4366].map(i=>buildings[i]).concat([{id:'tall',w:9,d:8,h:27,type:'hero'},{id:'slab',w:25,d:5,h:2,type:'house'}]);
 let pixelRepeats=0;
 for(const b of probes){let prev=null;for(const state of STATES){kit.clearCache();const a=kit.render(b,state,{resolution:.25}),ah=digest(a.canvas);kit.clearCache();const c=kit.render(b,state,{resolution:.25});assert.equal(digest(c.canvas),ah);pixelRepeats++;
  const current=pixels(c.emissive);if(prev)for(let i=3;i<current.length;i+=4)if(prev[i])assert.ok(current[i]>=prev[i]);prev=current;
  const cached=kit.render(b,state,{resolution:.25});if(c.bytes<=kit.cacheLimit)assert.equal(cached,c);else {assert.notEqual(cached,c);assert.equal(digest(cached.canvas),digest(c.canvas));}assert.ok(kit.bytes<=kit.cacheLimit);
 }}
 const b=probes[0],original=digest(kit.render(b,75,{resolution:.25}).canvas);assert.notEqual(digest(kit.render({...b,w:b.w+2},75,{resolution:.25}).canvas),original);
 assert.throws(()=>kit.tile('glass-mid-middle-1',75,4));assert.throws(()=>kit.render(b,30));assert.throws(()=>plan({...b,w:NaN}));assert.throws(()=>kit.render(b,75,{resolution:0}));
 const output={pass:true,engine:'Node @napi-rs/canvas',cityBuildings:buildings.length,modules:manifest.modules.length,masksChecked,pixelRepeats,maxStretch,maxQuantizationResidual:maxResidual,setbackTiers:tiers,atlasDecodedBytes:manifest.atlas.decodedBytes,cacheBoundVerified:true};
 fs.writeFileSync(path.join(root,'shots/node-tests.json'),JSON.stringify(output,null,2)+'\n');console.log(JSON.stringify(output,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
