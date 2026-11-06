// Run: node viz/tests/growth/fade.test.mjs
// Territory growth as a gradual recolouring: order from the new owner's remaining land outwards, about 25 s in all.
import assert from 'node:assert/strict';
import {fadePlan,fadeLevel,FADE} from '../../assets/gl/growth.js';

// A row of plots: B holds 0..3, gains 4..11 from A; A keeps 12..15.
const plots=new Map(Array.from({length:16},(_,i)=>[i,{ground:[i*10,0]}]));
const owners=Array.from({length:16},(_,i)=>({id:i,owner:i<12?'B':'A'}));
const moved=[11,4,9,6,5,10,7,8];
const plan=fadePlan([{from:'A',to:'B',plots:moved}],plots,owners);
assert.equal(plan.length,moved.length);assert.deepEqual(plan.map(p=>p.plot).sort((a,b)=>a-b),[4,5,6,7,8,9,10,11]);
for(const p of plan){assert.equal(p.from,'A');assert.equal(p.to,'B');assert.equal(p.duration,FADE.plot);assert(p.start>=0&&p.start+p.duration<=FADE.total);}
assert.equal(FADE.total,25000);
// Loose order: by distance from B's own land, each start within FADE.loose of a step from its rank's slot.
const step=(FADE.total-FADE.plot)/(moved.length-1),rank=new Map([4,5,6,7,8,9,10,11].map((id,i)=>[id,i]));
for(const p of plan)assert(Math.abs(p.start-rank.get(p.plot)*step)<=FADE.loose*step+1e-6,`plot ${p.plot} starts at ${p.start}`);
const start=new Map(plan.map(p=>[p.plot,p.start]));
assert(start.get(4)<start.get(7)&&start.get(7)<start.get(11),'the border creeps outwards');
assert(start.get(4)<.1*FADE.total&&Math.max(...plan.map(p=>p.start+p.duration))>.9*FADE.total,'spread over the whole 25 s');
assert.deepEqual(fadePlan([{from:'A',to:'B',plots:moved}],plots,owners),plan,'deterministic');
// Cross-fade: 0 before its start, 1 after start + duration, monotonic in between; no flash (never above 1).
const p=plan[0];let prev=-1;for(let t=0;t<=FADE.total;t+=250){const k=fadeLevel(p,t);assert(k>=prev&&k>=0&&k<=1);prev=k;}
assert.equal(fadeLevel(p,p.start-1),0);assert.equal(fadeLevel(p,p.start+p.duration),1);
assert(Math.abs(fadeLevel(p,p.start+p.duration/2)-.5)<1e-9);
// One plot, a vacated plot (no new owner: switched at once) and no batch.
assert.deepEqual(fadePlan([{from:'A',to:'B',plots:[4]}],plots,owners).map(x=>x.start),[0]);
assert.equal(fadePlan([{from:'B',to:'',plots:[3]}],plots,owners).length,0);assert.deepEqual(fadePlan(null,plots,owners),[]);
console.log('growth fade ok');
