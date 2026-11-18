let panelSize=100,previewUntil=0;
let days=1, scale=100;
function startOfRange(now=new Date()){
 const date=new Date(now);date.setHours(0,0,0,0);date.setDate(date.getDate()-days+1);return date.getTime();
}
function timestamp(value){return typeof value==='number'?value:(Date.parse(value)||0);}
function latest(...values){return Math.max(0,...values.map(timestamp));}
let clearedAt=0, dismissed=new Map();
try{const saved=JSON.parse(localStorage.getItem('signal-cleared')||'{}');clearedAt=saved.time||0;dismissed=new Map(saved.items||[]);}catch{}
function persistClear(){
 try{localStorage.setItem('signal-cleared',JSON.stringify({time:clearedAt,items:[...dismissed]}));}catch{}
}
function visible(row){
 return row.at>=startOfRange() && row.at>clearedAt && dismissed.get(row.id)!==row.token;
}
function clearSignals(){
 clearedAt=Date.now();dismissed=new Map([...tasks.values(),...roster.values()].map(r=>[r.id,r.token]));persistClear();
}
const tasks = new Map(), roster = new Map(), titles = new Map(), seen = new Map();
let epoch = 0, focused, scanning=false, refreshNeeded=false, companionsBusy=false, denied=false;
let companionNote='', scanNote='正在同步任务', busy=false;
function classify(a) {
  if(!a) return;
  if(a.phase==='needs-interaction'||a.phase==='error' && a.attention) return 'red';
  if(a.phase==='running'||a.currentTurnActive||a.queuedCount) return 'amber';
  if(a.phase==='completed') return 'green';
}
function record(id,a,at) {
  const group=classify(a);
  if(!group){tasks.delete(id);return;}
  const token=group+'-'+(a.turnGeneration??a.turn_generation??a.startedAtMs??'');
  tasks.set(id,{id,group,token,at,pulse:(group!=='green'||a.attention)&&focused!==id&&seen.get(id)!==token});
}
async function read(tool,args){
 const r=await cindy.host.call('cindy_helper',tool,args);
 const p=JSON.parse(r.content.find(c=>c.type==='text').text);
 if(r.isError||p.ok===false) throw Error(tool);
 return p;
}
const revisions=new Map();
async function scan(){
 if(scanning){refreshNeeded=true;return;}
 scanning=true;const start=epoch;
 try {
  let cursor,misses=0;
  do{
   const page=await read('list_sessions',{limit:100,time_field:'activity',from:new Date(startOfRange()).toISOString(),...(cursor?{cursor}:{})});
   for(let n=0;n<page.sessions.length;n+=6){
    await Promise.all(page.sessions.slice(n,n+6).map(async s=>{
     titles.set(s.id,s.title||'未命名任务');
     if((revisions.get(s.id)||0)>start)return;
     if(s.status==='archived'||s.status==='deleted'){tasks.delete(s.id);return;}
     try{const a=await read('get_session_runtime',{session_id:s.id});
       if((revisions.get(s.id)||0)<=start)record(s.id,{...a,queuedCount:s.queuedCount},latest(a.last_activity_at,a.started_at,s.lastActivityAt,s.userSendAt,s.createdAt));
     }catch{misses++;}
    }));
   }
   cursor=page.hasMore?page.nextCursor:null;
  }while(cursor);
  scanNote=misses?'部分任务状态暂不可用':'';
 }catch{scanNote='任务列表暂不可用';}
 finally{scanning=false;if(refreshNeeded){refreshNeeded=false;scan();}}
}
async function companions(){
 if(companionsBusy||denied)return;
 companionsBusy=true;
 try{
  const {companions:list}=await cindy.companions.list();
  roster.clear();companionNote='';
  for(const c of list){
   const entries=c.interactions.map(i=>({group:'red',ref:i.ref,label:i.title||'等待处理'}));
   const group=({running:'amber',awaiting:'red',error:'red',done:'green',unread:'green'})[c.status];
   if(group&&!entries.some(e=>e.group===group))entries.push({group,label:c.name});
   if(c.activity?.phase==='running'&&!entries.some(e=>e.group==='amber'))entries.push({group:'amber',label:c.name});
   for(const e of entries){
    const id='partner/'+c.id+'/'+(e.ref||e.group),token=e.group+'-'+(c.activity?.startedAt||c.lastReplyAt||'');
    const at=latest(c.activity?.lastActivityAt,c.activity?.startedAt,c.lastReplyAt);
    roster.set(id,{id,token,at,group:e.group,title:'伙伴 · '+c.name+(e.label!==c.name?' · '+e.label:''),companionId:c.id,interactionRef:e.ref,pulse:seen.get(id)!==token});
   }
  }
 }catch(e){denied=/PERMISSION_DENIED/i.test(String(e.code)+' '+String(e.message));companionNote=denied?'请在插件详情中确认伙伴查看权限':'伙伴状态暂不可用';}
 finally{companionsBusy=false;}
}
async function display(){
 if(busy)return;busy=true;
 try{
 const rows=[...tasks.values(),...roster.values()].filter(visible).map(r=>({id:r.id,group:r.group,title:r.title||titles.get(r.id)||'任务 '+r.id.slice(0,8),pulse:!!r.pulse}));
 const res=await cindy.node.request({method:'display',params:{rows,scale,panelSize,preview:Date.now()<previewUntil,note:[scanNote,companionNote].filter(Boolean).join(' · ')}});
 if(!res.ok)throw Error(res.message);
 }catch(e){console.error(String(e));}finally{busy=false;}
}
async function handleClick(id){
 if(id==='!clear'){clearSignals();display();return;}
 const r=tasks.get(id)||roster.get(id);if(!r)return;
 if(r.companionId){
  await cindy.companions.open({companionId:r.companionId,...(r.interactionRef?{interactionRef:r.interactionRef}:{})});
 }else{
  let opened=false;
  try{opened=(await cindy.observe?.openTask({taskId:id}))?.opened===true;}catch(e){console.warn(String(e));}
  if(!opened)await cindy.node.request({method:'fallback',params:{id}});
 }
 seen.set(id,r.token);r.pulse=false;
}
async function listenClicks(){
 try{
  const res=await cindy.node.request({method:'events',params:{},timeoutMs:10000});
  if(!res.ok)throw Error(res.message);
  for(const id of res.result.clicks)await handleClick(id);
  setTimeout(listenClicks,0);
 }catch(e){console.error(String(e));setTimeout(listenClicks,1000);}
}
cindy.onHostMessage(m=>{
 if(m.type==='companions-changed'){companions();return;}
 if(m.name==='did-session-switched'){focused=m.data.sessionId;const row=tasks.get(focused);if(row){seen.set(focused,row.token);row.pulse=false;}return;}
 if(m.name!=='did-task-state-changed')return;
 const {sessionId:id,state}=m.data;revisions.set(id,++epoch);
 if(state.status==='archived'||state.status==='deleted')tasks.delete(id);
 else if('activity' in state)record(id,state.activity,latest(state.changedAtMs,state.activity?.lastActivityAtMs,state.activity?.startedAtMs));
 if(m.dropped||!titles.has(id))scan();
});
const settingsChannel=new BroadcastChannel('signal-settings');
function applyRange(value){days=[1,2,3].includes(Number(value))?Number(value):1;scan();companions();display();}
function applyScale(value){scale=Math.min(200,Math.max(50,Number(value)||100));display();}
settingsChannel.onmessage=m=>{
 if('panelSize' in m.data)panelSize=Math.min(200,Math.max(50,Number(m.data.panelSize)||100));
 if('preview' in m.data)previewUntil=m.data.preview?Date.now()+2500:0;
 if('panelSize' in m.data||'preview' in m.data)display();
 if('scale' in m.data)applyScale(m.data.scale);
 if('days' in m.data)applyRange(m.data.days);
};
async function initialize(){
 let value=1;try{const cfg=await (await fetch('/kv')).json();value=cfg.days;panelSize=Math.min(200,Math.max(50,Number(cfg.panelSize)||100));applyScale(cfg.scale);}catch{}
 cindy.companions?.watch?.().catch(()=>{});applyRange(value);
}
initialize();listenClicks();
setInterval(display,850);setInterval(companions,20000);
setInterval(()=>{if(!scanning)scan();},180000);
