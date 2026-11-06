// Headless-only evidence for celebrations: PR, merge and release over Dota2Helper at the overview zoom and a closer
// zoom, frozen at fixed event ages (the effect is analytic in age), plus reduced motion. /city is routed to the frozen
// territory snapshot; nothing opens the user's browser and nothing reaches the journal.
// Usage: CAPTURE_ORIGIN=http://127.0.0.1:8839 CELEB_PROOF=<dir> [MODULE=<celebrations.js to serve>] [TAG=after]
//        node viz/tests/gl/celebrations-headless.cjs
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const origin=process.env.CAPTURE_ORIGIN||'http://127.0.0.1:8839',out=process.env.CELEB_PROOF||'/tmp/celebrations-shots',tag=process.env.TAG||'after';
const module_=process.env.MODULE||path.join(__dirname,'../../assets/gl/celebrations.js');
const city=fs.readFileSync(path.join(__dirname,'../growth/legacy-identity-city.json'),'utf8');
const DOTA='Dota2Helper';
const AGES={'pr-opened':{ignition:800,passing:1450,gone:3300},'pr-merged':{ignition:1000,passing:1350,late:2600,gone:5600},release:{ignition:1350,passing:2750,third:3900,afterglow:5200,finale:11800,gone:19500}};
const REDUCED={'pr-merged':{steady:3000},release:{steady:5000}};
fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--use-angle=metal']});
 const report={origin,tag,module:module_,headless:true,errors:[],shots:[],events:{}};
 const open=async reduced=>{const p=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1,reducedMotion:reduced?'reduce':'no-preference'});
  p.on('pageerror',e=>report.errors.push(String(e.stack||e).split('\n').slice(0,3).join(' | ')));
  await p.route('**/city',r=>r.fulfill({contentType:'application/json',body:city}));
  await p.route('**/assets/gl/celebrations.js',r=>r.fulfill({contentType:'text/javascript',path:module_}));
  await p.goto(origin+'/?map=1&live=1&lang=ru&follow=0');
  await p.waitForFunction(()=>typeof layerCity!=='undefined'&&layerCity?.live?.aq?.celebrations&&[...machines.values()].some(m=>m.cityData?.projects?.length),null,{timeout:60000});
  await p.evaluate(()=>{const C=layerCity.live.aq.celebrations,u=C.update,d=C.draw;
   // Freeze: while __t is set, the module sees that instant on every frame.
   C.update=n=>u(window.__t??n);C.draw=n=>d(window.__t??n);
   window.__project=id=>{for(const m of machines.values()){const p=m.cityData?.projects?.find(q=>q.id===id);if(p)return{p,city:m.cityData};}};
   window.__zoom=(e,z)=>{const live=layerCity.live,W=live.gpu.scene.w,H=live.gpu.scene.h,base=Math.max(W/1800,H/780);
    manual=true;cam.z=cam.tz=z;live.clampCamera(true);const v=live.cameraView(),k=base*cam.z,s=live.city.scale*live.factor;
    cam.x+=(e.anchor[0]-W/k/2-v.x)/s;cam.y+=(e.anchor[1]-60-H/k/2-v.y)/s;live.clampCamera(true);};
   // Lit buildings and their owners, from the snapshot's plotOwners.
   window.__lit=e=>{const G=layerCity.live.gpu.growth,own=new Map((G.snapshot?.plotOwners||[]).map(o=>[o.id,o.owner])),byBuilding=new Map();
    for(const [id,plot] of G.plots)if(plot.building!=null){const o=own.get(id);if(!byBuilding.has(plot.building)||o)byBuilding.set(plot.building,o);}
    const owners={};for(const b of e.buildings){const o=byBuilding.get(b.b.id)??'?';owners[o]=(owners[o]||0)+1;}
    return{buildings:e.buildings.length,reach:Math.round(e.reach),owners,windows:e.windows.length,waveAt:Math.round(e.waveAt),duration:Math.round(e.duration),shells:e.shells.length};};});
  return p;};
 const shot=async(p,name)=>{await p.waitForTimeout(120);await p.screenshot({path:path.join(out,`${tag}-${name}.png`)});report.shots.push(`${tag}-${name}.png`);};
 // Plays one event and returns it frozen at age 0; ages are set through __t.
 const play=(p,kind)=>p.evaluate(([kind,id])=>{const C=layerCity.live.aq.celebrations;window.__t=undefined;for(const e of C.events)e.born=-1e9;
  C.play(kind,__project(id).p);return new Promise(res=>{const tick=()=>{const e=C.events.at(-1);if(e&&e.kind===kind&&e.born>0){window.__born=e.born;res(__lit(e));}else requestAnimationFrame(tick);};tick();});},[kind,DOTA]);
 const at=(p,age)=>p.evaluate(age=>{window.__t=window.__born+age;},age);
 try{
  for(const reduced of [false,true]){const p=await open(reduced),plan=reduced?REDUCED:AGES;
   for(const [kind,ages] of Object.entries(plan)){
    for(const zoom of reduced?['close']:['overview','close']){
     const info=await play(p,kind);report.events[`${reduced?'reduced-':''}${kind}-${zoom}`]=info;
     const e=await p.evaluateHandle(()=>layerCity.live.aq.celebrations.events.at(-1));
     await p.evaluate(([e,z])=>{if(z==='overview'){manual=true;cam.z=cam.tz=1;layerCity.live.clampCamera(true);}else __zoom(e,2.4);},[e,zoom]);
     for(const [name,age] of Object.entries(ages)){await at(p,age);await shot(p,`${reduced?'reduced-':''}${kind}-${zoom}-${name}`);}
    }
   }
   // Live cost: a release and a merge running unfrozen, frame intervals over 3 s.
   if(!reduced){await p.evaluate(()=>{window.__t=undefined;});await play(p,'release');await play(p,'pr-merged');
    await p.evaluate(()=>{window.__t=undefined;});
    report.frames=await p.evaluate(()=>new Promise(res=>{const t=[];let last=performance.now();const f=n=>{t.push(n-last);last=n;if(t.length<180)requestAnimationFrame(f);else{t.sort((a,b)=>a-b);res({median:+t[90].toFixed(1),p95:+t[171].toFixed(1),particles:layerCity.live.aq.celebrations.stats.maxParticles});}};requestAnimationFrame(f);}));}
   await p.close();
  }
 }finally{fs.writeFileSync(path.join(out,`${tag}-report.json`),JSON.stringify(report,null,1));await browser.close();}
 console.log(JSON.stringify({errors:report.errors,events:report.events,frames:report.frames},null,1));
})().catch(e=>{console.error(e);process.exit(1);});
