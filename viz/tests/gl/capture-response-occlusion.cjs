const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const origin=process.env.CAPTURE_ORIGIN||'http://127.0.0.1:8792',out=process.env.CAPTURE_PROOF||'./work/border-response-proof';
fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});try{const p=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1});const errors=[];p.on('pageerror',e=>errors.push(String(e)));
 if(!process.env.CAPTURE_MERGED)for(const file of ['runtime.js','main.js','capture-response.js','capture-router-worker.js','painter.js'])await p.route('**/assets/gl/'+file,r=>r.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(__dirname,'../../assets/gl',file),'utf8')}));
 await p.goto(origin+'/?map=1&live=1&lang=ru&follow=0&demo=capture');await p.waitForFunction(()=>typeof layerCity!=='undefined'&&layerCity?.live?.aq?.response&&layerCity.live.metrics.frames>5);
 if(await p.locator('[data-mode="territories"]').count())await p.locator('[data-mode="territories"]').click();if(!process.env.CAPTURE_MERGED)await p.evaluate(()=>{layerCity.live.districtsVisible=true;});
 await p.waitForFunction(()=>layerCity.live.aq.response.events.length===3&&layerCity.live.aq.response.events.every(e=>e.route));await p.waitForTimeout(800);
 const proof=await p.evaluate(async()=>{
  const {createResponseLighting,sampleRoute}=await import('/assets/gl/capture-response.js'),l=layerCity.live,gpu=l.gpu,response=l.aq.response;
  const inside=(p,q)=>{let c=false;for(let i=0,j=q.length-1;i<q.length;j=i++)if((q[i][1]>p[1])!==(q[j][1]>p[1])&&p[0]<(q[j][0]-q[i][0])*(p[1]-q[i][1])/(q[j][1]-q[i][1])+q[i][0])c=!c;return c;};
  const surfaces=gpu.scene.buildings.flatMap(b=>b.surfaces.map(f=>({...f,building:b.id,points:f.points.map(p=>gpu.growth.point(b.id,p))}))),wallsAt=createResponseLighting(gpu.scene.buildings);
  const candidates=[],view=l.cameraView(),scale=Math.max(W/1800,H/780)*cam.z;
  for(const e of response.events.filter(e=>e.route))for(let s=30;s<e.route.length;s+=2){const point=sampleRoute(e.route,s);if((point[0]-view.x)*scale<120||(point[0]-view.x)*scale>W-120||(point[1]-view.y)*scale<120||(point[1]-view.y)*scale>H-120)continue;const dot=[point[0],point[1]-.9],blocked=surfaces.filter(f=>inside(dot,f.points)).sort((a,b)=>b.layer-a.layer)[0];if(!blocked)continue;
   const walls=wallsAt(point),visible=walls.filter(w=>{const q=w.points.map(p=>gpu.growth.point(w.buildingId,p)),m=[(q[0][0]+q[1][0])/2,(q[0][1]+q[1][1])/2-2];return !surfaces.some(f=>f.layer>w.layer&&inside(m,f.points));});
   const score=visible.reduce((a,w)=>a+w.gains[0]+w.gains[1],0);if(score>0)candidates.push({point,blocked:{building:blocked.building,layer:blocked.layer},score,walls:visible,e,s});
  }
  candidates.sort((a,b)=>b.score-a.score);const c=candidates[0];if(!c)throw Error('No occluded road source with visible reflected receiver');
  const e=c.e;response.events.splice(0,response.events.length,e);const now=5599;e.born=now-5000;e.alpha=0;e.vehicles=[{p:c.point,s:c.s,index:0,alpha:1,arrived:false}];
  // Freeze the actual map simulation for a paired depth comparison, not a new fixture UI.
  window.__spillTime=now;l.step=()=>{l.now=window.__spillTime;};l.aq.update=()=>{};const fixedDraw=l.aq.draw;l.aq.draw=()=>fixedDraw(window.__spillTime);
  window.__captureProof={response,draw:response.draw,painter:gpu.painter,fill:gpu.painter.fill};
  const receiverPoints=[c.point,...c.walls.flatMap(w=>w.points.map(q=>gpu.growth.point(w.buildingId,q)))].map(q=>[(q[0]-view.x)*scale,(q[1]-view.y)*scale]),xs=receiverPoints.map(q=>q[0]),ys=receiverPoints.map(q=>q[1]);
  const roi=[Math.max(0,Math.floor(Math.min(...xs))-12),Math.max(0,Math.floor(Math.min(...ys))-12),Math.min(W,Math.ceil(Math.max(...xs))+12),Math.min(H,Math.ceil(Math.max(...ys))+12)];
  return {roi,point:c.point,sourceBlockedBy:c.blocked,visibleReceivers:c.walls.map(w=>({building:w.buildingId,layer:w.layer,gains:w.gains})),score:c.score,plotId:e.capture.plotId,depth:.915,nativeZoom:cam.z,routing:response.stats};
 });
 await p.waitForTimeout(300);await p.locator('#gpu-city').screenshot({path:out+'/07-occluded-spill.png'});
 // Suppress only the tiny physical beacon/body at road depth; hidden source should contribute no pixels.
 await p.evaluate(()=>{const h=__captureProof;h.painter.fill=function(){if(Math.abs(this.depth-.915)<.000001||Math.abs(this.depth-.9149)<.000001)return;return h.fill.call(this);};});
 await p.waitForTimeout(180);await p.locator('#gpu-city').screenshot({path:out+'/08-hidden-source-removed.png'});
 await p.evaluate(()=>{__captureProof.painter.fill=__captureProof.fill;window.__spillTime=5600;});await p.waitForTimeout(180);await p.locator('#gpu-city').screenshot({path:out+'/11-spill-blue-5600.png'});
 await p.evaluate(()=>{window.__spillTime=5601;});await p.waitForTimeout(180);await p.locator('#gpu-city').screenshot({path:out+'/12-spill-blue-5601.png'});
 // Keep the same city/frame, remove response to measure the independent receiving-wall light.
 await p.evaluate(()=>{const h=__captureProof;h.painter.fill=h.fill;h.response.draw=()=>{};});
 await p.waitForTimeout(180);await p.locator('#gpu-city').screenshot({path:out+'/09-spill-off.png'});
 proof.errors=errors;proof.glError=await p.evaluate(()=>document.getElementById('gpu-city').getContext('webgl2').getError());assert.equal(proof.glError,0);assert.equal(errors.length,0);fs.writeFileSync(out+'/occlusion.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof,null,2));
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
