/* Fixed architectural recipes over the original flat-elevation raster kit. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./assemble.js'));else root.KitStyles=factory(root.FacadeKit);})(globalThis,function(F){
'use strict';
function axis(length,nominal){
 const count=Math.max(1,Math.round(length/nominal)),ratio=length/(count*nominal);
 // A partial end bay/floor is clipped, never stretched beyond the contract.
 return ratio>=.88&&ratio<=1.12?{count,step:length/count,fit:ratio,crop:0}:{count:Math.ceil(length/nominal),step:nominal,fit:1,crop:Math.ceil(length/nominal)*nominal-length};
}
function plan(input,manifest){
 const H=input.h**1.25*6.5;
 const allowed=manifest.styleDistricts[input.zone]||manifest.styleDistricts.default;
 const eligible=allowed.filter(id=>{const s=manifest.styles[id];return H>=s.minLift&&H<s.maxLift;});
 const id=input.style||(eligible.length?eligible:allowed)[F.hash('style:'+input.id)%(eligible.length||allowed.length)];
 const s=manifest.styles[id];if(!s)throw Error('Unknown kit style '+id);
 const w=axis(input.w,s.bay),d=axis(input.d,s.bay),h=axis(H,s.floor);
 const steps=s.silhouette.rule==='upper-setbacks'&&H>s.silhouette.minimumLift?F.hash('steps:'+input.id)%(s.silhouette.maxSteps+1):0;
 const tiers=steps===2?[{at:0,until:.78,inset:0},{at:.78,until:.93,inset:.13},{at:.93,until:1,inset:.24}]:steps===1?[{at:0,until:.87,inset:0},{at:.87,until:1,inset:.18}]:[{at:0,until:1,inset:0}];
 return {id,recipe:s,w,d,h,H,tiers};
}
function tile(kit,id,state,phase){
 kit.styleTiles ||= new Map();const key=[id,state,phase].join(':');if(kit.styleTiles.has(key))return kit.styleTiles.get(key);
 const m=kit.manifest.styleModules[id],[x,y,w,h]=m.rect,base=kit.createCanvas(w,h),emissive=kit.createCanvas(w,h);
 base.getContext('2d').drawImage(kit.styleBaseAtlas,x,y,w,h,0,0,w,h);
 for(const win of m.windows)if(((win.threshold/25-1+phase)%4+1)*25<=state){const [a,b,c,d]=win.rect;emissive.getContext('2d').drawImage(kit.styleEmissiveAtlas,x+a,y+b,c,d,a,b,c,d);}
 const out={base,emissive};kit.styleTiles.set(key,out);return out;
}
async function loadBrowser(url,options){const kit=await F.loadBrowser(url,options);const picture=file=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=reject;image.src=url+file;});
 [kit.styleBaseAtlas,kit.styleEmissiveAtlas]=await Promise.all([picture(kit.manifest.styleAtlas.base),picture(kit.manifest.styleAtlas.emissive)]);return kit;}
function render(kit,input,state=50,resolution=2){
 if(!F.STATES.includes(state))throw Error('Invalid style state');
 const p=plan(input,kit.manifest),s=p.recipe,pad=3,W=input.w,D=input.d,H=p.H;
 const key=JSON.stringify(['style',input,state,resolution]);if(kit.cache.has(key)){kit.cacheHits++;return kit.cache.get(key);}
 const width=Math.ceil((W+D+2*pad)*resolution),height=Math.ceil((H+(W+D)/2+2*pad)*resolution);
 const base=kit.createCanvas(width,height),emissive=kit.createCanvas(width,height),bc=base.getContext('2d'),ec=emissive.getContext('2d'),ox=pad+D,oy=pad+H;
 for(const c of [bc,ec]){c.scale(resolution,resolution);c.imageSmoothingEnabled=true;}
 const poly=(c,pts,fill)=>{c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();if(fill){c.fillStyle=fill;c.fill();}};
 for(const [ti,t] of p.tiers.entries()){
  const x0=W*t.inset,z0=D*t.inset,x1=W*(1-t.inset*(s.offset?1.5:1)),z1=D*(1-t.inset*(s.offset?.5:1));
  const cap=Math.min(s.cap,H*.08),top=H*t.until-cap,low=H*t.at,fh=top-low;
  for(const [side,len]of [['left',x1-x0],['right',z1-z0]]){
   const a=axis(len,s.bay),v=axis(Math.max(.3,fh),s.floor);
   for(const [layer,c]of [[0,bc],[1,ec]]){c.save();
    if(side==='left')c.transform(1,.5,0,1,ox+x0-z1,oy+(x0+z1)/2-top);else c.transform(1,-.5,0,1,ox+x1-z1,oy+(x1+z1)/2-top);
    c.beginPath();c.rect(0,0,len,Math.max(0,fh));c.clip();
    for(let floor=0;floor<v.count;floor++)for(let bay=0;bay<a.count;bay++){
     const row=floor===0&&ti===0?'ground':floor===v.count-1?'top':'mid',column=bay===0?'edgeL':bay===a.count-1?'edgeR':'middle';
     const phase=F.hash(`${input.id}:${side}:${floor}:${bay}:${ti}`)%4;
     const t=tile(kit,s.facade[row],state,phase);
     c.globalAlpha=layer?s.emission:1;c.drawImage(layer?t.emissive:t.base,bay*a.step,fh-(floor+1)*v.step,a.step,v.step);
    }
    if(!layer){c.globalAlpha=1;c.fillStyle=side==='left'?s.leftTint:s.rightTint;c.fillRect(0,0,len,fh);
     if(s.band){c.fillStyle=s.band;for(let y=fh-v.step;y>0;y-=v.step)c.fillRect(0,y,len,.65);}
    }c.restore();
   }
  }
  // Repeat a fixed roof recipe; broad roofs get a visible equipment bank, not a random cap.
  bc.save();bc.transform(1,.5,-1,.5,ox+x0-z0,oy+(x0+z0)/2-top);bc.beginPath();bc.rect(0,0,x1-x0,z1-z0);bc.clip();
  for(let z=0;z<z1-z0;z+=s.bay)for(let x=0;x<x1-x0;x+=s.bay)bc.drawImage(kit.tile(s.roof.tile).base,x,z,s.bay,s.bay);
  bc.fillStyle=s.roofTint;bc.fillRect(0,0,x1-x0,z1-z0);
  for(let x=1;x<x1-x0-2;x+=s.roof.spacing)bc.drawImage(kit.tile(s.roof.equipment).base,x,Math.max(0,(z1-z0-6)/2),6,6);
  bc.restore();
  const q=(x,z,y)=>[ox+x-z,oy+(x+z)/2-y];
  // Roof trims/crowns are structural surfaces, sourced facade/roof art remains untouched.
  const roof=[q(x0,z0,top),q(x1,z0,top),q(x1,z1,top),q(x0,z1,top)];
  ec.save();ec.globalCompositeOperation='destination-out';poly(ec,roof,'#000');ec.restore();
  if(s.gable&&H>4){const ridge=(z0+z1)/2;poly(bc,[q(x0,z0,top),q(x1,z0,top),q(x1,ridge,H*t.until),q(x0,ridge,H*t.until)],'#3c5b90');poly(bc,[q(x0,ridge,H*t.until),q(x1,ridge,H*t.until),q(x1,z1,top),q(x0,z1,top)],'#254166');}
  else {bc.strokeStyle=s.corner.color;bc.lineWidth=s.corner.width;poly(bc,roof);bc.stroke();
   if(cap>.25){const a=(x1-x0)*.34,b=(z1-z0)*.32;const X=x0+a,Z=z0+b,xx=x1-a,zz=z1-b;
    poly(bc,[q(X,zz,top),q(xx,zz,top),q(xx,zz,H*t.until),q(X,zz,H*t.until)],'#426c99');
    poly(bc,[q(xx,zz,top),q(xx,Z,top),q(xx,Z,H*t.until),q(xx,zz,H*t.until)],'#254365');
    poly(bc,[q(X,Z,H*t.until),q(xx,Z,H*t.until),q(xx,zz,H*t.until),q(X,zz,H*t.until)],'#6a93b7');
   }
  }
  bc.strokeStyle=s.corner.color;bc.lineWidth=s.corner.width;bc.beginPath();bc.moveTo(...q(x1,z1,low));bc.lineTo(...q(x1,z1,top));bc.stroke();
 }
 const canvas=kit.createCanvas(width,height);canvas.getContext('2d').drawImage(base,0,0);canvas.getContext('2d').drawImage(emissive,0,0);
 const bytes=width*height*12,result={base,emissive,canvas,width,height,bytes,plan:p,anchor:[ox*resolution,oy*resolution],resolution};
 if(bytes<=kit.cacheLimit){while(kit.bytes+bytes>kit.cacheLimit&&kit.cache.size){const oldest=kit.cache.keys().next().value;kit.bytes-=kit.cache.get(oldest).bytes;kit.cache.delete(oldest);}kit.cache.set(key,result);kit.bytes+=bytes;}return result;
}
return {plan,render,axis,loadBrowser};
});
