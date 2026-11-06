// Headless-only evidence for work inside a district and the territory-growth recolouring: Dota2Helper at demo levels
// 0–3 at the whole-map view, the district framing and a closer zoom, in «Активность» and «Районы», reduced motion at
// level 3, and «Район растёт» from the test panel at 0, 5, 15 and 25 s, then «Сброс всего». /city is routed to the
// frozen territory snapshot; nothing opens the user's browser and nothing reaches the journal.
// Usage: CAPTURE_ORIGIN=http://127.0.0.1:8840 WORK_PROOF=<dir> [BEFORE_DIR=<dir with older gl/*.js>] node viz/tests/gl/district-work-headless.cjs
// BEFORE_DIR serves the gl scripts found there instead of the server's, for a before/after pair from one build.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const origin=process.env.CAPTURE_ORIGIN||'http://127.0.0.1:8840',out=process.env.WORK_PROOF||'/tmp/district-work-shots',before=process.env.BEFORE_DIR;
const city=fs.readFileSync(path.join(__dirname,'../growth/legacy-identity-city.json'),'utf8');
const DOTA='Dota2Helper';
const ONLY=process.env.ONLY;// 'growth': skip the level shots
fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--use-angle=metal']});
 const report={origin,before:before||null,headless:true,errors:[],shots:[],runs:{}};
 const open=async reduced=>{const p=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1,reducedMotion:reduced?'reduce':'no-preference'});
  p.on('pageerror',e=>report.errors.push(String(e.stack||e).split('\n').slice(0,3).join(' | ')));
  await p.route(/\/city(\?|$)/,r=>r.fulfill({contentType:'application/json',body:city}));
  if(before)await p.route('**/assets/gl/*.js',r=>{const f=path.join(before,new URL(r.request().url()).pathname.split('/').pop());fs.existsSync(f)?r.fulfill({contentType:'text/javascript',body:fs.readFileSync(f)}):r.continue();});
  await p.goto(origin+'/?map=1&live=1&lang=ru&follow=0&panel=1'+(reduced?'&reduced=1':''));
  await p.waitForFunction(()=>typeof layerCity!=='undefined'&&layerCity?.live?.gpu?.districtWork&&[...machines.values()].some(m=>m.cityData)&&document.querySelector('#celebration-panel [data-district=grow]'),null,{timeout:60000});
  await p.evaluate(()=>{const live=layerCity.live;document.querySelector('#celebration-panel').open=false;
   window.__project=id=>{for(const m of machines.values()){const p=m.cityData?.projects?.find(q=>q.id===id);if(p)return{p,city:m.cityData};}};
   window.__home=()=>{manual=true;cam.z=cam.tz=1;live.clampCamera(true);};
   // Frame a project's territory as the demos frame theirs (runtime.js camera block).
   window.__frame=id=>{const {p,city}=__project(id),T=live.gpu.districtWork.territory(p,city),xs=T.buildings.map(b=>b.ground[0]),ys=T.buildings.map(b=>b.ground[1]);
    const x0=Math.min(...xs)-20,x1=Math.max(...xs)+20,y0=Math.min(...ys)-70,y1=Math.max(...ys)+20,W=live.gpu.scene.w,H=live.gpu.scene.h,base=Math.max(W/1800,H/780);
    manual=true;cam.z=cam.tz=Math.min(4,Math.max(1,Math.min(W/(x1-x0+130),H/(y1-y0+110))/base));const v=live.cameraView(),k=base*cam.z,s=live.city.scale*live.factor;
    cam.x+=((x0+x1)/2-W/k/2-v.x)/s;cam.y+=((y0+y1)/2-H/k/2-v.y)/s;live.clampCamera(true);return{z:cam.z,buildings:T.buildings.length};};
   // Closer view: a world point at the screen centre, zoom z.
   window.__zoomAt=(x,y,z)=>{const W=live.gpu.scene.w,H=live.gpu.scene.h,base=Math.max(W/1800,H/780);
    manual=true;cam.z=cam.tz=z;const v=live.cameraView(),k=base*cam.z,s=live.city.scale*live.factor;cam.x+=(x-W/k/2-v.x)/s;cam.y+=(y-H/k/2-v.y)/s;live.clampCamera(true);return live.cameraView().z;};
   window.__zoom=(id,z)=>{const {p,city}=__project(id),T=live.gpu.districtWork.territory(p,city);return __zoomAt(T.ground[0],T.ground[1]-30,z);};
   window.__mode=m=>document.querySelector(`#growth-controls button[data-mode="${m}"]`).click();});
  return p;};
 const shot=async(p,name)=>{await p.screenshot({path:path.join(out,name+'.png')});report.shots.push(name+'.png');};
 const stats=p=>p.evaluate(()=>{const s=layerCity.live.gpu.districtWork.stats();return {...s,projects:s.projects.map(P=>({...P,buildings:P.buildings.length,twinkles:P.twinkles?.length,lamps:P.lamps?.length}))};});
 const level=(p,l)=>p.evaluate(([id,l])=>layerCity.live.gpu.districtWork.setDemo(id,l),[DOTA,l]);
 try{
  // Levels 0–3 in both page modes: whole map, district framing, closer.
  const p=await open(false);await p.waitForTimeout(3000);
  for(const mode of ONLY==='growth'?[]:['activity','territories']){const R=report.runs[mode]={};await p.evaluate(m=>__mode(m),mode);await p.waitForTimeout(1500);
   for(const l of [0,1,2,3]){await level(p,l);await p.waitForTimeout(2600);
    await p.evaluate(()=>__home());await p.waitForTimeout(400);await shot(p,`${mode}-map-level${l}`);
    R['frame'+l]=await p.evaluate(id=>__frame(id),DOTA);await p.waitForTimeout(400);await shot(p,`${mode}-district-level${l}`);
    R['zoom'+l]=await p.evaluate(id=>__zoom(id,2.6),DOTA);await p.waitForTimeout(400);await shot(p,`${mode}-close-level${l}`);R['stats'+l]=await stats(p);}
   // Three frames 1.7 s apart at level 3, close, to show breathing, motes and streaks.
   for(let i=0;i<3;i++){await p.waitForTimeout(1700);await shot(p,`${mode}-close-level3-t${i}`);}
   await level(p,0);}
  // Growth: «Район растёт» from the panel (it switches to «Районы»), then «Сброс всего»; Dota2Helper (dim tint, light 0.3)
  // and Delamain (light 1). Full frames plus a crop around the changed plots' buildings.
  for(const id of ['Dota2Helper','Delamain']){const G=report.runs['growth-'+id]={},tag='growth-'+id.toLowerCase();await p.evaluate(()=>__mode('activity'));await p.waitForTimeout(800);
   await p.evaluate(id=>{const s=document.querySelector('#celebration-project');s.value=id;s.dispatchEvent(new Event('change'));document.querySelector('#celebration-panel [data-district=grow]').click();},id);
   const t0=Date.now();G.changes=await p.evaluate(()=>districtGrowth.changes);G.mode=await p.evaluate(()=>districtGrowth.mode);
   G.zoom=await p.evaluate(changes=>{const g=layerCity.live.gpu.growth,pts=changes.flatMap(c=>c.plots).map(id=>g.plots.get(id).ground);const x=pts.reduce((a,q)=>a+q[0],0)/pts.length,y=pts.reduce((a,q)=>a+q[1],0)/pts.length;return __zoomAt(x,y-25,4);},G.changes);
   const clip={x:500,y:250,width:600,height:400};G.clip=clip;
   G.frames=[];for(const s of [0,5,15,25]){const wait=s*1000+300-(Date.now()-t0);if(wait>0)await p.waitForTimeout(wait);
    G.frames.push({s,wave:await p.evaluate(()=>{const w=layerCity.live.gpu.growthWave;return w?{t:Math.round(w.t),plan:(w.plan||[]).map(q=>[q.plot,Math.round(q.start)])}:null;})});
    await shot(p,`${tag}-${String(s).padStart(2,'0')}s`);await p.screenshot({path:path.join(out,`${tag}-${String(s).padStart(2,'0')}s-crop.png`),clip});}
   await p.evaluate(()=>document.querySelector('#celebration-panel [data-district=reset]').click());await p.waitForTimeout(800);G.afterReset=await p.evaluate(()=>({changes:districtGrowth.changes,wave:layerCity.live.gpu.growthWave}));await shot(p,`${tag}-reset`);}
  await p.close();
  if(ONLY==='growth')return;
  // Reduced motion: level 3, steady; two frames 2 s apart must match.
  const r=await open(true);await r.waitForTimeout(3000);const R=report.runs.reduced={};await level(r,3);await r.waitForTimeout(1500);
  R.frame=await r.evaluate(id=>__frame(id),DOTA);await r.waitForTimeout(400);await shot(r,'reduced-district-level3');R.stats=await stats(r);
  await r.evaluate(id=>__zoom(id,2.6),DOTA);await r.waitForTimeout(400);await shot(r,'reduced-close-level3-a');await r.waitForTimeout(2000);await shot(r,'reduced-close-level3-b');
  await r.close();
 }catch(e){report.errors.push(String(e.stack||e));}
 finally{await browser.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,1));console.log(JSON.stringify({errors:report.errors,shots:report.shots.length,out}));}
})();
