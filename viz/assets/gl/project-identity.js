// Render identity is separate from simulation ownership. Reserved sites stay reserved.
export function createProjectIdentity(scene, geometry) {
  const inside = ([x,y], polygon) => {
    let hit=false;
    for(let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
      const a=polygon[i],b=polygon[j];
      if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])hit=!hit;
    }
    return hit;
  };
  const ground = ([x,y]) => [(x+2*y)/1.5,(2*y-x)/1.5];
  const buildings=new Map(scene.buildings.map(b=>[b.id,b]));
  const buildingPlots=new Map(geometry.plots.filter(p=>p.building!=null).map(p=>[p.building,p.id]));
  const footprints=new Map(scene.buildings.map(b=>{
    const faces=[];
    for(let i=0;i<b.surfaces.length-1;i++) {
      const a=b.surfaces[i],c=b.surfaces[i+1];
      if(a.kind!=='wall'||c.kind!=='wall'||Math.hypot(a.points[1][0]-c.points[0][0],a.points[1][1]-c.points[0][1])>.02)continue;
      const [p,q]=a.points,r=c.points[1];
      faces.push([p,q,r,[p[0]+r[0]-q[0],p[1]+r[1]-q[1]]]);
    }
    if(!faces.length)for(const f of b.surfaces.filter(f=>f.kind==='roof')) {
      const center=f.points.reduce((a,p)=>[a[0]+p[0]/f.points.length,a[1]+p[1]/f.points.length],[0,0]);
      faces.push(f.points.map(p=>[p[0]+b.ground[0]-center[0],p[1]+b.ground[1]-center[1]]));
    }
    return [b.id,faces];
  }));
  const contains=(b,p)=>footprints.get(b.id).some(q=>inside(p,q));
  // Rounded live pad coordinates identify the same site, never a distant tower.
  const atGround=(x,y)=>scene.buildings.find(b=>Math.hypot(b.ground[0]-x,b.ground[1]-y)<.16);
  const roofFaces=scene.buildings.flatMap(b=>b.surfaces.filter(f=>f.kind==='roof').map(f=>({b,f}))).sort((a,b)=>b.f.layer-a.f.layer);
  const roofCache=new Map();
  const atRoof=(x,y)=>{
    const key=x+','+y;if(roofCache.has(key))return roofCache.get(key);
    const exact=roofFaces.find(({f})=>{const q=f.points,c=q.reduce((a,p)=>[a[0]+p[0]/q.length,a[1]+p[1]/q.length],[0,0]);return Math.hypot(c[0]-x,c[1]-y)<.16;});
    const b=(exact||roofFaces.find(({f})=>inside([x,y],f.points)))?.b;
    roofCache.set(key,b);return b;
  };
  const padBuildings=scene.pads.map(p=>atGround(p[5][0]*.75,p[5][1]*.75-40));
  const ownerPad=scene.pads.reduce((best,p,i)=>p[4]>scene.pads[best][4]?i:best,0);
  const protectedSite=new Set();
  if(padBuildings[ownerPad])protectedSite.add(padBuildings[ownerPad].id);
  let identities=new Map();
  function set(data,territoryAt=()=>null) {
    identities=new Map();
    const owners=new Map((data?.plotOwners||[]).map(p=>[p.id,p])),projects=new Map((data?.projects||[]).map(p=>[p.id,p]));
    const assign=(b,project,plot,reason)=>{if(b&&!protectedSite.has(b.id)&&!identities.has(b.id))identities.set(b.id,{b,project,plot:plot||{dark:false},reason});};
    // Explicit main anchors win, including virtual mains with no existing pad.
    for(const project of projects.values()) {
      const anchor=padBuildings[project.tower];
      assign(anchor,project,owners.get(buildingPlots.get(anchor?.id)),'tower');
    }
    for(const project of projects.values()) {
      const main=geometry.plots.find(p=>p.id===project.mainPlot?.id);
      if(main) {
        const linked=buildings.get(main.building);
        if(linked)assign(linked,project,owners.get(main.id),'main-plot');
        else for(const b of scene.buildings)if(b.kind!=='b'&&contains(b,main.ground))assign(b,project,owners.get(main.id),'main-containment');
      }
    }
    for(const b of scene.buildings) {
      const plot=owners.get(buildingPlots.get(b.id));
      if(plot&&!plot.reserved&&plot.owner)assign(b,projects.get(plot.owner),plot,'owned-plot');
    }
    // Replacement geometry inherits only the real land underneath it. A reserved
    // landmark uses the surrounding footprint neighbourhood, with majority support.
    for(const b of scene.buildings) {
      if(identities.has(b.id)||protectedSite.has(b.id))continue;
      const plot=owners.get(buildingPlots.get(b.id));
      if(b.kind==='b'&&plot)continue;
      // An explicit empty parcel vetoes neighbourhood support for replacement
      // houses with no direct scene link. Nearby owners cannot recolonise it.
      if(b.kind==='b'&&geometry.plots.some(p=>inside(b.ground,p.footprint)&&(!owners.get(p.id)?.owner||owners.get(p.id)?.reserved)))continue;
      const faces=footprints.get(b.id),boxes=faces.map(q=>{const p=q.map(ground);return [Math.min(...p.map(v=>v[0])),Math.min(...p.map(v=>v[1])),Math.max(...p.map(v=>v[0])),Math.max(...p.map(v=>v[1]))];});
      const nearby=geometry.plots.filter(p=>{
        if(b.kind==='b') {
          if(inside(b.ground,p.footprint))return true;
          const owner=territoryAt(...b.ground);
          if(!owner||owners.get(p.id)?.owner!==owner)return false;
          const [x,y]=ground(b.ground),q=p.footprint.map(ground);
          return Math.hypot(Math.max(Math.min(...q.map(v=>v[0]))-x,0,x-Math.max(...q.map(v=>v[0]))),Math.max(Math.min(...q.map(v=>v[1]))-y,0,y-Math.max(...q.map(v=>v[1]))))<=10;
        }
        const [x,y]=ground(p.ground);
        return boxes.some(([x0,y0,x1,y1])=>Math.hypot(Math.max(x0-x,0,x-x1),Math.max(y0-y,0,y-y1))<=10);
      });
      const counts=new Map();let total=0;
      for(const p of nearby){const o=owners.get(p.id);if(!o||o.reserved)continue;total++;if(o.owner)counts.set(o.owner,(counts.get(o.owner)||0)+1);}
      const ranked=[...counts].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])),best=ranked[0];
      if(!best||best[1]/total<.6||(b.kind!=='b'&&best[1]<2))continue;
      const supporting=nearby.map(p=>owners.get(p.id)).filter(o=>o?.owner===best[0]&&!o.reserved);
      assign(b,projects.get(best[0]),{dark:supporting.every(o=>o.dark)},'geographic-containment');
    }
  }
  return {set,entry:id=>identities.get(id),atGround,atRoof,footprints,protectedSite};
}
