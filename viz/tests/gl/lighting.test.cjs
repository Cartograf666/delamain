const assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
const {updateRoadTraffic,createArrivalWalls,arrivalFrame,ARRIVAL_PEAK,PULSE_PEAK,ARRIVAL_CEILING,landing,LANDING_MAX,LANDING_BUDGET}=await import('data:text/javascript;base64,'+fs.readFileSync(__dirname+'/../../assets/gl/lighting.js').toString('base64'));
const values=new Float32Array(3),counts=new Uint16Array([0,1,5]),lengths=new Float32Array([100,100,100]);let max=0;
for(let i=0;i<180*120;i++){const before=values[2];updateRoadTraffic(values,counts,lengths,1/120);max=Math.max(max,(values[2]-before)*.2);}
assert.equal(values[0],0);assert.equal(values[1],0);assert(Math.abs(values[2]-(1-Math.exp(-1)))<.0001);assert(max<.00001);
const wall=(x,y,w=8,h=8)=>({kind:'wall',layer:1,points:[[x,y],[x+w,y],[x+w,y-h],[x,y-h]]});
const building=(id,x,y)=>({id,ground:[x+4,y],surfaces:[wall(x,y)]});
const source=building(0,0,0),near=building(1,20,0),far=building(2,70,0),blocker={id:3,ground:[14,0],surfaces:[{kind:'wall',layer:2,points:[[14,-8],[14,8],[14,0],[14,-16]]}]};
const visible=createArrivalWalls([source,near,far])(source);assert(visible.some(f=>f.buildingId===1&&f.gains.some(g=>g>0)));assert(!visible.some(f=>f.buildingId===2));assert(visible.filter(f=>f.buildingId===1).every(f=>Math.max(...f.gains)<.45));
const hidden=createArrivalWalls([source,near,far,blocker])(source);assert(!hidden.some(f=>f.buildingId===1));assert(hidden.some(f=>f.buildingId===0&&f.gains.every(g=>g===1)));
// Documented ceiling (2026-11-05): a lone delivery lights walls at 1.8 (was 1.0) plus a 0.7 window pulse; per building the drawn
// sum of wall light and pulse never exceeds ARRIVAL_CEILING=2.5.
assert.equal(ARRIVAL_PEAK,1.8);assert.equal(PULSE_PEAK,.7);assert.equal(ARRIVAL_CEILING,2.5);
const drawn=(L,id,t)=>{const sc=arrivalFrame(L,t);return L.reduce((sum,b)=>sum+Math.max(...b.walls.filter(f=>f.buildingId===id).flatMap(f=>f.gains),0)*b.wall*sc.get(id)+(b.building?.id===id?b.pulseLight*sc.get(id):0),0)};
const overlap=Array.from({length:4},()=>({t:1000,walls:[{buildingId:99,gains:[.9,.9,.9,.9]}]}));assert(drawn(overlap,99,1500)<=ARRIVAL_CEILING+1e-9);assert(overlap.reduce((sum,b)=>sum+.9*b.wall,0)>ARRIVAL_CEILING,'unscaled overlap would exceed the ceiling');for(const t of [999,1000,1170,1850,2400,3000]){arrivalFrame(overlap,t);assert(overlap.every(b=>b.gain>=0&&b.gain<=1));}assert.equal(overlap[0].gain,0);
const mixed=[1,.5,.5,1].map((strength,i)=>({t:1000+i*40,strength,pulse:true,building:{id:7},walls:[{buildingId:7,gains:[1,1,1,1]}]}));for(const t of [1050,1100,1300,1600,2200])assert(drawn(mixed,7,t)<=ARRIVAL_CEILING+1e-9,'mixed arrivals with pulses stay under the ceiling at '+t);
const lone=[{t:0,strength:1,pulse:true,building:{id:8},walls:[{buildingId:8,gains:[1]}]}];assert.equal(arrivalFrame(lone,500).get(8),1,'a single delivery is not dimmed');assert(Math.abs(lone[0].pulseU-.5)<1e-9&&lone[0].pulseLight>.6,'the pulse is half way up after 0.5 s');assert(lone[0].wall>1.79,'raised wall peak');arrivalFrame(lone,1001);assert.equal(lone[0].pulseLight,0,'the pulse ends within 1 s');
const calm=[{t:0,rise:650,pulse:false,building:{id:9},walls:[{buildingId:9,gains:[1]}]}];arrivalFrame(calm,170);assert(calm[0].gain<.2,'reduced motion rises gently');assert.equal(calm[0].pulseLight,0,'no pulse in reduced motion');
// Landing effect: scale by kind, simultaneous cap and the shared brightness budget.
assert.equal(landing.scale('delivery'),1);assert.equal(landing.scale('patrol'),.5);assert.equal(landing.scale('return'),.5);
const fx=(t,kind='delivery')=>({t,kind,scale:landing.scale(kind)});let list=[];for(let i=0;i<5;i++)list=landing.admit(list,fx(0),0);
assert(list.filter(e=>e.fade==null).length<=LANDING_MAX,'five at once: at most LANDING_MAX play');
for(const t of [0,30,60,100,150,400,800,1300]){const k=landing.frame(list,t);assert(list.reduce((s,e)=>s+e.scale*e.env*k,0)<=LANDING_BUDGET+1e-9,'budget holds at '+t);}
let one=[fx(0)];assert.equal(landing.frame(one,100),1,'a lone delivery is not dimmed');assert.equal(one[0].env,1);
list=[];for(let i=0;i<4;i++)list=landing.admit(list,fx(0),0);const before=list.length;list=landing.admit(list,fx(10,'patrol'),10);assert(list.length===before&&!list.some(e=>e.kind==='patrol'),'a patrol landing does not push out four fresh deliveries');
list=[];for(let i=0;i<4;i++)list=landing.admit(list,fx(i*300),i*300);list=landing.admit(list,fx(1000),1000);assert.equal(list.find(e=>e.t===0).fade,1000,'the weakest (oldest) fades');assert.equal(list.filter(e=>e.fade==null).length,LANDING_MAX);
let peak=0;list=[];for(let t=0;t<2000;t+=10){if(t%80===0&&t<=400)list=landing.admit(list,fx(t),t);peak=Math.max(peak,list.filter(e=>e.fade==null&&landing.envelope(e,t)>0).length);const k=landing.frame(list,t);assert(list.reduce((s,e)=>s+e.scale*e.env*k,0)<=LANDING_BUDGET+1e-9);}assert(peak<=LANDING_MAX);
console.log('PASS: arrival ceiling 2.5 (wall 1.8 + pulse 0.7) holds for overlaps, lone delivery undimmed, pulse within 1 s, landing scale by kind, cap of '+LANDING_MAX+' and budget '+LANDING_BUDGET+', gentle reduced-motion rise, three-minute EMA, isolated car invariant, cap, falloff, intervening wall shadow; max frame brightness delta',max);
})().catch(e=>{console.error(e);process.exitCode=1});
