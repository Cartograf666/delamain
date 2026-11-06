// "Work is happening here": a project with working agents glows from inside its own territory (its plots from
// plotOwners plus the main plot, as celebrations use). The level (0..3) sets the strength of every layer: a share of its
// own dark windows lit warm (a few flicker slowly), soft light from below on its own walls with brighter roof edges,
// large soft haze over the territory, tiny roof twinkles, light motes rising from roofs and short fast streaks along its
// own streets. The whole glow breathes (5 s, ±15 %). Steady, never a burst; the colour is the project's own softened
// towards white, never the capture red/blue or the question gold. Reduced motion: the same strength, steady, without
// flicker, breathing, motes or streaks. A project without a seated territory shows nothing; no legacy-zone fallback.
import {displayColour} from './growth.js';

const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a));return t*t*(3-2*t);};
const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
const hex=s=>[1,3,5].map(i=>parseInt(String(s).slice(i,i+2),16)||0);
const WARM=[255,226,196],WHITE=[246,244,255];
// Per level 0..3. share: lit fraction of the project's dark windows; wall/edge: uplight gain on its own walls and roof
// lines; haze: alpha of the territory blobs; twinkles: roofs; motes and streaks: per second.
export const GLOW=Object.freeze({share:[0,.35,.6,.85],wall:[0,.2,.34,.5],edge:[0,.22,.36,.54],haze:[0,.08,.14,.22],
 twinkles:[0,6,12,20],motes:[0,.8,1.8,3.2],streaks:[0,.6,1.4,2.6],breath:5000,swing:.15,ease:1200,flicker:.06});
export const HAZE=Object.freeze({count:[8,12],radius:[40,90],lift:14});
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

export function createDistrictWork(live,{feed=()=>[],reduce,search=globalThis.location?.search||''}={}){
 const gpu=live.gpu,params=new URLSearchParams(search);
 const motion=reduce||(params.get('reduced')==='1'?{matches:true}:null)||globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')||{matches:false};
 const cache=new Map(),active=new Map(),demo=new Map();let last={projects:[],windows:0};
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
    // Dark windows (scene.optional) on its own buildings, in a fixed shuffled order: a higher level lights a superset.
    const S=gpu.scene,offset=gpu.baseWindowCount||0,dark=[];
    if(S.optional&&S.owners)S.optional.forEach((w,i)=>{if(ids.has(S.owners[Math.floor(w[2])]))dark.push(offset+i);});
    const windows=pick(project.id+'|windows',dark,dark.length),random=rng(project.id+'|flicker');
    const flicker=new Map(windows.filter(()=>random()<GLOW.flicker).map(i=>[i,{period:3000+random()*5000,phase:random()*6.283}]));
    const raw=hex(displayColour(project.colour||'#4fe3ff')),peak=Math.max(1,...raw),colour=raw.map(v=>v*255/peak);
    const reach=Math.max(40,...buildings.map(b=>b.d+20)),near=p=>dist(p.ground,main.ground)<reach+LAND*2;
    // Ground membership: the nearest plot is the project's own and close enough to be land, not water.
    const grounds=[...plots().values()].filter(p=>p.ground&&near(p)).map(p=>[p.ground[0],p.ground[1],own.has(p.id)]);
    T={id:project.id,project,ground:main.ground,buildings,ids,own,windows,flicker,grounds,cells:new Map(),colour,reach,phase:rng(project.id)()*6.283};
    T.haze=haze(T);T.streets=streets(T);
   }
  }
  cache.set(key,{project,city,T});return T;
 }
 function inside(T,x,y){const cx=Math.round(x/CELL),cy=Math.round(y/CELL),key=cx*65536+cy;let v=T.cells.get(key);if(v!==undefined)return v;
  x=cx*CELL;y=cy*CELL;let best=Infinity,own=false;for(const g of T.grounds){const d=(g[0]-x)**2+((g[1]-y)*2)**2;if(d<best){best=d;own=g[2];}}
  v=own&&best<=LAND**2;T.cells.set(key,v);return v;}
 // Haze: centres spread over the territory (farthest-point from the main tower), each radius kept off foreign land.
 function haze(T){
  const mine=T.grounds.filter(g=>g[2]),foreign=T.grounds.filter(g=>!g[2]),n=Math.round(clamp(mine.length/40,0,1)*(HAZE.count[1]-HAZE.count[0]))+HAZE.count[0];
  const out=[[...T.ground]];
  while(out.length<Math.min(n,mine.length)){let best=null,bd=-1;for(const g of mine){const d=Math.min(...out.map(c=>dist(c,g)));if(d>bd){bd=d;best=g;}}out.push([best[0],best[1]]);}
  // Most of the blob's ellipse stays over the project's own land, so it does not spill over water or a neighbour.
  const fits=(c,r)=>{let k=0;for(let i=0;i<16;i++){const a=i/16*6.283;if(inside(T,c[0]+Math.cos(a)*r*.8,c[1]+Math.sin(a)*r*.4))k++;}return k>=12;};
  return out.map(c=>{let r=Math.min(HAZE.radius[1],foreign.length?Math.min(...foreign.map(f=>dist(c,f)))*1.1:Infinity);while(r>HAZE.radius[0]&&!fits(c,r))r-=5;return {p:c,r:clamp(r,...HAZE.radius)};});
 }
 // Streets: every road resampled at 4 units, cut to runs over the project's own land, split into pieces ≤ STREAK.piece.
 function streets(T){
  const out=[];
  for(const r of gpu.streetPaths||gpu.roadPaths||[]){let run=[];
   const flush=()=>{for(let s=0;s<run.length-1;){let len=0,e=s;const piece=[run[s]];while(e<run.length-1&&len<STREAK.piece){len+=Math.hypot(run[e+1][0]-run[e][0],run[e+1][1]-run[e][1]);piece.push(run[++e]);}if(len>=STREAK.min)out.push({p:piece,len});s=e;}run=[];};
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
  // Windows: on top of the frame's window state (updateWindows has just reset it); hidden windows stay hidden.
  const state=gpu.windowState,base=live.baseState;let n=0;
  if(state)for(const A of active.values()){const T=A.T,c=mix(WARM,T.colour,.35),b=breath(T,now),count=at(GLOW.share,A.s)*T.windows.length;
   for(let k=0;k<Math.ceil(count);k++){const i=T.windows[k],j=i*4;if(base&&base[j+3]===0)continue;
    const f=!reduced&&T.flicker.get(i),v=Math.min(1,count-k)*b*(f?.45+.55*(.5+.5*Math.sin(now/f.period*6.283+f.phase)):1);
    for(let m=0;m<3;m++)state[j+m]+=(c[m]/255-state[j+m])*Math.min(1,v);state[j+3]=Math.max(state[j+3],Math.min(1,v));n++;}}
  last.windows=n;
 }
 const breath=(T,now)=>motion.matches?1:1+GLOW.swing*Math.sin(now/GLOW.breath*6.283+T.phase);
 function glow(g,p,r,c,a,squash=1){if(a<=.004)return;g.save();g.translate(p[0],p[1]);g.scale(1,squash);const q=g.createRadialGradient(0,0,0,0,0,r);q.addColorStop(0,[...c.map(v=>v/255),a]);q.addColorStop(1,[...c.map(v=>v/255),0]);g.fillStyle=q;g.fillRect(-r,-r,2*r,2*r);g.restore();}
 function dot(g,p,r,c,a){g.fillStyle=[...c.map(v=>v/255),a];g.beginPath();g.ellipse(p[0],p[1],r,r,0,0,Math.PI*2);g.fill();}
 function along(piece,s){let left=s;for(let i=1;i<piece.p.length;i++){const a=piece.p[i-1],b=piece.p[i],l=Math.hypot(b[0]-a[0],b[1]-a[1]);if(left<=l){const t=l?left/l:0;return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];}left-=l;}return piece.p.at(-1);}
 function draw(now){
  const report={projects:[],windows:last.windows,reduced:motion.matches};
  if(active.size){
   const g=gpu.painter,still=motion.matches;g.save();g.globalCompositeOperation='lighter';
   for(const A of active.values()){const T=A.T,s=A.s,b=breath(T,now),light=mix(T.colour,WHITE,.4),soft=mix(T.colour,WHITE,.2);
    const P={id:T.id,level:A.level,strength:+s.toFixed(3),demo:A.demo,buildings:[...T.ids],walls:0,edges:0,haze:0,twinkles:[],motes:0,streaks:0};report.projects.push(P);
    // Haze over the territory, in front of the buildings: one luminous area from afar.
    const hz=at(GLOW.haze,s)*b;g.depth=-.9;for(const h of T.haze){glow(g,[h.p[0],h.p[1]-HAZE.lift],h.r,soft,hz,.55);P.haze++;}
    // Light from below on its own walls (each at its own depth, so nothing shines through a building in front) and
    // a brighter line along its top roof.
    const wall=at(GLOW.wall,s)*b,edge=at(GLOW.edge,s)*b;
    for(const {b:B} of T.buildings){let r=roofs.get(B.id);if(!r||r.k!==gpu.growth.hubScale?.(B.id)){r={...roofOf(B),k:gpu.growth.hubScale?.(B.id)};roofs.set(B.id,r);}
     for(const f of B.surfaces){if(f.kind!=='wall')continue;g.depth=gpu.depth(f.layer)-.000002;g.uplight(f.points.map(p=>gpu.growth.point(B.id,p)),light,wall);P.walls++;}
     if(r.q){g.depth=r.depth;g.ribbon([...r.q,r.q[0]],[...light.map(v=>v/255),edge],r.q.map(()=>2.4).concat(2.4),r.q.map(()=>1).concat(1),8);P.edges++;}}
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
