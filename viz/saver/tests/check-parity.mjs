// Runs the actual generator from viz.html in V8, then the actual Swift CityModel.
// No browser packages or network access; numeric output normalised to 1e-9 world units.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import os from 'node:os';
import {execFileSync, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const dir=path.dirname(fileURLToPath(import.meta.url)), viz=path.resolve(dir,'../..');
const out=process.argv[2] || fs.mkdtempSync(path.join(os.tmpdir(),'hub-viz-parity-'));
fs.mkdirSync(out,{recursive:true});
const html=fs.readFileSync(path.join(viz,'viz.html'),'utf8');
const generator=html.slice(html.indexOf('function hash(s)'),html.indexOf('// ---- model '));
const page=vm.runInNewContext(generator+`
buildCity();
const sample=G.lots.filter(l=>!l.landmark&&!l.owner).slice(0,200).concat(G.lots.filter(l=>l.landmark));
sample.map(l=>[G.lots.indexOf(l),l.landmark?'landmark':'block',...[l.x,l.y,l.size,l.tall,l.brightness,l.scale].map(n=>n.toFixed(9)),l.flip?'1':'0',l.sprite].join('\\t')).join('\\n')+'\\n';`);
fs.writeFileSync(path.join(out,'page.tsv'),page);
execFileSync('/usr/bin/swiftc',['-O',path.join(viz,'saver/CityModel.swift'),path.join(dir,'model-dump.swift'),'-o',path.join(out,'model-dump')]);
const native=execFileSync(path.join(out,'model-dump'),{encoding:'utf8'});
fs.writeFileSync(path.join(out,'swift.tsv'),native);
const result=spawnSync('/usr/bin/diff',['-u',path.join(out,'page.tsv'),path.join(out,'swift.tsv')],{encoding:'utf8'});
fs.writeFileSync(path.join(out,'parity.diff'),result.stdout);
if(result.status!==0){process.stdout.write(result.stdout);process.stderr.write(result.stderr);process.exit(result.status||1)}
console.log(`PASS: ${page.trim().split('\n').length} rows (first 200 blocks and all landmarks); empty ${out}/parity.diff`);
