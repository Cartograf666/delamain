// Normal entry, actual WebGL renderer; only owned assets are overlaid before hub integration.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const origin=process.env.CAPTURE_ORIGIN||'http://127.0.0.1:8792',out=process.env.CAPTURE_PROOF||'./work/border-response-proof';
fs.mkdirSync(out,{recursive:true});const report={origin,overlay:!process.env.CAPTURE_MERGED,errors:[],checks:[]};
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--use-angle=metal']});try{
 const context=await browser.newContext({viewport:{width:1600,height:1000},deviceScaleFactor:1});const p=await context.newPage();p.on('pageerror',e=>report.errors.push(String(e)));
 if(!process.env.CAPTURE_MERGED)for(const file of ['runtime.js','main.js','capture-response.js','capture-router-worker.js','painter.js'])await p.route('**/assets/gl/'+file,r=>r.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(__dirname,'../../assets/gl',file),'utf8')}));
 const load=async demo=>{await p.goto(origin+'/?map=1&live=1&lang=ru&follow=0'+(demo?'&demo=capture':''));await p.waitForFunction(()=>typeof layerCity!=='undefined'&&layerCity?.live?.aq?.response&&layerCity.live.metrics.frames>5);};
 const enable=async()=>{const b=p.locator('[data-mode="territories"]');if(await b.count())await b.click();if(!process.env.CAPTURE_MERGED)await p.evaluate(()=>{layerCity.live.districtsVisible=true;});};
 await load(false);assert.equal(await p.evaluate(()=>layerCity.live.aq.response.events.length),0);await p.screenshot({path:out+'/01-normal.png'});
 await enable();await p.waitForTimeout(400);assert.equal(await p.evaluate(()=>layerCity.live.aq.response.events.length),0);report.checks.push('Normal quiet day, activity and districts, no incident');
 await load(true);await enable();await p.waitForFunction(()=>layerCity.live.aq.response.events.length===3&&layerCity.live.aq.response.events.every(e=>e.route));const start=Date.now();
 report.initial=await p.evaluate(()=>({stats:layerCity.live.aq.response.stats,events:layerCity.live.aq.response.events.map(e=>({plotId:e.capture.plotId,building:e.building.id,route:e.route,group:{key:e.group.key,count:e.group.plotIds.size}})),cars:layerCity.live.aq.cars.length,view:layerCity.live.cameraView(),renderer:layerCity.live.gpu.stats.renderer}));
 await p.evaluate(()=>layerCity.live.gpu.startRecording());
 report.samples=[];
 for(const [label,ms]of [['02-ignition',700],['03-approach',3200],['04-convoy',5600],['05-arrived',10200],['06-extinguish',15800]]){
  await p.waitForTimeout(Math.max(0,ms-(Date.now()-start)));await p.screenshot({path:out+'/'+label+'.png'});
  report.samples.push(await p.evaluate(()=>({now:performance.now(),events:layerCity.live.aq.response.events.map(e=>({age:performance.now()-e.born,plotId:e.capture.plotId,vehicles:e.vehicles.map(v=>({p:v.p,arrived:v.arrived,wallStrips:v.walls?.length||0}))})),waterVertices:layerCity.live.gpu.responseWaterCount,vertices:layerCity.live.gpu.painter.vertices})));
 }
 report.performance=await p.evaluate(()=>layerCity.live.gpu.stopRecording());assert(report.samples[3].events.every(e=>e.vehicles.every(v=>v.arrived)));assert(report.samples.some(s=>s.events.some(e=>e.vehicles.some(v=>v.wallStrips>0))));
 await p.waitForTimeout(4000);assert.equal(await p.evaluate(()=>layerCity.live.aq.response.events.length),0);assert.equal(await p.evaluate(()=>layerCity.live.aq.cars.length),230);report.checks.push('Actual three-lot demo, connected approach, arrival, expiry, ambient car population unchanged');
 // Positive automatic path uses an explicitly synthetic current-day envelope only in this test context.
 const archive=(await import('../../assets/gl/capture-response.js')).CAPTURE_DEMO,current=await fetch(origin+'/city').then(r=>r.json());
 await p.route(url=>url.pathname==='/city',r=>r.fulfill({json:{...current,aggressiveCaptures:archive.aggressiveCaptures}}));
 await load(false);await enable();await p.waitForFunction(()=>layerCity.live.aq.response.events.length===3&&layerCity.live.aq.response.events.every(e=>e.route));assert.equal(await p.evaluate(()=>cam.z),1,'Real events must not frame camera');
 report.automaticFixture={date:current.date,sourceDate:archive.date,ids:archive.aggressiveCaptures.map(c=>c.plotId)};
 await p.reload();await p.waitForFunction(()=>typeof layerCity!=='undefined'&&layerCity?.live?.aq?.response&&layerCity.live.metrics.frames>5);await enable();await p.waitForTimeout(250);assert.equal(await p.evaluate(()=>layerCity.live.aq.response.events.length),0);report.checks.push('Synthetic current-day envelope: actual capture IDs launch once, real camera unchanged, reload receipt suppresses replay');
 await p.emulateMedia({reducedMotion:'reduce'});await load(true);await enable();await p.waitForFunction(()=>layerCity.live.aq.response.events.length===3&&layerCity.live.aq.response.events.every(e=>e.route&&e.vehicles.length===3));
 await p.waitForTimeout(1600);const positions=await p.evaluate(()=>layerCity.live.aq.response.events.map(e=>e.vehicles.map(v=>v.p)));await p.waitForTimeout(700);assert.deepEqual(await p.evaluate(()=>layerCity.live.aq.response.events.map(e=>e.vehicles.map(v=>v.p))),positions);await p.screenshot({path:out+'/10-reduced-motion.png'});report.checks.push('Reduced-motion browser: roadside positions remain stationary, demo does not consume automatic receipts');
 report.glError=await p.evaluate(()=>document.getElementById('gpu-city').getContext('webgl2').getError());assert.equal(report.glError,0);assert.equal(report.errors.length,0);
 fs.writeFileSync(out+'/browser.json',JSON.stringify(report,null,2));console.log(JSON.stringify({checks:report.checks,errors:report.errors,samples:report.samples},null,2));
 }finally{await browser.close();fs.writeFileSync(out+'/browser.json',JSON.stringify(report,null,2));}})().catch(e=>{console.error(e);process.exitCode=1});
