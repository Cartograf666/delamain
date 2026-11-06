import fs from 'node:fs';import {browser,sleep} from './browser.mjs';
await browser(async({call,ev,wait,errors})=>{
 await call('Page.navigate',{url:'http://127.0.0.1:8914/viz/viz.html?map=1&live=1&lang=ru&follow=0&src=http://127.0.0.1:8814'});
 await wait('typeof layerCity!=="undefined"&&!!layerCity?.live?.prepareMs&&cabs.size===30');await ev('ready.then(()=>true)');await sleep(1500);
 const result={startup:await ev('({prepareMs:layerCity.live.prepareMs,loadMs:layerCity.loadMs,workers:cabs.size})'),runs:[]};
 for(const [mode,duration]of [['burst',60000],['pan',6000],['zoom4',6000]]){
  result.runs.push(await ev(`new Promise(resolve=>{const times=[],l=layerCity.live,start=performance.now();let last=start,n=0;manual=true;cam.x=cam.tx=BASE.x;cam.y=cam.ty=BASE.y;cam.z=cam.tz=${mode==='zoom4'?4:1};function tick(t){times.push(t-last);last=t;
    ${mode==='burst'?`while(n<60&&n*1000<=t-start){onLine(SOURCES[0],{stage:'fixture-4',repo:'raft-ceo-workspace',tag:n%2?'worker':'hub-1',from:['fixture-4',n%2?'worker':'hub'],to:[],text:'Synthetic burst '+n,at:new Date().toISOString()},false);n++;}`:''}
    ${mode==='pan'?'cam.x=cam.tx=BASE.x+Math.sin((t-start)/900)*85;':''}
    if(t-start<${duration})requestAnimationFrame(tick);else{const sorted=times.slice().sort((a,b)=>a-b);resolve({mode:'${mode}',events:n,fps:times.length*1000/(t-start),p95:sorted[Math.floor(sorted.length*.95)],maxMs:Math.max(...times),over100:times.filter(v=>v>100).length,heat:l.model.snapshot(),maxArcs:l.metrics.maxArcs,maxFlights:l.metrics.maxFlights,queued:l.queue.length});}}requestAnimationFrame(tick);})`));console.log(JSON.stringify(result.runs.at(-1)));
 }
 result.errors=errors;fs.writeFileSync('/tmp/viz-live-14/performance.json',JSON.stringify(result,null,2));if(errors.length)throw Error('Console errors');
});
