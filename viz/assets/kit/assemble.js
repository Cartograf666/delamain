/* Generated raster modules only. No map integration. Browser + CommonJS. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FacadeKit = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const STATES = [0, 25, 50, 75, 100];
  const hash = value => { let h = 2166136261; for (const c of String(value)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function fit(value, min = 1) {
    const count = Math.max(min, Math.round(value));
    const scale = clamp(value / count, .88, 1.12);
    return { count, scale, residual: count * scale - value };
  }
  function fromCity(data, districts = []) {
    return data.boxes.map(([x0,y0,x1,y1,h,type], id) => ({id,w:x1-x0,d:y1-y0,h,type,zone:districts[id] || ''}));
  }
  function plan(input) {
    if (input.id === undefined || !['string','number'].includes(typeof input.id)) throw Error('Building id is required');
    for (const k of ['w','d','h']) if (!Number.isFinite(input[k]) || input[k] <= 0 || input[k] > 128) throw Error(`Invalid ${k}`);
    const family = ['hero','core','glass','tower','high'].includes(input.type) || input.h >= 6 || input.zone === 'core' ? 'glass' :
      ['office','mid'].includes(input.type) || input.h >= 2.5 ? 'office' : 'house';
    const w = fit(input.w, 3), d = fit(input.d, 3), h = fit(input.h * 2, 2);
    const steps = family === 'glass' && h.count >= 20 && Math.min(w.count,d.count) >= 5 ?
      (h.count >= 36 && Math.min(w.count,d.count) >= 7 ? 2 : 1) : 0;
    const levels = steps === 2 ? [Math.floor(h.count*.55),Math.floor(h.count*.25)] : steps === 1 ? [Math.floor(h.count*.68)] : [];
    levels.push(h.count-levels.reduce((a,b)=>a+b,0));
    const tiers=[];let baseFloor=0;
    for (let i=0;i<levels.length;i++) {
      const nw=w.count-2*i,nd=d.count-2*i,floors=levels[i],walls=[];
      for (const [side,bays] of [['left',nw],['right',nd]]) {
        const cells=[];
        for (let floor=0;floor<floors;floor++) for (let bay=0;bay<bays;bay++) {
          const row=floor===0 && i===0?'ground':floor===floors-1?'top':'mid';
          const column=bay===0?'edgeL':bay===bays-1?'edgeR':'middle';
          const count=row==='mid'&&column==='middle'?3:2;
          // One design runs for six floors; long slabs repeat a two-bay rhythm.
          const rhythm=bays>=10?bay%2:Math.floor(bay/2);
          const design=1+hash(`${input.id}:${side}:${i}:${row}:${column}:${Math.floor(floor/6)}:${rhythm}`)%count;
          const phase=hash(`${input.id}:${side}:${i}:${floor}:${bay}`)%4;
          cells.push({module:`${family}-${row}-${column}-${design}`,bay,floor,phase});
        }
        walls.push({side,bays,cells});
      }
      const roof=family==='glass' && i===levels.length-1 && hash(`${input.id}:roof`)%3===2?'helipad':
        hash(`${input.id}:roof:${i}`)%2?'machinery':'flat';
      tiers.push({offset:i,baysW:nw,baysD:nd,floors,baseFloor,walls,roof:`${family}-roof-${roof}`});
      baseFloor+=floors;
    }
    return {family,w,d,h,tiers};
  }
  class Kit {
    constructor(manifest, base, emissive, createCanvas, {cacheBytes=32*1024*1024}={}) {
      this.manifest=manifest;this.baseAtlas=base;this.emissiveAtlas=emissive;this.createCanvas=createCanvas;
      this.modules=new Map(manifest.modules.map(m=>[m.id,m]));this.tiles=new Map();this.cache=new Map();this.bytes=0;
      this.cacheLimit=cacheBytes;this.cacheHits=0;
    }
    tile(id,state=0,phase=0) {
      if(!Number.isInteger(phase)||phase<0||phase>3)throw Error('Phase must be 0..3');
      if(!STATES.includes(state))throw Error('State must be 0,25,50,75,100');
      const key=`${id}:${state}:${phase}`,known=this.tiles.get(key);if(known)return known;
      const m=this.modules.get(id);if(!m)throw Error(`Unknown module ${id}`);
      const [x,y,w,h]=m.rect,c=this.createCanvas(w,h),ctx=c.getContext('2d');ctx.imageSmoothingEnabled=false;
      ctx.drawImage(this.baseAtlas,x,y,w,h,0,0,w,h);
      const e=this.createCanvas(w,h),ec=e.getContext('2d');ec.imageSmoothingEnabled=false;
      for(const win of m.windows)if(((win.threshold/25-1+phase)%4+1)*25<=state){
        const [wx,wy,ww,wh]=win.rect;ec.drawImage(this.emissiveAtlas,x+wx,y+wy,ww,wh,wx,wy,ww,wh);
      }
      const composite=this.createCanvas(w,h);composite.getContext('2d').drawImage(c,0,0);composite.getContext('2d').drawImage(e,0,0);
      const result={base:c,emissive:e,canvas:composite};this.tiles.set(key,result);return result;
    }
    clearCache(){this.cache.clear();this.bytes=0;}
    render(input,state=75,{resolution=1,bloom=false}={}) {
      if(!STATES.includes(state))throw Error('State must be 0,25,50,75,100');
      if(!Number.isFinite(resolution)||resolution<.0625||resolution>2)throw Error('Invalid resolution');
      const p=plan(input),key=JSON.stringify([input.id,input.w,input.d,input.h,input.type,input.zone||'',state,resolution,bloom]);
      if(this.cache.has(key)){const found=this.cache.get(key);this.cache.delete(key);this.cache.set(key,found);this.cacheHits++;return found;}
      const sx=p.w.scale,sd=p.d.scale,sy=p.h.scale,W=p.w.count*32*sx,D=p.d.count*32*sd,H=p.h.count*16*sy,pad=12;
      const width=Math.ceil((W+D+2*pad)*resolution),height=Math.ceil((H+(W+D)/2+2*pad)*resolution);
      if(width*height>16e6)throw Error('Building exceeds 16 megapixel allocation limit');
      const base=this.createCanvas(width,height),emissive=this.createCanvas(width,height);
      const contexts=[base.getContext('2d'),emissive.getContext('2d')];
      const ox=pad+D,oy=pad+H;
      for(const ctx of contexts){ctx.scale(resolution,resolution);ctx.imageSmoothingEnabled=false;}
      for(const tier of p.tiers){
        const x0=tier.offset*32*sx,z0=tier.offset*32*sd,x1=x0+tier.baysW*32*sx,z1=z0+tier.baysD*32*sd;
        const top=(tier.baseFloor+tier.floors)*16*sy;
        for(const wall of tier.walls){
          for(let layer=0;layer<2;layer++){
            const ctx=contexts[layer];ctx.save();
            if(wall.side==='left')ctx.transform(sx,.5*sx,0,sy,ox+x0-z1,oy+(x0+z1)/2-top);
            else ctx.transform(sd,-.5*sd,0,sy,ox+x1-z1,oy+(x1+z1)/2-top);
            for(const cell of wall.cells){const t=this.tile(cell.module,state,cell.phase);ctx.drawImage(layer?t.emissive:t.base,cell.bay*32,(tier.floors-1-cell.floor)*16);}
            // Directional shade lives at assembly only; never in source modules.
            if(layer===0 && wall.side==='right'){ctx.fillStyle='rgba(2,9,25,0.30)';ctx.fillRect(0,0,wall.bays*32,tier.floors*16);}
            ctx.restore();
          }
        }
        // Top-down source tiles map into a 2:1 roof plane, with whole-bay caps.
        const ctx=contexts[0];ctx.save();ctx.transform(sx,.5*sx,-sd,.5*sd,ox+x0-z0,oy+(x0+z0)/2-top);
        const flat=this.tile(`${p.family}-roof-flat`).base;
        for(let z=0;z<tier.baysD;z++)for(let x=0;x<tier.baysW;x++)ctx.drawImage(flat,x*32,z*32);
        if(tier.roof!==`${p.family}-roof-flat`)ctx.drawImage(this.tile(tier.roof).base,Math.floor(tier.baysW/2)*32,Math.floor(tier.baysD/2)*32);
        ctx.restore();
        // Upper floors occlude lower-tier emission too, including the roof plane.
        const ec=contexts[1];ec.save();ec.globalCompositeOperation='destination-out';ec.transform(sx,.5*sx,-sd,.5*sd,ox+x0-z0,oy+(x0+z0)/2-top);ec.fillRect(0,0,tier.baysW*32,tier.baysD*32);ec.restore();
      }
      const canvas=this.createCanvas(width,height),ctx=canvas.getContext('2d');ctx.drawImage(base,0,0);
      if(bloom && state){ctx.save();ctx.filter=`blur(${Math.max(1,3*resolution)}px)`;ctx.globalAlpha=.35;ctx.drawImage(emissive,0,0);ctx.restore();}
      ctx.drawImage(emissive,0,0);
      const bytes=width*height*4*3,result={base,emissive,canvas,plan:p,bytes,width,height,anchor:[(ox+W-D)*resolution,(oy+(W+D)/2)*resolution]};
      if(bytes<=this.cacheLimit){while(this.bytes+bytes>this.cacheLimit && this.cache.size){const oldest=this.cache.keys().next().value;this.bytes-=this.cache.get(oldest).bytes;this.cache.delete(oldest);}this.cache.set(key,result);this.bytes+=bytes;}
      return result;
    }
  }
  async function loadBrowser(url='./',options){
    const manifest=await fetch(url+'kit.json').then(r=>{if(!r.ok)throw Error('kit.json HTTP '+r.status);return r.json();});
    const picture=name=>new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=url+name;});
    const [base,emissive]=await Promise.all([picture(manifest.atlas.base),picture(manifest.atlas.emissive)]);
    return new Kit(manifest,base,emissive,(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;},options);
  }
  return {Kit,plan,fit,hash,fromCity,loadBrowser,STATES};
});
