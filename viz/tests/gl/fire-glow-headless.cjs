// Background-only evidence for capture fires on the live page (panel=1): small / medium / large from the test stand,
// at the page's demo framing and at the overview zoom, normal and reduced motion, at frozen time samples.
// True headless Chrome; never opens or attaches to the user's browser.
// Run: CAPTURE_ORIGIN=http://127.0.0.1:8841 FIRE_PROOF=<dir> [ASSETS_DIR=viz/assets/gl] node viz/tests/gl/fire-glow-headless.cjs
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const origin=process.env.CAPTURE_ORIGIN||'http://127.0.0.1:8841',out=process.env.FIRE_PROOF||'/tmp/fx-fire/shots',assets=process.env.ASSETS_DIR;
const sizes=(process.env.SIZES||'small,medium,large,buildings').split(','),times=(process.env.TIMES||'3000,3400,6200').split(',').map(Number);
fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--use-angle=metal']});
 const report={origin,assets:assets||null,headless:true,errors:[],shots:[]};
 try{for(const reduced of (process.env.MODES||'normal,reduced').split(',').map(m=>m==='reduced')){
  const p=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1});p.on('pageerror',e=>report.errors.push(String(e.stack||e).split('\n').slice(0,3).join(' | ')));
  await p.emulateMedia({reducedMotion:reduced?'reduce':'no-preference'});
  if(assets)await p.route('**/assets/gl/*.js',r=>{const file=path.join(assets,new URL(r.request().url()).pathname.split('/').pop());fs.existsSync(file)?r.fulfill({body:fs.readFileSync(file),contentType:'text/javascript'}):r.continue();});
  await p.goto(origin+'/?map=1&live=1&lang=ru&follow=0&panel=1');
  await p.waitForFunction(()=>typeof layerCity!=='undefined'&&layerCity?.live?.aq&&document.querySelector('#celebration-panel [data-district]'),null,{timeout:60000});
  await p.waitForTimeout(2500);
  for(const size of sizes){
   await p.click('#celebration-panel [data-district="reset"]');await p.waitForTimeout(300);
   await p.evaluate(()=>{const l=layerCity.live;if(window.__fire){l.step=window.__fire.step;l.aq.update=window.__fire.update;l.aq.draw=window.__fire.draw;}});
   // `buildings`: the built-in capture demo's three plots, which all carry buildings (the stand's plots may be vacant).
   if(size==='buildings'){await p.locator('[data-mode="territories"]').click();await p.evaluate(async()=>{const {CAPTURE_DEMO}=await import('/assets/gl/capture-response.js');layerCity.live.aq.response.play(CAPTURE_DEMO.aggressiveCaptures,'fire-proof|buildings');});}
   else await p.click(`#celebration-panel [data-district="capture-${size}"]`);
   await p.waitForFunction(()=>{const r=layerCity.live.aq.response;return r.events.length&&r.events.every(e=>e.route);},null,{timeout:15000});
   await p.waitForTimeout(1500); // the page frames the fire (demo zoom)
   // Freeze the simulation: every event born at 0, the page draws at window.__fireTime.
   await p.evaluate(()=>{const l=layerCity.live,r=l.aq.response;window.__fire??={step:l.step,update:l.aq.update,draw:l.aq.draw};r.events.forEach(e=>e.born=0);window.__fireTime=0;l.step=()=>{l.now=window.__fireTime;};l.aq.update=()=>{};const draw=window.__fire.draw;l.aq.draw=()=>draw(window.__fireTime);});
   for(const zoom of ['demo','overview']){
    if(zoom==='overview'){await p.evaluate(()=>cv.dispatchEvent(new MouseEvent('dblclick')));await p.waitForTimeout(1500);}
    for(const time of times){
     const info=await p.evaluate(async t=>{const l=layerCity.live,r=l.aq.response;window.__fireTime=t;for(let s=0;s<=t;s+=500)r.update(Math.min(s,t));r.update(t);await new Promise(f=>requestAnimationFrame(()=>requestAnimationFrame(f)));
      const v=l.cameraView(),S=l.gpu.scene,k=Math.max(innerWidth/S.w,innerHeight/S.h)*v.z,plots=[...new Set(r.events.flatMap(e=>[...e.group.plotIds]))].map(id=>l.gpu.growth.plots.get(id)?.ground).filter(Boolean);
      return {events:r.events.length,plots:plots.length,smoke:r.smokeSites.length,fire:r.fireStats||null,z:v.z,screen:plots.map(q=>[(q[0]-v.x)*k,(q[1]-v.y)*k]),vertices:l.gpu.painter.vertices,glError:document.getElementById('gpu-city').getContext('webgl2').getError()};},time);
     assert.equal(info.glError,0);
     const name=`${reduced?'reduced':'normal'}-${size}-${zoom}-${time}`;await p.evaluate(()=>{document.getElementById('celebration-panel').style.visibility='hidden';});await p.waitForTimeout(60);await p.screenshot({path:`${out}/${name}.png`});
     const xs=info.screen.map(q=>q[0]),ys=info.screen.map(q=>q[1]),cx=(Math.min(...xs)+Math.max(...xs))/2,cy=(Math.min(...ys)+Math.max(...ys))/2;
     const clip={x:Math.max(0,Math.min(1600-400,cx-200)),y:Math.max(0,Math.min(1000-260,cy-150)),width:400,height:260};
     if(zoom==='overview'&&isFinite(cx))await p.screenshot({path:`${out}/${name}-crop.png`,clip});
     await p.evaluate(()=>{document.getElementById('celebration-panel').style.visibility='';});
     report.shots.push({name,...info,screen:undefined,centre:[cx,cy]});
    }
   }
  }
  await p.close();
 }
 fs.writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({shots:report.shots.length,errors:report.errors,sample:report.shots.slice(0,3)}));
 assert.equal(report.errors.length,0);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
