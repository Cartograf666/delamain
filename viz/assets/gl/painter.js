// Small vector-command adapter for the accepted prototype's foreground drawing.
// Paths become GPU triangles; gradients are analytic fragment shaders, never Canvas rasters.
export function createPainter(gl, H) {
 const {program,transform,camera,uniform}=H;
 const p=program(`#version 300 es
 precision highp float;layout(location=0)in vec3 position;layout(location=1)in vec4 color;layout(location=2)in vec2 local;layout(location=3)in float kind;${transform}out vec4 col;out vec2 uv;flat out float mode;void main(){gl_Position=project(position);col=color;uv=local;mode=kind;}`,`#version 300 es
 precision highp float;in vec4 col;in vec2 uv;flat in float mode;uniform sampler2D art;out vec4 outColor;
// Advected value noise: independent octaves break up the silhouette and interior.
float incidentHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float incidentNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(incidentHash(i),incidentHash(i+vec2(1,0)),f.x),mix(incidentHash(i+vec2(0,1)),incidentHash(i+1.),f.x),f.y);}
float incidentFbm(vec2 p){return .57*incidentNoise(p)+.28*incidentNoise(p*2.03+7.1)+.15*incidentNoise(p*4.11+19.7);}
void main(){vec4 c=col;
 if(mode==12.){
  float t=col.r,seed=col.g,y=uv.y;
  float drift=.29*y+sin(y*9.-t*.38+seed)*.095*y;
  vec2 q=vec2((uv.x-drift)*3.8+seed,y*5.-t*.29);
  float curl=incidentFbm(q+vec2(0,incidentNoise(q-t*.11)));
  float n=incidentFbm(q+vec2(curl*2.,-curl));
  float width=(.105+.34*sqrt(max(0.,y)))*(.90+.10*sin(y*21.-t*.8+seed));
  float body=1.-abs(uv.x-drift)/width+(n-.5)*1.35;
  float density=smoothstep(-.24,.65,body)*(.48+.52*n);
  float fade=smoothstep(0.,.12,y)*(1.-smoothstep(.50,1.,y));
  vec3 ash=vec3(mix(.13,.54,n));
  // col.b: fire light from below warms the plume's base (0 keeps plain grey).
  c.rgb=mix(ash,vec3(1.,.47,.18)*(.62+.55*n),col.b*.95*(1.-smoothstep(.02,.64,y)));c.a*=density*fade;
 }
 if(mode==1.){float r=length(uv);c.a*=pow(max(0.,1.-r),2.);}
 if(mode==2.)c.a*=clamp(1.-uv.y,0.,1.);
 if(mode==3.){float u=uv.x*2.-1.,v=1.-uv.y,v0=.1,sg=.13+.2*max(0.,v-v0)/(1.-v0),r2=v<v0?pow(u/.13,2.)+pow((v-v0)/.042,2.):pow(u/sg,2.);float top=pow(1.-max(0.,v-v0)/(1.-v0),1.7),edge=min(1.,(1.-abs(u))*5.),glow=exp(-r2/2.)*top*edge*edge,core=exp(-r2*3.2)*top;c.rgb=mix(c.rgb,vec3(1),core*.75);c.a*=min(1.,glow*.62+core*.28);}
 if(mode==4.)c*=texture(art,uv);
 if(mode==5.)c.a*=pow(clamp(uv.y,0.,1.),1.7);
 if(mode==6.){vec2 px=4./vec2(textureSize(art,0));float a=texture(art,uv).a,edge=0.;for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++)edge=max(edge,texture(art,uv+vec2(x,y)*px).a);c.a*=max(0.,edge-a);}
 if(mode==7.){float r=length(uv);c.a*=1.-smoothstep(1.-fwidth(r),1.,r);}
 if(mode==8.)c.a*=exp(-uv.y*uv.y*3.)*smoothstep(1.,.8,abs(uv.y));
 if(mode==10.)c.a*=exp(-dot(uv,uv)*3.)*smoothstep(1.,.8,length(uv));
 if(mode==9.)c.a*=1.-smoothstep(1.-max(fwidth(uv.y),.05),1.,abs(uv.y));if(c.a<.002)discard;outColor=c;}`);
 const vao=gl.createVertexArray(),vbo=gl.createBuffer();gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,vbo);gl.bufferData(gl.ARRAY_BUFFER,8*1024*1024,gl.DYNAMIC_DRAW);
 for(const [i,n,o]of [[0,3,0],[1,4,12],[2,2,28],[3,1,36]]){gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,n,gl.FLOAT,false,40,o);}
 let data=new Float32Array(2*1024*1024),used=0,batches=[],path=[],sub=null,ellipseShape=null,stack=[],m=[1,0,0,1,0,0];const textures=new Map(),colors=new Map();
 const color=s=>{if(Array.isArray(s))return s;if(colors.has(s))return colors.get(s);let c;if(s?.[0]==='#'){let h=s.slice(1);if(h.length===3)h=h.split('').map(x=>x+x).join('');c=[parseInt(h.slice(0,2),16)/255,parseInt(h.slice(2,4),16)/255,parseInt(h.slice(4,6),16)/255,1];}else{const v=String(s).match(/[\d.]+/g)?.map(Number)||[255,255,255];c=[v[0]/255,v[1]/255,v[2]/255,v[3]??1];}if(colors.size>2048)colors.clear();colors.set(s,c);return c;};
 const point=(x,y,t=m)=>[t[0]*x+t[2]*y+t[4],t[1]*x+t[3]*y+t[5]];
 const inverse=(p,t)=>{const d=t[0]*t[3]-t[1]*t[2],x=p[0]-t[4],y=p[1]-t[5];return[(x*t[3]-y*t[2])/d,(y*t[0]-x*t[1])/d]};
 const texture=im=>{if(textures.has(im))return textures.get(im);const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,im);gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);textures.set(im,t);return t;};
 function emit(pts,style,uvs=null,tex=null,mode=0,varying=null){if(pts.length<3)return;let c=style?.stops?color(style.stops[0][1]):color(style);if(style?.stops){mode=style.kind;c=color(style.stops.reduce((a,b)=>color(b[1])[3]>color(a[1])[3]?b:a)[1]);}
 const alpha=c[3]*g.globalAlpha,blend=g.globalCompositeOperation==='lighter',glow=[1,2,3,8,10].includes(mode);let batch=batches.at(-1);if(!batch||batch.tex!==tex||batch.blend!==blend||batch.glow!==glow){batch={start:used/10,count:0,tex,blend,glow};batches.push(batch);}
 for(let j=1;j<pts.length-1;j++)for(const i of [0,j,j+1]){const q=pts[i];let uv=uvs?.[i]||[0,0];if(style?.stops){const v=inverse(q,style.matrix);if(mode===1)uv=[(v[0]-style.x)/style.r,(v[1]-style.y)/style.r];else{const dx=style.x1-style.x,dy=style.y1-style.y;uv=[0,((v[0]-style.x)*dx+(v[1]-style.y)*dy)/(dx*dx+dy*dy)];}}
 if(used+10>data.length)throw Error('Foreground geometry budget exceeded');const vc=varying?.[i]||c;data.set([q[0],q[1],g.depth,vc[0],vc[1],vc[2],vc[3]*g.globalAlpha,uv[0],uv[1],mode],used);used+=10;batch.count++;}}
 const gradient=(kind,x,y,r,x1,y1)=>({kind,x,y,r,x1,y1,matrix:[...m],stops:[],addColorStop(t,c){this.stops.push([t,c]);}});
 const g={depth:-.97,fillStyle:'#fff',strokeStyle:'#fff',lineWidth:1,globalAlpha:1,globalCompositeOperation:'source-over',lineCap:'butt',lineJoin:'round',
 reset(){used=0;batches=[];path=[];stack=[];m=[1,0,0,1,0,0];this.globalAlpha=1;this.depth=-.97;this.globalCompositeOperation='source-over';},
 save(){stack.push({m:[...m],fill:this.fillStyle,stroke:this.strokeStyle,width:this.lineWidth,alpha:this.globalAlpha,blend:this.globalCompositeOperation,depth:this.depth});},restore(){const s=stack.pop();if(!s)throw Error('Unbalanced GPU paint restore');m=s.m;this.fillStyle=s.fill;this.strokeStyle=s.stroke;this.lineWidth=s.width;this.globalAlpha=s.alpha;this.globalCompositeOperation=s.blend;this.depth=s.depth;},
 translate(x,y){m[4]+=m[0]*x+m[2]*y;m[5]+=m[1]*x+m[3]*y;},scale(x,y){m[0]*=x;m[1]*=x;m[2]*=y;m[3]*=y;},rotate(a){const c=Math.cos(a),s=Math.sin(a),[a0,b,c0,d]=m;m[0]=a0*c+c0*s;m[1]=b*c+d*s;m[2]=c0*c-a0*s;m[3]=d*c-b*s;},
 beginPath(){path=[];sub=null;ellipseShape=null;},moveTo(x,y){sub=[point(x,y)];path.push(sub);},lineTo(x,y){if(!sub)this.moveTo(x,y);else sub.push(point(x,y));},closePath(){if(sub?.length)sub.push(sub[0]);},
 arc(x,y,r,a,b){this.ellipse(x,y,r,r,0,a,b);},ellipse(x,y,rx,ry,rot,a,b){if(!sub&&b-a>=Math.PI*2-.01&&rot===0)ellipseShape=[point(x-rx,y-ry),point(x+rx,y-ry),point(x+rx,y+ry),point(x-rx,y+ry)];const n=Math.max(12,Math.ceil(Math.abs(b-a)*Math.max(6,Math.sqrt(Math.max(rx,ry))*4)));for(let i=0;i<=n;i++){const t=a+(b-a)*i/n,u=Math.cos(t)*rx,v=Math.sin(t)*ry,X=x+u*Math.cos(rot)-v*Math.sin(rot),Y=y+u*Math.sin(rot)+v*Math.cos(rot);if(!sub)this.moveTo(X,Y);else this.lineTo(X,Y);}},
 fill(){if(ellipseShape&&!this.fillStyle?.stops){emit(ellipseShape,this.fillStyle,[[-1,-1],[1,-1],[1,1],[-1,1]],null,7);return;}for(const poly of path)emit(poly,this.fillStyle);},
 ribbon(points,c,widths,alphas,mode=9){if(points.length<2)return;
 const isClosed=Math.hypot(points[0][0]-points.at(-1)[0],points[0][1]-points.at(-1)[1])<.001,source=points,ww=widths,aa=alphas,N=source.length-(isClosed?1:0),P=[],W=[],A=[];
 for(let i=0;i<N;i++){const p=source[i],j=(i+N-1)%N,k=(i+1)%N,a=source[j],b=source[k],l=Math.hypot(p[0]-a[0],p[1]-a[1]),r=Math.hypot(b[0]-p[0],b[1]-p[1]),dot=((p[0]-a[0])*(b[0]-p[0])+(p[1]-a[1])*(b[1]-p[1]))/(l*r||1),radius=Math.min(ww[i]*.65,l*.3,r*.3);
 if((!isClosed&&(i===0||i===N-1))||dot>.97||radius<.01){P.push(p);W.push(ww[i]);A.push(aa[i]);continue;}
 const u=[p[0]+(a[0]-p[0])*radius/l,p[1]+(a[1]-p[1])*radius/l],v=[p[0]+(b[0]-p[0])*radius/r,p[1]+(b[1]-p[1])*radius/r];for(let n=0;n<=4;n++){const t=n/4,q=1-t;P.push([q*q*u[0]+2*q*t*p[0]+t*t*v[0],q*q*u[1]+2*q*t*p[1]+t*t*v[1]]);W.push(ww[i]);A.push(aa[i]);}}
 if(isClosed){P.push(P[0]);W.push(W[0]);A.push(A[0]);}points=P;widths=W;alphas=A;const closed=Math.hypot(points[0][0]-points.at(-1)[0],points[0][1]-points.at(-1)[1])<.001,n=points.length,rgba=color(c),sides=points.map((p,i)=>{const a=points[i?i-1:closed?n-2:0],b=points[i<n-1?i+1:closed?1:n-1],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy)||1,w=widths[i]/2;return[[p[0]-dy/len*w,p[1]+dx/len*w],[p[0]+dy/len*w,p[1]-dx/len*w]];});
 for(let i=1;i<n;i++){const a=rgba.slice(),b=rgba.slice();a[3]*=alphas[i-1];b[3]*=alphas[i];emit([sides[i-1][0],sides[i][0],sides[i][1],sides[i-1][1]],c,[[0,-1],[1,-1],[1,1],[0,1]],null,mode,[a,b,b,a]);}
 if(!closed)for(const end of [false,true]){const i=end?n-1:0,p=points[i],q=points[end?n-2:1],angle=Math.atan2(p[1]-q[1],p[0]-q[0]),w=widths[i]/2;if(w<.01)continue;const cap=[p,...Array.from({length:13},(_,j)=>[p[0]+Math.cos(angle-Math.PI/2+j*Math.PI/12)*w,p[1]+Math.sin(angle-Math.PI/2+j*Math.PI/12)*w])],cc=rgba.slice();cc[3]*=alphas[i];if(mode===8){const uv=[[0,0],...Array.from({length:13},(_,j)=>[Math.cos(angle-Math.PI/2+j*Math.PI/12),Math.sin(angle-Math.PI/2+j*Math.PI/12)])];emit(cap,cc,uv,null,10);}else emit(cap,cc);}},
 stroke(mode=this.lineWidth>2&&color(this.strokeStyle)[3]<.5?8:9){for(const poly of path)this.ribbon(poly,this.strokeStyle,poly.map(()=>this.lineWidth*Math.hypot(m[0],m[1])),poly.map(()=>1),mode);},
 trail(points,c,width){if(points.length<2)return;const pts=points.map((p,i)=>i===0||i===points.length-1?p:[(points[i-1][0]+p[0]*2+points[i+1][0])/4,(points[i-1][1]+p[1]*2+points[i+1][1])/4]),t=pts.map((_,i)=>i/(pts.length-1));this.ribbon(pts,c,t.map(k=>width*k*3),t.map(k=>k*k*.12),8);this.ribbon(pts,c,t.map(k=>width*k),t.map(k=>k*k*.72));},
 uplight(points,c,gain,gains=null){const color=[...c.map(v=>v/255),gain];emit(points,color,[[0,1],[1,1],[1,0],[0,0]],null,5,gains?.map(k=>[...color.slice(0,3),gain*k]));},
 // Smoke stays at its emitting depth; buildings in front occlude its base. warm (0..1) tints the base by fire light.
 smoke(x,y,w,h,time,seed,alpha,warm=0){emit([point(x-w/2,y),point(x+w/2,y),point(x+w/2,y-h),point(x-w/2,y-h)],[time,seed,warm,alpha],[[-1,0],[1,0],[1,1],[-1,1]],null,12);},
 drawImageOutline(im,x,y,w,h,c){emit([point(x,y),point(x+w,y),point(x+w,y+h),point(x,y+h)],c,[[0,0],[1,0],[1,1],[0,1]],texture(im),6);},
 fillRect(x,y,w,h){emit([point(x,y),point(x+w,y),point(x+w,y+h),point(x,y+h)],this.fillStyle);},
 createRadialGradient(x,y,r0,x1,y1,r){return gradient(1,x1,y1,r);},createLinearGradient(x,y,x1,y1){return gradient(2,x,y,0,x1,y1);},
 drawImage(im,x,y,w=im.width,h=im.height){emit([point(x,y),point(x+w,y),point(x+w,y+h),point(x,y+h)],im.gpuBeam?im.gpuBeam.map(v=>v/255).concat(1):[1,1,1,1],[[0,0],[1,0],[1,1],[0,1]],im.gpuBeam?null:texture(im),im.gpuBeam?3:4);},
 upload(){gl.bindBuffer(gl.ARRAY_BUFFER,vbo);gl.bufferSubData(gl.ARRAY_BUFFER,0,data.subarray(0,used));},
 draw(emission=0){gl.useProgram(p);camera(p);gl.bindVertexArray(vao);gl.enable(gl.DEPTH_TEST);gl.depthMask(false);gl.enable(gl.BLEND);for(const b of batches){if(b.glow!==Boolean(emission))continue;gl.blendFunc(gl.SRC_ALPHA,b.blend?gl.ONE:gl.ONE_MINUS_SRC_ALPHA);gl.bindTexture(gl.TEXTURE_2D,b.tex);gl.drawArrays(gl.TRIANGLES,b.start,b.count);}gl.depthMask(true);gl.disable(gl.BLEND);},get vertices(){return used/10;},preload: texture};
 return g;
}
