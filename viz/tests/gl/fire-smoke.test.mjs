import assert from 'node:assert/strict';
import fs from 'node:fs';
import {responseBeacon,createCaptureResponse,captureSeverity,createResponseLighting,fireHotSpots,fireLower,fireFlicker,fireEmbers,EMBER_BUDGET,EMBER_LIFE} from '../../assets/gl/capture-response.js';
const red=[255,70,57],blue=[62,143,255];
for(let index=0;index<3;index++)for(let step=0;step<12;step++){
 const t=(step-index*.5)*800,before=responseBeacon(t-.001,index),at=responseBeacon(t,index),after=responseBeacon(t+.001,index);
 assert.notDeepEqual(before.color,at.color);assert.deepEqual(at,after);assert.deepEqual(responseBeacon(t+400,index),at);
 for(const s of [before,at,after]){assert([red,blue].some(c=>JSON.stringify(c)===JSON.stringify(s.color)));assert.deepEqual([s.red,s.blue].sort(),[.08,1]);}
}
for(const t of [0,799,800,2399,2400,5599,5600,7200,15800])assert.deepEqual(responseBeacon(t,2,true),{color:[158.5,106.5,156],red:.65,blue:.65});
const levels=[1,3,16,1000].map(captureSeverity);
assert.deepEqual(levels.map(s=>s.sites),[1,3,6,6]);assert(levels[0].height<levels[1].height&&levels[1].height<levels[2].height);assert(levels[0].width<levels[1].width&&levels[1].width<levels[2].width);assert.equal(levels[2].height,levels[3].height);
// Hot spots: at least three per building at different lower floors, inside the wall, a tower burns at its foot.
const twoWalls={id:9,ground:[0,-5],surfaces:[{kind:'wall',layer:4,points:[[-10,-5],[0,0],[0,-40],[-10,-45]]},{kind:'wall',layer:5,points:[[0,0],[10,-5],[10,-45],[0,-40]]},{kind:'roof',layer:6,points:[[0,-50],[10,-45],[0,-40],[-10,-45]]}]};
for(const b of [twoWalls,{id:2,ground:[0,-5],surfaces:[{kind:'wall',layer:2,points:[[-10,0],[10,0],[10,-6],[-10,-6]]}]}]){
 const spots=fireHotSpots(b,7);assert(spots.length>=3);assert(new Set(spots.map(s=>s.floor)).size>=3,'Hot spots on at least three floors');
 for(const s of spots){const [a,,c]=s.wall.points,h=a[1]-c[1];assert(s.u-s.du>0&&s.u+s.du<1&&s.v0>=0&&s.v1<=.95&&s.v1>s.v0);assert(s.v1*h<=fireLower(h)*.75+1e-9,'Lower floors only');}
}
assert.deepEqual(fireHotSpots(null,1),[]);assert.deepEqual(fireHotSpots({surfaces:[{kind:'roof',points:[]}]},1),[]);
// Flicker: within 1±0.2, no component at or above 3 Hz (DFT over 60 s), smooth per frame, steady under reduced motion.
for(const seed of [0,1.7,5.2]){
 const rate=60,n=rate*60,xs=Array.from({length:n},(_,i)=>fireFlicker(i*1000/rate,seed)),mean=xs.reduce((a,b)=>a+b)/n;
 assert(xs.every(x=>x>=.8&&x<=1.2),'Amplitude about 20 %');assert(Math.max(...xs)-Math.min(...xs)>.15,'Visibly alive');
 assert(xs.every((x,i)=>!i||Math.abs(x-xs[i-1])<.035),'No frame-to-frame jump');
 let low=0,high=0;for(let k=1;k<n/2;k++){let re=0,im=0;for(let i=0;i<n;i+=2){const a=2*Math.PI*k*i/n;re+=(xs[i]-mean)*Math.cos(a);im-=(xs[i]-mean)*Math.sin(a);}const e=re*re+im*im;if(k/60>=3)high+=e;else low+=e;if(k>=360)break;}
 assert(high/(low+high)<.01,`Energy above 3 Hz ${high/(low+high)}`);
 for(const t of [0,333,1000,7777])assert.equal(fireFlicker(t,seed,true),1);
}
// Embers: a few per second per spot, rising and fading, capped by the budget, none under reduced motion.
const one=[{p:[0,0],w:2,seed:1}];let born=new Set();for(let t=0;t<10000;t+=50)for(const e of fireEmbers(one,t))born.add(`${Math.round((e.x-e.y)*1e3)}`);
const alive=Array.from({length:200},(_,i)=>fireEmbers(one,i*50).length);assert(Math.max(...alive)<=Math.ceil(3*EMBER_LIFE)+1&&Math.min(...alive.slice(40))>=2,'About three a second, 1.8 s each');
const a0=fireEmbers(one,4000),a1=fireEmbers(one,4100);assert(a0.every(e=>e.y<0&&e.alpha>=0&&e.alpha<=1));assert(Math.min(...a1.map(e=>e.y))<Math.min(...a0.map(e=>e.y))+.5);
const many=Array.from({length:120},(_,i)=>({p:[i*10,0],w:2,seed:i}));for(const t of [0,900,5000,12345])assert(fireEmbers(many,t).length<=EMBER_BUDGET);assert(fireEmbers(many,5000).length>EMBER_BUDGET*.6);
assert.deepEqual(fireEmbers(many,5000,{reduced:true}),[]);assert(fireEmbers(many,5000,{budget:10}).length<=10);
// Receiving facades: light reaches a wall facing the fire (positive control) and not one behind a front wall (negative).
const receiver={id:20,ground:[0,-35],surfaces:[{kind:'wall',layer:1,points:[[-10,-30],[10,-30],[10,-40],[-10,-40]]}]},blocker={id:21,ground:[0,-15],surfaces:[{kind:'wall',layer:3,points:[[-20,-12],[20,-12],[20,-22],[-20,-22]]},{kind:'roof',layer:4,points:[[-20,-22],[20,-22],[20,-28],[-20,-28]]}]};
assert(createResponseLighting([receiver])([0,-5],80).some(f=>f.buildingId===20&&f.gains.some(x=>x>0)),'Positive control: clear line of sight lights the facing wall');
assert(!createResponseLighting([receiver,blocker])([0,-5],80).some(f=>f.buildingId===20),'Negative control: no light through a wall in front');
const walls=[{kind:'wall',layer:2,points:[[-10,0],[10,0],[10,-10],[-10,-10]]},{kind:'roof',layer:3,points:[[-10,-10],[10,-10],[10,-15],[-10,-15]]}];
const building={id:1,ground:[0,-5],surfaces:walls},reduce={matches:false},calls=[];let water;
const FIRE=[255,98,32],HOT=[255,168,64],CORE=[255,238,184];
const g={save(){},restore(){},translate(){},scale(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},arc(){},ellipse(){},fill(){calls.push(['fill',this.depth,this.fillStyle]);},createRadialGradient(){return {addColorStop:(t,c)=>calls.push(['pool',t,c])};},createLinearGradient(){return {addColorStop:(t,c)=>calls.push(['face',t,c])};},uplight(q,c,gain,gains){calls.push(['wall',c,this.depth,q,gain,gains]);},smoke(...args){calls.push(['smoke',this.depth,...args]);}};
const roads=[{gpuId:7,p:[[-300,6],[-200,6],[-100,6],[0,6],[100,6],[200,6],[300,6]]}];
function fixture(count){const snapshot={date:'2026-11-05',aggressiveCaptures:Array.from({length:count},(_,plotId)=>({plotId,from:'A',to:'B'}))};return {districtsVisible:true,gpu:{painter:g,depth:x=>.9-x*.001,scene:{buildings:[building]},growth:{snapshot,plots:new Map(snapshot.aggressiveCaptures.map(c=>[c.plotId,{ground:[c.plotId*18,-5],footprint:[[c.plotId*18,-8],[c.plotId*18+4,-5],[c.plotId*18,-2],[c.plotId*18-4,-5]],building:c.plotId%4===3?null:1}])),buildings:new Map([[1,building]]),point:(id,p)=>p}}};}
function response(live){return createCaptureResponse(live,{roads,water:x=>water=x,storage:null,day:()=>live.gpu.growth.snapshot.date,reduce});}
const same=(c,ref)=>c.length===4?c.slice(0,3).every((x,i)=>Math.abs(x-ref[i]/255)<1e-9):JSON.stringify(c)===JSON.stringify(ref);
for(const count of [1,3,16]){
 const r=response(fixture(count));r.update(0);r.update(5000);const sites=r.smokeSites;
 assert.equal(r.events[0].group.plotIds.size,count);assert.equal(new Set(r.events.map(e=>e.group.key)).size,1);
 assert.equal(sites.length,Math.min(count,6));assert.equal(new Set(sites.map(s=>s.plotId)).size,sites.length);
 for(const s of sites){assert.equal(s.severity.count,count);if(s.plotId%4!==3)assert.deepEqual(s.p,[0,-8],'Plume starts up the facade (60 % of its 5-unit height), not on the road');}
 calls.length=0;r.events.forEach(e=>e.vehicles=[]);r.draw(5000);
 const smoke=calls.filter(c=>c[0]==='smoke');assert.equal(smoke.length,sites.length);assert(smoke.every(c=>Math.abs(c[1]-(.9-3.5*.001))<1e-12),'Plume just in front of its burning building');assert(smoke.every(c=>c.at(-1)===1),'Plume base warmed by the fire');
 const fire=calls.filter(c=>c[0]==='wall');const built=Array.from({length:count},(_,i)=>i).filter(i=>i%4!==3).length;
 assert.equal(fire.filter(c=>same(c[1],HOT)).length,3*built,'Three window hot spots per burning building');assert.equal(fire.filter(c=>same(c[1],CORE)).length,3*built,'A white-yellow core in every hot spot');
 assert(fire.filter(c=>same(c[1],HOT)).every(c=>c[2]<.9-2*.001&&c[2]>.9-3*.001),'Hot spots at their wall depth, behind any nearer layer');
 assert(fire.filter(c=>same(c[1],HOT)).every(c=>c[3].every(p=>p[1]<=0&&p[1]>=-10&&p[0]>-10&&p[0]<10)),'Inside the wall, never on the roof');
 assert(fire.some(c=>same(c[1],FIRE)&&c[3][0][1]===0&&c[3][3][1]<0),'Facade lit from its base');
 assert(calls.filter(c=>c[0]==='fill'&&same(c[2],CORE)).length>0,'Embers');
 assert(r.fireStats.plots===count&&r.fireStats.spots===3*count&&r.fireStats.embers<=EMBER_BUDGET);
 if(count>=3)assert(calls.some(c=>c[0]==='pool'&&c[1]===0&&same(c[2],FIRE)),'A broad warm wash for a multi-plot capture');
 assert(r.fireStats.lit>0&&r.fireStats.lit<=4);let frames=1;while(r.fireStats.lit&&frames<20){r.draw(5000+frames*16);r.smokeSites;assert(r.fireStats.lit<=4);frames++;}r.draw(6000);assert.equal(r.fireStats.lit,0,'Lit facades are computed once per fire, at most four per frame');
}
// Living light: the hot spots change over time, a reduced-motion frame does not, and has no embers.
{const r=response(fixture(1));r.update(0);r.update(5000);r.events[0].vehicles=[];const frame=t=>{calls.length=0;r.draw(t);return JSON.stringify(calls.filter(c=>c[0]==='wall'));};
 assert.notEqual(frame(5000),frame(5250));reduce.matches=true;assert.equal(frame(5000),frame(7250));assert.equal(r.fireStats.embers,0);reduce.matches=false;}
const live=fixture(1),r=response(live);r.update(0);r.update(5000);r.events[0].vehicles=[{p:[0,6],index:0,alpha:1}];
const fireColour=c=>[FIRE,HOT,CORE].some(f=>same(c,f));
function sample(t){calls.length=0;r.draw(t);const beacon=responseBeacon(t,0,reduce.matches);const beams=calls.filter(c=>c[0]==='wall'&&!fireColour(c[1]));assert(beams.length);for(const c of beams)assert.deepEqual(c[1],beacon.color);const gain=reduce.matches?.72:1;assert.deepEqual(water[0].c,beacon.color.map(c=>c/255*gain*.7));assert(calls.some(c=>c[0]==='pool'&&c[1]===0&&c[2].slice(0,3).every((x,i)=>x===beacon.color[i]/255)));return calls.filter(c=>c[0]==='smoke').map(c=>c.slice());}
const a=sample(5599);sample(5600);assert.notEqual(a[0][6],sample(7400)[0][6]);
reduce.matches=true;assert.deepEqual(sample(5000),sample(7400));assert(sample(15800)[0].at(-2)<sample(7400)[0].at(-2));reduce.matches=false;
// Different source/target/date never shares a severity group; duplicates do not grow it.
const separated=fixture(3);separated.gpu.growth.snapshot.aggressiveCaptures[2].to='C';const separate=response(separated);separate.update(0);assert.deepEqual(separate.events.map(e=>e.group.plotIds.size),[2,2,1]);separate.update(100);assert.equal(separate.events.length,3);assert.deepEqual(separate.events.map(e=>e.group.plotIds.size),[2,2,1]);
separated.gpu.growth.snapshot={date:'2026-11-06',aggressiveCaptures:[{plotId:0,from:'A',to:'B'}]};separate.update(500);assert.equal(separate.events[0].group.plotIds.size,1);assert.equal(separate.events[0].group.date,'2026-11-06');
// No road guess, rooftop fallback or fire while asynchronous routing is unresolved.
let worker;const OriginalWorker=globalThis.Worker;globalThis.Worker=class{constructor(){worker=this;}postMessage(data){this.data=data;}terminate(){}};
try{const waiting=response(fixture(1));waiting.update(0);waiting.update(5000);calls.length=0;waiting.draw(5000);assert.deepEqual(calls,[],'No fire before routing resolves');assert.deepEqual(waiting.smokeSites,[]);worker.onmessage({data:{id:worker.data.id,route:null,ms:0}});waiting.draw(5000);assert.deepEqual(calls,[]);}finally{if(OriginalWorker===undefined)delete globalThis.Worker;else globalThis.Worker=OriginalWorker;}
assert(!fs.readFileSync(new URL('../../assets/gl/painter.js',import.meta.url),'utf8').includes('mode==11.'));
console.log('PASS fire: >=3 hot spots per building on lower floors, flicker 1±0.2 below 3 Hz, ember budget, receiver occlusion +/- controls, facade smoke with warm base, severity 1/3/large, distinct sites, source/target/date grouping, dedup, no asynchronous fallback, coordinated beacons, steady reduced motion, decay');
// Reload receipts suppress old launch sites, but do not turn a three-lot attack into one.
const receipts=new Map(),storage={getItem:k=>receipts.get(k)||null,setItem:(k,v)=>receipts.set(k,v)};
const first=fixture(2),old=createCaptureResponse(first,{roads,water:()=>{},storage,day:()=>first.gpu.growth.snapshot.date,reduce});old.update(0);assert.equal(old.events.length,2);
const next=fixture(3);next.gpu.growth.snapshot.aggressiveCaptures.push({...next.gpu.growth.snapshot.aggressiveCaptures[0]},{plotId:'invalid',from:'A',to:'B'});
const reload=createCaptureResponse(next,{roads,water:()=>{},storage,day:()=>next.gpu.growth.snapshot.date,reduce});reload.update(0);assert.deepEqual(reload.events.map(e=>e.capture.plotId),[2]);assert.equal(reload.events[0].group.plotIds.size,3);assert(reload.smokeSites.every(s=>s.severity.count===3));assert.equal(reload.smokeSites.length,3);
console.log('PASS persisted receipts: only third plot launches, full unique three-lot group sets severity');
