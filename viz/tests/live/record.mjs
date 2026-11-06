// Encoded evidence: real history only. Deterministic 24fps output is distinct from runtime fps.
import fs from 'node:fs';import {spawn} from 'node:child_process';import {once} from 'node:events';import {browser} from './browser.mjs';
const output='./work/shots';fs.mkdirSync(output,{recursive:true});
await browser(async({call,ev,wait,errors})=>{
 await call('Page.addScriptToEvaluateOnNewDocument',{source:`let clock=0,sequence=0;const epoch=Date.now(),raf=new Map();performance.now=()=>clock;Date.now=()=>epoch+clock;window.requestAnimationFrame=cb=>{raf.set(++sequence,cb);return sequence};window.cancelAnimationFrame=id=>raf.delete(id);window.__step=t=>{clock=t;const q=[...raf.values()];raf.clear();q.forEach(cb=>cb(t))};`});
 const history=await fetch('http://127.0.0.1:8815/history?hours=168').then(r=>r.json());const last=history.lines.filter(e=>!['pace','watchdog'].includes(e.tag)).at(-1);const realStart=new Date((last?Date.parse(last.at):Date.now())-3000).toISOString();
 for(const mode of (process.env.LIVE_RECORD_MODES||'replay,real-time').split(',')){
  await call('Page.navigate',{url:`http://127.0.0.1:8914/viz/viz.html?map=1&live=1&lang=ru&follow=0&src=http://127.0.0.1:8815${mode==='replay'?'&replay=1200':'&replay=1&start='+encodeURIComponent(realStart)}`});
  await wait('typeof layerCity!=="undefined"&&!!layerCity?.live?.all');await ev('ready.then(()=>true)');await ev('document.fonts.ready.then(()=>{renderRoster();return true})');
  const info=await ev(`(()=>{const l=layerCity.live,all=l.all,start=all.length?Date.parse(all[0][1].at):Date.now(),end=all.length?Date.parse(all.at(-1)[1].at):start;
    if(l.timeline){if(!qs.has('start')){l.timeline.start=start;l.timeline.speed=Math.max(1,(end-start)/75000);}l.timeline.wall=0;}return {start:l.timeline?.start||start,end,speed:l.timeline?.speed||1,lines:all.length,repoDistricts:Object.fromEntries(repoDistrict),source:'http://127.0.0.1:8815/history?hours=168',events:all.map(([src,e])=>({at:e.at,tag:e.tag,repo:e.repo||'',district:l.district(src,e)}))};})()`);
  const fps=24,seconds=mode==='replay'?90:30,file=`${output}/live-${mode}.mp4`;
  const enc=spawn('/opt/homebrew/bin/ffmpeg',['-y','-loglevel','error','-f','image2pipe','-vcodec','mjpeg','-framerate',String(fps),'-i','pipe:0','-an','-c:v','libx264','-preset','fast','-threads','2','-crf','19','-pix_fmt','yuv420p','-movflags','+faststart',file],{stdio:['pipe','ignore','pipe']});let stderr='';enc.stderr.on('data',b=>stderr+=b);const done=once(enc,'exit');
  const samples=[];let quiet=false,normal=false,peakScore=-1,peakImage=null,peakFrame=0;
  try{
   for(let i=0;i<fps*seconds;i++){
    await ev(`__step(${i*1000/fps})`);
    const state=await ev('({clock:layerCity.live.clock,heat:layerCity.live.model.snapshot(),arcs:0,flights:layerCity.live.flights.length,queue:layerCity.live.queue.length,sparks:layerCity.live.sparks.length,count:layerCity.live.model.count})');samples.push(state);
    const bytes=Buffer.from((await call('Page.captureScreenshot',{format:'jpeg',quality:90})).data,'base64');if(!enc.stdin.write(bytes))await once(enc.stdin,'drain');
    if(mode==='replay'){
      const heat=Object.values(state.heat),sum=heat.reduce((a,b)=>a+b,0),score=sum+state.flights*.15;
      if(!quiet&&sum===0&&!state.flights&&!state.sparks){fs.writeFileSync(`${output}/live-quiet.jpg`,bytes);quiet=true;}
      if(!normal&&sum>.3&&sum<1.4&&state.flights>0){fs.writeFileSync(`${output}/live-normal.jpg`,bytes);normal=true;info.normalFrame=i;}
      if(score>peakScore){peakScore=score;peakImage=bytes;peakFrame=i;}
    }
    if(i%(fps*10)===0)console.log(`${mode} ${i/fps}/${seconds}s`);
   }
   enc.stdin.end();const [code]=await done;if(code)throw Error(`ffmpeg ${code}: ${stderr}`);
  }finally{if(enc.exitCode===null){enc.stdin.destroy();enc.kill('SIGTERM');await done;}}
  if(peakImage)fs.writeFileSync(`${output}/live-peak.jpg`,peakImage);
  const summary=await ev('({metrics:layerCity.live.metrics,peakHeat:layerCity.live.model.peak,maxFlights:layerCity.live.maxCargo,overflow:layerCity.live.overflow,everLit:[...layerCity.live.model.ever],count:layerCity.live.model.count,system:layerCity.live.model.system,queue:layerCity.live.queue.length,prepareMs:layerCity.live.prepareMs})');
  info.peakFrame=peakFrame;info.duration=seconds;info.fps=fps;info.encoder='deterministic browser frame sampling';info.summary=summary;info.darkHeatShare=samples.filter(s=>Object.values(s.heat).every(v=>v===0)).length/samples.length;info.darkVisibleShare=samples.filter(s=>Object.values(s.heat).every(v=>v===0)&&!s.flights&&!s.sparks).length/samples.length;info.wholeCityDarkShare=0;
  fs.writeFileSync(`${output}/live-${mode}.json`,JSON.stringify({info,samples},null,2));console.log(JSON.stringify({mode,duration:info.duration,speed:info.speed,summary:info.summary,darkHeatShare:info.darkHeatShare,darkVisibleShare:info.darkVisibleShare}));
 }
 fs.writeFileSync(`${output}/live-record-errors.json`,JSON.stringify(errors,null,2));if(errors.length)throw Error('Browser errors');
});
