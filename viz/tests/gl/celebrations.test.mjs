// Run: node viz/tests/gl/celebrations.test.mjs
import assert from 'node:assert/strict';
import {schedule,durationOf,passGain,centralPlots,groundDistance,WAVE,PASSES,CENTRAL,MAX_CENTRAL,MIN_BURST_GAP,KINDS} from '../../assets/gl/celebrations.js';
const rand=seed=>()=>(seed=(seed*16807)%2147483647)/2147483647;
const onsets=s=>[...new Set(s.map(x=>x.burst))].sort((a,b)=>a-b);
for(const seed of [1,7,42,1234,99991]){
 for(const kind of Object.keys(KINDS)){
  const s=schedule(kind,rand(seed)),o=onsets(s);
  for(let i=1;i<o.length;i++)assert(o[i]-o[i-1]>=MIN_BURST_GAP-1e-9,`${kind} onsets ${o[i-1]} → ${o[i]} faster than 3 Hz`);
  for(const x of s)assert(x.burst>=x.launch);
 }
 const pr=schedule('pr-opened',rand(seed));
 assert.equal(pr.length,3,'PR: three rockets');
 assert.deepEqual(pr.map(x=>x.launch),[0,200,400]);
 assert.deepEqual(pr.map(x=>x.tint),[0,1,2],'PR colours: project, white, light tint');
 assert.equal(new Set(pr.map(x=>x.lean)).size,3,'PR rockets fan out');
 assert.equal(new Set(pr.map(x=>x.burst-x.launch)).size,3,'PR rockets reach different heights');
 assert.deepEqual(schedule('pr-merged',rand(seed)).map(x=>x.type),['peony','ring','peony']);
 assert.deepEqual(schedule('pr-merged',rand(seed)).map(x=>x.launch),[0,250,500]);
 const r=schedule('release',rand(seed)),main=r.filter(x=>!x.finale),fin=r.filter(x=>x.finale);
 assert(main.length>=8&&main.length<=12,`release rockets ${main.length}`);
 assert.equal(fin.length,20);
 for(const t of ['peony','willow','ring','crossette','palm'])assert(main.some(x=>x.type===t),t);
 assert(Math.max(...main.map(x=>x.burst))<=11000);
}
assert.equal(durationOf('release'),20000);
// Facade wave: a fast front (~160 units/s) from the launch point; each building peaks ~150 ms after the
// front reaches it and is dark ~800 ms later, so a ring passes and is gone. Merge one pass, release three.
assert.equal(WAVE.speed,160);assert(WAVE.rise<=200&&WAVE.decay>=600&&WAVE.decay<=1000);
const peaks=(kind,d,reach)=>{const out=[];let prev=0,up=false;for(let a=0;a<=12000;a+=5){const k=passGain(kind,d,reach,a);if(up&&k<prev&&prev>.99)out.push(a-5);up=k>prev;prev=k;}return out;};
for(const d of [0,40,70]){
 const on=d/WAVE.speed*1000;
 assert.equal(passGain('pr-merged',d,70,on-1),0,`d=${d} dark before the front`);
 assert(passGain('pr-merged',d,70,on+WAVE.rise)>.999,`d=${d} at peak ${WAVE.rise} ms after the front`);
 assert(passGain('pr-merged',d,70,on+WAVE.rise/2)<.9,'rises, not a step');
 assert.equal(passGain('pr-merged',d,70,on+WAVE.rise+WAVE.decay),0,`d=${d} gone after the decay`);
 assert.deepEqual(peaks('pr-merged',d,70),[Math.round((on+WAVE.rise)/5)*5],'merge: one pass');
}
// The front moves outwards at the wave speed: the peak 100 units out comes 625 ms later.
assert.equal(peaks('pr-merged',100,100)[0]-peaks('pr-merged',0,100)[0],625);
// Release: three passes 1.2 s apart, each wider; the edge is reached by the last pass only.
assert.deepEqual(PASSES.release.map(p=>p.at),[0,1200,2400]);
assert.deepEqual(peaks('release',0,110),[150,1350,2550],'release: three passes at the main tower');
assert.equal(peaks('release',110,110).length,1,'the edge: only the widest pass');
assert.equal(peaks('release',80,110).length,2,'mid-radius: the two wider passes');
for(let i=1;i<PASSES.release.length;i++)assert(PASSES.release[i].share>PASSES.release[i-1].share,'each pass wider');
// Nothing glows for long: 4 s after the last pass the whole set is dark (afterglow is drawn separately).
for(let d=0;d<=110;d+=5)assert.equal(passGain('release',d,110,2400+d/WAVE.speed*1000+WAVE.rise+WAVE.decay),0);
// Central set: main tower plus own plots within CENTRAL[kind], nearest first, capped; never another project's.
{
 const project={id:'P',mainPlot:{id:0}},ground=new Map([[0,[0,0]]]),owners=[];
 for(let i=1;i<=200;i++){const a=i*2.4,r=i*1.2;ground.set(i,[Math.cos(a)*r,Math.sin(a)*r/2]);owners.push({id:i,owner:i%3?'P':'Q',reserved:i%17===0});}
 const groundOf=id=>ground.get(id);
 assert.deepEqual(centralPlots('pr-opened',project,owners,groundOf).map(p=>p.id),[0],'PR: main tower only');
 for(const kind of ['pr-merged','release']){
  const set=centralPlots(kind,project,owners,groundOf);
  assert.equal(set[0].id,0);assert(set.length>1&&set.length<=MAX_CENTRAL,`${kind} ${set.length}`);
  for(const p of set.slice(1)){const o=owners.find(x=>x.id===p.id);assert.equal(o.owner,'P','only the project\'s buildings');assert(!o.reserved);assert(p.d<=CENTRAL[kind]+1e-9);assert(Math.abs(p.d-groundDistance(ground.get(p.id),[0,0]))<1e-9);}
  for(let i=2;i<set.length;i++)assert(set[i].d>=set[i-1].d,'nearest first');
  const left=owners.filter(o=>o.owner==='P'&&!o.reserved&&!set.some(p=>p.id===o.id)).map(o=>groundDistance(ground.get(o.id),[0,0]));
  if(set.length<MAX_CENTRAL)assert(left.every(d=>d>CENTRAL[kind]),'every own plot in the radius is in the set');
  else assert(left.every(d=>d>=set.at(-1).d),'the cap keeps the nearest');
 }
 assert(centralPlots('release',project,owners,groundOf).length===MAX_CENTRAL,'release capped at ~30');
 assert.deepEqual(centralPlots('release',project,[],groundOf).map(p=>p.id),[0],'no snapshot: main tower only');
}
assert(durationOf('pr-merged',70)>=900+70/WAVE.speed*1000+WAVE.rise+WAVE.decay);
assert(durationOf('pr-merged',70)<=6000,'merge stays short');
console.log('celebrations schedule ok');
