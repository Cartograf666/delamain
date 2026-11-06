// A presentation envelope of exact plot ownership, not a simulation boundary.
// Partition only the occupied neighbourhood: at most 10 ground units from a
// footprint. Wide streets/water stay gaps; reserved and unowned plots cut holes.
// Equal-owner cells have no internal edges. All components and holes survive.
export function districtBoundaries(geometry, owners, {step=2, reach=10}={}) {
  const ground=([x,y])=>[(x+2*y)/1.5,(2*y-x)/1.5];
  const project=([u,v])=>[.75*(u-v),.375*(u+v)];
  const byID=new Map(owners.map(p=>[p.id,p]));
  const names=[null,...new Set(owners.filter(p=>p.owner&&!p.reserved).map(p=>p.owner))],ids=new Map(names.map((s,i)=>[s,i]));
  const boxes=geometry.plots.map(p=>{const q=p.footprint.map(ground),o=byID.get(p.id);return {id:p.id,owner:o&&!o.reserved?ids.get(o.owner)||0:0,x0:Math.min(...q.map(p=>p[0])),x1:Math.max(...q.map(p=>p[0])),y0:Math.min(...q.map(p=>p[1])),y1:Math.max(...q.map(p=>p[1]))};}).sort((a,b)=>a.id-b.id);
  const x0=Math.floor((Math.min(...boxes.map(b=>b.x0))-reach)/step)*step,y0=Math.floor((Math.min(...boxes.map(b=>b.y0))-reach)/step)*step;
  const width=Math.ceil((Math.max(...boxes.map(b=>b.x1))+reach-x0)/step)+1,height=Math.ceil((Math.max(...boxes.map(b=>b.y1))+reach-y0)/step)+1;
  const mask=new Int32Array(width*height),distance=new Float32Array(mask.length).fill(Infinity);
  for(const b of boxes)for(let y=Math.max(0,Math.floor((b.y0-reach-y0)/step));y<Math.min(height,Math.ceil((b.y1+reach-y0)/step));y++)for(let x=Math.max(0,Math.floor((b.x0-reach-x0)/step));x<Math.min(width,Math.ceil((b.x1+reach-x0)/step));x++){
    const u=x0+(x+.5)*step,v=y0+(y+.5)*step,dx=Math.max(b.x0-u,0,u-b.x1),dy=Math.max(b.y0-v,0,v-b.y1),d=dx*dx+dy*dy,k=y*width+x,score=d+((u-(b.x0+b.x1)/2)**2+(v-(b.y0+b.y1)/2)**2)*.000001;
    if(d<=reach*reach&&score<distance[k]){distance[k]=score;mask[k]=b.owner;}
  }
  const edges=new Map(),key=(x,y)=>y*(width+1)+x;
  const add=(id,x,y,xx,yy)=>{if(!edges.has(id))edges.set(id,new Map());const e=edges.get(id),k=key(x,y);if(!e.has(k))e.set(k,[]);e.get(k).push(key(xx,yy));};
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){const id=mask[y*width+x];if(!id)continue;
    if(!y||mask[(y-1)*width+x]!==id)add(id,x,y,x+1,y);
    if(x===width-1||mask[y*width+x+1]!==id)add(id,x+1,y,x+1,y+1);
    if(y===height-1||mask[(y+1)*width+x]!==id)add(id,x+1,y+1,x,y+1);
    if(!x||mask[y*width+x-1]!==id)add(id,x,y+1,x,y);
  }
  const paths=new Map();
  for(const [id,edgesByStart]of edges){const loops=[];while(edgesByStart.size){const start=edgesByStart.keys().next().value;let k=start;const loop=[];do{loop.push(k);const to=edgesByStart.get(k);if(!to)throw Error('Open district contour');const next=to.pop();if(!to.length)edgesByStart.delete(k);k=next;}while(k!==start);
      // Drop only collinear vertices. Do not smooth away holes or enclaves.
      loops.push(loop.filter((k,i)=>{const a=loop[(i+loop.length-1)%loop.length],b=loop[(i+1)%loop.length];return !((a%(width+1)===k%(width+1)&&b%(width+1)===k%(width+1))||(Math.floor(a/(width+1))===Math.floor(k/(width+1))&&Math.floor(b/(width+1))===Math.floor(k/(width+1))));}).map(k=>project([x0+(k%(width+1))*step,y0+Math.floor(k/(width+1))*step])));
    }paths.set(names[id],loops);}
  return {paths,at(x,y){const [u,v]=ground([x,y]),i=Math.floor((u-x0)/step),j=Math.floor((v-y0)/step);return i<0||j<0||i>=width||j>=height?null:names[mask[j*width+i]];},cellCount:mask.length};
}
