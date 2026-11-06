/* Accepted prototype technique adapted to the pilot's actual geometry and repo rule.
 * Static architecture / district emission atlases are world-space, never camera snapshots.
 * Local masks, traffic, flights, occlusion and heat are evaluated on every frame. */
async function installLiveCity(city) {
  const config=await fetch(`${ASSET}/assets/live/config.json`).then(r=>r.json());
  city.live=new AquariumLiveCity(city,config);await city.live.prepare();
  city.placeHubs=()=>city.live.placeHubs();city.fly=()=>{};city.drawCab=(cab,now)=>city.live.aq.worker(cab,now);
  city.drawStatic=()=>city.live.draw();
  city.drive=()=>{};
  city.fit=()=>city.live.fit();city.fit();cam.x=cam.tx=BASE.x;cam.y=cam.ty=BASE.y;
  city.drawDistrictNames=()=>city.live.names();
  city.drawKeys=(tall,now)=>{for(const t of tall){const b=t.kind==='owner'?city.ownerBox:t.lot;if(!b)continue;const p=P(b.x,b.y);selRing(t,...p,b.size*unit()*.9,now);}city.drawSign(owner,now);};
}
class LiveCity {
  constructor(city,config){this.city=city;this.config=config;this.tint={...TINT,...config.appearance.districtTints};this.model=new CityHeat(DISTRICTS.map(d=>d.id),config);this.flights=[];this.waves=[];this.sparks=[];this.hops=[];this.queue=[];this.serial=0;this.nextCluster={};this.flare=0;this.clock=Date.now();this.replaying=false;this.metrics={frames:0,darkFrames:0,maxArcs:0};this.rand=mulberry(14814);}
  async history(){const all=[];for(const src of SOURCES){try{const r=await fetch(`${src}/history?hours=${qs.get('hours')||168}`);if(!r.ok)throw Error(`History HTTP ${r.status}`);const h=await r.json();for(const ev of h.lines||[])if(Number.isFinite(Date.parse(ev.at)))all.push([src,ev]);}catch(e){this.historyError=String(e);}}
    return all.sort((a,b)=>Date.parse(a[1].at)-Date.parse(b[1].at));}
  district(src,ev){return districtFor(ev.repo||machines.get(src)?.stages.get(ev.stage)?.repo||'');}
  async initialize(){this.all=await this.history();if(qs.has('replay'))return this.startReplay(this.all);
    const now=Date.now();for(const [src,ev]of this.all)this.model.ingest(this.district(src,ev),ev,Date.parse(ev.at));this.model.decay(now);this.clock=now;this.showMode();}
  async startReplay(events){const all=events||await this.history();this.all=all;this.model.reset();this.flights=[];this.queue=[];this.sparks=[];this.waves=[];this.hops=[];this.metrics={frames:0,darkFrames:0,maxArcs:0};this.nextLaunch=0;this.nextCluster={};this.flare=0;this.serial=0;this.rand=mulberry(14814);
    const requested=Date.parse(qs.get('start'));const start=Number.isFinite(requested)?requested:all.length?Date.parse(all[0][1].at):Date.now();
    this.timeline=new CityReplay(all,start,Math.max(.01,Math.min(100000,+qs.get('replay')||+qs.get('speed')||120)),performance.now());
    // Warm-up restores heat at a chosen start; past flights are not replayed.
    for(const [src,ev]of all){if(Date.parse(ev.at)>=start)break;this.model.ingest(this.district(src,ev),ev,Date.parse(ev.at));}
    this.model.decay(start);this.replaying=true;this.clock=start;this.showMode();}
  stopReplay(){if(!this.replaying)return;this.replaying=false;this.timeline=null;this.model.reset();this.flights=[];this.queue=[];this.waves=[];this.sparks=[];this.initializeLive();}
  async initializeLive(){const all=await this.history();if(this.replaying)return;this.all=all;this.model.reset();for(const [src,ev]of all)this.model.ingest(this.district(src,ev),ev,Date.parse(ev.at));this.model.decay(Date.now());this.showMode();}
}
