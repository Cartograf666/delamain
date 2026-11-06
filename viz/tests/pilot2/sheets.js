window.pilotSheets=()=>{
 const kit=layerCity.kit,scale=K/layerCity.scale,out={};
 function sheet(w,h,title){const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.fillStyle='#080f1d';x.fillRect(0,0,w,h);x.fillStyle='#d2e6ff';x.font='20px Menlo,monospace';x.fillText(title,28,34);return [c,x];}
 const [styles,x]=sheet(1600,850,'PILOT 2 / FOUR FIXED RECIPES — overview scale + 3×');
 const sets={'glass-tower':[[8,8,6],[12,10,10],[15,12,14]],'glass-slab':[[15,7,5],[21,8,8],[24,10,12]],'office-band':[[12,10,2.5],[18,14,4],[24,16,6]],'house-row':[[8,7,.7],[12,9,1.3],[22,10,2]]};
 let col=0;
 for(const [style,inputs]of Object.entries(sets)){
  const left=col*400;x.fillStyle='#aac9e6';x.font='17px Menlo,monospace';x.fillText(style,left+24,80);
  x.font='12px Menlo,monospace';x.fillStyle='#6f8ca6';x.fillText(`1× (${scale.toFixed(3)} screen px / grid unit)`,left+24,111);x.fillText('3× / same geometry and light state 50',left+24,280);
  let i=0;for(const [w,d,h]of inputs){const r=KitStyles.render(kit,{id:`review-${style}-${i}`,w,d,h,type:'b',zone:'core',style},50,4);for(const [zoom,baseline]of [[1,240],[3,790]]){const f=scale*zoom/r.resolution;x.drawImage(r.canvas,left+25+i*120,baseline-r.height*f,r.width*f,r.height*f);}i++;}
  x.strokeStyle='#1a2c43';x.beginPath();x.moveTo(left+399,64);x.lineTo(left+399,822);x.stroke();col++;
 }
 out['pilot2-styles.png']=styles.toDataURL();
 const [notables,n]=sheet(1600,920,'PILOT 2 / 3D NOTABLES — 3× map scale / nested district windows');
 const states=[0,25,50,75,100];states.forEach((s,i)=>{n.fillStyle='#87a8c9';n.font='15px Menlo,monospace';n.fillText('STATE '+s,235+i*270,72);});
 let row=0;for(const [name,m]of Object.entries(layerCity.notable.models)){
  const base=layerCity.notableImages.get(m.base),f=3*scale/m.resolution,baseline=[325,575,885][row];n.font='17px Menlo,monospace';n.fillStyle='#bad4ee';n.fillText(name,28,baseline-110);
  states.forEach((s,i)=>{const xx=190+i*270+(230-m.size[0]*f)/2,yy=baseline-m.size[1]*f;n.drawImage(base,xx,yy,m.size[0]*f,m.size[1]*f);n.drawImage(layerCity.notableImages.get(m.states[s]),xx,yy,m.size[0]*f,m.size[1]*f);});row++;
 }
 out['pilot2-notable.png']=notables.toDataURL();return out;
};
