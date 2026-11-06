// Run: node viz/tests/gl/hubs.test.mjs
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {hubSignal,hubGeometry,hubHeightFactor,scalableHub,scaledBuilding} from '../../assets/gl/hubs.js';
const S=JSON.parse(readFileSync(new URL('../../assets/gl/scene.json',import.meta.url)));
const live=JSON.parse(readFileSync(new URL('../../assets/gl/live-data.json',import.meta.url)));
const at=(x,y)=>S.buildings.reduce((a,b)=>Math.hypot(b.ground[0]-x,b.ground[1]-y)<Math.hypot(a.ground[0]-x,a.ground[1]-y)?b:a);
const range=(fn,from,to,step=1)=>{const v=[];for(let t=from;t<to;t+=step)v.push(fn(t));return v;};

// Open owner questions: gold, on and off once a second; reduced motion holds it steady.
const q=range(t=>hubSignal(2,t),0,2000);
assert(q.every(s=>s.gold));
assert(Math.max(...q.map(s=>s.k))>.99&&Math.min(...q.map(s=>s.k))<.01,'gold beacon flashes fully on and off');
for(const t of [0,130,480,777])assert.equal(hubSignal(1,t).k.toFixed(9),hubSignal(1,t+1000).k.toFixed(9),'1 s flash period');
assert(range(t=>hubSignal(1,t,true),0,2000,7).every(s=>s.gold&&s.k===1),'reduced motion: steady gold');
// Without questions: never gold, a slow ~3 s pulse in the project colour, steady under reduced motion.
const p=range(t=>hubSignal(0,t),0,3000);
assert(p.every(s=>!s.gold&&s.k>=.55&&s.k<=1));
assert(Math.max(...p.map(s=>s.k))-Math.min(...p.map(s=>s.k))>.4,'beacon pulses');
for(const t of [0,400,1900])assert.equal(hubSignal(0,t).k.toFixed(9),hubSignal(0,t+3000).k.toFixed(9),'3 s pulse period');
assert.notEqual(hubSignal(0,0).k.toFixed(3),hubSignal(0,1000).k.toFixed(3),'not the 1 s gold rhythm');
assert(new Set(range(t=>hubSignal(0,t,true).k,0,3000,11)).size===1,'reduced motion: steady glow');

// Geometry on real hub buildings: spire from the roof, column about 2.5 building heights, ring around the footprint.
// The owner tower as runtime.js picks it: the tallest live pad; its roof stands g[1]-p[1] above the ground.
const ownerPad=live.pads.reduce((a,b)=>b.h>a.h?b:a),owner=at(...ownerPad.g),ownerHeight=ownerPad.g[1]-ownerPad.p[1];
let checked=0;
for(const pad of live.pads){const b=at(...pad.g);if(b.id===owner.id)continue;const G=hubGeometry(b);if(!G)continue;checked++;
  assert(G.height>0&&G.walls.length>=1);
  assert(G.tip[1]<G.base[1]&&Math.abs(G.base[1]-G.tip[1]-G.spire)<1e-9,'spire rises from the roof');
  assert(G.roof.some(p=>p===G.base),'spire stands on a roof corner');
  assert(G.column>=G.height*2.5-1e-9&&G.column>=G.spire*2,'column above the spire, about 2.5 heights');
  assert(G.radius>0&&Math.abs(G.ground[1]-(G.centre[1]+G.height))<G.height,'ring at the foot');
  // The owner tower stays the biggest: no hub's building and spire together reach its height.
  assert(G.spire>=30&&G.spire<=40,'a thin spire, not a taller building');
  assert(G.height>=ownerHeight||G.height+G.spire<ownerHeight,`hub ${b.id} ${G.height+G.spire} vs owner ${ownerHeight}`);
}
assert(checked>20,`pad buildings checked: ${checked}`);
console.log(`hubs: signal and geometry ok (${checked} pad buildings, owner ${ownerHeight.toFixed(0)})`);

// Hub height factor from the session context: 1.5x fresh, 2.4x at 350k, 0.1 steps, owner cap, closed = plain house.
assert.equal(hubHeightFactor(0),1.5,'fresh');assert.equal(hubHeightFactor(175000),2,'mid');assert.equal(hubHeightFactor(350000),2.4,'350k');
assert.equal(hubHeightFactor(900000),2.4,'never above 2.4x');assert.equal(hubHeightFactor(350000,{open:false}),1,'closed');
assert.equal(hubHeightFactor(350000,{height:120,ownerHeight:300}),2.2,'owner cap: 120 x 2.2 = 264 <= 270');
assert.equal(hubHeightFactor(0,{height:250,ownerHeight:300}),1,'a house already near the owner does not grow');
const steps=range(c=>hubHeightFactor(c),0,400001,1000);
assert(steps.every((f,i)=>Math.abs(f*10-Math.round(f*10))<1e-9&&(!i||f>=steps[i-1])),'0.1 steps, monotone');
assert.equal(new Set(steps).size,10,'ten heights from 1.5 to 2.4');
// Every pad building: a plain box scales exactly (ground fixed, walls k x H, roof up by H(k-1)); stepped landmarks do not.
const ownerTop=live.pads.reduce((a,b)=>b.h>a.h?b:a),wallH=b=>Math.max(...b.surfaces.filter(f=>f.kind==='wall').map(f=>f.points[1][1]-f.points[2][1])),ownerH=wallH(at(...ownerTop.g));
const padBuildings=new Map(live.pads.map(p=>{const b=at(...p.g);return [b.id,b];}));let boxes=0;
for(const b of padBuildings.values()){if(!scalableHub(b))continue;boxes++;const H=wallH(b),k=hubHeightFactor(350000,{height:H,ownerHeight:ownerH}),s=scaledBuilding(b,k);
  assert(H*k<=.9*ownerH+1e-6||k===1,'owner cap');
  // Source walls of one box differ by up to .05 units; each stretches from its own height, the roof follows within .1.
  s.surfaces.forEach((f,i)=>{const o=b.surfaces[i].points;if(f.kind==='wall'){assert(Math.abs(f.points[1][1]-f.points[2][1]-k*(o[1][1]-o[2][1]))<1e-6,'wall stretches');for(const j of [0,1])assert.deepEqual(f.points[j],o[j],'ground stays');}
    else for(let j=0;j<o.length;j++)assert(Math.abs(o[j][1]-f.points[j][1]-H*(k-1))<.1&&o[j][0]===f.points[j][0],'roof translates');});}
assert.equal(padBuildings.size-boxes,12,'8 stepped landmarks and 4 ground landing pads keep their height');
console.log('PASS: hub height factor (1.5 fresh, 2 mid, 2.4 at 350k, 0.1 steps, owner cap, closed 1); '+boxes+' pad buildings scale exactly');
