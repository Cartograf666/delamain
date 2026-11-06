// Short, opt-in capture response. Source plot IDs never double as building IDs.
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const mix=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const metric=(a,b)=>Math.hypot(a[0]-b[0],2*(a[1]-b[1]));
const cross=(a,b)=>a[0]*b[1]-a[1]*b[0];
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1]];
const rgba=(c,a)=>[...c.map(v=>v/255),a];
// A complete red/blue cycle is 1.6 s; reduced motion keeps both lamps steady.
// One discrete state drives lamps, pavement, receiving walls and water together.
export function responseBeacon(now,index=0,reduced=false){
 if(reduced)return {color:[158.5,106.5,156],red:.65,blue:.65};
 const blue=(Math.floor(now/800+index*.5)%2+2)%2===1;
 return {color:blue?[62,143,255]:[255,70,57],red:blue?.08:1,blue:blue?1:.08};
}
const validCapture=c=>Number.isInteger(c?.plotId)&&typeof c.from==='string'&&!!c.from&&typeof c.to==='string'&&!!c.to&&c.from!==c.to;
const LIFE=19000,OUT=2200,MAX_EVENTS=3,STORE='delamain:capture-response:v1';
export const CAPTURE_DEMO=Object.freeze({date:'2026-11-02',aggressiveCaptures:[2799,2803,2770].map(plotId=>Object.freeze({plotId,from:'Telegram',to:'Куда за музыкой'}))});
function intersection(a,b,c,d){const r=sub(b,a),s=sub(d,c),den=cross(r,s);if(Math.abs(den)<1e-9)return null;const q=sub(c,a),t=cross(q,s)/den,u=cross(q,r)/den;return t>=-1e-7&&t<=1+1e-7&&u>=-1e-7&&u<=1+1e-7?[clamp(t),clamp(u)]:null;}
function nearest(p,a,b){const d=sub(b,a),t=clamp(((p[0]-a[0])*d[0]+(p[1]-a[1])*d[1])/(d[0]*d[0]+d[1]*d[1]||1));return {p:mix(a,b,t),t};}

// Split the actual rendered polylines at exact junctions, including T junctions.
// No rounded coordinate buckets, synthetic connectors or straight-line shortcuts.
export function createRoadRouter(roads){
 const segments=[];
 for(const road of roads)for(let i=1;i<road.p.length;i++){
  const a=road.p[i-1],b=road.p[i];if(dist(a,b)<1e-5)continue;
  segments.push({a,b,road:road.gpuId,ts:[0,1],box:[Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.max(a[0],b[0]),Math.max(a[1],b[1])]});
 }
 const bins=new Map(),pairs=new Set();
 for(let i=0;i<segments.length;i++){const a=segments[i],A=a.box;
  for(let x=Math.floor(A[0]/32);x<=Math.floor(A[2]/32);x++)for(let y=Math.floor(A[1]/32);y<=Math.floor(A[3]/32);y++){
   const key=`${x},${y}`,others=bins.get(key)||[];
   for(const j of others){const pair=`${j},${i}`;if(pairs.has(pair))continue;pairs.add(pair);const b=segments[j],B=b.box;
    if(A[2]<B[0]-1e-7||B[2]<A[0]-1e-7||A[3]<B[1]-1e-7||B[3]<A[1]-1e-7)continue;
    const hit=intersection(a.a,a.b,b.a,b.b);if(hit){a.ts.push(hit[0]);b.ts.push(hit[1]);}
    else for(const [p,t]of [[a.a,0],[a.b,1]]){const n=nearest(p,b.a,b.b);if(dist(p,n.p)<1e-7){a.ts.push(t);b.ts.push(n.t);}}
   }others.push(i);bins.set(key,others);
  }
 }
 const nodes=[],edges=[],ids=new Map();
 function node(p){const key=p.map(v=>Math.round(v*1e5)).join(',');if(ids.has(key))return ids.get(key);const id=nodes.length;nodes.push({p,edges:[]});ids.set(key,id);return id;}
 for(const s of segments){const ts=[...new Set(s.ts)].sort((a,b)=>a-b);for(let i=1;i<ts.length;i++){const a=node(mix(s.a,s.b,ts[i-1])),b=node(mix(s.a,s.b,ts[i]));if(a===b)continue;const e={a,b,road:s.road,len:dist(nodes[a].p,nodes[b].p)};edges.push(e);nodes[a].edges.push(e);nodes[b].edges.push(e);}}
 function route(target){
  let finish=null,best=Infinity;
  for(const edge of edges){const n=nearest(target,nodes[edge.a].p,nodes[edge.b].p),d=metric(target,n.p);if(d<best){best=d;finish={edge,...n};}}
  if(!finish||best>38)return null;
  const ds=new Float64Array(nodes.length).fill(Infinity),next=new Map(),heap=[];
  const push=(id,d)=>{let i=heap.length;heap.push([id,d]);while(i){const p=(i-1)>>1;if(heap[p][1]<=d)break;heap[i]=heap[p];i=p;}heap[i]=[id,d];};
  const pop=()=>{const first=heap[0],last=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let k=i*2+1;if(k+1<heap.length&&heap[k+1][1]<heap[k][1])k++;if(heap[k][1]>=last[1])break;heap[i]=heap[k];i=k;}heap[i]=last;}return first;};
  for(const id of [finish.edge.a,finish.edge.b]){ds[id]=dist(nodes[id].p,finish.p);next.set(id,{to:-1,road:finish.edge.road});push(id,ds[id]);}
  // Bounded Dijkstra from the destination; choose an approach ~170 world pixels long.
  let start=-1,score=Infinity;
  while(heap.length){const [id,d]=pop();if(d!==ds[id])continue;if(d>240)break;
   if(d>=100&&Math.abs(d-170)<score){start=id;score=Math.abs(d-170);}
   for(const e of nodes[id].edges){const to=e.a===id?e.b:e.a,cost=d+e.len;if(cost<ds[to]){ds[to]=cost;next.set(to,{to:id,road:e.road});push(to,cost);}}
  }
  if(start<0)return null;
  const points=[nodes[start].p],roadIds=[];let id=start;
  while(id!==-1){const n=next.get(id);if(!n)return null;roadIds.push(n.road);points.push(n.to===-1?finish.p:nodes[n.to].p);id=n.to;}
  const cum=[0];for(let i=1;i<points.length;i++)cum.push(cum[i-1]+dist(points[i-1],points[i]));
  return {points,cum,roadIds,length:cum.at(-1),destination:finish.p,distanceToLot:best};
 }
 return {route,nodes,edges};
}
export function sampleRoute(route,s){s=clamp(s,0,route.length);let i=1;while(i<route.cum.length-1&&route.cum[i]<s)i++;return mix(route.points[i-1],route.points[i],(s-route.cum[i-1])/(route.cum[i]-route.cum[i-1]||1));}

// Severity comes from distinct actual captures in one from/to/date group, not frame rate.
export function captureSeverity(count){
 const n=Math.max(1,Math.floor(count)),size=Math.min(1,Math.log2(n)/4);
 return {count:n,sites:Math.min(6,n),width:38+56*size,height:94+80*size};
}
// A fire is light from inside a building: lower-floor windows and ground-floor openings glow, never roof flames.
const FIRE=[255,98,32],HOT=[255,168,64],CORE=[255,238,184];
const fract=x=>x-Math.floor(x),hash=n=>fract(Math.sin(n*127.1+311.7)*43758.5453);
function valueNoise(x,seed){const i=Math.floor(x),f=x-i,u=f*f*(3-2*f);return hash(i+seed*17.31)*(1-u)+hash(i+1+seed*17.31)*u;}
// Living light: three incommensurate sines plus low-passed value noise, weights summing to one, so the factor stays
// within 1±0.2 and its fastest component is 2.03 Hz: never a strobe. Reduced motion keeps it steady at 1.
export function fireFlicker(now,seed=0,reduced=false){
 if(reduced)return 1;const t=now/1000,w=2*Math.PI;
 return 1+.2*(.36*Math.sin(w*.61*t+seed)+.24*Math.sin(w*1.17*t+seed*2.3)+.14*Math.sin(w*2.03*t+seed*4.1)+.26*(2*valueNoise(t*1.3,seed)-1));
}
// Hot spots on a building's street walls: two per wall, cycling through three lower floors (ground-floor openings are
// wider), so every burning building shows at least three at different heights. The lower part is at most 14 units
// tall, so a tower burns at its foot. Units are wall parameters [0,1].
const FLOORS=[.03,.27,.5];
export const fireLower=height=>Math.min(height,14);
export function fireHotSpots(building,seed=0){
 const walls=(building?.surfaces||[]).filter(f=>f.kind==='wall'),spots=[];if(!walls.length)return spots;
 const n=Math.max(3,walls.length*2),per=Math.ceil(n/walls.length);
 for(let k=0;k<n;k++){const wall=walls[k%walls.length],[a,b,c]=wall.points,len=metric(a,b)||1,height=Math.max(.5,b[1]-c[1]),lower=fireLower(height),floor=k%FLOORS.length,ground=floor===0;
  const v0=FLOORS[floor]*lower/height,v1=Math.min(.95,v0+(ground?.21:.17)*lower/height);
  spots.push({wall,floor,ground,u:clamp((Math.floor(k/walls.length)+.5+(hash(seed+k)-.5)*.4)/per,.2,.8),du:Math.min(.2,clamp(len*(ground?.13:.09),.45,3)/len),v0,v1,seed:hash(seed*3.1+k)*6.283});
 }
 return spots;
}
// Wall parameter (u along the base, v up the wall) to a point of that wall.
export function wallPoint(wall,u,v){const [a,b,c,d]=wall.points;return mix(mix(a,b,u),mix(d,c,u),v);}
// Embers in closed form, no per-frame state: each hot spot emits up to three a second, each lives 1.8 s, rising and
// drifting; the per-spot rate drops so that no more than `budget` are alive on the whole map.
export const EMBER_BUDGET=150,EMBER_LIFE=1.8;
export function fireEmbers(spots,now,{budget=EMBER_BUDGET,reduced=false}={}){
 const out=[];if(reduced||!spots.length)return out;
 const rate=Math.min(3,budget/(spots.length*EMBER_LIFE)),t=now/1000;
 for(let j=0;j<spots.length;j++){const s=spots[j];
  for(let n=Math.ceil((t-EMBER_LIFE)*rate);n<=Math.floor(t*rate);n++){
   const h=hash(n*.37+s.seed*13.1),h2=hash(n*1.91+s.seed*3.7),age=t-(n+.5*h)/rate;if(age<0||age>=EMBER_LIFE)continue;
   if(out.length>=budget)return out;const k=age/EMBER_LIFE;
   out.push({spot:j,x:s.p[0]+(h-.5)*s.w+Math.sin(age*2.3+h*6.3)*.9*k+1.6*k*k,y:s.p[1]-age*(3.5+3.5*h2),alpha:(1-k)**1.5*Math.min(1,age*8),r:.22+.2*h2});
  }
 }
 return out;
}

export function createCaptureGate(storage){
 let memory=new Set(),available=!!storage;
 function read(){try{const data=JSON.parse(storage.getItem(STORE)||'[]');if(!Array.isArray(data))throw Error('Bad receipt');memory=new Set(data.filter(k=>typeof k==='string'));}catch{available=false;}}
 if(available)read();
 return {take(snapshot,{visible,today}){
  if(!visible||!snapshot||snapshot.date!==today||!/^\d{4}-\d{2}-\d{2}$/.test(today))return [];
  if(available)read();
  const result=[];
  for(const c of Array.isArray(snapshot.aggressiveCaptures)?snapshot.aggressiveCaptures:[]){
   if(!validCapture(c))continue;
   const key=JSON.stringify([snapshot.date,c.plotId,c.from,c.to]);if(memory.has(key))continue;memory.add(key);result.push(c);
  }
  if(result.length&&available)try{storage.setItem(STORE,JSON.stringify([...memory]));}catch{available=false;}
  return result;
 }};
}

// A wall receives light according to its ground-facing normal and clear line of sight.
// Lighting is drawn at the receiving wall depth, independently of source visibility.
export function createResponseLighting(buildings){
 const buckets=new Map(),cell=64;
 const records=buildings.map(b=>{
  const walls=b.surfaces.filter(f=>f.kind==='wall'),edges=walls.map(w=>w.points.slice(0,2));
  for(const roof of b.surfaces.filter(f=>f.kind==='roof')){const wall=walls.find(w=>roof.points.some(p=>dist(p,w.points[2])<.02));if(wall){const h=wall.points[1][1]-wall.points[2][1],q=roof.points.map(p=>[p[0],p[1]+h]);q.forEach((p,i)=>edges.push([p,q[(i+1)%q.length]]));}}
  return {b,walls,edges};
 });
 for(const r of records){const ps=r.edges.flat();if(!ps.length)continue;const xs=ps.map(p=>p[0]),ys=ps.map(p=>p[1]*2);for(let x=Math.floor(Math.min(...xs)/cell);x<=Math.floor(Math.max(...xs)/cell);x++)for(let y=Math.floor(Math.min(...ys)/cell);y<=Math.floor(Math.max(...ys)/cell);y++){const key=`${x},${y}`;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(r);}}
 return function wallsAt(source,radius=46){
  const nearby=new Set(),out=[];
  for(let x=Math.floor((source[0]-radius)/cell);x<=Math.floor((source[0]+radius)/cell);x++)for(let y=Math.floor((source[1]*2-radius)/cell);y<=Math.floor((source[1]*2+radius)/cell);y++)for(const r of buckets.get(`${x},${y}`)||[])nearby.add(r);
  for(const r of nearby)for(const f of r.walls){
   const [a,b,c,d]=f.points,mid=mix(a,b,.5),edge=[b[0]-a[0],2*(b[1]-a[1])];let normal=[-edge[1],edge[0]];
   if(normal[0]*(mid[0]-r.b.ground[0])+normal[1]*2*(mid[1]-r.b.ground[1])<0)normal=normal.map(v=>-v);
   const toward=[source[0]-mid[0],2*(source[1]-mid[1])],cos=(normal[0]*toward[0]+normal[1]*toward[1])/(Math.hypot(...normal)*Math.hypot(...toward)||1);if(cos<=0)continue;
   const gain=p=>{const t=metric(source,p)/radius;if(t>=1)return 0;for(const other of nearby)if(other!==r&&other.edges.some(([a,b])=>{const hit=intersection(source,p,a,b);return hit&&hit[0]>.001&&hit[0]<.999;}))return 0;return (1-t)**2*(.3+.7*cos);};
   const n=Math.max(1,Math.ceil(metric(a,b)/4));
   for(let i=0;i<n;i++){const A=mix(a,b,i/n),B=mix(a,b,(i+1)/n),ga=gain(A),gb=gain(B);if(!ga&&!gb)continue;
    const height=Math.min(15,b[1]-c[1]);out.push({buildingId:r.b.id,layer:f.layer,points:[A,B,[B[0],B[1]-height],[A[0],A[1]-height]],gains:[ga,gb,gb,ga]});}
  }
  return out;
 };
}

export function createCaptureResponse(live,{roads,water,search=globalThis.location?.search||'',storage,day,reduce}={}){
 const gpu=live.gpu,demo=new URLSearchParams(search).get('demo')==='capture';
 if(storage===undefined&&!demo)try{storage=globalThis.localStorage;}catch{}
 const gate=createCaptureGate(demo?null:storage),motion=reduce||globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')||{matches:false};
 const today=day||(()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;});
 let router=null,wallsAt=null,events=[],demoPlayed=false,lastDate=null,lastSnapshot=null,lastCaptures=null,worker=null,request=0,queued=[];const pending=new Map(),groups=new Map();
 const stats={batches:0,started:0,demo,skipped:0,routingMs:[],setupMs:[]};
 function routing(e){
  if(typeof globalThis.Worker!=='function'){router??=createRoadRouter(roads);e.route=router.route(e.plot.ground);if(!e.route)stats.skipped++;return;}
  try{
   const fresh=!worker;if(fresh){worker=new Worker(new URL('./capture-router-worker.js',import.meta.url),{type:'module'});
    worker.onmessage=({data})=>{const e=pending.get(data.id);pending.delete(data.id);stats.routingMs.push(data.ms);if(e&&events.includes(e)){e.route=data.route;if(!e.route)stats.skipped++;}};
    worker.onerror=()=>{stats.skipped+=pending.size;pending.clear();worker.terminate();worker=null;};
   }
   const id=++request;pending.set(id,e);worker.postMessage({id,roads:fresh?roads:undefined,target:e.plot.ground});
  }catch{pending.clear();stats.skipped++;}
 }

 function start({capture:c,group},now){
  const plot=gpu.growth.plots.get(c.plotId);if(!plot)return null;
  const building=gpu.growth.buildings.get(plot.building);
  wallsAt??=createResponseLighting(gpu.scene.buildings);
  return {capture:c,group,plot,building,route:null,born:now,vehicles:[],reduced:motion.matches};
 }
 function update(now){
  const snapshot=gpu.growth.snapshot,date=snapshot?.date;
  if(!live.districtsVisible){events=[];queued=[];water([]);lastSnapshot=null;lastCaptures=null;return;}
  if(lastDate!==date){events=[];queued=[];groups.clear();lastDate=date;}
  const signature=JSON.stringify(snapshot?.aggressiveCaptures||[]),changed=snapshot!==lastSnapshot||signature!==lastCaptures;let batch=[];
  if(demo&&!demoPlayed&&snapshot){demoPlayed=true;batch=CAPTURE_DEMO.aggressiveCaptures;}
  else if(!demo&&changed)batch=gate.take(snapshot,{visible:true,today:today()});
  lastSnapshot=snapshot;lastCaptures=signature;
  const groupDate=demo?CAPTURE_DEMO.date:date,groupKey=c=>JSON.stringify([groupDate,c.from,c.to]);
  if(changed||batch.length){
   const counts=new Map(),source=demo?CAPTURE_DEMO.aggressiveCaptures:snapshot?.aggressiveCaptures;
   for(const c of Array.isArray(source)?source:[]){if(!validCapture(c))continue;const key=groupKey(c);if(!counts.has(key))counts.set(key,{capture:c,ids:new Set()});counts.get(key).ids.add(c.plotId);}
   for(const [key,{capture:c,ids}]of counts){if(!groups.has(key))groups.set(key,{key,date:groupDate,from:c.from,to:c.to});groups.get(key).plotIds=ids;}
  }
  // Receipts control which locations launch; severity always uses the full snapshot.
  if(batch.length){stats.batches++;for(const c of batch)queued.push({capture:c,group:groups.get(groupKey(c))});}
  events=events.filter(e=>now-e.born<LIFE&&now>=e.born&&!(e.ending&&now-e.ending>=OUT));
  while(queued.length&&events.length<MAX_EVENTS){const e=start(queued.shift(),now);if(e){events.push(e);stats.started++;const before=globalThis.performance?.now()||0;routing(e);stats.setupMs.push((globalThis.performance?.now()||0)-before);}}
  for(const e of events){const age=now-e.born;e.alpha=clamp(age/900)*clamp((LIFE-age)/OUT)*(e.ending?clamp(1-(now-e.ending)/OUT):1);if(!e.route)continue;
   // Reduced motion has steady stationary responders already at the roadside.
   for(let i=0;i<3;i++){const s=motion.matches?Math.max(0,e.route.length-i*6):clamp((age-1100)/1000*24-i*7,0,Math.max(0,e.route.length-i*6));const p=sampleRoute(e.route,s);const v=e.vehicles[i]||{};Object.assign(v,{p,s,arrived:s>=e.route.length-i*6-.01,index:i,alpha:e.alpha*clamp((age-1100-i*300)/700)});e.vehicles[i]=v;}
  }
 }
 function ellipse(g,p,rx,ry,c,a,z){g.depth=z;g.fillStyle=rgba(c,a);g.beginPath();g.ellipse(...p,rx,ry,0,0,Math.PI*2);g.fill();}
 function pool(g,p,rx,ry,c,a,z){g.save();g.depth=z;g.translate(...p);g.scale(rx,ry);const q=g.createRadialGradient(0,0,0,0,0,1);q.addColorStop(0,rgba(c,a));q.addColorStop(1,rgba(c,0));g.fillStyle=q;g.beginPath();g.arc(0,0,1,0,Math.PI*2);g.fill();g.restore();}
 let layerRows,fireStats=null;
 function smokeDepth(y){
  if(!layerRows)layerRows=gpu.scene.buildings.map(b=>[b.ground[1],Math.max(...b.surfaces.map(f=>f.layer))]).sort((a,b)=>a[0]-b[0]);
  let lo=0,hi=layerRows.length;while(lo<hi){const m=(lo+hi)>>1;if(layerRows[m][0]<=y)lo=m+1;else hi=m;}
  return gpu.depth(lo?layerRows[lo-1][1]+.5:0);
 }
// One fire per capture group: every plot of the group burns once any of its responders has a road, and keeps
 // burning while more of the group still queue, so a large capture stays one burning block.
 const fires=new Map();let sceneBuildings=null;
 function outward(b,wall,d){const [a,c]=wall.points,mid=mix(a,c,.5),e=[c[0]-a[0],2*(c[1]-a[1])];let n=[-e[1],e[0]];if(n[0]*(mid[0]-b.ground[0])+n[1]*2*(mid[1]-b.ground[1])<0)n=n.map(v=>-v);const l=Math.hypot(...n)||1;return [n[0]/l*d,n[1]/l*d/2];}
 function fireOf(group){
  let f=fires.get(group);if(f&&f.size===group.plotIds.size)return f;
  const severity=captureSeverity(group.plotIds.size),size=Math.min(1,Math.log2(severity.count)/4),plots=[];
  for(const id of group.plotIds){const plot=gpu.growth.plots.get(id);if(!plot)continue;sceneBuildings??=new Map(gpu.scene.buildings.map(b=>[b.id,b]));const b=sceneBuildings.get(plot.building),walls=(b?.surfaces||[]).filter(f=>f.kind==='wall');
   plots.push({id,plot,b:walls.length?b:null,rank:plots.length,spots:walls.length?fireHotSpots(b,id):[],walls:walls.map(w=>{const n=outward(b,w,2.5),m=mix(w.points[0],w.points[1],.5);return {w,src:[m[0]+n[0],m[1]+n[1]],o:outward(b,w,7.5)};}),top:walls.length?Math.max(...b.surfaces.map(f=>f.layer)):null});}
  f={size:group.plotIds.size,severity,scale:size,plots,born:f?.born};fires.set(group,f);return f;
 }
 function burning(now){
  const out=new Map();
  for(const e of events){if(!e.route||!e.group)continue;const f=fireOf(e.group);f.born??=e.born;const b=out.get(f)||{fire:f,group:e.group,alpha:0,event:e};b.alpha=Math.max(b.alpha,e.alpha??0);out.set(f,b);}
  for(const b of out.values()){const age=now-b.fire.born;if(queued.some(q=>q.group===b.group))b.alpha=Math.max(b.alpha,clamp(age/900));b.age=age;}
  for(const [group,f] of fires)if(!out.has(f))fires.delete(group);
  return [...out.values()];
 }
 // Smoke rises from part of the burning buildings (1, 3, up to 6 by severity), starting up the facade.
 function smokeSites(now){
  const sites=[];
  for(const {fire:f,event}of burning(now)){const n=f.plots.length,count=Math.min(f.severity.sites,n);
   for(let i=0;i<count;i++){const q=f.plots[count<2?0:Math.round(i*(n-1)/(count-1))],ground=q.b?q.b.ground:q.plot.ground,top=q.b?Math.min(...q.walls.map(({w})=>gpu.growth.point(q.b.id,w.points[2])[1])):ground[1];
    const base=q.b?gpu.growth.point(q.b.id,ground):ground;sites.push({p:[base[0],base[1]-.6*(base[1]-top)],ground,plotId:q.id,severity:f.severity,event,rank:i});}
  }
  return sites.sort((a,b)=>a.ground[1]-b.ground[1]);
 }
 function glowFace(q,c,a){const bottom=mix(q[0],q[1],.5),top=mix(q[3],q[2],.5),grad=gpu.painter.createLinearGradient(...bottom,...top);grad.addColorStop(0,rgba(c,a));grad.addColorStop(1,rgba(c,0));const g=gpu.painter;g.fillStyle=grad;g.beginPath();q.forEach((p,i)=>i?g.lineTo(...p):g.moveTo(...p));g.closePath();g.fill();}
 function draw(now){
  const g=gpu.painter,waterSources=[],reduced=motion.matches,fireList=burning(now);g.save();
  g.globalCompositeOperation='source-over';
  for(const site of smokeSites(now)){
   const b=fireList.find(x=>x.event===site.event),alpha=b.alpha*(1-.45*clamp((b.age-10500)/6000));
   // Layers are ordered by ground y: the plume sits just in front of its burning building and behind the ones in front.
   g.depth=smokeDepth(site.ground[1]);
   g.smoke(...site.p,site.severity.width,site.severity.height,reduced?2.75:b.age/1000,site.plotId*.173+site.rank*2.31,.86*alpha,1);
  }
  g.globalCompositeOperation='lighter';
  // Fire light caught by the base of each plume, at the plume's depth.
  // Above nearby roofs the lit lower plume is what shows a fire hidden behind buildings.
  // Several plumes share the glow (1.5/sqrt(n)), so a large capture does not merge into one blazing mass above the roofs.
  for(const site of smokeSites(now)){const b=fireList.find(x=>x.event===site.event),k=b.alpha*fireFlicker(now,site.plotId,reduced)*Math.min(1,1.5/Math.sqrt(site.severity.sites)),{width:w,height:h}=site.severity,z=smokeDepth(site.ground[1]);
   pool(g,[site.p[0],site.p[1]-h*.08],w*.32,h*.11,HOT,.6*k,z);pool(g,[site.p[0]+w*.04,site.p[1]-h*.26],w*.24,h*.2,FIRE,.38*k,z);pool(g,[site.p[0]+w*.08,site.p[1]-h*.46],w*.2,h*.2,FIRE,.24*k,z);}
  const sparks=[];let stats={plots:0,spots:0,receivers:0,lit:0};
  // Lit facades are found once per light source, at most four per frame, so ignition never stalls a frame.
  const light=(x,src,radius)=>{if(!x.lit&&stats.lit<4){x.lit=wallsAt(src,radius);stats.lit++;}if(x.lit)receive(x.lit,x.k);};
  // Fire light on facades: bottom-up wash in the main pass and a matching glow face in the bloom pass, so a lit
  // facade reads at neon brightness. Each face sits at its own wall depth; nearer surfaces hide it.
  function receive(faces,k){stats.receivers+=faces.length;for(const face of faces){const q=face.points.map(p=>gpu.growth.point(face.buildingId,p));g.depth=gpu.depth(face.layer)-.000012;g.uplight(q,FIRE,2*k,face.gains);glowFace(q,FIRE,.75*k*(face.gains[0]+face.gains[1])/2);}}
  for(const {fire:f,alpha,age}of fireList){
   const xs=[],ys=[],gk=alpha*fireFlicker(now,f.size*.31,reduced);
   for(const q of f.plots){
    const k=alpha*clamp((age-q.rank*120)/1400)**1.5;if(k<=0)continue;stats.plots++;xs.push(q.plot.ground[0]);ys.push(q.plot.ground[1]);
    if(!q.b){
     // A vacant lot burns as glowing ground: three hot spots on it and its light on the facades around it.
     const c=q.plot.ground,fp=q.plot.footprint,fl=fireFlicker(now,q.id,reduced),z=.929;
     g.depth=z;g.fillStyle=rgba(FIRE,.5*k*fl);g.beginPath();fp.forEach((p,i)=>i?g.lineTo(...p):g.moveTo(...p));g.closePath();g.fill();
     pool(g,c,22+16*f.scale,11+8*f.scale,FIRE,.6*k*fl,z);
     for(const [i,p] of [c,mix(c,fp[0],.5),mix(c,fp[2],.5)].entries()){const fs=fireFlicker(now,q.id*3.7+i,reduced);stats.spots++;
      pool(g,p,5+3*f.scale,3+2*f.scale,HOT,.95*k*fs,z);ellipse(g,p,1.1,.6,CORE,.9*k*fs,z);sparks.push({p,w:2,seed:q.id*1.3+i,k,z:smokeDepth(c[1])});}
     q.k=k*fl;light(q,c,46+26*f.scale);
     continue;
    }
    const P=p=>gpu.growth.point(q.b.id,p),zTop=gpu.depth(q.top)-.00001;
    for(const x of q.walls){const {w,src,o}=x;
     const z=gpu.depth(w.layer)-.000012,zGround=(gpu.depth(w.layer)+gpu.depth(w.layer-1))/2,fl=fireFlicker(now,q.id+w.layer*.37,reduced),[a,b,c]=w.points,height=Math.max(.5,b[1]-c[1]),vw=Math.min(.75,.62*fireLower(height)/height);
     // Ground floor pours light up its own facade and out onto the street in front of it.
     const wash=[a,b,wallPoint(w,1,vw),wallPoint(w,0,vw)].map(P);g.depth=z;g.uplight(wash,FIRE,1.1*k*fl,[fl,2-fl,2-fl,fl].map(v=>clamp(v)));glowFace(wash,FIRE,.8*k*fl);
     g.depth=zGround;g.uplight([a,b,[b[0]+o[0],b[1]+o[1]],[a[0]+o[0],a[1]+o[1]]].map(P),FIRE,.8*k*fl);
     pool(g,P(src),20+16*f.scale,10+8*f.scale,FIRE,.6*k*fl,zGround);
     // Neighbouring facades facing this wall, with clear line of sight (the beacon receiver technique).
     x.k=k*fl;light(x,src,40+26*f.scale);
    }
    for(const s of q.spots){
     const fl=fireFlicker(now,s.seed,reduced),t=now/1000,sh=reduced?0:s.du*.3*Math.sin(2*Math.PI*1.7*t+s.seed),top=reduced?1:.75+.25*Math.sin(2*Math.PI*1.3*t+s.seed*2),z=gpu.depth(s.wall.layer)-.000014;stats.spots++;
     const quad=(du,v1)=>[wallPoint(s.wall,s.u-du,s.v0),wallPoint(s.wall,s.u+du,s.v0),wallPoint(s.wall,s.u+du+sh,v1),wallPoint(s.wall,s.u-du+sh,v1)].map(P);
     g.depth=z;g.uplight(quad(s.du,s.v1),HOT,1.3*k*fl,[1,1,top,2-top]);
     g.uplight(quad(s.du*.55,s.v0+(s.v1-s.v0)*.6),CORE,1.1*k*fl,[1,1,top,top]);
     const centre=P(wallPoint(s.wall,s.u,(s.v0+s.v1)/2));pool(g,centre,(s.ground?10:7.5)+5*f.scale,(s.ground?6.5:5.5)+3*f.scale,HOT,k*fl,z);
     sparks.push({p:P(wallPoint(s.wall,s.u,s.v1)),w:s.du*metric(...s.wall.points.slice(0,2)),seed:s.seed*7+q.id,k,z:zTop});
    }
   }
   // A large capture reads as one burning block: a broad warm wash over the streets between its plots.
   if(xs.length>=3)pool(g,[(Math.min(...xs)+Math.max(...xs))/2,(Math.min(...ys)+Math.max(...ys))/2],(Math.max(...xs)-Math.min(...xs))/2+30,(Math.max(...ys)-Math.min(...ys))/2+18,FIRE,.42*gk,.929);
  }
  const embers=fireEmbers(sparks,now,{reduced});for(const e of embers){const s=sparks[e.spot];ellipse(g,[e.x,e.y],e.r,e.r,CORE,e.alpha*s.k,s.z);}
  stats.embers=embers.length;fireStats=stats;
  for(const e of events){
   for(const v of e.vehicles){if(v.alpha<=0)continue;const p=v.p,beacon=responseBeacon(now,v.index,reduced);
    const red=[255,70,57],blue=[62,143,255],r=beacon.red,b=beacon.blue;
    const col=beacon.color,gain=v.alpha*(reduced?.72:1);
    pool(g,p,22,11,col,.55*gain,.929);
    if(!v.cachedAt||metric(v.cachedAt,p)>2){v.walls=wallsAt(p);v.cachedAt=p;}
    for(const face of v.walls){g.depth=gpu.depth(face.layer)-.000012;g.uplight(face.points.map(q=>gpu.growth.point(face.buildingId,q)),col,1.5*gain,face.gains);}
    waterSources.push({x:p[0],y:p[1],c:col.map(c=>c/255*gain*.7)});
    // Depth-correct body and twin beacons, never an always-on-top halo.
    ellipse(g,[p[0],p[1]-.8],2.5,1.25,[200,216,231],.7*gain,.915);
    const dx=1.55,dy=0;
    ellipse(g,[p[0]-dx,p[1]-.9-dy],1.15,.85,red,gain*r,.9149);
    ellipse(g,[p[0]+dx,p[1]-.9+dy],1.15,.85,blue,gain*b,.9149);
   }
  }
  g.restore();water(waterSources);
 }
 // Test stand: queue captures as one group (severity = its plot count); stats.frame asks the page to frame them.
 function play(captures,key){const group={key,demo:true,plotIds:new Set(captures.map(c=>c.plotId))};for(const c of captures)if(validCapture(c))queued.push({capture:c,group});stats.frame=true;return group.plotIds.size;}
 function clearDemo(){events=events.filter(e=>!e.group?.demo);queued=queued.filter(q=>!q.group?.demo);}
 // Puts a demo capture out: nothing more queues and what burns fades over OUT, where clearDemo would cut it.
 function extinguishDemo(now=globalThis.performance?.now()??0){queued=queued.filter(q=>!q.group?.demo);stats.frame=false;for(const e of events)if(e.group?.demo)e.ending??=now;}
 return {update,draw,clear(){events=[];queued=[];water([]);},play,clearDemo,extinguishDemo,roads,stats,get smokeSites(){return smokeSites(globalThis.performance?.now()??0);},get fireStats(){return fireStats;},get events(){return events;},get router(){return router;}};
}
