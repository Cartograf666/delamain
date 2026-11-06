import * as THREE from './node_modules/three/build/three.module.js';
// Build-time only. Coordinates use map grid x/z and projected vertical pixels.
// Camera pitch 30 degrees: screen=(x-z, (x+z)/2-height). No perspective or post-warp.
const specs={station:{footprint:[52,30],height:29},dome:{footprint:[36,36],height:43},spire:{footprint:[24,24],height:106}};
const colors={stone:0x7794b2,edge:0x9ebad1,dark:0x244965,glass:0x285c8d,roof:0x698fae};
function model(id){
 const root=new THREE.Group(),panes=[];root.scale.y=1/Math.sqrt(1.5);
 const mat=(color)=>new THREE.MeshLambertMaterial({color,side:THREE.DoubleSide});const materials=Object.fromEntries(Object.entries(colors).map(([k,c])=>[k,mat(c)]));
 function mesh(g,m,x=0,y=0,z=0){const a=new THREE.Mesh(g,typeof m==='string'?materials[m]:m);a.position.set(x,y,z);root.add(a);return a;}
 const box=(x,y,z,w,h,d,m)=>mesh(new THREE.BoxGeometry(w,h,d),m,x,y,z);
 function pane(x,y,z,w,h,d,n){const a=box(x,y,z,w,h,d,'glass');a.userData.pane=panes.length;a.userData.threshold=25*(1+(n%4));panes.push(a);return a;}
 function tube(points,r,m){return mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),Math.max(12,points.length*3),r,5,false),m);}
 if(id==='station'){
  // Three-bay terminal: clear barrel vault, repeated structural ribs, side platforms.
  box(0,1,0,52,2,30,'dark');box(0,5,-11.5,50,8,6,'stone');box(0,5,11.5,50,8,6,'stone');
  for(const z of [-11.5,11.5]){box(0,9.4,z,51,.8,6.7,'edge');for(let x=-22;x<=22;x+=5.5){pane(x,5,z+3.05,3.8,4,.12,Math.round(x+22));pane(x,5,z-3.05,3.8,4,.12,Math.round(x+23));}}
  // Vault runs along X; section is elliptical, supported by the side wings.
  const vault=(x,z,y)=>[x,y,z];
  const positions=[],indices=[];const N=40;
  for(let i=0;i<=N;i++){const a=Math.PI*i/N;for(const x of [-24,24])positions.push(...vault(x,9*Math.cos(a),10+17*Math.sin(a)));}
  for(let i=0;i<N;i++){const j=i*2;indices.push(j,j+1,j+2,j+1,j+3,j+2);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();const roof=materials.roof.clone();roof.side=THREE.DoubleSide;mesh(g,roof);
  for(let x=-24;x<=24;x+=6){const points=[];for(let i=0;i<=24;i++){const a=Math.PI*i/24;points.push(vault(x,9*Math.cos(a),10+17*Math.sin(a)));}tube(points,.38,'edge');}
  for(const a of [.25,.5,.75].map(v=>v*Math.PI))tube([vault(-24,9*Math.cos(a),10+17*Math.sin(a)),vault(24,9*Math.cos(a),10+17*Math.sin(a))],.22,'stone');
  for(const x of [-24.1,24.1]){for(let z=-7.5;z<=7.5;z+=3){const height=15*Math.sqrt(1-(z/9)**2);pane(x,10+height/2,z,.15,height,2.3,Math.round(z+8));}box(x,9.7,0,.8,.7,19,'edge');}
  // Two entrance canopies and paired pylons give the terminal an identifiable frontage.
  for(const x of [-25.2,25.2]){box(x,8,0,1.2,14,1.2,'stone');box(x,15.2,0,1.5,.6,3,'edge');}
 }else if(id==='dome'){
  box(0,1,0,36,2,36,'dark');box(0,6,0,32,10,32,'stone');box(0,11.5,0,33,1,33,'edge');
  for(const side of [-1,1])for(let t=-12;t<=12;t+=6){pane(t,6,side*16.1,3.8,5,.16,t+12);pane(side*16.1,6,t,.16,5,3.8,t+13);box(t,6,side*16.5,.75,10,1,'edge');box(side*16.5,6,t,1,10,.75,'edge');}
  const drum=mesh(new THREE.CylinderGeometry(12.5,13.5,8,48), 'stone',0,16,0);
  for(let i=0;i<20;i++){const a=i*Math.PI/10,x=Math.cos(a)*12.9,z=Math.sin(a)*12.9;const p=pane(x,16,z,2,4,.2,i);p.rotation.y=-a+Math.PI/2;}
  mesh(new THREE.CylinderGeometry(13.4,13.4,1,64),'edge',0,20,0);
  mesh(new THREE.SphereGeometry(13,48,24,0,Math.PI*2,0,Math.PI/2),'roof',0,20.5,0).scale.y=1.4;
  for(let k=0;k<16;k++){const a=k*Math.PI/8,points=[];for(let i=0;i<=24;i++){const t=i*Math.PI/48;points.push([13.1*Math.sin(t)*Math.cos(a),20.5+18.3*Math.cos(t),13.1*Math.sin(t)*Math.sin(a)]);}tube(points,.18,'edge');}
  mesh(new THREE.CylinderGeometry(2.2,2.6,3,16),'stone',0,39,0);mesh(new THREE.ConeGeometry(2.7,2.5,16),'edge',0,41.5,0);
  for(const z of [-17,17]){box(0,1.8,z,18,1,2,'edge');box(0,2.5,z,14,.5,2,'stone');}
 }else{
  // Tapered twisting envelope. Each floor follows the same continuous profile;
  // vertical ribs curve with it, no stack of rotated boxes.
  const floors=24,ring=(h,i)=>{const t=h/100,r=10*(1-.45*t),a=i*Math.PI/2+Math.PI/4+t*.72;return [r*Math.cos(a),h,r*Math.sin(a)];};
  const pos=[],idx=[];for(let j=0;j<=floors;j++)for(let i=0;i<4;i++)pos.push(...ring(j*100/floors,i));
  for(let j=0;j<floors;j++)for(let i=0;i<4;i++){const a=j*4+i,b=j*4+(i+1)%4;idx.push(a,b,a+4,b,b+4,a+4);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();mesh(g,'glass');
  for(let i=0;i<4;i++){const pts=[];for(let j=0;j<=floors;j++)pts.push(ring(j*100/floors,i));tube(pts,.35,'edge');}
  for(let j=1;j<floors;j++){
   const y=j*100/floors,points=Array.from({length:5},(_,i)=>ring(y,i%4));tube(points,.15,'stone');
   for(let i=0;i<4;i++){
    const a=ring(y+.7,i),b=ring(y+.7,(i+1)%4),c=ring(y+3,(i+1)%4),d=ring(y+3,i);
    for(let k=0;k<3;k++){
     const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t),lo=(k+.15)/3,hi=(k+.85)/3;
     const pp=[mix(a,b,lo),mix(a,b,hi),mix(d,c,hi),mix(d,c,lo)];
     // Glazing sits on a shallow outer skin; enough relief to clear the triangulated twisting shell.
     pp.forEach(p=>{p[0]*=1.045;p[2]*=1.045;});
     const pg=new THREE.BufferGeometry();pg.setAttribute('position',new THREE.Float32BufferAttribute(pp.flat(),3));pg.setIndex([0,1,2,0,2,3]);pg.computeVertexNormals();
     const m=mesh(pg,materials.glass.clone());m.material.side=THREE.DoubleSide;m.userData.pane=panes.length;m.userData.threshold=25*(1+((j*3+i+k)%4));panes.push(m);
    }
   }
  }
  box(0,1,0,24,2,24,'dark');box(0,2.7,0,21,1.4,21,'stone');
  const top=Array.from({length:5},(_,i)=>ring(100,i%4));tube(top,.3,'edge');
  // Split crown follows the twist and terminates at the declared height.
  for(let i=0;i<4;i++){const p=ring(100,i);tube([p,[p[0]*.8,106-i*.5,p[2]*.8]],.3,'stone');}
 }
 root.updateMatrixWorld(true);return {root,panes};
}
const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});renderer.setClearColor(0x000000,0);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.NoToneMapping;
const black=new THREE.MeshBasicMaterial({color:0x000000,side:THREE.DoubleSide});
window.buildNotables=()=>{
 const output={manifest:{version:1,three:'0.180.0',resolution:4,projection:'x-z, (x+z)/2-height',cameraPitch:30,models:{}},files:{}};
 for(const [id,spec]of Object.entries(specs)){
  const {root,panes}=model(id),scene=new THREE.Scene();scene.add(root);scene.add(new THREE.AmbientLight(0xb0d3ff,.72));const light=new THREE.DirectionalLight(0xe1f0ff,1.55);light.position.set(-60,100,160);scene.add(light);
  const [w,d]=spec.footprint,pad=4,width=(w+d+pad*2)*4,height=Math.ceil((spec.height+(w+d)/2+pad*2)*4),anchor=[width/2,(spec.height+(w+d)/4+pad)*4];
  renderer.setSize(width,height,false);
  const target=new THREE.Vector3(0,0,0),camera=new THREE.OrthographicCamera(-width/8/Math.SQRT2,width/8/Math.SQRT2,anchor[1]/4/Math.SQRT2,-(height/4-anchor[1]/4)/Math.SQRT2,.1,1000);
  camera.position.set(200,200*Math.sqrt(2/3),200);camera.lookAt(target);camera.updateMatrixWorld();
  renderer.render(scene,camera);output.files[id+'-base.png']=renderer.domElement.toDataURL();
  const originals=new Map();root.traverse(o=>{if(o.isMesh){originals.set(o,o.material);o.material=black;}});
  const states={};
  for(const level of [0,25,50,75,100]){
   for(const p of panes)p.material=p.userData.threshold<=level?new THREE.MeshBasicMaterial({color:0x6c93b5,side:THREE.DoubleSide}):black;
   renderer.render(scene,camera);
   // Keep only emission. Geometry is opaque black and still writes depth, so hidden panes never leak.
   const c=document.createElement('canvas');c.width=width;c.height=height;const cx=c.getContext('2d');cx.drawImage(renderer.domElement,0,0);const pixels=cx.getImageData(0,0,width,height);
   for(let i=0;i<pixels.data.length;i+=4)if(pixels.data[i]+pixels.data[i+1]+pixels.data[i+2]<4)pixels.data[i+3]=0;
   cx.putImageData(pixels,0,0);const file=`${id}-emissive-${level}.png`;output.files[file]=c.toDataURL();states[level]=file;
  }
  const bounds=new THREE.Box3().setFromObject(root);output.manifest.models[id]={...spec,size:[width,height],anchor,resolution:4,base:id+'-base.png',states,windows:panes.length,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},projectionControl:[[0,0,0],[10,0,0],[0,0,10],[0,10/Math.sqrt(1.5),0]].map(p=>{const v=new THREE.Vector3(...p).project(camera);return [(v.x+1)*width/2,(1-v.y)*height/2];})};
 }
 renderer.dispose();return output;
};
