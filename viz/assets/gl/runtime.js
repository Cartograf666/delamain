// Calm tangent flights; only actual state or journal work launches departures.
function gpuAquarium(live,C,images){
const W=C.w,H=C.h,N=C.names.length,tint=C.tints,rgb=(c,a)=>`rgba(${c[0]},${c[1]},${c[2]},${a})`,rnd=(a,b)=>a+live.rand()*(b-a),spr=images;
const roofColour=(x,y,c)=>{const growth=live.gpu.growth;return growth.enabled&&growth.districtTone?growth.lightColour(growth.buildingAtRoof(x,y)?.id,c):c;};
const response=live.gpu.createCaptureResponse(live);let responseFramed=false;
const celebrations=live.gpu.createCelebrations(live,{lang:LANG,caption:true,taxis:()=>demo,district:()=>({response,towers,machines,placeHubs,growth:()=>districtGrowth}),feed:()=>[...machines.entries()].map(([src,m])=>({src,celebrations:m.celebrations,atLoad:m.celebratedAtLoad,projects:m.cityData?.projects}))});
// Work inside a district: real working cabs per project (district-work.js); setDemo adds a local level.
const districtWork=live.gpu.districtWork=live.gpu.createDistrictWork(live,{feed:()=>[...machines.entries()].map(([src,m])=>({src,city:m.cityData,working:[...cabs.values()].filter(c=>c.machine===src&&c.working&&!c.leaving).map(c=>cityProject(src,c.stage)?.id)}))});
let g=live.gpu.painter;const heat=new Array(N).fill(0);let sparks=[],rings=[],flare=0,fired=0;
const byD=[...Array(N)].map((_,d)=>C.pads.filter(p=>p.d===d));
const owner=C.pads.reduce((a,b)=>b.h>a.h?b:a);
const mainPad=byD.map((L,d)=>d===0?owner:(L.find(p=>p.k.startsWith('n:')&&!/^n:(la|sm|in)/.test(p.k)&&p.h>3)||L.reduce((a,b)=>b.h>a.h?b:a,L[0])));
const ROOFP=(C.roofs||[]).map(w=>{const cx=(w[0]+w[2]+w[4]+w[6])/4,cy=(w[1]+w[3]+w[5]+w[7])/4,e1=Math.hypot(w[2]-w[0],w[3]-w[1]),e2=Math.hypot(w[4]-w[2],w[5]-w[3]);let best=null,bd=9;for(const p of byD[w[8]]||[]){const e=Math.hypot(p.p[0]-cx,p.p[1]-cy);if(e<bd){bd=e;best=p}}return best&&{w,cx,cy,e1,e2,L:Math.max(e1,e2),S:Math.min(e1,e2),src:best}}).filter(Boolean);
function makePad(r,type){const s=r.src,rz=s.g[1]-s.p[1],P={type,w:r.w,e1:r.e1,e2:r.e2,p:[r.cx,r.cy],g:[r.cx,r.cy+rz],d:s.d,h:s.h,k:s.k,kid:s.kid,use:new Map()};P.par=P;P.part='all';
  if(type==='D'){const w=r.w,ux=(r.e1>=r.e2?w[2]-w[0]:w[6]-w[0])/4,uy=(r.e1>=r.e2?w[3]-w[1]:w[7]-w[1])/4;P.halves=[-1,1].map((k,i)=>({par:P,part:i,p:[r.cx+ux*k,r.cy+uy*k],g:[r.cx+ux*k,r.cy+uy*k+rz],d:s.d,h:s.h,k:s.k,kid:s.kid}))}return P}
const LPD=byD.map((L,d)=>{const R=ROOFP.filter(r=>r.w[8]===d).sort((a,b)=>b.L*b.S-a.L*a.S),out=[],far=(r,m)=>out.every(q=>Math.hypot(q.p[0]-r.cx,(q.p[1]-r.cy)*2)>m),take=(ok,type,n,m)=>{let c=0;for(const r of R){if(c>=n)break;if(ok(r)&&far(r,m)){out.push(makePad(r,type));c++}}return c};
  if(!take(r=>r.L>=18&&r.S>=10,'D',d===0?3:2,50)&&R[0])out.push(makePad(R[0],'D'));take(r=>r.L>=12&&r.S>=8,'M',3,45);take(r=>r.L>=8&&r.S>=6,'S',d===0?5:3,40);return out}),LP=LPD.flat();
const slotFree=(P,part)=>part==='all'?!P.use.size:![...P.use.values()].some(v=>v==='all'||v===part);
function slotFor(f,to){const tier=f.kind%3,L=to.pads||(LPD[to.d]&&LPD[to.d].length?LPD[to.d]:LP),opts=[];for(const P of L){if(tier===2){if(P.type==='D')opts.push([P,1,slotFree(P,'all')])}else if(tier===1){if(P.type==='M')opts.push([P,0,slotFree(P,'all')]);else if(P.type==='D')opts.push([P,1,slotFree(P,'all')])}else{if(P.type==='S')opts.push([P,0,slotFree(P,'all')]);else if(P.type==='D')for(const h of P.halves)opts.push([h,0,slotFree(P,h.part)]);else opts.push([P,1,slotFree(P,'all')])}}
  const free=opts.filter(o=>o[2]&&live.gpu.flight.canLand(o[0].g,roofZ(o[0]))),pool=free;if(!pool.length)return null;if(to.pads){const held=new Set(fl.filter(q=>q!==f&&q.cargo&&q.homePad).map(q=>q.homePad)),ok=pool.filter(o=>!held.has(o[0].par||o[0]));if(!ok.length)return null;const best=Math.min(...ok.map(o=>o[1]));return ok.find(o=>o[1]===best)[0]}const b=Math.min(...pool.map(o=>o[1])),c=pool.filter(o=>o[1]===b);return c[live.rand()*c.length|0][0]}
function takeSlot(f,s){freeSlot(f);f.slot=s;if(s&&s.par)s.par.use.set(f,s.part)}
function freeSlot(f){if(f.slot&&f.slot.par)f.slot.par.use.delete(f);f.slot=null}
function placeAt(f,s){if(!s){f.waiting=true;return;}f.waiting=false;takeSlot(f,s);f.at=s;f.to=s;f.x=s.g[0];f.y=s.g[1];f.z=roofZ(s)}
const near=(p,lo,hi)=>{const L=LPD[p.d];for(let i=0;i<24;i++){const q=L[live.rand()*L.length|0],e=Math.hypot(q.p[0]-p.p[0],q.p[1]-p.p[1]);if(e>lo&&e<hi)return q}return L[live.rand()*L.length|0]};
// Flight phases: vertical clearance, one tangent arc, fixed hover, slow descent. x,y are ground; z is height.
const roofZ=p=>Math.max(0,p.g[1]-p.p[1]),big=LP;
const anyPad=d=>{const a=LPD[d].length?LPD[d]:LP;return a[live.rand()*a.length|0]};
const coreDest=()=>live.rand()<.14?owner:anyPad(0);
// Territory taxis. A landing slot belongs to the plot of the building it stands on; a project's home is its owned plots.
// Targets carry an ordered pad list: slotFor takes the first free fitting slot, so a delivery lands next to its tower.
const D2=(a,b)=>Math.hypot(a[0]-b[0],(a[1]-b[1])*2),byNear=(L,g)=>L.slice().sort((a,b)=>D2(a.g,g)-D2(b.g,g));
const plotOf=P=>P.plot!==undefined?P.plot:(P.plot=live.gpu.growth?.buildingPlots?.get(live.gpu.buildingAt(...P.g)?.id)??null);
const terr=new Map(),hot=new Map(),PROJECT_CAP=3,silent=T=>!T||T.p.closed||(T.p.light??1)<=.12;
function territory(src,p){const city=machines.get(src)?.cityData;if(!city||!p||p.closed||!p.mainPlot)return null;const id=src+'\n'+p.id,old=terr.get(id);if(old&&old.city===city&&old.p===p)return old;
  const g=live.gpu.growth?.plots?.get(p.mainPlot.id)?.ground;if(!g)return null;const own=new Set((city.plotOwners||[]).filter(o=>o.owner===p.id&&!o.reserved).map(o=>o.id)),slots=LP.filter(P=>own.has(plotOf(P)));
  // A territory without a landing slot parks at the slots nearest its main tower and does not patrol.
  const T={id,src,city,p,slots,home:slots.length?slots:byNear(LP,g).slice(0,3),main:{g,p:g,d:Math.max(0,C.names.indexOf((p.zone||'core').toUpperCase()))}};terr.set(id,T);return T}
const towerOf=(src,stage)=>machines.get(src)?.stages.get(stage)?.hub?.lot?.pad;
const mainOf=T=>T.p.stages?.map(s=>towerOf(T.src,s)).find(Boolean)||T.main;
function toward(pad,T,strict){const own=byNear(T?.slots||[],pad.g);return{d:pad.d??T?.main.d??0,g:pad.g,p:pad.p||pad.g,pads:strict?own:[...new Set([...own,...byNear(LP,pad.g).slice(0,6)])]}}
function homeTarget(f){const T=f.T,g=(f.homePad||T?.main||f.at).g,wide=f.cargo===2&&performance.now()-(f.unloaded||0)>6000;return{d:f.homePad?.d??T?.main.d??f.d,g,p:g,pads:[...new Set([...(f.homePad?[f.homePad]:[]),...byNear(T?.home||[],g),...byNear(LP,wide?f.at.g:g).slice(0,wide?LP.length:6)])]}}
const atHome=f=>!f.T||f.T.home.includes(f.slot?.par);
function heat2(T,g,now){if(!T||!g)return;const L=(hot.get(T.id)||[]).filter(h=>now-h.t<300000);L.push({g,t:now});hot.set(T.id,L.slice(-12))}
function patrol(f,T,now){const H=hot.get(T.id)||[],m=mainOf(T).g,L=T.slots.filter(P=>P!==f.slot?.par);let sum=0;
  const acc=L.map(P=>{let v=.6+Math.exp(-D2(P.g,m)/160);for(const h of H)v+=2.5*Math.exp(-(now-h.t)/90000)*Math.exp(-D2(P.g,h.g)/90);return sum+=v}),r=live.rand()*sum;
  return toward(L[Math.max(0,acc.findIndex(c=>c>=r))],T,true)}
// Addressee from the journal line's parsed `to`: @owner, @hub <stage>, @role; unaddressed or unresolvable goes to the stage's hub.
function addressee(src,ev){const m=machines.get(src);if(!ev)return null;
  for(const [stage,role] of ev.to||[]){if(role==='owner')return{pad:owner,owner:true};const st=m?.stages.get(stage);if(!st?.hub?.lot?.pad)continue;
    const T=territory(src,cityProject(src,stage)),cab=role!=='hub'&&st.workers?.get(role)?.aquarium;return{pad:cab&&cab.state==='park'?cab.at:st.hub.lot.pad,T}}
  const T=territory(src,cityProject(src,ev.stage,ev.tag)),pad=towerOf(src,ev.stage)||(T&&mainOf(T));return pad?{pad,T}:null}
// sprite = engine kind x size; size follows model weight
// engine flame tips on each sprite, as a share of the frame from its centre
const THRUST=[[[-0.136,0.039],[0.042,0.109],[0.137,0.049]],[[-0.274,0.021],[0.142,0.193],[0.273,0.115]],[[-0.43,-0.062],[0.314,0.255],[0.428,0.19]],[[-0.092,0.062],[-0.001,0.099],[0.086,0.06]],[[-0.219,0.049],[-0.074,0.099],[0.084,0.172],[0.224,0.109]],[[-0.377,0.026],[-0.193,0.091],[-0.012,0.156],[0.179,0.227],[0.4,0.198]]];
// The main colour of each sprite (kind = engine x size): its trail, halo and outline take it, so a drone reads as one thing.
const DRONE=[[255,160,30],[20,205,230],[245,140,30],[255,30,170],[20,250,250],[140,50,255]];
const CARGO_PX=[26,31,35],modelTier=m=>/haiku|mini|flash|lite|fast/i.test(m||'')?0:/astra|opus|fable|pro\b/i.test(m||'')?2:1;
function mk(d,i,home){const p=home||anyPad(d),f=mkRaw(d,i,p);placeAt(f,slotFor(f,home?{d:p.d,g:p.g,pads:[p,...byNear(LP,p.g).slice(0,6)]}:p));return f}
function mkRaw(d,i,p){return{d,at:p,state:'park',until:0,kind:i%6,size:32,cargo:0,x:p.g[0],y:p.g[1],z:roofZ(p),h:rnd(0,6.28),sp:0,ph:rnd(0,6.28),wp:[],trail:[],bank:0,dir:1,t:0}}
function go(f,to,now,fast){if(!to)return false;if(f.state!=='park'){f.pendingFlight={to,fast};return true;}const was=f.slot,want=to;to=slotFor(f,want);for(let i=0;i<8&&to===was;i++)to=slotFor(f,want);if(!to||to===was){f.until=now+800;return false;}
  takeSlot(f,to);f.to=to;f.fast=fast;f.land=false;f.t=now;f.vmax=fast?rnd(105,150):rnd(38,78);f.wp=[];
  f.route=live.gpu.flight.plan([f.x,f.y],to.g,{height:f.z,targetHeight:roofZ(to),speed:f.vmax});
  f.cz=f.route.altitude;f.phase=0;f.bank=0;f.startZ=f.z;f.riseDuration=Math.max(.6,(f.cz-f.z)*1.875/(fast?64:38));
  // Finish gaining obstacle clearance before translating across any footprint.
  f.state=f.route.climb||f.cz-f.z<=.2?'cruise':'up';return true;}
function resumePending(f,now){const next=f.pendingFlight;f.pendingFlight=null;if(!go(f,next.to,now,next.fast)){f.pendingFlight=next;f.until=now+800;}}
const fl=[];
function ring(x,y,d,now,big){rings.push({x,y,d,t:now,big});if(rings.length>40)rings.shift()}
for(const p of LP){p.depth=live.gpu.roofDepth(...p.p);for(const h of p.halves||[])h.depth=p.depth;}
function cascade(d,now,x,y,R,n){live.cascade(d,now,x,y,R,n);}
function spark(d,now,at,r,life){const L=byD[d];if(!L.length)return;const p=at||L[live.rand()*L.length|0];cascade(d,now,p.g[0],(p.g[1]+p.p[1])/2,r||rnd(30,70),r>=100?70:r>=60?34:14)}
// Trip kinds: delivery (journal line), event (merge/release to the main tower), patrol (nextDest). Over a cap a trip
// waits in the queue, owner trips first; the global cap and the per-project cap both count loaded and returning taxis.
const queue=[];
function dispatch(d,now,role,key,src,ev){fired++;const to=addressee(src,ev),job={kind:'delivery',d,role,key,src,stage:ev?.stage,T:src!=null&&ev?territory(src,cityProject(src,ev.stage,ev.tag)):null,to,owner:!!to?.owner,t:now};
  if(!launch(job,now)){live.overflow++;if(queue.length<24){queue.push(job);queue.sort((a,b)=>b.owner-a.owner||a.t-b.t)}else spark(d,now)}}
function dispatchEvent(project,kind='merge',now=performance.now(),demo=false){let src=null,p=null;for(const [s,m] of machines){p=m.cityData?.projects?.find(q=>q===project||q.id===(project?.id??project));if(p){src=s;break}}
  const T=territory(src,p);if(!T)return false;const job={kind,d:T.main.d,src,stage:p.stages?.[0],T,to:{pad:mainOf(T),T},owner:false,t:now,demo};if(!launch(job,now)){if(queue.length<24){queue.push(job);queue.sort((a,b)=>b.owner-a.owner||a.t-b.t)}return false}return true}
function launch(j,now){const busy=fl.filter(f=>f.cargo),T=j.T;if(busy.length>=live.config.maxFlights||(T&&busy.filter(f=>f.T?.id===T.id).length>=PROJECT_CAP))return false;const d=j.d,role=j.role,key=j.key;
  let f=(role&&fl.find(q=>(key?q.key===key:q.role===role)&&!q.cargo))||fl.filter(f=>(T?f.T?.id===T.id:f.d===d)&&!f.cargo&&!f.leave&&!f.demo===!j.demo).sort((a,b)=>(a.state==='park'?0:1)-(b.state==='park'?0:1))[0];
  if(!f){f=mk(d,fl.length,T&&T.home[live.rand()*T.home.length|0]);f.temp=true;f.demo=!!j.demo;f.T=T;f.machine=j.src;f.stage=j.stage;fl.push(f)}if(f.waiting){if(f.temp)fl.splice(fl.indexOf(f),1);live.overflow++;spark(d,now);return true;}
  if(!f.T)f.T=T;f.cargo=1;f.trip=j.kind;f.home=d;f.size=40;f.trail=[];f.homePad=f.homePad||(f.slot||f.at)?.par||null;f.dest=j.to?.pad||null;if(f.state==='park')ring(f.at.p[0],f.at.p[1],d,now,false);
  heat2(f.T,f.at?.g,now);heat2(j.to?.T,j.to?.pad.g,now);
  // A line without any tower (unseated stage, wastes) keeps the legacy zone flight.
  f.want=j.to?toward(j.to.pad,j.to.T):d===0?anyPad([1,2,4,6,7,8][live.rand()*6|0]):coreDest();go(f,f.want,now,true);return true}
function arrive(f,now){if(f.leave){f.gone=true;freeSlot(f);if(f.worker)f.worker.landed=true;}const p=f.to;if(!f.leave)beam(f.cargo===1&&f.dest||(f.stage&&machines.get(f.machine)?.stages.get(f.stage)?.hub?.lot?.pad)||mainPad[f.d],tint[f.d],now,f.cargo===1?.55:.3);f.at=p;f.x=p.g[0];f.y=p.g[1];f.z=roofZ(p);f.state='park';f.sp=0;f.wp=[];const sx=p.p[0],sy=p.p[1];if(f.T&&!f.homePad&&f.T.home.includes(p.par))f.homePad=p.par;
  if(f.pendingFlight&&!f.leave){resumePending(f,now);return;}
  if(f.cargo===1){landing(f,p,now,'delivery');bolt(f.d,now,p.g[0],(p.g[1]+p.p[1])/2,14);spark(p.d,now,p,70,2600);flare=Math.min(1,flare+(p===owner?.5:.15));heat[p.d]=Math.min(1,heat[p.d]+.04);f.cargo=2;f.unloaded=now;f.want=null;f.until=now+rnd(500,1400);return}
  if(f.cargo===2&&(f.homePad?homeTarget(f).pads.includes(p.par):f.d===f.home&&p.d===f.home)){const d=f.d;landing(f,p,now,'return');heat[d]=1-(1-heat[d])*.82;bolt(d,now,p.g[0],(p.g[1]+p.p[1])/2,32);cascade(d,now,p.g[0],(p.g[1]+p.p[1])/2,120,46);f.cargo=0;f.size=32;f.dest=null;f.until=now+rnd(1200,3500);if(f.temp){f.gone=true;freeSlot(f)};return}
  landing(f,p,now,'patrol');bolt(f.d,now,p.g[0],(p.g[1]+p.p[1])/2,5);spark(p.d,now,p,44,2400);f.d=f.cargo?f.d:p.d;f.until=now+rnd(700,4200)/(f.T?Math.max(.12,f.T.p.light??1):1)}
function nextDest(f,now){if(f.cargo===1&&f.want)return f.want;
  // A return that waits 6 s for its home slot while already standing in its territory ends the trip where it stands.
  if(f.cargo===2){if(f.T&&now-(f.unloaded||0)>6000&&f.T.home.includes(f.slot?.par)){f.cargo=0;f.size=32;f.dest=null;if(f.temp){f.gone=true;freeSlot(f)}return null}return f.homePad?homeTarget(f):anyPad(f.home)}const T=f.T;
  if(T){if(silent(T))return null;if(!atHome(f))return homeTarget(f);return f.work&&T.slots.length>1?patrol(f,T,now):null}
  if(live.rand()<.16){for(let i=0;i<20;i++){const q=big[live.rand()*big.length|0],e=Math.hypot(q.g[0]-f.x,q.g[1]-f.y);if(e>120&&e<460)return q}}
  for(let i=0;i<20;i++){const q=anyPad(f.d),e=Math.hypot(q.g[0]-f.x,q.g[1]-f.y);if(e>40&&e<300)return q}return anyPad(f.d)}
// Hub roofs rise with their building (main.js hubLifts, scene units): its slots, its tower pad and the taxis parked on
// it move with the roof; a descent targets roofZ(f.to) every frame, so it follows too.
const hubRoof=new Map(),hubLift=new Map();
function hubRoofItems(id){if(hubRoof.has(id))return hubRoof.get(id);const b=live.gpu.growth?.buildings?.get(id),out=[];
  if(b){const onRoof=g=>Math.hypot(g[0]-b.ground[0],g[1]-b.ground[1])<80&&live.gpu.buildingAt(...g).id===id;
    for(const P of LP)if(onRoof(P.g)){out.push({o:P,y:P.p[1],w:P.w.slice()});for(const h of P.halves||[])out.push({o:h,y:h.p[1]});}
    for(const p of C.pads)if(onRoof(p.g))out.push({o:p,y:p.p[1]});}
  hubRoof.set(id,out);return out}
function followHubRoofs(){const lifts=live.gpu.hubLifts;if(!lifts?.size)return;let moved=false;
  for(const [id,dz]of lifts){if(hubLift.get(id)===dz)continue;hubLift.set(id,dz);moved=true;
    for(const s of hubRoofItems(id)){s.o.p[1]=s.y-dz;if(s.w)s.o.w=s.w.map((v,i)=>i%2&&i<8?v-dz:v)}}
  if(moved)for(const f of fl)if(f.state==='park'&&f.at)f.z=roofZ(f.at)}
function stepFlyers(now,frameDt){followHubRoofs();const dt=Math.max(0,Math.min(frameDt,.1));for(const f of fl){
  if(f.waiting)continue;
  if(f.state==='park'){if(f.trail.length)f.trail.shift();if(now>f.until){if(f.pendingFlight)resumePending(f,now);else if(f.cargo||f.work||(f.T&&!atHome(f))){const to=nextDest(f,now);if(to)go(f,to,now,f.cargo===2);else f.until=now+2000;}}continue}
  const previousX=f.x,previousY=f.y,previousH=f.h;f.phase+=dt;
  if(f.state==='up'){
    f.z=f.startZ+(f.cz-f.startZ)*live.gpu.flight.settle(f.phase/f.riseDuration);
    if(f.phase>=f.riseDuration){f.z=f.cz;f.state='cruise';f.phase=0;}
  }else if(f.state==='cruise'){
    const u=Math.min(1,f.phase/f.route.duration),p=live.gpu.flight.sample(f.route,u);f.x=p.x;f.y=p.y;f.h=p.heading;f.z=p.z;
    if(Math.abs(Math.cos(f.h))>.3)f.dir=Math.cos(f.h)>=0?1:-1;
    if(f.route.approach)f.descentDuration=f.route.duration;
    if(u>=1){f.x=f.to.g[0];f.y=f.to.g[1];f.sp=0;f.phase=0;if(f.route.approach){f.z=roofZ(f.to);arrive(f,now);}else f.state='hover';}
  }else if(f.state==='hover'){
    f.x=f.to.g[0];f.y=f.to.g[1];f.z=f.cz;
    if(f.phase>=.25){f.state='descend';f.phase=0;f.descentDuration=Math.max(.9,(f.cz-roofZ(f.to))*1.875/36);}
  }else if(f.state==='descend'){
    f.x=f.to.g[0];f.y=f.to.g[1];const u=f.phase/f.descentDuration;f.z=f.cz+(roofZ(f.to)-f.cz)*live.gpu.flight.settle(u);
    if(u>=1)arrive(f,now);
  }
  // It leans into a turn and swings round to its new side instead of mirroring in a frame.
  const turn=f.state==='cruise'&&dt?Math.atan2(Math.sin(f.h-previousH),Math.cos(f.h-previousH))/dt:0;f.bank+=(Math.max(-1,Math.min(1,turn*1.4))-f.bank)*Math.min(1,dt*5);
  f.face??=f.dir;f.face+=Math.max(-dt*4.5,Math.min(dt*4.5,f.dir-f.face));
  f.sp=dt?Math.hypot(f.x-previousX,(f.y-previousY)*2)/dt:0;
  const tl=f.cargo?90:60;if(now-(f.tt||0)>16){f.tt=now;f.trail.push([f.x,f.y-f.z,f.dir]);if(f.trail.length>tl)f.trail.shift()}}
  for(let i=fl.length-1;i>=0;i--)if(fl[i].gone)fl.splice(i,1)}
function drawPads(now){for(const P of LP){g.depth=P.depth;const w=P.w,cx=P.p[0],cy=P.p[1],q=[0,2,4,6].map(i=>[cx+(w[i]-cx)*.8,cy+(w[i+1]-cy)*.8]),hot=P.use.size>0,b=hot?.68+.32*Math.sin(now/260):.42,pts=q.slice();
    if(P.type==='D'){const mid=(A,B)=>[(A[0]+B[0])/2,(A[1]+B[1])/2];if(P.e1>=P.e2)pts.push(mid(q[0],q[1]),mid(q[3],q[2]));else pts.push(mid(q[0],q[3]),mid(q[1],q[2]))}
    g.fillStyle=rgb(roofColour(cx,cy,tint[P.d]),b);for(const p of pts){g.beginPath();g.arc(p[0],p[1],.75,0,7);g.fill()}}}
function drawFlyer(f,now){if(f.waiting||f.gone)return;g.depth=f.state==='park'?(f.slot?.depth??-.96)-.00002:-.97;const px=f.x,py=f.y-f.z,col=tint[f.cargo?f.home:f.d],air=f.state!=='park',r=f.cargo?4.2:2.9;
  const z=CARGO_PX[f.kind%3]*(.9+.22*f.y/H),TH=THRUST[f.kind%6],T=f.trail,n=T.length,by=py-(air?0:z*.05),bright=lift(DRONE[f.kind%6],.12);g.globalCompositeOperation='lighter';g.lineCap='round';g.lineJoin='round';
  // Flying it stands out from a busy city: a strong halo, a bright trail and an outline. Parked it sits calm in a slow ring on its pad.
  if(!air){const beat=still()?.8:.65+.35*Math.sin(now/900+f.ph),R=z*.68;blob(px,py,z*1.05,bright,.34*beat);g.strokeStyle=rgb(bright,.9*beat);g.lineWidth=1.8;g.beginPath();g.ellipse(px,py,R,R/2,0,0,Math.PI*2);g.stroke(9);}
  {const R=z*(air?.95:.62),cy=by+z*.2,q=g.createRadialGradient(0,0,0,0,0,1);for(const [o,a] of [[0,.24],[.2,.19],[.42,.11],[.65,.05],[.85,.015],[1,0]])q.addColorStop(o,rgb(air?bright:col,a*(air?2.4:.55)));g.save();g.translate(px,cy);g.scale(R,R*.5);g.fillStyle=q;g.beginPath();g.arc(0,0,1,0,7);g.fill();g.restore()}
  if((f.state==='descend'||f.state==='cruise'&&f.route?.approach)&&f.to)descentLight(f,px,by,z,col);
  for(const t of TH){const ox=t[0]*z,oy=t[1]*z;
    if(air&&n>2){const pts=T.map(t=>[t[0]+ox*t[2],t[1]+oy]);g.trail(pts,rgb(bright,.4),3+z*.2);g.trail(pts,rgb(bright,1),1.6+z*.07);}
  }
  g.globalCompositeOperation='source-over';const face=f.face??f.dir,side=Math.abs(face)<.08?Math.sign(face||1)*.08:face;g.save();g.translate(px,by);g.rotate(f.bank*.16);g.scale(side,1);if(f.cargo===1)drawCargo(f,0,z*.2,z);g.drawImage(spr[f.kind%spr.length],-z/2,-z/2,z,z);if(f.worker&&(hover===f.worker||pinned===f.worker))g.drawImageOutline(spr[f.kind%spr.length],-z/2,-z/2,z,z,'#ffe9ae');else if(air)g.drawImageOutline(spr[f.kind%spr.length],-z/2,-z/2,z,z,`#${bright.map(v=>v.toString(16).padStart(2,'0')).join('')}`);g.restore()}
// The delivery container hangs under the taxi while loaded: the project's colour, lifted towards white to read at night.
const crateColour=f=>{const h=f.T?.p.colour,c=/^#[\da-f]{6}$/i.test(h||'')?h.slice(1).match(/../g).map(x=>parseInt(x,16)):tint[f.home];return c.map(v=>Math.round(v+(255-v)*.35))};
// Drawn inside the taxi's own transform and long along its axis, as the sprite's frame is: it turns and leans with the taxi.
function drawCargo(f,x,y,z){const c=crateColour(f),L=z*.13,W=z*.06,h=z*.1,top=[[x-L-W,y-L/2+W/2],[x+L-W,y+L/2+W/2],[x+L+W,y+L/2-W/2],[x-L+W,y-L/2-W/2]],down=p=>[p[0],p[1]+h];g.globalCompositeOperation='source-over';g.strokeStyle=rgb(c,.7);g.lineWidth=.5;g.beginPath();for(const p of [top[0],top[2]]){g.moveTo(p[0],p[1]-z*.07);g.lineTo(p[0],p[1])}g.stroke();
  const face=(pts,a)=>{g.fillStyle=rgb(a,1);g.beginPath();pts.forEach((p,i)=>g[i?'lineTo':'moveTo'](p[0],p[1]));g.closePath();g.fill()};
  face([top[0],top[1],down(top[1]),down(top[0])],c.map(v=>v*.62|0));face([top[1],top[2],down(top[2]),down(top[1])],c.map(v=>v*.82|0));face(top,c);}
// traffic on visible roads only
const RD=C.roads.map(r=>{const p=r.p,c=[0];for(let i=1;i<p.length;i++)c.push(c[i-1]+Math.hypot(p[i][0]-p[i-1][0],p[i][1]-p[i-1][1]));return{gpuId:r.gpuId,c:r.c,p,len:c[c.length-1],cum:c}}).filter(r=>r.len>4);
const ends=new Map(),key=q=>Math.round(q[0]/6)+','+Math.round(q[1]/6);
RD.forEach((r,i)=>{for(const [q,e] of [[r.p[0],0],[r.p[r.p.length-1],1]]){const k=key(q);if(!ends.has(k))ends.set(k,[]);ends.get(k).push([i,e])}});
function at(r,s){let i=1;while(i<r.cum.length-1&&r.cum[i]<s)i++;const a=r.p[i-1],b=r.p[i],L=(r.cum[i]-r.cum[i-1])||1,t=Math.max(0,Math.min(1,(s-r.cum[i-1])/L));return[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,(b[0]-a[0])/L,(b[1]-a[1])/L]}
const roadCounts=new Uint16Array(live.gpu.roadTraffic.length);
const cars=[...Array(230)].map(()=>{const r=live.rand()*RD.length|0;return{r,s:live.rand()*RD[r].len,dir:live.rand()<.5?1:-1,v:rnd(20,44)}});
function moveCars(dt){for(const c of cars){const rr=RD[c.r],edge=Math.min(c.s,rr.len-c.s),k=.42+.58*Math.min(1,edge/26);c.s+=c.v*k*dt*c.dir;const r=RD[c.r];if(c.s<0||c.s>r.len){const e=c.s>r.len?1:0,q=e?r.p[r.p.length-1]:r.p[0],o=(ends.get(key(q))||[]).filter(x=>x[0]!==c.r);
  if(o.length){const n=o[live.rand()*o.length|0];c.r=n[0];c.s=n[1]?RD[n[0]].len:0;c.dir=n[1]?-1:1}else{c.dir=-c.dir;c.s=Math.max(0,Math.min(r.len,c.s))}}}}
function drawCars(){g.globalCompositeOperation='lighter';for(const c of cars){const r=RD[c.r],o=r.c?1:1.7,col=at(r,c.s)[3]*c.dir<0?[255,60,70]:[255,226,180],pts=[];for(let i=5;i>=0;i--){const q=at(r,Math.max(0,Math.min(r.len,c.s-c.dir*i*2.6)));pts.push([q[0]-q[3]*c.dir*o,q[1]+q[2]*c.dir*o]);}g.trail(pts,rgb(col,1),1.3);const p=pts.at(-1);g.fillStyle=rgb(col,1);g.beginPath();g.arc(p[0],p[1],1.05,0,7);g.fill();}}
// lightning: light runs along roof neon edges, jumps roof to roof and branches, then each roof cuts out on its own
const RF=(C.roofs||[]).map((r,i)=>({i,p:r,d:r[8],x:(r[0]+r[4])/2,y:(r[1]+r[5])/2})),RB=new Map(),rk=(x,y)=>(x/60|0)+','+(y/60|0);RF.forEach(r=>{const k=rk(r.x,r.y);if(!RB.has(k))RB.set(k,[]);RB.get(k).push(r)});
let bolts=[];
function nearRoofs(x,y,R){const o=[],B=Math.ceil(R/60);for(let i=-B;i<=B;i++)for(let j=-B;j<=B;j++)for(const r of RB.get(rk(x+i*60,y+j*60))||[]){const e=Math.hypot(r.x-x,(r.y-y)*1.5);if(e<R)o.push([e,r])}return o.sort((a,b)=>a[0]-b[0])}
// neon snakes: a line crawls along a roof edge, crawls over to the next roofs, branches, then its tail eats the outline away
function corner(r,x,y){let b=0,m=1e9;for(let i=0;i<4;i++){const e=Math.hypot(r.p[i*2]-x,r.p[i*2+1]-y);if(e<m){m=e;b=i}}return b}
function bolt(d,now,x,y,n){const first=nearRoofs(x,y,90)[0];if(!first)return;const col=tint[d],seen=new Set([first[1].i]),q=[{r:first[1],t:now,c:null}];let c=0;
  while(q.length&&c<n&&bolts.length<260){const a=q.shift();c++;const dur=rnd(850,1350),st=a.c?corner(a.r,a.c[0],a.c[1]):0,e={r:a.r,t:a.t,col,dur,hold:rnd(1300,3200),st,con:a.c&&{x:a.c[0],y:a.c[1],len:a.cl}};bolts.push(e);
    const L=nearRoofs(a.r.x,a.r.y,64).filter(v=>!seen.has(v[1].i)).sort(()=>live.rand()-.5),b=1+(live.rand()<.5?1:0)+(live.rand()<.12?1:0);
    for(const v of L.slice(0,b)){seen.add(v[1].i);const k=corner(a.r,v[1].x,v[1].y),ox=a.r.p[k*2],oy=a.r.p[k*2+1],cl=rnd(260,420);q.push({r:v[1],t:a.t+dur*rnd(.5,.95)+cl,c:[ox,oy],cl})}}}
function drawBolts(now){g.globalCompositeOperation='lighter';g.lineJoin='round';g.lineCap='round';
  const line=(b,from,to)=>{const w=b.r.p,P=i=>[w[((b.st+i)%4)*2],w[((b.st+i)%4)*2+1]];g.beginPath();let on=false;for(let i=0;i<4;i++){const a=Math.max(from,i),c=Math.min(to,i+1);if(c<=a)continue;const A=P(i),B=P(i+1),x0=A[0]+(B[0]-A[0])*(a-i),y0=A[1]+(B[1]-A[1])*(a-i),x1=A[0]+(B[0]-A[0])*(c-i),y1=A[1]+(B[1]-A[1])*(c-i);if(!on){g.moveTo(x0,y0);on=true}g.lineTo(x1,y1)}return on};
  for(const b of bolts){g.depth=b.r.depth??(b.r.depth=live.gpu.roofDepth(b.r.x,b.r.y)-.00001);const col=roofColour(b.r.x,b.r.y,b.col),dt=now-b.t;
    if(dt<0)continue;
    if(!b.fired){b.fired=true;const life=b.dur+b.hold+1400;sparks.push({d:b.r.d,x:b.r.x,y:b.r.y+16,r:72,t:now,life});cascade(b.r.d,now+120,b.r.x,b.r.y+14,50,7)}
    {const a=Math.min(1,dt/500)*Math.max(0,Math.min(1,(b.dur*2+b.hold-dt)/900)),q=g.createRadialGradient(b.r.x,b.r.y+6,0,b.r.x,b.r.y+6,54);q.addColorStop(0,rgb(col,.13*a));q.addColorStop(1,rgb(col,0));g.fillStyle=q;g.beginPath();g.ellipse(b.r.x,b.r.y+6,54,38,0,0,7);g.fill()}
    const head=Math.min(4,dt/b.dur*4),tail=dt>b.dur+b.hold?Math.min(4,(dt-b.dur-b.hold)/b.dur*4):0;if(line(b,tail,head)){g.strokeStyle=rgb(col,.22);g.lineWidth=3.6;g.stroke();g.strokeStyle=rgb(col,.95);g.lineWidth=1.3;g.stroke()}}
  bolts=bolts.filter(b=>now-b.t<b.dur*2+b.hold);g.globalCompositeOperation='source-over'}
// Arrival light: a delivery lights the receiving walls at full strength, a patrol or return landing at 0.5, and a pulse
// runs up the receiving building. Overlapping arrivals share one ceiling per building (lighting.js ARRIVAL_CEILING).
let beams=[];const beamAt=new Map(),still=()=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
function beam(p,col,now,strength=.6){if(!p||now-(beamAt.get(p)?.t??-9e9)<1800&&strength<=beamAt.get(p).s)return;beamAt.set(p,{t:now,s:strength});const building=live.gpu.buildingAt(...p.g);beams.push({walls:building?live.gpu.arrivalWalls(building):[],x:p.g[0],top:p.p[1],bot:p.g[1],building,col,t:now,strength,rise:still()?650:170,pulse:!still()})}
function drawBeams(now){g.save();g.globalCompositeOperation='lighter';const scales=live.gpu.arrivalFrame(beams,now);for(const b of beams){const e=b.gain;if(!b.building)continue;const col=live.gpu.growth.lightColour(b.building.id,b.col);
for(const face of b.walls){g.depth=live.gpu.depth(face.layer)-.000002;g.uplight(face.points,live.gpu.growth.lightColour(face.buildingId,b.col),b.wall*scales.get(face.buildingId),face.gains);
  // Window pulse: a light front climbs the receiving walls from base to roof, its band fading downward.
  if(b.pulseLight>0&&face.buildingId===b.building.id){const [A,B,Cc,D]=face.points,u=b.pulseU,lo=Math.max(0,u-.3),m=(a,c,t)=>[a[0]+(c[0]-a[0])*t,a[1]+(c[1]-a[1])*t];g.depth=live.gpu.depth(face.layer)-.000003;g.uplight([m(A,D,u),m(B,Cc,u),m(B,Cc,lo),m(A,D,lo)],col,b.pulseLight*scales.get(face.buildingId));}}
const big=b.strength>=1,R=big?85:52;g.depth=.945;const q=g.createRadialGradient(b.x,b.bot,0,b.x,b.bot,R);q.addColorStop(0,rgb(col,(big?.6:.32)*e));q.addColorStop(1,rgb(col,0));g.fillStyle=q;g.beginPath();g.ellipse(b.x,b.bot,R,R/2,0,0,Math.PI*2);g.fill();}beams=beams.filter(b=>now-b.t<2000);g.restore();}
// Landing as an event (2026-11-05): touchdown flash, soft bloom, light column, two rings, sparks, and on a delivery the
// container opening. Scale by kind and the simultaneous cap live in lighting.js (landing); reduced motion keeps one soft bloom.
let landings=[],fxSeed=7;const frnd=()=>(fxSeed=fxSeed*16807%2147483647)/2147483647,WHITE=[255,250,235],sm=t=>(t=Math.max(0,Math.min(1,t)),t*t*(3-2*t));
const hexRgb=h=>/^#[\da-f]{6}$/i.test(h||'')?h.slice(1).match(/../g).map(x=>parseInt(x,16)):null,lift=(c,k)=>c.map(v=>Math.round(v+(255-v)*k));
const LANDING_GAIN=.5;
function landing(f,p,now,kind){const L=live.gpu.landing;if(!L)return;const x=p.p[0],y=p.p[1],calm=still(),s=L.scale(kind),sp=[];
  for(let i=calm?0:kind==='delivery'?48:22;i>0;i--){const a=frnd()*6.283,v=(45+frnd()*75)*(.7+.3*s);sp.push([Math.cos(a)*v,Math.sin(a)*v*.5,12+frnd()*30])}
  landings=L.admit(landings,{x,y,depth:(p.depth??live.gpu.roofDepth(x,y))-.000004,col:hexRgb(f.T?.p.colour)||roofColour(x,y,tint[f.cargo?f.home:f.d]),t:now,scale:s,kind,calm,sp,crate:kind==='delivery'&&!calm&&crateColour(f)},now)}
// A soft isometric light pool as one quad (radial falloff in the shader), cheap enough for every spark.
function blob(x,y,R,c,a,sy=.5){if(a<=.003)return;g.save();g.translate(x,y);g.scale(1,sy);const q=g.createRadialGradient(0,0,0,0,0,R);q.addColorStop(0,rgb(c,Math.min(1,a)));q.addColorStop(1,rgb(c,0));g.fillStyle=q;g.fillRect(-R,-R,R*2,R*2);g.restore()}
function drawLandings(now){const L=live.gpu.landing;if(!L||!landings.length)return;L.frame(landings,now);g.save();g.globalCompositeOperation='lighter';g.lineCap='round';
  for(const e of landings){const dt=(now-e.t)/1000,fade=e.fade==null?1:Math.max(0,1-(now-e.fade)/200),k=e.k*fade*e.scale*LANDING_GAIN,c=e.col,x=e.x,y=e.y,full=e.scale>=1;if(dt<0||k<=0)continue;g.depth=e.depth;
    // Bloom: up in 120 ms (400 ms calm), eases out over 1.2 s; 130 units for a delivery, 95 at half.
    const R=full?84:60,b=k*Math.min(1,dt/(e.calm?.4:.12))*(1-sm((dt-.15)/1.2));blob(x,y,R,c,(e.calm?.36:.7)*b);if(e.calm)continue;blob(x,y,R*.42,lift(c,.3),.8*b);
    if(dt<.15){const a=k*(1-dt/.15);blob(x,y,full?64:40,WHITE,a);blob(x,y,full?20:14,WHITE,a)}
    // Column: shoots up in 0.18 s, holds to 0.15 s and fades by 0.65 s; tall enough to clear the roofs in front of a
    // hidden pad. An air halo around its lower third stays at the pad's depth, so nearer buildings still cover it.
    if(dt<.9)blob(x,y-(full?70:40),full?75:50,c,.4*k*Math.min(1,dt/.1)*(1-sm(dt/.9)),1);
    if(dt<.65){const h=(full?150:90)*sm(dt/.18),a=k*(1-sm((dt-.15)/.5));for(const [w,cc,o] of [[11,c,.6],[3.5,WHITE,.95]]){const q=g.createLinearGradient(x,y,x,y-h);q.addColorStop(0,rgb(cc,o*a));q.addColorStop(1,rgb(cc,0));g.fillStyle=q;g.beginPath();g.moveTo(x-w,y);g.lineTo(x+w,y);g.lineTo(x+w*.35,y-h);g.lineTo(x-w*.35,y-h);g.closePath();g.fill()}}
    // Two thick rings 0.15 s apart, each with a bright core and a white outline. Each keeps its stroke profile while it
    // fades: chosen by its fading alpha, the core would turn from a hard band to a soft one as it passes .5.
    for(const o of [0,.15]){const age=dt-o;if(age<0||age>=1)continue;const r=8+(full?62:38)*(1-(1-age)**2),a=k*(1-age*age);for(const [w,cc,al,rr] of [[8,c,.45,1],[2.4,lift(c,.45),1,1],[.8,WHITE,.7,1.07]]){g.strokeStyle=rgb(cc,al*a);g.lineWidth=w;g.beginPath();g.ellipse(x,y,r*rr,r*rr/2,0,0,Math.PI*2);g.stroke(w>2&&al<.5?8:9)}}
    // Sparks fly out low with drag and fall back to the roof within 0.8 s.
    if(dt<.8){const D=(1-Math.exp(-3.2*dt))/3.2,a=k*(1-dt/.8);for(const s of e.sp){const z=Math.max(0,s[2]*dt-70*dt*dt),sx=x+s[0]*D,sy=y+s[1]*D-z;blob(sx,sy,3.2,c,.5*a);g.fillStyle=rgb(lift(c,.6),Math.min(1,a*1.4));g.beginPath();g.arc(sx,sy,.75,0,Math.PI*2);g.fill()}}
    // Delivery: the container opens with a small light burst that rises out of it.
    if(e.crate&&dt<.6){const a=k*(1-dt/.6),cy=y-3-dt*14;blob(x,cy,18,e.crate,.8*a);blob(x,cy,6,WHITE,a);g.strokeStyle=rgb(e.crate,.85*a);g.lineWidth=1;g.beginPath();for(let i=-2;i<=2;i++){const ang=-Math.PI/2+i*.38,l=6+12*sm(dt/.25);g.moveTo(x+Math.cos(ang)*4,cy+Math.sin(ang)*4);g.lineTo(x+Math.cos(ang)*l,cy+Math.sin(ang)*l)}g.stroke()}}
  landings=landings.filter(e=>now-e.t<1400&&(e.fade==null||now-e.fade<200));g.restore()}
// Descent light: over the last second the thrusters throw a growing cone onto the pad (full with cargo, half without).
function descentLight(f,px,by,z,col){if(still())return;const left=(1-f.phase/f.descentDuration)*f.descentDuration;if(left>=1)return;const k=Math.sqrt(sm(1-left))*(f.cargo===1?1:.5),P=f.to.p,top=by+z*.2,w=6+16*k;
  g.save();g.depth=(f.to.depth??-.96)-.000004;if(P[1]-top>1)for(const [ww,cc,o] of [[w,col,.6],[w*.35,WHITE,.8]]){const q=g.createLinearGradient(px,P[1],px,top);q.addColorStop(0,rgb(cc,o*k));q.addColorStop(1,rgb(cc,0));g.fillStyle=q;g.beginPath();g.moveTo(px-z*.1,top);g.lineTo(px+z*.1,top);g.lineTo(px+ww,P[1]);g.lineTo(px-ww,P[1]);g.closePath();g.fill()}
  blob(px,P[1],10+30*k,col,.9*k);blob(px,P[1],4+8*k,WHITE,.9*k);g.restore()}
const glyphQ=()=>{g.arc(0,-6,9,-Math.PI*.95,Math.PI*.32);g.lineTo(0,6);g.moveTo(0,14);g.lineTo(0,14.2)},
  glyphS=()=>{for(let i=0;i<=8;i++){const a=Math.PI/8+i*Math.PI/4;g[i?'lineTo':'moveTo'](Math.cos(a)*16,Math.sin(a)*16)}g.moveTo(-8,0);g.lineTo(8,0)};
function drawAlerts(now){g.save();g.globalCompositeOperation='lighter';g.lineCap='round';g.lineJoin='round';let n=0;
  for(const E of live.alerts.entries.values()){const hub=E.demoHub||machines.get(E.src)?.stages.get(E.stage)?.hub,kp=hub?.lot?.pad;if(!kp)continue;n++;
    // The tower's own colour; the glyph tells a question from a blocker. It stands on the hub's sign, so no sign covers it, at
    // its world size, which stops shrinking where it would turn unreadable from afar; without a sign, over the pad.
    const ask=E.items.some(q=>q.kind==='QUESTION'),col=hexRgb(live.gpu.hubs.colour(cityProject(hub.machine,hub.stage)?.colour))||[70,235,255],up=Math.min(1,(now-E.t0)/520),v=live.cameraView(),px=Math.max(cv.clientWidth/live.gpu.scene.w,cv.clientHeight/live.gpu.scene.h)*v.z,sign=hub.sign,y=kp.p[1],x=(sign?sign.x/px+v.x:kp.p[0])+Math.sin(now/4300+n)*.6/Math.max(1,v.z),cy=(sign?(sign.top-sign.icon/2)/px+v.y:y-50)+Math.sin(now/2800+n)*1.2/Math.max(1,v.z),s=sign?sign.icon/px/52:1,fl=.88+.12*Math.sin(now/3400+n);const w=live.world(x,cy);E.screen=P(w.x,w.y);E.radius=Math.max(16,30*unit()/live.city.scale/live.factor);
    const q=g.createLinearGradient(0,y,0,cy);q.addColorStop(0,rgb(col,.34*up));q.addColorStop(1,rgb(col,0));g.fillStyle=q;g.beginPath();g.moveTo(kp.p[0]-5,y);g.lineTo(kp.p[0]+5,y);g.lineTo(x+19*s,cy);g.lineTo(x-19*s,cy);g.closePath();g.fill();
    g.strokeStyle=rgb(col,.6*up);g.lineWidth=1;g.beginPath();g.ellipse(kp.p[0],y,9,4.5,0,0,7);g.stroke();
    g.save();g.translate(x,cy);g.scale(s,s*up);
    g.strokeStyle=rgb(col,.6*fl);g.lineWidth=2;const a=now/900;g.beginPath();g.ellipse(0,1,25,8,0,a,a+4.5);g.stroke();
    for(const [w,o] of [[13,.16],[8,.36],[4.4,.98]]){g.strokeStyle=o>.9?rgb(col.map(c=>Math.min(255,c+95)),fl):rgb(col,o*fl);g.lineWidth=w;g.beginPath();(ask?glyphQ:glyphS)();g.stroke()}
    g.restore()}
  g.restore()}

// Test stand (panel=1, demo=celebration): virtual cabs made in the page, never in the journal or the hub home. They fly
// through the same launch, caps and queue as real cabs; reset (and a reload) removes them and their queued trips.
// Two types, so they read as different cabs; the page lists them with the real ones.
const demoCabs=new Map(),DEMO_CABS=2;let demoPatrol=false;
// Demo framing flies to its box: 1.2-3.2 s by distance, smootherstep, pulling back a little on a long hop. A hand gesture or
// a second glide takes over from wherever the camera is. Reduced motion: at once.
let glide=null;
function glideTo(pts,now=performance.now()){const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]),x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys),base=Math.max(W/1800,H/780),from={x:cam.x,y:cam.y,z:cam.z};
  const here=live.cameraView(),seen=base*cam.z,gone=Math.hypot(here.x+W/seen/2-(x0+x1)/2,here.y+H/seen/2-(y0+y1)/2);
  cam.z=Math.min(4,Math.max(1,Math.min(W/(x1-x0+130),H/(y1-y0+110))/base));const v=live.cameraView(),k=base*cam.z,s=live.city.scale*live.factor;cam.x+=((x0+x1)/2-W/k/2-v.x)/s;cam.y+=((y0+y1)/2-H/k/2-v.y)/s;live.clampCamera(true);
  const to={x:cam.x,y:cam.y,z:cam.z};Object.assign(cam,{x:from.x,y:from.y,z:from.z,tx:from.x,ty:from.y,tz:from.z});manual=true;
  const ms=still()?1:Math.max(1200,Math.min(3200,900+gone*2.6));glide={t:now,ms,from,to,dip:Math.min(.4,gone/1500)};return ms}
function stepGlide(now){if(!glide)return;const t=Math.min(1,(now-glide.t)/glide.ms),e=t*t*t*(t*(6*t-15)+10),{from:a,to:b}=glide,mix=(p,q)=>p+(q-p)*e;
  cam.x=mix(a.x,b.x);cam.y=mix(a.y,b.y);cam.z=Math.max(1,mix(a.z,b.z)*(1-glide.dip*Math.sin(Math.PI*e)));cam.tx=cam.x;cam.ty=cam.y;cam.tz=cam.z;if(t>=1)glide=null}
function demoSource(project){for(const [src,m] of machines){const p=m.cityData?.projects?.find(q=>q===project||q.id===(project?.id??project));if(p)return{src,p,T:territory(src,p)}}return{}}
function demoCabsFor(project){const {src,p,T}=demoSource(project);if(!T)return null;let fresh=false;
  for(let i=0;i<DEMO_CABS;i++){const key=`demo|${T.id}|${i}`;if(!demoCabs.has(key)){fresh=true;demoCabs.set(key,{key,kind:'cab',label:`${p.id} ${i+1}`,role:`${p.id} ${i+1}`,stage:p.stages?.[0]||'',machine:src,home:{district:p.zone},engine:i?'codex':'claude',model:i?'haiku':'sonnet',working:demoPatrol,demo:true,T})}}
  return{src,p,T,fresh}}
// Target kinds: project, the territory's slot farthest from its main tower; owner, the owner tower; neighbour, the main tower
// of the nearest other territory.
function demoTarget(T,kind){const m=mainOf(T);if(kind==='owner')return{pad:owner,owner:true};
  if(kind==='project'){const far=T.slots.slice().sort((a,b)=>D2(b.g,m.g)-D2(a.g,m.g))[0];return{pad:far||m,T}}
  let best=null;for(const [src,mm] of machines)for(const q of mm.cityData?.projects||[]){const U=territory(src,q);if(!U||U.id===T.id)continue;const e=D2(mainOf(U).g,m.g);if(!best||e<best.e)best={e,pad:mainOf(U),T:U}}
  return best&&{pad:best.pad,T:best.T}}
function demoDeliver(project,kind,now=performance.now()){const s=demoCabsFor(project),to=s&&demoTarget(s.T,kind);if(!to)return null;
  const job={kind:'delivery',d:s.T.main.d,src:s.src,stage:s.p.stages?.[0],T:s.T,to,owner:!!to.owner,t:now,demo:true,target:kind};
  // Cabs made this click take off from the queue next frame, once they stand on their pads.
  if(s.fresh||!launch(job,now)){if(!s.fresh)live.overflow++;if(queue.length<24){queue.push(job);queue.sort((a,b)=>b.owner-a.owner||a.t-b.t)}}return job}
const demo={
  cabs:demoCabsFor,deliver:demoDeliver,target:demoTarget,list:()=>[...demoCabs.values()],
  event(project,kind='merge',now=performance.now()){if(!demoCabsFor(project))return false;dispatchEvent(project,kind,now,true);return true},
  patrol(project,on=!demoPatrol){demoPatrol=on;if(project)demoCabsFor(project);for(const c of demoCabs.values())c.working=on;return on},
  reset(){demoCabs.clear();demoPatrol=false;for(let i=queue.length-1;i>=0;i--)if(queue[i].demo)queue.splice(i,1);for(let i=fl.length-1;i>=0;i--)if(fl[i].demo){freeSlot(fl[i]);fl.splice(i,1)}},
  counts(){return{cargo:fl.filter(f=>f.cargo).length,max:live.config.maxFlights,queue:queue.length,overflow:live.overflow,cabs:fl.filter(f=>f.demo).length,patrol:demoPatrol}}};
function update(now,dt){
 response.update(now);
 if((response.stats.demo&&!responseFramed||response.stats.frame)&&response.events.length&&response.events.every(e=>e.route)){
  const sites=response.smokeSites;
  if(sites.length){
   responseFramed=true;response.stats.frame=false;
   glideTo([...response.events.flatMap(e=>e.route.points),...sites.flatMap(s=>[[s.p[0]-s.severity.width/2,s.p[1]-s.severity.height],[s.p[0]+s.severity.width/2,s.p[1]]])],now);
  }
 }

 const pts=celebrations.takeFrame();if(pts){
  // Demo only: frame the celebrating district, as the capture demo does.
  glideTo(pts,now);
 }
 stepGlide(now);
 for(let i=0;i<N;i++)heat[i]=live.model.heat(C.names[i].toLowerCase());
 const seen=new Set();for(const c of [...cabs.values(),...demoCabs.values()]){seen.add(c.key);let f=fl.find(q=>q.key===c.key);const d=Math.max(0,C.names.indexOf((c.home?.district||'core').toUpperCase())),kind=(/claude/i.test(c.engine||'')?3:0)+modelTier(c.model);
 const T=c.T||territory(c.machine,cityProject(c.machine,c.stage));
 if(!f){const h=T&&T.home[live.rand()*T.home.length|0];f=mkRaw(d,kind,h||anyPad(d));f.real=true;f.demo=!!c.demo;f.worker=c;f.key=c.key;f.role=c.label;f.T=T;placeAt(f,slotFor(f,h?toward(h,T):f.at));if(T&&atHome(f))f.homePad=f.slot.par;fl.push(f);}
 if(!f.cargo)f.T=T||null;
 if(kind!==f.kind&&f.state==='park'){freeSlot(f);f.kind=kind;placeAt(f,slotFor(f,f.T?homeTarget(f):f.at));}
 if(f.waiting)placeAt(f,slotFor(f,f.T?homeTarget(f):f.at));f.stage=c.stage;f.machine=c.machine;f.work=!!c.working;f.leave=!!c.leaving;if(!f.leave)f.gone=false;
 }
 for(const f of fl)if(f.real&&!seen.has(f.key)){f.leave=true;if(f.state==='park'){freeSlot(f);f.gone=true;}}
 for(let i=0;i<queue.length;){const j=queue[i];if(launch(j,now))queue.splice(i,1);else if(now-j.t>30000){spark(j.d,now);queue.splice(i,1)}else i++}
 rings=rings.filter(r=>now-r.t<1000);sparks=sparks.filter(s=>now-s.t<s.life);moveCars(dt);roadCounts.fill(0);for(const c of cars)roadCounts[RD[c.r].gpuId]++;live.gpu.updateRoadTraffic(roadCounts,dt);stepFlyers(now,dt);live.updateWindows(now,dt,heat);celebrations.update(now);flare*=Math.pow(.5,dt/1.3);
 districtWork.update(now);
 for(const f of fl)if(f.worker){const p=live.world(f.x,f.y,f.z);f.worker.px=f.worker.x;f.worker.py=f.worker.y;Object.assign(f.worker,p);f.worker.aquarium=f;}
}
function draw(now){g=live.gpu.painter;g.reset();g.depth=.915;drawCars();g.globalCompositeOperation='source-over';drawPads(now);const calm=still();for(const r of rings){const age=(now-r.t)/1000;if(age<0||age>1)continue;const R=calm?(r.big?24:12):8+age*(r.big?64:30),c=roofColour(r.x,r.y,tint[r.d]),a=r.big?.85:.45;g.depth=(r.depth??(r.depth=live.gpu.roofDepth(r.x,r.y)))-.000003;const q=g.createRadialGradient(r.x,r.y,0,r.x,r.y,R);q.addColorStop(0,rgb(c,a*(1-age)));q.addColorStop(1,rgb(c,0));g.fillStyle=q;g.beginPath();g.ellipse(r.x,r.y,R,R*.5,0,0,Math.PI*2);g.fill();
  if(r.big){g.strokeStyle=rgb(c,.8*(1-age));g.lineWidth=1.4;g.beginPath();g.ellipse(r.x,r.y,R*1.05,R*.525,0,0,Math.PI*2);g.stroke();if(!calm&&age<.3){const k=1-age/.3,w=g.createRadialGradient(r.x,r.y,0,r.x,r.y,20);w.addColorStop(0,rgb([255,250,235],.95*k));w.addColorStop(1,rgb([255,250,235],0));g.fillStyle=w;g.beginPath();g.ellipse(r.x,r.y,20,10,0,0,Math.PI*2);g.fill();}}}drawBolts(now);g.depth=-.98;drawBeams(now);drawLandings(now);drawAlerts(now);for(const f of fl.slice().sort((a,b)=>(a.y-a.z)-(b.y-b.z)))drawFlyer(f,now);response.draw(now);celebrations.draw(now);districtWork.draw(now);live.gpu.render(now,live.cameraView());}
function names(){const g=ctx;live.transform();g.globalCompositeOperation='source-over';g.font=`600 ${13/Math.sqrt(cam.z)}px ui-monospace,Menlo,monospace`;g.textAlign='center';for(let i=1;i<N;i++){const p=mainPad[i];if(p){g.fillStyle=rgb(tint[i],.42);g.fillText(C.names[i],p.p[0],Math.max(14,p.p[1]-10));}}ctx.restore();}
function worker(){}
function clear(){response.clear();queue.length=0;bolts=[];beams=[];landings=[];heat.fill(0);sparks=[];rings=[];flare=0;for(const f of fl){f.cargo=0;f.trail=[];f.pendingFlight=null;f.state='park';placeAt(f,f.slot||slotFor(f,f.at));}live.pulses=[];}
return{response,celebrations,demo,glideTo,stopGlide(){glide=null},roofColour,update,draw,names,worker,dispatch,dispatchEvent,territory,queue,clear,fl,heat,byD,owner,mainPad,cars,LP,LPD,slotFor,go,arrive,stepFlyers,beam,get sparks(){return sparks},get rings(){return rings},get bolts(){return bolts},get beams(){return beams},get landings(){return landings}};
}
