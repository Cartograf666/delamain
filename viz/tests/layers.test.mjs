import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../assets/style/layers.js', import.meta.url), 'utf8');
const hash = s => { let h=2166136261; for (const ch of String(s)) h=Math.imul(h^ch.charCodeAt(0),16777619); return h>>>0; };
const box = { clamp:(v,a,b)=>Math.max(a,Math.min(b,v)), hash, CX:54, CY:64,
  DISTRICTS:[{id:'core'},{id:'docks'},{id:'wastes'}], districtFor:r=>r||'wastes', inCity:(x,y)=>Math.hypot((x-54)/44,(y-64)/58)<1 };
vm.createContext(box); vm.runInContext(source+'\nglobalThis.City=LayerCity;',box);
const City=box.City;
const manifest={load:{workersAtFull:10,hysteresis:.025},layers:{ground:{edgeStart:.62,edgeEnd:1},buildings:{},keyBuildings:{}}};
const city=new City(manifest,new Map());
// Nearest quantization, upward ties, clamping and both hysteresis directions.
assert.deepEqual([-.1,0,.124,.125,.374,.375,.624,.625,.874,.875,1,2].map(v=>City.quantize(v)),[0,0,0,25,25,50,50,75,75,100,100,100]);
assert.equal(City.quantize(.13,0),0);assert.equal(City.quantize(.16,0),25);
assert.equal(City.quantize(.12,25),25);assert.equal(City.quantize(.09,25),0);
assert.equal(City.quantize(.98,0),100);assert.equal(City.quantize(.02,100),0);
const state=(repo,n)=>({stages:[{repo,workers:Array.from({length:n},(_,i)=>({role:'w'+i}))}]});
city.applyState('one',state('core',5));assert.equal(city.loads.get('core').level,50);assert.equal(city.loads.has('docks'),false);
const revision=city.revision;city.applyState('one',state('core',5));assert.equal(city.revision,revision);
city.applyState('two',state('core',4));assert.equal(city.loads.get('core').workers,9);assert.equal(city.loads.get('core').level,100);
city.applyState('one',state('core',0));city.applyState('two',state('docks',0));
assert.equal(city.loads.get('core').level,0);assert.equal(city.loads.get('docks').level,0);
city.applyState('one',{stages:[]});assert.equal(city.loads.has('core'),false);
const lot={x:54,y:64,d:'core',h:42};assert.equal(city.stateFor(lot),city.stateFor(lot));
assert.ok([0,25,50,75,100].includes(city.stateFor(lot)));
// Uniform square footprint is contained even on rotated lots.
for(const angle of [0,.21,-.35,.52,-.6,.78]){
 const c=Math.cos(angle),s=Math.sin(angle),side=2.6;
 const parcel={x:54,y:64,quad:[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y])=>({x:54+(x*c-y*s)*side/2,y:64+(x*s+y*c)*side/2}))};
 const width=city.lotWidth(parcel),expected=side*.68*2/(Math.abs(c)+Math.abs(s));assert.ok(Math.abs(width-expected)<1e-10);
}
assert.equal(city.edge({...lot,d:'wastes',x:120,y:140}).keep,false);
assert.equal(city.edge(lot).keep,true);assert.equal(city.edge({...lot,x:90,y:110}).scale,1);
// Fixed routes use only graph edges and close; replay with the same inputs matches exactly.
const nodes=Array.from({length:8},(_,i)=>({id:i,x:i%4,y:Math.floor(i/4),adj:[]}));
for(let i=0;i<nodes.length;i++){for(const j of [(i+1)%8,(i+7)%8])nodes[i].adj.push({to:nodes[j]});}
const route=city.route(nodes[0],'worker');assert.equal(route[0],route.at(-1));
for(let i=1;i<route.length;i++)assert.ok(route[i-1].adj.some(e=>e.to===route[i]));
const a={},b={};for(let i=0;i<1000;i++){city.advance(a,.016,3.2,nodes[0],'worker');city.advance(b,.016,3.2,nodes[0],'worker');assert.equal(a.x,b.x);assert.equal(a.y,b.y);}
assert.equal(/Math\.random|Date\.now|performance\.now/.test(source),false);
console.log('PASS: five states, hysteresis, live/zero/missing/multiple sources, cache revisions, contained footprint, repeatable connected trajectories');
// Worker disappears, partially returns on graph edges, then reappears: no stale-cursor teleport.
const access={id:100,x:0,y:0,adj:[]},end={id:101,x:10,y:0,adj:[]};
access.adj=[{to:end}];end.adj=[{to:access}];
box.CRUISE=3.2;box.nearest=()=>access;box.G={nodes:[access,end]};
const makeCab=()=>({key:'returning-worker',home:{lot:{x:0,y:4}},x:8,y:0,z:10,alt:10,
 layerRoute:[access,end,access],layerSegment:0,layerT:.8,leaving:true});
const returning=makeCab();
for(let i=0;i<20;i++){city.fly(returning,0,.05);assert.equal(returning.y,0);assert.ok(returning.x>=0&&returning.x<=8);}
assert.ok(Math.abs(returning.x-4.8)<1e-8);
returning.leaving=false;
for(let i=0;i<100;i++){const before=[returning.x,returning.y];city.fly(returning,0,.05);assert.ok(Math.hypot(returning.x-before[0],returning.y-before[1])<=.16000001);assert.equal(returning.y,0);}
const connector=makeCab();
for(let i=0;i<60;i++)city.fly(connector,0,.05);
assert.ok(connector.y>0&&connector.y<4); // only the explicit access connector leaves the graph
connector.leaving=false;
for(let i=0;i<100;i++){const before=[connector.x,connector.y,connector.z];city.fly(connector,0,.05);assert.ok(Math.hypot(connector.x-before[0],connector.y-before[1])<=.16000001);assert.ok(Math.abs(connector.z-before[2])<=.16000001);assert.ok(Math.hypot(connector.x-before[0],connector.y-before[1],connector.z-before[2])<=Math.SQRT2*.16+1e-8);}
const landed=makeCab();for(let i=0;i<200&&!landed.landed;i++)city.fly(landed,0,.05);
assert.equal(landed.landed,true);assert.equal(landed.x,0);assert.equal(landed.y,4);assert.equal(landed.z,0);
console.log('PASS: connected return leg, partial-landing reappearance, connector reversal, bounded per-frame motion and completed landing');
