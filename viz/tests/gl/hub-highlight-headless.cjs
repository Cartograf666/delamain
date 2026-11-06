// Headless-only hub highlight evidence: three fixture hubs on real territories (fresh, mid context with an open owner
// question, 350k), overview and close shots in both modes. /city and /state are routed; nothing opens the user's browser.
// Usage: CAPTURE_ORIGIN=http://127.0.0.1:8833 HUB_PROOF=<dir> node viz/tests/gl/hub-highlight-headless.cjs
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const origin=process.env.CAPTURE_ORIGIN||'http://127.0.0.1:8833',out=process.env.HUB_PROOF||'/tmp/hub-highlight-shots';
const pick={'Куда за музыкой':'fixture-1','Clip Factory':'fixture-2','Dota2Helper':'fixture-3'};
const ctx={'fixture-1':0,'fixture-2':175000,'fixture-3':350000},questions={'fixture-2':1};
const city=JSON.parse(fs.readFileSync(path.join(__dirname,'../growth/legacy-identity-city.json')));
for(const p of city.projects){p.stages=pick[p.id]?[pick[p.id]]:[];if(pick[p.id])p.light=1;}
fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--use-angle=metal']});
 const report={origin,headless:true,errors:[],shots:[],hubs:[]};
 try{const p=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1,reducedMotion:process.env.REDUCED?'reduce':'no-preference'});p.on('pageerror',e=>report.errors.push(String(e.stack||e).split('\n').slice(0,3).join(' | ')));
  await p.route('**/city',r=>r.fulfill({contentType:'application/json',body:JSON.stringify(city)}));
  await p.goto(origin+'/?map=1&live=1&lang=ru&follow=0');
  await p.waitForFunction(()=>typeof layerCity!=='undefined'&&layerCity?.live?.aq&&['fixture-1','fixture-2','fixture-3'].every(s=>[...towers.values()].some(t=>t.stage===s&&t.lot)));
  // State arrives over SSE: patch each applied state, then the towers already seen.
  await p.evaluate(([ctx,questions])=>{const patch=s=>{for(const sv of s.stages||[])if(sv.name in ctx){sv.hub={...(sv.hub||{}),ctx:ctx[sv.name]};sv.questions=questions[sv.name]||0;}return s;},orig=applyState;
   applyState=(src,s)=>orig(src,patch(s));for(const t of towers.values())if(t.stage in ctx){t.ctx=ctx[t.stage];t.questions=questions[t.stage]||0;}},[ctx,questions]);
  await p.waitForTimeout(4000);
  report.hubs=await p.evaluate(()=>[...towers.values()].filter(t=>t.lot).map(t=>({stage:t.stage,ctx:t.ctx,questions:t.questions,open:t.open,pad:t.lot.pad.g})));
  const shot=async name=>{await p.waitForTimeout(1200);await p.screenshot({path:path.join(out,name+'.png')});report.shots.push(name+'.png');};
  for(const mode of ['activity','territories']){
   await p.locator(`[data-mode="${mode}"]`).click();
   await p.evaluate(()=>{manual=false;cam.until=0;});await p.waitForTimeout(2500);await shot(`${mode}-overview`);
   for(const stage of ['fixture-1','fixture-2','fixture-3']){
    await p.evaluate(stage=>{const t=[...towers.values()].find(t=>t.stage===stage),[a,b]=isoRaw(t.lot.x,t.lot.y);manual=true;cam.x=cam.tx=a;cam.y=cam.ty=b-towerLift(t)*.5;cam.z=cam.tz=3.2;},stage);
    await shot(`${mode}-close-${stage}`);
   }
   await p.evaluate(()=>{manual=false;cam.until=0;});
  }
 }catch(e){report.errors.push(String(e.stack||e));}
 finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,1));await browser.close();console.log(JSON.stringify({errors:report.errors,hubs:report.hubs,shots:report.shots.length}));}
})();
