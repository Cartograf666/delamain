const assert=require('node:assert/strict');const {CityHeat,CityReplay}=require('../../assets/live/model.js');const config=require('../../assets/live/config.json');
const ids=['core','docks','bazaar'];const ev={tag:'worker',from:['a','worker']};
const h=new CityHeat(ids,config);assert.equal(h.heat('core'),0);h.ingest('docks',ev,0);h.decay(480000);assert.equal(h.heat('docks'),.19);h.decay(480000*20);assert.equal(h.heat('docks'),0);
const a=new CityHeat(ids,config),b=new CityHeat(ids,config);for(let i=0;i<60;i++){a.ingest('bazaar',ev,i*1000);b.decay(i*1000-500);b.ingest('bazaar',ev,i*1000);}assert.deepEqual(a.snapshot(),b.snapshot());assert.ok(a.heat('bazaar')<1&&a.heat('bazaar')>.9);
assert.equal(a.ingest('core',{tag:'pace'},61000),false);assert.equal(a.heat('core'),0);
// Decay query frequency must not change the semantic result (within FP error).
const c=new CityHeat(ids,config);c.ingest('docks',ev,0);for(let t=1000;t<=480000;t+=1000)c.decay(t);assert.ok(Math.abs(c.heat('docks')-.19)<1e-12);
const events=[0,1000,60000,7200000].map(t=>['s',{...ev,at:new Date(t).toISOString()}]);const r=new CityReplay(events,0,120,0),got=[];r.step(10,(s,e)=>got.push(e));assert.equal(got.length,2);r.step(500,(s,e)=>got.push(e));assert.equal(got.length,3);r.step(60000,(s,e)=>got.push(e));assert.equal(got.length,4);assert.equal(r.time,7200000);
assert.doesNotThrow(()=>new CityReplay([],0,1,0).step(1000,()=>{}));console.log('PASS zero, half-life, repeat heat, saturation, system exclusion, exact replay intervals, empty history');
