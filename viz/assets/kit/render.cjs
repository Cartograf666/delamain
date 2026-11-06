/* Attached runner: owns and closes its HTTP server, Chrome child and profile. */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http');
const {spawn}=require('node:child_process');
const ROOT=__dirname,PORT=8912,CDP_PORT=9212;
const delay=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'viz-kit-12-')),repo=path.resolve(ROOT,'../../..');let chrome,ws,server;
 const processLog={slot:12,httpPort:PORT,cdpPort:CDP_PORT,runnerPid:process.pid,startedAt:new Date().toISOString(),closed:false};
 try{
  server=http.createServer((req,res)=>{const file=path.resolve(repo,'.'+decodeURIComponent(req.url.split('?')[0]));if(!file.startsWith(repo+path.sep)){res.writeHead(403).end();return;}fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end();return;}res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.json':'application/json','.png':'image/png'})[path.extname(file)]||'application/octet-stream');res.end(data);});});
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(PORT,'127.0.0.1',resolve);});
  // Never attach to another agent's existing debug endpoint.
  const probe=await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`).catch(()=>null);if(probe)throw Error('CDP port already in use');
  chrome=spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-extensions',`--user-data-dir=${profile}`,`--remote-debugging-port=${CDP_PORT}`,'about:blank'],{stdio:['ignore','ignore','ignore']});
  processLog.chromePid=chrome.pid;fs.writeFileSync(path.join(ROOT,'shots/processes.json'),JSON.stringify(processLog,null,2));
  let tabs;for(let i=0;i<100;i++){try{tabs=await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`).then(r=>r.json());break;}catch{await delay(100);}}
  if(!tabs)throw Error('Chrome failed to start');ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
  let seq=0;const pending=new Map();ws.onmessage=event=>{const message=JSON.parse(event.data);if(message.id){const p=pending.get(message.id);if(p){pending.delete(message.id);message.error?p.reject(Error(JSON.stringify(message.error))):p.resolve(message.result);}}};
  const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
  await call('Page.enable');await call('Runtime.enable');await call('Page.navigate',{url:`http://127.0.0.1:${PORT}/viz/assets/kit/review.html`});
  const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
  for(let i=0;i<100;i++){if(await evaluate('typeof window.ready !== "undefined"'))break;await delay(100);}
  await evaluate('window.ready');
  for(const name of ['kit-sheet.png','kit-buildings.png']){const data=await evaluate(`window.sheets[${JSON.stringify(name)}].toDataURL('image/png')`);fs.writeFileSync(path.join(ROOT,'shots',name),Buffer.from(data.split(',')[1],'base64'));}
  console.log('Checkpoint sheets saved; running Chromium checks and 4367-building benchmark.');
  const result=await evaluate('checkBrowser(window.kit)');fs.writeFileSync(path.join(ROOT,'shots/browser-tests.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
 } finally {
  if(ws)ws.close();
  if(chrome && chrome.exitCode===null){const exited=new Promise(r=>chrome.once('exit',r));chrome.kill('SIGTERM');await exited;}
  if(server)await new Promise(r=>server.close(r));
  fs.rmSync(profile,{recursive:true,force:true});processLog.closed=true;processLog.closedAt=new Date().toISOString();fs.writeFileSync(path.join(ROOT,'shots/processes.json'),JSON.stringify(processLog,null,2)+'\n');
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
