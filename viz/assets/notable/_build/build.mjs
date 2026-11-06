import fs from 'node:fs';import path from 'node:path';import {browser,root} from '../../../tests/pilot2/browser.mjs';
await browser(async({call,ev,wait,errors})=>{
 await call('Page.navigate',{url:'http://127.0.0.1:8913/viz/assets/notable/_build/build.html'});await wait('typeof buildNotables === "function"');
 const start=Date.now(),out=await ev('buildNotables()');
 for(const [name,data]of Object.entries(out.files))fs.writeFileSync(path.join(root,'viz/assets/notable',name),Buffer.from(data.split(',')[1],'base64'));
 fs.writeFileSync(path.join(root,'viz/assets/notable/manifest.json'),JSON.stringify(out.manifest,null,2)+'\n');
 if(errors.length)throw Error(JSON.stringify(errors));console.log(JSON.stringify({models:out.manifest.models,buildMs:Date.now()-start}));
},{webgl:true});
