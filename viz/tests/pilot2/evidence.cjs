// Assemble review evidence from actual browser frames, without retouching them.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {createCanvas,loadImage}=require('../../assets/kit/node_modules/@napi-rs/canvas');
const root=path.resolve(__dirname,'../../..'),out=process.argv[2]||'./work/shots';
const pixels=async name=>{const im=await loadImage(path.join(out,name)),c=createCanvas(im.width,im.height);c.getContext('2d').drawImage(im,0,0);return c.getContext('2d').getImageData(0,0,im.width,im.height).data;};
(async()=>{
 const before=await pixels('pilot2-parity-before.png'),after=await pixels('pilot2-parity-after.png'),kitOff=await pixels('pilot2-parity-kit-without-map.png');
 let changed=0,changedKit=0;for(let i=0;i<before.length;i+=4){if(before.slice(i,i+4).some((v,j)=>v!==after[i+j]))changed++;if(after.slice(i,i+4).some((v,j)=>v!==kitOff[i+j]))changedKit++;}assert.equal(changed,0);assert.equal(changedKit,0);
 const c=createCanvas(3200,1048),x=c.getContext('2d');x.fillStyle='#080f1d';x.fillRect(0,0,c.width,c.height);x.fillStyle='#cce1f9';x.font='22px monospace';x.fillText('BOXES / same camera / 30 active fixture workers',25,31);x.fillText('PILOT 2 / styles + notable models / same camera',1625,31);
 for(const [name,xx]of [['pilot2-boxes.png',0],['pilot2-overview.png',1600]])x.drawImage(await loadImage(path.join(out,name)),xx,48);
 fs.writeFileSync(path.join(out,'pilot2-compare.png'),c.toBuffer('image/png'));
 const files=['viz/viz.html','viz/assets/map/mapcity.js','viz/assets/map/landmarks.json','viz/assets/kit/styles.js','viz/assets/kit/kit.json','viz/assets/kit/styles-base.png','viz/assets/kit/styles-emissive.png','viz/assets/kit/_raw/pilot2-styles.png','viz/assets/notable/_build/models.js','viz/assets/notable/manifest.json'];
 const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
 const result={parity:{baseline:'d4dc085183a06464b781111b4bcd7063b8d17ef6',changedPixels:changed,kitWithoutMapChangedPixels:changedKit},source:Object.fromEntries(files.map(f=>[f,sha(path.join(root,f))])),frames:Object.fromEntries(fs.readdirSync(out).filter(f=>f.startsWith('pilot2-')&&f.endsWith('.png')).map(f=>[f,sha(path.join(out,f))]))};
 fs.writeFileSync(path.join(out,'pilot2-evidence.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result.parity));
})().catch(e=>{console.error(e);process.exitCode=1;});
