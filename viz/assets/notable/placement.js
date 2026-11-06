/* Shared build/runtime validation. Pure geometry in the map's authored grid. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.NotablePlacement=api;})(globalThis,function(){
 const overlap=(a,b)=>a[0]<b[2]&&a[2]>b[0]&&a[1]<b[3]&&a[3]>b[1];
 function pointSegment(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p[0]-a[0]-dx*t,p[1]-a[1]-dy*t);}
 function intersects(a,b,c,d){const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);return cross(a,b,c)*cross(a,b,d)<=0&&cross(c,d,a)*cross(c,d,b)<=0&&Math.max(a[0],b[0])>=Math.min(c[0],d[0])&&Math.max(c[0],d[0])>=Math.min(a[0],b[0])&&Math.max(a[1],b[1])>=Math.min(c[1],d[1])&&Math.max(c[1],d[1])>=Math.min(a[1],b[1]);}
 function clearance(rect,a,b){if([a,b].some(p=>p[0]>=rect[0]&&p[0]<=rect[2]&&p[1]>=rect[1]&&p[1]<=rect[3]))return 0;
 const corners=[[rect[0],rect[1]],[rect[2],rect[1]],[rect[2],rect[3]],[rect[0],rect[3]]];let distance=Infinity;
 for(let i=0;i<4;i++){const c=corners[i],d=corners[(i+1)%4];if(intersects(a,b,c,d))return 0;distance=Math.min(distance,pointSegment(a,c,d),pointSegment(b,c,d),pointSegment(c,a,b),pointSegment(d,a,b));}return distance;}
 function segments(data,roads){const ca=Math.cos(data.g*Math.PI/180),sa=Math.sin(data.g*Math.PI/180),grid=p=>{const x=p[0]-data.center[0],y=p[1]-data.center[1];return [x*ca+y*sa,-x*sa+y*ca];};return roads.roads.flatMap((r,ri)=>r.points.slice(1).map((p,i)=>({a:grid(r.points[i]),b:grid(p),radius:({avenue:12,collector:7,street:3.5}[r.class])/2,ri})));}
 function rect(landmark,models,plaza=true){const [w,d]=models[landmark.model].footprint,[x,y]=landmark.position,p=plaza?landmark.plaza:0;return [x-w/2-p,y-d/2-p,x+w/2+p,y+d/2+p];}
 function validate(data,roads,pack,placements,models){const seg=segments(data,roads),keys=[pack.keys.owner,...pack.keys.hubs],removed=new Set(),rects=[];let minRoadClearance=Infinity;
 for(const l of placements){const r=rect(l,models);for(const s of seg){const gap=clearance(r,s.a,s.b)-s.radius;minRoadClearance=Math.min(minRoadClearance,gap);if(gap<=0)throw Error(l.model+' touches road '+s.ri);}for(const id of keys)if(overlap(r,data.boxes[id]))throw Error(l.model+' touches key '+id);if(rects.some(q=>overlap(q,r)))throw Error('Landmark footprints overlap');rects.push(r);data.boxes.forEach((b,i)=>{if(overlap(r,b))removed.add(i);});}
 return {removed:[...removed].sort((a,b)=>a-b),minRoadClearance};}
 // Same partial order as render.py. Broad footprints must participate, not be appended atop neighbours.
 function order(boxes){const n=boxes.length,after=Array.from({length:n},()=>[]),degree=Array(n).fill(0),behind=(a,b)=>(a[2]<=b[0]+1e-6&&a[1]<b[3]-1e-6&&a[3]>b[1]+1e-6)||(a[3]<=b[1]+1e-6&&a[0]<b[2]-1e-6&&a[2]>b[0]+1e-6);
 for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){if(behind(boxes[i].box,boxes[j].box)){after[i].push(j);degree[j]++;}else if(behind(boxes[j].box,boxes[i].box)){after[j].push(i);degree[i]++;}}
 const queue=[];for(let i=0;i<n;i++)if(!degree[i])queue.push(i);const out=[];
 while(queue.length){queue.sort((a,b)=>(boxes[b].box[2]+boxes[b].box[3])-(boxes[a].box[2]+boxes[a].box[3])||b-a);const i=queue.pop();out.push(boxes[i]);for(const j of after[i])if(--degree[j]===0)queue.push(j);}
 if(out.length!==n)throw Error('Painter order contains a cycle');return out;
 }
 return {overlap,clearance,segments,rect,validate,order};
});
