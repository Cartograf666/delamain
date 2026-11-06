// "Work is happening here": a project with working agents lights up from its main tower outwards, inside its own territory
// (its plots from plotOwners plus the main plot, as celebrations use). The level (0..3) sets how far and how much. Near the
// tower the scene's windows give way to a full grid on its facades, warm and some neon, trading places now and then; each
// lit window carries its own halo. Scattered lights along its roads, each its own colour, do the same, and a soft pool of
// light around the tower grows with the level. The whole glow breathes (5 s, ±15 %). Steady, never a burst; never the capture
// red/blue or the question gold. Reduced motion: the same strength, steady, without blinking, breathing, motes or streaks.
// A project without a seated territory shows nothing; no legacy-zone fallback.
import {displayColour} from './growth.js';

const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a));return t*t*(3-2*t);};
const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
const hex=s=>[1,3,5].map(i=>parseInt(String(s).slice(i,i+2),16)||0);
const WARM=[255,226,196],WHITE=[246,244,255];
// Per level 0..3. share and road: lit fraction of its windows and road lights, nearest the tower first; cover: how far out,
// as a share of its reach, the scene's windows give way; core: alpha of the pool around the tower; twinkles: roofs; motes
// and streaks: per second.
export const GLOW=Object.freeze({share:[0,.14,.32,.58],road:[0,.16,.38,.7],cover:[0,.32,.62,1],core:[0,.05,.11,.2],twinkles:[0,6,12,20],motes:[0,.8,1.8,3.2],streaks:[0,.6,1.4,2.6],breath:5000,swing:.15,ease:1200});
// Facade windows: one every step along a wall and per floor, of the scene's own window size; budget bounds a whole project.
// Lights along its roads, scattered as its windows are, in the central district's colours: one every step[0..1] units, each a
// wide spill over the buildings, a body on the road and a bright point.
export const NEON=Object.freeze({step:[14,44],spill:34,body:12,point:1.2,colours:[[255,42,214],[64,226,255],[255,196,72]]});
// Facade windows are mostly warm, the rest neon.
export const TINTS=Object.freeze({warm:.74,colours:[[120,235,255],[255,110,226],[255,214,110]]});
// How a window or road light dims towards the edge of the reach; how much chance mixes into the order they come on.
export const CENTRE=Object.freeze({dim:.5,noise:.4});
// Windows and road lights trade places now and then: each has its own period (ms, shorter by level), in each slot of it on
// with the chance duty.
export const BLINK=Object.freeze({period:[5000,17000],speed:[1,.8,1,1.3],duty:.8,edge:500});
export const FACADE=Object.freeze({step:3.2,floor:4.2,width:1.9,height:2.6,budget:20000});
export const MOTE=Object.freeze({life:3600,rise:46});
export const STREAK=Object.freeze({speed:150,length:18,piece:160,min:30});
const LAND=18,CELL=6;
// 0 working agents: nothing; 1; 2; 3 and more.
export const levelOf=n=>Math.max(0,Math.min(3,Math.floor(Number(n)||0)));
// A table value at a continuous level (the eased strength).
export const at=(table,s)=>{const i=Math.min(2,Math.floor(clamp(s,0,3)));return table[i]+(table[i+1]-table[i])*(clamp(s,0,3)-i);};

function rng(seed){let h=2166136261;for(const c of String(seed))h=Math.imul(h^c.charCodeAt(0),16777619);return()=>{h=Math.imul(h^h>>>15,2246822507);h=Math.imul(h^h>>>13,3266489909);return((h^=h>>>16)>>>0)/4294967296;};}

// `count` distinct items chosen from the seed alone, independent of the input order.
export function pick(seed,ids,count){
 const pool=[...ids].sort((a,b)=>a<b?-1:a>b?1:0),random=rng(seed),out=[],n=Math.min(count,pool.length);
 while(out.length<n)out.push(pool.splice(Math.floor(random()*pool.length),1)[0]);
 return out;
}
// Events of a steady stream: slot i starts at since + i/rate s; returns the alive ones as {i, age}.
export function stream(now,since,rate,life){
 const out=[];if(!(rate>0))return out;const period=1000/rate;
 for(let i=Math.max(0,Math.floor((now-since-life)/period));i<=Math.floor((now-since)/period);i++){const age=now-since-i*period;if(age>=0&&age<life)out.push({i,age});}
 return out;
}

// The window grid of one wall as [p, along, up] in wall points: columns by its length, floors by its height.
export function facadeWindows(points){
 const [a,b,c,d]=points,len=Math.hypot(b[0]-a[0],b[1]-a[1]),height=b[1]-c[1],cols=Math.floor(len/FACADE.step),rows=Math.floor(height/FACADE.floor),out=[];
 const at=(u,v)=>{const lo=[a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u],hi=[d[0]+(c[0]-d[0])*u,d[1]+(c[1]-d[1])*u];return [lo[0]+(hi[0]-lo[0])*v,lo[1]+(hi[1]-lo[1])*v];};
 for(let r=0;r<rows;r++)for(let k=0;k<cols;k++){const u=(k+.5)/cols-FACADE.width/len/2,v=(r+.5)/rows-FACADE.height/height/2,du=FACADE.width/len,dv=FACADE.height/height;out.push([at(u,v),at(u+du,v),at(u,v+dv)]);}
 return out;
}

export function createDistrictWork(live,{feed=()=>[],reduce,search=globalThis.location?.search||''}={}){
 const gpu=live.gpu,params=new URLSearchParams(search);
 const motion=reduce||(params.get('reduced')==='1'?{matches:true}:null)||globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')||{matches:false};
 const cache=new Map(),active=new Map(),demo=new Map();let last={projects:[],windows:0},facadeKey='',facadeStates=new Float32Array(0);
 const plots=()=>gpu.growth.plots;
 const dist=(a,b)=>Math.hypot(a[0]-b[0],(a[1]-b[1])*2);
 // The project's own buildings: main plot plus the plots plotOwners gives it. Null when unseated or empty.
 function territory(project,city){
  const key=project.id,old=cache.get(key);if(old&&old.project===project&&old.city===city)return old.T;
  let T=null;const main=project&&!project.closed&&project.mainPlot&&plots().get(project.mainPlot.id);
  if(main){
   const own=new Set([project.mainPlot.id,...(city?.plotOwners||[]).filter(o=>o.owner===project.id&&!o.reserved).map(o=>o.id)]);
   const ids=new Set(),buildings=[];
   for(const id of own){const plot=plots().get(id),b=plot&&gpu.growth.buildings.get(plot.building);if(!b||ids.has(b.id))continue;ids.add(b.id);
    buildings.push({b,plot:id,ground:plot.ground,d:dist(plot.ground,main.ground)});}
   if(buildings.length){
    // The scene's own windows on its buildings: while it works, the facade grid takes their place.
    const S=gpu.scene,offset=gpu.baseWindowCount||0,old=[],how=new Map(buildings.map(x=>[x.b.id,x.d]));
    const raw=hex(displayColour(project.colour||'#4fe3ff')),peak=Math.max(1,...raw),colour=raw.map(v=>v*255/peak);
    const reach=Math.max(40,...buildings.map(b=>b.d+20));
    if(S.owners){const keep=(w,i)=>{const d=how.get(S.owners[Math.floor(w[2])]);if(d!=null)old.push([i,d/reach]);};(S.windows||[]).forEach((w,i)=>keep(w,i));(S.optional||[]).forEach((w,i)=>keep(w,offset+i));}
    const near=p=>dist(p.ground,main.ground)<reach+LAND*2;
    // Ground membership: the nearest plot is the project's own and close enough to be land, not water.
    const grounds=[...plots().values()].filter(p=>p.ground&&near(p)).map(p=>[p.ground[0],p.ground[1],own.has(p.id)]);
    T={id:project.id,project,ground:main.ground,buildings,ids,own,old,grounds,cells:new Map(),colour,reach,phase:rng(project.id)()*6.283};
    T.roads=[];T.streets=streets(T);T.lights=roadLights(T);
   }
  }
  cache.set(key,{project,city,T});return T;
 }
 function inside(T,x,y){const cx=Math.round(x/CELL),cy=Math.round(y/CELL),key=cx*65536+cy;let v=T.cells.get(key);if(v!==undefined)return v;
  x=cx*CELL;y=cy*CELL;let best=Infinity,own=false;for(const g of T.grounds){const d=(g[0]-x)**2+((g[1]-y)*2)**2;if(d<best){best=d;own=g[2];}}
  v=own&&best<=LAND**2;T.cells.set(key,v);return v;}
 // Lights scattered along its roads, nearest the tower first, each with a colour of its own.
 function roadLights(T){
  const random=rng(T.id+'|lights'),colours=[...NEON.colours,T.colour],out=[];
  for(const r of T.roads){let left=NEON.step[0]*random();for(let i=1;i<r.length;i++){const a=r[i-1],b=r[i];left-=Math.hypot(b[0]-a[0],b[1]-a[1]);if(left>0)continue;left=NEON.step[0]+(NEON.step[1]-NEON.step[0])*random();const edge=clamp(dist(b,T.ground)/T.reach);
    out.push({p:b,c:colours[Math.floor(random()*colours.length)],r:edge,key:edge+random()*CENTRE.noise,period:BLINK.period[0]+(BLINK.period[1]-BLINK.period[0])*random(),offset:random()});}}
  return out.sort((a,b)=>a.key-b.key);
 }
 // Its facades' window grid, in a fixed shuffled order, so that a higher level lights a superset. Windows that an ad screen
 // covers are left out. Seven floats per window, as the page's window instances.
 function facades(T){
  if(T.facade)return T.facade;
  const ads=gpu.scene.ads||[],covered=p=>ads.some(([a])=>{const ux=a[1][0]-a[0][0],uy=a[1][1]-a[0][1],vx=a[3][0]-a[0][0],vy=a[3][1]-a[0][1],det=ux*vy-uy*vx,dx=p[0]-a[0][0],dy=p[1]-a[0][1],u=(dx*vy-dy*vx)/det,v=(ux*dy-uy*dx)/det;return u>=0&&u<=1&&v>=0&&v<=1;});
  const all=[],order=rng(T.id+'|facade');
  for(const {b:B,d} of T.buildings)for(const f of B.surfaces){if(f.kind!=='wall'||f.points.length<4)continue;const z=gpu.depth(f.layer+.15)-.000002;
   for(const [p,along,up] of facadeWindows(f.points.map(q=>gpu.growth.point(B.id,q))))if(!covered(p)){const r=d/T.reach;all.push({key:r+order()*CENTRE.noise,r,q:[p[0],p[1],z,along[0]-p[0],along[1]-p[1],up[0]-p[0],up[1]-p[1]]});}}
  all.sort((a,b)=>a.key-b.key);
  const list=all.slice(0,FACADE.budget),seen=rng(T.id+'|facade-tone'),warm=mix(WARM,T.colour,.15).map(v=>v/255),neon=TINTS.colours.map(c=>c.map(v=>v/255));
  T.facade={instances:new Float32Array(list.flatMap(w=>w.q)),count:list.length,tint:list.map(()=>{const v=seen();return v<TINTS.warm?warm:neon[Math.floor((v-TINTS.warm)/(1-TINTS.warm)*neon.length)];}),tone:Float32Array.from(list,w=>(.62+.3*seen())*(1-CENTRE.dim*w.r)),period:Float32Array.from(list,()=>BLINK.period[0]+(BLINK.period[1]-BLINK.period[0])*seen()),offset:Float32Array.from(list,()=>seen())};
  return T.facade;
 }
 // Streets: every road resampled at 4 units, cut to runs over the project's own land, split into pieces ≤ STREAK.piece.
 function streets(T){
  const out=[];
  for(const r of gpu.streetPaths||gpu.roadPaths||[]){let run=[];
   const flush=()=>{if(run.length>=8)T.roads.push(run.filter((_,i)=>i%2===0));for(let s=0;s<run.length-1;){let len=0,e=s;const piece=[run[s]];while(e<run.length-1&&len<STREAK.piece){len+=Math.hypot(run[e+1][0]-run[e][0],run[e+1][1]-run[e][1]);piece.push(run[++e]);}if(len>=STREAK.min)out.push({p:piece,len});s=e;}run=[];};
   for(let i=1;i<r.p.length;i++){const a=r.p[i-1],b=r.p[i],n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/4));
    for(let j=i===1?0:1;j<=n;j++){const q=[a[0]+(b[0]-a[0])*j/n,a[1]+(b[1]-a[1])*j/n];if(inside(T,q[0],q[1]))run.push(q);else flush();}}
   flush();}
  return out;
 }
 // Live level per project from real working agents; a demo level overrides it upwards.
 function levels(){
  const out=new Map();
  for(const f of feed()){const city=f.city;if(!city?.projects)continue;const n=new Map();for(const id of f.working||[])if(id)n.set(id,(n.get(id)||0)+1);
   for(const p of city.projects){const level=Math.max(levelOf(n.get(p.id)),demo.get(p.id)||0);if(level&&!out.has(p.id))out.set(p.id,{project:p,city,level,demo:demo.has(p.id)});}}
  return out;
 }
 const roofs=new Map();
 function roofOf(b){
  const roof=b.surfaces.filter(f=>f.kind==='roof').sort((x,y)=>y.layer-x.layer)[0];
  const q=(roof||b.surfaces.find(f=>f.kind==='wall'))?.points.map(p=>gpu.growth.point(b.id,p))||[b.ground];
  const x=q.reduce((a,p)=>a+p[0],0)/q.length,y=roof?q.reduce((a,p)=>a+p[1],0)/q.length:Math.min(...q.map(p=>p[1]));
  return {p:[x,y-1],q:roof?q:null,depth:roof?gpu.depth(roof.layer)-.000003:gpu.depth(0)-.000003};
 }
 // Strength eases towards the level (reduced motion: at once); a project stays until it has faded out.
 function update(now){
  const want=levels(),reduced=motion.matches;
  for(const [id,w] of want){const T=territory(w.project,w.city);if(!T){active.delete(id);continue;}
   let A=active.get(id);if(!A){A={s:0,t:now,since:now};active.set(id,A);}if(A.level!==w.level){A.level=w.level;A.since=now;}A.T=T;A.demo=w.demo;}
  for(const [id,A] of active){if(!want.has(id)&&A.level){A.level=0;A.since=now;}
   const step=reduced?Infinity:(now-A.t)*3/GLOW.ease;A.t=now;A.s=A.s<A.level?Math.min(A.level,A.s+step):Math.max(A.level,A.s-step);
   if(!A.level&&A.s<=0)active.delete(id);}
  // The scene's windows go out as the district's grid comes on (updateWindows has just reset the frame's state).
  const state=gpu.windowState;
  if(state)for(const A of active.values()){const cover=at(GLOW.cover,A.s),on=Math.min(1,A.s);for(const [i,r]of A.T.old){const k=1-on*(1-clamp((r-cover)/.1)),j=i*4+3;if(k<1)state[j]=state[j]>0?state[j]*k:0;}}
  last.windows=lightFacades(now);
 }
 // 0..1 for a facade window: in each slot of its own period it is on or off by a hash of (window, slot), with soft edges.
 function blink(k,now,period,offset){const x=now/period+offset,slot=Math.floor(x),on=s=>{let h=Math.imul(k+1,2654435761)^Math.imul(s,2246822519);h=Math.imul(h^h>>>15,3266489917);return ((h^h>>>13)>>>0)/4294967296<BLINK.duty;};
  const a=on(slot),inSlot=(x-slot)*period;if(inSlot>=BLINK.edge)return a?1:0;const was=on(slot-1),t=inSlot/BLINK.edge;return (was?1:0)+((a?1:0)-(was?1:0))*t;}
 // The working projects' grids in one GPU buffer, rebuilt when the set changes; only the lit state moves per frame.
 function lightFacades(now){
  if(!gpu.setWorkWindows)return 0;
  const list=[...active.values()],key=list.map(A=>`${A.T.id}:${facades(A.T).count}`).join('\n');
  if(key!==facadeKey){facadeKey=key;const parts=list.map(A=>facades(A.T)),instances=new Float32Array(parts.reduce((a,f)=>a+f.instances.length,0));let offset=0;for(const f of parts){instances.set(f.instances,offset);offset+=f.instances.length;}gpu.setWorkWindows(instances);facadeStates=new Float32Array(instances.length/7*4);}
  if(!list.length)return 0;
  const reduced=motion.matches;let base=0,lit=0;facadeStates.fill(0);
  for(const A of list){const T=A.T,F=facades(T),b=breath(T,now),count=at(GLOW.share,A.s)*F.count;
   const speed=at(BLINK.speed,A.s);
   for(let k=0;k<Math.ceil(count)&&k<F.count;k++){const on=reduced?1:blink(k,now*speed,F.period[k],F.offset[k]);if(on<=0)continue;const v=Math.min(1,Math.min(1,count-k)*b*on),j=(base+k)*4,tone=F.tone[k],c=F.tint[k];
    facadeStates[j]=c[0]*tone;facadeStates[j+1]=c[1]*tone;facadeStates[j+2]=c[2]*tone;facadeStates[j+3]=v;lit++;}
   base+=F.count;}
  gpu.writeWorkWindows(facadeStates);return lit;
 }
 const breath=(T,now)=>motion.matches?1:1+GLOW.swing*Math.sin(now/GLOW.breath*6.283+T.phase);
 function glow(g,p,r,c,a,squash=1){if(a<=.004)return;g.save();g.translate(p[0],p[1]);g.scale(1,squash);const q=g.createRadialGradient(0,0,0,0,0,r);q.addColorStop(0,[...c.map(v=>v/255),a]);q.addColorStop(1,[...c.map(v=>v/255),0]);g.fillStyle=q;g.fillRect(-r,-r,2*r,2*r);g.restore();}
 function dot(g,p,r,c,a){g.fillStyle=[...c.map(v=>v/255),a];g.beginPath();g.ellipse(p[0],p[1],r,r,0,0,Math.PI*2);g.fill();}
 function along(piece,s){let left=s;for(let i=1;i<piece.p.length;i++){const a=piece.p[i-1],b=piece.p[i],l=Math.hypot(b[0]-a[0],b[1]-a[1]);if(left<=l){const t=l?left/l:0;return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];}left-=l;}return piece.p.at(-1);}
 function draw(now){
  const report={projects:[],windows:last.windows,reduced:motion.matches};
  if(active.size){
   const g=gpu.painter,still=motion.matches;g.save();g.globalCompositeOperation='lighter';
   for(const A of active.values()){const T=A.T,s=A.s,light=mix(T.colour,WHITE,.4);
    const P={id:T.id,level:A.level,strength:+s.toFixed(3),demo:A.demo,buildings:[...T.ids],twinkles:[],motes:0,streaks:0};report.projects.push(P);
    // The pool of light around the tower, then the road lights.
    const b=breath(T,now);g.depth=-.9;glow(g,[T.ground[0],T.ground[1]-24],Math.min(170,T.reach),mix(T.colour,WHITE,.25),at(GLOW.core,s)*b,.6);
    const lit=at(GLOW.road,s)*T.lights.length,pace=at(BLINK.speed,s);let shown=0;
    for(let k=0;k<Math.ceil(lit)&&k<T.lights.length;k++){const l=T.lights[k],on=still?1:blink(k+7919,now*pace,l.period,l.offset);if(on<=0)continue;const a=Math.min(1,lit-k)*on*b*(1-CENTRE.dim*l.r);
     g.depth=-.9;glow(g,l.p,NEON.spill,l.c,.13*a,.55);g.depth=.928;glow(g,l.p,NEON.body,l.c,.5*a,.55);dot(g,l.p,NEON.point,mix(l.c,WHITE,.5),.9*a);shown++;}
    P.lights=shown;
    for(const {b:B} of T.buildings){const r=roofs.get(B.id);if(!r||r.k!==gpu.growth.hubScale?.(B.id))roofs.set(B.id,{...roofOf(B),k:gpu.growth.hubScale?.(B.id)});}
    // Roof twinkles: a fixed set by level; each sparkles on its own slow period.
    const byId=new Map(T.buildings.map(x=>[x.b.id,x.b]));
    pick(T.id+'|twinkle',T.ids,Math.round(at(GLOW.twinkles,s))).forEach((id,i)=>{const R=rng(T.id+'|t'+i),period=2200+R()*2400,phase=R()*6.283,r=roofs.get(id)||roofOf(byId.get(id));
     const k=still?.7:.25+.75*Math.max(0,Math.sin(now/period*6.283+phase))**3;g.depth=r.depth;glow(g,r.p,6,light,.5*k*Math.min(1,s));dot(g,r.p,1.1,WHITE,.85*k*Math.min(1,s));P.twinkles.push(id);});
    if(!still){
     // Motes rising from random own roofs, a few per second at level 3.
     const ids=[...T.ids];for(const m of stream(now,T.phase*1000,GLOW.motes[A.level],MOTE.life)){const R=rng(T.id+'|m'+m.i),id=ids[Math.floor(R()*ids.length)],r=roofs.get(id)||roofOf(byId.get(id)),u=m.age/MOTE.life;
      const p=[r.p[0]+(R()-.5)*6+Math.sin(u*4+R()*6)*3,r.p[1]-u*MOTE.rise*(.7+.6*R())],a=smooth(0,.15,u)*(1-smooth(.55,1,u))*Math.min(1,s);
      g.depth=r.depth;glow(g,p,4.5,light,.45*a);dot(g,p,.8,WHITE,.8*a);P.motes++;}
     // Streaks along its own streets: short, fast, fading at both ends of the piece.
     if(T.streets.length)for(const e of stream(now,T.phase*700,GLOW.streaks[A.level],1400)){const R=rng(T.id+'|s'+e.i),piece=T.streets[Math.floor(R()*T.streets.length)],head=e.age/1000*STREAK.speed,life=(piece.len+STREAK.length)/STREAK.speed*1000;
      if(e.age>life)continue;const pts=[];for(let k=0;k<=6;k++){const d=clamp(head-STREAK.length*(1-k/6),0,piece.len);pts.push(along(piece,d));}
      if(Math.hypot(pts[6][0]-pts[0][0],pts[6][1]-pts[0][1])<1)continue;const a=.7*Math.min(1,s)*smooth(0,250,e.age);
      g.depth=.928;g.trail(pts,[...light.map(v=>v/255),a],2.2);P.streaks++;}
    }
   }
   g.restore();
  }
  last={...report};
 }
 return {update,draw,territory,
  // Test stand: a local level per project (0 clears). Nothing reaches the journal or the hub home.
  setDemo(projectId,level){const l=levelOf(level);if(l)demo.set(projectId,l);else demo.delete(projectId);return l;},
  stats(){return {...last,demo:Object.fromEntries(demo),active:[...active.keys()]};},motion};
}
