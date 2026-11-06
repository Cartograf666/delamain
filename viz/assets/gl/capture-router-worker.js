// Read-only geometry work off the animation thread. No network or storage writes.
import {createRoadRouter} from './capture-response.js';
let router;
self.onmessage=({data})=>{
 const started=performance.now();
 try{router??=createRoadRouter(data.roads);self.postMessage({id:data.id,route:router.route(data.target),ms:performance.now()-started});}
 catch{self.postMessage({id:data.id,route:null,ms:performance.now()-started});}
};
