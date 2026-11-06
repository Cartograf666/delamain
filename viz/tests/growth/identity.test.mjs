import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createGrowthModel,hueColour} from '../../assets/gl/growth.js';
import {createProjectIdentity} from '../../assets/gl/project-identity.js';

const roof=(x,y,r=4)=>[[x,y-r/2],[x+r,y],[x,y+r/2],[x-r,y]];
const building=(id,x,y,kind='b',r=4)=>({id,kind,ground:[x,y],surfaces:[{kind:'roof',layer:id,points:roof(x,y-10,r)}]});
const plot=(id,building,x,y,reserved=false)=>({id,building,ground:[x,y],footprint:roof(x,y),reserved});
const scene={buildings:[building(90,100,100,'hero'),building(10,20,20),building(20,40,40,'n:landmark',12),building(30,1000,1000,'n:landmark'),building(40,70,70)],pads:[[0,0,0,'hero',20,[100/.75,140/.75]],[0,0,0,'b',3,[20/.75,60/.75]]],owners:{10:10,20:20,40:40}};
const geometry={plots:[plot(501,10,20,20),plot(502,null,38,40),plot(503,null,42,40),plot(504,null,40,40,true),plot(505,40,70,70)]};
const project=(id,extra={})=>({id,colour:'#328092',light:1,...extra});
const data={projects:[project('music'),project('anchor',{mainPlot:{id:502},tower:-1})],plotOwners:geometry.plots.map(p=>({id:p.id,owner:p.reserved?'':'music',reserved:p.reserved,dark:false,level:2}))};
const identity=createProjectIdentity(scene,geometry);identity.set(data);
assert.equal(identity.entry(10).project.id,'music');
assert.equal(identity.entry(20).project.id,'anchor','virtual main containment outranks neighbouring project');
assert.equal(identity.entry(20).reason,'main-containment');
assert.equal(identity.entry(30),undefined,'never assign a remote landmark to a nearest tower');
assert.equal(identity.entry(90),undefined,'global owner remains protected');
assert.equal(identity.atGround(20.05,20.02).id,10);assert.equal(identity.atGround(23,20),undefined);
assert.equal(identity.atRoof(20,10).id,10);
data.projects[1].mainPlot=null;identity.set(data);assert.equal(identity.entry(20).project.id,'music');assert.equal(identity.entry(20).reason,'geographic-containment');
assert(data.plotOwners.find(p=>p.id===504).reserved);assert.equal(data.plotOwners.find(p=>p.id===504).owner,'');
data.plotOwners.find(p=>p.id===502).owner='';identity.set(data);assert.equal(identity.entry(20),undefined,'one nearby owner is insufficient for reserved landmark');
data.projects[1].tower=1;identity.set(data);assert.equal(identity.entry(10).project.id,'anchor','explicit tower precedes parcel identity');
data.projects[1].tower=0;identity.set(data);assert.equal(identity.entry(90),undefined,'even an explicit anchor cannot claim the global owner');

const model=createGrowthModel(scene,geometry);data.projects[1].tower=-1;model.set(data,true);
const hue=c=>{const hi=Math.max(...c),lo=Math.min(...c),d=hi-lo;return d===0?0:hi===c[0]?((c[1]-c[2])/d+6)%6:hi===c[1]?(c[2]-c[0])/d+2:(c[0]-c[1])/d+4;};
for(const colour of [[255,0,0],[0,0,255],[0,255,0],[19,18,39],[27,25,50]])assert(Math.abs(hue(model.material(10,colour))-hue(hueColour([100,100,100],'#328092',1)))<1e-10,'source colour cannot rotate project hue');
assert.notDeepEqual(model.material(10,[19,18,39]),[19,18,39],'fixed landing buildings also receive colour');
assert.deepEqual(model.point(10,[20,10]),[20,10],'fixed landing geometry stays fixed');
const input=new Float32Array([.2,.8,.9,-1,.7,.3,.1,0]),wins=[[null,null,10.15],[null,null,10.75]];
const tinted=model.windows(input,wins);assert.equal(tinted[3],-1);assert.equal(tinted[7],0);assert.deepEqual(Array.from(input),[...new Float32Array([.2,.8,.9,-1,.7,.3,.1,0])]);
data.plotOwners[0].dark=true;model.set(data,true);assert.deepEqual(model.material(10,[19,18,39]),[19,18,39]);assert.deepEqual(model.windows(input,wins),input);assert.deepEqual(model.lightColour(10,[255,0,0]),[255,0,0]);
model.set(data,false);assert.deepEqual(model.windows(input,wins),input);assert.deepEqual(model.lightColour(10,[255,0,0]),[255,0,0]);

// Stable real IDs: never substitute plot IDs for scene IDs, or move protected sites.
const realScene=JSON.parse(readFileSync(new URL('../../assets/gl/scene.json',import.meta.url))),realGeometry=JSON.parse(readFileSync(new URL('../../assets/gl/growth-plots.json',import.meta.url)));
const real=createGrowthModel(realScene,realGeometry);
const main=realGeometry.plots.find(p=>p.id===1676);assert.equal(main.building,null);
const realData={projects:[project('Delamain',{mainPlot:{id:1676},tower:-1})],plotOwners:realGeometry.plots.map(p=>({id:p.id,owner:p.id===1676?'Delamain':'',reserved:p.id===1675}))};
real.set(realData,true);assert.equal(real.identity(3929).project.id,'Delamain');assert.equal(real.identity(3929).reason,'main-containment');assert.equal(real.identity(418),undefined);assert.equal(real.identity(3933),undefined);
assert.notEqual(real.buildingPlots.get(10),10);
console.log('PASS: stable IDs, virtual main, explicit anchor priority, reserved geographic support, remote/unowned negatives, protected owner, fixed roof colour, single hue, masks and dark restoration');

// An unlinked replacement house inside an explicitly vacant parcel must not
// inherit a nearby project's envelope, colour or picking identity.
const replacement=building(777,20,20),replacementScene={...scene,buildings:[...scene.buildings,replacement]};
const vacant=structuredClone(data);vacant.projects.forEach(p=>{p.mainPlot=null;p.tower=-1;});vacant.plotOwners.find(p=>p.id===501).owner='';
const vacantIdentity=createProjectIdentity(replacementScene,geometry);vacantIdentity.set(vacant,()=> 'music');
assert.equal(vacantIdentity.entry(777),undefined,'explicit empty footprint vetoes geographic fallback even within an owned envelope');
assert.equal(vacantIdentity.entry(10),undefined,'linked empty house stays neutral');
const vacantModel=createGrowthModel(replacementScene,geometry);vacantModel.set(vacant,true);
assert.deepEqual(vacantModel.material(777,[50,60,70]),[50,60,70],'empty replacement stays neutral');
console.log('PASS: vacant linked and unlinked parcel vetoes geographic project assignment');
