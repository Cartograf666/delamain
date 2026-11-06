import {districtBoundaries} from './district-boundary.js';
import {createProjectIdentity} from './project-identity.js';
// Opt-in presentation only. The server owns territory, light, levels and history.
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const rgb = hex => /^#[\da-f]{6}$/i.test(hex || '') ? hex.slice(1).match(/../g).map(x => parseInt(x, 16)) : [150, 180, 210];
// Lift luminance for readable labels and emissive light, preserving each server hue.
const displayColours=new Map();
export function displayColour(hex) {
  if(displayColours.has(hex))return displayColours.get(hex);
  const c=rgb(hex), linear=v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;};
  for(let t=0;t<=1;t+=.025){const out=c.map(v=>Math.round(v+(255-v)*t));if(out.map(linear).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0)>=.26){const result='#'+out.map(v=>v.toString(16).padStart(2,'0')).join('');displayColours.set(hex,result);return result;}}
  return '#ffffff';
}
export function hueColour(source, hex, amount, lift=0) {
  const tint=rgb(displayColour(hex)),peak=Math.max(...tint);
  const luma=source[0]*.2126+source[1]*.7152+source[2]*.0722;
  const luminance=luma*(1-amount)+(luma*1.15+lift)*amount;
  return tint.map(v=>luminance*((1-amount)+amount*v/peak));
}
export function dailyChanges(current, previous) {
  const before = new Map(previous.plotOwners.map(p => [p.id, p.owner]));
  const groups = new Map();
  for (const p of current.plotOwners) {
    const from = before.get(p.id);
    if (p.reserved || from === undefined || from === p.owner) continue;
    const key = JSON.stringify([from, p.owner]);
    if (!groups.has(key)) groups.set(key, {from, to: p.owner, plots: []});
    groups.get(key).plots.push(p.id);
  }
  return [...groups.values()].sort((a, b) => b.plots.length - a.plots.length);
}

// Territory growth as a gradual recolouring: each changed plot cross-fades from its previous owner's tint to the new
// one over FADE.plot ms. Starts spread over the rest of FADE.total in a loose order (a plot may swap with a neighbour in
// the order, never more) from the new owner's remaining land outwards, so the border creeps. plots: id -> {ground}.
export const FADE=Object.freeze({total:25000,plot:10000,loose:.6});
export function fadePlan(batch, plots, plotOwners) {
  const out=[];
  for(const change of batch||[]){
    if(!change.to)continue;const moved=new Set(change.plots);
    const anchor=(plotOwners||[]).filter(o=>o.owner===change.to&&!o.reserved&&!moved.has(o.id)).map(o=>plots.get(o.id)?.ground).filter(Boolean);
    const ranked=change.plots.map((id,i)=>{const g=plots.get(id)?.ground;return {id,d:g&&anchor.length?Math.min(...anchor.map(a=>Math.hypot(a[0]-g[0],(a[1]-g[1])*2))):i};}).sort((a,b)=>a.d-b.d||a.id-b.id);
    let h=2166136261;for(const c of JSON.stringify([change.from,change.to,change.plots]))h=Math.imul(h^c.charCodeAt(0),16777619);
    const random=()=>((h=Math.imul(h^h>>>15,2246822507)^Math.imul(h^h>>>13,3266489909))>>>0)/4294967296,n=ranked.length;
    ranked.forEach((p,i)=>{const r=n>1?clamp((i+(random()-.5)*2*FADE.loose)/(n-1),0,1):0;out.push({plot:p.id,from:change.from,to:change.to,start:r*(FADE.total-FADE.plot),duration:FADE.plot});});
  }
  return out;
}
// 0 = the previous owner's tint, 1 = the new owner's.
export const fadeLevel=(p,t)=>{const u=clamp((t-p.start)/p.duration,0,1);return u*u*(3-2*u);};

// Raise building b by lift x its height: wall vertices stretch from their ground line, roof and equipment translate
// together by the full wall height, so front-wall ground vertices stay fixed.
export function liftPoint(building, p, lift) {
  const walls=building.surfaces.filter(f=>f.kind==='wall');let height=0;
  for(const f of walls){const [a,b,c]=f.points,h=b[1]-c[1];height=Math.max(height,h);if(p[0]<Math.min(a[0],b[0])-.001||p[0]>Math.max(a[0],b[0])+.001)continue;const groundY=a[1]+(p[0]-a[0])*(b[1]-a[1])/(b[0]-a[0]);if(p[1]<=groundY+.001&&p[1]>=groundY-h-.001)return [p[0],p[1]-Math.max(0,groundY-p[1])*lift];}
  return [p[0],p[1]-height*lift];
}

// Explicit geometry links: simulation plot IDs and render building IDs are different namespaces.
export function createGrowthModel(scene, geometry) {
  const buildings = new Map(scene.buildings.map(b => [b.id, b]));
  const plots = new Map(geometry.plots.map(p=>[p.id,p]));
  const buildingPlots = new Map(geometry.plots.filter(p=>p.building!=null).map(p=>[p.building,p.id]));
  const identity=createProjectIdentity(scene,geometry);
  let snapshot = null, owners = new Map(), projects = new Map(), enabled = false, districtTone = false;
  const hubScale = new Map();
  let colourByBuilding=new Map(), fading=new Map();
  // A fading building (fadePlan): its tinted value blended from what the previous owner's tint gave.
  const was=(id,now,of,plain)=>{const f=fading.get(id);if(!f)return now;const p=projects.get(f.from),old=p&&!p.closed?of(p):plain;return old.map((v,i)=>v+(now[i]-v)*f.k);};
  const tintOf=p=>{const c=rgb(displayColour(p.colour)),peak=Math.max(...c);return c.map(v=>v/peak*1.15);};
  let boundaryData=null, boundaries={paths:new Map(),at:()=>null};
  const strength = e => !e?.project || e.plot.dark || e.project.closed ? 0 : clamp(e.project.light ?? 1,0,1);
  const fixed = new Set(scene.pads.map(p => {
    const x=p[5][0]*.75,y=p[5][1]*.75-40;
    return scene.buildings.reduce((a,b)=>Math.hypot(b.ground[0]-x,b.ground[1]-y)<Math.hypot(a.ground[0]-x,a.ground[1]-y)?b:a).id;
  }));
  function entry(id) {
    const plot=owners.get(buildingPlots.get(id)), project=projects.get(plot?.owner), b=buildings.get(id);
    return plot && !plot.reserved && b?.kind==='b' ? {plot, project, b} : null;
  }
  return {
    buildings, plots, buildingPlots,
    identity(id) {return enabled&&districtTone ? identity.entry(id) : null;},
    buildingAtGround:identity.atGround, buildingAtRoof:identity.atRoof,
    lightColour(id,c) {if(!enabled||!districtTone)return c;const tint=colourByBuilding.get(id),luma=c[0]*.2126+c[1]*.7152+c[2]*.0722;return was(id,tint?tint.map(v=>v*luma):c,p=>tintOf(p).map(v=>v*luma),c);},
    // id -> {from, k}: buildings of changed plots while their tint cross-fades; an empty map ends it.
    fade(map) {fading=map||new Map();},
    project(id) {return projects.get(id)||null;},
    plotEntry(id) {if(!enabled)return null;const plot=owners.get(id),geometry=plots.get(id),project=projects.get(plot?.owner);return plot&&!plot.reserved&&geometry?{plot,geometry,project,b:buildings.get(geometry.building)}:null;},
    boundary(id) {return boundaries.paths.get(id)||[];},
    territoryAt(x,y) {return boundaries.at(x,y);},
    set(data, on, tone = true) {snapshot=data; enabled=on; districtTone=tone;
      if(on&&data&&boundaryData!==data){boundaries=districtBoundaries(geometry,data.plotOwners||[]);boundaryData=data;} owners=new Map((data?.plotOwners||[]).map(p=>[p.id,p]));projects=new Map((data?.projects||[]).map(p=>[p.id,p]));
      identity.set(data,boundaries.at);colourByBuilding=new Map();
      for(const b of scene.buildings){const e=identity.entry(b.id);if(strength(e)){const c=rgb(displayColour(e.project.colour)),peak=Math.max(...c);colourByBuilding.set(b.id,c.map(v=>v/peak*1.15));}}
    },
    entry(id) {return enabled ? entry(id) : null;},
    // A hub's own height factor wins over the district level, including on pad-bearing (fixed) buildings.
    point(id, p) {const k=hubScale.get(id);if(k!=null)return k===1?p:liftPoint(buildings.get(id),p,k-1);
      const e=entry(id);if(!e?.project || fixed.has(id))return p;return liftPoint(e.b,p,clamp(e.plot.level||0,0,3)*.09);},
    // id -> height factor of a hub building (main.js animates it); 1 or delete restores the plain point().
    setHubScale(id,k){if(k==null)hubScale.delete(id);else hubScale.set(id,k);},
    hubScale(id){return hubScale.get(id)??1;},
    material(id, c) {
      if(!enabled)return c;
      if(districtTone){const e=identity.entry(id),amount=Math.sqrt(strength(e))*.76;return was(id,amount?hueColour(c,e.project.colour,amount,12):c,p=>hueColour(c,p.colour,Math.sqrt(clamp(p.light??1,0,1))*.76,12),c);}
      const e=entry(id);if(!e)return c;
      const gain=e.plot.dark?.32:e.project?.closed?.32:e.project?.light==null?1:.65+.35*clamp(e.project.light,0,1);
      return c.map(x=>x*gain);
    },
    windows(data, windows) {
      if(!enabled)return data;
      const out=new Float32Array(data);
      for(let i=0;i<windows.length;i++){
        const id=scene.owners[Math.floor(windows[i][2])],e=districtTone?identity.entry(id):entry(id);if(!e)continue;const k=i*4;
        if(districtTone){const tint=colourByBuilding.get(id),luma=data[k]*.2126+data[k+1]*.7152+data[k+2]*.0722,now=tint?tint.map(v=>luma*v):[data[k],data[k+1],data[k+2]];
          const c=fading.size?was(id,now,p=>tintOf(p).map(v=>luma*v),[data[k],data[k+1],data[k+2]]):now;for(let j=0;j<3;j++)out[k+j]=c[j];continue;}
        if(!e.project||e.project.closed){out[k+3]=0;continue;}
        const c=rgb(displayColour(e.project.colour)),light=e.plot.dark?.035:clamp(e.project.light,.05,1);
        for(let j=0;j<3;j++)out[k+j]=c[j]/255*light;
      }
      return out;
    },
    get districtTone(){return districtTone;}, get snapshot(){return snapshot;}, get enabled(){return enabled;}
  };
}

export function installGrowthUI(H) {
  const {live, machines, sources, loadCity, canvas, lang, drawLabels} = H;
  const ru=lang==='ru', text=(a,b)=>ru?a:b, gpu=live.gpu;
  let mode='activity', selected=null, source=sources[0], batch=[], started=0, previousKey='', loading=false, replayed=false, plan=null, planFor=null;
  let current=null, hovered=null, focused=null, anchor=null, hitFaces=[];
  live.districtsVisible=false;
  const labels=document.createElement('div');labels.id='growth-labels';document.body.append(labels);
  const labelButtons=new Map();
  function highlight(){return mode==='territories'?(hovered||focused||selected):null;}
  function bindHighlight(b,id){
    b.onpointerenter=e=>{if(e.pointerType==='mouse')hovered=id;};
    b.onpointerleave=()=>{if(hovered===id)hovered=null;};
    b.onpointerdown=e=>{if(e.pointerType==='mouse')e.preventDefault();};
    b.onfocus=()=>{focused=id;hovered=null;anchor=null;};
    b.onblur=()=>{if(focused===id)focused=null;};
  }
  function clearTransient(){hovered=null;focused=null;anchor=null;}
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  const nav=document.createElement('div');nav.id='growth-controls';nav.setAttribute('role','group');nav.setAttribute('aria-label',text('Вид города','City view'));
  for(const [id,label]of [['activity',text('Активность','Activity')],['territories',text('Районы','Districts')]]){const b=document.createElement('button');b.type='button';b.dataset.mode=id;b.textContent=label;b.setAttribute('aria-pressed',String(id===mode));b.onclick=()=>setMode(id);nav.append(b);}
  document.getElementById('tr').prepend(nav);
  // Keep source selection in the existing compact controls, without a catalogue.
  if(sources.length>1){const select=document.createElement('select');select.setAttribute('aria-label',text('Источник','Source'));
    for(const s of sources){const o=document.createElement('option');o.value=s;o.textContent=machines.get(s)?.name||s;select.append(o);}
    select.onchange=()=>{source=select.value;selected=null;clearTransient();batch=[];started=0;sync();loadPrevious();};nav.append(select);}
  function project(id){return current?.projects.find(p=>p.id===id);}
  function sync(){current=machines.get(source)?.cityData||null;gpu.setGrowth(current,mode!=='activity',mode==='territories');hitFaces=mode==='activity'?[]:gpu.scene.buildings.flatMap(b=>b.surfaces.map(f=>{const q=f.points.map(p=>gpu.growth.point(b.id,p));return {b,layer:f.layer,q,x0:Math.min(...q.map(p=>p[0])),x1:Math.max(...q.map(p=>p[0])),y0:Math.min(...q.map(p=>p[1])),y1:Math.max(...q.map(p=>p[1]))};})).sort((a,b)=>b.layer-a.layer);if(selected&&!project(selected))selected=null;if(hovered&&!project(hovered))hovered=null;if(focused&&!project(focused))focused=null;}
  function open(id){selected=project(id)?id:null;}
  async function loadPrevious(){
    if(mode==='activity'||!current||loading)return;
    const key=`${source}|${current.date}`;if(key===previousKey)return;loading=true;
    const date=new Date(current.date+'T12:00:00Z');date.setUTCDate(date.getUTCDate()-1);
    try{const r=await fetch(`${source}/city?date=${date.toISOString().slice(0,10)}`);if(!r.ok)throw Error(r.status);const old=await r.json();if(`${source}|${current?.date}`!==key)return;
      if(!replayed)batch=dailyChanges(current,old);previousKey=key;let seen=false;try{seen=sessionStorage.getItem('city-growth:'+key)==='seen';}catch{}
      if(!seen&&mode!=='activity'){started=performance.now();try{sessionStorage.setItem('city-growth:'+key,'seen');}catch{}}
    }catch{/* A missing prior day must not obscure today's districts. */}finally{loading=false;}
  }
  function setMode(next){mode=next;live.districtsVisible=mode==='territories';selected=null;clearTransient();labels.replaceChildren();labelButtons.clear();if(mode==='activity'){started=0;gpu.growthWave=null;}document.body.classList.toggle('growth-active',mode!=='activity');for(const b of nav.querySelectorAll('button'))b.setAttribute('aria-pressed',String(b.dataset.mode===mode));sync();if(mode!=='activity'){loadCity(source);loadPrevious();}}
  function projectAt(x,y){if(mode==='activity'||!current)return null;const v=live.cameraView(),k=Math.max(canvas.clientWidth/gpu.scene.w,canvas.clientHeight/gpu.scene.h)*v.z,wx=x/k+v.x,wy=y/k+v.y;
    // Frontmost visible facade wins; ground tests are limited to the real footprint.
    const inside=(p,q)=>{let c=false;for(let i=0,j=q.length-1;i<q.length;j=i++)if((q[i][1]>p[1])!==(q[j][1]>p[1])&&p[0]<(q[j][0]-q[i][0])*(p[1]-q[i][1])/(q[j][1]-q[i][1])+q[i][0])c=!c;return c;};
    const found=hitFaces.find(f=>wx>=f.x0&&wx<=f.x1&&wy>=f.y0&&wy<=f.y1&&inside([wx,wy],f.q))?.b;
    const associated=gpu.growth.identity(found?.id)?.project;if(associated)return associated.id;
    const owner=current.plotOwners.find(p=>p.id===gpu.growth.buildingPlots.get(found?.id));if(owner?.owner&&!owner.reserved){return owner.owner;}
    // A visible landmark/owner facade blocks ground selection behind it.
    if(found)return null;
    for(const o of current.plotOwners){const geometry=gpu.growth.plots.get(o.id);if(geometry&&inside([wx,wy],geometry.footprint)){return o.owner&&!o.reserved?o.owner:null;}}return mode==='territories'?gpu.growth.territoryAt(wx,wy):null;
  }
  function hit(x,y,pointerType){const id=projectAt(x,y);anchor=[x,y];selected=pointerType==='mouse'?null:id;hovered=pointerType==='mouse'?id:null;return id;}
  function hoverMap(x,y){hovered=x==null?null:projectAt(x,y);anchor=x==null?null:[x,y];return hovered;}
  canvas.addEventListener('pointerleave',()=>{hovered=null;});
  addEventListener('blur',clearTransient);
  addEventListener('keydown',e=>{if(e.key==='Escape'&&mode!=='activity'){selected=null;clearTransient();document.activeElement?.blur();}});
  function beforeFrame(now){
    if(mode==='activity')return;
    // Arrival objects retain their original colour when the filter is disabled.
    for(const b of live.aq.beams){if(!b.growthOriginal)b.growthOriginal=b.col;const e=gpu.growth.entry(b.building?.id),anchored=current?.projects.find(p=>{const pad=live.data.pads[p.tower];return pad&&Math.hypot(pad.g[0]-b.x,pad.g[1]-b.bot)<.1;}),owner=anchored||e?.project;b.col=owner?rgb(displayColour(owner.colour)):b.growthOriginal;}
    // Reduced motion: the snapshot's owners at once. Otherwise the changed plots cross-fade (fadePlan) over FADE.total.
    if(reducedMotion.matches||!started||now-started>=FADE.total){gpu.growthWave=null;return;}
    if(planFor!==batch){planFor=batch;plan=fadePlan(batch,gpu.growth.plots,current?.plotOwners);}
    gpu.growthWave={t:now-started,plan};
  }
  function afterFrame(now){if(mode==='activity')return false;const rects=drawLabels(current,mode,gpu.growth,displayColour,highlight(),anchor)||[];
    const visible=new Set();for(const r of rects){visible.add(r.id);let b=labelButtons.get(r.id);if(!b){b=document.createElement('button');b.type='button';b.onclick=e=>{anchor=null;if(e.pointerType==='touch'||e.pointerType==='pen')open(r.id);};b.dataset.project=r.id;bindHighlight(b,r.id);labels.append(b);labelButtons.set(r.id,b);}
      b.setAttribute('aria-label',`${r.id} · ${project(r.id)?.plots?.length||0} ${text('участков','plots')}`);
      b.classList.toggle('growth-label-hidden',!r.visible);Object.assign(b.style,{left:r.x+'px',top:r.y+'px',width:r.w+'px',height:r.h+'px'});}
    for(const [id,b]of labelButtons)if(!visible.has(id)){b.remove();labelButtons.delete(id);if(focused===id)focused=null;}return true;}
  const changed=e=>{if(e.detail===source){sync();if(mode!=='activity')loadPrevious();}};addEventListener('city-growth-state',changed);
  const originalSet=setMode; // Keep beam restoration inside this isolated adapter.
  for(const b of nav.querySelectorAll('button'))b.onclick=()=>{if(b.dataset.mode==='activity')for(const beam of live.aq.beams)if(beam.growthOriginal)beam.col=beam.growthOriginal;originalSet(b.dataset.mode);};
  if (new URLSearchParams(location.search).get('demo') === 'capture') setMode('territories');
  else sync();
  const timer=setInterval(()=>{if(!document.hidden)loadCity(source);},60000);
  addEventListener('pagehide',()=>clearInterval(timer),{once:true});
  // Test stand: replay the territory-growth recolouring for these changes ([{from,to,plots}]): the plots show the
  // previous owner's tint and cross-fade to today's. A day load does not replace it; null stops it.
  const replay=changes=>{batch=changes||[];started=changes?performance.now():0;replayed=!!changes;};
  return {replay,get mode(){return mode;},get selected(){return selected;},get snapshot(){return current;},get changes(){return batch;},get waveStarted(){return started;},get highlighted(){return highlight();},projectAt,hoverMap,sync,hit,beforeFrame,afterFrame,open};
}
