// Background-only evidence for the test stand's District group on the live page (panel=1): clicks each button, saves
// frames of fire and smoke for the three capture sizes, the growth wave, closure and the gold question flash, checks
// the work buttons, Reset all, focus and phone folding. True headless Chrome; never opens the user's browser.
// Run: CAPTURE_ORIGIN=http://127.0.0.1:8838 DEMO_PROOF=<dir> node viz/tests/gl/district-demo-headless.cjs
// ASSETS_DIR=viz/assets/gl serves the page's gl scripts from this checkout over a server built from an older commit.
const {chromium}=require('playwright');
const fs=require('node:fs');
const origin=process.env.CAPTURE_ORIGIN||'http://127.0.0.1:8838',out=process.env.DEMO_PROOF||'/tmp/demo-events-2/shots';
const link='/?map=1&live=1&lang=ru&follow=0&panel=1',assets=process.env.ASSETS_DIR;
const local=async p=>{if(assets)await p.route('**/assets/gl/*.js',r=>{const file=require('node:path').join(assets,new URL(r.request().url()).pathname.split('/').pop());fs.existsSync(file)?r.fulfill({body:fs.readFileSync(file),contentType:'text/javascript'}):r.continue();});};
fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--use-angle=metal']});
const report={origin,link,assets:assets||null,headless:true,errors:[],shots:[],steps:{}};
 try{const p=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:2});p.on('pageerror',e=>report.errors.push(String(e.stack||e).split('\n').slice(0,3).join(' | ')));
  const shot=async(name,clip)=>{await p.screenshot({path:`${out}/${name}.png`,...(clip?{clip}:{})});report.shots.push(name+'.png');};
  const click=sel=>p.click(`#celebration-panel ${sel}`);
  await local(p);await p.goto(origin+link);
  await p.waitForFunction(()=>typeof layerCity!=='undefined'&&layerCity?.live?.aq&&document.querySelector('#celebration-panel [data-district]')&&districtGrowth,null,{timeout:60000});
  await p.waitForTimeout(3000);
  report.buttons=await p.$$eval('#celebration-panel button',b=>b.map(x=>({text:x.textContent,disabled:x.disabled,aria:x.getAttribute('aria-label')})));
  report.panelBox=await p.$eval('#celebration-panel',e=>e.getBoundingClientRect().toJSON());
  report.lastChild=await p.$eval('#celebration-panel',e=>e.lastElementChild.id);
  report.project=await p.$eval('#celebration-project',s=>s.value);
  await shot('district-panel');
  // Screen box (CSS px) around world points, padded, clamped to the viewport.
  const box=(pts,pad=60)=>p.evaluate(([pts,pad])=>{const live=layerCity.live,v=live.cameraView(),S=live.gpu.scene,k=Math.max(innerWidth/S.w,innerHeight/S.h)*v.z;
   const q=pts.map(a=>[(a[0]-v.x)*k,(a[1]-v.y)*k]),x0=Math.max(0,Math.min(...q.map(a=>a[0]))-pad),y0=Math.max(0,Math.min(...q.map(a=>a[1]))-pad*1.6),x1=Math.min(innerWidth,Math.max(...q.map(a=>a[0]))+pad),y1=Math.min(innerHeight,Math.max(...q.map(a=>a[1]))+pad);
   return {x:x0,y:y0,width:Math.max(40,x1-x0),height:Math.max(40,y1-y0)};},[pts,pad]);
  const plotsOf=id=>p.evaluate(id=>{const g=layerCity.live.gpu.growth;return (g.snapshot?.plotOwners||[]).filter(o=>o.owner===id).map(o=>g.plots.get(o.id)?.ground).filter(Boolean);},id);
  const caption=()=>p.$eval('#celebration-demo-caption',e=>e.textContent).catch(()=>null);

  // Captures: fire, smoke and responders for each size, framed by the page as the capture demo does.
  for(const size of ['small','medium','large']){
   await click('[data-district="reset"]');await p.waitForTimeout(400);
   await click(`[data-district="capture-${size}"]`);
   await p.waitForFunction(()=>{const r=layerCity.live.aq.response;return r.events.length&&r.events.every(e=>e.route);},null,{timeout:15000}).catch(()=>{});
   await p.waitForTimeout(4500);
   report.steps['capture-'+size]=await p.evaluate(()=>{const r=layerCity.live.aq.response;return {mode:districtGrowth.mode,events:r.events.length,routed:r.events.filter(e=>e.route).length,groupPlots:r.events[0]?.group.plotIds.size,smokeSites:r.smokeSites.length,width:r.smokeSites[0]?.severity.width,from:r.events[0]?.capture.from,to:r.events[0]?.capture.to,vehicles:r.events.reduce((a,e)=>a+e.vehicles.length,0)};});
   report.steps['capture-'+size].caption=await caption();
   await shot('capture-'+size);
   const sites=await p.evaluate(()=>layerCity.live.aq.response.smokeSites.map(s=>[s.p[0],s.p[1]-s.severity.height*.6]).concat(layerCity.live.aq.response.smokeSites.map(s=>s.p)));
   if(sites.length)await shot('capture-'+size+'-close',await box(sites,90));
  }
  await click('[data-district="reset"]');await p.waitForTimeout(500);
  report.steps.afterCaptureReset=await p.evaluate(()=>({events:layerCity.live.aq.response.events.length}));

  // Growth, closure and the question on a project with an open hub (the first such option), so closure shows its hub go.
  const id=await p.evaluate(()=>{const ids=[...document.querySelectorAll('#celebration-project option')].map(o=>o.value);return ids.find(i=>[...towers.values()].some(t=>t.project===i&&t.lot&&t.kind!=='owner'))||ids[0];});
  await p.selectOption('#celebration-project',id);report.hubProject=id;
  // Growth: the real growth wave over the project's border plots facing its nearest neighbour.
  await p.evaluate(()=>cv.dispatchEvent(new MouseEvent('dblclick')));await p.waitForTimeout(1200); // the page's overview
  const own=await plotsOf(id);
  const area=await box(own,70);
  await shot('growth-before',area);
  await click('[data-district="grow"]');
  for(const [t,wait] of [[900,900],[1800,900],[3200,1400]]){await p.waitForTimeout(wait);await shot(`growth-${t}ms`,area);}
  report.steps.grow=await p.evaluate(()=>({wave:!!layerCity.live.gpu.growthWave,batch:districtGrowth.changes}));
  report.steps.grow.caption=await caption();
  await p.waitForTimeout(5500);
  report.steps.growEnded=await p.evaluate(()=>!layerCity.live.gpu.growthWave);

  // Close-up: zoom the page onto the four plots the wave lights, replay, and crop just them.
  const wavePlots=await p.evaluate(ids=>ids.map(i=>layerCity.live.gpu.growth.plots.get(i).ground),report.steps.grow.batch[0].plots);
  const scr=await p.evaluate(pts=>{const live=layerCity.live,v=live.cameraView(),S=live.gpu.scene,k=Math.max(innerWidth/S.w,innerHeight/S.h)*v.z,c=pts.reduce((a,q)=>[a[0]+q[0]/pts.length,a[1]+q[1]/pts.length],[0,0]);return [(c[0]-v.x)*k,(c[1]-v.y)*k];},wavePlots);
  await p.mouse.move(...scr);for(let i=0;i<6;i++){await p.mouse.wheel(0,-300);await p.waitForTimeout(150);}await p.waitForTimeout(1500);
  const near=await box(wavePlots,70);await shot('growth-close-before',near);
  await click('[data-district="grow"]');for(const t of [700,1500,2600]){await p.waitForTimeout(t===700?700:t===1500?800:1100);await shot(`growth-close-${t}ms`,near);}
  await p.waitForTimeout(6000);await p.evaluate(()=>cv.dispatchEvent(new MouseEvent('dblclick')));await p.waitForTimeout(1200);
  // Closure: the project's land vacated and its hub gone, as /city shows a closed project.
  await shot('closed-before',area);
  const hubBefore=await p.evaluate(id=>[...towers.values()].filter(t=>t.project===id).map(t=>({stage:t.stage,lot:!!t.lot})),id);
  await click('[data-district="closed"]');await p.waitForTimeout(1500);
  report.steps.closed={hubBefore,hubAfter:await p.evaluate(id=>[...towers.values()].filter(t=>t.project===id).map(t=>({stage:t.stage,lot:!!t.lot})),id),
   ownedAfter:await p.evaluate(id=>layerCity.live.gpu.growth.snapshot.plotOwners.filter(o=>o.owner===id).length,id),pressed:await p.$eval('[data-district="closed"]',b=>b.getAttribute('aria-pressed')),caption:await caption()};
  await shot('closed-after',area);
  await click('[data-district="closed"]');await p.waitForTimeout(1500);
  report.steps.reopened={owned:await p.evaluate(id=>layerCity.live.gpu.growth.snapshot.plotOwners.filter(o=>o.owner===id).length,id),hub:await p.evaluate(id=>[...towers.values()].filter(t=>t.project===id).some(t=>t.lot),id)};
  await shot('closed-reopened',area);

  // Owner question: the hub's beacon and sign flash gold once a second.
  await click('[data-district="question"]');await p.waitForTimeout(300);
  const hub=await p.evaluate(id=>{const live=layerCity.live,t=[...towers.values()].find(t=>t.project===id&&t.lot);if(!t)return null;const G=live.gpu.hubs.geometry(t.lot.hubBuilding);return {stage:t.stage,questions:t.questions,tip:G.tip,base:G.base,ground:G.ground};},id);
  report.steps.question={hub,caption:await caption()};
  if(hub){const q=await box([hub.tip,hub.ground,[hub.tip[0],hub.tip[1]-30]],80);
   const phases=[];for(let i=0;i<4;i++){await shot(`question-${i}`,q);phases.push(await p.evaluate(()=>performance.now()%1000|0));await p.waitForTimeout(260);}report.steps.question.phases=phases;}
  await click('[data-district="question"]');await p.waitForTimeout(200);
  report.steps.question.after=hub&&await p.evaluate(s=>[...towers.values()].find(t=>t.stage===s).questions,hub.stage);

  // Work levels: disabled with the reason while the district-work hook is missing.
  report.steps.work=await p.evaluate(()=>({hook:typeof layerCity.live.gpu.districtWork?.setDemo,disabled:[...document.querySelectorAll('[data-work]')].map(b=>b.disabled),hint:document.querySelector('#demo-work-hint')?.hidden===false?document.querySelector('#demo-work-hint').textContent:null}));

  // Reset all from every state at once.
  await click('[data-district="capture-medium"]');await click('[data-district="grow"]');await click('[data-district="closed"]');await click('[data-district="question"]');await p.waitForTimeout(800);
  await click('[data-district="reset"]');await p.waitForTimeout(800);
  report.steps.resetAll=await p.evaluate(id=>({events:layerCity.live.aq.response.events.length,wave:!!layerCity.live.gpu.growthWave,owned:layerCity.live.gpu.growth.snapshot.plotOwners.filter(o=>o.owner===id).length,closed:[...machines.values()].some(m=>m.cityData?.projects?.find(p=>p.id===id)?.closed),questions:[...towers.values()].filter(t=>t.project===id).map(t=>t.questions),pressed:[...document.querySelectorAll('[data-district][aria-pressed]')].map(b=>b.getAttribute('aria-pressed'))}),id);
  report.steps.counts=await p.$eval('#demo-taxi-counts',e=>e.textContent).catch(()=>null);

  // Keyboard: Tab reaches the group and the focused button shows its outline.
  await p.focus('#celebration-panel [data-district="grow"]');await p.keyboard.press('Shift+Tab');await p.keyboard.press('Tab');
  report.steps.focus=await p.evaluate(()=>{const a=document.activeElement;return {district:a?.dataset?.district,outline:getComputedStyle(a).outlineStyle+' '+getComputedStyle(a).outlineColor};});
  const pb=await p.$eval('#celebration-panel',e=>e.getBoundingClientRect().toJSON());await shot('district-panel-focus',{x:pb.x,y:pb.y,width:pb.width,height:pb.height});
  await p.close();

  // Phone width: the panel starts folded; opened, its groups wrap inside the screen.
  const m=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});m.on('pageerror',e=>report.errors.push('phone: '+String(e).slice(0,200)));
  await local(m);await m.goto(origin+link);await m.waitForFunction(()=>document.querySelector('#celebration-panel [data-district]'),null,{timeout:60000});await m.waitForTimeout(1500);
  report.phone={open:await m.$eval('#celebration-panel',e=>e.open)};await m.screenshot({path:`${out}/phone-folded.png`});
  await m.click('#celebration-panel summary');await m.waitForTimeout(300);
  report.phone.box=await m.$eval('#celebration-panel',e=>e.getBoundingClientRect().toJSON());await m.screenshot({path:`${out}/phone-open.png`});report.shots.push('phone-folded.png','phone-open.png');
 }catch(e){report.errors.push('runner: '+String(e.stack||e).split('\n').slice(0,4).join(' | '));}
 finally{fs.writeFileSync(`${out}/report.json`,JSON.stringify(report,null,1));await browser.close();console.log(JSON.stringify({errors:report.errors,steps:Object.keys(report.steps)}));}
})();
