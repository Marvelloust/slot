
const {spawn}=require('child_process');
const http=require('http');
const PORT=4190,BASE=`http://127.0.0.1:${PORT}`;
function req(method,path,body){
 return new Promise((resolve,reject)=>{
  const data=body===undefined?null:Buffer.from(JSON.stringify(body));
  const r=http.request(BASE+path,{method,headers:data?{'Content-Type':'application/json','Content-Length':data.length}:{}},res=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>{const raw=Buffer.concat(chunks).toString();let parsed;try{parsed=JSON.parse(raw)}catch{parsed=raw}resolve({status:res.statusCode,body:parsed})})});r.on('error',reject);if(data)r.write(data);r.end();
 });
}
async function main(){
 const child=spawn(process.execPath,['server.js'],{cwd:__dirname,env:{...process.env,PORT:String(PORT)},stdio:['ignore','pipe','pipe']});
 await new Promise((resolve,reject)=>{let ok=false;child.stdout.on('data',d=>{if(String(d).includes('Slot running')){ok=true;resolve()}});child.on('exit',c=>!ok&&reject(new Error('server exited '+c)));setTimeout(()=>!ok&&reject(new Error('startup timeout')),3000)});
 try{
  let r=await req('POST','/api/availability',{date:'2026-09-12',start:'13:00',end:'17:00',resources:['studio-a','camera-1','lighting-1']});
  if(r.status!==200||r.body.available!==false)throw new Error('expected conflict');
  const cameraConflict=r.body.conflicts.find(c=>c.resourceId==='camera-1');
  if(!cameraConflict)throw new Error('camera conflict missing');
  if(cameraConflict.busyStart!=='14:00'||cameraConflict.busyEnd!=='15:00')throw new Error('seeded 2–3 PM conflict is wrong');
  if(!r.body.suggestions.length)throw new Error('no alternatives');
  if(!r.body.suggestions.some(s=>s.type==='substitute'&&s.resources.includes('camera-2')&&s.start==='13:00'&&s.end==='17:00'))throw new Error('clean same-time camera substitution missing');
  const option=r.body.suggestions[0];
  r=await req('POST','/api/bookings',{title:'QA booking',organizer:'QA',date:option.date,start:option.start,end:option.end,resources:option.resources});
  if(r.status!==201)throw new Error('suggested booking failed '+JSON.stringify(r.body));
  // Find a clean recommendation, then make it stale with a competing hold.
  r=await req('POST','/api/availability',{date:'2026-09-12',start:'12:00',end:'13:00',resources:['studio-b','camera-2']});
  if(r.status!==200)throw new Error('clean availability call');
  const candidate={date:'2026-09-12',start:'12:00',end:'13:00',resources:['studio-b','camera-2']};
  await req('POST','/api/dev/competing',{resourceId:'camera-2',date:candidate.date,start:candidate.start,end:candidate.end});
  r=await req('POST','/api/bookings',{title:'Stale booking',organizer:'QA',...candidate});
  if(r.status!==409)throw new Error('atomic recheck did not block stale booking');
  await req('POST','/api/reset');
  console.log('PASS: conflict detection, suggestions, commit, stale-option atomic recheck, reset');
 }finally{child.kill()}
}
main().catch(e=>{console.error('FAIL',e);process.exit(1)});
