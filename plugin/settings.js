const days=document.getElementById('days'), scale=document.getElementById('scale');
const percent=document.getElementById('percent'), statusText=document.getElementById('status');
const panelSize=document.getElementById('panelSize'),panelPercent=document.getElementById('panelPercent');
const channel=new BroadcastChannel('signal-settings');
async function load(){const r=await fetch('/kv');if(!r.ok)throw Error();return r.json();}
load().then(cfg=>{
 days.value=String(cfg.days||1);scale.value=String(cfg.scale||100);
 panelSize.value=String(cfg.panelSize||100);panelPercent.value=panelSize.value+'%';panelSize.disabled=false;
 percent.value=scale.value+'%';days.disabled=scale.disabled=false;
}).catch(()=>statusText.textContent='设置读取失败');
scale.oninput=()=>{percent.value=scale.value+'%';channel.postMessage({scale:Number(scale.value)});};
let saving=Promise.resolve();
function save(key,value){
 saving=saving.then(async()=>{
  const cfg=await load();cfg[key]=value;
  const r=await fetch('/kv',{method:'PUT',body:JSON.stringify(cfg)});if(!r.ok)throw Error();
  channel.postMessage({[key]:value});statusText.textContent='已保存';
 }).catch(()=>statusText.textContent='保存失败，请重试');
}
days.onchange=()=>save('days',Number(days.value));
scale.onchange=()=>save('scale',Number(scale.value));

let heartbeat,finishTimer;
function preview(){
 clearTimeout(finishTimer);
 panelPercent.value=panelSize.value+'%';
 channel.postMessage({panelSize:Number(panelSize.value),preview:true});
 if(!heartbeat)heartbeat=setInterval(()=>channel.postMessage({preview:true}),750);
}
function endPreview(){
 clearTimeout(finishTimer);clearInterval(heartbeat);heartbeat=null;
 channel.postMessage({preview:false});
}
panelSize.onpointerdown=preview;
panelSize.oninput=preview;
panelSize.onchange=()=>save('panelSize',Number(panelSize.value));
function finish(){finishTimer=setTimeout(endPreview,850);}
window.addEventListener('pointerup',finish);
panelSize.onkeyup=finish;
panelSize.onblur=endPreview;
window.addEventListener('pointercancel',endPreview);
window.addEventListener('pagehide',endPreview);
