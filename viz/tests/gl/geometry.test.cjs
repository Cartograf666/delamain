const assert=require('node:assert/strict'),fs=require('node:fs');const s=JSON.parse(fs.readFileSync(__dirname+'/../../assets/gl/scene.json'));
for(const e of s.equipment){assert.equal(e.faces.length,3);for(const f of e.faces)assert.equal(f.length,4);assert(e.layers[0]<e.layers[1]&&e.layers[1]<e.layers[2]);assert(!s.landingPads.some(p=>Math.hypot(e.roofCenter[0]-p.p[0],e.roofCenter[1]-p.p[1])<.2));}
for(const p of s.landingPads)assert(!s.commands.some(c=>c[0]==='l'&&c[1].length===2&&Math.hypot(c[1][0][0]-p.p[0],c[1][0][1]-p.p[1])<.2&&Math.abs(c[1][0][0]-c[1][1][0])<.01&&c[1][1][1]<c[1][0][1]));
assert(s.equipment.length>1000);assert.equal(s.landingPads.length,58);console.log('PASS: complete three-face roof equipment; all landing roofs clear');
