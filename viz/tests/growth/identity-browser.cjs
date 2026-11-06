const {chromium}=require('playwright');
const fs=require('fs'),assert=require('node:assert/strict');
const out=process.env.GROWTH_EVIDENCE||'/tmp/district-identity-proof',origin=process.env.GROWTH_ORIGIN||'http://127.0.0.1:8826';fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--use-angle=metal']});try{const p=await browser.newPage({viewport:{width:1600,height:1000},reducedMotion:'reduce'}),errors=[];p.on('pageerror',e=>errors.push(String(e)));
// This exact identity scenario belongs to the v3 accepted snapshot. The live v4
// vacancy rule intentionally changes membership; vacancy-browser.cjs checks it.
const fixture=JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'legacy-identity-city.json')));
fs.writeFileSync(out+'/city.json',JSON.stringify(fixture));
if(!fs.existsSync(out+'/state.json'))fs.writeFileSync(out+'/state.json',JSON.stringify(await fetch(origin+'/state').then(r=>r.json())));
for(const k of ['state','city'])await p.route(k==='city'?/\/city(?:\?|$)/:'**/state',r=>r.fulfill({json:JSON.parse(fs.readFileSync(out+'/'+k+'.json'))}));await p.route('**/events',r=>r.abort());await p.route('**/history?**',r=>r.fulfill({json:{lines:[]}}));
await p.goto(origin+'/?map=1&live=1&lang=ru&follow=0');await p.waitForFunction(()=>typeof districtGrowth!=='undefined'&&districtGrowth&&layerCity.live.metrics.frames>3,null,{timeout:90000});
const prefix='final';await p.screenshot({path:out+'/'+prefix+'-activity.png'});await p.locator('[data-mode=territories]').click();await p.getByRole('button',{name:'Куда за музыкой · 426 участков',exact:true}).focus();await p.waitForFunction(()=>districtGrowth.highlighted==='Куда за музыкой');await p.screenshot({path:out+'/'+prefix+'-music.png'});
await p.keyboard.press('Escape');await p.screenshot({path:out+'/'+prefix+'-districts.png'});
await p.evaluate(()=>{const l=layerCity.live,w=l.world(1077,360);cam.z=cam.tz=2.7;cam.x=cam.tx=w.x-w.y;cam.y=cam.ty=(w.x+w.y)/2;});await p.waitForTimeout(250);await p.screenshot({path:out+'/'+prefix+'-roof.png'});
const info=await p.evaluate(()=>{const g=layerCity.live.gpu,s=g.scene,m=g.growth;return{music:districtGrowth.snapshot.projects.find(p=>p.id==='Куда за музыкой'),pads:layerCity.live.aq.LP.map(p=>({roof:p.p,ground:p.g,d:p.d,building:m.buildingAtGround?.(...p.g)?.id,roofBuilding:m.buildingAtRoof?.(...p.p)?.id})),special:s.buildings.filter(b=>b.kind!=='b').map(b=>({id:b.id,kind:b.kind,entry:m.identity?.(b.id)?.project?.id})),gl:document.querySelector('#gpu-city').getContext('webgl2').getError()};});fs.writeFileSync(out+'/'+prefix+'-runtime.json',JSON.stringify({errors,...info},null,2));
const checks=await p.evaluate(()=>{
 const l=layerCity.live,g=l.gpu,m=g.growth,s=g.scene,gl=document.querySelector('#gpu-city').getContext('webgl2'),snap=districtGrowth.snapshot;
 const hue=c=>{const hi=Math.max(...c),lo=Math.min(...c),d=hi-lo;return d===0?0:hi===c[0]?((c[1]-c[2])/d+6)%6:hi===c[1]?(c[2]-c[0])/d+2:(c[0]-c[1])/d+4;};
 const music=snap.projects.find(p=>p.id==='Куда за музыкой'),target=hue([50,128,146]),active=snap.plotOwners.filter(o=>o.owner===music.id&&!o.dark);
 let commands=0,maxHueError=0;const ids=new Set();
 for(const c of s.commands){const id=s.owners[c[3]];if(m.identity(id)?.project.id!==music.id)continue;const out=m.material(id,c[2]);maxHueError=Math.max(maxHueError,Math.abs(hue(out)-target));commands++;ids.add(id);}
 const windows=[...s.windows,...s.optional],ws=m.windows(g.windowState,windows);let windowHueError=0,windowCount=0;
 for(let i=0;i<ws.length/4;i++){const w=windows[i],id=s.owners[Math.floor(w[2])];if(m.identity(id)?.project.id===music.id&&ws[i*4+3]!==0){windowHueError=Math.max(windowHueError,Math.abs(hue(Array.from(ws.slice(i*4,i*4+3)))-target));windowCount++;}if(ws[i*4+3]!==g.windowState[i*4+3])throw Error('Window mask/pulse changed');}
 const mode=name=>document.querySelector('[data-mode='+name+']').click(),t=performance.now();l.aq.clear();
 const musicPad=l.aq.LP.find(p=>m.identity(m.buildingAtRoof(...p.p)?.id)?.project.id===music.id);
 if(!musicPad)throw Error('Missing live Music pad');
 l.aq.beam(l.data.pads[music.tower],[255,0,200],t-500);
 l.aq.rings.push({x:musicPad.p[0],y:musicPad.p[1],d:musicPad.d,t:t-300});
 const w=musicPad.w;l.aq.bolts.push({r:{p:w,x:musicPad.p[0],y:musicPad.p[1],d:musicPad.d},t:t-500,col:[255,0,200],dur:1000,hold:2000,st:0,fired:true});
 const original=m.lightColour,calls=[];m.lightColour=(id,c)=>{const out=original(id,c);calls.push({id,input:c,output:out,project:m.identity(id)?.project.id});return out;};
 const read=()=>{l.aq.draw(t);const pixels=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,pixels);return pixels;};
 mode('activity');const before=read(),cpu=new Float32Array(g.windowState);mode('territories');districtGrowth.beforeFrame(t);calls.length=0;const district=read(),dynamic=calls.filter(c=>c.project===music.id);mode('activity');const restored=read();m.lightColour=original;
 const activityRestored=before.every((v,i)=>v===restored[i]),districtChanged=district.reduce((n,v,i)=>n+(v!==before[i]),0),immutableWindows=cpu.every((v,i)=>v===g.windowState[i]);
 mode('territories');
 const v=l.cameraView(),k=Math.max(W/s.w,H/s.h)*v.z,landmark=s.buildings.find(b=>b.id===3933),face=landmark.surfaces[0],q=face.points;
 const inside=([x,y],q)=>{let hit=false;for(let i=0,j=q.length-1;i<q.length;j=i++)if((q[i][1]>y)!==(q[j][1]>y)&&x<(q[j][0]-q[i][0])*(y-q[i][1])/(q[j][1]-q[i][1])+q[i][0])hit=!hit;return hit;};
 const faces=s.buildings.flatMap(b=>b.surfaces.map(f=>({id:b.id,layer:f.layer,q:f.points.map(p=>m.point(b.id,p))}))).sort((a,b)=>b.layer-a.layer);
 const landmarkHits=[];for(let y=Math.min(...q.map(p=>p[1]));y<=Math.max(...q.map(p=>p[1]));y+=2)for(let x=Math.min(...q.map(p=>p[0]));x<=Math.max(...q.map(p=>p[0]));x+=2){const sx=(x-v.x)*k,sy=(y-v.y)*k;if(sx>320&&sx<1250&&sy>150&&sy<900&&faces.find(f=>inside([x,y],f.q))?.id===landmark.id&&districtGrowth.projectAt(sx,sy)===music.id)landmarkHits.push([sx,sy]);}
 return {activeParcels:active.length,colour:music.colour,musicIDs:[...ids],commands,maxHueError,windowCount,windowHueError,dynamic,activityRestored,districtChanged,immutableWindows,landmarkHits,gl:gl.getError()};
});
assert.equal(checks.activeParcels,426);assert.equal(checks.colour,'#328092');assert.equal(checks.musicIDs.length,401);assert(checks.maxHueError<.02);assert(checks.windowHueError<.02);assert(checks.dynamic.length>0);assert(checks.activityRestored);assert(checks.districtChanged>10000);assert(checks.immutableWindows);assert.equal(checks.gl,0);assert(checks.landmarkHits.length>0);
await p.keyboard.press('Escape');const hit=checks.landmarkHits[0];await p.mouse.click(...hit);assert.equal(await p.evaluate(()=>districtGrowth.highlighted),'Куда за музыкой');await p.locator('[data-mode=territories]').hover();await p.screenshot({path:out+'/final-key-selection.png'});
await p.locator('[data-mode=activity]').click();assert.equal(await p.evaluate(()=>districtGrowth.mode),'activity');await p.screenshot({path:out+'/final-restored-activity.png'});
const cadence={};for(const mode of ['activity','territories']){await p.locator('[data-mode='+mode+']').click();cadence[mode]=await p.evaluate(()=>new Promise(resolve=>{const times=[];let last=performance.now();const tick=t=>{times.push(t-last);last=t;if(times.length<60)requestAnimationFrame(tick);else{times.sort((a,b)=>a-b);resolve({median:times[30],p95:times[57],max:times[59]});}};requestAnimationFrame(tick);}));}

const standalone=await browser.newPage({viewport:{width:1200,height:800},reducedMotion:'reduce'});standalone.on('pageerror',e=>errors.push(String(e)));await standalone.route('**/assets/gl/index.html',r=>r.fulfill({contentType:'text/html',body:fs.readFileSync(require('node:path').join(__dirname,'../../assets/gl/index.html'),'utf8')}));await standalone.goto(origin+'/assets/gl/index.html');await standalone.waitForFunction(()=>window.pilot?.ready);
const staticResult=await standalone.evaluate(data=>{const g=pilot,gl=document.querySelector('#city').getContext('webgl2');const read=()=>{g.painter.reset();g.render(1234);const px=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,px);return px;};g.setGrowth(data,false);const before=read();g.setGrowth(data,true);const district=read();g.setGrowth(data,false);const after=read();return {restored:before.every((v,i)=>v===after[i]),changed:district.reduce((n,v,i)=>n+(v!==before[i]),0),gl:gl.getError(),pads:g.stats.landingPads.length};},JSON.parse(fs.readFileSync(out+'/city.json')));assert(staticResult.restored);assert(staticResult.changed>10000);assert.equal(staticResult.gl,0);await standalone.close();
assert.deepEqual(errors,[]);fs.writeFileSync(out+'/checks.json',JSON.stringify({errors,checks,cadence,staticResult,origin},null,2));console.log(JSON.stringify({errors,checks:{...checks,dynamic:checks.dynamic.length,musicIDs:checks.musicIDs.length,landmarkHits:checks.landmarkHits.length},cadence,staticResult}));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
