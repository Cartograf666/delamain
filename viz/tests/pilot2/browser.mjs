// Owned, attached Chrome and HTTP lifecycle. No live home or shared profile.
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import http from 'node:http';import {spawn} from 'node:child_process';
export const root=path.resolve(import.meta.dirname,'../../..'),sleep=ms=>new Promise(r=>setTimeout(r,ms));
export async function browser(task,{webgl=false}={}){
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'viz-pilot2-13-'));let chrome,ws,server;const log={slot:13,runner:process.pid,profile,closed:false};
 try{
  server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end();return;}res.setHeader('Content-Type',({'.js':'text/javascript','.mjs':'text/javascript','.html':'text/html','.json':'application/json','.png':'image/png'})[path.extname(file)]||'application/octet-stream');res.end(data);});});
  await new Promise((r,j)=>{server.once('error',j);server.listen(8913,'127.0.0.1',r);});
  if(await fetch('http://127.0.0.1:9213/json/version').catch(()=>null))throw Error('CDP 9213 occupied');
  chrome=spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-extensions',...(webgl?['--use-angle=swiftshader','--enable-unsafe-swiftshader']:['--disable-gpu']),`--user-data-dir=${profile}`,'--remote-debugging-port=9213','about:blank'],{stdio:'ignore'});log.chrome=chrome.pid;
  let tabs;for(let i=0;i<150;i++){try{tabs=await fetch('http://127.0.0.1:9213/json/list').then(r=>r.json());break;}catch{await sleep(100);}}
  if(!tabs)throw Error('Chrome start failed');ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
  let seq=0;const pending=new Map(),errors=[];
  ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);else if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')errors.push(m.params.args);};
  const call=(method,params={})=>new Promise((resolve,reject)=>{pending.set(++seq,{resolve,reject});ws.send(JSON.stringify({id:seq,method,params}));});
  const ev=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
  const wait=async expression=>{for(let i=0;i<300;i++){if(await ev(expression))return;await sleep(100);}throw Error('Timed out: '+expression);};
  await call('Page.enable');await call('Runtime.enable');await call('Emulation.setDeviceMetricsOverride',{width:1600,height:1000,deviceScaleFactor:1,mobile:false});
  await task({call,ev,wait,errors});
 }finally{
  if(ws)ws.close();if(chrome&&chrome.exitCode===null){const done=new Promise(r=>chrome.once('exit',r));chrome.kill('SIGTERM');await done;}
  if(server)await new Promise(r=>server.close(r));fs.rmSync(profile,{recursive:true,force:true});log.closed=true;
  fs.mkdirSync(path.join(root,'viz/assets/notable/shots'),{recursive:true});fs.writeFileSync(path.join(root,'viz/assets/notable/shots/processes.json'),JSON.stringify(log,null,2));
 }
}
