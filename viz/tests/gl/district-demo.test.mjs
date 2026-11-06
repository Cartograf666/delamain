// Run: node viz/tests/gl/district-demo.test.mjs
// The test stand's District group: captures of each size reach the real capture response with the right plot count,
// growth replays the wave, closure and the owner question are reversible overlays, Reset all clears every demo state
// and leaves the page's data as it was, and the work buttons follow the district-work hook.
import assert from 'node:assert/strict';
import {createCaptureResponse} from '../../assets/gl/capture-response.js';
import {borderPlots,closedView,createDistrictDemo,nearRoad,CAPTURE_SIZES} from '../../assets/gl/district-demo.js';
import {buildDemoPanel} from '../../assets/gl/demo-panel.js';

// A 10×4 strip: A owns x<6 (24 plots), B owns the rest; plot 0 is A's main plot.
const plots=new Map(),plotOwners=[];
for(let i=0;i<40;i++){const x=i%10,y=Math.floor(i/10);plots.set(i,{id:i,ground:[x*20,y*10],building:null});plotOwners.push({id:i,owner:x<6?'A':'B',level:2,dark:false,reserved:false});}
const city={date:'2026-11-05',projects:[{id:'A',colour:'#ff0000',stages:['a'],mainPlot:{id:0},plots:[1],area:24},{id:'B',colour:'#00ff00',stages:['b'],mainPlot:{id:9},plots:[2],area:16}],plotOwners,aggressiveCaptures:[]};
const frozen=JSON.stringify(city);

const b=borderPlots(city,plots,'A',4,0);
assert.equal(b.neighbour,'B');
assert.deepEqual(b.plots.slice().sort((x,y)=>x-y),[5,15,25,35],'the column facing B');
assert.equal(borderPlots(city,plots,'A',16,0).plots.length,16);
assert(!borderPlots(city,plots,'A',99,0).plots.includes(0),'the main plot never changes hands');
// Only lots the response can route to: a road runs between the territories, from y=20 down; row 0 (y=0) is out of reach.
const roads=[{gpuId:0,p:[[110,20],[110,60]]}],near=nearRoad(roads);
assert(near([100,10])&&!near([100,-30])&&!near([40,10]));
assert(!borderPlots(city,plots,'A',4,0,near).plots.includes(5));assert.deepEqual(borderPlots(city,plots,'A',3,0,near).plots.slice().sort((x,y)=>x-y),[15,25,35],'row 0 is too far from the road');
const shut=closedView(city,'A');
assert(shut.projects[0].closed&&shut.projects[0].mainPlot===null);
assert(shut.plotOwners.filter(o=>o.id%10<6).every(o=>o.owner===''&&o.level===0));
assert.equal(JSON.stringify(city),frozen,'closedView copies');

function page({work}={}){
 const live={districtsVisible:true,gpu:{growth:{plots,buildings:new Map(),snapshot:city},scene:{buildings:[]},districtWork:work}};
 const response=createCaptureResponse(live,{roads:[...roads,{gpuId:1,p:[[0,15],[110,15]]}],water:()=>{},search:'',storage:null,day:()=>city.date,reduce:{matches:false}});
 const m={cityData:city,cityStages:new Map([['a',[city.projects[0]]],['b',[city.projects[1]]]])},machines=new Map([['src',m]]);
 const hub={kind:'hub',project:'A',open:true,questions:0},towers=new Map([['h',hub]]);
 const ui={mode:'territories',waves:[],replay(c){this.waves.push(c);}},emitted=[];let placed=0;
 const demo=createDistrictDemo({live,response,towers,machines,placeHubs:()=>placed++,growth:()=>ui,emit:s=>emitted.push(s),doc:null});
 response.update(0); // the page runs it every frame; the first call adopts the snapshot date
 return {live,response,m,hub,ui,demo,emitted,placed:()=>placed};
}

// Captures: one group per click; severity follows its plot count; MAX_EVENTS run at once, the rest queue.
for(const [size,n] of Object.entries(CAPTURE_SIZES)){
 const P=page();assert.equal(P.demo.capture('A',size),n,size);
 P.response.update(1000);
 const e=P.response.events;assert.equal(e.length,Math.min(3,n),size+' started');
 assert.equal(e[0].group.plotIds.size,n,size+' severity count');
 assert(e.every(x=>x.capture.from==='B'&&x.capture.to==='A'&&x.group.demo));
 assert.equal(P.response.stats.frame,true,'asks the page to frame the response');
 P.demo.reset();P.response.update(1100);assert.equal(P.response.events.length,0,size+' reset clears started and queued');
 assert.equal(P.response.stats.frame,false);
}
{const P=page();P.live.districtsVisible=false;assert.equal(P.demo.capture('A','small'),0,'needs «Районы»');}
// From Activity: the panel presses the page's «Районы» button, and the first frame keeps the queued capture.
{const P=page(),button={click(){P.live.districtsVisible=true;P.ui.mode='territories';}};P.live.districtsVisible=false;P.ui.mode='activity';
 P.response.update(0);P.demo=createDistrictDemo({live:P.live,response:P.response,machines:new Map([['src',P.m]]),growth:()=>P.ui,doc:{querySelector:()=>button},emit:()=>{}});
 assert.equal(P.demo.capture('A','small'),1);P.response.update(16);assert.equal(P.response.events.length,1,'first frame after the switch keeps it');}
{const P=page();assert.equal(P.demo.capture('nobody','small'),0);}

// Growth, closure, question, then Reset all.
{const P=page();
 assert.equal(P.demo.grow('A'),4);assert.deepEqual(P.ui.waves[0][0].from,'B');assert.equal(P.ui.waves[0][0].plots.length,4);
 assert.equal(P.demo.close('A'),true);assert(P.m.cityData.projects[0].closed);assert(P.m.cityStages.get('a')[0].closed);
 assert.equal(P.emitted.length,1);assert.equal(P.placed(),1);
 assert.equal(P.demo.capture('A','small'),0,'a closed project has no land to capture');
 assert.equal(P.demo.question('A'),true);assert.equal(P.hub.questions,1);
 P.hub.questions=2;assert.equal(P.hub.questions,3,'real updates land under the overlay');
 assert.equal(P.demo.question('nobody'),null);
 P.demo.reset();
 assert.equal(P.m.cityData,city);assert.equal(P.m.cityStages.get('a')[0],city.projects[0]);assert.equal(P.hub.questions,2);
 assert.equal(P.ui.waves.at(-1),null,'wave stopped');assert.equal(JSON.stringify(city),frozen,'real data untouched');
 // A fresh /city that arrived during the demo stays.
 P.demo.close('A');const fresh={...city};P.m.cityData=fresh;P.demo.close('A');assert.equal(P.m.cityData,fresh);
}

// Work: disabled without the hook; with it, called with the project id and level; Reset all sends level 0.
function fakeDoc(){
 const el=tag=>({tag,style:{},dataset:{},children:[],attrs:{},listeners:{},append(...c){for(const x of c){const i=this.children.indexOf(x);if(i>=0)this.children.splice(i,1);this.children.push(x);}},
  setAttribute(k,v){this.attrs[k]=String(v);},getAttribute(k){return this.attrs[k];},addEventListener(k,f){this.listeners[k]=f;},
  querySelector(sel){const id=sel.slice(1);const walk=n=>n.id===id?n:n.children?.map(walk).find(Boolean);return walk(this)||null;},
  all(){return [this,...this.children.flatMap(c=>c.all?c.all():[c])];}});
 globalThis.Option=function(text,value){return {text,value};};
 return {createElement:el,head:el('head'),body:el('body'),getElementById:()=>null};
}
for(const hooked of [false,true]){
 const calls=[],P=page({work:hooked?{setDemo:(id,level)=>calls.push([id,level])}:undefined}),doc=fakeDoc();
 const {panel,picker}=buildDemoPanel({projects:city.projects,project:id=>city.projects.find(p=>p.id===id),play(){},fireworks:[],lang:'ru',district:P.demo,doc});
 picker.value='A';
 const buttons=panel.all().filter(e=>e.tag==='button'),levels=buttons.filter(e=>e.dataset.work);
 assert.equal(levels.length,4);assert(levels.every(b=>b.disabled===!hooked),'disabled iff the hook is missing');
 assert.equal(panel.all().find(e=>e.id==='demo-work-hint').hidden,hooked);
 assert.deepEqual(buttons.filter(e=>e.dataset.district).map(e=>e.dataset.district),['capture-small','capture-medium','capture-large','grow','closed','question','reset']);
 if(hooked){levels[2].onclick();assert.deepEqual(calls,[['A',2]]);buttons.find(e=>e.dataset.district==='reset').onclick();assert.deepEqual(calls.at(-1),['A',0]);}
 else assert.equal(P.demo.work('A',2),false);
 const q=buttons.find(e=>e.dataset.district==='question');q.onclick();assert.equal(q.attrs['aria-pressed'],'true');assert.equal(q.textContent,'Вопрос владельцу: вкл');
 P.demo.reset();
}
console.log('district-demo: ok');
process.exit(0);
