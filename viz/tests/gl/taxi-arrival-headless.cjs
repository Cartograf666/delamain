// Background-only arrival-light frames: just before touchdown and at the light peak, delivery vs patrol, reduced motion.
// OLD_DIR serves runtime.js/lighting.js from another revision for a before/after comparison. Never opens the user's browser.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const origin=process.env.CAPTURE_ORIGIN||'http://127.0.0.1:8832',out=process.env.TAXI_PROOF||'./work/shots/taxi',old=process.env.OLD_DIR;
const pick={'Куда за музыкой':'fixture-1','Clip Factory':'fixture-2','Dota2Helper':'fixture-3','Dark Patterns':'fixture-4','Sochen':'fixture-5','Twin Lab':'fixture-6'};
const city=JSON.parse(fs.readFileSync(path.join(__dirname,'../growth/legacy-identity-city.json')));for(const p of city.projects){p.stages=pick[p.id]?[pick[p.id]]:[];if(pick[p.id])p.light=1;}
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--use-angle=metal']});const log={old:!!old,errors:[],frames:[]};
 try{for(const reduced of old?[false]:[false,true]){const p=await browser.newPage({viewport:{width:1400,height:900},deviceScaleFactor:1});p.on('pageerror',e=>log.errors.push(String(e)));
  await p.emulateMedia({reducedMotion:reduced?'reduce':'no-preference'});await p.route('**/city',r=>r.fulfill({contentType:'application/json',body:JSON.stringify(city)}));
  if(old)for(const f of ['runtime.js','lighting.js'])await p.route('**/assets/gl/'+f,r=>r.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(old,f),'utf8')}));
  await p.goto(origin+'/?map=1&live=1&lang=ru&follow=0');await p.waitForFunction(()=>typeof layerCity!=='undefined'&&layerCity?.live?.aq&&[...towers.values()].some(t=>t.lot)&&cabs.size>20);await p.waitForTimeout(6000);
  const tag=(old?'old':'new')+(reduced?'-reduced':'');
  const shoot=async(kind,pred)=>{const key=await p.evaluate(kind=>{const aq=layerCity.live.aq,src=[...machines.keys()].find(s=>machines.get(s).stages?.has('fixture-1')),st=machines.get(src).stages.get('fixture-1'),role=[...st.workers.keys()][0],c=st.workers.get(role),f=aq.fl.find(q=>q.worker===c);
    if(kind==='delivery'){aq.dispatch(f.d,performance.now(),role,c.key,src,{stage:'fixture-1',from:['fixture-1',role],to:[['fixture-2','hub']],text:'fixture'});return c.key}
    for(const c of cabs.values())if(/fixture-[123]/.test(c.stage))c.working=true;return null},kind);
   const near=await p.waitForFunction(([key,kind])=>{const f=layerCity.live.aq.fl.find(q=>kind==='delivery'?q.key===key&&q.cargo===1:!q.cargo&&q.T&&q.work);const g=kind==='delivery'?f:layerCity.live.aq.fl.find(q=>!q.cargo&&q.state==='descend'&&q.T);return g&&g.state==='descend'&&g.phase>g.descentDuration-.6&&{key:g.key,x:g.to.g[0],y:g.to.g[1]}},[key,kind],{timeout:60000,polling:16}).then(h=>h.jsonValue());
   await p.evaluate(({x,y})=>{const l=layerCity.live;manual=true;cam.z=cam.tz=2.6;const base=Math.max(W/1800,H/780),v=l.cameraView(),k=base*cam.z,s=l.city.scale*l.factor;cam.x+=(x-W/k/2-v.x)/s;cam.y+=(y-30-H/k/2-v.y)/s;cam.tx=cam.x;cam.ty=cam.y;},near);
   const snap=async n=>{const name=`arrival-${tag}-${kind}-${n}.png`;await p.screenshot({path:out+'/'+name});log.frames.push(name)};await snap('1-before');
   await p.waitForFunction(k=>layerCity.live.aq.fl.find(q=>q.key===k)?.state==='park',near.key,{polling:16});await p.waitForTimeout(110);await snap('2-flash');await p.waitForTimeout(380);await snap('3-peak');await p.evaluate(()=>{manual=false});};
  await shoot('delivery');if(!reduced&&!old)await shoot('patrol');await p.close();}}
 finally{await browser.close();}console.log(JSON.stringify(log));if(log.errors.length)process.exitCode=1})().catch(e=>{console.error(e);process.exitCode=1});
