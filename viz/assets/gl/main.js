// The source generator's fixed 2:1 isometric projection is baked into vertices.
// The GPU applies the orthographic viewport transform every frame. No city raster/cache.
import {createCaptureResponse} from './capture-response.js';
import {createCelebrations} from './celebrations.js';
import {createDistrictWork} from './district-work.js';
import {createPainter} from './painter.js';
import {createFlightPlanner,settle} from './flight.js';
import {createPlazaHologram} from './hologram.js';
import {createSelection} from './selection.js';
import {createGrowthModel,displayColour,fadeLevel} from './growth.js';
import {updateRoadTraffic,createArrivalWalls,arrivalFrame,landing} from './lighting.js';
import {createHubLights,hubHeightFactor,scalableHub,scaledBuilding,raiseClearance} from './hubs.js';
export async function createGPUCity(canvas,{auto=true,controls=true}={}){
const error=document.querySelector('#error')||document.createElement('div');
const gl=canvas.getContext('webgl2',{antialias:true,alpha:false,depth:true,powerPreference:'high-performance'});
if(!gl)throw Error('Для города нужен WebGL2. Откройте страницу в браузере с поддержкой WebGL2.');
const base=new URL('.',import.meta.url),S=await fetch(new URL('scene.json',base)).then(r=>{if(!r.ok)throw Error('scene.json');return r.json()});
const shader=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
const program=(vs,fs)=>{const p=gl.createProgram();gl.attachShader(p,shader(gl.VERTEX_SHADER,vs));gl.attachShader(p,shader(gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return p;};
const transform=`uniform vec4 camera; vec4 project(vec3 p){return vec4((p.xy-camera.xy)*camera.zw*vec2(2.,-2.)+vec2(-1.,1.),p.z,1.);}`;
const vs=`#version 300 es
precision highp float;layout(location=0)in vec3 position;layout(location=1)in vec3 color;out vec3 col;out vec2 world;uniform vec2 objectOffset;uniform float objectGain;${transform}void main(){vec3 p=position;p.xy+=objectOffset;gl_Position=project(p);col=color*objectGain;world=p.xy;}`;
const fs=`#version 300 es
precision highp float;in vec3 col;in vec2 world;uniform float emission;uniform float terrainFade;out vec4 outColor;
void main(){vec3 c=col;
float a=world.x/.75-1156.61286238,b=2.*((world.y+40.)/.75-651.59560046);vec2 grid=vec2(a+b,b-a)*.5;
vec2 src=vec2(1000.,562.5)+mat2(.795191,.606359,-.606359,.795191)*grid;
float edge=smoothstep(0.,70.,min(min(src.x,2000.-src.x),min(src.y,1125.-src.y)));
float haze=exp(-dot((world-vec2(900,300))/vec2(830,400),(world-vec2(900,300))/vec2(830,400)));
vec3 sky=(vec3(6,6,16)+haze*vec3(16,6,30))/255.;
c=mix(sky,c,mix(1.,edge,terrainFade));float v=clamp(1.06-pow(length((world-vec2(900,350))/vec2(1188,594)),3.)*.6,.3,1.);c*=v;if(emission>0.)c*=smoothstep(.15,.55,max(c.r,max(c.g,c.b)));outColor=vec4(c,1.);}`;
const solid=program(vs,fs);
const roadProgram=program(`#version 300 es
precision highp float;layout(location=0)in vec3 position;layout(location=1)in vec3 color;layout(location=2)in float roadId;layout(location=3)in vec2 centre;uniform float traffic[308];out vec3 col;out vec2 world;${transform}void main(){float k=clamp(traffic[int(roadId)],0.,1.);vec3 p=position;gl_Position=project(p);col=color*(.65+.2*k);world=p.xy;}`,fs);
const roadTraffic=new Float32Array(308);
const winvs=`#version 300 es
precision highp float;layout(location=0)in vec2 uv;layout(location=2)in vec3 origin;layout(location=3)in vec4 axes;layout(location=4)in vec4 state;layout(location=5)in vec3 timing;${transform}uniform float time;uniform float impulse;out vec3 col;out vec2 world;
void main(){vec2 p=origin.xy+uv.x*axes.xy+uv.y*axes.zw;float life=state.a;
// Sparse, short, hard centre blinks. Per-instance colour/state never rebuilds geometry.
if(life<0.){float tick=mod(time+timing.x,13.);life=step(tick,.16)*timing.y;}
if(impulse>=0.&&timing.z<.5){float age=time-impulse-timing.x*.025;life=max(life,step(0.,age)*step(age,.42));}
col=state.rgb*max(0.,life);world=p;gl_Position=project(vec3(p,origin.z));if(life<=0.)gl_Position=vec4(3.,3.,3.,1.);}`;
const win=program(winvs,fs.replace('outColor=vec4(c,1.);','outColor=vec4(c*(emission>0.?.06:1.),1.);'));
const flatvs=`#version 300 es
precision highp float;out vec2 uv;void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);uv=p;gl_Position=vec4(p*2.-1.,0,1);}`;
const ground=program(flatvs,`#version 300 es
precision highp float;in vec2 uv;uniform vec4 camera;out vec4 outColor;void main(){vec2 p=camera.xy+vec2(uv.x,1.-uv.y)/camera.zw;float haze=exp(-dot((p-vec2(900,300))/vec2(830,400),(p-vec2(900,300))/vec2(830,400)));outColor=vec4((vec3(6,6,16)+haze*vec3(16,6,30))/255.,1);}`);
const texvs=`#version 300 es
precision highp float;layout(location=0)in vec3 position;layout(location=1)in vec2 texcoord;${transform}out vec2 uv;void main(){gl_Position=project(position);uv=texcoord;}`;
const adprogram=program(texvs,`#version 300 es
precision highp float;in vec2 uv;uniform sampler2D art;uniform float emission;out vec4 outColor;void main(){outColor=texture(art,uv);}`);
const blur=program(flatvs,`#version 300 es
precision highp float;in vec2 uv;uniform sampler2D art;uniform vec2 direction;out vec4 outColor;void main(){vec3 c=texture(art,uv).rgb*.227027;c+=(texture(art,uv+direction*1.384615).rgb+texture(art,uv-direction*1.384615).rgb)*.316216;c+=(texture(art,uv+direction*3.230769).rgb+texture(art,uv-direction*3.230769).rgb)*.070270;outColor=vec4(c,1);}`);
const combine=program(flatvs,`#version 300 es
precision highp float;in vec2 uv;uniform sampler2D art;out vec4 outColor;void main(){float d=(fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453)-.5)/255.;outColor=vec4(max(vec3(0),texture(art,uv).rgb*.9+d),1.);}`);
const depth=l=>.75-1.5*l/S.maxLayer;
const tris=[],terrain=[],roadLight=[];
const vertex=(out,p,c,z)=>out.push(p[0],p[1],z,c[0]/255,c[1]/255,c[2]/255);
const polygon=(out,pts,c,z)=>{const f=pts.flat(),idx=earcut.default(f);for(const i of idx)vertex(out,pts[i],c,z);};
const line=(out,pts,c,z,w)=>{pts=pts.filter((p,i)=>!i||Math.hypot(p[0]-pts[i-1][0],p[1]-pts[i-1][1])>1e-8);if(pts.length<2)return;const closed=Math.hypot(pts[0][0]-pts.at(-1)[0],pts[0][1]-pts.at(-1)[1])<1e-6,n=pts.length,sides=pts.map((p,i)=>{const a=pts[i?i-1:closed?n-2:0],b=pts[i<n-1?i+1:closed?1:n-1];let dx=p[0]-a[0],dy=p[1]-a[1],ex=b[0]-p[0],ey=b[1]-p[1];if(!i&&!closed){dx=ex;dy=ey;}if(i===n-1&&!closed){ex=dx;ey=dy;}const l=Math.hypot(dx,dy)||1,r=Math.hypot(ex,ey)||1,nx=-dy/l,ny=dx/l,mx=nx-ey/r,my=ny+ex/r,L=Math.hypot(mx,my)||1,x=mx/L,y=my/L,k=w/2/Math.max(.5,x*nx+y*ny);return[[p[0]+x*k,p[1]+y*k],[p[0]-x*k,p[1]-y*k]];});for(let i=1;i<n;i++)polygon(out,[sides[i-1][0],sides[i][0],sides[i][1],sides[i-1][1]],c,z);};

const pr=S.projection,ca=Math.cos(pr.g*Math.PI/180),sa=Math.sin(pr.g*Math.PI/180);
const P=(x,y,h=0)=>[(pr.ox+x-y)*.75,(pr.oy+(x+y)/2-h*6.5)*.75-40];
const grid=([x,y])=>{x-=pr.center[0];y-=pr.center[1];return [x*ca+y*sa,-x*sa+y*ca]};const src=p=>P(...grid(p));
polygon(terrain,[[0,0],[1800,0],[1800,780],[0,780]],[7,17,33],.97);
const shoreContours=[];
for(const land of S.land){
// Smooth only the three-pixel contour tracing staircase; retain the source coastline.
let contour=land;for(let pass=0;pass<2;pass++){const next=[];for(let i=0;i<contour.length;i++){const a=contour[i],b=contour[(i+1)%contour.length];next.push([a[0]*.75+b[0]*.25,a[1]*.75+b[1]*.25],[a[0]*.25+b[0]*.75,a[1]*.25+b[1]*.75]);}contour=next;}
const pts=contour.map(src);shoreContours.push(pts);polygon(terrain,pts,[17,17,30],.95);line(terrain,[...pts,pts[0]],[19,35,48],.949,.45);}
// Generous quadratic fillets retain every junction/end point and the source street layout.
const roundRoad=points=>{if(points.length<3)return points;const out=[points[0]];for(let i=1;i<points.length-1;i++){const a=points[i-1],b=points[i],c=points[i+1],la=Math.hypot(a[0]-b[0],a[1]-b[1]),lb=Math.hypot(c[0]-b[0],c[1]-b[1]),r=Math.min(22,la*.42,lb*.42);if(r<.1){out.push(b);continue;}const A=[b[0]+(a[0]-b[0])*r/la,b[1]+(a[1]-b[1])*r/la],B=[b[0]+(c[0]-b[0])*r/lb,b[1]+(c[1]-b[1])*r/lb];out.push(A);for(let j=1;j<=12;j++){const t=j/12,u=1-t;out.push([u*u*A[0]+2*u*t*b[0]+t*t*B[0],u*u*A[1]+2*u*t*b[1]+t*t*B[1]]);}}out.push(points.at(-1));return out;};
const ribbon=(out,pts,c,z,w)=>{const sides=pts.map((p,i)=>{const a=pts[Math.max(0,i-1)],b=pts[Math.min(pts.length-1,i+1)],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy)||1,x=-dy/len*w/2,y=dx/len*w/2;return[[p[0]+x,p[1]+y],[p[0]-x,p[1]-y]];});for(let i=1;i<sides.length;i++)polygon(out,[sides[i-1][0],sides[i][0],sides[i][1],sides[i-1][1]],c,z);for(const p of [pts[0],pts.at(-1)])polygon(out,Array.from({length:16},(_,i)=>[p[0]+Math.cos(i*Math.PI/8)*w/2,p[1]+Math.sin(i*Math.PI/8)*w/2]),c,z);};
const roadPaths=[],responseRoadPaths=[];for(const [roadId,r]of S.roads.entries()){const pts=roundRoad(r.points).map(src),width={avenue:9,collector:6,street:2.6}[r.class];ribbon(terrain,pts,[27,23,34],.94,width*.75);responseRoadPaths.push({gpuId:roadId,p:pts});if(r.class!=='street')roadPaths.push({gpuId:roadId,c:r.class==='avenue'?0:1,p:pts});
const batch=[];ribbon(batch,pts,[255,190,140],.93,r.class==='avenue'?1.15:r.class==='street'?.65:.8);
for(let i=0;i<batch.length;i+=6){const x=batch[i],y=batch[i+1];let best=pts[0],dist=Infinity;for(const p of pts){const d=(p[0]-x)**2+(p[1]-y)**2;if(d<dist){best=p;dist=d;}}roadLight.push(...batch.slice(i,i+6),roadId,...best);}}

for(const [x,y,r] of S.trees){const p=P(x,y);polygon(terrain,Array.from({length:8},(_,i)=>[p[0]+Math.cos(i*Math.PI/4)*r*.6,p[1]-.4*r+Math.sin(i*Math.PI/4)*r*.45]),[10,24,26],.92);}
for(const cmd of S.commands){if(cmd[0]==='p')polygon(tris,cmd[1],cmd[2],depth(cmd[3]));else line(tris,cmd[1],cmd[2],depth(cmd[3]),cmd[4]);}
// Updated source ROOFP/LPD contract (23:30): inset roof quads, S/M/D types.
const tints=[[20,225,255],[20,240,190],[255,70,150],[255,120,30],[130,70,255],[255,170,80],[255,36,200],[20,225,255],[255,36,70]];
const byD=Array.from({length:9},(_,d)=>S.prototypePads.filter(p=>p.d===d));
const ROOFP=S.prototypeRoofs.map(w=>{const cx=(w[0]+w[2]+w[4]+w[6])/4,cy=(w[1]+w[3]+w[5]+w[7])/4,e1=Math.hypot(w[2]-w[0],w[3]-w[1]),e2=Math.hypot(w[4]-w[2],w[5]-w[3]);let best=null,bd=9;for(const p of byD[w[8]]||[]){const e=Math.hypot(p.p[0]-cx,p.p[1]-cy);if(e<bd){bd=e;best=p}}return best&&{w,cx,cy,e1,e2,L:Math.max(e1,e2),S:Math.min(e1,e2),src:best}}).filter(Boolean);
const makePad=(r,type)=>({...r,type,p:[r.cx,r.cy],d:r.src.d});
const LP=byD.flatMap((L,d)=>{const R=ROOFP.filter(r=>r.w[8]===d).sort((a,b)=>b.L*b.S-a.L*a.S),out=[],far=(r,m)=>out.every(q=>Math.hypot(q.p[0]-r.cx,(q.p[1]-r.cy)*2)>m),take=(ok,type,n,m)=>{let c=0;for(const r of R){if(c>=n)break;if(ok(r)&&far(r,m)){out.push(makePad(r,type));c++}}return c};
if(!take(r=>r.L>=18&&r.S>=10,'D',d===0?3:2,50)&&R[0])out.push(makePad(R[0],'D'));take(r=>r.L>=12&&r.S>=8,'M',3,45);take(r=>r.L>=8&&r.S>=6,'S',d===0?5:3,40);return out;});
const roofFaces=S.commands.filter(c=>c[0]==='p'&&c[1].length===4&&c[1].every((a,i)=>{const b=c[1][(i+1)%4];return Math.abs(Math.abs((b[1]-a[1])/(b[0]-a[0]))-.5)<.01;}));
const padVertices=[],padSites=[];
for(const pad of LP){const {w,p:[cx,cy],type,e1,e2}=pad,q=[0,2,4,6].map(i=>[cx+(w[i]-cx)*.8,cy+(w[i+1]-cy)*.8]);
const roof=roofFaces.reduce((best,r)=>{const p=r[1],x=(p[0][0]+p[2][0])/2,y=(p[0][1]+p[2][1])/2,dist=Math.hypot(x-cx,y-cy);return !best||dist<best.dist?{r,x,y,dist}:best;},null);if(!roof)continue;
const z=depth(roof.r[3]+.25),c=tints[pad.d],closed=Q=>[...Q,Q[0]];
const pts=q.slice();if(type==='D'){const mid=(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2];if(e1>=e2)pts.push(mid(q[0],q[1]),mid(q[3],q[2]));else pts.push(mid(q[0],q[3]),mid(q[1],q[2]));}
for(const [x,y]of pts)polygon(padVertices,Array.from({length:12},(_,i)=>[x+Math.cos(i*Math.PI/6)*.75,y+Math.sin(i*Math.PI/6)*.75]),c.map(v=>v*.42),z);
padSites.push({district:pad.d,type,source:[cx,cy],roof:[roof.x,roof.y],quad:q,layer:roof.r[3]});}
// A connected pool carries the reflection; small, independently phased crests catch light.
const waterMotion=matchMedia('(prefers-reduced-motion: reduce)');
const reflectionProgram=program(`#version 300 es
precision highp float;layout(location=0)in vec3 position;layout(location=1)in vec2 local;layout(location=2)in vec3 color;layout(location=3)in vec2 detail;${transform}out vec2 uv;out vec3 col;flat out vec2 source;void main(){gl_Position=project(position);uv=local;col=color;source=detail;}`,`#version 300 es
precision highp float;in vec2 uv;in vec3 col;flat in vec2 source;uniform float time;out vec4 outColor;
void main(){
float phase=source.x,shore=source.y;
float sway=.065*sin(uv.y*23.+time*.47+phase)+.035*sin(uv.y*47.-time*.31+phase*1.7);
float offset=uv.x+sway;
float wave=sin(uv.y*151.+.8*sin(uv.y*37.+phase)+time*.72+phase);
float glint=pow(.5+.5*wave,10.)*(.65+.35*sin(uv.y*19.-time*.43+phase));
float body=.50+.045*sin(uv.y*43.-time*.38+phase);
float bank=(uv.y-.42)*3.5;
float tail=mix(pow(1.-uv.y,1.45),exp(-bank*bank)*smoothstep(0.,.18,uv.y),shore);
float a=exp(-offset*offset*4.)*tail*(body+mix(.18,.28,shore)*glint);
outColor=vec4(col*a*.78,1);
}`);
const fogProgram=program(`#version 300 es
precision highp float;layout(location=0)in vec3 position;layout(location=1)in vec2 local;layout(location=2)in vec3 color;${transform}out vec2 uv;out vec3 col;void main(){gl_Position=project(position);uv=local;col=color;}`,`#version 300 es
precision highp float;in vec2 uv;in vec3 col;out vec4 outColor;void main(){float r=dot(uv,uv);float a=exp(-r*5.)*smoothstep(1.,.6,r);outColor=vec4(col*a*.15,1);}`);
const fogVertices=[];for(let i=0;i<S.ads.length;i++){const q=S.ads[i][0],x=(q[0][0]+q[2][0])/2,y=(q[0][1]+q[2][1])/2,r=80,c=i%4===0?[.3,.65,1]:[1,.2,.7];for(const [u,v]of [[-1,-1],[1,-1],[-1,1],[-1,1],[1,-1],[1,1]])fogVertices.push(x+u*r,y+v*r,0,u,v,...c);}
const reflectionVertices=[],waterLights=[];
function reflection(x,y,len,w,c,shore=0){
 const phase=(Math.sin(x*12.9898+y*78.233)*43758.5453%1)*6.283185;
 for(const [u,v]of [[-1,0],[1,0],[-1,1],[-1,1],[1,0],[1,1]])reflectionVertices.push(x+u*w,y+v*len,.96,u,v,...c,phase,shore);
}
const reflectionSources=S.commands.filter(c=>c[0]==='p'&&Math.max(...c[2])>115&&c[1].length===4);
for(const cmd of reflectionSources){const q=cmd[1],x=(q[0][0]+q[2][0])/2,y=Math.max(...q.map(p=>p[1]))+10,c=cmd[2].map(v=>v/255);reflection(x,y,260,10,c);waterLights.push({x,y,c});}
for(const pad of S.pads.filter(p=>p[3]==='hero'||p[3]==='n:gr')){const x=pad[5][0]*.75,y=pad[5][1]*.75-40,len=145+pad[4]*2,w=14+pad[4]*.24,c=pad[2]===0?[.1,.8,1]:pad[2]===8?[1,.2,.3]:[.6,.2,1];reflection(x,y,len,w,c);waterLights.push({x,y,c});}
// Project nearby light sources onto the actual smoothed bank, never trace a luminous rim.
// The existing .95 land / .97 water depth clips these .96 pools to the water side.
const shoreLights=[];
for(const light of waterLights){let best=null,dist=80*80;
 for(const pts of shoreContours)for(let i=0;i<pts.length;i++){
  const a=pts[i],b=pts[(i+1)%pts.length],dx=b[0]-a[0],dy=(b[1]-a[1])*2;
  const t=Math.max(0,Math.min(1,((light.x-a[0])*dx+(light.y-a[1])*2*dy)/(dx*dx+dy*dy||1)));
  const x=a[0]+t*dx,y=a[1]+t*dy/2,d=(x-light.x)**2+((y-light.y)*2)**2;
  if(d<dist){dist=d;best={x,y};}
 }
 if(!best||shoreLights.some(p=>Math.hypot(p.x-best.x,(p.y-best.y)*2)<28))continue;
 shoreLights.push(best);const gain=.48*(1-Math.sqrt(dist)/100);
 reflection(best.x,best.y-10,24,18,light.c.map(v=>v*gain),1);
}
const buffer=(data,usage=gl.STATIC_DRAW)=>{const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,data,usage);return b;};
const attr=(n,size,stride,offset,divisor=0)=>{gl.enableVertexAttribArray(n);gl.vertexAttribPointer(n,size,gl.FLOAT,false,stride,offset);gl.vertexAttribDivisor(n,divisor);};
const mesh=data=>{const vao=gl.createVertexArray();gl.bindVertexArray(vao);const vbo=buffer(new Float32Array(data));attr(0,3,24,0);attr(1,3,24,12);return {vao,buffer:vbo,count:data.length/6};};
const fogVao=gl.createVertexArray();gl.bindVertexArray(fogVao);buffer(new Float32Array(fogVertices));attr(0,3,32,0);attr(1,2,32,12);attr(2,3,32,20);
const reflectionVao=gl.createVertexArray();gl.bindVertexArray(reflectionVao);buffer(new Float32Array(reflectionVertices));attr(0,3,40,0);attr(1,2,40,12);attr(2,3,40,20);attr(3,2,40,32);
const responseWaterVao=gl.createVertexArray();gl.bindVertexArray(responseWaterVao);
const responseWaterBuffer=buffer(new Float32Array(0),gl.DYNAMIC_DRAW);attr(0,3,40,0);attr(1,2,40,12);attr(2,3,40,20);attr(3,2,40,32);let responseWaterCount=0;
function responseWater(sources){const out=[];for(const light of sources.slice(0,9)){
 let bank=null,best=42*42;for(const pts of shoreContours)for(let i=0;i<pts.length;i++){
 const a=pts[i],b=pts[(i+1)%pts.length],dx=b[0]-a[0],dy=(b[1]-a[1])*2,t=Math.max(0,Math.min(1,((light.x-a[0])*dx+(light.y-a[1])*2*dy)/(dx*dx+dy*dy||1))),x=a[0]+t*dx,y=a[1]+t*dy/2,d=(x-light.x)**2+((y-light.y)*2)**2;if(d<best){best=d;bank={x,y};}}
 if(!bank)continue;const gain=1-Math.sqrt(best)/42;
 for(const [u,v]of [[-1,0],[1,0],[-1,1],[-1,1],[1,0],[1,1]])out.push(bank.x+u*15,bank.y-8+v*32,.96,u,v,...light.c.map(c=>c*gain),light.x%6.28,1);
 }responseWaterCount=out.length/10;gl.bindBuffer(gl.ARRAY_BUFFER,responseWaterBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(out),gl.DYNAMIC_DRAW);}
const padMesh=mesh(padVertices);
const roadsVao=gl.createVertexArray();gl.bindVertexArray(roadsVao);buffer(new Float32Array(roadLight));attr(0,3,36,0);attr(1,3,36,12);attr(2,1,36,24);attr(3,2,36,28);const roadsMesh={vao:roadsVao,count:roadLight.length/9};
const terrainMesh=mesh(terrain),cityMesh=mesh(tris);
const windows=[...S.windows.map(w=>[...w,false,false]),...S.optional.map(w=>[w[0],w[1],w[2],w[3],true,w[4]])];
const instance=[],states=[],timings=[];
for(let i=0;i<windows.length;i++){const [q,c,l,d,optional,key]=windows[i];instance.push(...q[0],depth(l)-.000002,q[1][0]-q[0][0],q[1][1]-q[0][1],q[3][0]-q[0][0],q[3][1]-q[0][1]);const centre=Math.hypot((q[0][0]+q[2][0])/2-900,((q[0][1]+q[2][1])/2-420)*1.2);const on=key?1:optional?-1:1;
const wc=key?(i%7<3?(i%10<7?[173,217,235]:[235,208,175]):[30,34,62]):c;
// Ad screens replace facade windows, including optional blinks.
const mid=[(q[0][0]+q[2][0])/2,(q[0][1]+q[2][1])/2];
const behindAd=S.ads.some(([a])=>{const ux=a[1][0]-a[0][0],uy=a[1][1]-a[0][1],vx=a[3][0]-a[0][0],vy=a[3][1]-a[0][1],det=ux*vy-uy*vx,dx=mid[0]-a[0][0],dy=mid[1]-a[0][1],u=(dx*vy-dy*vx)/det,v=(ux*dy-uy*dx)/det;return u>=0&&u<=1&&v>=0&&v<=1;});
states.push(...wc.map(v=>v/255),behindAd?0:on);timings.push((i*7.177)%13,centre<300&&i%17===0?1:0,behindAd?99:d);}
const winVao=gl.createVertexArray();gl.bindVertexArray(winVao);buffer(new Float32Array([0,0,1,0,0,1,0,1,1,0,1,1]));attr(0,2,0,0);const instanceBuffer=buffer(new Float32Array(instance),gl.DYNAMIC_DRAW);attr(2,3,28,0,1);attr(3,4,28,12,1);const stateData=new Float32Array(states),stateBuffer=buffer(stateData,gl.DYNAMIC_DRAW);attr(4,4,16,0,1);buffer(new Float32Array(timings));attr(5,3,12,0,1);
// Facade windows of working districts: the same program on a small buffer of its own, written only while a district works.
// A window this small gives the bloom pass too little to spread, so each lit one carries its own soft halo, at its wall's
// depth: nearer buildings cover it. Additive and without depth writes.
const workHalo=program(`#version 300 es
precision highp float;layout(location=0)in vec2 uv;layout(location=2)in vec3 origin;layout(location=3)in vec4 axes;layout(location=4)in vec4 state;${transform}out vec3 col;out vec2 q;
void main(){const float size=5.;vec2 p=origin.xy+.5*(axes.xy+axes.zw)+(uv.x-.5)*size*axes.xy+(uv.y-.5)*size*axes.zw;q=uv-.5;col=state.rgb*max(0.,state.a);gl_Position=project(vec3(p,origin.z));if(state.a<=0.)gl_Position=vec4(3.,3.,3.,1.);}`,`#version 300 es
precision highp float;in vec3 col;in vec2 q;out vec4 outColor;void main(){float r=dot(q,q)*4.;outColor=vec4(col*.2*exp(-r*5.)*smoothstep(1.,.5,r),1.);}`);
const workVao=gl.createVertexArray();gl.bindVertexArray(workVao);buffer(new Float32Array([0,0,1,0,0,1,0,1,1,0,1,1]));attr(0,2,0,0);const workInstances=buffer(new Float32Array(7),gl.DYNAMIC_DRAW);attr(2,3,28,0,1);attr(3,4,28,12,1);const workStates=buffer(new Float32Array(4),gl.DYNAMIC_DRAW);attr(4,4,16,0,1);const workTimings=buffer(new Float32Array(3),gl.DYNAMIC_DRAW);attr(5,3,12,0,1);let workCount=0;
function setWorkWindows(instances){workCount=instances.length/7;if(!workCount)return;gl.bindBuffer(gl.ARRAY_BUFFER,workInstances);gl.bufferData(gl.ARRAY_BUFFER,instances,gl.DYNAMIC_DRAW);gl.bindBuffer(gl.ARRAY_BUFFER,workStates);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(workCount*4),gl.DYNAMIC_DRAW);gl.bindBuffer(gl.ARRAY_BUFFER,workTimings);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(workCount*3).map((_,i)=>i%3===2?99:0),gl.STATIC_DRAW);}
function writeWorkWindows(states){if(!workCount)return;gl.bindBuffer(gl.ARRAY_BUFFER,workStates);gl.bufferSubData(gl.ARRAY_BUFFER,0,states);}
const signLayers=new Set(S.signLayers);
const ads=[];const WIDE=['split','bars','circle','wave'],TALL=['circle','split','chevrons','disc-block'];
for(let i=0;i<S.ads.length;i++){const [q,l]=S.ads[i],tall=Math.hypot(q[3][0]-q[0][0],q[3][1]-q[0][1])>Math.hypot(q[1][0]-q[0][0],q[1][1]-q[0][1]),name=`ad-${tall?'tall':'wide'}-${(tall?TALL:WIDE)[i%4]}`;const img=new Image();img.src=new URL(`art/${name}.png`,base);await img.decode();const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);const uv=[[0,1],[1,1],[1,0],[0,0]],v=[];for(const j of [0,1,2,0,2,3])v.push(...q[j],depth(l)-.00001,...uv[j]);const vao=gl.createVertexArray();gl.bindVertexArray(vao);buffer(new Float32Array(v));attr(0,3,20,0);attr(1,2,20,12);ads.push({vao,tex,tall,index:i});}
const adTextures=new Map();for(const tall of [false,true])for(const name of (tall?TALL:WIDE)){const im=new Image();im.src=new URL(`art/ad-${tall?'tall':'wide'}-${name}.png`,base);await im.decode();const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,im);gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);adTextures.set(`${tall}:${name}`,t);}
const empty=gl.createVertexArray(),cam={z:1,x:0,y:0};let width=0,height=0,dpr=0,impulse=-1,time=0,raf=0,lost=false;
const scale=()=>Math.max(width/S.w,height/S.h)*cam.z;
const clamp=()=>{cam.z=Math.max(1,Math.min(6,cam.z));cam.x=Math.max(0,Math.min(S.w-width/scale(),cam.x));cam.y=Math.max(0,Math.min(S.h-height/scale(),cam.y));};
function home(){cam.z=1;cam.x=(S.w-width/scale())/2;cam.y=(S.h-height/scale())/2;clamp();}
function resize(){const w=canvas.clientWidth,h=canvas.clientHeight,d=Math.min(devicePixelRatio||1,2);if(w===width&&h===height&&d===dpr)return;const first=!width;width=w;height=h;dpr=d;canvas.width=Math.round(w*d);canvas.height=Math.round(h*d);first?home():clamp();}
const locs=new Map();function uniform(p,n){const key=n;let map=locs.get(p);if(!map)locs.set(p,map=new Map());if(!map.has(key))map.set(key,gl.getUniformLocation(p,n));return map.get(key);}
function camera(p){gl.uniform4f(uniform(p,'camera'),cam.x,cam.y,scale()/width,scale()/height);}
function draw(m){gl.bindVertexArray(m.vao);gl.drawArrays(gl.TRIANGLES,0,m.count);}
const BW=960,BH=540;
function target(depthBuffer=false){const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,BW,BH,0,gl.RGBA,gl.UNSIGNED_BYTE,null);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);const fbo=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,tex,0);if(depthBuffer){const rb=gl.createRenderbuffer();gl.bindRenderbuffer(gl.RENDERBUFFER,rb);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT16,BW,BH);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,rb);}if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Incomplete glow buffer');return{tex,fbo};}
const glow=target(true),temp=target(),wide=target();
const painter=createPainter(gl,{program,transform,camera,uniform});
const hubLights=createHubLights({depth,buildings:S.buildings,point:(id,p)=>growth.point(id,p)});
const hologram=await createPlazaHologram(gl,{program,transform,camera,uniform,center:S.sq,base});
const flight={...createFlightPlanner(S.buildings),settle};
function scene(emission){gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.BLEND);gl.clearColor(0,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);if(!emission){gl.disable(gl.DEPTH_TEST);gl.useProgram(ground);camera(ground);gl.bindVertexArray(empty);gl.drawArrays(gl.TRIANGLES,0,3);gl.enable(gl.DEPTH_TEST);}
 gl.useProgram(solid);camera(solid);gl.uniform2f(uniform(solid,'objectOffset'),0,0);gl.uniform1f(uniform(solid,'objectGain'),1);gl.uniform1f(uniform(solid,'emission'),emission);gl.uniform1f(uniform(solid,'terrainFade'),1);draw(terrainMesh);
gl.useProgram(reflectionProgram);camera(reflectionProgram);gl.uniform1f(uniform(reflectionProgram,'time'),waterMotion.matches?0:time);gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE);gl.depthMask(false);gl.bindVertexArray(reflectionVao);gl.drawArrays(gl.TRIANGLES,0,reflectionVertices.length/10);if(responseWaterCount){gl.bindVertexArray(responseWaterVao);gl.drawArrays(gl.TRIANGLES,0,responseWaterCount);}gl.depthMask(true);gl.disable(gl.BLEND);
gl.useProgram(roadProgram);camera(roadProgram);gl.uniform1fv(uniform(roadProgram,'traffic'),roadTraffic);gl.uniform1f(uniform(roadProgram,'emission'),emission);gl.uniform1f(uniform(roadProgram,'terrainFade'),1);draw(roadsMesh);gl.useProgram(solid);gl.uniform1f(uniform(solid,'terrainFade'),0);draw(growthMesh||cityMesh);if(hubMesh)draw(hubMesh);if(auto)draw(padMesh);
 gl.useProgram(win);camera(win);gl.uniform1f(uniform(win,'time'),time);gl.uniform1f(uniform(win,'impulse'),impulse);gl.uniform1f(uniform(win,'emission'),emission);gl.bindVertexArray(winVao);gl.drawArraysInstanced(gl.TRIANGLES,0,6,windows.length);if(workCount){gl.bindVertexArray(workVao);gl.drawArraysInstanced(gl.TRIANGLES,0,6,workCount);if(!emission){gl.useProgram(workHalo);camera(workHalo);gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE);gl.depthMask(false);gl.drawArraysInstanced(gl.TRIANGLES,0,6,workCount);gl.depthMask(true);gl.disable(gl.BLEND);gl.useProgram(win);}}
 gl.useProgram(adprogram);camera(adprogram);gl.uniform1f(uniform(adprogram,'emission'),emission);for(const ad of ads){const frame=Math.floor((time+ad.index*.71)/(3.8+ad.index*.137))%4;gl.bindTexture(gl.TEXTURE_2D,adTextures.get(`${ad.tall}:${(ad.tall?TALL:WIDE)[frame]}`));gl.bindVertexArray(ad.vao);gl.drawArrays(gl.TRIANGLES,0,6);}
hologram.draw(time,emission);
painter.draw(emission);
}
function full(p,tex){gl.useProgram(p);gl.bindVertexArray(empty);gl.bindTexture(gl.TEXTURE_2D,tex);gl.drawArrays(gl.TRIANGLES,0,3);}
function bloom(){gl.bindFramebuffer(gl.FRAMEBUFFER,glow.fbo);gl.viewport(0,0,BW,BH);scene(1);gl.disable(gl.DEPTH_TEST);gl.useProgram(fogProgram);camera(fogProgram);gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE);gl.bindVertexArray(fogVao);gl.drawArrays(gl.TRIANGLES,0,fogVertices.length/8);gl.disable(gl.BLEND);gl.bindFramebuffer(gl.FRAMEBUFFER,temp.fbo);gl.useProgram(blur);gl.uniform2f(uniform(blur,'direction'),2/BW,0);full(blur,glow.tex);gl.bindFramebuffer(gl.FRAMEBUFFER,glow.fbo);gl.uniform2f(uniform(blur,'direction'),0,2/BH);full(blur,temp.tex);
gl.bindFramebuffer(gl.FRAMEBUFFER,wide.fbo);gl.uniform2f(uniform(blur,'direction'),10/BW,0);full(blur,glow.tex);
gl.bindFramebuffer(gl.FRAMEBUFFER,temp.fbo);gl.uniform2f(uniform(blur,'direction'),0,10/BH);full(blur,wide.tex);
}
const owner=S.pads.filter(p=>p[3]==='hero').sort((a,b)=>b[4]-a[4])[0].slice(0,2).map((v,i)=>v*.75-(i?40:0));
let wallsFn=createArrivalWalls(S.buildings);const arrivalWalls=b=>wallsFn(hubShape(b));
const roadLengths=new Float32Array(roadTraffic.length);for(const r of roadPaths)roadLengths[r.gpuId]=r.p.reduce((sum,p,i)=>sum+(i?Math.hypot(p[0]-r.p[i-1][0],p[1]-r.p[i-1][1]):0),0);
const buildingAt=(x,y)=>S.buildings.reduce((best,b)=>Math.hypot(b.ground[0]-x,b.ground[1]-y)<Math.hypot(best.ground[0]-x,best.ground[1]-y)?b:best,S.buildings[0]);
const selectedCache=new Map();function selectedMesh(id){if(selectedCache.has(id))return selectedCache.get(id);const out=[];for(const c of S.commands)if(S.owners[c[3]]===id){if(c[0]==='p')polygon(out,c[1].map(p=>growth.point(id,p)),c[2],depth(c[3])-.000002);else line(out,c[1].map(p=>growth.point(id,p)),c[2],depth(c[3])-.000002,c[4]);}const m=mesh(out);m.bounds=[Infinity,Infinity,-Infinity,-Infinity];for(let i=0;i<out.length;i+=6){m.bounds[0]=Math.min(m.bounds[0],out[i]);m.bounds[1]=Math.min(m.bounds[1],out[i+1]);m.bounds[2]=Math.max(m.bounds[2],out[i]);m.bounds[3]=Math.max(m.bounds[3],out[i+1]);}selectedCache.set(id,m);return m;}
let selections=[];const selectionRenderer=createSelection(gl,{program,transform,camera,cityMesh,draw,selectedMesh,getView:()=>({x:cam.x,y:cam.y,k:scale()*dpr})});
const growthGeometry=await fetch(new URL('growth-plots.json',base)).then(r=>{if(!r.ok)throw Error('growth-plots.json');return r.json();});
const growth=createGrowthModel(S,growthGeometry);let growthMesh=null,growthWave=null,growthData=null,hubMesh=null,commandIndex=null;
function setGrowth(data,enabled,tone=true){
 growth.set(data,enabled,tone);growthWave=null;hubLights.reset();
 const padColours=padVertices.slice();
 let offset=0;
 for(const site of padSites){const id=S.owners[Math.floor(site.layer)],count=(site.type==='D'?6:4)*30;for(let i=0;i<count;i++){const k=(offset+i)*6+3,c=growth.lightColour(id,padVertices.slice(k,k+3).map(v=>v*255));padColours.splice(k,3,...c.map(v=>v/255));}offset+=count;}
 gl.bindBuffer(gl.ARRAY_BUFFER,padMesh.buffer);gl.bufferSubData(gl.ARRAY_BUFFER,0,new Float32Array(padColours));
 for(const m of selectedCache.values()){gl.deleteVertexArray(m.vao);gl.deleteBuffer(m.buffer);}selectedCache.clear();
 growthData=data;buildCityMesh();
 const positions=[];for(const w of windows){const q=w[0].map(p=>growth.point(S.owners[Math.floor(w[2])],p));positions.push(...q[0],depth(w[2])-.000002,q[1][0]-q[0][0],q[1][1]-q[0][1],q[3][0]-q[0][0],q[3][1]-q[0][1]);}
 gl.bindBuffer(gl.ARRAY_BUFFER,instanceBuffer);gl.bufferSubData(gl.ARRAY_BUFFER,0,new Float32Array(positions));
}
const freeMesh=m=>{if(m){gl.deleteVertexArray(m.vao);gl.deleteBuffer(m.buffer);}return null;};
function cityCommand(out,c){const id=S.owners[c[3]],pts=c[1].map(p=>growth.point(id,p)),color=signLayers.has(c[3])?c[2]:growth.material(id,c[2]);if(c[0]==='p')polygon(out,pts,color,depth(c[3]));else line(out,pts,color,depth(c[3]),c[4]);}
// Hub buildings are drawn from their own small mesh, so a rise rebuilds one building, not the city.
function buildCityMesh(){growthMesh=freeMesh(growthMesh);if(growthData||hubIds.size){const out=[];for(const c of S.commands)if(!hubIds.has(S.owners[c[3]])&&!fadeIds.has(S.owners[c[3]]))cityCommand(out,c);growthMesh=mesh(out);}buildHubMesh();}
function buildHubMesh(){hubMesh=freeMesh(hubMesh);if(!hubIds.size&&!fadeIds.size)return;const out=[];for(const id of new Set([...hubIds,...fadeIds]))for(const c of indexCommands().commands.get(id)||[])cityCommand(out,c);hubMesh=mesh(out);}
function indexCommands(){if(!commandIndex){commandIndex={commands:new Map(),windows:new Map()};const add=(m,id,v)=>{if(!m.has(id))m.set(id,[]);m.get(id).push(v);};for(const c of S.commands)add(commandIndex.commands,S.owners[c[3]],c);windows.forEach((w,i)=>add(commandIndex.windows,S.owners[Math.floor(w[2])],i));}return commandIndex;}
// Territory growth (growth.js fadePlan): changed plots cross-fade from the previous owner's tint. While a plan runs,
// their buildings come from the small hub mesh, rebuilt at most every 120 ms; the city mesh is rebuilt at start and end.
const fadeIds=new Set(),plotFade=new Map();let fadeShown=null,fadeMeshAt=0;
function growthFade(now){const plan=growthWave?.plan||null,byBuilding=new Map();plotFade.clear();
 for(const p of plan||[]){const k=fadeLevel(p,growthWave.t),b=growth.plots.get(p.plot)?.building;plotFade.set(p.plot,{from:p.from,k});if(b!=null)byBuilding.set(b,{from:p.from,k});}
 growth.fade(byBuilding);
 if(plan!==fadeShown){fadeShown=plan;fadeIds.clear();for(const id of byBuilding.keys())if(!hubIds.has(id))fadeIds.add(id);fadeMeshAt=now;if(growthData||hubIds.size)buildCityMesh();return;}
 if(fadeIds.size&&now-fadeMeshAt>=120){fadeMeshAt=now;buildHubMesh();}}
// Hub height: the building grows with its session context (hubs.js hubHeightFactor). The mesh, windows, selection and
// hub lights follow growth.point every frame of a rise; flight clearance and arrival walls are rebuilt once per
// accepted change (a rise at its start, a fall at its end, so clearance never sits below the roof), and a hub accepts
// a new height at most every 10 s. Reduced motion switches at once.
const HUB_RISE_MS=3000,HUB_MIN_GAP=10000,hubIds=new Set(),hubState=new Map(),hubLifts=new Map(),clearK=new Map();
const hubStats={cityMeshMs:[],clearanceMs:[],wallsMs:[],frameMs:[]},hubMotion=matchMedia('(prefers-reduced-motion: reduce)');
const wallHeight=b=>Math.max(0,...b.surfaces.filter(f=>f.kind==='wall').map(f=>f.points[1][1]-f.points[2][1]));
const heroPad=S.pads.filter(p=>p[3]==='hero').sort((a,b)=>b[4]-a[4])[0],ownerHeight=wallHeight(buildingAt(heroPad[5][0]*.75,heroPad[5][1]*.75-40));
function hubShape(b){return b&&clearK.has(b.id)?scaledBuilding(b,clearK.get(b.id)):b;}
function hubClearance(id,k){const t=performance.now();raiseClearance(flight.obstacles,growth.buildings.get(id),k);clearK.set(id,k);hubStats.clearanceMs.push(performance.now()-t);return true;}
function placeHubWindows(ids){gl.bindBuffer(gl.ARRAY_BUFFER,instanceBuffer);for(const id of ids)for(const i of commandIndex.windows.get(id)||[]){const w=windows[i],q=w[0].map(p=>growth.point(id,p));gl.bufferSubData(gl.ARRAY_BUFFER,i*28,new Float32Array([...q[0],depth(w[2])-.000002,q[1][0]-q[0][0],q[1][1]-q[0][1],q[3][0]-q[0][0],q[3][1]-q[0][1]]));}}
// list: [{building, ctx, open}] for every placed hub; a building missing from the list returns to 1.0.
function hubHeights(list,now=performance.now()){
 const targets=new Map();
 for(const h of list){const b=growth.buildings.get(h.building);if(!b||!scalableHub(b))continue;targets.set(b.id,Math.max(targets.get(b.id)||1,hubHeightFactor(h.ctx,{open:h.open!==false,height:wallHeight(b),ownerHeight})));}
 const started=performance.now(),moved=new Set(),fresh=[...targets].filter(([id,k])=>!hubState.has(id)&&k!==1);let walls=false;
 // First sight (page load, a hub placed later): the current height at once, no rise.
 if(fresh.length){indexCommands();
  for(const [id,k]of fresh){hubIds.add(id);hubState.set(id,{k,from:k,to:k,start:0,changed:now});moved.add(id);if(k!==1)walls=hubClearance(id,k);}
  for(const [id,k]of fresh)growth.setHubScale(id,k);const t=performance.now();buildCityMesh();hubStats.cityMeshMs.push(performance.now()-t);}
 for(const [id,s]of hubState){const target=targets.get(id)??1;
  if(target!==s.to&&now-s.changed>=HUB_MIN_GAP){s.from=s.k;s.to=target;s.changed=now;
   if(hubMotion.matches){s.k=target;s.start=0;moved.add(id);walls=hubClearance(id,target);}else{s.start=now;if(target>(clearK.get(id)??1))walls=hubClearance(id,target);}}
  if(s.start){const u=Math.min(1,(now-s.start)/HUB_RISE_MS);s.k=s.from+(s.to-s.from)*settle(u);moved.add(id);if(u>=1){s.k=s.to;s.start=0;if((clearK.get(id)??1)!==s.to)walls=hubClearance(id,s.to);}}}
 if(walls){const t=performance.now();wallsFn=createArrivalWalls(S.buildings.map(hubShape));hubStats.wallsMs.push(performance.now()-t);}
 if(!moved.size)return;
 for(const id of moved){const k=hubState.get(id).k;growth.setHubScale(id,k);hubLifts.set(id,wallHeight(growth.buildings.get(id))*(k-1));const m=selectedCache.get(id);if(m){freeMesh(m);selectedCache.delete(id);}}
 if(!fresh.length)buildHubMesh();placeHubWindows(moved);hubLights.reset();hubStats.frameMs.push(performance.now()-started);if(hubStats.frameMs.length>600)hubStats.frameMs.shift();
}
function growthGround(){if(!growth.enabled)return;const g=painter;g.save();g.globalCompositeOperation='lighter';
 for(const o of growth.snapshot?.plotOwners||[]){const e=growth.plotEntry(o.id);if(!e?.project||e.project.closed||(growth.districtTone&&(o.dark||e.project.light===0)))continue;const q=e.geometry.footprint,b=e.geometry,c=displayColour(e.project.colour),f=plotFade.get(o.id),k=f?f.k:1,was=f&&growth.project(f.from);g.depth=.935;
 if(was&&!was.closed&&k<1){g.fillStyle=displayColour(was.colour);g.globalAlpha=(.1+.14*(was.light??1))*(1-k);g.beginPath();q.forEach((p,i)=>i?g.lineTo(...p):g.moveTo(...p));g.closePath();g.fill();}
 g.fillStyle=c;g.globalAlpha=(o.dark?.025:.1+.14*e.project.light)*k;g.beginPath();q.forEach((p,i)=>i?g.lineTo(...p):g.moveTo(...p));g.closePath();g.fill();g.globalAlpha=(o.dark?.025:.08*e.project.light)*k;g.fillStyle=g.createRadialGradient(b.ground[0],b.ground[1],0,b.ground[0],b.ground[1],15);g.fillStyle.addColorStop(0,c);g.fillStyle.addColorStop(1,'rgba(0,0,0,0)');g.fillRect(b.ground[0]-15,b.ground[1]-8,30,16);
 }
 g.restore();
}
const samples=[];let record=false,last=0,visibility=[];
function frame(t,view){if(lost)return;resize();if(view)Object.assign(cam,view);gl.bindBuffer(gl.ARRAY_BUFFER,stateBuffer);growthFade(t);gl.bufferSubData(gl.ARRAY_BUFFER,0,growth.enabled?growth.windows(stateData,windows):stateData);growthGround();hubLights.draw(painter,t);painter.upload();time=t/1000;if(record&&last)samples.push(t-last);last=t;bloom();gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,canvas.width,canvas.height);scene(0);gl.disable(gl.DEPTH_TEST);gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE);full(combine,glow.tex);full(combine,temp.tex);gl.disable(gl.BLEND);selectionRenderer.render(canvas.width,canvas.height,dpr,selections);if(auto)raf=requestAnimationFrame(frame);}
function zoomAt(x,y,f){const k=scale(),wx=cam.x+x/k,wy=cam.y+y/k;cam.z=Math.max(1,Math.min(6,cam.z*f));cam.x=wx-x/scale();cam.y=wy-y/scale();clamp();}
if(controls){canvas.addEventListener('wheel',e=>{e.preventDefault();zoomAt(e.clientX,e.clientY,Math.exp(-e.deltaY*(e.ctrlKey?.012:.0022)));},{passive:false});
let drag=null;canvas.addEventListener('pointerdown',e=>{canvas.focus();canvas.setPointerCapture(e.pointerId);drag=[e.clientX,e.clientY];canvas.style.cursor='grabbing';});canvas.addEventListener('pointermove',e=>{if(!drag)return;cam.x-=(e.clientX-drag[0])/scale();cam.y-=(e.clientY-drag[1])/scale();drag=[e.clientX,e.clientY];clamp();});const release=()=>{drag=null;canvas.style.cursor='grab';};canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);canvas.addEventListener('lostpointercapture',release);canvas.addEventListener('dblclick',home);
}
function trigger(){impulse=time;gl.bindBuffer(gl.ARRAY_BUFFER,stateBuffer);for(let i=S.windows.length;i<windows.length;i++){if(windows[i][3]!==0)continue;stateData[i*4]=.25;stateData[i*4+1]=.9;stateData[i*4+2]=1;}gl.bufferSubData(gl.ARRAY_BUFFER,0,stateData);}
if(controls)addEventListener('keydown',e=>{if(e.code==='Space'){e.preventDefault();trigger();}if(e.code==='Home')home();});
for(const event of ['focus','blur'])addEventListener(event,()=>{if(record)visibility.push({time:performance.now(),event,state:document.visibilityState,focused:document.hasFocus()});});
document.addEventListener('visibilitychange',()=>{if(record)visibility.push({time:performance.now(),state:document.visibilityState});});canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();lost=true;cancelAnimationFrame(raf);error.textContent='Графический контекст потерян. Перезагрузите страницу.';});
gl.bindFramebuffer(gl.FRAMEBUFFER,null);
const api={setWorkWindows,writeWorkWindows,hubs:hubLights,hubHeights,hubLifts,hubStats,get hubFactors(){return new Map([...hubState].map(([id,s])=>[id,s.k]));},createCaptureResponse:live=>createCaptureResponse(live,{roads:responseRoadPaths,water:responseWater}),createCelebrations,get responseWaterCount(){return responseWaterCount;},flight,growth,setGrowth,streetPaths:responseRoadPaths,get growthWave(){return growthWave;},set growthWave(value){growthWave=value;},get selectionCount(){return selections.length;},buildingAt,arrivalWalls,arrivalFrame,landing,updateRoadTraffic(counts,dt){updateRoadTraffic(roadTraffic,counts,roadLengths,dt);},select(objects){selections=objects;},roadTraffic,roadPaths,render:frame,painter,scene:S,windowState:stateData,baseWindowCount:S.windows.length,windowCount:windows.length,depth,roofDepth(x,y){const roof=roofFaces.reduce((best,r)=>{const q=r[1],d=Math.hypot((q[0][0]+q[2][0])/2-x,(q[0][1]+q[2][1])/2-y);return !best||d<best.d?{r,d}:best;},null);return depth(roof.r[3]+.25);},cam,home,trigger,view(z,x,y){cam.z=z;cam.x=x;cam.y=y;clamp();},startRecording(){samples.length=0;visibility=[{time:performance.now(),state:document.visibilityState}];record=true;last=0;},stopRecording(){record=false;return{frames:[...samples],visibility,viewport:[width,height],drawingBuffer:[canvas.width,canvas.height],dpr,focused:document.hasFocus()};},stats:{landingPads:padSites,windows:windows.length,triangles:(tris.length+terrain.length)/18+roadLight.length/27,ads:ads.length,glow:[BW,BH],samples:gl.getParameter(gl.SAMPLES),renderer:gl.getParameter(gl.RENDERER)},ready:true};
// Smoothed land contours: celebrations mirror bursts across the shoreline below them.
api.shore=shoreContours;
api.createDistrictWork=createDistrictWork;
resize();if(auto)raf=requestAnimationFrame(frame);return api;
}
