// A single tangent-continuous cubic in the city's 2:1 ground metric.
// Planning happens on departure; frame updates only sample the immutable route.
const metric = p => [p[0], p[1] * 2];
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export const settle = t => { t = Math.max(0, Math.min(1, t)); return t*t*t*(10+t*(-15+6*t)); };
const CLEARANCE=4,ARCS=[.5,.38,.28,.2,.13],ARC_MAX=170,ARC_MIN=14;
export function cubic(points, t) {
  const u = 1-t, [a,b,c,d] = points;
  return [0,1].map(i => u*u*u*a[i]+3*u*u*t*b[i]+3*u*t*t*c[i]+t*t*t*d[i]);
}
function contains(p, polygon) {
  let inside = false;
  for (let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
    const a=polygon[i],b=polygon[j];
    if ((a[1]>p[1]) !== (b[1]>p[1]) && p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0]) inside=!inside;
  }
  return inside;
}
function edgeDistance(p,a,b) {
  const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1)));
  return Math.hypot(p[0]-a[0]-dx*t,p[1]-a[1]-dy*t);
}
export function createFlightPlanner(buildings) {
  const cell=64, margin=12, buckets=new Map(), obstacles=[];
  for (const b of buildings) {
    const walls=b.surfaces.filter(s=>s.kind==='wall');
    for (const roof of b.surfaces.filter(s=>s.kind==='roof')) {
      const wall=walls.find(w=>roof.points.some(p=>distance(p,w.points[2])<.03));
      if (!wall) continue;
      const height=wall.points[1][1]-wall.points[2][1];
      const polygon=roof.points.map(p=>metric([p[0],p[1]+height]));
      const xs=polygon.map(p=>p[0]),ys=polygon.map(p=>p[1]);
      const bounds=[Math.min(...xs)-margin,Math.min(...ys)-margin,Math.max(...xs)+margin,Math.max(...ys)+margin];
      const o={id:b.id,height,polygon,bounds};obstacles.push(o);
      for(let x=Math.floor(bounds[0]/cell);x<=Math.floor(bounds[2]/cell);x++)for(let y=Math.floor(bounds[1]/cell);y<=Math.floor(bounds[3]/cell);y++){
        const key=`${x},${y}`;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(o);
      }
    }
  }
  function ceiling(p, clearance=margin) {
    let z=0;
    for(const o of buckets.get(`${Math.floor(p[0]/cell)},${Math.floor(p[1]/cell)}`)||[]) {
      if(o.height<=z)continue;
      if(contains(p,o.polygon)||o.polygon.some((a,i)=>edgeDistance(p,a,o.polygon[(i+1)%o.polygon.length])<=clearance))z=o.height;
    }
    return z;
  }
  function plan(from,to,{height,targetHeight,speed,heading=null,initialSpeed=0}={}) {
    const a=metric(from),d=metric(to),len=Math.max(1,distance(a,d)),dx=(d[0]-a[0])/len,dy=(d[1]-a[1])/len;
    const baseHeight=Math.max(height,targetHeight)+24;
    // The smaller bend wins unless a taller obstacle makes the other side cheaper.
    let best=null;
    for(const bend of [.12,-.12,.3,-.3,.55,-.55,0]) {
      const offset=len*bend;
      const b=heading==null?[a[0]+dx*len/3-dy*offset,a[1]+dy*len/3+dx*offset]:[a[0]+Math.cos(heading)*len/3,a[1]+Math.sin(heading)*len/3];
      const c=[d[0]-dx*len/3-dy*offset,d[1]-dy*len/3+dx*offset],points=[a,b,c,d];
      const count=Math.max(16,Math.ceil((distance(a,b)+distance(b,c)+distance(c,d))/4));
      const samples=[{t:0,s:0}],start=cubic(points,0);let prev=start,length=0,altitude=Math.max(baseHeight,ceiling(start)+18);
      for(let i=1;i<=count;i++){
        const t=i/count,p=cubic(points,t);length+=distance(prev,p);altitude=Math.max(altitude,ceiling(p)+18);samples.push({t,s:length});prev=p;
      }
      const cost=length+(altitude-baseHeight)*4;
      if(!best||cost<best.cost)best={points,samples,length,altitude,cost};
    }
    // Climb and approach belong to the flight: one arc, not lift, cruise and lift. Each is as long as the buildings under it
    // allow; zero means no arc fits (a taller neighbour at the pad) and the flyer rises or descends in place.
    const heights=best.samples.map(q=>ceiling(cubic(best.points,q.t),CLEARANCE));
    const fits=(from,to,len,side)=>best.samples.every((q,i)=>{const u=side==='up'?q.s/len:(best.length-q.s)/len;return u>=1||from+(to-from)*settle(u)+.2>=heights[i];});
    const arc=(from,side)=>ARCS.map(k=>Math.min(best.length*k,ARC_MAX)).find(len=>len>=ARC_MIN&&fits(from,best.altitude,len,side))||0;
    best.from=height;best.to=targetHeight;best.climb=arc(height,'up');best.approach=arc(targetHeight,'down');
    const vertical=(best.climb?best.altitude-height:0)+(best.approach?best.altitude-targetHeight:0);
    best.duration=Math.max(2.4,best.length*1.5/speed,vertical*2/speed);
    best.initialVelocity=Math.min(1.5,initialSpeed*best.duration/Math.max(1,best.length));
    return best;
  }
  return {plan,ceiling,obstacles,canLand:(p,z)=>ceiling(metric(p),0)<=z+.2,sample:sampleFlight};
}
export function sampleFlight(route, progress) {
  const u=Math.max(0,Math.min(1,progress)),v=route.initialVelocity||0;
  // Zero end velocity/acceleration; preserve departure velocity when rerouted in air.
  const fraction=v*u+(10-6*v)*u**3+(-15+8*v)*u**4+(6-3*v)*u**5;
  const s=Math.max(0,Math.min(route.length,fraction*route.length)),L=route.samples;
  let lo=0,hi=L.length-1;while(hi-lo>1){const mid=(lo+hi)>>1;if(L[mid].s<s)lo=mid;else hi=mid;}
  const t=L[lo].t+(L[hi].t-L[lo].t)*(s-L[lo].s)/(L[hi].s-L[lo].s||1),p=cubic(route.points,t),[a,b,c,d]=route.points,q=1-t;
  const dx=3*q*q*(b[0]-a[0])+6*q*t*(c[0]-b[0])+3*t*t*(d[0]-c[0]);
  const dy=3*q*q*(b[1]-a[1])+6*q*t*(c[1]-b[1])+3*t*t*(d[1]-c[1]);
  let z=route.altitude;
  if(route.climb&&s<route.climb)z=route.from+(route.altitude-route.from)*settle(s/route.climb);
  if(route.approach&&route.length-s<route.approach)z=route.to+(route.altitude-route.to)*settle((route.length-s)/route.approach);
  return {x:p[0],y:p[1]/2,z,heading:Math.atan2(dy,dx)};
}
