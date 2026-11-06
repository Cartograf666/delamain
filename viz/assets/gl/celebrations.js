// Street party over a project's district: a merge, a release or an opened PR becomes fireworks
// above its main plot and light on its own facades. Everything is analytic in the event's age,
// so a frame never accumulates state. Additive light only; facade light sits on each wall's own
// depth, so nearer buildings hide it exactly as they hide the arrival light.
import {displayColour} from './growth.js';
import {buildDemoPanel} from './demo-panel.js';
import {createDistrictDemo} from './district-demo.js';

const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a));return t*t*(3-2*t);};
const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
const hex=s=>[1,3,5].map(i=>parseInt(String(s).slice(i,i+2),16)||0);
const WHITE=[255,255,255],WARM=[255,232,206];
// The project's hue at full brightness; a near-black hash colour falls back to its display colour.
const vivid=c=>{const raw=hex(c||'#4fe3ff'),peak=Math.max(...raw);return peak<40?hex(displayColour(c)):mix(raw.map(v=>v*255/peak),WHITE,.12);};
export const EMISSIVE_PEAK=.55,LIVE_AGE=120000,MAX_LIVE=4,PARTICLE_BUDGET=1500,MIN_BURST_GAP=340;
export const KINDS=Object.freeze({'pr-opened':'pr','pr-merged':'merge',release:'release'});
const DEMO_KIND={pr:'pr-opened',merge:'pr-merged',release:'release'};
const ORDER=['pr-opened','pr-merged','release'];
const CAPTION={en:{'pr-opened':'PR opened','pr-merged':'PR merged',release:'Release',project:'Project'},ru:{'pr-opened':'PR открыт','pr-merged':'PR смёржен',release:'Релиз',project:'Проект'}};

// Deterministic per event: the same id draws the same show.
function rng(seed){let h=2166136261;for(const c of String(seed))h=Math.imul(h^c.charCodeAt(0),16777619);return()=>{h=Math.imul(h^h>>>15,2246822507);h=Math.imul(h^h>>>13,3266489909);return((h^=h>>>16)>>>0)/4294967296;};}

// Shell recipes. R is the burst radius in world units, life in ms, drag k per second, gravity G units/s².
const SHELL={
 peony:{n:46,R:38,life:1700,k:1.9,G:26},
 ring:{n:36,R:41,life:1600,k:1.9,G:20},
 willow:{n:40,R:30,life:3200,k:2.4,G:22,trail:900},
 crossette:{n:8,R:31,life:1800,k:1.7,G:24,split:.5},
 palm:{n:7,R:42,life:2300,k:1.3,G:30,trail:600,thick:1},
 spark:{n:18,R:26,life:1500,k:1.9,G:24},
 small:{n:10,R:18,life:1100,k:2,G:24},
};

// Rocket launch, flight and burst times in ms. Burst onsets never come closer than MIN_BURST_GAP:
// at most ~3 per second, so the sky never strobes.
export function schedule(kind,random){
 const out=[];let last=-1e9;
 const add=(type,launch,flight,extra={})=>{const burst=Math.max(launch+flight,last+MIN_BURST_GAP);last=burst;out.push({type,launch,burst,...extra});};
 // PR: three small rockets 200 ms apart, fanned left/centre/right, each a little higher; colours
 // project, white, light project tint. Flights keep the bursts MIN_BURST_GAP apart.
 if(kind==='pr-opened')[[0,-34,0],[1,4,18],[2,40,34]].forEach(([i,lean,rise])=>add('spark',i*200,700+i*140,{lean,rise,tint:i}));
 else if(kind==='pr-merged'){add('peony',0,900);add('ring',250,1150);add('peony',500,1400);}
 else{
  const types=['peony','willow','ring','crossette','palm','peony','willow','crossette','ring','palm','peony'];
  const n=8+Math.floor(random()*5);
  for(let i=0;i<n;i++)add(types[i%types.length],i*(8600/n)+random()*180,1000+random()*300);
  // Finale: ~20 small bursts, two per onset, onsets MIN_BURST_GAP apart; no rocket trails.
  for(let i=0;i<10;i++){const burst=Math.max(last+(i?0:700),last+MIN_BURST_GAP);last=burst;for(let j=0;j<2;j++)out.push({type:'small',launch:burst-500,burst,finale:true});}
 }
 return out;
}

// Facade light: only the central buildings, lit by a fast wave that passes and is gone. The set is the main
// tower plus the project's own plots within CENTRAL[kind] ground units of it (PR: the main tower alone),
// nearest first, at most MAX_CENTRAL. Ground distance counts y twice (the map's 2:1 projection).
export const CENTRAL=Object.freeze({'pr-opened':0,'pr-merged':70,release:110}),MAX_CENTRAL=30;
export const groundDistance=(a,b)=>Math.hypot(a[0]-b[0],(a[1]-b[1])*2);
// owners: /city plotOwners ({id,owner,reserved}); groundOf(id): the plot's ground point or null.
export function centralPlots(kind,project,owners,groundOf){
 const id=project.mainPlot.id,g0=groundOf(id);if(!g0)return [];
 const main={id,d:0,main:true};if(kind==='pr-opened')return [main];
 const R=CENTRAL[kind]??CENTRAL.release,seen=new Set([id]),near=[];
 for(const o of owners||[]){if(o.owner!==project.id||o.reserved||seen.has(o.id))continue;seen.add(o.id);const g=groundOf(o.id);if(!g)continue;const d=groundDistance(g,g0);if(d<=R)near.push({id:o.id,d,main:false});}
 return [main,...near.sort((a,b)=>a.d-b.d)].slice(0,MAX_CENTRAL);
}
// The wave: a front at `speed` ground units/s; each building rises to its peak in `rise` ms when the front
// reaches it and decays in `decay` ms, so a bright ring runs outwards and is gone. Merge: one pass;
// release: three passes 1.2 s apart, each wider (share of the set's radius).
export const WAVE=Object.freeze({speed:160,rise:150,decay:800,gain:1.25});
export const PASSES=Object.freeze({'pr-merged':[{at:0,share:1}],release:[{at:0,share:.55},{at:1200,share:.8},{at:2400,share:1}]});
// One building's light (0..1) at `a` ms after the wave starts.
export function passGain(kind,d,reach,a){
 let k=0;
 for(const p of PASSES[kind]||PASSES.release){if(d>p.share*reach+1e-6)continue;const on=p.at+d/WAVE.speed*1000;
  k=Math.max(k,smooth(on,on+WAVE.rise,a)*(1-smooth(on+WAVE.rise,on+WAVE.rise+WAVE.decay,a)));}
 return k;
}
const AFTERGLOW=3000;

export function durationOf(kind,reach=0,at=900){
 if(kind==='pr-opened')return 3400;
 const last=(PASSES[kind]||PASSES.release).at(-1).at;
 return Math.max(kind==='release'?20000:6000,at+last+reach/WAVE.speed*1000+WAVE.rise+WAVE.decay+(kind==='release'?AFTERGLOW:0)+400);
}

// Velocity drag with constant gravity, closed form: no per-frame integration.
function travel(v,k,G,t){const e=1-Math.exp(-k*t);return[v[0]/k*e,v[1]/k*e+G/k*(t-e/k)];}

function particles(shell,random,colour,kind){
 const s=SHELL[shell.type],R=s.R*(kind==='pr-opened'?1:1+random()*.18),v0=R*s.k,list=[],tilt=random()*Math.PI;
 const own=[colour,WHITE,mix(colour,WHITE,.5)][shell.tint]||colour;
 const tint=i=>{if(kind!=='release')return own;if(shell.type==='willow')return i%3?WARM:colour;return i%3===0?colour:WHITE;};
 for(let i=0;i<s.n;i++){
  let d;
  if(shell.type==='ring'){const a=i/s.n*Math.PI*2,x=Math.cos(a),y=Math.sin(a)*.5,r=(tilt-Math.PI/2)*.25;d=[x*Math.cos(r)-y*Math.sin(r),x*Math.sin(r)+y*Math.cos(r)];}
  else if(shell.type==='palm'||shell.type==='crossette'){const a=i/s.n*Math.PI*2+random()*.2-(shell.type==='palm'?Math.PI/2:0);d=[Math.cos(a),Math.sin(a)*(shell.type==='palm'?.8:1)];if(shell.type==='palm')d[1]-=.35;}
  else{const z=random()*2-1,a=random()*Math.PI*2,r=Math.sqrt(1-z*z);d=[r*Math.cos(a),r*Math.sin(a)];}
  const speed=v0*(.9+random()*.15);
  list.push({v:[d[0]*speed,d[1]*speed],colour:tint(i),life:s.life*(kind==='pr-merged'?1.45:1)*(.85+random()*.25)});
 }
 return {...shell,s,particles:list,R};
}

export function createCelebrations(live,{feed=()=>[],search=globalThis.location?.search||'',reduce,lang='en',caption,taxis,district}={}){
 const gpu=live.gpu,params=new URLSearchParams(search),demo=params.get('demo')==='celebration';
 const only=DEMO_KIND[params.get('kind')]||null;
 // The panel plays events on click; without it (panel=0) or with kind= the demo plays by itself.
 const panelOn=params.get('panel')==='1'||(demo&&params.get('panel')!=='0'),cycle=demo&&(!panelOn||!!only);
 const motion=reduce||(params.get('reduced')==='1'?{matches:true}:null)||globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')||{matches:false};
 const seenSources=new Set(),seen=new Set();let events=[],queue=[],demoIndex=0,demoNext=0,label=null,panel=null,picker=null,frameWanted=cycle;
 const stats={demo,panel:panelOn,queued:0,started:0,skipped:0,maxLive:0,maxParticles:0,particles:0};
 const plotBuilding=id=>{const plot=gpu.growth.plots.get(id);return plot&&gpu.growth.buildings.get(plot.building);};
 // project.plots are graph indices; growth plots are keyed by the fixed plot id, which /city gives
 // per plot in plotOwners. Without that snapshot only the main plot is known.
 function litPlots(kind,project){
  const snap=gpu.growth.snapshot,owners=snap?.projects?.some(p=>p.id===project.id)?snap.plotOwners:[];
  return centralPlots(kind,project,owners,id=>gpu.growth.plots.get(id)?.ground);
 }
 // Water: the first shoreline under (x,y), from the smoothed land contours the static reflections use.
 function shoreBelow(x,y){let best=Infinity;
  for(const pts of gpu.shore||[])for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length];if(a[0]===b[0]||(a[0]-x)*(b[0]-x)>0)continue;const c=a[1]+(x-a[0])*(b[1]-a[1])/(b[0]-a[0]);if(c>y&&c<best)best=c;}
  return best<y+400?best:null;}
 // The water a burst at height `top` reflects in: the first bank below the launch ground is the mirror
 // line; the image is flipped and foreshortened to fit that stretch of water (q = vertical scale).
 function waterUnder(x,ground,top){const bank=shoreBelow(x,ground);if(bank==null)return null;
  const span=(shoreBelow(x,bank+.5)??bank+120)-bank;return {y:bank,span,q:clamp(.45*span/Math.max(1,bank-top),.08,.7)};}
 const wallsOf=b=>b.surfaces.filter(f=>f.kind==='wall');
 function buildingWindows(ids){
  const S=gpu.scene,out=[];if(!S.windows||!S.owners)return out;
  for(let i=0;i<S.windows.length;i++)if(ids.has(S.owners[Math.floor(S.windows[i][2])]))out.push(i);
  return out;
 }
 // Roof anchor: the top of the main plot's building as drawn now (growth lifts it), centred on it.
 function anchorOf(project,main){
  const q=main?wallsOf(main).flatMap(f=>f.points.map(p=>gpu.growth.point(main.id,p))):[];
  if(!q.length)return gpu.growth.plots.get(project.mainPlot.id).ground.slice();
  const xs=q.map(p=>p[0]);return [(Math.min(...xs)+Math.max(...xs))/2,Math.min(...q.map(p=>p[1]))];
 }
 // Highest roof drawn over the anchor's column, so bursts open above the skyline, not on a roof behind.
 function skyline([x,y]){let top=y;for(const b of gpu.scene.buildings)for(const f of b.surfaces){if(f.kind!=='roof'||!f.points.some(p=>Math.abs(p[0]-x)<60&&p[1]<top&&p[1]>y-150))continue;for(const p of f.points.map(q=>gpu.growth.point(b.id,q)))if(Math.abs(p[0]-x)<60)top=Math.min(top,p[1]);}return Math.max(top,y-150);}
 // Builds a playable event, or null when the project has no district on this map.
 function start({id,kind,project},now){
  if(!project?.mainPlot||project.closed||!gpu.growth.plots.get(project.mainPlot.id))return null;
  const random=rng(id),colour=vivid(project.colour),main=plotBuilding(project.mainPlot.id);
  const anchor=anchorOf(project,main),ground=gpu.growth.plots.get(project.mainPlot.id).ground;
  const ids=new Set(),buildings=[],reduced=motion.matches;
  // Reduced motion: no wave, one steady soft light on the main tower.
  for(const {id:plotId,d} of litPlots(reduced?'pr-opened':kind,project)){
   const plot=gpu.growth.plots.get(plotId),b=plot&&gpu.growth.buildings.get(plot.building);if(!b||ids.has(b.id))continue;ids.add(b.id);
   buildings.push({b,walls:wallsOf(b),roofs:b.surfaces.filter(f=>f.kind==='roof'),d,main:b===main});
  }
  const reach=Math.max(0,...buildings.map(b=>b.d));const sky=skyline(anchor);
  const shells=reduced?[]:schedule(kind,random).map(s=>{
   const H=(kind==='pr-opened'?62:84+random()*36),x=anchor[0]+(s.lean??(random()-.5)*(kind==='release'?150:76));
   const at=[x,Math.min(anchor[1]-H,sky-34-random()*26)-(s.finale?random()*40:0)-(s.rise||0)];
   return particles({...s,from:[anchor[0]+(random()-.5)*6,anchor[1]],at,water:waterUnder(x,ground[1],at[1])},random,colour,kind);
  });
  let count=shells.reduce((a,s)=>a+s.particles.length*(s.s.split?5:1),0);
  const room=PARTICLE_BUDGET-events.reduce((a,e)=>a+e.count,0);
  if(count>room){const keep=Math.max(.2,room/count);for(const s of shells)s.particles.length=Math.max(4,Math.floor(s.particles.length*keep));count=shells.reduce((a,s)=>a+s.particles.length*(s.s.split?5:1),0);}
  const waveAt=reduced?0:(shells[0]?.burst??0);
  return {id,kind,project,colour,anchor,ground,sky,buildings,shells,reduced,reach,waveAt,water:waterUnder(anchor[0],ground[1],anchor[1]-90),born:now,duration:durationOf(kind,reach,waveAt),count,windows:kind==='release'&&!reduced?buildingWindows(ids):[]};
 }
 function enqueue(e){if(seen.has(e.id))return;seen.add(e.id);queue.push(e);stats.queued++;}
 const words=()=>CAPTION[lang]||CAPTION.en;
 const projectsNow=()=>feed().flatMap(f=>f.projects||[]).filter(p=>p.mainPlot&&!p.closed&&gpu.growth.plots.get(p.mainPlot.id)).sort((a,b)=>(b.plots?.length||0)-(a.plots?.length||0));
 function showCaption(kind){
  if(!caption&&!panel)return;
  label??=Object.assign(document.createElement('div'),{id:'celebration-demo-caption'});
  label.setAttribute('role','status');
  if(!panel)Object.assign(label.style,{position:'fixed',left:'50%',bottom:'86px',transform:'translateX(-50%)',padding:'3px 10px',font:'12px ui-monospace,Menlo,monospace',letterSpacing:'.12em',color:'#dfe6ee',background:'rgba(3,4,9,.78)',border:'1px solid rgba(138,150,166,.35)',borderRadius:'3px',pointerEvents:'none',zIndex:5});
  if(!label.isConnected)(panel||document.body).append(label);
  label.textContent=`DEMO · ${words()[kind]??kind}${motion.matches?' · reduced motion':''}`;
 }
 function play(kind,project){if(!project)return;queue.push({id:`demo|${kind}|${project.id}|${performance.now()}`,kind,project});stats.queued++;frameWanted=true;showCaption(kind);}
 // Test stand panel: the project select, these three fireworks and, on the live city, the taxi buttons (demo-panel.js).
 function buildPanel(){
  const projects=projectsNow();if(!projects.length||typeof document==='undefined')return;
  ({panel,picker}=buildDemoPanel({projects,lang,taxis:taxis?.(),district:district&&createDistrictDemo({live,...district()}),fireworks:ORDER.map(k=>[k,words()[k]]),project:id=>projectsNow().find(p=>p.id===id),play,say:showCaption}));
 }
 // A demo page follows the server: when the stand restarts it with a fresh build, reload.
 if(demo&&typeof EventSource==='function'){let lost=false;const es=new EventSource('/events');es.addEventListener('error',()=>{lost=true;});es.addEventListener('open',()=>{if(lost)location.reload();});}
 function update(now){
  if(panelOn&&!panel)buildPanel();
  if(cycle){
   if(now>=demoNext&&!events.length&&!queue.length){
    const project=(picker&&projectsNow().find(p=>p.id===picker.value))||projectsNow()[0];
    if(project){const kind=only||ORDER[demoIndex++%3];queue.push({id:`demo|${kind}|${now}`,kind,project});stats.queued++;showCaption(kind);}
   }
  }
  if(!demo)for(const f of feed()){
   const list=Array.isArray(f.celebrations)?f.celebrations:[];
   // The first view of a source only marks what already happened: nothing replays on page load.
   if(!seenSources.has(f.src)){seenSources.add(f.src);for(const c of list)seen.add(c?.id);for(const id of f.atLoad||[])seen.add(id);continue;}
   if(live.replaying)continue;
   for(const c of list){
    if(!c||typeof c.id!=='string'||!KINDS[c.kind]||seen.has(c.id))continue;
    const age=Date.now()-Date.parse(c.ts);
    if(!(age>=-60000&&age<LIVE_AGE)){seen.add(c.id);continue;}
    const project=(f.projects||[]).find(p=>p.id===c.project);
    if(!project){seen.add(c.id);stats.skipped++;continue;}
    enqueue({id:c.id,kind:c.kind,project});
   }
  }
  events=events.filter(e=>now-e.born<e.duration);
  while(queue.length&&events.length<MAX_LIVE){const e=start(queue.shift(),now);if(e){events.push(e);stats.started++;}else stats.skipped++;}
  if(cycle&&!events.length&&!queue.length&&demoNext<now)demoNext=now+1200;
  stats.maxLive=Math.max(stats.maxLive,events.length);
  // Release: the central buildings' windows flash with the passing wave.
  const state=gpu.windowState,base=live.baseState,S=gpu.scene;
  for(const e of events){if(!e.windows.length)continue;const age=now-e.born;
   for(const i of e.windows){const k=i*4;if(base&&base[k+3]===0)continue;const w=S.windows[i],d=Math.min(e.reach,groundDistance(w,e.ground));
    const on=Math.min(1,waveGain(e,d,age));if(on<=0)continue;state[k]=1;state[k+1]=.9;state[k+2]=.76;state[k+3]=Math.max(state[k+3],.92*on);}}
 }
 // One building's share of the wave at this age. Reduced motion: no front, one steady soft light.
 function waveGain(e,d,age){
  if(e.reduced)return .7*smooth(0,800,age)*(1-smooth(e.duration-2500,e.duration,age));
  return passGain(e.kind,d,e.reach,age-e.waveAt);
 }
 function glow(g,p,r,c,a){if(a<=.004)return;const q=g.createRadialGradient(0,0,0,p[0],p[1],r);q.addColorStop(0,[...c.map(v=>v/255),a]);q.addColorStop(1,[...c.map(v=>v/255),0]);g.fillStyle=q;g.fillRect(p[0]-r,p[1]-r,2*r,2*r);}// a quad: the radial ramp is already zero past r
 function dot(g,p,r,c,a){if(a<=.004)return;g.fillStyle=[...c.map(v=>v/255),a];g.beginPath();g.ellipse(p[0],p[1],r,r,0,0,Math.PI*2);g.fill();}
 // Water under a shell, mirrored across the shoreline below it. Depth .96 sits between land (.95)
 // and water (.97), so the depth test keeps all of it on the water, like the static reflections.
 // Every star becomes a vertical streak with a slow horizontal shimmer at ~60% of its brightness.
 const WATER=.96,SKY=-.97,HAZE=.93;
 const mirrored=(w,p)=>[p[0],w.y+(w.y-p[1])*w.q];
 function streak(g,w,q,c,a,age,R){
  if(!w||a<=.01||q[1]>=w.y)return;
  const len=clamp(w.span*.3,8,36)*clamp(R/36,.6,1.4),y=mirrored(w,q)[1],x=q[0]+1.2*Math.sin(age/310+q[1]*.21)+.7*Math.sin(age/190+q[0]*.17),pts=[[x,y-len*.5],[x,y],[x,y+len]];
  g.depth=WATER;g.ribbon(pts,[...c.map(v=>v/255),.65*a],[0,6,0],[0,1,0],8);g.ribbon(pts,[...mix(WHITE,c,.5).map(v=>v/255),.6*a],[0,1.6,0],[0,1,0],9);g.depth=SKY;
 }
 // A broad coloured pool and a few soft ripples under the burst, scaled by its radius.
 function pool(g,w,x,y,R,c,k,t,ripples=true){
  if(!w||k<=.01||y>=w.y)return;const cy=mirrored(w,[x,y])[1];g.depth=WATER;
  g.save();g.translate(x,cy);g.scale(R*2.4,Math.max(w.span*.55,R*w.q*2,8));glow(g,[0,0],1,mix(c,WHITE,.2),.55*k);g.restore();
  if(ripples)for(let j=0;j<3;j++){const r=R*(.45+.4*j)+t*12,pts=Array.from({length:33},(_,i)=>[x+Math.cos(i/16*Math.PI)*r,cy+Math.sin(i/16*Math.PI)*r*.22]);
   g.ribbon(pts,[...c.map(v=>v/255),.32*k*(1-j*.25)],pts.map(()=>3.2),pts.map(()=>1),8);}
  g.depth=SKY;
 }
 // Blurred light of one burst: soft radial ramps with long falloff, all additive. A bloom at the centre
 // (radius 60-140 by shell size, up in .1 s, gone over ~1.2 s), a tall haze behind it that buildings
 // silhouette, a coloured wash on the rooftops under it and a broad, faint wash on the streets.
 const bloomRadius=sh=>sh.bloom??=60+80*clamp((sh.s.R-18)/24)*(sh.finale?.6:1);
 function blur(g,e,sh,t){
  if(t>=2)return;const Rb=bloomRadius(sh),k=smooth(0,.1,t)*(1-smooth(.1,1.3,t)),slow=smooth(0,.15,t)*(1-smooth(.2,1.9,t));
  const c=e.colour,hot=mix(WHITE,c,.35),[x,y]=sh.at,floor=e.ground[1];
  g.depth=SKY;glow(g,sh.at,Rb,mix(c,WHITE,.25),.42*k);glow(g,sh.at,Rb*.3,hot,.3*k*(1-smooth(.1,.6,t)));
  // Sky haze: tall soft column from above the burst down to the roofs, behind the buildings.
  g.depth=HAZE;g.save();g.translate(x,(y+floor)/2);g.scale(Rb*.85,Math.max(Rb*1.6,(floor-y)*.5+Rb));glow(g,[0,0],1,c,.32*slow);g.restore();
  // Street wash under the burst: broad and low, on the ground between the buildings.
  g.save();g.translate(x,floor);g.scale(Rb*2.2,Rb*1.1);glow(g,[0,0],1,c,.3*slow);g.restore();
  // Rooftop wash: the central buildings' roofs, brightest right under the burst.
  const q=g.createRadialGradient(0,0,0,x,floor-20,Rb*1.5);q.addColorStop(0,[...mix(c,WHITE,.2).map(v=>v/255),.5*slow]);q.addColorStop(1,[...c.map(v=>v/255),0]);g.fillStyle=q;
  for(const b of e.buildings)for(const f of b.roofs){const pts=f.points.map(p=>gpu.growth.point(b.b.id,p));if(Math.abs(pts[0][0]-x)>Rb*1.5)continue;g.depth=gpu.depth(f.layer)-.000002;g.beginPath();pts.forEach((p,i)=>i?g.lineTo(...p):g.moveTo(...p));g.closePath();g.fill();}
  g.depth=SKY;
 }
 const life=sh=>sh.life??=Math.max(...sh.particles.map(p=>p.life))/1000*(sh.s.split?1.6:1);
 function position(sh,p,t){
  const s=sh.s;if(!s.split||t<s.split*p.life/1000){const d=travel(p.v,s.k,s.G,t);return[sh.at[0]+d[0],sh.at[1]+d[1]];}
  const ts=s.split*p.life/1000,d=travel(p.v,s.k,s.G,ts);return[sh.at[0]+d[0],sh.at[1]+d[1]];
 }
 function drawShell(g,e,sh,age){
  const s=sh.s;let n=0;
  // Rocket: a warm streak rising from the roof, easing out into the burst point.
  if(!sh.finale&&age>=sh.launch&&age<sh.burst){const u=(age-sh.launch)/(sh.burst-sh.launch),at=v=>{const k=1-(1-v)**2;return[sh.from[0]+(sh.at[0]-sh.from[0])*k,sh.from[1]+(sh.at[1]-sh.from[1])*k];};
   const head=at(u),pts=[0,.25,.5,.75,1].map(i=>at(Math.max(0,u-.22*(1-i))));const track=[sh.from,...[.25,.5,.75,1].map(i=>at(u*i))];
   g.depth=SKY;g.ribbon(track,[...mix(WARM,e.colour,.35).map(v=>v/255),.22],track.map((_,i)=>4+10*i/4),track.map((_,i)=>(i/4)**1.5),8);// faint blurred streak along the track
   g.trail(pts,[1,.9,.78,1],2.2);dot(g,head,1.5,WARM,1);glow(g,head,10,WARM,.85);glow(g,head,26,mix(WARM,e.colour,.3),.32);streak(g,sh.water,head,WARM,1,age,sh.R*.5);}
  const t=(age-sh.burst)/1000;if(t<0)return 0;
  blur(g,e,sh,t);
  if(t<life(sh)){const k=smooth(0,.2,t)*(1-smooth(.3,1,t/life(sh)));pool(g,sh.water,sh.at[0],sh.at[1],sh.R*(e.kind==='release'?1.3:1),e.colour,k,t);}
  for(const p of sh.particles){
   const life=p.life/1000;if(t>life+(s.split?life*.6:0))continue;
   const u=t/life,fade=smooth(0,.08,t)*(1-smooth(.55,1,u)),core=mix(WHITE,p.colour,smooth(.05,.4,u));
   if(s.split&&t>=s.split*life){
    // Crossette: each star splits into four at half life.
    const ts=s.split*life,origin=position(sh,p,t),tt=t-ts,lu=tt/(life*.6),a=Math.atan2(p.v[1],p.v[0]);
    for(let j=0;j<4;j++){const b=a+Math.PI/4+j*Math.PI/2,v=[Math.cos(b)*sh.R*.9,Math.sin(b)*sh.R*.9],d=travel(v,2.2,s.G,tt),q=[origin[0]+d[0],origin[1]+d[1]],f=1-smooth(.5,1,lu);
     dot(g,q,1.3,mix(WHITE,p.colour,.6),f);glow(g,q,7,p.colour,.85*f);streak(g,sh.water,q,p.colour,f,age,sh.R*.7);n++;}
    continue;
   }
   const q=position(sh,p,t);
   if(s.trail){const pts=[];for(let i=6;i>=0;i--){const tt=Math.max(0,t-s.trail/1000*i/6);const d=travel(p.v,s.k,s.G,tt);pts.push([sh.at[0]+d[0],sh.at[1]+d[1]]);}
    g.trail(pts,[...p.colour.map(v=>v/255),fade],s.thick?3:1.8);}
   dot(g,q,(s.thick?1.9:1.4)*(1-.3*u),core,fade);glow(g,q,s.thick?10:8,p.colour,.9*fade);glow(g,q,2.6,WHITE,.5*fade*(1-u));streak(g,sh.water,q,p.colour,fade,age,sh.R*(s.trail?1.3:1));n++;
  }
  return n;
 }
 // Facade light on each building's own walls only, at the wall's depth.
 function facade(g,e,b,gain,c,band=false){
  if(gain<=.003)return;
  for(const f of b.walls){
   const q=f.points.map(p=>gpu.growth.point(b.b.id,p));g.depth=gpu.depth(f.layer)-.000002;
   if(band){const m=(a,t)=>[a[0]+(t[0]-a[0])*.58,a[1]+(t[1]-a[1])*.58];g.uplight([q[3],q[2],m(q[1],q[2]),m(q[0],q[3])],c,gain,null);}
   else{g.fillStyle=[...c.map(v=>v/255),Math.min(1,gain*.6)];g.beginPath();q.forEach((p,i)=>i?g.lineTo(...p):g.moveTo(...p));g.closePath();g.fill();g.uplight(q,c,Math.min(1,gain*1.5),null);}
  }
 }
 function draw(now){
  if(!events.length)return;
  const g=gpu.painter;g.save();g.globalCompositeOperation='lighter';let n=0;
  for(const e of events){
   const age=now-e.born,end=1-smooth(e.duration-1500,e.duration,age);
   if(e.kind==='pr-opened'){const at=e.reduced?0:(e.shells[0]?.burst??0),last=e.shells.at(-1)?.burst??at,k=e.reduced?smooth(0,600,age)*end:smooth(at-150,at+250,age)*(1-smooth(last+400,last+800,age));
    for(const b of e.buildings)if(b.main)facade(g,e,b,1.1*k,mix(WHITE,e.colour,.45),true);}
   else{// The wave: project colour, white core at the peak. Release: the main tower keeps an afterglow.
    const lastPass=e.waveAt+PASSES.release.at(-1).at+WAVE.rise,after=e.kind==='release'&&!e.reduced?.75*smooth(lastPass,lastPass+300,age)*(1-smooth(lastPass+AFTERGLOW-600,lastPass+AFTERGLOW,age)):0;
    for(const b of e.buildings){const k=Math.max(waveGain(e,b.d,age),b.main?after:0);facade(g,e,b,WAVE.gain*k,mix(e.colour,WHITE,.7*smooth(.6,1,k)));}}
   g.depth=-.97;
   if(e.reduced){// One soft bloom above the district; no bursts.
    const k=smooth(0,1200,age)*end,R=e.kind==='release'?100:72;glow(g,[e.anchor[0],e.anchor[1]-90],R,mix(WHITE,e.colour,.5),.6*k);glow(g,[e.anchor[0],e.anchor[1]-90],20,WHITE,.28*k);
    pool(g,e.water,e.anchor[0],e.anchor[1]-90,R*.45,e.colour,k,0,false);}
   else for(const sh of e.shells)n+=drawShell(g,e,sh,age);
  }
  g.restore();stats.particles=n;stats.maxParticles=Math.max(stats.maxParticles,n);
 }
 return {update,draw,stats,play,get events(){return events;},get queue(){return queue;},demo,motion,
  // Box worth framing for the demo: the main plot and the sky its fireworks use, not the whole district.
  // Once per demo request: the newest event's frame, then null until the next request.
  takeFrame(){const e=events.at(-1);if(!frameWanted||!e)return null;frameWanted=false;const [x,y]=e.anchor,top=Math.min(y-175,e.sky-100),w=e.water||e.shells[0]?.water;return [[x-170,top],[x+170,Math.max(y+75,w?w.y+w.span+40:0)]];}};
}
