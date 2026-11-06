import fs from 'node:fs';import {browser,sleep} from './browser.mjs';
await browser(async({call,ev,wait,errors})=>{
 await call('Page.navigate',{url:'http://127.0.0.1:8914/viz/viz.html?map=1&live=1&follow=0&lang=ru&src=http://127.0.0.1:8814'});await wait('typeof layerCity!=="undefined"&&!!layerCity?.live?.aq&&cabs.size===30');await sleep(3000);
 fs.writeFileSync('/tmp/viz-live-14/aquarium-first.jpg',Buffer.from((await call('Page.captureScreenshot',{format:'jpeg',quality:90})).data,'base64'));
 console.log(JSON.stringify({errors,model:await ev('({vector:!!layerCity.live.vector,tier:layerCity.live.vector.tier,tiles:layerCity.live.vector.cache.size,pads:layerCity.live.lots.length,workers:cabs.size,flyers:layerCity.live.aq.fl.length,heat:layerCity.live.model.snapshot(),prepare:layerCity.live.prepareMs})')}));if(errors.length)throw Error('Browser errors');
});
