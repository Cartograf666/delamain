// Run: node viz/tests/gl/district-work.test.mjs
// Work in a district on the real GL geometry and a frozen territory snapshot; the painter only records calls.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createDistrictWork,levelOf,at,pick,stream,facadeWindows,GLOW,FACADE,MOTE} from '../../assets/gl/district-work.js';
const A=new URL('../../assets/gl/',import.meta.url),read=f=>JSON.parse(fs.readFileSync(new URL(f,A)));
const S=read('scene.json'),G=read('growth-plots.json'),city=JSON.parse(fs.readFileSync(new URL('../growth/legacy-identity-city.json',import.meta.url)));
const plots=new Map(G.plots.map(p=>[p.id,p])),buildings=new Map(S.buildings.map(b=>[b.id,b]));
const DOTA='Dota2Helper',OTHER='Куда за музыкой';
// Streets as main.js exposes them (straight polylines are enough here: the module resamples them).
const streetPaths=S.roads.map(r=>({p:r.points.map(p=>[p[0]*.75,p[1]*.75-40])}));

function world({working=[],reduce=false,data=city}={}){
 const calls=[];let depth=-.97,building=null,fill=null;
 const painter={get depth(){return depth;},set depth(v){depth=v;},globalCompositeOperation:'source-over',get fillStyle(){return fill;},set fillStyle(v){fill=v;},
  save(){},restore(){},scale(){},beginPath(){},translate(x,y){calls.push({kind:'at',x,y,depth});},
  ellipse(x,y,r){calls.push({kind:'dot',x,y,r,depth,a:fill[3]});},fill(){},
  createRadialGradient:(x,y,r0,x1,y1,r)=>({r,stops:[],addColorStop(t,c){this.stops.push(c);}}),
  fillRect(){calls.push({kind:'glow',depth,r:fill.r,a:fill.stops[0][3],colour:fill.stops[0].slice(0,3)});},
  uplight(pts,c,gain){calls.push({kind:'wall',building,depth,gain,colour:c});},
  ribbon(pts,c,w,alphas){calls.push({kind:'edge',building,pts,depth,a:c[3]});},
  trail(pts,c){calls.push({kind:'streak',pts,depth,a:c[3]});}};
 const n=S.windows.length+S.optional.length,gpu={painter,scene:S,baseWindowCount:S.windows.length,windowState:new Float32Array(n*4),depth:l=>.75-1.5*l/S.maxLayer,
  streetPaths,growth:{plots,buildings,point:(id,p)=>{building=id;return p;}}};
 const live={gpu,pulses:[],baseState:new Float32Array(n*4).fill(1)};
 const feed={src:'http://fixture',city:data,working};
 const dw=createDistrictWork(live,{feed:()=>[feed],reduce:{matches:reduce},search:''});
 return {dw,calls,gpu,live,feed,frame(now){calls.length=0;gpu.windowState.fill(0);dw.update(now);dw.draw(now);return dw.stats();}};
}
const own=id=>{const p=city.projects.find(q=>q.id===id);return new Set([p.mainPlot.id,...city.plotOwners.filter(o=>o.owner===id&&!o.reserved).map(o=>o.id)].map(i=>plots.get(i)?.building).filter(b=>b!=null));};
const litWindows=gpu=>{const out=[];for(let i=S.windows.length;i<S.windows.length+S.optional.length;i++)if(gpu.windowState[i*4+3]>0)out.push(i);return out;};
const ownerOf=i=>S.owners[Math.floor(S.optional[i-S.windows.length][2])];
const dark=id=>{const mine=own(id);return S.optional.filter(w=>mine.has(S.owners[Math.floor(w[2])])).length;};
// Run a demo level until the strength has settled, then return one frame's stats.
const settle=(w,t=3000)=>{for(let x=0;x<=t;x+=100)w.frame(x);return w.frame(t);};

// Levels and tables: 0 nothing; every layer grows with the level; the window shares the brief names.
assert.deepEqual([0,1,2,3,4,9,-1,undefined].map(levelOf),[0,1,2,3,3,3,0,0]);
assert.deepEqual(GLOW.share,[0,.35,.6,.85]);
for(const key of ['share','twinkles','motes','streaks']){const t=GLOW[key];assert.equal(t[0],0,key);assert(t[1]>0&&t[1]<t[2]&&t[2]<t[3],key);}
assert.equal(at(GLOW.share,1.5),(GLOW.share[1]+GLOW.share[2])/2);assert.equal(at(GLOW.share,3),GLOW.share[3]);
assert.equal(GLOW.breath,5000);assert.equal(GLOW.swing,.15);
// pick: deterministic and order-free; stream: a steady rate.
assert.deepEqual(pick('x',[1,2,3,4,5,6,7,8],3),pick('x',[8,7,6,5,4,3,2,1],3));assert.equal(new Set(pick('x',[1,2,3,4,5,6,7,8],6)).size,6);
{let seen=new Set();for(let t=0;t<10000;t+=50)for(const e of stream(t,0,3,MOTE.life))seen.add(e.i);assert(Math.abs(seen.size-30)<=1,`3/s for 10 s: ${seen.size}`);}
assert.equal(stream(500,1000,3,1000).length,0,'nothing before it starts');

// Live level from working agents; agents of an unknown project light nothing.
for(const [n,level] of [[0,0],[1,1],[2,2],[3,3],[6,3]]){
 const w=world({working:[...Array(n).fill(DOTA),OTHER+'?']}),s=w.frame(1000);
 assert.equal(s.projects.find(p=>p.id===DOTA)?.level??0,level,`${n} working → level ${level}`);
 assert(!s.projects.some(p=>p.id!==DOTA));
}

// Lit share by level, a superset as the level rises, only the project's own windows.
{
 const mine=own(DOTA),total=dark(DOTA);let prev=new Set();
 for(const level of [1,2,3]){const w=world({working:Array(level).fill(DOTA)});settle(w);const lit=litWindows(w.gpu);
  assert(Math.abs(lit.length-GLOW.share[level]*total)<=1.5,`level ${level}: ${lit.length} of ${total} dark windows lit`);
  for(const i of lit)assert(mine.has(ownerOf(i)),`window ${i} outside ${DOTA}`);
  for(const i of prev)assert(lit.includes(i),'a higher level keeps the windows of a lower one');prev=new Set(lit);}
}

// Motion at level 3: no ring and no wash, every light on the project's own buildings and streets, breathing windows,
// motes and streaks.
{
 const mine=own(DOTA),w=world({working:[DOTA,DOTA,DOTA]}),T=w.dw.territory(city.projects.find(p=>p.id===DOTA),city);
 settle(w);const flicker=new Set();let motes=0,streaks=0,last=null,water=0,checked=0;
 const nearest=(x,y)=>{let best=Infinity,id=null;for(const p of G.plots){if(!p.ground)continue;const d=(p.ground[0]-x)**2+((p.ground[1]-y)*2)**2;if(d<best){best=d;id=p.id;}}return {id,land:best<=(18+6)**2};};
 for(let t=3000;t<13000;t+=100){const s=w.frame(t),P=s.projects[0];
  const winNow=litWindows(w.gpu).map(i=>w.gpu.windowState[i*4+3].toFixed(3)).join();if(last&&winNow!==last)flicker.add(t);last=winNow;
  motes+=P.motes;streaks+=P.streaks;
  for(const c of w.calls){
   assert.notEqual(c.depth,.93,'nothing at the old ring depth');
   assert(c.kind!=='wall'&&c.kind!=='edge','the light comes from windows, not from a wash on the walls');
   assert(!(c.kind==='glow'&&c.depth===-.9),'no haze over the territory');
   if(c.kind==='streak'&&checked<300){for(const p of c.pts){const n=nearest(...p);checked++;if(!T.own.has(n.id))water++;}}
  }}
 assert(!('rings' in w.dw.stats())&&!w.dw.stats().projects[0].rings,'no ring in the stats');
 assert(motes>0&&streaks>0,`motes ${motes}, streaks ${streaks}`);assert(flicker.size>20,'a few windows flicker');
 assert(checked>0&&water/checked<.05,`streak points off own land: ${water} of ${checked}`);
}

// Facade windows: a grid inside its wall, more of them with each level, a superset, all gone once the work ends.
{
 const grid=facadeWindows([[0,0],[32,0],[32,-42],[0,-42]]);assert.equal(grid.length,100,'10 columns by 10 floors');
 for(const [p,along,up] of grid){assert(p[0]>=0&&along[0]<=32&&p[1]<=0&&up[1]>=-42);assert(Math.abs(along[0]-p[0]-FACADE.width)<1e-9);assert(Math.abs(p[1]-up[1]-FACADE.height)<1e-9);}
 assert.equal(facadeWindows([[0,0],[2,0],[2,-3],[0,-3]]).length,0,'a wall too small for a window has none');
 const litOf=level=>{const w=world({working:Array(level).fill(DOTA)});let states=null,count=0;w.gpu.setWorkWindows=i=>{count=i.length/7;};w.gpu.writeWorkWindows=s=>{states=s;};settle(w);const lit=[];for(let i=0;i<count;i++)if(states[i*4+3]>0)lit.push(i);return {w,lit,count};};
 const one=litOf(1),three=litOf(3);
 assert(three.count>dark(DOTA)*3,`facade windows ${three.count}, the scene's dark ones ${dark(DOTA)}`);
 assert(Math.abs(one.lit.length-GLOW.share[1]*one.count)<=1.5&&Math.abs(three.lit.length-GLOW.share[3]*three.count)<=1.5);
 const lit3=new Set(three.lit);assert(one.lit.every(i=>lit3.has(i)),'a higher level keeps the windows of a lower one');
 let cleared=-1;three.w.gpu.setWorkWindows=i=>{cleared=i.length;};three.w.feed.working=[];for(let t=3000;t<6000;t+=100)three.w.frame(t);assert.equal(cleared,0,'nothing stays lit after the work ends');
}

// Reduced motion: the same strength at once, steady: no flicker, breathing, motes or streaks.
{
 const w=world({working:[DOTA,DOTA,DOTA],reduce:true}),total=dark(DOTA);
 const a=w.frame(0),winA=[...w.gpu.windowState].join(),callsA=w.calls.map(c=>c.kind+c.a+c.gain).join();
 assert.equal(a.projects[0].strength,3,'full strength at once');assert(Math.abs(litWindows(w.gpu).length-GLOW.share[3]*total)<=1.5);
 for(const t of [1300,2700,4100,65000]){const s=w.frame(t);assert.equal([...w.gpu.windowState].join(),winA,'steady windows');
  assert.equal(w.calls.map(c=>c.kind+c.a+c.gain).join(),callsA,'steady glow');assert.equal(s.projects[0].motes+s.projects[0].streaks,0);}
 }

// Silent, unseated, closed or empty territory: nothing at all; demo levels set and fade out without workers.
{
 const w=world();let s=w.frame(1000);assert.equal(s.projects.length,0);assert.equal(w.calls.length,0);assert.equal(litWindows(w.gpu).length,0);
 const data={...city,projects:[...city.projects.map(p=>p.id===DOTA?{...p,mainPlot:{...p.mainPlot,id:-12345}}:p),{id:'Nowhere',colour:'#ffffff',stages:[]}]};
 const u=world({data,working:[DOTA,DOTA,'Nowhere']});s=u.frame(1000);assert.equal(s.projects.length,0,'unseated: nothing, no legacy zone');assert.equal(u.calls.length,0);
 const closed=world({data:{...city,projects:city.projects.map(p=>p.id===DOTA?{...p,closed:true}:p)},working:[DOTA]});assert.equal(closed.frame(1000).projects.length,0);
 assert.equal(w.dw.setDemo(DOTA,3),3);w.frame(2000);s=w.frame(2600);assert.deepEqual(s.projects.map(p=>[p.id,p.level,p.demo]),[[DOTA,3,true]]);
 assert(s.projects[0].strength>0&&s.projects[0].strength<3,'eases in');
 assert.equal(w.dw.setDemo(DOTA,0),0);w.frame(2700);s=w.frame(4000);assert.equal(s.projects.length,0);assert.deepEqual(s.demo,{});
 assert.equal(litWindows(w.gpu).length,0);
}
console.log('district work ok');
