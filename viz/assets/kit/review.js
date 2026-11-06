'use strict';
const examples=[
 {id:'house-small',w:5,d:5,h:.8,type:'house'}, {id:'house-row',w:8,d:5,h:1.5,type:'house'},
 {id:'house-slab',w:16,d:5,h:2,type:'house'}, {id:'house-long',w:25,d:6,h:2.4,type:'house'},
 {id:'office-small',w:6,d:6,h:3,type:'office'}, {id:'office-court',w:9,d:8,h:4,type:'office'},
 {id:'office-slab',w:22,d:6,h:4.5,type:'office'}, {id:'office-wide',w:14,d:10,h:5.5,type:'office'},
 {id:'glass-slim',w:5,d:5,h:6,type:'glass'}, {id:'glass-square',w:8,d:8,h:8,type:'glass'},
 {id:'glass-step',w:9,d:7,h:10,type:'glass'}, {id:'glass-wide',w:14,d:10,h:12,type:'glass'},
 {id:'core-a',w:7,d:7,h:16,type:'core'}, {id:'core-b',w:9,d:8,h:19,type:'core'},
 {id:'core-c',w:11,d:9,h:23,type:'core'}, {id:'core-d',w:12,d:10,h:27,type:'core'}
];
function sheet(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.fillStyle='#07121f';x.fillRect(0,0,w,h);x.imageSmoothingEnabled=false;document.querySelector('#output').append(c);return [c,x];}
function text(ctx,value,x,y,size=18,color='#d8e7ff'){ctx.font=`${size}px system-ui`;ctx.fillStyle=color;ctx.fillText(value,x,y);}
async function makeSheets(kit){
 const [sheetCanvas,c]=sheet(2100,2100);text(c,'MODULAR FACADE KIT',30,44,28);text(c,'66 generated modules · flat source · 3× native pixels · five cumulative light states',30,74,18,'#94aecb');
 for(let fi=0;fi<3;fi++){
  const family=kit.manifest.families[fi],left=fi*700+30;text(c,family.toUpperCase(),left,125,24);
  FacadeKit.STATES.forEach((s,i)=>text(c,`${s}%`,left+i*130,160,16));let y=192;
  for(const m of kit.manifest.modules.filter(m=>m.family===family)){
   text(c,m.id.replace(family+'-',''),left,y,15,'#94aecb');
   FacadeKit.STATES.forEach((s,i)=>c.drawImage(kit.tile(m.id,s).canvas,left+i*130,y+10,m.size[0]*3,m.size[1]*3));
   y+=m.row==='roof'?130:78;
  }
 }
 text(c,'Roof plans are unlit; white helipad H is paint. Left/right shading is applied only during assembly.',30,2072,17,'#94aecb');
 const [buildingCanvas,b]=sheet(2000,2540);text(b,'BUILDING ASSEMBLY CHECKPOINT',30,46,28);
 text(b,'16 deterministic examples · same 32×16 modules · night ground · 75% light · fixed camera scale 0.35',30,77,17,'#94aecb');
 for(let i=0;i<examples.length;i++){
  const input=examples[i],left=(i%4)*500,top=105+Math.floor(i/4)*470,out=kit.render(input,75,{resolution:.35,bloom:true});
  b.drawImage(out.canvas,left+(500-out.width)/2,top+410-out.height);
  text(b,`${input.id}  /  ${out.plan.family}`,left+25,top+435,18);
  text(b,`${input.w} × ${input.d} · h ${input.h} · ${out.plan.h.count} floors · ${out.plan.tiers.length} tier(s)`,left+25,top+458,14,'#94aecb');
 }
 text(b,'ONE BUILDING / FIVE STATES',30,2040,24);text(b,'Geometry and material remain identical. Only cumulative window emission changes.',30,2072,17,'#94aecb');
 const repeated={id:'checkpoint-five',w:8,d:7,h:10,type:'glass'};
 for(let i=0;i<5;i++){
  const state=FacadeKit.STATES[i],out=kit.render(repeated,state,{resolution:.4,bloom:true});
  b.drawImage(out.canvas,i*400+(400-out.width)/2,2470-out.height);text(b,`${state}%`,i*400+175,2504,22);
 }
 return {'kit-sheet.png':sheetCanvas,'kit-buildings.png':buildingCanvas};
}
const pixels=c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data;
async function digest(c){const h=await crypto.subtle.digest('SHA-256',pixels(c));return Array.from(new Uint8Array(h),x=>x.toString(16).padStart(2,'0')).join('');}
async function checkBrowser(kit){
 const assert=(ok,msg)=>{if(!ok)throw Error(msg);};let checked=0;
 for(const input of [examples[0],examples[10],examples[15]]){
  let previous=null,baseHash=null;
  for(const state of FacadeKit.STATES){kit.clearCache();const first=kit.render(input,state,{resolution:.25}),hash=await digest(first.canvas),bh=await digest(first.base);if(baseHash)assert(bh===baseHash,'Base changed with state');baseHash=bh;
   const current=pixels(first.emissive);if(previous)for(let i=3;i<current.length;i+=4)assert(current[i]>=previous[i],'Emission mask is not nested');previous=current;
   kit.clearCache();assert(hash===await digest(kit.render(input,state,{resolution:.25}).canvas),'Nondeterministic pixels');checked++;
  }
 }
 const city=await fetch('../map/city.json').then(r=>r.json()),pack=await fetch('../map/pack.json').then(r=>r.json()),buildings=FacadeKit.fromCity(city,pack.districts);
 kit.clearCache();const wallStart=performance.now(),unique=new Set(),times=[];let maxBytes=0,maxStretch=0,maxResidual=0,clamped=0;
 for(const input of buildings){const start=performance.now(),out=kit.render(input,75,{resolution:.25});times.push(performance.now()-start);unique.add(`${out.width}:${out.height}:${await digest(out.canvas)}`);maxBytes=Math.max(maxBytes,kit.bytes);
  for(const axis of ['w','d','h']){const dim=out.plan[axis];assert(dim.scale>=.88&&dim.scale<=1.12,'Stretch limit');maxStretch=Math.max(maxStretch,Math.abs(dim.scale-1));maxResidual=Math.max(maxResidual,Math.abs(dim.residual));if(Math.abs(dim.residual)>1e-8)clamped++;}
 }
 const totalMs=times.reduce((a,b)=>a+b,0),ordered=times.slice().sort((a,b)=>a-b);
 return {pass:true,engine:navigator.userAgent,pixelRepeatCases:checked,cityBuildings:buildings.length,distinctRenderedBuildings:unique.size,state:75,resolution:.25,assemblyMs:totalMs,meanMs:totalMs/buildings.length,p95Ms:ordered[Math.floor(ordered.length*.95)],wallMsIncludingSHA:performance.now()-wallStart,moduleCacheEntries:kit.tiles.size,moduleCacheBytes:Array.from(kit.tiles.values()).reduce((n,t)=>n+t.canvas.width*t.canvas.height*12,0),atlasDecodedBytes:kit.manifest.atlas.decodedBytes,cachePeakBytes:maxBytes,cacheLimitBytes:kit.cacheLimit,maxStretch,maxQuantizationResidual:maxResidual,clampedAxes:clamped};
}
window.ready=(async()=>{const kit=await FacadeKit.loadBrowser('./');window.kit=kit;window.sheets=await makeSheets(kit);return true;})();
