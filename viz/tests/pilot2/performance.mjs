// Real-rAF performance, including panning across the overscan rebuild boundary.
import fs from 'node:fs';import {browser,sleep} from './browser.mjs';
const out='./work/shots/pilot2-performance.json';
await browser(async({call,ev,wait,errors})=>{
 await call('Page.navigate',{url:'http://127.0.0.1:8813/?map=1&kit=1&lang=ru&follow=0'});await wait('typeof cabs!=="undefined"&&cabs.size===30&&!!layerCity?.kit');await ev('Promise.all([ready,document.fonts.ready])');await sleep(1500);
 const fps=[];for(const mode of ['stationary','pan','zoom4']){
  await ev(`manual=true;cam.x=cam.tx=BASE.x;cam.y=cam.ty=BASE.y;cam.z=cam.tz=${mode==='zoom4'?4:1};`);await sleep(700);
  fps.push(await ev(`new Promise(resolve=>{const times=[],start=performance.now(),before=layerCity.rebuilds.scene;let last=start;function tick(t){times.push(t-last);last=t;${mode==='pan'?'cam.x=cam.tx=BASE.x+Math.sin((t-start)/1000)*45;':''}if(t-start<6000)requestAnimationFrame(tick);else{const sorted=times.slice().sort((a,b)=>a-b);resolve({mode:'${mode}',frames:times.length,ms:t-start,fps:times.length*1000/(t-start),p95:sorted[Math.floor(sorted.length*.95)],maxFrameMs:Math.max(...times),over100ms:times.filter(t=>t>100).length,sceneRebuilds:layerCity.rebuilds.scene-before});}}requestAnimationFrame(tick);})`));
 }
 const result={workerCount:await ev('cabs.size'),panAmplitudeWorld:45,panAmplitudePixels:await ev('45*K'),fps,errors};fs.writeFileSync(out,JSON.stringify(result,null,2));if(errors.length)throw Error(JSON.stringify(errors));console.log(JSON.stringify(result));
});
