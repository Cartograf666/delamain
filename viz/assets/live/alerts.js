/* Display-only journal alerts. Source identity is part of the key; no messages are sent. */
(function(root){
const alertKind=text=>{const m=/^(?:@\S+\s+)?(QUESTION|BLOCKED)\b/.exec(text||'');if(m)return m[1];return /^EXIT\b.*(code [1-9]|no result|died|killed)/.test(text||'')?'STOP':null;};
class CityAlerts{
 constructor(){this.entries=new Map();}
 reset(){this.entries.clear();}
 track(src,e,d,now=0){const role=e.from?.[1]||e.tag||'',key=src+'|'+e.stage,entry=this.entries.get(key)||{src,stage:e.stage,d,t0:now,items:[]},kind=alertKind(e.text),to=/^@(\S+)/.exec(e.text||'');entry.items=entry.items.filter(q=>q.role!==role&&!(to&&q.role===to[1])&&!(/^hub/.test(role)&&q.kind==='STOP'));if(kind)entry.items.push({role,kind,text:String(e.text),at:Date.parse(e.at)||Date.now()});if(entry.items.length)this.entries.set(key,entry);else this.entries.delete(key);return entry;}
 lines(src,stage){const e=this.entries.get(src+'|'+stage);return e?e.items.flatMap(q=>[q.kind+' · '+q.role,q.text.length>180?q.text.slice(0,179)+'…':q.text]):[];}
}
root.CityAlerts=CityAlerts;if(typeof module!=='undefined')module.exports={CityAlerts,alertKind};
})(globalThis);
