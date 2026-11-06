import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {browser,root,sleep} from './browser.mjs';
const output='./work/shots';fs.mkdirSync(output,{recursive:true});
const result={};
await browser(async({call,ev,wait,errors})=>{
 const virtual=await call('Page.addScriptToEvaluateOnNewDocument',{source:`let seed=20771;Math.random=()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};let clock=0,sequence=0;const raf=new Map();performance.now=()=>clock;window.requestAnimationFrame=cb=>{raf.set(++sequence,cb);return sequence;};window.cancelAnimationFrame=id=>raf.delete(id);window.__step=t=>{clock=t;const q=[...raf.values()];raf.clear();q.forEach(cb=>cb(t));};window.setInterval=()=>0;`});
 const load=async(query,port=8813)=>{await call('Page.navigate',{url:`http://127.0.0.1:${port}/?lang=ru&follow=0${query}`});await wait('typeof cabs!=="undefined"&&cabs.size===30');await ev('Promise.all([ready,document.fonts.ready])');await ev(`(()=>{const s=document.createElement('style');s.textContent='*,*::before,*::after{animation:none!important;transition:none!important}';document.head.appendChild(s);renderRoster();if(typeof __step==='function')for(let i=1;i<=160;i++)__step(i*25);})()`);};
 const shot=async name=>fs.writeFileSync(path.join(output,name+'.png'),Buffer.from((await call('Page.captureScreenshot',{captureBeyondViewport:false})).data,'base64'));
 const labels=()=>ev(`(()=>{const panels=['#hud .brand','#sub','#tr','#roster','#ticker','#rtoggle'].map(s=>document.querySelector(s)).filter(e=>e&&e.getClientRects().length).map(e=>{const r=e.getBoundingClientRect();return {left:r.left-6,right:r.right+6,top:r.top-6,bottom:r.bottom+6}});return {labels:layerCity.labelReservations,panels,overlaps:layerCity.labelReservations.filter(r=>panels.some(p=>r.left<p.right&&r.right>p.left&&r.top<p.bottom&&r.bottom>p.top))};})()`);
 for(const [port,query,name]of [[8814,'','pilot2-parity-before'],[8813,'','pilot2-parity-after'],[8813,'&kit=1','pilot2-parity-kit-without-map'],[8813,'&map=1','pilot2-boxes'],[8813,'&map=1&kit=1','pilot2-overview']]){
  await load(query,port);await shot(name);
  if(name==='pilot2-boxes'){result.boxesCamera=await ev('({...cam,K})');result.boxesLabels=await labels();}
  if(name==='pilot2-overview'){
   result.model=await ev('({counts:counts(),ordered:layerCity.ordered.length,removed:layerCity.reservation,notables:layerCity.ordered.filter(b=>b.notable).map(b=>({model:b.landmark.model,d:b.d})),cacheBytes:layerCity.kit.bytes,cacheEntries:layerCity.kit.cache.size,camera:{...cam,K}})');result.overviewLabels=await labels();
   result.cacheHashes=await ev('Object.fromEntries([...layerCity.cache].map(([k,v])=>[k,hash(v.canvas.toDataURL())]))');
   await ev(fs.readFileSync(path.join(root,'viz/tests/pilot2/sheets.js'),'utf8'));const sheets=await ev('pilotSheets()');for(const [name,data]of Object.entries(sheets))fs.writeFileSync(path.join(output,name),Buffer.from(data.split(',')[1],'base64'));
   await ev(`manual=true;cam.x=cam.tx=CX-CY+(layerCity.data.core[0]-layerCity.data.core[1])/12;cam.y=cam.ty=(CX+CY)/2+(layerCity.data.core[0]+layerCity.data.core[1])/24-12;cam.z=cam.tz=2.2;__step(4025);`);await shot('pilot2-core-zoom');result.coreLabels=await labels();
   await ev(`(()=>{const b=layerCity.ordered.find(b=>b.landmark?.model==='dome');cam.x=cam.tx=b.x-b.y;cam.y=cam.ty=(b.x+b.y)/2-3;cam.z=cam.tz=3;__step(4050);})()`);await shot('pilot2-district-zoom');result.districtLabels=await labels();
  }
 }
 await load('&map=1&sprites=1&kit=1');result.spriteCompatibility=await ev('({sprites:layerCity.spriteCount,kit:!!layerCity.kit})');assert.equal(result.spriteCompatibility.sprites,121);assert.equal(result.spriteCompatibility.kit,false);
 // Cache pixel determinism on an independent navigation and the identical input/frame.
 await load('&map=1&kit=1');result.repeatHashes=await ev('Object.fromEntries([...layerCity.cache].map(([k,v])=>[k,hash(v.canvas.toDataURL())]))');assert.deepEqual(result.repeatHashes,result.cacheHashes);
 // Old validator's false negative reproduced: roster DOM grew after the measured frame.
 result.labelControl=await ev(`(()=>{const before=roster.innerHTML;roster.innerHTML='';__step(4025);const stale=layerCity.labelReservations;roster.innerHTML=before;const panel=roster.getBoundingClientRect();const staleHits=stale.filter(r=>r.left<panel.right&&r.right>panel.left&&r.top<panel.bottom&&r.bottom>panel.top).length;__step(4050);return {staleHits,settled:layerCity.labelReservations};})()`);
 // Recovery from an injected one-shot static-cache failure; map loop remains scheduled.
 result.staticFailure=await ev(`(()=>{const draw=layerCity.drawStatic.bind(layerCity);let failed=false;layerCity.drawStatic=()=>{layerCity.drawStatic=draw;failed=true;throw Error('pilot2 expected static fault');};__step(4075);__step(4100);return {failed,pending:raf.size,scene:!!layerCity.cache.get('scene')};})()`);
 const expectedFault=errors.filter(e=>JSON.stringify(e).includes('pilot2 expected static fault'));errors.splice(0,errors.length,...errors.filter(e=>!JSON.stringify(e).includes('pilot2 expected static fault')));result.staticFailure.expectedFaults=expectedFault.length;
 const hidden=await call('Page.addScriptToEvaluateOnNewDocument',{source:`Object.defineProperty(window,'innerWidth',{configurable:true,value:0});Object.defineProperty(window,'innerHeight',{configurable:true,value:0});`});
 await call('Page.navigate',{url:'http://127.0.0.1:8813/?map=1&kit=1&lang=ru&follow=0'});await wait('typeof layerCity!=="undefined"&&!!layerCity');await ev('ready');
 result.hiddenBefore=await ev('(()=>{for(let i=1;i<5;i++)__step(i*25);return {W,H,pending:raf.size,cache:layerCity.cache.size}})()');
 await ev(`Object.defineProperty(window,'innerWidth',{configurable:true,value:1600});Object.defineProperty(window,'innerHeight',{configurable:true,value:1000});dispatchEvent(new Event('resize'));renderRoster();for(let i=5;i<130;i++)__step(i*25);`);
 result.hiddenAfter=await ev('({W,H,pending:raf.size,scene:!!layerCity.cache.get("scene"),K})');await shot('pilot2-hidden-recovered');await call('Page.removeScriptToEvaluateOnNewDocument',{identifier:hidden.identifier});
 await call('Page.removeScriptToEvaluateOnNewDocument',{identifier:virtual.identifier});
 if(process.env.PILOT_FAST!=='1'){
  await load('&map=1&kit=1');await sleep(1000);
  result.startup=await ev('({loadMs:layerCity.loadMs,assemblyMs:layerCity.kitAssemblyMs,timings:layerCity.timings,kitBytes:layerCity.kit.bytes,moduleBytes:[...layerCity.kit.tiles.values()].reduce((a,t)=>a+t.base.width*t.base.height*12,0)+[...(layerCity.kit.styleTiles?.values()||[])].reduce((a,t)=>a+t.base.width*t.base.height*8,0),sceneCacheBytes:[...layerCity.cache.values()].reduce((a,t)=>a+t.canvas.width*t.canvas.height*4,0),atlasBytes:layerCity.kit.baseAtlas.width*layerCity.kit.baseAtlas.height*8+layerCity.kit.styleBaseAtlas.width*layerCity.kit.styleBaseAtlas.height*8,geometryBytes:layerCity.ordered.reduce((a,b)=>a+(b.pilotBase?b.pilotBase.width*b.pilotBase.height*4:0),0),notableBytes:Object.values(layerCity.notable.models).reduce((a,m)=>a+m.size[0]*m.size[1]*4*6,0)})');
  result.fps=[];for(const mode of ['stationary','pan','zoom4']){
   await ev(`manual=true;cam.x=cam.tx=BASE.x;cam.y=cam.ty=BASE.y;cam.z=cam.tz=${mode==='zoom4'?4:1};`);await sleep(500);
   result.fps.push(await ev(`new Promise(resolve=>{const times=[],start=performance.now();let last=start;function tick(t){times.push(t-last);last=t;${mode==='pan'?'cam.x=cam.tx=BASE.x+Math.sin((t-start)/900)*10;':''}if(t-start<4000)requestAnimationFrame(tick);else{const sorted=times.slice().sort((a,b)=>a-b);resolve({mode:'${mode}',frames:times.length,ms:t-start,fps:times.length*1000/(t-start),p95:sorted[Math.floor(sorted.length*.95)],maxFrameMs:Math.max(...times),over100ms:times.filter(t=>t>100).length});}}requestAnimationFrame(tick);})`));
  }
  result.stateRebuild=await ev(`(()=>{cam.x=cam.tx=BASE.x;cam.y=cam.ty=BASE.y;cam.z=cam.tz=1;layerCity.cache.clear();layerCity.drawStatic();const before={...layerCity.rebuilds},old=layerCity.loads.get('core');layerCity.loads.set('core',{...old,level:100});layerCity.districtRevision.set('core',layerCity.districtRevision.get('core')+1);const t=performance.now();layerCity.drawStatic();const ms=performance.now()-t;return {ms,before,after:layerCity.rebuilds};})()`);
 }
 if(result.stateRebuild){const r=result.stateRebuild;assert.deepEqual(Object.keys(r.after).filter(k=>r.after[k]!==r.before[k]).sort(),['scene','windows:core']);}
 result.errors=errors;fs.writeFileSync(path.join(output,'pilot2-browser.json'),JSON.stringify(result,null,2));
 assert.equal(errors.length,0);assert.ok(result.model.counts.busy>0);for(const k of ['boxesLabels','overviewLabels','coreLabels','districtLabels'])assert.equal(result[k].overlaps.length,0,k);
 assert.equal(result.hiddenBefore.cache,0);assert.ok(result.hiddenAfter.scene&&result.hiddenAfter.pending===1);assert.ok(result.staticFailure.failed&&result.staticFailure.pending===1);
 console.log(JSON.stringify({counts:result.model.counts,removed:result.model.removed.removed.length,cacheBytes:result.model.cacheBytes,hidden:result.hiddenAfter,fps:result.fps,errors:errors.length}));
});
