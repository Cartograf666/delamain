// A hub's own building stands out: a spire with a beacon, a light column above the roof, a ground ring at its foot and
// edge light on its walls. All of it is painter geometry at the building's depth, so nearer buildings hide it exactly
// like the arrival light; nothing shines through walls. The building itself grows with the session context
// (hubHeightFactor); main.js scales its mesh, roof slots and clearance, and this geometry follows through point().
import {displayColour,liftPoint} from './growth.js';
import {createFlightPlanner} from './flight.js';
export const GOLD=[255,215,106];   // viz.html C.gold; reserved for open owner questions
const rgb=hex=>/^#[\da-f]{6}$/i.test(hex||'')?hex.slice(1).match(/../g).map(x=>parseInt(x,16)):[180,140,255];
// Beacon/sign signal. Open owner questions flash gold once a second (viz.html blink), otherwise the project colour
// pulses slowly with a ~3 s period. Reduced motion holds a steady glow.
export function hubSignal(questions,now,reduced=false){
  if(questions>0)return {gold:true,k:reduced?1:Math.max(0,Math.min(1,.5+1.4*Math.sin(now*2*Math.PI/1000)))};
  return {gold:false,k:reduced?.8:.55+.45*(.5+.5*Math.sin(now*2*Math.PI/3000))};
}
export const HUB_CTX_FULL=350000;
// Hub building height factor: 1.5x on a fresh context, linear to 2.4x at 350k tokens, in 0.1 steps so a slowly growing
// context changes the building rarely. Never above 0.9x of the owner tower, never below the plain house; closed: 1.0.
export function hubHeightFactor(ctx,{open=true,height=1,ownerHeight=Infinity}={}){
  if(!open)return 1;
  const t=Math.max(0,Math.min(1,(+ctx||0)/HUB_CTX_FULL)),f=Math.round(15+9*t)/10;
  return Math.max(1,Math.min(f,Math.floor(.9*ownerHeight/height*10+1e-9)/10));
}
// Only a plain box (one roof, walls of one height) scales exactly; stepped landmarks would tear between tiers.
export function scalableHub(b){
  const walls=b?.surfaces.filter(f=>f.kind==='wall')||[],roofs=b?.surfaces.filter(f=>f.kind==='roof')||[];
  if(roofs.length!==1||!walls.length)return false;const h=walls.map(f=>f.points[1][1]-f.points[2][1]);
  return Math.max(...h)-Math.min(...h)<=.05;
}
// The building at height factor k: walls stretch from the ground, the roof and its equipment translate (growth.liftPoint).
export function scaledBuilding(b,k){return k===1?b:{...b,surfaces:b.surfaces.map(f=>({...f,points:f.points.map(p=>liftPoint(b,p,k-1))}))};}
// Patch one building's flight obstacles in place at factor k. The planner's spatial buckets hold these same objects and
// the footprint does not move, so the planner's own rules see the new height without a city-wide rebuild.
export function raiseClearance(obstacles,b,k){const fresh=createFlightPlanner([scaledBuilding(b,k)]).obstacles;let i=0;
  for(const o of obstacles)if(o.id===b.id&&fresh[i]){o.height=fresh[i].height;o.polygon=fresh[i++].polygon;}return i;}
// Roof, walls and the spire/column frame of one building, in scene coordinates (y grows down, heights in scene units).
export function hubGeometry(b){
  const walls=b.surfaces.filter(f=>f.kind==='wall'),roofs=b.surfaces.filter(f=>f.kind==='roof');if(!walls.length||!roofs.length)return null;
  const height=Math.max(...walls.map(f=>f.points[1][1]-f.points[2][1]));
  const area=q=>Math.abs(q.reduce((s,p,i)=>{const n=q[(i+1)%q.length];return s+p[0]*n[1]-n[0]*p[1];},0))/2;
  const roof=roofs.reduce((a,r)=>area(r.points)>area(a.points)?r:a),q=roof.points;
  const centre=[q.reduce((s,p)=>s+p[0],0)/q.length,q.reduce((s,p)=>s+p[1],0)/q.length];
  const back=q.reduce((a,p)=>p[1]<a[1]?p:a),xs=q.map(p=>p[0]),width=Math.max(...xs)-Math.min(...xs);
  const spire=Math.min(40,Math.max(30,height*.8)),column=Math.max(height*2.5,spire*2);
  // Footprint: the roof dropped by the wall height; the ring circles it on the ground.
  const foot=q.map(p=>[p[0],p[1]+height]),fx=foot.map(p=>p[0]),fy=foot.map(p=>p[1]);
  return {id:b.id,height,layer:roof.layer,roof:q,centre,width,base:back,tip:[back[0],back[1]-spire],spire,column,
    walls:walls.filter(f=>f.points[1][1]-f.points[2][1]>=height*.4),
    ground:[(Math.min(...fx)+Math.max(...fx))/2,(Math.min(...fy)+Math.max(...fy))/2],radius:(Math.max(...fx)-Math.min(...fx))/2};
}
// point: the growth vertex transform (Районы may raise a plot's building); reset() after it changes.
export function createHubLights({depth,buildings,point=(id,p)=>p}){
  const reduced=matchMedia('(prefers-reduced-motion: reduce)'),cache=new Map();let hubs=[];
  const geometry=id=>{if(!cache.has(id)){const b=buildings.find(b=>b.id===id);cache.set(id,b?hubGeometry({...b,surfaces:b.surfaces.map(f=>({...f,points:f.points.map(p=>point(b.id,p))}))}):null);}return cache.get(id);};
  const rgba=(c,a)=>[c[0]/255,c[1]/255,c[2]/255,a];
  return {
    geometry,colour:displayColour,reset(){cache.clear();},
    // [{building, colour (hex), questions}] for open hubs only; a closed hub is a plain building.
    set(list){hubs=list;},
    signal(questions,now){return hubSignal(questions,now,reduced.matches);},
    draw(g,now){if(!hubs.length)return;g.save();g.globalAlpha=1;
      for(const h of hubs){const G=geometry(h.building);if(!G)continue;
        const c=rgb(displayColour(h.colour)),s=hubSignal(h.questions,now,reduced.matches),beacon=s.gold?GOLD:c,z=depth(G.layer)-.000002;
        // Ground ring at the foot: crisp outline, soft pool in the bloom pass. Ground depth, so buildings hide it.
        const [gx,gy]=G.ground,R=G.radius*1.45+4;g.globalCompositeOperation='lighter';g.depth=.934;
        g.strokeStyle=rgba(c,.75);g.lineWidth=1.1;g.beginPath();g.ellipse(gx,gy,R,R/2,0,0,Math.PI*2);g.stroke();
        let r=g.createRadialGradient(gx,gy,0,gx,gy,R*1.25);r.addColorStop(0,rgba(c,.5));r.addColorStop(1,rgba(c,0));g.fillStyle=r;g.beginPath();g.ellipse(gx,gy,R*1.25,R*.62,0,0,Math.PI*2);g.fill();
        // Edge light: an upward wash and lit corners on the hub's own walls, stronger than any arrival light.
        for(const f of G.walls){const [a,b,cc,d]=f.points;g.depth=depth(f.layer)-.000002;g.uplight(f.points,c,.32);
          g.strokeStyle=rgba(c,.9);g.lineWidth=.7;g.beginPath();g.moveTo(...a);g.lineTo(...d);g.lineTo(...cc);g.lineTo(...b);g.stroke();}
        g.depth=z;g.strokeStyle=rgba(c,.9);g.lineWidth=.7;g.beginPath();G.roof.forEach((p,i)=>i?g.lineTo(...p):g.moveTo(...p));g.closePath();g.stroke();
        // Light column above the roof, fading upward: a thin core and a wider bloom.
        const [cx,cy]=G.centre,top=cy-G.column,w=Math.max(2.4,G.width*.22);
        g.uplight([[cx-w/2,cy],[cx+w/2,cy],[cx+w/2,top],[cx-w/2,top]],c,.8);
        const l=g.createLinearGradient(cx,cy,cx,top);l.addColorStop(0,rgba(c,.75));l.addColorStop(1,rgba(c,0));g.fillStyle=l;g.fillRect(cx-w*2,top,w*4,cy-top);
        // Spire and beacon.
        g.globalCompositeOperation='source-over';g.strokeStyle=rgba([150,160,190],.95);g.lineWidth=.9;g.beginPath();g.moveTo(...G.base);g.lineTo(...G.tip);g.stroke();
        g.globalCompositeOperation='lighter';const [tx,ty]=G.tip;g.fillStyle=rgba(beacon,.35+.65*s.k);g.beginPath();g.ellipse(tx,ty,2,2,0,0,Math.PI*2);g.fill();
        r=g.createRadialGradient(tx,ty,0,tx,ty,22);r.addColorStop(0,rgba(beacon,.9*s.k));r.addColorStop(1,rgba(beacon,0));g.fillStyle=r;g.beginPath();g.ellipse(tx,ty,22,22,0,0,Math.PI*2);g.fill();
      }
      g.restore();}
  };
}
