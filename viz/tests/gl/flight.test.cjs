const assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
const {createFlightPlanner,settle}=await import('data:text/javascript;base64,'+fs.readFileSync(__dirname+'/../../assets/gl/flight.js').toString('base64'));
const S=JSON.parse(fs.readFileSync(__dirname+'/../../assets/gl/scene.json')),C=JSON.parse(fs.readFileSync(__dirname+'/../../assets/gl/live-data.json'));
const planner=createFlightPlanner(S.buildings),pads=C.pads.filter(p=>planner.canLand(p.g,p.g[1]-p.p[1]));
assert(pads.length>100);let minClearance=Infinity,maxMs=0,arcs=0,withArc=0;const started=performance.now();
for(let i=0;i<120;i++){
 const a=pads[i*17%pads.length],b=pads[(i*37+41)%pads.length],t=performance.now();
 const r=planner.plan(a.g,b.g,{height:a.g[1]-a.p[1],targetHeight:b.g[1]-b.p[1],speed:130});maxMs=Math.max(maxMs,performance.now()-t);
 if(r.approach)withArc++;const first=planner.sample(r,0),last=planner.sample(r,1);if(r.approach)assert(Math.abs(last.z-(b.g[1]-b.p[1]))<1e-6,'The arc ends on the pad');assert(Math.hypot(first.x-a.g[0],first.y-a.g[1])<1e-6);assert(Math.hypot(last.x-b.g[0],last.y-b.g[1])<1e-6);
 let previous=first,turnSign=0;
 for(let j=1;j<=600;j++){
  const p=planner.sample(r,j/600),clearance=r.altitude-planner.ceiling([p.x,p.y*2],8);minClearance=Math.min(clearance,minClearance);assert(clearance>=17.99,'Obstacle intersection');
  assert(p.z+.5>=planner.ceiling([p.x,p.y*2],2),'The arc must not cut through a building');arcs+=p.z<r.altitude?1:0;
  const turn=Math.atan2(Math.sin(p.heading-previous.heading),Math.cos(p.heading-previous.heading));
  if(Math.abs(turn)>1e-5){if(turnSign)assert.equal(Math.sign(turn),turnSign,'Curve weaves');turnSign=Math.sign(turn);}
  previous=p;
 }
 const endBefore=planner.sample(r,1-1e-4);assert(Math.hypot(last.x-endBefore.x,last.y-endBefore.y)<.0001,'No settled arrival');
}
assert(withArc>=80,`most flights land in one arc: ${withArc} of 120`);assert(arcs>0);
const route=planner.plan([850,438],[1080,438],{height:20,targetHeight:20,speed:130});
assert(route.altitude<300,'Owner tower should be skirted, not intersected');
const reroute=planner.plan([850,438],[750,400],{height:90,targetHeight:50,speed:130,heading:.7,initialSpeed:70});assert(Math.abs(planner.sample(reroute,0).heading-.7)<1e-8);
assert.equal(settle(-1),0);assert.equal(settle(2),1);assert.equal(settle(.5),.5);
// Exercise the actual runtime phases, including a journal dispatch during approach.
const vm=require('node:vm'),box={LANG:'en',machines:new Map(),cabs:new Map()};vm.createContext(box);
vm.runInContext(fs.readFileSync(__dirname+'/../../assets/gl/runtime.js','utf8')+';this.aquarium=gpuAquarium;',box);
let seed=17;const live={rand:()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;},gpu:{createCaptureResponse:()=>({clear(){}}),createCelebrations:()=>({update(){},draw(){},takeFrame:()=>null}),createDistrictWork:()=>({update(){},draw(){}}),painter:{},flight:{...planner,settle},roadTraffic:new Float32Array(308),roofDepth:()=>0,buildingAt:()=>null},cascade:()=>{},config:{maxFlights:30}};
const aq=box.aquarium(live,C,[]),source=aq.LPD[1][0];
const f={d:1,kind:0,state:'park',at:source,x:source.g[0],y:source.g[1],z:source.g[1]-source.p[1],h:0,sp:0,trail:[],wp:[],until:Infinity,bank:0,dir:1};aq.fl.push(f);
assert(aq.go(f,aq.LPD[2][0],0,true));let time=0,queued=false,completed=false,retried=false,phases=new Set();
for(let i=0;i<18000;i++){
 time+=1000/120;aq.stepFlyers(time,1/120);phases.add(f.state);
 if(f.state==='cruise'&&!queued){const position=[f.x,f.y,f.z],route=f.route;assert(aq.go(f,aq.LPD[4][0],time,true));assert.deepEqual([f.x,f.y,f.z],position);assert.equal(f.route,route);assert.equal(f.state,'cruise');queued=true;f.cargo=1;for(const pad of aq.LPD[4])pad.use.set('test-reservation','all');}
 if(f.state==='park'&&queued&&!retried){assert(f.pendingFlight,'Lost pending dispatch when pads were full');assert.equal(f.cargo,1);for(const pad of aq.LPD[4])pad.use.delete('test-reservation');retried=true;}
 if(f.state!=='park'&&retried&&!f.pendingFlight){completed=true;break;}
 assert(Math.abs(f.bank)<=1);
}
assert(completed&&retried,'Queued dispatch did not resume after capacity returned');aq.clear();assert.equal(f.pendingFlight,null);
// Hub height: raise one pad building to 2.4x in place (hubs.js raiseClearance, as main.js does) and fly across it.
const {scaledBuilding,raiseClearance,scalableHub}=await import(require('node:url').pathToFileURL(__dirname+'/../../assets/gl/hubs.js'));
const atB=(x,y)=>S.buildings.reduce((a,b)=>Math.hypot(b.ground[0]-x,b.ground[1]-y)<Math.hypot(a.ground[0]-x,a.ground[1]-y)?b:a);
const wallH=b=>Math.max(...b.surfaces.filter(f=>f.kind==='wall').map(f=>f.points[1][1]-f.points[2][1]));
// Pick a building and crossing routes that the unpatched planner would fly through once it is 2.4x: the check is then
// meaningful by construction, and the patched planner must clear every sample.
const stale=createFlightPlanner(S.buildings),zOf=q=>q.g[1]-q.p[1];let hub=null,routes=[];
const minClear=(pl,obstacle,[q,r])=>{const route=pl.plan(q.g,r.g,{height:zOf(q),targetHeight:zOf(r),speed:130});let m=Infinity;
 for(let j=0;j<=600;j++){const p=pl.sample(route,j/600);m=Math.min(m,route.altitude-obstacle.ceiling([p.x,p.y*2],8));}return m;};
for(const p of pads){const b=atB(...p.g);if(!scalableHub(b)||wallH(b)<35||wallH(b)>90)continue;const only=createFlightPlanner([scaledBuilding(b,2.4)]);
 const near=pads.filter(q=>Math.hypot(q.g[0]-b.ground[0],(q.g[1]-b.ground[1])*2)<200&&atB(...q.g).id!==b.id).slice(0,14),hits=[];
 for(const q of near)for(const r of near)if(q!==r&&minClear(stale,only,[q,r])<17.99)hits.push([q,r]);
 if(hits.length>=3){hub=b;routes=hits.slice(0,16);break;}}
assert(hub,'a pad building that unpatched routes would cut through');
const H0=wallH(hub),raised=createFlightPlanner(S.buildings),truth=createFlightPlanner(S.buildings.map(b=>b.id===hub.id?scaledBuilding(b,2.4):b));
assert(raiseClearance(raised.obstacles,hub,2.4)>0);
for(let x=-40;x<=40;x+=4)for(let y=-40;y<=40;y+=4){const p=[hub.ground[0]+x,hub.ground[1]*2+y];assert.equal(raised.ceiling(p),truth.ceiling(p),'patched clearance equals a full rebuild');}
const padOnHub=pads.find(p=>atB(...p.g).id===hub.id),rz=zOf(padOnHub);
assert(raised.canLand(padOnHub.g,rz+H0*1.4)&&!raised.canLand(padOnHub.g,rz),'the raised roof is landable at its new height only');
const fresh=routes.map(r=>minClear(raised,truth,r)),old=routes.map(r=>minClear(stale,truth,r));
assert(fresh.every(c=>c>=17.99),'Obstacle intersection with the raised hub: '+Math.min(...fresh));assert(old.every(c=>c<17.99));
console.log('PASS: raised hub building '+hub.id+' H '+H0.toFixed(1)+' -> '+(H0*2.4).toFixed(1)+': '+routes.length+' routes that the unpatched planner flies through (min clearance '+Math.min(...old).toFixed(1)+') clear it after raiseClearance, 600 samples each, min clearance '+Math.min(...fresh).toFixed(1));
console.log(JSON.stringify({pass:true,paths:120,collisionSamples:72000,minClearance,maxPlanMs:maxMs,totalMs:performance.now()-started,landablePads:pads.length,ownerDetourAltitude:route.altitude,queuedDispatch:true}));
})().catch(e=>{console.error(e);process.exitCode=1});
