// Traffic is a three-minute density average, never an instantaneous occupancy switch.
export function updateRoadTraffic(values, counts, lengths, dt) {
  const a = -Math.expm1(-Math.max(0, dt) / 180);
  for (let i = 0; i < values.length; i++) {
    // One isolated car contributes nothing, even on the shortest road.
    const density = Math.min(1, Math.max(0, counts[i] - 1) / Math.max(3, (lengths[i] || 0) / 60));
    values[i] += (density - values[i]) * a;
  }
}

// Fixed isometric ground metric. Geometry is built once per destination, not per frame.
const distance = (a, b) => Math.hypot(a[0] - b[0], (a[1] - b[1]) * 2);
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
function crosses(a, b, c, d) {
  const r = [b[0]-a[0], b[1]-a[1]], s = [d[0]-c[0], d[1]-c[1]], den = cross(r,s);
  if (Math.abs(den) < 1e-8) return false;
  const q = [c[0]-a[0],c[1]-a[1]], t = cross(q,s)/den, u = cross(q,r)/den;
  return t > .0001 && t < .9999 && u >= 0 && u <= 1;
}
export function createArrivalWalls(buildings) {
  const radius = 45, cell = 64, buckets = new Map(), cache = new Map();
  const key = (x,y) => `${x},${y}`;
  const records = buildings.map(building => {
    const walls = building.surfaces.filter(f => f.kind === 'wall');
    // Recover ground footprints from the exported roof and its matching wall height.
    const edges = [];
    for (const roof of building.surfaces.filter(f => f.kind === 'roof')) {
      const wall = walls.find(w => roof.points.some(p => distance(p,w.points[2]) < .02));
      if (!wall) continue;
      const h = wall.points[1][1] - wall.points[2][1];
      const q = roof.points.map(p => [p[0],p[1]+h]);
      q.forEach((p,i) => edges.push([p,q[(i+1)%q.length]]));
    }
    if (!edges.length) for (const w of walls) edges.push(w.points.slice(0,2));
    const points = edges.flat(), xs=points.map(p=>p[0]), ys=points.map(p=>p[1]*2);
    return {building,walls,edges,bounds:[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)]};
  });
  for (const r of records) {
    const [x0,y0,x1,y1]=r.bounds;
    for(let x=Math.floor(x0/cell);x<=Math.floor(x1/cell);x++)for(let y=Math.floor(y0/cell);y<=Math.floor(y1/cell);y++){
      const k=key(x,y);if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(r);
    }
  }
  return function arrivalWalls(target) {
    if(cache.has(target.id))return cache.get(target.id);
    const source=target.ground, nearby=new Set(), result=[];
    for(let x=Math.floor((source[0]-radius)/cell);x<=Math.floor((source[0]+radius)/cell);x++)for(let y=Math.floor((source[1]*2-radius)/cell);y<=Math.floor((source[1]*2+radius)/cell);y++)for(const r of buckets.get(key(x,y))||[])nearby.add(r);
    for(const face of target.surfaces)if(face.kind==='wall')result.push({points:face.points,layer:face.layer,gains:[1,1,1,1],buildingId:target.id});
    for(const r of nearby){
      if(r.building.id===target.id)continue;
      const blockers=[...nearby].filter(b=>b!==r&&b.building.id!==target.id);
      const gain=p=>{
        const t=distance(source,p)/radius;if(t>=1)return 0;
        if(blockers.some(b=>b.edges.some(([a,z])=>crosses(source,p,a,z))))return 0;
        const k=1-t;return .45*k*k*(3-2*k);
      };
      for(const face of r.walls){
        const [a,b,c,d]=face.points,n=Math.max(1,Math.ceil(distance(a,b)/3));
        for(let i=0;i<n;i++){
          const t=i/n,u=(i+1)/n,A=mix(a,b,t),B=mix(a,b,u),ga=gain(A),gb=gain(B);
          if(!ga&&!gb)continue;
          result.push({points:[A,B,mix(d,c,u),mix(d,c,t)],layer:face.layer,gains:[ga,gb,gb,ga],buildingId:r.building.id});
        }
      }
    }
    cache.set(target.id,result);return result;
  };
}

// Bound combined arrivals per receiving building, including overlapping targets.
// Per-event maxima provide a conservative bound at every wall vertex/fragment.
// Wall light (2026-11-05): a lone delivery lights its receiving walls at ARRIVAL_PEAK=1.8 (1.0 before, 0.5 before that) and
// sends a window pulse of PULSE_PEAK=0.7 up the receiving building within PULSE_MS. Per building the drawn sum of wall
// light and pulse over all overlapping arrivals never exceeds ARRIVAL_CEILING=2.5: a lone delivery just reaches it,
// overlaps are scaled down to it. Values are uplight alpha gains; the GPU clamps each fragment at 1.
export const ARRIVAL_PEAK=1.8, PULSE_PEAK=.7, PULSE_MS=1000, ARRIVAL_CEILING=ARRIVAL_PEAK+PULSE_PEAK;
export function arrivalFrame(beams, now) {
  const totals = new Map(), smooth = t => t*t*(3-2*t);
  for (const b of beams) {
    const dt = now-b.t;
    const rise=b.rise??170;
    b.gain = dt < 0 ? 0 : dt < rise ? smooth(dt/rise) : dt < 850 ? 1 : smooth(Math.max(0,1-(dt-850)/1150));
    // The pulse front climbs from the base (u=0) to the roof (u=1); it fades in over 80 ms and out over its last 20 %.
    b.pulseU = Math.max(0,Math.min(1,dt/PULSE_MS));
    const pulse = b.pulse&&b.building&&dt>=0&&dt<PULSE_MS ? Math.min(1,dt/80)*Math.min(1,(1-b.pulseU)/.2) : 0;
    b.wall = b.gain*ARRIVAL_PEAK*(b.strength??1);b.pulseLight = pulse*PULSE_PEAK*(b.strength??1);
    if (!b.levels) {
      b.levels = new Map();
      for (const face of b.walls) b.levels.set(face.buildingId,Math.max(b.levels.get(face.buildingId)||0,...face.gains));
    }
    for (const [id,peak] of b.levels) totals.set(id,(totals.get(id)||0)+peak*b.wall+(id===b.building?.id?b.pulseLight:0));
  }
  return new Map([...totals].map(([id,total])=>[id,total>ARRIVAL_CEILING?ARRIVAL_CEILING/total:1]));
}

// Landing as an event (2026-11-05). A delivery with cargo is the full effect, a patrol or empty return lands at half.
// At most LANDING_MAX effects play at once: when another lands, the currently weakest (scale x envelope, then the
// oldest; the newcomer included) fades out over LANDING_FADE ms. The drawn sum of scale x envelope is scaled down to
// LANDING_BUDGET (two full deliveries), so five deliveries at once do not white out the screen.
export const LANDING_MAX=4, LANDING_BUDGET=2, LANDING_LIFE=1400, LANDING_FADE=200;
const landingScale = kind => kind==='delivery' ? 1 : .5;
// Envelope: up in 60 ms, holds through the 150 ms flash, then eases out with the bloom by LANDING_LIFE.
function landingEnvelope(e, now) {
  const dt=now-e.t, smooth=t=>t*t*(3-2*t);if(dt<0||dt>=LANDING_LIFE)return 0;
  const v=dt<60?dt/60:dt<150?1:1-smooth((dt-150)/(LANDING_LIFE-150));
  return e.fade==null?v:v*Math.max(0,1-(now-e.fade)/LANDING_FADE);
}
function admitLanding(list, e, now) {
  const out=list.filter(x=>now-x.t<LANDING_LIFE&&(x.fade==null||now-x.fade<LANDING_FADE)),playing=out.filter(x=>x.fade==null),weight=x=>x===e?x.scale:x.scale*landingEnvelope(x,Math.max(now,x.t+60)); // still rising counts as its peak
  playing.push(e);
  while(playing.length>LANDING_MAX){const w=playing.reduce((a,b)=>weight(b)<weight(a)||weight(b)===weight(a)&&b.t<a.t?b:a);playing.splice(playing.indexOf(w),1);if(w===e)return out;w.fade=now;}
  out.push(e);return out;
}
// Sets e.env (0..1) and e.k (the shared budget factor) on every effect; returns k.
function landingFrame(list, now) {
  let sum=0;for(const e of list){e.env=landingEnvelope(e,now);sum+=e.scale*e.env;}
  const k=sum>LANDING_BUDGET?LANDING_BUDGET/sum:1;for(const e of list)e.k=k;return k;
}
export const landing={scale:landingScale,envelope:landingEnvelope,admit:admitLanding,frame:landingFrame};
