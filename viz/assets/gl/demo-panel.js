// Test stand panel, "Test events": one project selector over two groups, fireworks and taxis. Local only: the buttons
// call the page's own celebration and taxi hooks; nothing reaches the journal or the hub home. Taxis are virtual cabs
// (runtime.js `demo`), removed by Reset and on reload. A native <details> folds it; it starts folded at phone width.
// District: captures, growth, closure, owner question and work, through district-demo.js; Reset all undoes them.
const WORDS={
 en:{title:'Test events',note:'local, does not write the journal',project:'Project',fireworks:'Fireworks',taxis:'Taxis',
  project_:'Delivery in project',owner:'Delivery to owner',neighbour:'Delivery to neighbour',event:'Event → main tower',
  patrol:on=>`Patrol: ${on?'on':'off'}`,five:'Five at once',reset:'Reset',none:'no territory on this map',
  counts:c=>`cargo flights ${c.cargo}/${c.max} · queue ${c.queue} · overflow ${c.overflow} · virtual cabs ${c.cabs}`,
  district:'District',capture:{small:'Capture: small',medium:'Capture: medium',large:'Capture: large'},plots:n=>`${n} ${n===1?'plot':'plots'}`,
  grow:'District grows',closed:on=>`Project closed: ${on?'on':'off'}`,ask:on=>`Owner question: ${on?'on':'off'}`,noHub:'no open hub for this project',
  work:'Work',level:n=>`Work in district: level ${n}`,noWork:'needs the district-work hook (not in this build)',resetAll:'Reset all'},
 ru:{title:'Тестовые события',note:'локально, в журнал не пишет',project:'Проект',fireworks:'Салюты',taxis:'Такси',
  project_:'Доставка в проекте',owner:'Доставка владельцу',neighbour:'Доставка соседу',event:'Событие → главная башня',
  patrol:on=>`Патруль: ${on?'вкл':'выкл'}`,five:'Пять сразу',reset:'Сброс',none:'у проекта нет территории на карте',
  counts:c=>`рейсы с грузом ${c.cargo}/${c.max} · очередь ${c.queue} · перегруз ${c.overflow} · виртуальных такси ${c.cabs}`,
  district:'Район',capture:{small:'Захват: малый',medium:'Захват: средний',large:'Захват: большой'},plots:n=>`${n} ${n===1?'участок':n<5?'участка':'участков'}`,
  grow:'Район растёт',closed:on=>`Проект закрыт: ${on?'вкл':'выкл'}`,ask:on=>`Вопрос владельцу: ${on?'вкл':'выкл'}`,noHub:'у проекта нет открытого хаба',
  work:'Работа',level:n=>`Работа в районе: уровень ${n}`,noWork:'нужен хук district-work (в этой сборке нет)',resetAll:'Сброс всего'}};
// Five at once: three fly (the project cap), two queue, and the owner trip queued last still leaves first.
export const FIVE=Object.freeze(['project','neighbour','project','neighbour','owner']);
const STYLE=`#celebration-panel button:focus-visible,#celebration-panel select:focus-visible,#celebration-panel summary:focus-visible{outline:2px solid #ffe9ae;outline-offset:2px}
#celebration-panel button:hover:not(:disabled){border-color:rgba(223,230,238,.8)}#celebration-panel button:disabled{opacity:.45;cursor:not-allowed}#celebration-panel[open]>summary{margin-bottom:6px}`;

export function buildDemoPanel({projects,project,play,fireworks,lang='en',taxis,district,say=()=>{},doc=document}){
 const w=WORDS[lang]||WORDS.en;
 const make=(tag,props,style)=>{const e=Object.assign(doc.createElement(tag),props);Object.assign(e.style,style||{});return e;};
 if(!doc.getElementById('demo-panel-style'))doc.head.append(make('style',{id:'demo-panel-style',textContent:STYLE}));
 const panel=make('details',{id:'celebration-panel',open:!(globalThis.matchMedia?.('(max-width: 640px)').matches)},{position:'fixed',left:'50%',bottom:'78px',transform:'translateX(-50%)',padding:'6px 8px',font:'12px ui-monospace,Menlo,monospace',color:'#dfe6ee',background:'rgba(3,4,9,.82)',border:'1px solid rgba(138,150,166,.35)',borderRadius:'4px',zIndex:6,maxWidth:'min(760px, calc(100vw - 24px))',boxSizing:'border-box'});
 panel.setAttribute('aria-label',`${w.title}: ${w.note}`);
 const summary=make('summary',{},{cursor:'pointer',letterSpacing:'.08em'});summary.append(make('b',{textContent:`DEMO · ${w.title}`},{fontWeight:600}),make('span',{textContent:` · ${w.note}`},{color:'#8a96a6'}));
 panel.append(summary);
 const control={font:'inherit',fontSize:'12px',color:'#dfe6ee',background:'rgba(3,4,9,.8)',border:'1px solid rgba(138,150,166,.45)',borderRadius:'3px',padding:'4px 9px',cursor:'pointer'};
 // A group: its name in a fixed column, its buttons wrapping beside it.
 const row=(label,id)=>{const r=make('div',{role:'group'},{display:'flex',alignItems:'baseline',gap:'6px',marginTop:'4px'}),b=make('div',{},{display:'flex',flexWrap:'wrap',gap:'6px'});r.setAttribute('aria-labelledby',id);r.append(make('span',{id,textContent:label},{color:'#8a96a6',minWidth:'64px',flex:'none'}),b);panel.append(r);return b;};
 const pickRow=make('div',{},{display:'flex',alignItems:'baseline',gap:'6px'}),picker=make('select',{id:'celebration-project'},{...control,maxWidth:'260px'});
 for(const p of projects)picker.append(new Option(`${p.id} · ${p.plots?.length||0}`,p.id));
 pickRow.append(make('label',{textContent:w.project,htmlFor:'celebration-project'},{color:'#8a96a6',minWidth:'64px'}),picker);panel.append(pickRow);
 const button=(parent,text,on,data)=>{const b=make('button',{type:'button',textContent:text},control);Object.assign(b.dataset,data);b.onclick=on;parent.append(b);return b;};
 const fw=row(w.fireworks,'demo-fireworks');for(const [kind,text] of fireworks)button(fw,text,()=>play(kind,project(picker.value)),{kind});
 if(taxis){
  const tx=row(w.taxis,'demo-taxis'),current=()=>project(picker.value);
  const deliver=(kind,text)=>()=>say(taxis.deliver(current(),kind)?text:`${text}: ${w.none}`);
  button(tx,w.project_,deliver('project',w.project_),{taxi:'project'});
  button(tx,w.owner,deliver('owner',w.owner),{taxi:'owner'});
  button(tx,w.neighbour,deliver('neighbour',w.neighbour),{taxi:'neighbour'});
  button(tx,w.event,()=>say(taxis.event(current(),'merge')?w.event:`${w.event}: ${w.none}`),{taxi:'event'});
  const patrol=button(tx,w.patrol(false),()=>{const on=taxis.patrol(current());patrol.textContent=w.patrol(on);patrol.setAttribute('aria-pressed',String(on));say(w.patrol(on));},{taxi:'patrol'});patrol.setAttribute('aria-pressed','false');
  button(tx,w.five,()=>{const ok=FIVE.map(k=>taxis.deliver(current(),k)).filter(Boolean).length;say(ok?w.five:`${w.five}: ${w.none}`);},{taxi:'five'});
  button(tx,w.reset,()=>{taxis.reset();patrol.textContent=w.patrol(false);patrol.setAttribute('aria-pressed','false');say(w.reset);},{taxi:'reset'});
  const counts=make('div',{id:'demo-taxi-counts'},{marginTop:'5px',color:'#b6c0cc'}),tick=()=>{counts.textContent=w.counts(taxis.counts());};
  panel.append(counts);tick();setInterval(tick,250);
 }
 if(district){
  const dr=row(w.district,'demo-district'),id=()=>picker.value;
  for(const [size,n] of Object.entries(district.sizes)){const text=`${w.capture[size]} · ${n}`;
   button(dr,text,()=>{const got=district.capture(id(),size);say(got?`${w.capture[size]} · ${w.plots(got)}`:`${text}: ${w.none}`);},{district:'capture-'+size});}
  button(dr,w.grow,()=>{const got=district.grow(id());say(got?`${w.grow} · +${w.plots(got)}`:`${w.grow}: ${w.none}`);},{district:'grow'});
  // Toggles show the selected project's state.
  const toggles=[],toggle=(key,label,on,is,miss)=>{const b=button(dr,'',()=>{const r=on(id());if(r==null){say(`${label(true)}: ${miss}`);return;}refresh();say(label(r));},{district:key});toggles.push(()=>{const v=is(id());b.textContent=label(v);b.setAttribute('aria-pressed',String(v));});};
  const refresh=()=>toggles.forEach(f=>f());
  toggle('closed',w.closed,district.close,district.isClosed,w.none);
  toggle('question',w.ask,district.question,district.isAsked,w.noHub);
  button(dr,w.resetAll,()=>{district.reset();refresh();say(w.resetAll);},{district:'reset'});
  refresh();picker.addEventListener('change',refresh);
  // Work levels call a hook another module adds; until it exists the buttons stay disabled with the reason beside them.
  const wr=row(w.work,'demo-work'),hint=make('span',{id:'demo-work-hint',textContent:w.noWork},{color:'#8a96a6'}),levels=[0,1,2,3].map(n=>{const b=button(wr,String(n),()=>{if(district.work(id(),n))say(w.level(n));},{work:String(n)});b.setAttribute('aria-label',w.level(n));b.setAttribute('aria-describedby','demo-work-hint');return b;});
  wr.append(hint);
  const ready=()=>{const on=district.workReady;for(const b of levels)b.disabled=!on;hint.hidden=on;return on;};
  if(!ready()){const t=setInterval(()=>{if(ready())clearInterval(t);},1000);}
  const counts=panel.querySelector?.('#demo-taxi-counts');if(counts)panel.append(counts);
 }
 doc.body.append(panel);
 return {panel,picker};
}
