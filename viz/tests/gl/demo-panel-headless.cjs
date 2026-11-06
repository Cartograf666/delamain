// Background-only evidence for the test stand panel on the live page (panel=1): clicks every taxi button, records the
// virtual cabs over time, crops loaded taxis, checks caps, reset, folding and focus. Never opens the user's browser.
// Run: CAPTURE_ORIGIN=http://127.0.0.1:8834 DEMO_PROOF=<dir> node viz/tests/gl/demo-panel-headless.cjs
const {chromium}=require('playwright');
const fs=require('node:fs');
const origin=process.env.CAPTURE_ORIGIN||'http://127.0.0.1:8834',out=process.env.DEMO_PROOF||'/tmp/demo-events/shots';
const link='/?map=1&live=1&lang=ru&follow=0&panel=1';
fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--use-angle=metal']});
 const report={origin,link,headless:true,errors:[],shots:[],trips:{}};
 const shot=async(p,name,clip)=>{await p.screenshot({path:`${out}/${name}.png`,...(clip?{clip}:{})});report.shots.push(name+'.png');};
 try{const p=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:2});p.on('pageerror',e=>report.errors.push(String(e.stack||e).split('\n').slice(0,3).join(' | ')));
  await p.goto(origin+link);
  await p.waitForFunction(()=>typeof layerCity!=='undefined'&&layerCity?.live?.aq&&document.querySelector('#celebration-panel [data-taxi]'),null,{timeout:60000});
  await p.waitForTimeout(3000);
  report.options=await p.$$eval('#celebration-project option',o=>o.map(x=>x.value));
  report.buttons=await p.$$eval('#celebration-panel button',b=>b.map(x=>x.textContent));
  report.panelBox=await p.$eval('#celebration-panel',e=>e.getBoundingClientRect().toJSON());
  await shot(p,'panel-overview');
  // Recorder: every virtual cab every 150 ms, with its screen point (the drawn sprite sits at y - z).
  await p.evaluate(()=>{const aq=layerCity.live.aq,live=layerCity.live,t0=performance.now();window.__rec=[];
   window.__scr=f=>{const v=live.cameraView(),k=Math.max(innerWidth/1800,innerHeight/780)*v.z;return[Math.round((f.x-v.x)*k),Math.round((f.y-f.z-v.y)*k)];};
   setInterval(()=>{const t=Math.round(performance.now()-t0);for(const f of aq.fl)if(f.demo)__rec.push({t,key:f.key||'temp',temp:!!f.temp,x:+f.x.toFixed(1),y:+f.y.toFixed(1),z:+f.z.toFixed(1),state:f.state,cargo:f.cargo,trip:f.trip||'',T:f.T?.p.id,dest:f.dest?.g?.map(Math.round)||null,home:f.homePad?.g?.map(Math.round)||null,atHome:!!f.T?.home.includes(f.slot?.par),inOwn:!!f.T?.slots.includes(f.slot?.par),scr:__scr(f)});},150);});
  const project=report.options[0];await p.selectOption('#celebration-project',project);report.project=project;
  // One delivery button at a time: follow the loaded virtual cab from author to target and home.
  for(const kind of ['project','owner','neighbour','event']){
   const since=await p.evaluate(()=>__rec.at(-1)?.t??0);await p.click(`#celebration-panel [data-taxi="${kind}"]`);
   let cropped=false,cruised=false,done=false;const t0=Date.now();
   while(Date.now()-t0<70000){await p.waitForTimeout(250);
    await p.waitForTimeout(0);const s=await p.evaluate(()=>{const f=layerCity.live.aq.fl.find(f=>f.demo&&f.cargo===1);return f?{scr:__scr(f),state:f.state}:null;});
    const inView=s&&s.scr[0]>130&&s.scr[0]<1470&&s.scr[1]>100&&s.scr[1]<900,crop=s&&{x:s.scr[0]-120,y:s.scr[1]-90,width:240,height:180};
    if(inView&&!cropped&&s.state!=='park'){cropped=true;await shot(p,`loaded-${kind}`,crop);}
    if(inView&&!cruised&&s.state==='cruise'){cruised=true;await shot(p,`loaded-${kind}-cruise`,crop);}
    const r=await p.evaluate(s=>{const L=__rec.filter(q=>q.t>s&&q.trip);return{seen:L.length,loaded:L.some(q=>q.cargo===1),busy:layerCity.live.aq.fl.some(f=>f.demo&&f.cargo)};},since);
    if(r.loaded&&!r.busy){done=true;break;}}
   report.trips[kind]=await p.evaluate(s=>{const L=__rec.filter(q=>q.t>s);const keys=[...new Set(L.filter(q=>q.cargo===1).map(q=>q.key))];const k=keys[0],M=L.filter(q=>q.key===k);
    const first=M.find(q=>q.cargo===1),unload=M.find(q=>q.cargo===2),end=M.filter(q=>q.cargo===0&&q.t>(unload?.t??0)).at(0)||M.at(-1);
    const D=(a,b)=>a&&b?Math.round(Math.hypot(a[0]-b[0],(a[1]-b[1])*2)):null;
    return{key:k,temp:first?.temp,T:first?.T,start:first&&[first.x,first.y],dest:first?.dest,arrivedAt:unload&&[unload.x,unload.y],arriveToDest:D(unload&&[unload.x,unload.y],first?.dest),home:first?.home,end:end&&[end.x,end.y],endToHome:D(end&&[end.x,end.y],first?.home),endAtHome:end?.atHome,endInOwn:end?.inOwn,
     loadedSamples:M.filter(q=>q.cargo===1).length,phases:[...new Set(M.map(q=>q.cargo+':'+q.state))].join(' '),path:M.filter((q,i)=>i%8===0).map(q=>[q.t,q.x,q.y,q.z,q.cargo])};},since);
   report.trips[kind].finished=done;
  }
  // Patrol: 25 s on, then off; landings must stay inside the cabs' own territory.
  const ps=await p.evaluate(()=>__rec.at(-1)?.t??0);await p.click('#celebration-panel [data-taxi="patrol"]');report.patrolPressed=await p.getAttribute('[data-taxi="patrol"]','aria-pressed');await p.waitForTimeout(25000);
  report.patrol=await p.evaluate(s=>{const L=__rec.filter(q=>q.t>s),land=[];let prev={};for(const q of L){if(prev[q.key]&&prev[q.key]!=='park'&&q.state==='park')land.push({key:q.key,inOwn:q.inOwn});prev[q.key]=q.state;}return{landings:land.length,outside:land.filter(l=>!l.inOwn).length,moving:L.filter(q=>q.state!=='park').length};},ps);
  await p.click('#celebration-panel [data-taxi="patrol"]');
  // Five at once on this project, then on two more: caps 3 per project and 9 per city, owner trip first in the queue.
  const caps=async()=>p.evaluate(()=>{const aq=layerCity.live.aq,by={};for(const f of aq.fl)if(f.cargo===1||f.cargo===2&&f.demo){const k=f.T?.p.id||'?';by[k]=(by[k]||0)+(f.cargo?1:0);}return{counts:aq.demo.counts(),perProject:by,queueOwnerFirst:aq.queue.length?aq.queue[0].owner:null,queue:aq.queue.map(j=>[j.T?.p.id,j.target||j.kind,j.owner]),text:document.getElementById('demo-taxi-counts').textContent};});
  await p.click('#celebration-panel [data-taxi="five"]');await p.waitForTimeout(400);report.five1=await caps();
  for(const id of report.options.slice(1,3)){await p.selectOption('#celebration-project',id);await p.click('#celebration-panel [data-taxi="five"]');}
  await p.waitForTimeout(400);report.five3=await caps();
  // More projects until the city cap binds; sample the cargo count meanwhile, it must never pass nine.
  let peak=0;for(const id of report.options.slice(3,9)){if((await caps()).counts.cargo>=9)break;await p.selectOption('#celebration-project',id);await p.click('#celebration-panel [data-taxi="five"]');await p.waitForTimeout(300);}
  for(let i=0;i<15;i++){peak=Math.max(peak,(await caps()).counts.cargo);await p.waitForTimeout(200);}report.cityPeak=peak;report.fiveMore=await caps();await shot(p,'five-at-once');
  await shot(p,'panel-counters',{x:report.panelBox.x-4,y:report.panelBox.y-4,width:report.panelBox.width+8,height:report.panelBox.height+8});
  // Fireworks: the three original buttons still play over the selected project.
  for(const kind of ['pr-opened','pr-merged','release']){await p.click(`#celebration-panel [data-kind="${kind}"]`);await p.waitForTimeout(2500);await shot(p,'firework-'+kind);}
  report.fireworks=await p.evaluate(()=>layerCity.live.aq.celebrations.stats);
  // Reset: no virtual cab, no virtual trip, at once and a few seconds later.
  await p.click('#celebration-panel [data-taxi="reset"]');
  report.reset=await p.evaluate(()=>{const aq=layerCity.live.aq;return{cabs:aq.fl.filter(f=>f.demo).length,queued:aq.queue.filter(j=>j.demo).length};});
  await p.waitForTimeout(4000);report.resetLater=await p.evaluate(()=>{const aq=layerCity.live.aq;return{cabs:aq.fl.filter(f=>f.demo).length,queued:aq.queue.filter(j=>j.demo).length,text:document.getElementById('demo-taxi-counts').textContent};});
  await shot(p,'after-reset');
  // Keyboard: Tab reaches the panel buttons; the focused one shows its ring.
  await p.focus('#celebration-project');await p.keyboard.press('Tab');await p.keyboard.press('Tab');
  report.focused=await p.evaluate(()=>{const e=document.activeElement;return{text:e.textContent,outline:getComputedStyle(e).outlineStyle+' '+getComputedStyle(e).outlineWidth};});
  await shot(p,'focus-ring',{x:report.panelBox.x-4,y:report.panelBox.y-4,width:report.panelBox.width+8,height:report.panelBox.height+8});
  // Phone width: folded by default, opens on its summary.
  const m=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});m.on('pageerror',e=>report.errors.push('phone: '+String(e).slice(0,200)));
  await m.goto(origin+link);await m.waitForSelector('#celebration-panel',{timeout:60000,state:'attached'});await m.waitForTimeout(2500);
  report.phone={open:await m.$eval('#celebration-panel',e=>e.open),box:await m.$eval('#celebration-panel',e=>e.getBoundingClientRect().toJSON())};await shot(m,'phone-folded');
  await m.click('#celebration-panel summary');await m.waitForTimeout(300);report.phone.openBox=await m.$eval('#celebration-panel',e=>e.getBoundingClientRect().toJSON());await shot(m,'phone-open');
 }catch(e){report.errors.push('script: '+String(e.stack||e).split('\n').slice(0,4).join(' | '));}
 finally{await browser.close();fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,1));console.log(JSON.stringify({...report,trips:Object.fromEntries(Object.entries(report.trips).map(([k,v])=>[k,{...v,path:v.path?.length}]))},null,1));}
})();
