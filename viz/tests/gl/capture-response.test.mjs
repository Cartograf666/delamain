import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRoadRouter,sampleRoute,createCaptureGate,createResponseLighting,createCaptureResponse,CAPTURE_DEMO} from '../../assets/gl/capture-response.js';
const memory=()=>{const map=new Map();return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),map};};
const today='2026-11-05',c={plotId:42,from:'A',to:'B'},snapshot={date:today,aggressiveCaptures:[c]},storage=memory(),gate=createCaptureGate(storage);
assert.deepEqual(gate.take(snapshot,{visible:false,today}),[]);
assert.equal(storage.map.size,0);
assert.deepEqual(gate.take({...snapshot,date:'2026-11-02'},{visible:true,today}),[]);
assert.deepEqual(gate.take(snapshot,{visible:true,today}),[c]);
assert.deepEqual(gate.take(snapshot,{visible:true,today}),[]);
assert.deepEqual(createCaptureGate(storage).take(snapshot,{visible:true,today}),[]);
const newCapture={...c,plotId:43};
assert.deepEqual(gate.take({...snapshot,aggressiveCaptures:[c,newCapture]},{visible:true,today}),[newCapture]);
assert.deepEqual(gate.take({date:today,aggressiveCaptures:[{...c,from:''},{...c,to:'A'},{...c,plotId:'42'}]},{visible:true,today}),[]);
assert.deepEqual(createCaptureGate(null).take(snapshot,{visible:true,today}),[c]);
assert.deepEqual(createCaptureGate({getItem(){throw Error('Unavailable');}}).take(snapshot,{visible:true,today}),[c]);
const bounded=createCaptureGate(memory());assert.equal(bounded.take({...snapshot,aggressiveCaptures:Array.from({length:20},(_,plotId)=>({...c,plotId}))},{visible:true,today}).length,20);
const roads=[{gpuId:0,p:[[0,0],[100,0],[200,0]]},{gpuId:1,p:[[100,0],[100,100]]},{gpuId:2,p:[[400,0],[600,0]]}];
const router=createRoadRouter(roads),route=router.route([100,98]);assert(route);assert(route.points.every(p=>p[0]<=200));assert(route.roadIds.includes(0)&&route.roadIds.includes(1));
for(let s=0;s<route.length;s+=.25){const p=sampleRoute(route,s);assert(Math.abs(p[1])<1e-5||Math.abs(p[0]-100)<1e-5);assert(Math.hypot(...sampleRoute(route,s+.1).map((v,i)=>v-p[i]))<=.10001);}
assert.deepEqual(sampleRoute(route,route.length),route.destination);assert.equal(router.route([300,150]),null);
const almost=createRoadRouter([{gpuId:0,p:[[0,0],[160,0]]},{gpuId:1,p:[[161,1],[161,50]]}]);assert.equal(almost.route([161,50]),null,'Nearby endpoints must not teleport-connect');
const scene=JSON.parse(fs.readFileSync(new URL('../../assets/gl/scene.json',import.meta.url))),geometry=JSON.parse(fs.readFileSync(new URL('../../assets/gl/growth-plots.json',import.meta.url)));
// Same curve/projection as the real renderer, including the source road endpoints.
const pr=scene.projection,ca=Math.cos(pr.g*Math.PI/180),sa=Math.sin(pr.g*Math.PI/180);
const project=p=>{const x=p[0]-pr.center[0],y=p[1]-pr.center[1],X=x*ca+y*sa,Y=-x*sa+y*ca;return [(pr.ox+X-Y)*.75,(pr.oy+(X+Y)/2)*.75-40];};
function rounded(points){if(points.length<3)return points;const out=[points[0]];for(let i=1;i<points.length-1;i++){const a=points[i-1],b=points[i],c=points[i+1],la=Math.hypot(a[0]-b[0],a[1]-b[1]),lb=Math.hypot(c[0]-b[0],c[1]-b[1]),r=Math.min(22,la*.42,lb*.42);if(r<.1){out.push(b);continue;}const A=[b[0]+(a[0]-b[0])*r/la,b[1]+(a[1]-b[1])*r/la],B=[b[0]+(c[0]-b[0])*r/lb,b[1]+(c[1]-b[1])*r/lb];out.push(A);for(let j=1;j<=12;j++){const t=j/12,u=1-t;out.push([u*u*A[0]+2*u*t*b[0]+t*t*B[0],u*u*A[1]+2*u*t*b[1]+t*t*B[1]]);}}out.push(points.at(-1));return out;}
const realRoads=scene.roads.map((r,gpuId)=>({gpuId,p:rounded(r.points).map(project)}));
console.time('real road graph');const real=createRoadRouter(realRoads);console.timeEnd('real road graph');
const routeEvidence=[];
for(const c of CAPTURE_DEMO.aggressiveCaptures){const plot=geometry.plots.find(p=>p.id===c.plotId),r=real.route(plot.ground);assert(r,`Real route for ${c.plotId}`);assert(r.length>=100&&r.length<240);routeEvidence.push({plotId:c.plotId,building:plot.building,ground:plot.ground,length:r.length,roads:[...new Set(r.roadIds)],distanceToLot:r.distanceToLot});}
const wallsAt=createResponseLighting(scene.buildings);let receivers=0;for(const e of routeEvidence){const route=real.route(e.ground);for(let s=0;s<=route.length;s+=10)receivers+=wallsAt(sampleRoute(route,s)).length;}assert(receivers>0);
const fake={id:1,ground:[0,-5],surfaces:[{kind:'wall',layer:2,points:[[-10,0],[10,0],[10,-10],[-10,-10]]}]};
assert(createResponseLighting([fake])([0,6]).length>0);assert.equal(createResponseLighting([fake])([0,-12]).length,0,'Back-facing walls stay dark');
const live={districtsVisible:false,gpu:{growth:{snapshot,plots:new Map(geometry.plots.map(p=>[p.id,p])),buildings:new Map(scene.buildings.map(b=>[b.id,b]))},scene}};
let water=[];const demo=createCaptureResponse(live,{roads:realRoads,water:x=>water=x,search:'?demo=capture',storage:{getItem(){throw Error('Demo must not read storage');},setItem(){throw Error('Demo must not write storage');}},reduce:{matches:false}});
demo.update(0);assert.equal(demo.events.length,0);live.districtsVisible=true;demo.update(100);assert.equal(demo.events.length,3);demo.update(11500);assert(demo.events.every(e=>e.vehicles.every(v=>v.arrived)));assert.equal(demo.stats.started,3);
const ended=demo.events.map(e=>e.vehicles.map(v=>v.p));demo.update(20000);assert.equal(demo.events.length,0);live.districtsVisible=false;demo.update(21000);live.districtsVisible=true;demo.update(22000);assert.equal(demo.events.length,0);
const reduced=createCaptureResponse(live,{roads:realRoads,water:()=>{},search:'?demo=capture',reduce:{matches:true}});reduced.update(0);const positions=reduced.events.map(e=>e.vehicles.map(v=>v.p));reduced.update(7000);assert.deepEqual(reduced.events.map(e=>e.vehicles.map(v=>v.p)),positions);
console.log('PASS gates, dedup/reload/toggle, same-day additions, stale/invalid/no-data, connected routes, actual source lots, wall facing, arrival, bounded lifetime, demo isolation, reduced motion');
console.log(JSON.stringify({routeEvidence,receivers,nodes:real.nodes.length,edges:real.edges.length},null,2));
// More than one batch and newly observed same-day rows must not be silently consumed.
const queueSnapshot={date:today,aggressiveCaptures:Array.from({length:5},(_,plotId)=>({plotId,from:'A',to:'B'}))};
const queueLive={districtsVisible:true,gpu:{scene:{buildings:[]},growth:{snapshot:queueSnapshot,plots:new Map(Array.from({length:8},(_,id)=>[id,{id,ground:[100,98]}])),buildings:new Map()}}};
const queueResponse=createCaptureResponse(queueLive,{roads,water:()=>{},storage:memory(),day:()=>today,reduce:{matches:false}});
queueResponse.update(0);assert.deepEqual(queueResponse.events.map(e=>e.capture.plotId),[0,1,2]);
queueSnapshot.aggressiveCaptures.push({plotId:5,from:'A',to:'B'});queueResponse.update(100);assert.equal(queueResponse.events.length,3);
queueResponse.update(19001);assert.deepEqual(queueResponse.events.map(e=>e.capture.plotId),[3,4,5]);
queueLive.districtsVisible=false;queueResponse.update(20000);queueLive.districtsVisible=true;queueResponse.update(20001);assert.equal(queueResponse.events.length,0);
const noRoads=createCaptureResponse(queueLive,{roads:[],water:()=>{},storage:memory(),day:()=>today,reduce:{matches:false}});noRoads.update(0);assert.equal(noRoads.events.length,3);assert(noRoads.events.every(e=>e.route===null&&e.vehicles.length===0)&&noRoads.smokeSites.length===0,'An inaccessible captured lot has no road smoke or off-road responders');
// A demo capture put out mid-queue: nothing more starts, what burns fades over 2.2 s, not cut.
const putOut=createCaptureResponse(queueLive,{roads:[],water:()=>{},storage:memory(),day:()=>'2000-01-01',reduce:{matches:false}});putOut.update(0);
putOut.play(Array.from({length:8},(_,plotId)=>({plotId,from:'A',to:'B'})),'demo');putOut.update(1000);putOut.update(3000);assert.equal(putOut.events.length,3);assert(putOut.events.every(e=>e.alpha===1));
putOut.extinguishDemo(3000);putOut.update(4100);assert.equal(putOut.events.length,3);assert(putOut.events.every(e=>Math.abs(e.alpha-.5)<1e-9));
putOut.update(5200);assert.equal(putOut.events.length,0);putOut.update(6000);assert.equal(putOut.events.length,0,'The queue must not relight the fire');
const unavailable=createCaptureGate(null);assert.equal(unavailable.take(snapshot,{visible:true,today}).length,1);assert.equal(unavailable.take(snapshot,{visible:true,today}).length,0);
console.log('PASS queued second group, in-place same-day addition, mode exit discards queue, unroutable incident, in-memory storage fallback');
