// Territory taxis on the real GL city geometry and a frozen territory snapshot; GPU and flight curves are stubbed.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),A=__dirname+'/../../assets/gl/';
const C=JSON.parse(fs.readFileSync(A+'live-data.json')),G=JSON.parse(fs.readFileSync(A+'growth-plots.json')),S=JSON.parse(fs.readFileSync(A+'scene.json'));
const city=JSON.parse(fs.readFileSync(__dirname+'/../growth/legacy-identity-city.json'));C.roads=[{gpuId:0,c:0,p:[[0,0],[10,0]]}];
const plots=new Map(G.plots.map(p=>[p.id,p])),buildingPlots=new Map(G.plots.filter(p=>p.building!=null).map(p=>[p.building,p.id]));
const buildingAt=(x,y)=>S.buildings.reduce((a,b)=>Math.hypot(b.ground[0]-x,b.ground[1]-y)<Math.hypot(a.ground[0]-x,a.ground[1]-y)?b:a);
const inside=(p,q)=>{let c=false;for(let i=0,j=q.length-1;i<q.length;j=i++)if((q[i][1]>p[1])!==(q[j][1]>p[1])&&p[0]<(q[j][0]-q[i][0])*(p[1]-q[i][1])/(q[j][1]-q[i][1])+q[i][0])c=!c;return c;};
function world(seed=7){
  let s=seed;const rand=()=>(s=(s*16807)%2147483647)/2147483647,src='http://fixture';
  const flight={canLand:()=>true,settle:u=>Math.max(0,Math.min(1,u)),plan:(a,b,o)=>({altitude:(o.height||0)+20,duration:Math.max(.5,Math.hypot(b[0]-a[0],b[1]-a[1])/o.speed),a,b}),sample:(r,u)=>({x:r.a[0]+(r.b[0]-r.a[0])*u,y:r.a[1]+(r.b[1]-r.a[1])*u,heading:Math.atan2(r.b[1]-r.a[1],r.b[0]-r.a[0])})};
  const live={rand,overflow:0,config:{maxFlights:9},model:{heat:()=>0},updateWindows(){},world:(x,y,z)=>({x,y,z}),cascade(){},
    gpu:{createCaptureResponse:()=>({update(){},draw(){},clear(){},stats:{},events:[]}),createCelebrations:()=>({update(){},draw(){},takeFrame:()=>null}),createDistrictWork:()=>({update(){},draw(){}}),painter:{},flight,roofDepth:()=>0,roadTraffic:[0],updateRoadTraffic(){},buildingAt,arrivalWalls:()=>[],growth:{plots,buildingPlots}}};
  const stages=new Map(),machines=new Map([[src,{cityData:city,stages}]]),cabs=new Map();
  for(const p of city.projects)for(const st of p.stages){const g=plots.get(p.mainPlot.id).ground;stages.set(st,{stage:st,workers:new Map(),hub:{lot:{pad:{g,p:[g[0],g[1]-12],d:Math.max(0,C.names.indexOf(p.zone.toUpperCase())),k:'b'}}}});}
  const cityProject=(m,stage)=>city.projects.filter(p=>p.stages.includes(stage)).sort((a,b)=>b.area-a.area)[0];
  const ctx={LANG:'en',Math,Map,Set,Array,Object,JSON,console,machines,cabs,cityProject,hover:null,pinned:null,performance:{now:()=>0}};vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(A+'runtime.js','utf8'),ctx);const aq=ctx.gpuAquarium(live,C,[]);
  const P=id=>city.projects.find(p=>p.id===id),T=id=>aq.territory(src,P(id));
  let now=1000;const run=(ms,watch)=>{for(const end=now+ms;now<end;now+=50){aq.update(now,.05);watch&&watch(now)}};
  const cab=(id,i,model='opus')=>{const p=P(id),c={key:id+i,label:'w'+i,stage:p.stages[0],machine:src,home:{district:p.zone},engine:'claude',model,working:true};cabs.set(c.key,c);stages.get(p.stages[0]).workers.set(c.label,c);return c};
  return {aq,live,src,P,T,run,cab,stages,get now(){return now}};
}
const W=world(),{aq}=W;
// 1. Open assumption: a landing slot belongs to the plot its position falls in (its own building's plot).
for(const pad of aq.LP){const id=buildingPlots.get(buildingAt(...pad.g).id);assert(inside(pad.g,plots.get(id).footprint),'pad ground inside its building plot');}
const music='Куда за музыкой',clip='Clip Factory',del='Delamain',silentP='Minas Tirith';
for(const id of [music,clip,del])assert(W.T(id).slots.length>=2,id+' has landing slots');
assert.equal(W.T('Dark Patterns').slots.length,0);assert.equal(W.T('Dark Patterns').home.length,3,'no-slot territory parks nearest its main tower');
// 2. Patrol: working taxis stay inside their territory; a silent project's taxis stay parked.
// Size tier picks the pad type (large: D only), so Delamain (one D pad) patrols with a small taxi.
const cabs=[[music,'opus'],[music,'sonnet'],[clip,'sonnet'],[clip,'haiku'],[del,'haiku'],[silentP,'sonnet'],[silentP,'haiku']].map(([id,m],i)=>W.cab(id,i,m));W.run(100);
const landings=new Map(),start=new Map();for(const f of aq.fl){landings.set(f.key,[]);start.set(f.key,[f.x,f.y]);}
let prev=new Map();W.run(10*60*1000,()=>{for(const f of aq.fl){if(prev.get(f.key)!=='park'&&f.state==='park')landings.get(f.key).push(f.slot.par);prev.set(f.key,f.state)}});
for(const f of aq.fl){const id=f.T.p.id,L=landings.get(f.key);
  if(id===silentP){assert.deepEqual([f.x,f.y],start.get(f.key),'silent project taxi parked');continue}
  assert(L.length>3,id+' patrols ('+L.length+')');assert(L.every(p=>f.T.slots.includes(p)),id+' patrol stays inside territory');}
const rate=id=>aq.fl.filter(f=>f.T.p.id===id).reduce((a,f)=>a+(landings.get(f.key)||[]).length,0);assert(rate(music)>rate(clip),'patrol rate follows light: '+rate(music)+' > '+rate(clip));
// 3. Deliveries by addressee.
const D=(id,to,role='w0',extra={})=>{const p=W.P(id);aq.dispatch(0,W.now,role,null,W.src,{stage:p.stages[0],from:[p.stages[0],role],to,...extra});};
const settle=()=>W.run(60000),parkAll=()=>{for(const f of aq.fl)f.work=false;};
for(const c of cabs)c.working=false;W.run(20000);settle();
const loaded=()=>aq.fl.filter(f=>f.cargo===1);
let f0=aq.fl.find(f=>f.role==='w0'&&f.T.p.id===music),home=f0.homePad;assert(home&&W.T(music).home.includes(home),'a taxi keeps a fixed home pad in its territory');D(music,[[W.P(clip).stages[0],'hub']]);
assert.equal(f0.cargo,1);assert(W.T(clip).slots.includes(f0.to.par),'cross-project lands in the neighbour territory');
const clipMain=W.stages.get(W.P(clip).stages[0]).hub.lot.pad,free=W.T(clip).slots;assert.equal(f0.dest,clipMain,'container addressed to the neighbour tower');
const trace=[];W.run(60000,()=>trace.push(f0.cargo));assert(trace.includes(2),'unloads');assert.equal(f0.cargo,0);assert(f0.slot.par===home||(W.T(music).home.includes(f0.slot.par)&&[...home.use.keys()].some(q=>q!==f0)),'empty return to its own home pad, or inside the territory when another taxi holds it');
D(music,[['','owner']]);f0=aq.fl.find(f=>f.cargo===1);assert.equal(f0.to.d,0,'@owner lands in the core');
const near=aq.LP.slice().sort((a,b)=>Math.hypot(a.g[0]-aq.owner.g[0],(a.g[1]-aq.owner.g[1])*2)-Math.hypot(b.g[0]-aq.owner.g[0],(b.g[1]-aq.owner.g[1])*2));const fits=[['S','M','D'],['M','D'],['D']][f0.kind%3];assert.equal(f0.to.par,near.find(P=>fits.includes(P.type)),'@owner lands on the nearest fitting slot to the owner tower');settle();
for(const to of [[],[['no-such-stage','hub']],[[W.P(music).stages[0],'w1']]]){D(music,to);const f=loaded()[0];assert(W.T(music).slots.includes(f.to.par),'in-project / fallback hop stays in the district: '+JSON.stringify(to));
  if(!to.length||to[0][0]==='no-such-stage')assert.equal(f.dest,W.stages.get(W.P(music).stages[0]).hub.lot.pad,'falls back to the stage hub tower');settle();}
// 4. Caps: three per project, nine overall, owner trips first.
for(let i=0;i<5;i++)D(music,[],'x'+i);assert.equal(loaded().filter(f=>f.T.p.id===music).length,3);assert.equal(aq.queue.length,2);
for(const id of [clip,del,'Dota2Helper'])for(let i=0;i<3;i++)D(id,[],'y'+i);assert.equal(aq.fl.filter(f=>f.cargo).length,9,'global cap');
D('Stravel',[],'z');D('Stravel',[['','owner']],'o');assert(aq.queue[0].owner,'owner trip first in the queue');settle();settle();assert.equal(aq.queue.length,0,'queue drains');
// 5. Event hook flies to the project's main tower.
assert(aq.dispatchEvent(W.P(del),'release',W.now));const fe=loaded()[0];assert.equal(fe.trip,'release');assert.equal(fe.dest,W.stages.get(W.P(del).stages[0]).hub.lot.pad);assert(W.T(del).slots.includes(fe.to.par));
// 6. Test stand: virtual cabs on demand, one target kind per delivery button, caps, event hook, patrol, reset.
{const V=world(11),a=V.aq,virt=()=>a.fl.filter(f=>f.demo),busy=()=>a.fl.filter(f=>f.cargo===1),settle=()=>V.run(120000);
 const real=V.cab(clip,0);V.run(200);const realF=a.fl.find(f=>f.worker===real);assert(realF&&!realF.demo);assert.equal(virt().length,0);
 const mT=V.T(music),mMain=V.stages.get(V.P(music).stages[0]).hub.lot.pad,D2=(p,q)=>Math.hypot(p[0]-q[0],(p[1]-q[1])*2);
 const jp=a.demo.deliver(V.P(music),'project',V.now);V.run(100);assert.equal(virt().filter(f=>!f.temp).length,2,'two virtual cabs made on demand');
 let f=busy().find(q=>q.dest===jp.to.pad);assert(f&&f.demo,'a virtual cab takes the in-project delivery');assert(mT.slots.includes(f.dest)&&mT.slots.includes(f.to.par),'in project: its own other pad');
 assert(mT.slots.every(P=>D2(P.g,mMain.g)<=D2(f.dest.g,mMain.g)),'in project: the slot farthest from the main tower');
 const jo=a.demo.deliver(V.P(music),'owner',V.now);f=busy().find(q=>q.dest===a.owner);assert(f&&f.demo&&jo.owner,'owner: to the owner tower');assert.equal(f.to.d,0);
 const jn=a.demo.deliver(V.P(music),'neighbour',V.now),others=city.projects.map(q=>V.T(q.id)).filter(U=>U&&U.id!==mT.id);f=busy().find(q=>q.dest===jn.to.pad);
 assert(f&&f.demo&&jn.to.T.id!==mT.id,'neighbour: another territory');assert(others.every(U=>D2((V.stages.get(U.p.stages[0])?.hub.lot.pad||U.main).g,mMain.g)>=D2(jn.to.pad.g,mMain.g)),'neighbour: the nearest main tower');
 assert(!jn.to.T.slots.length||jn.to.T.slots.includes(f.to.par),'neighbour: lands in its territory');assert.equal(realF.cargo,0,'a demo trip never takes a real cab');
 settle();assert.equal(busy().length,0);
 // Five at once: three fly (project cap), two queue with the owner trip first; three more projects reach the city cap of nine.
 const over=V.live.overflow;for(const k of ['project','neighbour','project','neighbour','owner'])a.demo.deliver(V.P(music),k,V.now);
 assert.equal(busy().length,3);assert.equal(a.queue.length,2);assert(a.queue[0].owner,'owner trip first');assert.equal(V.live.overflow-over,2);
 for(const id of [del,'Dota2Helper','Stravel'])for(let i=0;i<5;i++)a.demo.deliver(V.P(id),'project',V.now);V.run(100);assert.equal(busy().length,9,'city cap');assert(busy().every(q=>q.demo));
 const c=a.demo.counts();assert.equal(c.cargo,9);assert.equal(c.max,9);assert(c.queue>0);
 a.demo.reset();assert.equal(virt().length,0,'reset removes every virtual cab');assert(!a.queue.some(j=>j.demo),'and their queued trips');V.run(1000);assert.equal(virt().length,0);assert(a.fl.includes(realF),'a real cab stays');
 // Event hook through dispatchEvent flies a virtual cab to the main tower; patrol moves virtual cabs inside their territory.
 assert(a.demo.event(V.P(del),'merge',V.now)!==false);V.run(100);f=busy()[0]||a.queue.find(j=>j.demo);assert(f&&f.demo);settle();
 assert.equal(a.demo.patrol(V.P(music),true),true);const lands=[];let st=new Map();V.run(5*60000,()=>{for(const q of virt()){if(st.get(q)!=='park'&&q.state==='park')lands.push([q,q.slot.par]);st.set(q,q.state)}});
 assert(lands.length>2&&lands.every(([q,P])=>q.T.slots.includes(P)),'virtual cabs patrol their territory ('+lands.length+')');
 a.demo.reset();V.run(200);assert.equal(virt().length,0);
 console.log('PASS: test stand (virtual cabs made and removed; in project / owner / neighbour targets; caps 3/9 and owner-first queue; event; patrol)');}
// Hub height: a taxi parked on a hub roof rides the roof up (main.js hubLifts) and back down; other roofs stay.
{const V=world(23),a=V.aq,L=V.live,c=V.cab('Куда за музыкой',0);V.run(100);c.working=false;V.run(90000);
 const f=a.fl.find(q=>q.state==='park'&&q.at);assert(f,'a parked taxi');
 const id=buildingAt(...f.at.g).id,z0=f.z,y0=f.at.p[1],other=a.LP.find(P=>buildingAt(...P.g).id!==id),oy=other.p[1];
 L.gpu.growth.buildings=new Map(S.buildings.map(b=>[b.id,b]));L.gpu.hubLifts=new Map([[id,18.5]]);V.run(50);
 assert.equal(f.state,'park');assert(Math.abs(f.z-(z0+18.5))<1e-9,'parked taxi rides the hub roof up: '+f.z+' vs '+z0);
 assert(Math.abs(f.at.p[1]-(y0-18.5))<1e-9,'its slot moves with the roof');assert.equal(other.p[1],oy,'other roofs stay');
 L.gpu.hubLifts.set(id,0);V.run(50);assert(Math.abs(f.z-z0)<1e-9&&Math.abs(f.at.p[1]-y0)<1e-9,'and back down with it');
 console.log('PASS: hub height (parked taxi follows its hub roof up '+(18.5).toFixed(1)+' and back)');}
console.log('PASS: pad→plot mapping, patrol in territory ('+[music,clip,del].map(id=>id+' '+rate(id)).join(', ')+'), silent parked, cross/owner/in-project/fallback deliveries, return home, caps 3/9, owner-first queue, event hook');
