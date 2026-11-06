/* Pure event-time heat. A display animation never changes the journal clock. */
(function(root){
class CityHeat {
  constructor(ids,config){this.ids=ids;this.config=config;this.reset();}
  reset(){this.values=Object.fromEntries(this.ids.map(id=>[id,0]));this.base={...this.values};this.stamps={...this.values};this.at=null;this.count=0;this.system=0;this.ever=new Set();this.peak=0;}
  decay(at){if(this.at===null){this.at=at;return;}if(at<this.at)return;
    for(const id of this.ids)this.values[id]=this.base[id]*2**(-(at-this.stamps[id])/(this.config.halfLifeSeconds*1000));this.at=at;
  }
  heat(id){return this.values[id]<this.config.zeroThreshold?0:this.values[id]||0;}
  isSystem(ev){return this.config.systemTags.some(t=>ev.tag===t||ev.from?.[1]===t);}
  ingest(id,ev,at){this.decay(at);if(this.isSystem(ev)){this.system++;return false;}
    this.values[id]=1-(1-(this.values[id]||0))*(1-this.config.eventGain);this.base[id]=this.values[id];this.stamps[id]=at;this.count++;this.ever.add(id);this.peak=Math.max(this.peak,this.values[id]);return true;}
  snapshot(){return Object.fromEntries(this.ids.map(id=>[id,this.heat(id)]));}
}
// Acceleration preserves every source interval; no idle skipping or minimum event gap.
class CityReplay {
  constructor(events,start,speed,wall){this.events=events;this.start=start;this.time=start;this.speed=speed;this.wall=wall;this.i=0;while(this.i<events.length&&Date.parse(events[this.i][1].at)<start)this.i++;}
  step(wall,emit){this.time=this.start+Math.max(0,wall-this.wall)*this.speed;while(this.i<this.events.length&&Date.parse(this.events[this.i][1].at)<=this.time){const [src,ev]=this.events[this.i++];emit(src,ev,Date.parse(ev.at));}return this.time;}
}
root.CityHeat=CityHeat;root.CityReplay=CityReplay;if(typeof module!=='undefined')module.exports={CityHeat,CityReplay};
})(globalThis);
