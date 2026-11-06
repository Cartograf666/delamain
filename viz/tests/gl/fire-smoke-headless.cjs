// Background-only visual evidence: never attaches to or opens the user's browser.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const origin=process.env.CAPTURE_ORIGIN||'http://127.0.0.1:8792',assets=process.env.ASSETS_DIR;
const out=process.env.FIRE_SMOKE_PROOF||'./work/road-smoke-proof';
fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--use-angle=metal']});
 const report={origin,headless:true,errors:[],samples:[]};
 try{const p=await browser.newPage({viewport:{width:Number(process.env.PROOF_WIDTH)||1600,height:Number(process.env.PROOF_HEIGHT)||1000},deviceScaleFactor:1});p.on('pageerror',e=>report.errors.push(String(e)));
 for(const file of ['capture-response.js','painter.js','runtime.js'])await p.route('**/assets/gl/'+file,r=>r.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(assets||path.join(__dirname,'../../assets/gl'),file),'utf8')}));
 for(const reduced of [false,true]){
  await p.emulateMedia({reducedMotion:reduced?'reduce':'no-preference'});
  await p.goto(origin+'/?map=1&live=1&lang=ru&follow=0&demo=capture');
  await p.waitForFunction(()=>typeof layerCity!=='undefined'&&layerCity?.live?.aq?.response);
  await p.locator('[data-mode="territories"]').click();
  await p.waitForFunction(()=>layerCity.live.aq.response.events.length===3&&layerCity.live.aq.response.events.every(e=>e.route));
  await p.waitForTimeout(800);
  await p.evaluate(()=>{const l=layerCity.live,r=l.aq.response;window.__fireTime=5000;r.events.forEach(e=>e.born=0);l.step=()=>{l.now=window.__fireTime;};l.aq.update=()=>{};const draw=l.aq.draw;l.aq.draw=()=>draw(window.__fireTime);window.__incidentCalls=[];const smoke=l.gpu.painter.smoke;l.gpu.painter.smoke=function(...args){window.__incidentCalls.push({depth:this.depth,args});return smoke.apply(this,args);};});
  const times=reduced?[5000,7199,7200,7201,10500,15800]:[5000,5599,5600,5601,7400,10500,15800];
  for(const time of times){
   const sample=await p.evaluate(async({time,reduced})=>{const l=layerCity.live,r=l.aq.response;window.__fireTime=time;r.update(time);window.__incidentCalls=[];await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const {responseBeacon}=await import('/assets/gl/capture-response.js');return {time,reduced,cam:{...cam},view:l.cameraView(),viewport:[W,H],plumeBounds:r.smokeSites.map(s=>{const v=l.cameraView(),k=Math.max(W/1800,H/780)*cam.z;return [(s.p[0]-s.severity.width/2-v.x)*k,(s.p[1]-s.severity.height-v.y)*k,(s.p[0]+s.severity.width/2-v.x)*k,(s.p[1]-v.y)*k];}),events:r.events.map(e=>({plotId:e.capture.plotId,group:{key:e.group.key,count:e.group.plotIds.size},vehicles:e.vehicles.map(v=>({p:v.p,arrived:v.arrived,beacon:responseBeacon(time,v.index,reduced),receivers:v.walls?.length||0}))})),smokeSites:r.smokeSites.map(s=>({p:s.p,s:s.s,roadId:s.roadId,plotId:s.event.capture.plotId,severity:s.severity})),incidentCalls:window.__incidentCalls.slice(-3),fire:r.fireStats,vertices:l.gpu.painter.vertices,water:l.gpu.responseWaterCount,glError:document.getElementById('gpu-city').getContext('webgl2').getError()};},{time,reduced});
   assert.equal(sample.glError,0);assert(sample.plumeBounds.every(b=>b[0]>=0&&b[1]>=0&&b[2]<=sample.viewport[0]&&b[3]<=sample.viewport[1]),'Native demo framing contains complete plumes');assert.equal(sample.events.length,3);assert.equal(sample.incidentCalls.length,3);assert(sample.incidentCalls.every(c=>c.depth<.92&&c.args.at(-1)===1),'Facade plumes, warm base');assert(sample.fire.plots===3&&sample.fire.spots>=9&&sample.fire.receivers>0,'Three burning buildings, three hot spots each, lit neighbours');assert(reduced?sample.fire.embers===0:sample.fire.embers>0&&sample.fire.embers<=150);assert.equal(sample.smokeSites.length,3);assert.equal(new Set(sample.smokeSites.map(s=>s.p.join(','))).size,3);assert(sample.events.every(e=>e.group.count===3));
   sample.image=`${reduced?'reduced':'normal'}-${time}.png`;await p.screenshot({path:path.join(out,sample.image)});report.samples.push(sample);
  }
  const last=report.samples.at(-1);assert(last.events.every(e=>e.vehicles.every(v=>v.arrived)));assert(last.events.some(e=>e.vehicles.some(v=>v.receivers>0)));
  await p.evaluate(()=>{window.__fireTime=19001;layerCity.live.aq.response.update(19001);});assert.equal(await p.evaluate(()=>layerCity.live.aq.response.events.length),0);
 }
 assert.equal(report.errors.length,0);fs.writeFileSync(path.join(out,'samples.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({samples:report.samples.length,errors:report.errors,zoom:report.samples[0].cam.z,vertices:report.samples[0].vertices,headless:true}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
