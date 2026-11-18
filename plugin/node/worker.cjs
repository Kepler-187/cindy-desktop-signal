const {spawn}=require('node:child_process');
const path=require('node:path');
const readline=require('node:readline');
let child,ready,last;const clicks=[];
let notify;
function emitClick(id){clicks.push(id);if(notify)notify();}
async function waitClicks(){
 if(!clicks.length)await new Promise(resolve=>{
  const finish=()=>{clearTimeout(timer);notify=null;resolve();};
  const timer=setTimeout(finish,5000);notify=finish;
 });
 return clicks.splice(0);
}
function open(){
  if(child) return ready;
  const proc=spawn(path.join(__dirname,'Signal.exe'),[],{stdio:['pipe','pipe','inherit'],windowsHide:true,env:{...process.env,SIGNAL_CINDY_EXE:process.execPath}});
  child=proc;last=null;
  ready=new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>{proc.kill();reject(Error('Window startup timeout'));},8000);
    readline.createInterface({input:proc.stdout}).on('line',line=>{if(line.startsWith('click ')){emitClick(Buffer.from(line.slice(6),'base64').toString('utf8'));return;}clearTimeout(timeout);if(line==='ready')resolve();else reject(Error('Window startup failed'));});
    proc.once('error',error=>{clearTimeout(timeout);child=null;reject(error);});
    proc.once('exit',()=>{clearTimeout(timeout);child=null;reject(Error('Window closed'));});
  });
  return ready;
}
const rpc=readline.createInterface({input:process.stdin});
rpc.on('close',()=>{if(child)child.stdin.end();});
rpc.on('line',async line=>{
  const req=JSON.parse(line);
  try{
    if(req.method==='events'){
      const result={clicks:await waitClicks()};
      console.log(JSON.stringify({jsonrpc:'2.0',id:req.id,result}));return;
    }
    if(req.method==='fallback' && typeof req.params.id==='string'){
      await open();
      child.stdin.write(JSON.stringify({openId:req.params.id})+'\n');
      console.log(JSON.stringify({jsonrpc:'2.0',id:req.id,result:{}}));return;
    }
    if(req.method!=='display'||!Array.isArray(req.params.rows))throw Error('Invalid display request');
    await open();
    const payload=JSON.stringify(req.params); if(last!==payload)await new Promise((resolve,reject)=>child.stdin.write(payload+'\n',e=>e?reject(e):resolve()));
    last=payload;console.log(JSON.stringify({jsonrpc:'2.0',id:req.id,result:{}}));
  }catch(e){console.log(JSON.stringify({jsonrpc:'2.0',id:req.id,error:{code:-32000,message:e.message}}));}
});
