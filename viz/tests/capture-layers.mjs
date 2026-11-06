// Isolated CDP evidence runner. Start your own Chrome and fixture servers; this never starts/stops processes.
// node viz/tests/capture-layers.mjs CDP_PORT BEFORE_PORT AFTER_PORT OUTPUT_DIRECTORY
import fs from 'node:fs';
import path from 'node:path';
const [cdpPort='9878', beforePort='8868', afterPort='8768', output='/tmp/viz-layers-8/shots'] = process.argv.slice(2);
fs.mkdirSync(output,{recursive:true});
const tabs=await (await fetch(`http://127.0.0.1:${cdpPort}/json`)).json();
const tab=tabs.find(t=>t.type==='page');
const ws=new WebSocket(tab.webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
let id=0;const pending=new Map(),errors=[];
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);};
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
const load=async(port,query)=>{await call('Page.navigate',{url:`http://127.0.0.1:${port}/?lang=ru&follow=0${query}`});await wait('typeof cabs!=="undefined" && cabs.size===30');await ev('Promise.all([ready,document.fonts.ready])');};
for(const [port,query,name] of [[beforePort,'','layers-reference'],[afterPort,'','layers-before'],[afterPort,'&layers=0','layers-disabled'],[afterPort,'&layers=1','layers-overview']]){
 await load(port,query);
 await ev('for(let i=1;i<=40;i++) __step(i*25);renderRoster();');
 await shot(name);
 if(query==='&layers=1'){
  const model=await ev(`({loaded:!!layerCity,cabs:cabs.size,hubs:towers.size,lots:G.lots.length,kept:G.lots.filter(l=>layerCity.edge(l).keep).length,core:G.lots.filter(l=>l.d==='core').length,loads:Object.fromEntries(layerCity.loads),cache:layerCity.rebuilds,images:layerCity.images.size,states:[...new Set(G.lots.filter(l=>l.d==='core').map(l=>layerCity.stateFor(l)))],routes:[...cabs.values()].every(c=>c.layerRoute?.length>1)})`);
  fs.writeFileSync(path.join(output,'layers-model.json'),JSON.stringify(model,null,2));console.log('model',model);
  await ev('manual=true;cam.x=cam.tx=DIST.core.x-DIST.core.y;cam.y=cam.ty=(DIST.core.x+DIST.core.y)/2-3;cam.z=cam.tz=3;__step(1025);');await shot('layers-core-zoom');
  await ev('cam.x=cam.tx=46-115;cam.y=cam.ty=(46+115)/2;cam.z=cam.tz=2.4;__step(1050);');await shot('layers-edge');
  await ev('manual=false;cam.x=cam.tx=BASE.x;cam.y=cam.ty=BASE.y;cam.z=cam.tz=1;__step(1075);');
  // Functional browser assertions use the actual manifest and live model.
  const checks=await ev(`(()=>{
    const original=layerCity.sources.get(SOURCES[0]);
    const stage=original.stages.find(s=>districtFor(s.repo)==='core');
    const alter=n=>({...original,stages:original.stages.map(s=>s===stage?{...s,workers:Array.from({length:n},(_,i)=>({role:'test-'+i}))}:s)});
    layerCity.applyState(SOURCES[0],alter(0));const zero=layerCity.loads.get('core').level;
    layerCity.applyState(SOURCES[0],alter(10));const full=layerCity.loads.get('core').level;
    layerCity.applyState(SOURCES[0],original);
    const key=owner,item=layerCity.keySprite(key),p=layerCity.placement(G.owner,item);
    const hit=hitTest(p.x+p.w/2,p.y+p.h/2)===owner;
    const cache=layerCity.rebuilds.buildings;__step(1100);const built=layerCity.rebuilds.buildings;__step(1125);
    return {zero,full,ownerHit:hit,cacheStable:layerCity.rebuilds.buildings===built,rebuildOnStateChange:built>cache};
  })()`);
  const lifecycle=await ev(`(()=>{
    const original=layerCity.sources.get(SOURCES[0]),cab=[...cabs.values()][0];
    const missing={...original,stages:original.stages.map(s=>s.name===cab.stage?{...s,workers:s.workers.filter(w=>w.role!==cab.role)}:s)};
    applyState(SOURCES[0],missing);let time=1125,maxStep=0;
    for(let i=0;i<10;i++)__step(time+=25);
    const partiallyReturning=!!cab.layerReturn&&!cab.landed;
    const edges=G.nodes.flatMap(n=>n.adj.filter(e=>e.to.id>n.id).map(e=>[n,e.to,e.len]));
    const on=(p,a,b,len)=>Math.abs(Math.hypot(p.x-a.x,p.y-a.y)+Math.hypot(p.x-b.x,p.y-b.y)-len)<1e-6;
    const back=cab.layerReturn,points=back.layerRoute;
    const connectedReturn=points.slice(1,-1).every((p,i)=>edges.some(([a,b,len])=>on(points[i],a,b,len)&&on(p,a,b,len)));
    applyState(SOURCES[0],original);
    for(let i=0;i<70;i++){const x=cab.x,y=cab.y;__step(time+=25);maxStep=Math.max(maxStep,Math.hypot(cab.x-x,cab.y-y));}
    const a=cab.layerRoute[0],b=cab.layerRoute[1];
    const probe={key:'altitude-probe',home:cab.home,x:a.x+(b.x-a.x)*.8,y:a.y+(b.y-a.y)*.8,z:10,alt:10,
      layerRoute:[a,b,a],layerSegment:0,layerT:.8,leaving:true};
    for(let i=0;i<300&&!probe.landed;i++){layerCity.fly(probe,0,.025);if(probe.layerReturn.layerSegment>=probe.layerReturn.accessIndex)break;}
    const onConnector=!!probe.layerReturn&&!probe.landed;probe.leaving=false;let maxAltitudeStep=0;
    for(let i=0;i<160;i++){const z=probe.z;layerCity.fly(probe,0,.025);maxAltitudeStep=Math.max(maxAltitudeStep,Math.abs(probe.z-z));}
    return {partiallyReturning,connectedReturn,reappeared:!cab.leaving&&!cab.landed,maxStep,bounded:maxStep<=.105,
      onConnector,maxAltitudeStep,altitudeBounded:maxAltitudeStep<=.08000001};
  })()`);
  await call('Input.dispatchMouseEvent',{type:'mouseWheel',x:1450,y:800,deltaX:0,deltaY:-200});
  checks.wheelZoom=await ev('manual&&cam.z>1');
  const row=await ev(`(()=>{const b=document.querySelector('#roster [data-i="0"]').getBoundingClientRect();return {x:b.x+20,y:b.y+b.height/2}})()`);
  await call('Input.dispatchMouseEvent',{type:'mousePressed',...row,button:'left',clickCount:1});
  await call('Input.dispatchMouseEvent',{type:'mouseReleased',...row,button:'left',clickCount:1});
  checks.rosterPin=await ev('pinned===owner');
  await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  checks.escapeOverview=await ev('!pinned&&!manual');checks.lifecycle=lifecycle;
  fs.writeFileSync(path.join(output,'layers-browser-checks.json'),JSON.stringify(checks,null,2));console.log('checks',checks);
  if(!checks.wheelZoom||!checks.rosterPin||!checks.escapeOverview||!lifecycle.partiallyReturning||!lifecycle.connectedReturn||!lifecycle.reappeared||!lifecycle.bounded||!lifecycle.onConnector||!lifecycle.altitudeBounded)throw Error('Interaction/lifecycle check failed');
  if(checks.zero!==0||checks.full!==100||!checks.ownerHit||!checks.cacheStable)throw Error('Browser checks failed');
 }
}
await call('Page.removeScriptToEvaluateOnNewDocument',{identifier:init.identifier});
// Actual rAF timings with 30 live fixture workers, fresh navigation per variant.
const fps=[];
for(const [port,query,label] of [[beforePort,'','before'],[afterPort,'','off'],[afterPort,'&layers=1','layers']]){
 await load(port,query);await delay(1800);
 for(const moving of [false,true]){
  const stats=await ev(`new Promise(resolve=>{manual=true;let times=[],prev=performance.now(),start=prev;function tick(t){times.push(t-prev);prev=t;${moving?'cam.x+=.008;':''}if(t-start<6000)requestAnimationFrame(tick);else{times.sort((a,b)=>a-b);resolve({fps:times.length*1000/(t-start),p95ms:times[Math.floor(times.length*.95)],frames:times.length,cabs:cabs.size})}}requestAnimationFrame(tick)})`);
  fps.push({label,moving,...stats});console.log('fps',fps.at(-1));
 }
}
fs.writeFileSync(path.join(output,'layers-fps.json'),JSON.stringify(fps,null,2));
fs.writeFileSync(path.join(output,'layers-errors.json'),JSON.stringify(errors,null,2));
ws.close();if(errors.length)throw Error('Browser runtime exceptions: '+errors.length);
