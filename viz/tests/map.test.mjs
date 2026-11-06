// Fixed-map geometry/telemetry/routing tests, no DOM or live hub home.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const root=new URL('../assets/map/',import.meta.url),read=n=>JSON.parse(fs.readFileSync(new URL(n,root),'utf8'));
const data=read('city.json'),roads=read('roads.json'),pack=read('pack.json'),manifest=read('manifest.json');
const hash=s=>{let h=2166136261;for(const ch of String(s))h=Math.imul(h^ch.charCodeAt(0),16777619);return h>>>0;};
class Path { constructor(){this.points=[];}moveTo(x,y){this.points.push([x,y]);}lineTo(x,y){this.points.push([x,y]);}closePath(){} }
const districts=['core','foundry','docks','bazaar','heights','sprawl','smelter','riviera','wastes'].map(id=>({id}));
const box={Path2D:Path,hash,clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),CX:54,CY:64,DISTRICTS:districts,DIST:Object.fromEntries(districts.map(d=>[d.id,d])),G:{},grid:new Map(),index:()=>{},npcs:[],flyers:[],mulberry:()=>()=>.5,newNpc:()=>({}),W:1600,H:1000,K:4,BASE:{},MAPB:null,cam:{},performance,CRUISE:3.2,districtFor:r=>r};
vm.createContext(box);vm.runInContext(fs.readFileSync(new URL('../assets/style/layers.js',import.meta.url),'utf8')+'\nglobalThis.LayerCity=LayerCity;',box);
const source=fs.readFileSync(new URL('mapcity.js',root),'utf8');vm.runInContext(source+'\nglobalThis.City=MapCity;',box);
const city=new box.City(data,roads,pack,null,null,manifest);city.install();
assert.equal(city.boxes.length,4367);assert.equal(roads.roads.length,308);assert.equal(new Set(roads.roads.map(r=>r.street)).size,56);assert.equal(pack.graph.components.length,1);assert.deepEqual(pack.graph.isolatedRoads,[]);
assert.equal(pack.order.length,4367);assert.equal(new Set(pack.order).size,4367);
// P from render.py, SS=1. Source->grid rotation checked separately from isometric lift.
for(const [sx,sy,h] of [[1000,562.5,0],[470,272,3],[1710,890,12],[1200,410,27]]){
 const g=data.g*Math.PI/180,dx=sx-1000,dy=sy-562.5,x=dx*Math.cos(g)+dy*Math.sin(g),y=-dx*Math.sin(g)+dy*Math.cos(g);
 const expected=[1200-data.core[0]+data.core[1]+x-y,648-(data.core[0]+data.core[1])/2+(x+y)/2-h*6.5],grid=city.toGrid(sx,sy),p=city.reference(...grid,h);
 assert.ok(Math.hypot(p[0]-expected[0],p[1]-expected[1])<1e-10);const back=city.toSource(...grid);assert.ok(Math.hypot(back[0]-sx,back[1]-sy)<1e-10);
}
const nearest=(p,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p[0]-a[0]-dx*t,p[1]-a[1]-dy*t);};
const segments=roads.roads.flatMap((r,ri)=>r.points.slice(1).map((b,i)=>({a:r.points[i],b,ri,cls:r.class}))),buckets=new Map();
for(const s of segments)for(let x=Math.floor((Math.min(s.a[0],s.b[0])-10)/32);x<=Math.floor((Math.max(s.a[0],s.b[0])+10)/32);x++)for(let y=Math.floor((Math.min(s.a[1],s.b[1])-10)/32);y<=Math.floor((Math.max(s.a[1],s.b[1])+10)/32);y++){const key=x+','+y;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(s);}
const roadDistance=p=>Math.min(...(buckets.get(Math.floor(p[0]/32)+','+Math.floor(p[1]/32))||[]).map(s=>nearest(p,s.a,s.b)));
let edgeMax=0,connectorMax=0;
for(const [a,b,ri,connector,other] of pack.graph.edges){
 for(let k=0;k<=10;k++){const p=pack.graph.nodes[a].map((v,i)=>v+(pack.graph.nodes[b][i]-v)*k/10);const d=roadDistance(p);
  if(connector){connectorMax=Math.max(connectorMax,d);const width=r=>({avenue:12,collector:7,street:3.5}[roads.roads[r].class])/2;assert.ok(segments.some(s=>s.ri===ri&&nearest(p,s.a,s.b)<=width(ri)+1e-5)||segments.some(s=>s.ri===other&&nearest(p,s.a,s.b)<=width(other)+1e-5));}
  else {edgeMax=Math.max(edgeMax,d);assert.ok(d<.00002,`axis deviation ${d}`);}
 }
}
assert.equal(new Set(pack.graph.edges.map(e=>e[2])).size,308);
assert.equal(city.ownerBox.id,488);assert.deepEqual(Array.from(city.hubBoxes,b=>b.id),[463,477,1910,2332,3032,1853]);
const state=(n,d='core')=>({stages:[{repo:d,workers:Array.from({length:n},(_,i)=>({role:'w'+i})).concat([{role:'hub'}])}]});
city.applyState('one',state(0));assert.equal(city.loads.get('core').level,0);const before=new Map(city.districtRevision);
city.applyState('one',state(10));assert.equal(city.loads.get('core').level,100);for(const [d,r]of before)assert.equal(city.districtRevision.get(d),r+(d==='core'?1:0));
const b=city.boxes.find(b=>b.d==='core'&&b.type==='high'&&!city.hubBoxes.includes(b));
let previous=new Set();for(const level of [0,25,50,75,100]){const points=city.windowPaths(b,level,0).flatMap(p=>p.path.points.map(q=>q.join(','))),current=new Set(points);for(const p of previous)assert.ok(current.has(p));previous=current;}
// Two independent loads yield byte-identical geometry and nested window coordinates.
const again=new box.City(data,roads,pack,null,null,manifest);
for(const id of [0,488,1853,2367])assert.equal(JSON.stringify(city.windowPaths(city.boxes[id],75,0)),JSON.stringify(again.windowPaths(again.boxes[id],75,0)));
const spriteCity=new box.City(data,roads,pack,null,null,manifest,new Map([['enabled',{}]]));
assert.equal(spriteCity.spriteCount,121);for(const b of spriteCity.boxes.filter(b=>b.sprite)){assert.equal(b.box[5],'b');assert.ok(b.box[4]>=6);assert.ok(![488,463,477,1910,2332,3032,1853].includes(b.id));assert.equal(b.spriteWidth/b.sprite.baseWidth,b.spriteScale);assert.equal(b.spriteOrigin.length,2);}
assert.equal(source.includes('Math.random('),false);
let maxCabDistance=0,maxStep=0,samples=0;
for(let i=0;i<30;i++){
 const home=city.hubBoxes[i%6],cab={key:'worker-'+i,home:{lot:home},alt:10,working:false};city.fly(cab,0,0);
 for(let frame=0;frame<2000;frame++){
  if(frame===700)cab.leaving=true;if(frame===750)cab.leaving=false;
  const p=[cab.x,cab.y];city.fly(cab,frame*50,.05);
  const source=city.toSource((cab.x-54)*12,(cab.y-64)*12);maxCabDistance=Math.max(maxCabDistance,roadDistance(source));maxStep=Math.max(maxStep,Math.hypot(cab.x-p[0],cab.y-p[1]));samples++;
 }
}
assert.ok(maxCabDistance<6,`road corridor distance ${maxCabDistance}`);assert.ok(maxStep<.23,`motion step ${maxStep}`);
// Fully return and land on access road; reappear during descent and continue without XY/Z discontinuity.
const cab={key:'landing',home:{lot:city.ownerBox},alt:10};city.fly(cab,0,0);for(let i=0;i<40;i++)city.fly(cab,0,.05);cab.leaving=true;
let descending=false;for(let i=0;i<10000&&!cab.landed;i++){city.fly(cab,0,.05);if(cab.z<city.cabAltitude){descending=true;break;}}
assert.ok(descending);cab.leaving=false;const prior=[cab.x,cab.y,cab.z];city.fly(cab,0,.05);assert.ok(Math.hypot(cab.x-prior[0],cab.y-prior[1])<.23);assert.ok(Math.abs(cab.z-prior[2])<=.06500001);
cab.leaving=true;for(let i=0;i<10000&&!cab.landed;i++)city.fly(cab,0,.05);assert.ok(cab.landed);assert.ok(Math.hypot(cab.x-city.ownerBox.access.x,cab.y-city.ownerBox.access.y)<1e-8);assert.equal(cab.z,0);
console.log(JSON.stringify({pass:true,boxes:4367,graphNodes:pack.graph.nodes.length,graphEdges:pack.graph.edges.length,components:1,edgeMaxDistancePx:edgeMax,connectorMaxDistancePx:connectorMax,cabSamples:samples,maxCabDistancePx:maxCabDistance,maxStepWorld:maxStep,sprites:spriteCity.spriteCount},null,2));
