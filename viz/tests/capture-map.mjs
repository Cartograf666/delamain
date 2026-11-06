// Isolated CDP evidence runner. Start your own Chrome and fixture servers; this never starts/stops processes.
// node viz/tests/capture-layers.mjs CDP_PORT BEFORE_PORT AFTER_PORT OUTPUT_DIRECTORY
import fs from 'node:fs';
import path from 'node:path';
const [cdpPort='9881', beforePort='8871', afterPort='8771', output='./work/shots'] = process.argv.slice(2);
fs.mkdirSync(output,{recursive:true});
const tabs=await (await fetch(`http://127.0.0.1:${cdpPort}/json`)).json();
const tab=tabs.find(t=>t.type==='page');
const ws=new WebSocket(tab.webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
let id=0;const pending=new Map(),errors=[];
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);else if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')errors.push(m.params.args);};
const call=(method,params={})=>new Promise((resolve,reject)=>{pending.set(++id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
const ev=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const shot=async name=>fs.writeFileSync(path.join(output,name+'.png'),Buffer.from((await call('Page.captureScreenshot',{captureBeyondViewport:false})).data,'base64'));
const wait=async(test)=>{for(let n=0;n<200;n++){if(await ev(test))return;await delay(100);}throw Error('Timed out: '+test);};
await call('Page.enable');await call('Runtime.enable');
await call('Emulation.setDeviceMetricsOverride',{width:1600,height:1000,deviceScaleFactor:1,mobile:false});
const init=await call('Page.addScriptToEvaluateOnNewDocument',{source:`
let seed=20771;Math.random=()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
let clock=0,sequence=0;const raf=new Map();performance.now=()=>clock;
window.requestAnimationFrame=cb=>{raf.set(++sequence,cb);return sequence;};window.cancelAnimationFrame=id=>raf.delete(id);
window.__step=t=>{clock=t;const q=[...raf.values()];raf.clear();q.forEach(cb=>cb(t));};
window.setInterval=()=>0;
`});
const load=async(port,query)=>{await call('Page.navigate',{url:`http://127.0.0.1:${port}/?lang=ru&follow=0${query}`});await wait('typeof cabs!=="undefined" && cabs.size===30');await ev('Promise.all([ready,document.fonts.ready])');await ev(`(()=>{const s=document.createElement('style');s.textContent='*,*::before,*::after{animation:none!important;transition:none!important}';document.head.appendChild(s);})()`);};

const results={};
for(const [port,query,name] of [[beforePort,'','map-reference'],[afterPort,'','map-off'],[afterPort,'&map=0','map-disabled'],[afterPort,'&layers=1','map-layers-smoke'],[afterPort,'&map=1&sprites=0','map-boxes-overview'],[afterPort,'&map=1&sprites=1','map-sprites-overview'],[afterPort,'&map=1','map-overview']]){
 await load(port,query);await ev('renderRoster();for(let i=1;i<=40;i++)__step(i*25);');await shot(name);if(query.includes('&map=1'))fs.writeFileSync(path.join(output,name+'-canvas.png'),Buffer.from((await ev('cv.toDataURL()')).split(',')[1],'base64'));
 if(query==='&layers=1')results.layersSmoke=await ev('layerCity.constructor.name==="LayerCity"');
 if(query==='&map=1&sprites=0'){
  await ev('manual=true;cam.x=cam.tx=CX-CY+(layerCity.data.core[0]-layerCity.data.core[1])/12;cam.y=cam.ty=(CX+CY)/2+(layerCity.data.core[0]+layerCity.data.core[1])/24-13;cam.z=cam.tz=2.5;__step(1025);');await shot('map-boxes-core');
 }
 if(query==='&map=1&sprites=1'){
  await ev('manual=true;cam.x=cam.tx=CX-CY+(layerCity.data.core[0]-layerCity.data.core[1])/12;cam.y=cam.ty=(CX+CY)/2+(layerCity.data.core[0]+layerCity.data.core[1])/24-13;cam.z=cam.tz=2.5;__step(1025);');await shot('map-sprites-core');
  results.spritesModel=await ev('({sprites:layerCity.spriteCount,loadedImages:layerCity.spriteImages.size})');
 }
 if(query==='&map=1'){
  results.labels=await ev('({ownerBox:G.owner.id,ownerLabel:T.owner,reservations:layerCity.labelReservations,panels:layerCity.labelObstacles})');
  results.model=await ev('({cabs:cabs.size,hubs:towers.size,lots:G.lots.length,nodes:G.nodes.length,sprites:layerCity.spriteCount,loadedImages:layerCity.spriteImages.size,keys:[...towers.values()].map(t=>({stage:t.stage,id:t.lot.id,district:t.district})),owner:G.owner.id,loads:Object.fromEntries(layerCity.loads)})');
  results.deterministicFirst=await ev('Object.fromEntries([...layerCity.cache].map(([name,c])=>[name,hash(c.canvas.toDataURL())]))');
  results.hits=await ev(`(()=>{const all=[...towers.values(),owner];return all.map(t=>{const b=t.kind==='owner'?G.owner:t.lot,[x0,y0,x1,y1]=b.box;let point=null;
   for(let face=0;face<2&&!point;face++)for(let i=1;i<20&&!point;i++)for(let j=19;j>0&&!point;j--){const p=P(CX+(face?x1:x0+(x1-x0)*i/20)/12,CY+(face?y0+(y1-y0)*i/20:y1)/12,b.lift*j/20);if(layerCity.hitKey(...p)===t)point=p;}
   return {key:t.key,hit:!!point,point,tooltip:tipLines(t)}})})()`);
  await ev('manual=true;cam.x=cam.tx=CX-CY+(layerCity.data.core[0]-layerCity.data.core[1])/12;cam.y=cam.ty=(CX+CY)/2+(layerCity.data.core[0]+layerCity.data.core[1])/24-13;cam.z=cam.tz=2.5;__step(1025);');await shot('map-core-zoom');results.zoomLabels=await ev('({reservations:layerCity.labelReservations,panels:layerCity.labelObstacles})');
  results.loadChange=await ev(`(()=>{
   const original=layerCity.sources.get(SOURCES[0]),stage=original.stages.find(s=>districtFor(s.repo)==='core');
   window.__originalState=original;
   window.__alter=n=>({...original,stages:original.stages.map(s=>s===stage?{...s,workers:Array.from({length:n},(_,i)=>({role:'load-probe-'+i}))}:s)});
   layerCity.applyState(SOURCES[0],__alter(0));__step(1050);return {zero:layerCity.loads.get('core').level,before:{...layerCity.rebuilds},images:Object.fromEntries([...layerCity.cache].map(([name,c])=>[name,hash(c.canvas.toDataURL())]))};
  })()`);await shot('map-load-0');
  const changed=await ev(`(()=>{layerCity.applyState(SOURCES[0],__alter(10));__step(1075);return {full:layerCity.loads.get('core').level,after:{...layerCity.rebuilds},images:Object.fromEntries([...layerCity.cache].map(([name,c])=>[name,hash(c.canvas.toDataURL())]))}})()`);await shot('map-load-100');results.loadChange.changedCaches=Object.keys(changed.images).filter(k=>changed.images[k]!==results.loadChange.images[k]);
  results.loadChange={...results.loadChange,...changed};
  await ev('layerCity.applyState(SOURCES[0],__originalState);__step(1100);');
  results.lifecycle=await ev(`(()=>{
   const original=layerCity.sources.get(SOURCES[0]),cab=[...cabs.values()][0],removed={...original,stages:original.stages.map(s=>s.name===cab.stage?{...s,workers:s.workers.filter(w=>w.role!==cab.role)}:s)};
   applyState(SOURCES[0],removed);let time=1100,maxXY=0,maxZ=0;
   for(let i=0;i<30;i++)__step(time+=25);const partial=cab.leaving&&!cab.landed;
   applyState(SOURCES[0],original);
   for(let i=0;i<100;i++){const p=[cab.x,cab.y,cab.z];__step(time+=25);maxXY=Math.max(maxXY,Math.hypot(cab.x-p[0],cab.y-p[1]));maxZ=Math.max(maxZ,Math.abs(cab.z-p[2]));}
   return {partial,reappeared:!cab.leaving&&!cab.landed,maxXY,maxZ};
  })()`);
  // Real pointer/keyboard input, through actual canvas/roster handlers.
  await call('Input.dispatchMouseEvent',{type:'mouseWheel',x:1450,y:800,deltaX:0,deltaY:-120});results.wheelZoom=await ev('manual&&cam.z>2.5');
  const row=await ev(`(()=>{const b=document.querySelector('#roster [data-i="0"]').getBoundingClientRect();return {x:b.x+20,y:b.y+b.height/2}})()`);
  await call('Input.dispatchMouseEvent',{type:'mousePressed',...row,button:'left',clickCount:1});await call('Input.dispatchMouseEvent',{type:'mouseReleased',...row,button:'left',clickCount:1});results.rosterPin=await ev('pinned===owner');
  await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});results.escape=await ev('!pinned&&!manual');
 }
}
// Identical second navigation: compare the static passes, excluding live labels/cab shadows on the main canvas.
await load(afterPort,'&map=1');await ev('renderRoster();for(let i=1;i<=40;i++)__step(i*25);');
results.deterministicSecond=await ev('Object.fromEntries([...layerCity.cache].map(([name,c])=>[name,hash(c.canvas.toDataURL())]))');
results.deterministic=JSON.stringify(results.deterministicFirst)===JSON.stringify(results.deterministicSecond);
// Real journal SSE through an isolated fixture only.
const fixture=process.env.VIZ_MAP_FIXTURE||'/tmp/viz-map-11/fixture-home';
const stage=path.join(fixture,'fixture-1','coordinator','work');
const journal=fs.readdirSync(stage).filter(n=>/^journal-.*\.md$/.test(n)).sort().at(-1);
const now=new Date(),hm=new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Moscow'}).format(now);
fs.appendFileSync(path.join(stage,journal),`- ${hm} [plain] @hub map fixture live beam\n`);
await wait('beams.length>0');results.liveEvent=await ev('({beams:beams.length,lastLive,from:beams.at(-1).a.role,to:beams.at(-1).b.kind})');
await ev('__step(1250)');await shot('map-live-event');
fs.writeFileSync(path.join(output,'map-browser-checks.json'),JSON.stringify(results,null,2));
for(const key of ['labels','zoomLabels']){const state=results[key];state.hudOverlaps=state.reservations.filter(r=>state.panels.some(p=>r.left<p.right&&r.right>p.left&&r.top<p.bottom&&r.bottom>p.top)).length;if(state.hudOverlaps)throw Error('Label/HUD overlap '+key);}
console.log('browser',results);
if(!results.layersSmoke||!results.deterministic||!results.hits.every(h=>h.hit)||results.loadChange.zero!==0||results.loadChange.full!==100||JSON.stringify(results.loadChange.changedCaches.filter(k=>k.startsWith('windows:')))!==JSON.stringify(['windows:core'])||!results.lifecycle.partial||!results.lifecycle.reappeared||results.lifecycle.maxXY>.12||!results.wheelZoom||!results.rosterPin||!results.escape)throw Error('Map browser check failed');
await call('Page.removeScriptToEvaluateOnNewDocument',{identifier:init.identifier});
// Actual rAF timing (no virtual clock). Keep 30 fixture workers, six-second windows per scenario.
const fps=[];
for(const [query,label] of [['&map=1','map'],['&map=1&sprites=1','sprites']]){
 await call('Network.enable');await call('Network.setCacheDisabled',{cacheDisabled:true});
 await load(afterPort,query);await delay(1800);
 const resources=await ev(`({loadMs:layerCity.loadMs,data:performance.getEntriesByType('resource').filter(r=>r.name.includes('/assets/map/')||r.name.includes('core-sky-')).map(r=>({file:r.name.split('/').pop(),bytes:r.decodedBodySize,transferred:r.transferSize,ms:r.duration}))})`);
 results[label+'Resources']=resources;
 for(const scenario of ['stationary','pan','zoom4']){
  await ev(`manual=true;cam.x=cam.tx=BASE.x;cam.y=cam.ty=BASE.y;cam.z=cam.tz=${scenario==='zoom4'?4:1};`);await delay(700);
  const stats=await ev(`new Promise(resolve=>{let times=[],prev=performance.now(),start=prev;function tick(t){times.push(t-prev);prev=t;${scenario==='pan'?'cam.x+=.025;':''}if(t-start<6000)requestAnimationFrame(tick);else{times.sort((a,b)=>a-b);resolve({fps:times.length*1000/(t-start),p95ms:times[Math.floor(times.length*.95)],frames:times.length,cabs:cabs.size})}}requestAnimationFrame(tick)})`);
  fps.push({label,scenario,...stats});console.log('fps',fps.at(-1));
 }
 const timing=await ev(`(()=>{const original=layerCity.sources.get(SOURCES[0]),stage=original.stages.find(s=>districtFor(s.repo)==='core');layerCity.timings.length=0;layerCity.applyState(SOURCES[0],{...original,stages:original.stages.map(s=>s===stage?{...s,workers:[]}:s)});const t=performance.now();layerCity.drawStatic();const ms=performance.now()-t;return {totalMs:ms,caches:layerCity.timings};})()`);
 results[label+'Rebuild']=timing;console.log('rebuild',label,timing);
 const overscan=await ev(`(()=>{manual=true;cam.x+=2;layerCity.applyState(SOURCES[0],layerCity.sources.get(SOURCES[0]));layerCity.cache.delete('scene');layerCity.drawStatic();const reused=hash(layerCity.cache.get('scene').canvas.toDataURL());layerCity.cache.clear();layerCity.drawStatic();const fresh=hash(layerCity.cache.get('scene').canvas.toDataURL());return {reused,fresh,equal:reused===fresh};})()`);
 results[label+'Overscan']=overscan;if(!overscan.equal)throw Error('Composite overscan mismatch');
}
fs.writeFileSync(path.join(output,'map-fps.json'),JSON.stringify(fps,null,2));
fs.writeFileSync(path.join(output,'map-browser-checks.json'),JSON.stringify(results,null,2));
fs.writeFileSync(path.join(output,'map-errors.json'),JSON.stringify(errors,null,2));
ws.close();if(errors.length)throw Error('Browser errors '+errors.length);
