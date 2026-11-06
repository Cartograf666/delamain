// Pixel control for fire depth on the real page (?demo=capture), true headless Chrome, never the user's browser.
// One window hot spot whose centre lies inside a nearer surface is drawn three ways: normally (must match "removed"
// inside that surface: negative control) and forced to the front (must differ: positive control).
// Run: CAPTURE_ORIGIN=http://127.0.0.1:8841 FIRE_PROOF=<dir> [ASSETS_DIR=viz/assets/gl] node viz/tests/gl/fire-occlusion-headless.cjs
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const origin=process.env.CAPTURE_ORIGIN||'http://127.0.0.1:8841',out=process.env.FIRE_PROOF||'/tmp/fx-fire/occlusion',assets=process.env.ASSETS_DIR;
fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--use-angle=metal']});
 try{const p=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1});const errors=[];p.on('pageerror',e=>errors.push(String(e)));
 if(assets)await p.route('**/assets/gl/*.js',r=>{const file=path.join(assets,new URL(r.request().url()).pathname.split('/').pop());fs.existsSync(file)?r.fulfill({body:fs.readFileSync(file),contentType:'text/javascript'}):r.continue();});
 await p.goto(origin+'/?map=1&live=1&lang=ru&follow=0&demo=capture');
 await p.waitForFunction(()=>typeof layerCity!=='undefined'&&layerCity?.live?.aq?.response);await p.locator('[data-mode="territories"]').click();
 await p.waitForFunction(()=>layerCity.live.aq.response.events.length===3&&layerCity.live.aq.response.events.every(e=>e.route));await p.waitForTimeout(1500);
 const proof=await p.evaluate(async()=>{
  const {fireHotSpots,wallPoint}=await import('/assets/gl/capture-response.js'),l=layerCity.live,gpu=l.gpu,r=l.aq.response,S=gpu.scene;
  const v=l.cameraView(),k=Math.max(innerWidth/S.w,innerHeight/S.h)*v.z,screen=q=>[(q[0]-v.x)*k,(q[1]-v.y)*k];
  const inside=(p,q)=>{let c=false;for(let i=0,j=q.length-1;i<q.length;j=i++)if((q[i][1]>p[1])!==(q[j][1]>p[1])&&p[0]<(q[j][0]-q[i][0])*(p[1]-q[i][1])/(q[j][1]-q[i][1])+q[i][0])c=!c;return c;};
  const edge=(p,q)=>Math.min(...q.map((a,i)=>{const b=q[(i+1)%q.length],d=[b[0]-a[0],b[1]-a[1]],t=Math.max(0,Math.min(1,((p[0]-a[0])*d[0]+(p[1]-a[1])*d[1])/(d[0]*d[0]+d[1]*d[1]||1)));return Math.hypot(p[0]-a[0]-t*d[0],p[1]-a[1]-t*d[1]);}));
  const surfaces=S.buildings.flatMap(b=>b.surfaces.map(f=>({layer:f.layer,q:f.points.map(p=>screen(gpu.growth.point(b.id,p)))})));
  // Candidate burning buildings near the demo fire, nearest first; pick the hot spot deepest inside a nearer surface.
  const centre=r.events[0].plot.ground,plotOf=new Map([...gpu.growth.plots.values()].filter(p=>p.building!=null).map(p=>[p.building,p.id]));
  let best=null;
  for(const b of S.buildings.filter(b=>plotOf.has(b.id)&&Math.hypot(b.ground[0]-centre[0],b.ground[1]-centre[1])<160)){
   for(const s of fireHotSpots(b,plotOf.get(b.id))){const c=screen(gpu.growth.point(b.id,wallPoint(s.wall,s.u,(s.v0+s.v1)/2)));if(c[0]<40||c[1]<40||c[0]>innerWidth-40||c[1]>innerHeight-40)continue;
    for(const f of surfaces)if(f.layer>s.wall.layer+1&&inside(c,f.q)){const d=edge(c,f.q);if(d>(best?.depthPx||0))best={plotId:plotOf.get(b.id),building:b.id,layer:s.wall.layer,cover:f.layer,c,depthPx:d};}}
  }
  if(!best)throw Error('No hot spot hidden behind a nearer surface');
  // Burn only that building; no responders, frozen time.
  const e=r.events[0];r.events.splice(0,r.events.length,e);e.group={...e.group,plotIds:new Set([best.plotId])};e.vehicles=[];e.born=0;
  window.__fireTime=5000;l.step=()=>{l.now=window.__fireTime;};l.aq.update=()=>{};const draw=l.aq.draw;l.aq.draw=()=>draw(window.__fireTime);
  const g=gpu.painter,uplight=g.uplight,target=best.c;window.__occ={mode:'normal'};
  g.uplight=function(q,c,...rest){const m=q.reduce((a,p)=>[a[0]+p[0]/q.length,a[1]+p[1]/q.length],[0,0]),sc=screen(m),hot=(c[0]===255&&(c[1]===168||c[1]===238))&&Math.hypot(sc[0]-target[0],sc[1]-target[1])<3;
   if(hot&&window.__occ.mode==='removed')return;if(hot&&window.__occ.mode==='front'){const z=this.depth;this.depth=-.97;uplight.call(this,q,c,...rest);this.depth=z;return;}return uplight.call(this,q,c,...rest);};
  return best;
 });
 const roi={x:Math.round(proof.c[0])-2,y:Math.round(proof.c[1])-2,width:5,height:5},read=async name=>{await p.waitForTimeout(250);const png=await p.screenshot({clip:roi});fs.writeFileSync(`${out}/${name}-roi.png`,png);await p.screenshot({path:`${out}/${name}.png`,clip:{x:roi.x-60,y:roi.y-60,width:125,height:125}});
  return p.evaluate(async b64=>{const im=await createImageBitmap(await (await fetch('data:image/png;base64,'+b64)).blob()),c=new OffscreenCanvas(im.width,im.height),x=c.getContext('2d');x.drawImage(im,0,0);return [...x.getImageData(0,0,im.width,im.height).data];},png.toString('base64'));};
 const shots={};for(const mode of ['normal','removed','front']){await p.evaluate(m=>{window.__occ.mode=m;},mode);shots[mode]=await read(mode);}
 const diff=(a,b)=>{let s=0,n=0;for(let i=0;i<a.length;i+=4){s+=Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2]);n+=3;}return s/n;};
 proof.negative=diff(shots.normal,shots.removed);proof.positive=diff(shots.front,shots.removed);proof.errors=errors;
 fs.writeFileSync(`${out}/occlusion.json`,JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
 assert(proof.negative<1.5,'Hidden hot spot adds nothing inside the nearer surface');assert(proof.positive>20,'Forced to the front, the same hot spot is plainly visible');assert.equal(errors.length,0);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
