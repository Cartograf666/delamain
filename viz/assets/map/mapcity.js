"use strict";
// Fixed accepted city. LayerCity owns shared telemetry bins and camera caches.
async function prepareMapCity() {
  const started = performance.now();
  const json = async name => { const r = await fetch(`${ASSET}/assets/map/${name}`); if (!r.ok) throw Error(`Map ${name}: HTTP ${r.status}`); return r.json(); };
  const picture = name => new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = () => reject(Error(`Map ${name} missing`)); i.src = `${ASSET}/assets/map/${name}`; });
  const [data, roads, pack, ground, streets, roofs] = await Promise.all([json("city.json"), json("roads.json"), json("pack.json"), LIVE?null:picture("ground.png"), LIVE?null:picture("street-glow.png"),LIVE?null:picture("roof-glow.png")]);
  const manifest=await json("manifest.json"), images=new Map();
  if(qs.get("sprites")==="1")await Promise.all(manifest.families.flatMap(f=>Object.values(f.states)).map(file=>new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>{images.set(file,i);resolve();};i.onerror=()=>reject(Error(`Map sprite ${file} missing`));i.src=`${ASSET}/${file}`;})));
  const city = new MapCity(data, roads, pack, ground, streets, manifest, images);
  city.roofs=roofs;
  if(!LIVE && qs.get('kit')==='1' && qs.get('sprites')!=='1'){
    const script=name=>new Promise((resolve,reject)=>{const el=document.createElement('script');el.src=`${ASSET}/assets/${name}`;el.onload=resolve;el.onerror=()=>reject(Error('Pilot script '+name));document.head.appendChild(el);});
    if(!LIVE){await script('kit/assemble.js');await script('kit/styles.js');}await script('notable/placement.js');
    const kit=LIVE?null:await KitStyles.loadBrowser(`${ASSET}/assets/kit/`,{cacheBytes:64*1024*1024});
    const notable=await fetch(`${ASSET}/assets/notable/manifest.json`).then(r=>r.json()),landmarks=await json('landmarks.json'),pictures=new Map();
    await Promise.all(Object.values(notable.models).flatMap(m=>[m.base,...Object.values(m.states)]).map(file=>new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>{pictures.set(file,img);resolve();};img.onerror=reject;img.src=`${ASSET}/assets/notable/${file}`;})));
    if(LIVE){city.notable=notable;city.notableImages=pictures;}else city.installKit(kit,notable,landmarks,pictures);
  }
  city.install();
  if(LIVE){
    for(const name of ['model.js','render.js','alerts.js','aquarium.js'])await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=`${ASSET}/assets/live/${name}`;s.onload=resolve;s.onerror=reject;document.head.appendChild(s);});
    for(const file of ['vendor/earcut.js','runtime.js','live.js'])await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=`${ASSET}/assets/gl/${file}`;s.onload=resolve;s.onerror=reject;document.head.appendChild(s);});
    await installGPUCity(city);
  }
  city.loadMs = performance.now() - started; return city;
}
class MapCity extends LayerCity {
  constructor(data, roads, pack, ground, streets, manifest, images=new Map()) {
    super({load:{workersAtFull:10,hysteresis:.025}}, new Map());
    this.data=data; this.roads=roads; this.pack=pack; this.ground=ground; this.streets=streets;
    this.scale=pack.scale; this.ca=Math.cos(data.g*Math.PI/180); this.sa=Math.sin(data.g*Math.PI/180);
    this.districtRevision=new Map(DISTRICTS.map(d=>[d.id,0])); this.timings=[]; this.routing=new Map();
    this.boxes=data.boxes.map((b,id)=>this.makeBox(b,id)); this.ordered=pack.order.map(id=>this.boxes[id]);
    this.ownerBox=this.boxes[pack.keys.owner]; this.hubBoxes=pack.keys.hubs.map(id=>this.boxes[id]);
    this.spriteManifest=manifest; this.spriteImages=images; this.cabAltitude=manifest.traffic?.cabAltitude??.18; this.assignSprites();
    this.rebuilds.architecture=0;this.rebuilds.scene=0;
    for(const d of DISTRICTS)this.rebuilds[`windows:${d.id}`]=0;
    this.rebuilds['windows:owner']=0;
  }
  toGrid(x,y) { const dx=x-this.data.center[0],dy=y-this.data.center[1]; return [dx*this.ca+dy*this.sa,-dx*this.sa+dy*this.ca]; }
  toSource(x,y) { return [this.data.center[0]+x*this.ca-y*this.sa,this.data.center[1]+x*this.sa+y*this.ca]; }
  world(x,y) { return {x:CX+x/this.scale,y:CY+y/this.scale}; }
  project(x,y,h=0) { return [x-y,(x+y)/2-h*6.5]; }
  reference(x,y,h=0) { const [a,b]=this.project(x,y,h),[cu,cv]=this.data.core; return [1200-cu+cv+a,648-(cu+cv)/2+b]; }
  fade(x,y) { const [sx,sy]=this.toSource(x,y),v=clamp(Math.min(sx,2000-sx,sy,1125-sy)/210,0,1); return v*v*(3-2*v); }
  color(c,f=1) { return `rgb(${c.map((v,i)=>Math.floor([7,11,20][i]+(v-[7,11,20][i])*f)).join(',')})`; }
  path(points) { const p=new Path2D(); points.forEach(([x,y],i)=>i?p.lineTo(x,y):p.moveTo(x,y));p.closePath();return p; }
  makeBox(b,id) {
    const [x0,y0,x1,y1,raw,kind]=b,h=raw**1.25,f=this.fade((x0+x1)/2,(y0+y1)/2);
    const type=['hero','land'].includes(kind)?kind:h<3?'low':h<8?'mid':'high';
    const pal={low:[[36,52,104],[25,37,78],[58,80,138],[255,196,120]],mid:[[44,86,178],[30,60,132],[86,136,224],[200,226,255]],high:[[70,136,236],[44,96,190],[170,216,255],[232,244,255]],hero:[[130,196,255],[82,146,240],[236,248,255],[255,255,255]],land:[[226,158,62],[168,112,40],[255,214,130],[255,244,200]]}[type];
    const q=(x,y,z=0)=>this.project(x,y,z),left=[q(x0,y1),q(x1,y1),q(x1,y1,h),q(x0,y1,h)],right=[q(x1,y1),q(x1,y0),q(x1,y0,h),q(x1,y1,h)],roof=[q(x0,y0,h),q(x1,y0,h),q(x1,y1,h),q(x0,y1,h)];
    const silhouette=this.path([left[0],left[1],right[1],right[2],roof[0],left[3]]);
    const centre=this.world((x0+x1)/2,(y0+y1)/2);
    return {id,box:b,h,type,pal,f,d:this.pack.districts[id],...centre,size:Math.max(x1-x0,y1-y0)/this.scale,
      left:this.path(left),right:this.path(right),roof:this.path(roof),silhouette,windows:new Map(),
      corner:[q(x1,y1),q(x1,y1,h)],lift:h*6.5/this.scale,hkey:hash(`building:${id}`)};
  }
  assignSprites() {
    if(!this.spriteImages.size)return;
    const m=this.spriteManifest,rule=m.selection,keys=new Set([this.ownerBox.id,...this.hubBoxes.map(b=>b.id)]),placed=[];
    for(const b of this.boxes){const [x0,y0,x1,y1,h,kind]=b.box,w=x1-x0,d=y1-y0;
      if(kind!==rule.kind||h<rule.minHeight||Math.max(w,d)/Math.min(w,d)>=rule.maxFootprintRatio||keys.has(b.id))continue;
      const nearby=placed.filter(p=>Math.hypot(p.x-b.x,p.y-b.y)<6).sort((a,c)=>Math.hypot(a.x-b.x,a.y-b.y)-Math.hypot(c.x-b.x,c.y-b.y)).slice(0,4);
      const used=new Set(nearby.map(p=>p.sprite.id)),start=hash(`sprite:${b.id}`)%m.families.length;
      b.sprite=m.families[start];
      // Cycle from stable hash, avoiding already assigned close neighbours when possible.
      for(let j=0;j<m.families.length;j++){const f=m.families[(start+j)%m.families.length];if(!used.has(f.id)){b.sprite=f;break;}}
      b.spriteWidth=2*Math.min(w,d);b.spriteScale=b.spriteWidth/b.sprite.baseWidth;
      const [px,py]=this.project((x0+x1)/2+Math.min(w,d)/2,(y0+y1)/2+Math.min(w,d)/2);
      b.spriteOrigin=[px-b.sprite.anchor[0]*b.spriteScale,py-b.sprite.anchor[1]*b.spriteScale];
      b.lift=b.spriteWidth*b.sprite.roofLiftRatio/this.scale;placed.push(b);
    }
    this.spriteCount=placed.length;
  }
  paintSprite(b,level,mask=false) {
    const f=b.sprite,img=this.spriteImages.get(f.states[String(level)]),[x,y]=b.spriteOrigin;
    if(!mask)ctx.globalAlpha=b.f;
    ctx.drawImage(img,x,y,f.size[0]*b.spriteScale,f.size[1]*b.spriteScale);ctx.globalAlpha=1;
  }
  installKit(kit,notable,landmarks,pictures) {
    const started=performance.now();this.kit=kit;this.notable=notable;this.notableImages=pictures;this.landmarks=landmarks;
    this.reservation=NotablePlacement.validate(this.data,this.roads,this.pack,landmarks.placements,notable.models);
    const removed=new Set(this.reservation.removed),keys=new Set([this.ownerBox,...this.hubBoxes]);
    this.renderBoxes=this.boxes.filter(b=>!removed.has(b.id));
    for(const b of this.renderBoxes)if(!keys.has(b)){const [x0,y0,x1,y1,h,type]=b.box;b.kitInput={id:b.id,w:x1-x0,d:y1-y0,h,type,zone:b.d};}
    for(const [i,l]of landmarks.placements.entries()){
      const m=notable.models[l.model],r=NotablePlacement.rect(l,notable.models,false),b=this.makeBox([...r,(m.height/6.5)**.8,'b'],`notable-${i}`);
      b.notable=m;b.landmark=l;b.d=l.district;const [px,py]=this.project(...l.position);b.spriteOrigin=[px-m.anchor[0]/m.resolution,py-m.anchor[1]/m.resolution];this.renderBoxes.push(b);
    }
    this.ordered=NotablePlacement.order(this.renderBoxes);this.kitAssemblyMs=performance.now()-started;
  }
  pilotImage(b,state=0) {
    if(b.notable){const m=b.notable;return {base:this.notableImages.get(m.base),emissive:this.notableImages.get(m.states[state]),width:m.size[0],height:m.size[1],resolution:m.resolution,origin:b.spriteOrigin};}
    // Render at the next camera tier, never stretch a preassembled building.
    const resolution=Math.max(1,Math.min(4,Math.ceil(unit()/this.scale*DPR*2)/2));
    // Every district pass needs the same opaque occlusion mask. Retain one base per
    // building/tier outside the state LRU to prevent ten full-city cache thrashes.
    if(state===0&&b.pilotBase?.resolution===resolution)return b.pilotBase;
    const r=KitStyles.render(this.kit,b.kitInput,state,resolution),p=this.project(b.box[0],b.box[1]);
    const image={...r,origin:[p[0]-r.anchor[0]/resolution,p[1]-r.anchor[1]/resolution]};
    if(state===0)b.pilotBase={base:r.base,width:r.width,height:r.height,resolution,origin:image.origin};
    return image;
  }
  paintPilot(b,state,emission=false,mask=false) {
    if(emission&&state===0)return;
    const r=this.pilotImage(b,state);ctx.save();ctx.globalAlpha=mask?1:b.f;
    ctx.drawImage(emission?r.emissive:r.base,...r.origin,r.width/r.resolution,r.height/r.resolution);ctx.restore();
  }
  install() {
    G.nodes=this.pack.graph.nodes.map(([sx,sy],id)=>{const [x,y]=this.toGrid(sx,sy);return {...this.world(x,y),sx,sy,id,d:this.pack.graph.districts[id],adj:[]};});
    for(const [a,b,ri,connector,other] of this.pack.graph.edges){const na=G.nodes[a],nb=G.nodes[b],cls=this.roads.roads[ri].class,len=Math.hypot(na.x-nb.x,na.y-nb.y);na.adj.push({to:nb,len,hw:cls!=='street',cls,ri,connector,other});nb.adj.push({to:na,len,hw:cls!=='street',cls,ri,connector,other});}
    G.lots=this.renderBoxes||this.boxes;G.owner=this.ownerBox;G.owner.owner=true;G.holos=[];grid.clear();G.nodes.forEach(index);
    for(const d of DISTRICTS){const [x,y]=this.toGrid(...this.pack.seeds[d.id]);Object.assign(d,this.world(x,y));}
    const main=new Set(this.pack.graph.components[0]);
    for(const b of this.boxes)b.access=G.nodes.reduce((best,n)=>main.has(n.id)&&Math.hypot(n.x-b.x,n.y-b.y)<Math.hypot(best.x-b.x,best.y-b.y)?n:best,G.nodes[this.pack.graph.components[0][0]]);
    npcs.length=0;flyers.length=0;const r=mulberry(7);for(let k=0;k<45;k++)npcs.push(newNpc(r));
    this.fit();cam.x=cam.tx=BASE.x;cam.y=cam.ty=BASE.y;
  }
  fit() {
    if(!W||!H)return;
    // Frame the inhabited reference crop in the space beside the expanded roster.
    const left=W>700?Math.min(300,W*.22):12,right=24,top=112,bottom=65;
    const s=Math.min((W-left-right)/2050,(H-top-bottom)/910),[cu,cv]=this.data.core;K=s*this.scale;
    const centreX=(left+W-right)/2,centreY=(top+H-bottom)/2+H*.075;
    const refX=1200,refY=635;
    BASE={x:CX-CY+(cu-cv+(refX-1200))/this.scale+(W/2-centreX)/K,
      y:(CX+CY)/2+(cu+cv)/2/this.scale+(refY-648)/this.scale+(H/2+30-centreY)/K};
    MAPB={x0:Math.min(...G.nodes.map(n=>n.x)),x1:Math.max(...G.nodes.map(n=>n.x)),y0:Math.min(...G.nodes.map(n=>n.y)),y1:Math.max(...G.nodes.map(n=>n.y))};
  }
  placeHubs() {
    const taken=new Set([...towers.values()].map(t=>t.lot).filter(Boolean));
    for(const t of towers.values())if(!t.lot){const repo=machines.get(t.machine)?.stages.get(t.stage)?.repo||'',d=districtFor(repo),seed=DIST[d];
      const available=this.hubBoxes.filter(b=>!taken.has(b));
      const candidates=available.length?available:this.boxes.filter(b=>!b.owner&&!taken.has(b)).sort((a,b)=>b.h-a.h).slice(0,20);
      candidates.sort((a,b)=>Math.hypot(a.x-seed.x,a.y-seed.y)-Math.hypot(b.x-seed.x,b.y-seed.y)||a.id-b.id);
      t.lot=candidates[0];t.district=d;t.mapDistrict=t.lot.d;taken.add(t.lot);
    }
  }
  applyState(src,state) {
    const before=new Map([...this.loads].map(([id,l])=>[id,l.level]));super.applyState(src,state);
    for(const d of DISTRICTS)if(before.get(d.id)!==this.loads.get(d.id)?.level)this.districtRevision.set(d.id,this.districtRevision.get(d.id)+1);
  }
  stateFor(b) { return this.loads.get(b.d)?.level??50; }
  windowPaths(b,level,faceIndex) {
    const key=`${level}:${faceIndex}`;if(b.windows.has(key))return b.windows.get(key);
    const [x0,y0,x1,y1]=b.box,h=b.h,floors=Math.max(1,Math.floor(h*.95));
    const a=faceIndex?[x1,y1]:[x0,y1],z=faceIndex?[x1,y0]:[x1,y1],cols=Math.max(1,Math.floor(Math.hypot(z[0]-a[0],z[1]-a[1])/3.2));
    const paths=[];
    for(let i=0;i<floors;i++){
      const path=new Path2D(),grad=1+.55*(1-i/floors)**2;
      for(let j=0;j<cols;j++){
        const threshold=(hash(`${b.id}:${faceIndex}:${i}:${j}:window`)+.5)/4294967296;
        const band=(i/floors*.30+threshold*.70)*(faceIndex?1.25:1);
        if(band>=level/100)continue;
        const t0=(j+.18)/cols,t1=(j+.82)/cols,z0=h*(i+.22)/floors,z1=h*(i+.78)/floors;
        const p=[a[0]+(z[0]-a[0])*t0,a[1]+(z[1]-a[1])*t0],q=[a[0]+(z[0]-a[0])*t1,a[1]+(z[1]-a[1])*t1];
        const points=[this.project(...p,z0),this.project(...q,z0),this.project(...q,z1),this.project(...p,z1)];
        points.forEach(([x,y],k)=>k?path.lineTo(x,y):path.moveTo(x,y));path.closePath();
      }
      paths.push({path,color:this.color(b.pal[3].map(v=>Math.min(255,Math.floor(v*.8*grad))),b.f)});
    }
    b.windows.set(key,paths);return paths;
  }
  sceneTransform() { const p=P(CX,CY),s=unit()/this.scale;ctx.translate(...p);ctx.scale(s,s); }
  visible(b) { const p=P(b.x,b.y),r=b.size*unit()*2;return b.f>=.02&&p[0]+r>-staticPad&&p[0]-r<W+staticPad&&p[1]+r>-staticPad&&p[1]-b.lift*unit()-r<H+staticPad; }
  cached(name,signature,draw) { const before=this.rebuilds[name],t=performance.now(),parentPad=staticPad;try{super.cached(name,signature,draw);}finally{staticPad=parentPad;}if(before!==this.rebuilds[name])this.timings.push({name,ms:performance.now()-t,signature});if(this.timings.length>500)this.timings.splice(0,100); }
  drawBackdrop() { ctx.fillStyle='#070b14';ctx.fillRect(0,0,W,H);
    this.labelObstacles=['hud > .brand','sub','tr','roster','ticker','rtoggle'].map(id=>id.includes(' > ')?document.querySelector('#'+id):document.getElementById(id)).filter(e=>e&&e.getClientRects().length).map(e=>{const r=e.getBoundingClientRect();return {left:r.left-6,right:r.right+6,top:r.top-6,bottom:r.bottom+6};});this.labelReservations=[];
  }
  drawStatic() {
    this.cached('surface','fixed',()=>{const [x,y]=P(CX,CY),s=unit()/this.scale;const [cu,cv]=this.data.core,ox=1200-cu+cv,oy=648-(cu+cv)/2;
      ctx.drawImage(this.ground,x-ox*s,y-oy*s,2400*s,1200*s);
      ctx.save();ctx.globalCompositeOperation='screen';ctx.globalAlpha=.55;ctx.filter=`blur(${3*s}px)`;ctx.drawImage(this.streets,x-ox*s,y-oy*s,2400*s,1200*s);ctx.restore();});
    this.drawCabShadows();
    const limits=['claude','codex'].map(e=>Math.round(owner.limits[e]?.left??-1)).join(':');
    const signature=[...this.districtRevision.values(),limits].join(':');
    // Compose district caches once per revision/camera tier; steady frames copy a single architectural pass.
    this.cached('scene',signature,()=>this.drawScene(limits));
    if(this.roofs&&!this.kit){const [x,y]=P(CX,CY),s=unit()/this.scale,[cu,cv]=this.data.core;ctx.save();ctx.globalCompositeOperation='screen';ctx.drawImage(this.roofs,x-(1200-cu+cv)*s,y-(648-(cu+cv)/2)*s,2400*s,1200*s);ctx.restore();}
  }
  drawScene(limits) {
    // A newly centred composite needs complete overscan on both sides. Reusing a shifted inner
    // raster would leave its old far edge uncovered after the outer cache pans again.
    for(const [name,cached] of this.cache)if(name!=='surface'&&name!=='scene'&&(cached.x!==cam.x||cached.y!==cam.y))this.cache.delete(name);
    this.cached('architecture','fixed',()=>{ctx.save();this.sceneTransform();
      if(this.kit)for(const l of this.landmarks.placements){const r=NotablePlacement.rect(l,this.notable.models);ctx.fillStyle='#162c49';ctx.fill(this.path([[r[0],r[1]],[r[2],r[1]],[r[2],r[3]],[r[0],r[3]]].map(p=>this.project(...p))));}
      for(const b of this.ordered)if(this.visible(b))this.drawBuilding(b,'architecture');ctx.restore();
    });
    for(const d of DISTRICTS)this.cached(`windows:${d.id}`,`${this.districtRevision.get(d.id)}`,()=>this.drawWindows(d.id));
    this.cached('windows:owner',limits,()=>this.drawWindows('owner'));
  }
  // One replacement boundary for the future facade kit. Inputs remain fixed authored boxes and district bins.
  drawBuilding(b,pass,district) {
    if(pass==='architecture'){
      if(b.kitInput||b.notable){this.paintPilot(b,0);return;}
      if(b.sprite){this.paintSprite(b,0);return;}
      for(const [i,face] of [b.left,b.right,b.roof].entries()){ctx.fillStyle=this.color(b.pal[i],b.f);ctx.fill(face);}
      ctx.strokeStyle=this.color(b.pal[2].map(v=>Math.min(255,v+46)),b.f);ctx.lineWidth=b.type==='low'?.5:1;
      ctx.stroke(b.roof);ctx.beginPath();ctx.moveTo(...b.corner[0]);ctx.lineTo(...b.corner[1]);ctx.stroke();return;
    }
    ctx.globalCompositeOperation='destination-out';ctx.fillStyle='#000';if(b.kitInput||b.notable)this.paintPilot(b,0,false,true);else if(b.sprite)this.paintSprite(b,0,true);else ctx.fill(b.silhouette);ctx.globalCompositeOperation='source-over';
    if(district==='owner'?b!==this.ownerBox:b===this.ownerBox||b.d!==district)return;
    if(b.kitInput||b.notable){this.paintPilot(b,this.stateFor(b),true);return;}
    if(b.sprite){this.paintSprite(b,this.stateFor(b));return;}
    for(let face=0;face<2;face++){
      let level=this.stateFor(b);
      if(b===this.ownerBox)level=clamp(Math.round(owner.limits[face?'codex':'claude']?.left??0),0,100);
      else if(this.hubBoxes.includes(b))level=100;
      for(const {path,color} of this.windowPaths(b,level,face)){ctx.fillStyle=color;ctx.fill(path);}
    }
  }
  drawWindows(district) {
    ctx.save();this.sceneTransform();
    for(const b of this.ordered)if(this.visible(b))this.drawBuilding(b,'windows',district);ctx.restore();
    const canvas=ctx.canvas,tmp=document.createElement('canvas');tmp.width=canvas.width;tmp.height=canvas.height;
    tmp.getContext('2d').drawImage(canvas,0,0);ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.globalCompositeOperation='screen';
    for(const [radius,alpha] of [[2.5,.22],[8,.12],[24,.08]]){ctx.filter=`blur(${radius*unit()/this.scale*DPR}px)`;ctx.globalAlpha=alpha;ctx.drawImage(tmp,0,0);}ctx.restore();
  }
  towerLift(t) { return (t.kind==='owner'?this.ownerBox:t.lot)?.lift||0; }
  hitKey(px,py) {
    for(const t of [...towers.values(),owner].reverse()){const b=t.kind==='owner'?this.ownerBox:t.lot;if(!b)continue;
      const p=P(CX,CY),s=unit()/this.scale;ctx.save();ctx.setTransform(1,0,0,1,0,0);const hit=ctx.isPointInPath(b.silhouette,(px-p[0])/s,(py-p[1])/s);ctx.restore();if(hit)return t;
    }return null;
  }
  drawKeys(tall,now) {
    for(const t of tall){const b=t.kind==='owner'?this.ownerBox:t.lot;if(!b)continue;const [x,y]=P(b.x,b.y);selRing(t,x,y,b.size*unit()*.9,now);
      const bl=blink(t,now);if(bl>=0||t.pulse>.01)glow(x,P(b.x,b.y,b.lift)[1],unit()*.9,bl>=0?C.gold:t.color,bl>=0?.1+bl*.25:t.pulse*.3);t.pulse*=.965;}
    this.drawSign(owner,now);
  }
  drawHaze() {
    const g=ctx.createRadialGradient(W/2,H*.52,Math.min(W,H)*.35,W/2,H*.52,Math.max(W,H)*.7);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(0,0,0,.42)');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  }
  labelPosition(x,y,width,height=19,label='') {
    if(x<-width||x>W+width||y<-30||y>H+30)return null;
    const obstacles=[...(this.labelObstacles||[]),...(this.labelReservations||[])],candidates=[[x,y]];
    for(const r of obstacles)candidates.push([r.right+width/2+8,y],[r.left-width/2-8,y],[x,r.bottom+height+8],[x,r.top-8]);
    let best=null,score=Infinity;
    for(let [px,py] of candidates){px=clamp(px,width/2+8,W-width/2-8);py=clamp(py,height+8,H-12);
      const rect={left:px-width/2,right:px+width/2,top:py-height,bottom:py+5};
      const overlap=obstacles.reduce((n,r)=>n+(rect.left<r.right&&rect.right>r.left&&rect.top<r.bottom&&rect.bottom>r.top?1:0),0);
      const cost=overlap*1e7+(px-x)**2+(py-y)**2;if(cost<score){score=cost;best={x:px,y:py,...rect,overlap,label};}
    }
    if(best)this.labelReservations.push(best);return best;
  }
  signAnchor(t) {
    const signature=[...towers.values()].map(t=>t.lot?.id).join(':');
    if(this.signSignature!==signature){this.signSignature=signature;this.signAnchors=new Map();}
    if(!this.signAnchors.has(t.key)){
      const b=t.kind==='owner'?this.ownerBox:t.lot,[x0,y0,x1,y1]=b.box;let result=null;
      for(let j=20;j>=5&&!result;j--)for(let face=0;face<2&&!result;face++)for(let i=2;i<19&&!result;i++){
        const wx=CX+(face?x1:x0+(x1-x0)*i/20)/this.scale,wy=CY+(face?y0+(y1-y0)*i/20:y1)/this.scale,z=b.lift*j/20;
        if(this.hitKey(...P(wx,wy,z))===t)result=[wx,wy,z];
      }
      this.signAnchors.set(t.key,result||[b.x,b.y,b.lift]);
    }return P(...this.signAnchors.get(t.key));
  }
  drawSign(t,now) {
    const anchor=this.signAnchor(t),label=t.kind==='owner'?T.owner:t.label;
    ctx.font=`${Math.max(10*UI,Math.min(16*UI,unit()*1.05))}px ui-monospace,Menlo,monospace`;
    const w=ctx.measureText(label).width+12,p=this.labelPosition(anchor[0],anchor[1]-12,w,19,label);if(!p)return;
    const color=t.kind==='owner'?C.gold:blink(t,now)>=0?C.gold:C.ink;
    ctx.strokeStyle=rgba(color,.55);ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(...anchor);ctx.lineTo(p.x,p.y+4);ctx.stroke();
    ctx.fillStyle='rgba(3,7,16,.8)';ctx.fillRect(p.left,p.top,w,p.bottom-p.top);ctx.textAlign='center';ctx.fillStyle=rgba(color,t.open===false?.5:.94);ctx.fillText(label,p.x,p.y);ctx.textAlign='left';
  }
  drawDistrictNames() {
    const occupied=[...towers.values(),owner].map(t=>{const b=t.kind==='owner'?this.ownerBox:t.lot;const [x,y]=P(b.x,b.y,b.lift*.55);return {x,y,r:35};});
    for(const c of cabs.values()){const [x,y]=P(c.x,c.y,c.z);occupied.push({x,y,r:18});}
    ctx.font=`${Math.max(10,Math.min(14,unit()*1.3))*UI}px ui-monospace,Menlo,monospace`;ctx.textAlign='center';
    for(const d of DISTRICTS){const [x,y]=P(d.x,d.y),w=ctx.measureText(d.name).width+14;
      const options=[[0,24],[0,50],[-60,36],[60,36],[0,-24],[-90,-24],[90,-24]];
      const score=([dx,dy])=>occupied.reduce((s,p)=>s+(Math.abs(x+dx-p.x)<w/2+p.r&&Math.abs(y+dy-p.y)<p.r+12?1:0),0);
      const [dx,dy]=options.reduce((a,b)=>score(b)<score(a)?b:a),p=this.labelPosition(x+dx,y+dy,w,19,d.name);if(!p)continue;occupied.push({x:p.x,y:p.y,r:w/2});
      ctx.fillStyle='rgba(3,7,16,.72)';ctx.fillRect(p.left,p.y-12,w,18);ctx.fillStyle=rgba(TINT[d.id],.82);ctx.fillText(d.name,p.x,p.y);
    }ctx.textAlign='left';
  }
  drawCab(c,now) {
    const img=sprites[cabSprite(c)]||sprites.flyer;if(!img||c.landed)return;
    const [x,y]=P(c.x,c.y,c.z),w=unit()*.95;
    c.trail.push([c.x,c.y,c.z,now]);while(c.trail.length&&now-c.trail[0][3]>550)c.trail.shift();
    ctx.strokeStyle=rgba(c.color,.62);ctx.lineWidth=Math.max(.8,unit()*.08);ctx.beginPath();
    c.trail.forEach((p,i)=>{const q=P(p[0],p[1],p[2]);i?ctx.lineTo(...q):ctx.moveTo(...q);});ctx.stroke();
    glow(x,y,Math.max(6,w*.85),c.color,.55+c.pulse*.18);selRing(c,x,y,w*.6,now);
    if(cam.z>=1.8){ctx.save();ctx.translate(x,y);if(c.dir&&c.dir[0]-c.dir[1]<0)ctx.scale(-1,1);ctx.drawImage(img,-w/2,-w/2,w,w);ctx.restore();}
    ctx.fillStyle='#f0fbff';ctx.beginPath();ctx.arc(x,y,Math.max(1.5,Math.min(2.5,unit()*.17)),0,Math.PI*2);ctx.fill();
    if(hover===c||pinned===c){ctx.font=`${11*UI}px ui-monospace,Menlo,monospace`;ctx.textAlign='center';ctx.fillStyle=C.ink;ctx.fillText(c.label,x,y-w*.6);ctx.textAlign='left';}c.pulse*=.965;
  }
  shortest(start,end) {
    const key=start.id;if(!this.routing.has(key)){
      const dist=Array(G.nodes.length).fill(Infinity),prev=Array(G.nodes.length).fill(-1),visited=new Set();dist[start.id]=0;
      const heap=[[0,start.id]],push=v=>{heap.push(v);let i=heap.length-1;while(i){const p=(i-1)>>1;if(heap[p][0]<=v[0])break;heap[i]=heap[p];i=p;}heap[i]=v;};
      const pop=()=>{const top=heap[0],v=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let j=i*2+1;if(j+1<heap.length&&heap[j+1][0]<heap[j][0])j++;if(heap[j][0]>=v[0])break;heap[i]=heap[j];i=j;}heap[i]=v;}return top;};
      while(heap.length){const [cost,a]=pop();if(visited.has(a))continue;visited.add(a);for(const e of G.nodes[a].adj){const d=cost+e.len*({avenue:.65,collector:.8,street:1.35}[e.cls]);if(d<dist[e.to.id]){dist[e.to.id]=d;prev[e.to.id]=a;push([d,e.to.id]);}}}
      this.routing.set(key,prev);
    }
    const prev=this.routing.get(key),path=[end];let i=end.id;while(i!==start.id&&prev[i]>=0){i=prev[i];path.push(G.nodes[i]);}return i===start.id?path.reverse():[start];
  }
  route(node,seed) {
    const main=this.pack.graph.components[0],target=G.nodes[main[hash(`${seed}:destination`)%main.length]],out=this.shortest(node,target);
    return out.concat(out.slice(0,-1).reverse());
  }
  lanePosition(a,b,t,path,index,side=1) {
    const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1;
    const edge=a.adj?.find(e=>e.to===b),lane=({avenue:2.3,collector:1.3,street:.55}[edge?.cls]||.55)/this.scale;
    const ramp=Math.min(1,t*len/(lane*3),(1-t)*len/(lane*3)),offset=lane*Math.sin(clamp(ramp,0,1)*Math.PI/2)*side;
    let x=a.x+dx*t,y=a.y+dy*t;
    // Tiny quadratic fillets replace the corner inside the painted junction; zero lane offset at its centre.
    const radius=Math.min(1.3/this.scale,len*.2);
    const round=(p,v,n,tt,r)=>{
      const lp=Math.hypot(p.x-v.x,p.y-v.y),ln=Math.hypot(n.x-v.x,n.y-v.y);
      const inx=v.x+(p.x-v.x)*r/lp,iny=v.y+(p.y-v.y)*r/lp,outx=v.x+(n.x-v.x)*r/ln,outy=v.y+(n.y-v.y)*r/ln,u=1-tt;
      return {x:u*u*inx+2*u*tt*v.x+tt*tt*outx,y:u*u*iny+2*u*tt*v.y+tt*tt*outy};
    };
    const ra=path&&index>0?Math.min(radius,Math.hypot(a.x-path[index-1].x,a.y-path[index-1].y)*.2):0;
    const rb=path&&index+2<path.length?Math.min(radius,Math.hypot(b.x-path[index+2].x,b.y-path[index+2].y)*.2):0;
    if(ra&&t*len<ra){const v=round(path[index-1],a,b,.5+t*len/(2*ra),ra);x=v.x;y=v.y;}
    else if(rb&&(1-t)*len<rb){const v=round(a,b,path[index+2],.5-(1-t)*len/(2*rb),rb);x=v.x;y=v.y;}
    return {x:x-dy/len*offset,y:y+dx/len*offset,dir:[dx*side,dy*side]};
  }
  advance(mover,dt,speed,node,seed,returning=false) {
    if(!mover.layerRoute){mover.layerRoute=this.route(node,seed);mover.layerSegment=0;mover.layerT=0;}
    const path=mover.layerRoute;if(path.length<2){mover.x=node.x;mover.y=node.y;return true;}
    let distance=dt*speed,arrived=false;
    for(let guard=0;guard<200;guard++){
      const a=path[mover.layerSegment],b=path[mover.layerSegment+1],len=Math.hypot(b.x-a.x,b.y-a.y)||1e-9;
      const left=(returning?mover.layerT:1-mover.layerT)*len;
      if(distance<left){mover.layerT+=(returning?-distance:distance)/len;break;}
      distance-=left;
      if(returning){if(mover.layerSegment===0){mover.layerT=0;arrived=true;break;}mover.layerSegment--;mover.layerT=1;}
      else{mover.layerSegment=(mover.layerSegment+1)%(path.length-1);mover.layerT=0;}
      if(distance<1e-10)break;
    }
    const target=returning?-1:1;mover.mapLaneSide=(mover.mapLaneSide??1)+clamp(target-(mover.mapLaneSide??1),-dt*2,dt*2);
    Object.assign(mover,this.lanePosition(path[mover.layerSegment],path[mover.layerSegment+1],mover.layerT,path,mover.layerSegment,mover.mapLaneSide));
    return arrived;
  }
  drive(car,dt) { this.advance(car,dt,car.speed,car.a,`ground:${car.a.id}`); }
  fly(cab,now,dt) {
    const node=cab.home.lot.access;
    if(!cab.mapStarted){cab.layerRoute=this.route(node,cab.key);cab.layerSegment=0;cab.layerT=0;cab.x=node.x;cab.y=node.y;cab.z=this.cabAltitude;cab.mapStarted=true;}
    cab.px=cab.x;cab.py=cab.y;
    // Return along the existing route cursor. A reappearing worker continues here, without a stale route reset.
    const arrived=this.advance(cab,dt,CRUISE*(cab.working?1.3:1),node,cab.key,!!cab.leaving);
    if(cab.leaving&&arrived){cab.z=Math.max(0,cab.z-dt*1.3);if(cab.z===0)cab.landed=true;}
    else{cab.landed=false;cab.z=Math.min(this.cabAltitude,cab.z+dt*1.3);}
  }
}
