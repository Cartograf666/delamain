// Headless-only hub height evidence: four fixture hubs on real territories (fresh, 175k, 350k, closed), overview and
// close shots in both modes, a taxi landing on a raised hub roof, and a live rise (fresh -> 350k) carrying a parked
// taxi. /city and /state are routed; nothing opens the user's browser. On a build without hub height (before), only
// the overview and close shots are taken.
// Usage: CAPTURE_ORIGIN=http://127.0.0.1:8836 HUB_PROOF=<dir> [REDUCED=1] [ASSETS_FROM=<viz dir>] node viz/tests/gl/hub-height-headless.cjs
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const origin=process.env.CAPTURE_ORIGIN||'http://127.0.0.1:8836',out=process.env.HUB_PROOF||'/tmp/hub-height-shots';
const pick={'Куда за музыкой':'fixture-1','Clip Factory':'fixture-2','Dota2Helper':'fixture-3','Stravel':'fixture-4'};
const ctx={'fixture-1':0,'fixture-2':175000,'fixture-3':350000,'fixture-4':350000},closed={'fixture-4':true};
const stages=Object.values(pick);
const city=JSON.parse(fs.readFileSync(path.join(__dirname,'../growth/legacy-identity-city.json')));
for(const p of city.projects){p.stages=pick[p.id]?[pick[p.id]]:[];if(pick[p.id])p.light=1;}
fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--use-angle=metal']});
 const report={origin,headless:true,reduced:!!process.env.REDUCED,errors:[],shots:[],hubs:[],landing:null,rise:[]};
 try{const p=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1,reducedMotion:process.env.REDUCED?'reduce':'no-preference'});p.on('pageerror',e=>report.errors.push(String(e.stack||e).split('\n').slice(0,3).join(' | ')));
  await p.route('**/city',r=>r.fulfill({contentType:'application/json',body:JSON.stringify(city)}));
  // ASSETS_FROM=<viz dir>: serve assets/gl/*.js from a working tree over an older server build (its assets are embedded).
  if(process.env.ASSETS_FROM)await p.route('**/assets/gl/*.js',r=>{const f=path.join(process.env.ASSETS_FROM,'assets/gl',path.basename(new URL(r.request().url()).pathname));
   return fs.existsSync(f)?r.fulfill({contentType:'text/javascript',body:fs.readFileSync(f,'utf8')}):r.continue();});
  await p.goto(origin+'/?map=1&live=1&lang=ru&follow=0');
  await p.waitForFunction(s=>typeof layerCity!=='undefined'&&layerCity?.live?.aq&&s.every(st=>[...towers.values()].some(t=>t.stage===st&&t.lot)),stages,{timeout:60000});
  // State arrives over SSE: patch each applied state, then the towers already seen.
  await p.evaluate(([ctx,closed])=>{window.__hubCtx=ctx;const patch=s=>{for(const sv of s.stages||[])if(sv.name in window.__hubCtx){sv.hub={...(sv.hub||{}),ctx:window.__hubCtx[sv.name]};sv.questions=0;if(closed[sv.name])sv.open=false;}return s;},orig=applyState;
   applyState=(src,s)=>orig(src,patch(s));for(const t of towers.values())if(t.stage in ctx){t.ctx=ctx[t.stage];t.questions=0;if(closed[t.stage])t.open=false;}},[ctx,closed]);
  // Landing slots are few (about ten per district), so seat fixture-1 and fixture-3 on a slot-bearing plain house of
  // their own district, in the page and in the served /city (a refresh keeps it). Then wait out the 10 s change gap.
  const seats=await p.evaluate(stages=>stages.map(stage=>{const L=layerCity.live,g=L.gpu,aq=L.aq,t=[...towers.values()].find(t=>t.stage===stage),p=cityProject(t.machine,t.stage);
   const slotB=new Set(aq.LP.map(P=>g.buildingAt(...P.g).id)),used=new Set([...towers.values()].map(x=>x.lot)),H=b=>Math.max(...b.surfaces.filter(f=>f.kind==='wall').map(f=>f.points[1][1]-f.points[2][1]));
   const i=L.data.pads.findIndex((pad,i)=>{const lot=L.lots[i],b=g.buildingAt(...pad.g);return lot&&lot.d===p.zone&&lot!==layerCity.ownerBox&&!used.has(lot)&&slotB.has(b.id)&&b.surfaces.filter(f=>f.kind==='roof').length===1&&H(b)>=14&&H(b)<=50;});
   if(i<0)return {stage,tower:null};p.tower=i;t.lot=null;L.placeHubs();return {stage,project:p.id,tower:i};}),['fixture-1','fixture-3']);
  for(const s of seats)if(s.tower!=null)city.projects.find(p=>p.id===s.project).tower=s.tower;
  report.seats=seats;await p.waitForTimeout(14000);
  const hubs=()=>p.evaluate(()=>{const g=layerCity.live.gpu,f=g.hubFactors;return [...towers.values()].filter(t=>t.lot&&/^fixture-[1-4]$/.test(t.stage)).map(t=>{const id=g.buildingAt(...t.lot.pad.g).id;return {stage:t.stage,ctx:t.ctx,open:t.open,building:id,factor:f?f.get(id)??1:null,lift:g.hubLifts?.get(id)??null};});});
  report.hubs=await hubs();
  const shot=async name=>{await p.waitForTimeout(1200);await p.screenshot({path:path.join(out,name+'.png')});report.shots.push(name+'.png');};
  const close=(stage,z=3.2)=>p.evaluate(([stage,z])=>{const t=[...towers.values()].find(t=>t.stage===stage),[a,b]=isoRaw(t.lot.x,t.lot.y);manual=true;cam.x=cam.tx=a;cam.y=cam.ty=b-towerLift(t)*.8;cam.z=cam.tz=z;},[stage,z]);
  for(const mode of ['activity','territories']){
   await p.locator(`[data-mode="${mode}"]`).click();
   await p.evaluate(()=>{manual=false;cam.until=0;});await p.waitForTimeout(2500);await shot(`${mode}-overview`);
   for(const stage of stages){await close(stage);await shot(`${mode}-close-${stage}`);}
   await p.evaluate(()=>{manual=false;cam.until=0;});
  }
  if(await p.evaluate(()=>!!layerCity.live.gpu.hubHeights)){
   await p.locator('[data-mode="activity"]').click();
   // A taxi flies to a landing slot on the raised 350k roof (fixture-3); frames in descent and parked.
   // The hub's own taxi usually parks on its roof: it hops to a nearby free slot first, then flies back and lands.
   const send=async stage=>{const r=await p.evaluate(stage=>{const L=layerCity.live,aq=L.aq,g=L.gpu,t=[...towers.values()].find(t=>t.stage===stage),id=g.buildingAt(...t.lot.pad.g).id;
     const mine=aq.LP.filter(P=>g.buildingAt(...P.g).id===id),slot=mine.find(P=>!P.use.size)||mine[0];if(!slot)return {error:'no landing slot on '+stage};
     const occupant=aq.fl.find(f=>f.slot?.par===slot&&f.state==='park'),pick=occupant||aq.fl.filter(f=>f.state==='park'&&!f.cargo&&f.kind%3===0).sort((a,b)=>Math.hypot(a.x-slot.g[0],a.y-slot.g[1])-Math.hypot(b.x-slot.g[0],b.y-slot.g[1]))[0];if(!pick)return {error:'no idle taxi'};
     window.__cab=pick;window.__slot=slot;pick.work=false;pick.T=null;pick.homePad=null;
     if(occupant){const away=aq.LP.filter(P=>!P.use.size&&g.buildingAt(...P.g).id!==id).sort((a,b)=>Math.hypot(a.g[0]-slot.g[0],a.g[1]-slot.g[1])-Math.hypot(b.g[0]-slot.g[0],b.g[1]-slot.g[1]))[0];
      if(!away||!aq.go(pick,{d:away.d,g:away.g,p:away.p,pads:[away]},performance.now(),true))return {error:'occupant cannot leave'};}
     return {building:id,occupant:!!occupant,lift:g.hubLifts.get(id)};},stage);if(r.error)return r;
    if(r.occupant)await p.waitForFunction(()=>window.__cab.state==='park'&&window.__cab.at.par!==window.__slot,null,{timeout:40000});
    return {...r,...await p.evaluate(()=>{const f=window.__cab,slot=window.__slot,ok=layerCity.live.aq.go(f,{d:slot.d,g:slot.g,p:slot.p,pads:[slot]},performance.now(),true);
     return {ok,to:f.to===slot||f.to?.par===slot,slot:{g:slot.g,p:slot.p.slice(),roofZ:slot.g[1]-slot.p[1]},altitude:f.cz};})};};
   const cab=()=>p.evaluate(()=>{const f=window.__cab;return {state:f.state,z:+f.z.toFixed(2),roofZ:+(f.to.g[1]-f.to.p[1]).toFixed(2),x:+f.x.toFixed(1),y:+f.y.toFixed(1)};});
   await close('fixture-3',3.6);report.landing=await send('fixture-3').catch(e=>({error:String(e).slice(0,200)}));
   if(report.landing.ok&&report.landing.to){
    await p.waitForFunction(()=>window.__cab.state==='descend',null,{timeout:30000});await p.waitForTimeout(1000);
    report.landing.descend=await cab();await p.screenshot({path:path.join(out,'landing-descend-fixture-3.png')});report.shots.push('landing-descend-fixture-3.png');
    await p.waitForFunction(()=>window.__cab.state==='park',null,{timeout:30000});report.landing.parked=await cab();
    await p.evaluate(()=>{window.__cab.until=performance.now()+120000;});await shot('landing-parked-fixture-3');}
   // Live rise: park a taxi on the fresh hub (fixture-1), then its context jumps to 350k.
   await close('fixture-1',3.6);const parked=await send('fixture-1').catch(e=>({error:String(e).slice(0,200)}));report.rise.push({park:parked});
   if(parked.ok&&parked.to)await p.waitForFunction(()=>window.__cab.state==='park',null,{timeout:40000}).catch(()=>{});
   // Without a fresh landing, any taxi already parked on the hub roof rides the rise.
   report.rise.push({onRoof:await p.evaluate(()=>{const L=layerCity.live,g=L.gpu,t=[...towers.values()].find(t=>t.stage==='fixture-1'),id=g.buildingAt(...t.lot.pad.g).id;
    if(!(window.__cab?.state==='park'&&g.buildingAt(...window.__cab.at.g).id===id))window.__cab=L.aq.fl.find(f=>f.state==='park'&&f.at&&g.buildingAt(...f.at.g).id===id)||null;if(window.__cab)window.__cab.until=performance.now()+120000;return !!window.__cab;})});
   {
    await shot('rise-0-fixture-1');
    const t0=await p.evaluate(()=>{const t=[...towers.values()].find(t=>t.stage==='fixture-1');window.__hubCtx['fixture-1']=350000;t.ctx=350000;return performance.now();});
    for(const ms of [300,1500,4000]){await p.waitForTimeout(Math.max(0,ms-(await p.evaluate(t0=>performance.now()-t0,t0))));
     const s=await p.evaluate(()=>{const g=layerCity.live.gpu,t=[...towers.values()].find(t=>t.stage==='fixture-1'),id=g.buildingAt(...t.lot.pad.g).id,f=window.__cab;return {factor:g.hubFactors.get(id),lift:g.hubLifts.get(id),cab:f&&{state:f.state,z:f.z,roofZ:f.at.g[1]-f.at.p[1]}};});
     s.ms=ms;report.rise.push(s);await p.screenshot({path:path.join(out,`rise-${ms}-fixture-1.png`)});report.shots.push(`rise-${ms}-fixture-1.png`);}}
   report.stats=await p.evaluate(()=>{const s=layerCity.live.gpu.hubStats,r=a=>a.map(v=>+v.toFixed(2));return {cityMeshMs:r(s.cityMeshMs),clearanceMs:r(s.clearanceMs),wallsMs:r(s.wallsMs),frameMsMax:+Math.max(0,...s.frameMs).toFixed(2),frames:s.frameMs.length};});
   report.hubsAfter=await hubs();
  }
 }catch(e){report.errors.push(String(e.stack||e));}
 finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,1));await browser.close();console.log(JSON.stringify({errors:report.errors,hubs:report.hubs,landing:report.landing,rise:report.rise,stats:report.stats,shots:report.shots.length}));}
})();
