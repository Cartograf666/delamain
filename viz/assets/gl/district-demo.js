// Test stand, "District" group (demo-panel.js): local replays of district events through the page's own mechanisms:
// the capture response, the growth wave, the hub question signal and district work. Nothing reaches the journal, the
// hub home or the server; the page's real data is swapped only in memory and Reset puts the original back.
export const CAPTURE_SIZES=Object.freeze({small:1,medium:3,large:16});
export const GROWTH_PLOTS=4;
const D2=(a,b)=>(a[0]-b[0])**2+((a[1]-b[1])*2)**2;
// The response router needs a road within 38 (x, 2y) units of the lot; keep a margin so every chosen lot routes.
export function nearRoad(roads,limit=30){
 const segs=[];for(const r of roads||[])for(let i=1;i<r.p.length;i++)segs.push([r.p[i-1],r.p[i]]);
 return p=>segs.some(([a,b])=>{const dx=b[0]-a[0],dy=(b[1]-a[1])*2,t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*2*dy)/(dx*dx+dy*dy||1)));return D2(p,[a[0]+dx*t,a[1]+dy/2*t])<=limit*limit;});
}

// The project's own plots nearest the land of its nearest neighbour, nearest first: where a capture or a growth step
// between the two happens. The main plot never changes hands.
export function borderPlots(snapshot,plots,id,n,main,keep=()=>true){
 const own=[],other=[];
 for(const o of snapshot?.plotOwners||[]){const g=plots.get(o.id);if(!g||o.reserved||!o.owner||o.id===main)continue;(o.owner===id?own:other).push({id:o.id,owner:o.owner,p:g.ground});}
 if(!own.length||!other.length)return {neighbour:null,plots:[]};
 let best=null;for(const a of own)for(const b of other){const d=D2(a.p,b.p);if(!best||d<best.d)best={d,owner:b.owner};}
 const theirs=other.filter(b=>b.owner===best.owner);
 const ranked=own.filter(a=>keep(a.p)).map(a=>({id:a.id,d:Math.min(...theirs.map(b=>D2(a.p,b.p)))})).sort((a,b)=>a.d-b.d||a.id-b.id);
 return {neighbour:best.owner,plots:ranked.slice(0,n).map(a=>a.id)};
}
// What /city returns once a project closes (city_sim.go): closed, no main plot, every plot vacant at level 0.
export function closedView(city,id){
 return {...city,projects:city.projects.map(p=>p.id===id?{...p,closed:true,mainPlot:null,plots:[],area:0}:p),
  plotOwners:city.plotOwners.map(o=>o.owner===id?{...o,owner:'',level:0,dark:false}:o)};
}

export function createDistrictDemo({live,response,towers=new Map(),machines=new Map(),placeHubs=()=>{},growth=()=>null,
 emit=src=>globalThis.dispatchEvent?.(new CustomEvent('city-growth-state',{detail:src})),doc=globalThis.document}){
 const gpu=live.gpu,asked=new Map(),working=new Set();let closed=null,waving=false,plays=0;
 const find=id=>{for(const [src,m]of machines){const p=m.cityData?.projects?.find(q=>q.id===id);if(p)return {src,m,p};}return {};};
 // Fire, growth and closure show in «Районы»: switch the page there with its own button.
 function territories(){const ui=growth();if(ui&&ui.mode!=='territories')doc?.querySelector('#growth-controls button[data-mode="territories"]')?.click();return !!live.districtsVisible;}
 let routable=null;
 function border(id,n,keep){const {m,p}=find(id);if(!p||p.closed)return null;const b=borderPlots(m.cityData,gpu.growth.plots,id,n,p.mainPlot?.id,keep);return b.plots.length?b:null;}
 function reopen(){if(!closed)return;const s=closed;closed=null;
  // A fresh /city may have replaced the swapped data meanwhile; never put stale data over it.
  if(s.m.cityData===s.city){s.m.cityData=s.data;s.m.cityStages=s.stages;}placeHubs();emit(s.src);}
 function unask(id){for(const t of asked.get(id)||[]){const v=t.questions-1;delete t.questions;t.questions=v;}asked.delete(id);}
 const api={
  sizes:CAPTURE_SIZES,
  // Captures of plots from the nearest neighbour to this project, as growth.snapshot.aggressiveCaptures carries them.
  capture(id,size){const n=CAPTURE_SIZES[size],b=n&&border(id,n,routable??=nearRoad(response.roads));const shown=live.districtsVisible;if(!b||!territories())return 0;
   // Switched just now: let the response adopt the snapshot date first, or its first frame drops the queue.
   if(!shown)response.update(globalThis.performance?.now()??0);
   return response.play(b.plots.map(plotId=>({plotId,from:b.neighbour,to:id})),`demo|${id}|${size}|${++plays}`);},
  // Border plots with a building where there are any: an empty lot shows its new owner only as a faint ground tint.
  grow(id){const ui=growth(),at=gpu.growth.buildingAtGround,b=(at&&border(id,GROWTH_PLOTS,p=>!!at(p[0],p[1])))||border(id,GROWTH_PLOTS);if(!b||!ui?.replay||!territories())return 0;
   ui.replay([{from:b.neighbour,to:id,plots:b.plots}]);waving=true;return b.plots.length;},
  // One closed project at a time; closing another reopens the first.
  close(id){if(closed?.id===id){reopen();return false;}reopen();const {src,m,p}=find(id);if(!p||p.closed)return null;
   const city=closedView(m.cityData,id),q=city.projects.find(x=>x.id===id);
   closed={id,src,m,city,data:m.cityData,stages:m.cityStages};
   m.cityStages=new Map([...(m.cityStages||[])].map(([s,list])=>[s,list.map(x=>x.id===id?q:x)]));m.cityData=city;
   territories();placeHubs();emit(src);return true;},
  // The open-question count the hub's beacon and sign read: one more while on; updates from /state still land.
  question(id){if(asked.has(id)){unask(id);return false;}
   const hubs=[...towers.values()].filter(t=>t.kind!=='owner'&&t.project===id&&t.open!==false);if(!hubs.length)return null;
   for(const t of hubs){let v=t.questions||0;Object.defineProperty(t,'questions',{configurable:true,enumerable:true,get:()=>v+1,set:x=>{v=x;}});}
   asked.set(id,hubs);return true;},
  get workReady(){return typeof gpu.districtWork?.setDemo==='function';},
  work(id,level){if(!api.workReady)return false;gpu.districtWork.setDemo(id,level);if(level)working.add(id);else working.delete(id);return true;},
  isClosed:id=>closed?.id===id,isAsked:id=>asked.has(id),
  reset(){response.clearDemo?.();response.stats.frame=false;if(waving){growth()?.replay?.(null);waving=false;}reopen();
   for(const id of [...asked.keys()])unask(id);for(const id of working)gpu.districtWork?.setDemo?.(id,0);working.clear();}
 };
 return api;
}
