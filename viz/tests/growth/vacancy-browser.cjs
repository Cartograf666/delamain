// Actual v4 endpoint replay across dates; no fabricated ownership or journal writes.
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const origin=process.env.GROWTH_ORIGIN||'http://127.0.0.1:8827',out=process.env.GROWTH_EVIDENCE||'/tmp/vacant-land-slot27/browser';
fs.mkdirSync(out,{recursive:true});
const legacy=JSON.parse(fs.readFileSync(path.join(__dirname,'legacy-identity-city.json'))),graph=JSON.parse(fs.readFileSync(path.join(__dirname,'../../citydata/graph.json')));
const evidence={origin,checks:[],errors:[]};
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--use-angle=metal']});try{
 const state=await fetch(origin+'/state').then(r=>r.json());
 for(const date of ['2026-10-24','2026-10-29','2026-11-05']) {
  const city=await fetch(origin+'/city?date='+date).then(r=>r.json()),ah=city.projects.find(p=>p.id==='Agent Harness');
  assert.equal(city.rulesVersion,4);assert.equal(city.date,date);
  const owners=city.plotOwners.filter(o=>o.owner===ah.id);assert.equal(owners.length,ah.plots.length);assert(owners.every(o=>!o.dark&&!o.reserved));
  const area=owners.reduce((sum,o)=>{const p=graph.plots[o.index];return sum+(p.x1-p.x0)*(p.y1-p.y0);},0);assert(Math.abs(area-ah.area)<.00051);
  fs.writeFileSync(path.join(out,date+'-city.json'),JSON.stringify(city));
  const p=await browser.newPage({viewport:{width:1600,height:1000},reducedMotion:'reduce'});p.on('pageerror',e=>evidence.errors.push(String(e)));
  await p.route('**/state',r=>r.fulfill({json:state}));await p.route('**/events',r=>r.abort());await p.route('**/history?**',r=>r.fulfill({json:{lines:[]}}));
  await p.route(/\/city$/,r=>r.fulfill({json:city}));
  await p.goto(origin+'/?map=1&live=1&lang=ru&follow=0');await p.waitForFunction(()=>typeof districtGrowth!=='undefined'&&districtGrowth&&layerCity.live.metrics.frames>3,null,{timeout:90000});
  await p.locator('[data-mode=territories]').click();await p.locator('#growth-labels [data-project="Agent Harness"]').focus();await p.waitForFunction(()=>districtGrowth.highlighted==='Agent Harness');
  assert((await p.locator('#growth-labels [data-project="Agent Harness"]').getAttribute('aria-label')).includes(ah.plots.length+' участков'));
  await p.screenshot({path:path.join(out,date+'-info.png')});await p.keyboard.press('Escape');
  await p.evaluate(()=>{const m=layerCity.live.gpu.growth,main=districtGrowth.snapshot.projects.find(p=>p.id==='Agent Harness').mainPlot,center=m.plots.get(main.id).ground,w=layerCity.live.world(...center);manualView();cam.z=cam.tz=3;cam.x=cam.tx=w.x-w.y;cam.y=cam.ty=(w.x+w.y)/2;});await p.waitForTimeout(200);
  const check=await p.evaluate(legacy=>{
   const l=layerCity.live,g=l.gpu,m=g.growth,s=g.scene,c=districtGrowth.snapshot,by=new Map(c.plotOwners.map(o=>[o.id,o])),old=new Map(legacy.plotOwners.map(o=>[o.id,o]));
   const main=c.projects.find(p=>p.id==='Agent Harness').mainPlot,centre=m.plots.get(main.id).ground;
   const source=[50,60,70],owned=[],neutral=[],errors=[];
   const winding=(p,paths)=>paths.reduce((w,q)=>{for(let i=0;i<q.length;i++){const a=q[i],b=q[(i+1)%q.length],cross=(b[0]-a[0])*(p[1]-a[1])-(p[0]-a[0])*(b[1]-a[1]);if(a[1]<=p[1]&&b[1]>p[1]&&cross>0)w++;if(a[1]>p[1]&&b[1]<=p[1]&&cross<0)w--;}return w;},0);
   for(const o of c.plotOwners){const land=m.plots.get(o.id);if(!land)continue;if(!o.owner||o.reserved){if(m.territoryAt(...land.ground)!==null)errors.push('vacant contour '+o.id);if(winding(land.ground,m.boundary('Agent Harness'))!==0)errors.push('vacant highlight fill '+o.id);}else if(o.owner==='Agent Harness'&&m.territoryAt(...land.ground)!==o.owner)errors.push('owned contour '+o.id);}
   for(const b of s.buildings){const o=by.get(m.buildingPlots.get(b.id));if(!o||o.reserved||b.kind!=='b')continue;const identity=m.identity(b.id),colour=m.material(b.id,source),tinted=colour.some((v,i)=>v!==source[i]);
    if(o.owner==='Agent Harness'){if(identity?.project?.id!==o.owner||!tinted)errors.push('owned hue '+b.id);owned.push(b.id);}
    if(!o.owner){if(identity?.project||tinted)errors.push('vacant hue '+b.id);if(old.get(o.id)?.owner==='Agent Harness')neutral.push(b.id);}
   }
   const inside=([x,y],q)=>{let hit=false;for(let i=0,j=q.length-1;i<q.length;j=i++)if((q[i][1]>y)!==(q[j][1]>y)&&x<(q[j][0]-q[i][0])*(y-q[i][1])/(q[j][1]-q[i][1])+q[i][0])hit=!hit;return hit;};
   const faces=s.buildings.flatMap(b=>b.surfaces.map(f=>({b,layer:f.layer,q:f.points.map(p=>m.point(b.id,p))}))).sort((a,b)=>b.layer-a.layer);
   const v=l.cameraView(),k=Math.max(W/s.w,H/s.h)*v.z;
   const candidates=ids=>ids.flatMap(id=>{const b=m.buildings.get(id);return b.surfaces.flatMap(f=>{const q=f.points.map(p=>m.point(id,p)),pt=q.reduce((a,p)=>[a[0]+p[0]/q.length,a[1]+p[1]/q.length],[0,0]),x=(pt[0]-v.x)*k,y=(pt[1]-v.y)*k;if(x<340||x>1550||y<180||y>900||document.elementFromPoint(x,y)!==cv||faces.find(f=>inside(pt,f.q))?.b.id!==id)return[];return [{id,x,y,project:districtGrowth.projectAt(x,y)}];});});
   return {date:c.date,ownedCount:c.plotOwners.filter(o=>o.owner==='Agent Harness').length,area:c.projects.find(p=>p.id==='Agent Harness').area,linkedActive:owned.length,clearedLegacyLinked:neutral.length,ownedHits:candidates(owned),vacantHits:candidates(neutral),errors,gl:document.querySelector('#gpu-city').getContext('webgl2').getError(),centre};
  },legacy);
  assert.deepEqual(check.errors,[]);assert.equal(check.gl,0);assert(check.ownedHits.length>0);assert(check.ownedHits.every(h=>h.project==='Agent Harness'));assert(check.vacantHits.every(h=>h.project===null));
  const stable=async hits=>{for(const hit of hits){if(await p.evaluate(h=>[[-2,0],[2,0],[0,-2],[0,2],[0,0]].every(([dx,dy])=>districtGrowth.projectAt(Math.round(h.x)+dx,Math.round(h.y)+dy)===h.project),hit))return {...hit,x:Math.round(hit.x),y:Math.round(hit.y)};}return null;};
  const hit=await stable(check.ownedHits);assert(hit,'owned facade must have a stable pixel target');await p.mouse.move(hit.x,hit.y);await p.waitForTimeout(100);assert.equal(await p.evaluate(()=>districtGrowth.highlighted),'Agent Harness');await p.screenshot({path:path.join(out,date+'-zoomed-hover.png')});await p.mouse.click(hit.x,hit.y);assert.equal(await p.evaluate(()=>districtGrowth.highlighted),'Agent Harness');
  // Empty clicks keep the original hub pin/camera path; only district selection must stay empty.
  if(check.vacantHits.length){const empty=await stable(check.vacantHits);assert(empty,'vacant facade must have a stable pixel target');await p.keyboard.press('Escape');await p.mouse.move(empty.x,empty.y);await p.waitForTimeout(100);assert.equal(await p.evaluate(()=>districtGrowth.highlighted),null);await p.mouse.click(empty.x,empty.y);assert.equal(await p.evaluate(()=>districtGrowth.selected),null);await p.screenshot({path:path.join(out,date+'-cleared-hover.png')});}
  if(date==='2026-11-05')assert(check.vacantHits.length>0,'final actual cleared facade must be tested');
  evidence.checks.push(check);await p.close();
 }
 assert.deepEqual(evidence.errors,[]);
}finally{await browser.close();fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify(evidence,null,2));}
console.log(JSON.stringify(evidence.checks.map(({ownedHits,vacantHits,...c})=>({...c,ownedHits:ownedHits.length,vacantHits:vacantHits.length})),null,2));})().catch(e=>{console.error(e);process.exitCode=1});
