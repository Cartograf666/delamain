import assert from 'node:assert/strict';
import {districtBoundaries} from '../../assets/gl/district-boundary.js';
const project=([u,v])=>[.75*(u-v),.375*(u+v)];
const plot=(id,x,y)=>({id,footprint:[[x,y],[x+8,y],[x+8,y+8],[x,y+8]].map(project)});
const geometry={plots:[]},owners=[];
for(let y=0;y<5;y++)for(let x=0;x<5;x++){const id=y*5+x;geometry.plots.push(plot(id,x*8,y*8));owners.push({id,owner:x===2&&y===2?'B':'A'});}
geometry.plots.push(plot(99,100,100));owners.push({id:99,owner:'A'});
const d=districtBoundaries(geometry,owners,{step:1,reach:0});
assert.equal(d.paths.get('A').length,3,'outer perimeter, enclave hole, detached component');
assert.equal(d.paths.get('B').length,1);assert(d.paths.get('A').every(q=>q.length===4),'adjacent owned cells simplify to perimeter only');
assert.equal(d.at(...project([4,4])),'A');assert.equal(d.at(...project([20,20])),'B');assert.equal(d.at(...project([60,60])),null);assert.equal(d.at(...project([104,104])),'A');
owners[12].reserved=true;const reserved=districtBoundaries(geometry,owners,{step:1,reach:0});assert.equal(reserved.at(...project([20,20])),null);assert.equal(reserved.paths.get('A').length,3);
// Diagonal-only contacts do not produce open paths; long water/street gaps stay empty.
const separate=districtBoundaries({plots:[plot(0,0,0),plot(1,8,8),plot(2,90,90)]},[{id:0,owner:'A'},{id:1,owner:'B'},{id:2,owner:'A'}]);assert.equal(separate.at(...project([50,50])),null);assert(separate.paths.get('A').length>=2);
console.log('PASS: exterior contours, no same-owner internal edges, neighbour enclave, reserved hole, disconnected parts, bounded reach');
