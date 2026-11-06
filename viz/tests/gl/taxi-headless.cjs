// Background-only taxi evidence: three fixture stages get real territories from the frozen snapshot via a routed /city.
// Records every taxi over time, fires addressed deliveries, saves zoomed/territory screenshots. Never opens the user's browser.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const origin=process.env.CAPTURE_ORIGIN||'http://127.0.0.1:8832',out=process.env.TAXI_PROOF||'./work/shots/taxi';
// fixture-4..6 sit on real territories without landing slots: they park by their main tower and do not patrol.
const pick={'Куда за музыкой':'fixture-1','Clip Factory':'fixture-2','Dota2Helper':'fixture-3','Dark Patterns':'fixture-4','Sochen':'fixture-5','Twin Lab':'fixture-6'};
const city=JSON.parse(fs.readFileSync(path.join(__dirname,'../growth/legacy-identity-city.json')));
for(const p of city.projects){p.stages=pick[p.id]?[pick[p.id]]:[];if(pick[p.id])p.light=1;}
fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--use-angle=metal']});
 const report={origin,headless:true,errors:[],shots:[]};
 try{const p=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1});p.on('pageerror',e=>report.errors.push(String(e.stack||e).split('\n').slice(0,3).join(' | ')));
  await p.route('**/city',r=>r.fulfill({contentType:'application/json',body:JSON.stringify(city)}));
  await p.goto(origin+'/?map=1&live=1&lang=ru&follow=0');
  await p.waitForFunction(()=>typeof layerCity!=='undefined'&&layerCity?.live?.aq&&[...machines.values()].some(m=>m.cityData)&&[...towers.values()].some(t=>t.lot));
  await p.locator('[data-mode="territories"]').click();
  // Fixture drive: the three seated stages count as working so their taxis patrol.
  await p.evaluate(()=>{const seated=new Set(['fixture-1','fixture-2','fixture-3']);setInterval(()=>{for(const c of cabs.values())if(seated.has(c.stage))c.working=true},100);
   const aq=layerCity.live.aq,src=[...machines.keys()].find(s=>machines.get(s).stages?.has('fixture-1')),slotProj=new Map();for(const q of machines.get(src).cityData.projects){const T=aq.territory(src,q);if(T)for(const P of T.slots)slotProj.set(P,q.id)}window.__rec=[];const t0=performance.now();
   setInterval(()=>{const now=performance.now()-t0;for(const f of aq.fl)__rec.push({t:Math.round(now),key:f.key||'temp',stage:f.stage,x:+f.x.toFixed(1),y:+f.y.toFixed(1),z:+f.z.toFixed(1),state:f.state,cargo:f.cargo,trip:f.trip||'',T:f.T?.p.id||null,nslots:f.T?.slots.length,
     inT:f.T?f.T.slots.includes(f.slot?.par):null,home:f.T?f.T.home.includes(f.slot?.par):null,sp:slotProj.get(f.slot?.par)||null,slot:f.slot?.par?.p?.map(v=>Math.round(v)).join(','),homePad:f.homePad?.p?.map(v=>Math.round(v)).join(','),dest:f.dest?.g?.map(v=>Math.round(v)).join(',')})},200);});
  await p.waitForTimeout(25000);
  await p.screenshot({path:out+'/taxi-territories-before.png'});report.shots.push('taxi-territories-before.png');
  // Deliveries: cross-project, @owner, unaddressed, in-project @role, then the event hook.
  const sent=await p.evaluate(()=>{const aq=layerCity.live.aq,src=[...machines.keys()].find(s=>machines.get(s).stages?.has('fixture-1')),st=s=>machines.get(src).stages.get(s),w=s=>[...st(s).workers.keys()];
   if(!src)throw Error('no fixture machine: '+JSON.stringify([...machines.keys()]));const D=(stage,to,i=0)=>{const role=w(stage)[i],c=st(stage).workers.get(role);aq.dispatch(aq.fl.find(f=>f.worker===c)?.d??0,performance.now(),role,c?.key,src,{stage,from:[stage,role],to,text:'fixture'});return {stage,role,to,key:c?.key}};
   const r=[D('fixture-1',[['fixture-2','hub']]),D('fixture-2',[['','owner']]),D('fixture-3',[]),D('fixture-1',[['fixture-1',w('fixture-1')[2]]],1),...[...machines.get(src).stages.keys()].filter(s=>!/^fixture-[123]$/.test(s)&&w(s).length).slice(0,1).map(s=>D(s,[['fixture-1','hub']]))];
   r.push({event:aq.dispatchEvent(machines.get(src).cityData.projects.find(p=>p.id==='Dota2Helper'),'release')});return r});
  report.sent=sent;
  // Zoom on the cross-project delivery while it is loaded and cruising.
  const key=sent[0].key;await p.waitForFunction(k=>layerCity.live.aq.fl.some(f=>f.key===k&&f.cargo===1&&f.state==='cruise'),key,{timeout:20000});
  for(const [i,z] of [[1,3.2],[2,3.2]]){await p.evaluate(([k,z])=>{const f=layerCity.live.aq.fl.find(q=>q.key===k),l=layerCity.live;manual=true;cam.z=cam.tz=z;const base=Math.max(W/1800,H/780),v=l.cameraView(),kk=base*cam.z,s=l.city.scale*l.factor;cam.x+=(f.x-W/kk/2-v.x)/s;cam.y+=(f.y-f.z-H/kk/2-v.y)/s;cam.tx=cam.x;cam.ty=cam.y;},[key,z]);
   await p.waitForTimeout(60);const name=`taxi-container-${i}.png`;await p.screenshot({path:out+'/'+name});report.shots.push(name);await p.waitForTimeout(700);}
  await p.evaluate(()=>{manual=false;});await p.waitForTimeout(60000);
  await p.screenshot({path:out+'/taxi-territories-after.png'});report.shots.push('taxi-territories-after.png');
  report.records=await p.evaluate(()=>__rec);
 }finally{await browser.close();}
 const R=report.records,by=new Map();for(const r of R){if(!by.has(r.key))by.set(r.key,[]);by.get(r.key).push(r);}
 // Patrol: once a seated taxi has reached home, every empty landing is inside its territory.
 const summary={taxis:by.size,seated:{},legacy:0,deliveries:[]};
 for(const [k,L] of by){const T=L[0].T;if(!T){summary.legacy++;continue;}const s=summary.seated[T]||(summary.seated[T]={taxis:0,landings:0,outside:0});s.taxis++;s.slots=L[0].nslots;let reached=false,prev=null;
  for(const r of L){if(prev&&prev.state!=='park'&&r.state==='park'&&r.cargo===0&&reached){s.landings++;if(prev.cargo===0){s.patrol=(s.patrol||0)+1;if(!r.inT&&!r.home)s.outside++;}else if(!r.inT&&!r.home)s.returnOutside=(s.returnOutside||0)+1;}if(r.home&&r.state==='park')reached=true;prev=r;}}
 for(const d of report.sent.filter(d=>d.key)){const L=by.get(d.key)||[],load=L.find(r=>r.cargo===1),drop=L.find(r=>r.cargo===2),back=load&&L.find(r=>r.t>drop?.t&&r.cargo===0&&r.state==='park');
  summary.deliveries.push({...d,from:load?.homePad,dest:load?.dest,unloadedAt:drop?.slot,unloadedIn:drop?.sp,authorT:load?.T,returnedTo:back?.slot,returnedHomePad:back?back.slot===load.homePad:null,returnedIn:back?.sp});}
 report.summary=summary;fs.writeFileSync(out+'/taxi-report.json',JSON.stringify(report,null,1));
 console.log(JSON.stringify({errors:report.errors,shots:report.shots,summary},null,1));
 assert.deepEqual(report.errors,[]);for(const [T,s] of Object.entries(summary.seated))assert.equal(s.outside,0,T+' patrol left its territory');for(const [T,s] of Object.entries(summary.seated))if(s.slots<2)assert(!s.patrol,T+' without landing slots must not patrol');
})().catch(e=>{console.error(e);process.exitCode=1});
