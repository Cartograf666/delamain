// Steering and city compositing adapted directly from the owner-accepted aquarium prototype.
// Delamain keeps its own UI, camera, state model, journal mapping and source-time heat.
function aquariumRuntime(live,C,images){
const W=C.w,H=C.h,N=C.names.length,tint=C.tints,rgb=(c,a)=>`rgba(${c[0]},${c[1]},${c[2]},${a})`,rnd=(a,b)=>a+live.rand()*(b-a);
let g=ctx;const idle=images.idle,top_=images.top,imgs=images.lights,spr=images.flyers;
const off=document.createElement('canvas');off.width=W;off.height=H;const og=off.getContext('2d');
const heat=new Array(N).fill(0);let sparks=[],rings=[],flare=0,fired=0;
const byD=Array.from({length:N},(_,d)=>C.pads.filter(p=>p.d===d));
const owner=C.pads.reduce((a,b)=>b.h>a.h?b:a);
const mainPad=byD.map((L,d)=>d===0?owner:(L.find(p=>p.k==='n:gr'||p.k==='n:sp')||L.find(p=>p.k.startsWith('n:'))||L.reduce((a,b)=>b.h>a.h?b:a,L[0])));
// flight is steered, not a drawn curve: climb, cruise with heading and wander, hover, descend. x,y are ground, z is height.
const roofZ=p=>Math.max(0,p.g[1]-p.p[1]),big=C.pads.filter(p=>p.h>=2);
const anyPad=d=>byD[d][live.rand()*byD[d].length|0];
const coreDest=()=>live.rand()<.14?owner:anyPad(0);
function mk(d,i){const p=anyPad(d);return{d,at:p,state:'park',until:0,kind:i%4,size:rnd(19,25),cargo:0,x:p.g[0],y:p.g[1],z:roofZ(p),h:rnd(0,6.28),sp:0,ph:rnd(0,6.28),wp:[],trail:[],bank:0,dir:1,t:0}}
function go(f,to,now,fast){const e=Math.hypot(to.g[0]-f.x,(to.g[1]-f.y)*2);f.to=to;f.fast=fast;f.t=now;
  f.cz=Math.max(f.z,roofZ(to))+rnd(24,fast?90:60);f.vmax=fast?rnd(105,150):rnd(38,78);f.wp=[];
  const n=e>140?(live.rand()*3|0):(live.rand()<.4?1:0);
  for(let i=1;i<=n;i++){const k=i/(n+1),o=rnd(-.42,.42)*e;f.wp.push([f.x+(to.g[0]-f.x)*k-(to.g[1]-f.y)*2/e*o,f.y+(to.g[1]-f.y)*k+(to.g[0]-f.x)/e*o*.5])}
  if(f.state==='park')f.state='up';else f.state='cruise'}
const fl=[];
function ring(x,y,d,now,big){rings.push({x,y,d,t:now,big});if(rings.length>40)rings.shift()}
function cascade(d,now,x,y,R,n){live.vector.cascade([x,y],now,d,R,n);}
function spark(d,now,at,r,life){const L=byD[d];if(!L.length)return;const p=at||L[live.rand()*L.length|0];cascade(d,now,p.g[0],(p.g[1]+p.p[1])/2,r||rnd(30,70),r>=100?70:r>=60?34:14);}
function dispatch(d,now,role,key){fired++;
  if(fl.filter(f=>f.cargo).length>=live.config.maxFlights){live.overflow++;spark(d,now);return}
  let f=(role&&fl.find(q=>(key?q.key===key:q.role===role)&&!q.cargo))||fl.filter(f=>f.d===d&&!f.cargo).sort((a,b)=>(a.state==='park'?0:1)-(b.state==='park'?0:1))[0];
  if(!f){f=mk(d,fl.length);f.temp=true;fl.push(f)}
  f.cargo=1;f.home=d;f.size=40;f.trail=[];if(f.state==='park')ring(f.at.p[0],f.at.p[1],d,now,false);
  go(f,d===0?anyPad([1,2,4,6,7,8][live.rand()*6|0]):coreDest(),now,true)}
function arrive(f,now){if(f.leave){f.gone=true;if(f.worker)f.worker.landed=true;}const p=f.to;f.at=p;f.x=p.g[0];f.y=p.g[1];f.z=roofZ(p);f.state='park';f.sp=0;f.wp=[];const sx=p.p[0],sy=p.p[1];
  if(f.cargo===1){ring(sx,sy,f.d,now,true);bolt(f.d,now,p.g[0],(p.g[1]+p.p[1])/2,14);spark(p.d,now,p,70,2600);flare=Math.min(1,flare+(p===owner?.5:.15));f.cargo=2;f.until=now+rnd(500,1400);return}
  if(f.cargo===2&&f.d===f.home&&p.d===f.home){const d=f.d;ring(sx,sy,d,now,true);bolt(d,now,p.g[0],(p.g[1]+p.p[1])/2,32);cascade(d,now,p.g[0],(p.g[1]+p.p[1])/2,120,46);f.cargo=0;f.size=32;f.until=now+rnd(1200,3500);if(f.temp)f.gone=true;return}
  ring(sx,sy,f.d,now,false);bolt(f.d,now,p.g[0],(p.g[1]+p.p[1])/2,5);spark(p.d,now,p,44,2400);f.d=f.cargo?f.d:p.d;f.until=now+rnd(700,4200)}
function nextDest(f){if(f.cargo===2)return anyPad(f.home);if(live.rand()<.16){for(let i=0;i<20;i++){const q=big[live.rand()*big.length|0],e=Math.hypot(q.g[0]-f.x,q.g[1]-f.y);if(e>120&&e<460)return q}}
  for(let i=0;i<20;i++){const q=anyPad(f.d),e=Math.hypot(q.g[0]-f.x,q.g[1]-f.y);if(e>40&&e<300)return q}return anyPad(f.d)}
function stepFlyers(now,dt){for(const f of fl){
  if(f.state==='park'){if(f.trail.length)f.trail.shift();if(now>f.until&&(f.cargo||f.work))go(f,nextDest(f),now,f.cargo===2);f.bank*=.9;continue}
  if(f.state==='up'){f.z+=(f.fast?64:38)*dt;if(f.z>=f.cz)f.state='cruise'}
  const tg=f.wp[0]||f.to.g,dx=tg[0]-f.x,dy=(tg[1]-f.y)*2,dist=Math.hypot(dx,dy);
  if(f.state==='hover'){const k=Math.min(1,3.2*dt),t=f.to.g,tz=roofZ(f.to);f.x+=(t[0]-f.x)*k;f.y+=(t[1]-f.y)*k;f.z=Math.max(tz,f.z-(f.fast?56:34)*dt);f.bank*=.92;
    if(f.z<=tz+.5&&Math.hypot(t[0]-f.x,t[1]-f.y)<2)arrive(f,now)}
  else{let want=Math.atan2(dy,dx)+Math.sin(now/1100+f.ph)*.55+Math.sin(now/370+f.ph*2)*.16;
    const ox=f.x-owner.g[0],oy=(f.y-owner.g[1])*2,od=Math.hypot(ox,oy);if(od<92&&f.to!==owner&&f.z<roofZ(owner))want=Math.atan2(oy,ox)+.6;
    let dh=((want-f.h+Math.PI)%(6.2832)+6.2832)%6.2832-Math.PI,rate=f.fast?3:2.1;const turn=Math.max(-rate*dt,Math.min(rate*dt,dh));f.h+=turn;f.bank+=(turn/dt/rate-f.bank)*Math.min(1,4*dt);
    const last=!f.wp.length,brake=last?Math.min(1,.3+dist/120):1,gust=1+.16*Math.sin(now/700+f.ph*3);f.sp+=(f.vmax*brake*gust-f.sp)*Math.min(1,1.6*dt);
    if(f.state==='cruise'){f.x+=Math.cos(f.h)*f.sp*dt;f.y+=Math.sin(f.h)*f.sp*dt*.5;f.z+=(f.cz+Math.sin(now/1300+f.ph)*7-f.z)*Math.min(1,1.2*dt);
      if(!last&&dist<30)f.wp.shift();else if(last&&(dist<26||now-f.t>26000))f.state='hover'}
    if(Math.abs(Math.cos(f.h))>.15)f.dir=Math.cos(f.h)>=0?1:-1}
  const tl=f.cargo?56:34;f.trail.push([f.x,f.y-f.z]);if(f.trail.length>tl)f.trail.shift()}
  for(let i=fl.length-1;i>=0;i--)if(fl[i].gone)fl.splice(i,1)}
function drawFlyer(f,now){const px=f.x,py=f.y-f.z,col=tint[f.cargo?f.home:f.d],air=f.state!=='park',r=f.cargo?4.2:2.9;
  if(air){g.fillStyle=`rgba(0,0,8,${Math.max(.1,.42-f.z/300)})`;g.beginPath();g.ellipse(f.x,f.y,r*2,r,0,0,7);g.fill()}
  g.globalCompositeOperation='lighter';const T=f.trail,n=T.length;
  if(n>2){g.lineCap='butt';g.lineJoin='round';for(let i=1;i<n;i++){const k=i/n;g.strokeStyle=rgb(col,k*k*.8);g.lineWidth=r*1.5*k;g.beginPath();g.moveTo(T[i-1][0],T[i-1][1]);g.lineTo(T[i][0],T[i][1]);g.stroke()}}
  const R=r*(f.cargo?5:3.2),q=g.createRadialGradient(px,py,0,px,py,R);q.addColorStop(0,rgb(col,.34));q.addColorStop(1,rgb(col,0));g.fillStyle=q;g.beginPath();g.arc(px,py,R,0,7);g.fill();
  g.globalCompositeOperation='source-over';const z=f.size;g.save();g.translate(px,py-(air?0:z*.2));g.rotate(f.bank*.28);g.scale(f.dir,1);g.drawImage(sprites[['flyer-sport','flyer-van','flyer-limo','flyer-bike','flyer-police','flyer'][f.kind%6]]||sprites.flyer,-z/2,-z/2,z,z);g.restore()}
// traffic on visible roads only
const RD=C.roads.map(r=>{const p=r.p,c=[0];for(let i=1;i<p.length;i++)c.push(c[i-1]+Math.hypot(p[i][0]-p[i-1][0],p[i][1]-p[i-1][1]));return{c:r.c,p,len:c[c.length-1],cum:c}}).filter(r=>r.len>4);
const ends=new Map(),key=q=>Math.round(q[0]/6)+','+Math.round(q[1]/6);
RD.forEach((r,i)=>{for(const [q,e] of [[r.p[0],0],[r.p[r.p.length-1],1]]){const k=key(q);if(!ends.has(k))ends.set(k,[]);ends.get(k).push([i,e])}});
function at(r,s){let i=1;while(i<r.cum.length-1&&r.cum[i]<s)i++;const a=r.p[i-1],b=r.p[i],L=(r.cum[i]-r.cum[i-1])||1,t=Math.max(0,Math.min(1,(s-r.cum[i-1])/L));return[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,(b[0]-a[0])/L,(b[1]-a[1])/L]}
const cars=[...Array(230)].map(()=>{const r=live.rand()*RD.length|0;return{r,s:live.rand()*RD[r].len,dir:live.rand()<.5?1:-1,v:rnd(20,44)}});
function moveCars(dt){for(const c of cars){const rr=RD[c.r],edge=Math.min(c.s,rr.len-c.s),k=.42+.58*Math.min(1,edge/26);c.s+=c.v*k*dt*c.dir;const r=RD[c.r];if(c.s<0||c.s>r.len){const e=c.s>r.len?1:0,q=e?r.p[r.p.length-1]:r.p[0],o=(ends.get(key(q))||[]).filter(x=>x[0]!==c.r);
  if(o.length){const n=o[live.rand()*o.length|0];c.r=n[0];c.s=n[1]?RD[n[0]].len:0;c.dir=n[1]?-1:1}else{c.dir=-c.dir;c.s=Math.max(0,Math.min(r.len,c.s))}}}}
function drawCars(){g.globalCompositeOperation='lighter';g.lineCap='round';for(const c of cars){const r=RD[c.r],o=r.c?1:1.7,col=c.dir>0?[255,226,180]:[255,60,70];let px=0,py=0;
  for(let i=0;i<=5;i++){const q=at(r,Math.max(0,Math.min(r.len,c.s-c.dir*i*2.6))),x=q[0]-q[3]*c.dir*o,y=q[1]+q[2]*c.dir*o;
    if(i){const a=1-i/6;g.strokeStyle=rgb(col,a*a*.7);g.lineWidth=1.5*a+.2;g.beginPath();g.moveTo(px,py);g.lineTo(x,y);g.stroke()}else{g.fillStyle=rgb(col,1);g.beginPath();g.arc(x,y,1.05,0,7);g.fill()}px=x;py=y}}}
// lightning: light runs along roof neon edges, jumps roof to roof and branches, then each roof cuts out on its own
const RF=(C.roofs||[]).map((r,i)=>({i,p:r,d:r[8],x:(r[0]+r[4])/2,y:(r[1]+r[5])/2})),RB=new Map(),rk=(x,y)=>(x/60|0)+','+(y/60|0);RF.forEach(r=>{const k=rk(r.x,r.y);if(!RB.has(k))RB.set(k,[]);RB.get(k).push(r)});
let bolts=[];
function nearRoofs(x,y,R){const o=[],B=Math.ceil(R/60);for(let i=-B;i<=B;i++)for(let j=-B;j<=B;j++)for(const r of RB.get(rk(x+i*60,y+j*60))||[]){const e=Math.hypot(r.x-x,(r.y-y)*1.5);if(e<R)o.push([e,r])}return o.sort((a,b)=>a[0]-b[0])}
// neon snakes: a line crawls along a roof edge, crawls over to the next roofs, branches, then its tail eats the outline away
function corner(r,x,y){let b=0,m=1e9;for(let i=0;i<4;i++){const e=Math.hypot(r.p[i*2]-x,r.p[i*2+1]-y);if(e<m){m=e;b=i}}return b}
function bolt(d,now,x,y,n){const first=nearRoofs(x,y,90)[0];if(!first)return;const col=tint[d],seen=new Set([first[1].i]),q=[{r:first[1],t:now,c:null}];let c=0;
  while(q.length&&c<n&&bolts.length<260){const a=q.shift();c++;const dur=rnd(850,1350),st=a.c?corner(a.r,a.c[0],a.c[1]):0,e={r:a.r,t:a.t,col,dur,hold:rnd(1300,3200),st,con:a.c&&{x:a.c[0],y:a.c[1],len:a.cl}};bolts.push(e);
    const L=nearRoofs(a.r.x,a.r.y,64).filter(v=>!seen.has(v[1].i)).sort(()=>live.rand()-.5),b=1+(live.rand()<.5?1:0)+(live.rand()<.12?1:0);
    for(const v of L.slice(0,b)){seen.add(v[1].i);const k=corner(a.r,v[1].x,v[1].y),ox=a.r.p[k*2],oy=a.r.p[k*2+1],cl=rnd(260,420);q.push({r:v[1],t:a.t+dur*rnd(.5,.95)+cl,c:[ox,oy],cl})}}}
function drawBolts(now){g.globalCompositeOperation='lighter';g.lineJoin='round';g.lineCap='round';
  const line=(b,from,to)=>{const w=b.r.p,P=i=>[w[((b.st+i)%4)*2],w[((b.st+i)%4)*2+1]];g.beginPath();let on=false;for(let i=0;i<4;i++){const a=Math.max(from,i),c=Math.min(to,i+1);if(c<=a)continue;const A=P(i),B=P(i+1),x0=A[0]+(B[0]-A[0])*(a-i),y0=A[1]+(B[1]-A[1])*(a-i),x1=A[0]+(B[0]-A[0])*(c-i),y1=A[1]+(B[1]-A[1])*(c-i);if(!on){g.moveTo(x0,y0);on=true}g.lineTo(x1,y1)}return on};
  for(const b of bolts){const dt=now-b.t;
    if(b.con&&dt>-b.con.len){const k=Math.min(1,1+dt/b.con.len),w=b.r.p,tx=w[b.st*2],ty=w[b.st*2+1],a=dt>b.dur+b.hold?Math.max(0,1-(dt-b.dur-b.hold)/b.dur):1;g.strokeStyle=rgb(b.col,.7*a);g.lineWidth=1.1;g.beginPath();g.moveTo(b.con.x,b.con.y);g.lineTo(b.con.x+(tx-b.con.x)*k,b.con.y+(ty-b.con.y)*k);g.stroke()}
    if(dt<0)continue;
    if(!b.fired){b.fired=true;const life=b.dur+b.hold+1400;cascade(b.r.d,now+120,b.r.x,b.r.y+14,50,7)}
    {const a=Math.min(1,dt/500)*Math.max(0,Math.min(1,(b.dur*2+b.hold-dt)/900)),q=g.createRadialGradient(b.r.x,b.r.y+6,0,b.r.x,b.r.y+6,54);q.addColorStop(0,rgb(b.col,.13*a));q.addColorStop(1,rgb(b.col,0));g.fillStyle=q;g.beginPath();g.ellipse(b.r.x,b.r.y+6,54,38,0,0,7);g.fill()}
    const head=Math.min(4,dt/b.dur*4),tail=dt>b.dur+b.hold?Math.min(4,(dt-b.dur-b.hold)/b.dur*4):0;if(line(b,tail,head)){g.strokeStyle=rgb(b.col,.22);g.lineWidth=3.6;g.stroke();g.strokeStyle=rgb(b.col,.95);g.lineWidth=1.3;g.stroke()}}
  bolts=bolts.filter(b=>now-b.t<b.dur*2+b.hold);g.globalCompositeOperation='source-over'}
const glyphQ=()=>{g.arc(0,-6,9,-Math.PI*.95,Math.PI*.32);g.lineTo(0,6);g.moveTo(0,14);g.lineTo(0,14.2)},
  glyphS=()=>{for(let i=0;i<=8;i++){const a=Math.PI/8+i*Math.PI/4;g[i?'lineTo':'moveTo'](Math.cos(a)*16,Math.sin(a)*16)}g.moveTo(-8,0);g.lineTo(8,0)};
function drawAlerts(now){g.save();g.globalCompositeOperation='lighter';g.lineCap='round';g.lineJoin='round';let n=0;
  for(const E of live.alerts.entries.values()){const hub=machines.get(E.src)?.stages.get(E.stage)?.hub,kp=hub?.lot?.pad;if(!kp)continue;n++;
    const ask=E.items.some(q=>q.kind==='QUESTION'),col=ask?[70,235,255]:[255,64,170],up=Math.min(1,(now-E.t0)/520),x=kp.p[0],y=kp.p[1],cy=y-50+Math.sin(now/1150+n)*2.5,fl=.8+.12*Math.sin(now/83+n*2)+(Math.sin(now/1700+n)>.97?-.35:0);const w=live.world(x,cy);E.screen=P(w.x,w.y);E.radius=Math.max(16,30*unit()/live.city.scale/live.factor);
    const q=g.createLinearGradient(0,y,0,cy);q.addColorStop(0,rgb(col,.34*up));q.addColorStop(1,rgb(col,0));g.fillStyle=q;g.beginPath();g.moveTo(x-5,y);g.lineTo(x+5,y);g.lineTo(x+19,cy);g.lineTo(x-19,cy);g.closePath();g.fill();
    g.strokeStyle=rgb(col,.6*up);g.lineWidth=1;g.beginPath();g.ellipse(x,y,9,4.5,0,0,7);g.stroke();
    g.save();g.translate(x,cy);g.scale(1,up);
    g.strokeStyle=rgb(col,.5*fl);g.lineWidth=.9;const a=now/900;g.beginPath();g.ellipse(0,1,25,8,0,a,a+4.5);g.stroke();
    for(const [w,o] of [[6,.14],[2.8,.34],[1.3,.98]]){g.strokeStyle=o>.9?rgb(col.map(c=>Math.min(255,c+95)),fl):rgb(col,o*fl);g.lineWidth=w;g.beginPath();(ask?glyphQ:glyphS)();g.stroke()}
    const sy=-18+((now/34)%38);g.strokeStyle=rgb(col,.22*fl);g.lineWidth=1;g.beginPath();g.moveTo(-18,sy);g.lineTo(18,sy);g.stroke();g.restore()}
  g.restore()}
const holos=[{d:0,dx:-104,dy:12,s:58,f:1,ph:0}];
const fog=[...Array(11)].map(()=>({x:rnd(0,W),y:rnd(H*.2,H*.85),r:rnd(130,300),v:rnd(3,9),c:live.rand()<.5?[110,50,190]:[30,110,170]}));

function update(now,dt){
  for(let i=0;i<N;i++)heat[i]=live.model.heat(C.names[i].toLowerCase());
  const seen=new Set();for(const c of cabs.values()){
    seen.add(c.key);let f=fl.find(q=>q.key===c.key);const d=C.names.indexOf((c.home?.district||'core').toUpperCase());
    if(!f){f=mk(Math.max(0,d),fl.length);f.key=c.key;f.role=c.label;f.size=32;f.real=true;f.worker=c;f.kind=({'flyer-sport':0,'flyer-van':1,'flyer-limo':2,'flyer-bike':3,'flyer-police':4,'flyer':5})[cabSprite(c)]??0;fl.push(f);}
    f.work=!!c.working;f.leave=!!c.leaving;if(!f.leave)f.gone=false;
  }
  for(const f of fl)if(f.real&&!seen.has(f.key))f.leave=true;
  flare*=Math.pow(.5,dt/1.3);
  for(let d=0;d<N;d++)if(heat[d]>0&&live.rand()<heat[d]*9*dt)spark(d,now);
  sparks=sparks.filter(s=>now-s.t<s.life);rings=rings.filter(r=>now-r.t<1800);moveCars(dt);stepFlyers(now,dt);live.vector.update(now,dt);
  for(const f of fl)if(f.worker){const p=live.world(f.x,f.y,f.z);f.worker.px=f.worker.x;f.worker.py=f.worker.y;Object.assign(f.worker,p);f.worker.aquarium=f;}
  for(const f of fog){f.x+=f.v*dt;if(f.x-f.r>W)f.x=-f.r;}
}
function draw(now){g=ctx;live.vector.present();g=live.vector.carContext();drawCars();live.vector.compositeCars();g=ctx;live.transform();
  g.globalCompositeOperation='source-over';live.vector.drawAds(now);
  g.globalCompositeOperation='lighter';const total=heat.reduce((a,b)=>a+b,0)/N;
  g.globalCompositeOperation='source-over';live.vector.drawTw(now);drawBolts(now);drawAlerts(now);g.globalCompositeOperation='lighter';
  for(const f of fog){const q=g.createRadialGradient(f.x,f.y,0,f.x,f.y,f.r);q.addColorStop(0,rgb(f.c,.05));q.addColorStop(1,rgb(f.c,0));g.fillStyle=q;g.fillRect(f.x-f.r,f.y-f.r,f.r*2,f.r*2)}
  g.fillStyle='#ff3346';for(const a of C.ants){if(((now/1000+a[2]*.13)%2.4)<.5){g.beginPath();g.arc(a[0],a[1],1.7,0,7);g.fill()}}
  const o=owner.p,gl=.08+.55*Math.min(1,total*3)+.6*flare,q=g.createRadialGradient(o[0],o[1],0,o[0],o[1],40+40*gl);q.addColorStop(0,`rgba(170,240,255,${.4*gl})`);q.addColorStop(1,'rgba(40,160,255,0)');g.fillStyle=q;g.beginPath();g.arc(o[0],o[1],80,0,7);g.fill();
  g.globalCompositeOperation='source-over';
  for(const f of fl)if(!f.real)drawFlyer(f,now);
  g.globalCompositeOperation='lighter';for(const r of rings){const p=(now-r.t)/1800,rad=(r.big?18:5)+p*(r.big?95:30);g.strokeStyle=rgb(tint[r.d],(1-p)*.95);g.lineWidth=r.big?2.4:1.5;g.beginPath();g.ellipse(r.x,r.y,rad,rad*.5,0,0,7);g.stroke()}

ctx.restore();}
function names(){g=ctx;live.transform();g.globalCompositeOperation='source-over';g.font=`600 ${13/Math.sqrt(cam.z)}px ui-monospace,Menlo,monospace`;g.textAlign='center';
for(let i=1;i<N;i++){const m=mainPad[i];if(!m)continue;g.fillStyle=rgb(tint[i],Math.min(1,.42+heat[i]*1.2));g.fillText(C.names[i],m.p[0],Math.max(14,m.p[1]-10));}ctx.restore();}
function worker(c,now){if(!c.aquarium||c.landed)return;g=ctx;live.transform();drawFlyer(c.aquarium,now);ctx.restore();const [x,y]=P(c.x,c.y,c.z);selRing(c,x,y,unit(),now);}
function clear(){bolts=[];heat.fill(0);sparks=[];rings=[];flare=0;for(const f of fl){f.cargo=0;f.fast=false;f.trail=[];f.state='park';f.x=f.at.g[0];f.y=f.at.g[1];f.z=roofZ(f.at);}}
return {update,draw,names,worker,dispatch,clear,fl,heat,byD,owner,mainPad,cars,get sparks(){return sparks},get rings(){return rings}};
}
class AquariumLiveCity extends LiveCity {
  async prepare(){this.alerts=new CityAlerts();const c=this.city,start=performance.now(),base=`${ASSET}/assets/live/aquarium/`;
    const [data,projection,geo,plaza]=await Promise.all(['data.json','projection.json','geometry.json','plaza.json'].map(f=>fetch(base+f).then(r=>r.json())));this.data=data;this.projection=projection;this.factor=data.w/projection.frame[0];this.cropTop=40;this.plaza=plaza;
    const removed=geo.boxes.filter(b=>b[5]==='b'&&NotablePlacement.overlap(plaza.rect,b));geo.boxes=geo.boxes.filter(b=>!removed.includes(b));data.pads=data.pads.filter(p=>{if(p.k!=='b')return true;const w=this.world(...p.g),x=(w.x-CX)*c.scale,y=(w.y-CY)*c.scale;return !removed.some(b=>x>=b[0]&&x<=b[2]&&y>=b[1]&&y<=b[3]);});
    const picture=file=>new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(Error('Aquarium asset '+file));i.src=base+'art/'+file;});
    const flyers=[];
    this.images={flyers,lights:[],art2:new Map()};await Promise.all(Object.values(geo.models||{}).filter(m=>m.base.startsWith('landing-pad')).flatMap(m=>[m.base,m.emis]).map(file=>new Promise((r,j)=>{const i=new Image();i.onload=()=>{this.images.art2.set(file,i);r();};i.onerror=j;i.src=base+'art2/'+file;})));this.aq=aquariumRuntime(this,data,this.images);this.main={};
    this.lots=data.pads.map((p,id)=>{const w=this.world(...p.g),x=(w.x-CX)*c.scale,y=(w.y-CY)*c.scale,lift=(p.g[1]-p.p[1])/this.factor/c.scale,size=p.k==='hero'?30:p.k.startsWith('n:')?38:14;
      const b=c.makeBox([x-size/2,y-size/2,x+size/2,y+size/2,(lift*c.scale/6.5)**.8,'b'],`aquarium-${id}`);b.d=data.names[p.d].toLowerCase();b.pad=p;b.lift=lift;b.notable=p.k.startsWith('n:');b.access=G.nodes.reduce((a,n)=>Math.hypot(n.x-b.x,n.y-b.y)<Math.hypot(a.x-b.x,a.y-b.y)?n:a,G.nodes[0]);p.lot=b;return b;});
    for(let i=0;i<data.names.length;i++)this.main[data.names[i].toLowerCase()]=this.aq.mainPad[i].lot;
    c.ownerBox=this.aq.owner.lot;G.owner=c.ownerBox;G.owner.owner=true;G.lots=this.lots;c.ordered=this.lots;
    for(let i=0;i<data.names.length;i++){const d=DIST[data.names[i].toLowerCase()];Object.assign(d,{x:this.main[d.id].x,y:this.main[d.id].y});}
    this.vector=new AquariumVector(this,geo);this.hubHeat=new Map();
    npcs.length=0;this.overflow=0;this.maxCargo=0;this.fit();cam.x=cam.tx=BASE.x;cam.y=cam.ty=BASE.y;await this.vector.prime();this.prepareMs=performance.now()-start;
  }
  world(px,py,z=0){const a=px/this.factor-this.projection.ox,b=2*((py+this.cropTop)/this.factor-this.projection.oy);return {x:CX+(a+b)/2/this.city.scale,y:CY+(b-a)/2/this.city.scale,z:z/this.factor/this.city.scale};}
  transform(){const p=this.world(0,0),origin=P(p.x,p.y),s=unit()/this.city.scale/this.factor;ctx.save();ctx.translate(...origin);ctx.scale(s,s);}
  fit(){if(!W||!H)return;const left=W>700?Math.min(300,W*.22):12,right=24,top=112,bottom=90,crop={x:70,y:65,w:1660,h:700},s=Math.max(.01,Math.min((W-left-right)/crop.w,(H-top-bottom)/crop.h)),p=this.world(crop.x+crop.w/2,crop.y+crop.h/2);K=s*this.city.scale*this.factor;
    BASE={x:p.x-p.y+(W/2-(left+W-right)/2)/K,y:(p.x+p.y)/2+(H/2+30-(top+H-bottom)/2)/K};}

  placeHubs(){const taken=new Set([this.city.ownerBox]);for(const t of towers.values()){const repo=machines.get(t.machine)?.stages.get(t.stage)?.repo||'',d=districtFor(repo);t.district=d;t.mapDistrict=d;
      if(t.lot?.pad&&t.lot.d===d&&!taken.has(t.lot)){taken.add(t.lot);continue;}const local=this.lots.filter(b=>b.d===d&&!taken.has(b)),keys=local.filter(b=>['hero','land','n:gr','n:sp'].includes(b.pad.k));const candidates=keys.length?keys:local;candidates.sort((a,b)=>b.h-a.h);t.lot=candidates[0]||this.main[d];taken.add(t.lot);}}
  event(src,ev,replayed=false){const at=replayed?Date.parse(ev.at):Date.now(),d=this.district(src,ev);if(!this.model.ingest(d,ev,at))return;
    this.bumpHub(src,ev,at);this.alerts.track(src,ev,this.data.names.indexOf(d.toUpperCase()),performance.now());
    const who=resolve(src,ev.from||[ev.stage,'hub']);if(who){who.pulse=1;const p=worldOf(who);focus(...p);}
    for(let i=0;i<this.data.names.length;i++)this.aq.heat[i]=this.model.heat(this.data.names[i].toLowerCase());
    this.aq.dispatch(this.data.names.indexOf(d.toUpperCase()),performance.now(),ev.from?.[1],who?.kind==='cab'?who.key:null,src,ev);
  }
  bumpHub(src,ev,at){const hub=machines.get(src)?.stages.get(ev.stage)?.hub;if(!hub||this.model.isSystem(ev))return;const old=this.hubHeat.get(hub.key),h=old?old.h*2**(-Math.max(0,at-old.at)/(this.config.halfLifeSeconds*1000)):0;this.hubHeat.set(hub.key,{h:1-(1-h)*(1-this.config.eventGain),at});}
  async initialize(){await super.initialize();this.restoreAlerts();this.hubHeat.clear();for(const [src,ev]of this.all||[])if(Date.parse(ev.at)<=this.clock)this.bumpHub(src,ev,Date.parse(ev.at));}
  restoreAlerts(){this.alerts.reset();for(const [src,e]of this.all||[])if(Date.parse(e.at)<=this.clock&&!this.model.isSystem(e))this.alerts.track(src,e,this.data.names.indexOf(this.district(src,e).toUpperCase()),performance.now());}
  async initializeLive(){await super.initializeLive();if(!this.replaying)this.restoreAlerts();}
  alertHit(x,y){for(const e of this.alerts.entries.values())if(e.screen&&Math.hypot(e.screen[0]-x,e.screen[1]-y)<e.radius){const hub=machines.get(e.src)?.stages.get(e.stage)?.hub;if(hub)return hub;}return null;}
  alertLines(n){return n.kind==='hub'?this.alerts.lines(n.machine,n.stage):[];}
  keyLevel(id){const b=this.vector.keyBoxes.find(b=>b.group===id);if(!b)return 0;const total=Object.values(this.model.values).reduce((a,v)=>a+v,0);if(b.pad===this.aq.owner)return Math.min(1,.08+total*.24);
    const hub=[...towers.values()].find(t=>t.lot?.pad===b.pad);if(!hub)return .02+this.model.heat(b.d)*.42;const st=machines.get(hub.machine)?.stages.get(hub.stage),working=st&&[...st.workers.values()].some(c=>c.working&&!c.leaving);
    if(working){const old=this.hubHeat.get(hub.key);this.hubHeat.set(hub.key,{h:Math.max(.45,old?old.h*2**(-Math.max(0,this.clock-old.at)/(this.config.halfLifeSeconds*1000)):0),at:this.clock});}const v=this.hubHeat.get(hub.key);return .025+(v?v.h*2**(-Math.max(0,this.clock-v.at)/(this.config.halfLifeSeconds*1000))*.9:0);}
  stopReplay(){if(!this.replaying)return;this.aq.clear();super.stopReplay();}
  async startReplay(events){await super.startReplay(events);this.aq.clear();this.restoreAlerts();this.hubHeat.clear();for(const [src,ev]of this.all||[])if(Date.parse(ev.at)<=this.clock)this.bumpHub(src,ev,Date.parse(ev.at));this.overflow=0;}
  step(now,dt){this.now=now;if(this.replaying)this.clock=this.timeline.step(now,(src,ev)=>onLine(src,ev,true));else this.clock=Date.now();this.model.decay(this.clock);this.aq.update(now,dt);this.vector.observeCamera();this.vector.pump();
    const cargo=this.aq.fl.filter(f=>f.cargo);this.flights=cargo;this.sparks=this.aq.sparks;this.metrics.frames++;if(DISTRICTS.every(d=>!this.model.heat(d.id)))this.metrics.darkFrames++;this.metrics.maxFlights=Math.max(this.metrics.maxFlights||0,cargo.length);this.metrics.maxArcs=0;this.maxCargo=Math.max(this.maxCargo,cargo.length);this.showMode();}
  draw(){this.aq.draw(this.now||performance.now());}
  names(){this.aq.names();}
  showMode(){const mode=document.getElementById('mode');mode.className=this.replaying?'replay':'';if(!this.replaying){mode.innerHTML=`<b>${T.live}</b>`;return;}const d=new Date(this.clock),hm=d.toTimeString().slice(0,5);mode.innerHTML=`<b>${T.replay}</b> · ${d.toLocaleDateString(LANG,{day:'2-digit',month:'2-digit'})} ${hm}<br>${this.timeline.speed}× · ${T.lastHours(+(qs.get('hours')||168))}`;mode.title=this.historyError||(!this.all.length?(LANG==='ru'?'История пуста':'Empty history'):'');}
}
