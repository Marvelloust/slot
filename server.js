
const http=require('http');
const fs=require('fs');
const path=require('path');
const url=require('url');

const PORT=process.env.PORT||4180;
const ROOT=__dirname,PUBLIC=path.join(ROOT,'public'),DATA=path.join(ROOT,'data','state.json'),BASE=path.join(ROOT,'data','baseline.json');

function read(){return JSON.parse(fs.readFileSync(DATA,'utf8'))}
function write(s){fs.writeFileSync(DATA,JSON.stringify(s,null,2))}
function send(res,status,body,type='application/json; charset=utf-8'){
  res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store'});
  res.end(type.startsWith('application/json')?JSON.stringify(body):body);
}
function body(req){return new Promise((resolve,reject)=>{let raw='';req.on('data',c=>{raw+=c;if(raw.length>1_000_000){reject(Object.assign(new Error('Payload too large'),{status:413}));req.destroy()}});req.on('end',()=>{try{resolve(raw?JSON.parse(raw):{})}catch(e){reject(Object.assign(new Error('Invalid JSON'),{status:400}))}})})}
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml'};

function staticFile(res,pathname){
  let rel=pathname==='/'?'/index.html':pathname;
  const file=path.normalize(path.join(PUBLIC,rel));
  if(!file.startsWith(PUBLIC))return send(res,403,'Forbidden','text/plain');
  fs.readFile(file,(err,data)=>{
    if(err){if(!path.extname(file))return fs.readFile(path.join(PUBLIC,'index.html'),(e,d)=>e?send(res,404,'Not found','text/plain'):send(res,200,d,'text/html; charset=utf-8'));return send(res,404,'Not found','text/plain')}
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(data);
  });
}

function mins(t){const [h,m]=String(t).split(':').map(Number);return h*60+m}
function time(m){m=Math.max(0,Math.min(24*60,m));return `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`}
function overlap(aStart,aEnd,bStart,bEnd){return aStart<bEnd&&aEnd>bStart}
function id(prefix){return prefix+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,6)}
function resourceMap(s){return Object.fromEntries(s.resources.map(r=>[r.id,r]))}
function bookingWindow(b,r){
  return {start:mins(b.start)-(r?.bufferBefore||0),end:mins(b.end)+(r?.bufferAfter||0)};
}
function conflictsFor(s,{date,start,end,resources,ignoreBookingId=null}){
  const map=resourceMap(s),reqStart=mins(start),reqEnd=mins(end),conflicts=[];
  for(const rid of resources){
    const r=map[rid];if(!r)continue;
    const requested={start:reqStart-(r.bufferBefore||0),end:reqEnd+(r.bufferAfter||0)};
    for(const b of s.bookings){
      if(b.id===ignoreBookingId||b.date!==date||!b.resources.includes(rid))continue;
      const existing=bookingWindow(b,r);
      if(overlap(requested.start,requested.end,existing.start,existing.end)){
        conflicts.push({
          resourceId:rid,resourceName:r.name,bookingId:b.id,title:b.title,kind:b.kind,
          requestedStart:time(requested.start),requestedEnd:time(requested.end),
          busyStart:b.start,busyEnd:b.end,busyWithBufferStart:time(existing.start),busyWithBufferEnd:time(existing.end)
        });
      }
    }
  }
  return conflicts;
}
function sameGroupAlternatives(s,rid){
  const map=resourceMap(s),r=map[rid];if(!r)return[];
  return s.resources.filter(x=>x.id!==rid&&x.active&&x.group===r.group).map(x=>x.id);
}
function scoreSuggestion(baseStart,start,substitutions,conflicts){
  const shift=Math.abs(start-baseStart),subPenalty=substitutions.length*50,conflictPenalty=conflicts.length*1000;
  return shift+subPenalty+conflictPenalty;
}
function suggestionsFor(s,request){
  const baseStart=mins(request.start),baseEnd=mins(request.end),duration=baseEnd-baseStart,all=[];
  const conflicts=conflictsFor(s,request),conflicted=[...new Set(conflicts.map(c=>c.resourceId))];

  // 1) Same time, substitute one or more conflicting resources with same-group alternatives.
  if(conflicted.length){
    let variants=[{resources:[...request.resources],subs:[]}];
    for(const rid of conflicted){
      const alts=sameGroupAlternatives(s,rid);
      const next=[];
      for(const v of variants){
        for(const alt of alts){
          next.push({resources:v.resources.map(x=>x===rid?alt:x),subs:[...v.subs,{from:rid,to:alt}]});
        }
      }
      if(next.length)variants=next;
    }
    for(const v of variants.slice(0,8)){
      const c=conflictsFor(s,{...request,resources:v.resources});
      if(!c.length)all.push({type:'substitute',date:request.date,start:request.start,end:request.end,resources:v.resources,substitutions:v.subs,shiftMinutes:0,conflicts:c});
    }
  }

  // 2) Shift the entire resource bundle in 30-minute increments, preserving duration.
  for(let delta=30;delta<=240;delta+=30){
    for(const dir of [-1,1]){
      const st=baseStart+delta*dir,en=st+duration;
      if(st<mins(s.settings.dayStart)||en>mins(s.settings.dayEnd))continue;
      const candidate={...request,start:time(st),end:time(en)};
      const c=conflictsFor(s,candidate);
      if(!c.length)all.push({type:'shift',date:request.date,start:candidate.start,end:candidate.end,resources:[...request.resources],substitutions:[],shiftMinutes:delta*dir,conflicts:c});
    }
  }

  // 3) Nearby day same time.
  const d=new Date(request.date+'T12:00:00');
  for(const dayDelta of [1,-1,2]){
    const nd=new Date(d);nd.setDate(nd.getDate()+dayDelta);const date=nd.toISOString().slice(0,10);
    const candidate={...request,date};
    const c=conflictsFor(s,candidate);
    if(!c.length)all.push({type:'day',date,start:request.start,end:request.end,resources:[...request.resources],substitutions:[],shiftMinutes:dayDelta*1440,conflicts:c});
  }

  for(const x of all)x.score=scoreSuggestion(baseStart,mins(x.start),x.substitutions,x.conflicts)+Math.abs((new Date(x.date)-new Date(request.date))/86400000)*200;
  const unique=new Map();
  for(const x of all.sort((a,b)=>a.score-b.score)){
    const key=[x.date,x.start,x.end,[...x.resources].sort().join(',')].join('|');if(!unique.has(key))unique.set(key,x);
  }
  return [...unique.values()].slice(0,6);
}
function utilization(s,date){
  const out={};
  const dayMinutes=mins(s.settings.dayEnd)-mins(s.settings.dayStart);
  for(const r of s.resources){
    let used=0;
    for(const b of s.bookings.filter(b=>b.date===date&&b.resources.includes(r.id))){
      const st=Math.max(mins(s.settings.dayStart),mins(b.start)),en=Math.min(mins(s.settings.dayEnd),mins(b.end));used+=Math.max(0,en-st);
    }
    out[r.id]=Math.min(100,Math.round(used/dayMinutes*100));
  }
  return out;
}

const server=http.createServer(async(req,res)=>{
  const parsed=url.parse(req.url,true),p=parsed.pathname,q=parsed.query;
  try{
    if(p==='/api/health')return send(res,200,{ok:true,service:'slot-scheduler',time:new Date().toISOString()});
    if(p==='/api/bootstrap'&&req.method==='GET'){
      const s=read(),date=q.date||'2026-09-12';
      return send(res,200,{settings:s.settings,resources:s.resources,bookings:s.bookings,audit:s.audit,utilization:utilization(s,date)});
    }
    if(p==='/api/availability'&&req.method==='POST'){
      const reqBody=await body(req),s=read();
      const required=['date','start','end','resources'];
      for(const k of required)if(reqBody[k]===undefined)return send(res,400,{error:`Missing ${k}`});
      if(!Array.isArray(reqBody.resources)||!reqBody.resources.length)return send(res,400,{error:'Choose at least one resource'});
      if(mins(reqBody.end)<=mins(reqBody.start))return send(res,400,{error:'End time must be after start time'});
      const conflicts=conflictsFor(s,reqBody),suggestions=conflicts.length?suggestionsFor(s,reqBody):[];
      return send(res,200,{available:conflicts.length===0,conflicts,suggestions});
    }
    if(p==='/api/bookings'&&req.method==='POST'){
      const payload=await body(req),s=read();
      const resources=[...new Set(payload.resources||[])].filter(id=>s.resources.some(r=>r.id===id&&r.active));
      if(!payload.title?.trim()||!payload.date||!payload.start||!payload.end||!resources.length)return send(res,400,{error:'Title, date, time and resources are required'});
      if(mins(payload.end)<=mins(payload.start))return send(res,400,{error:'End time must be after start time'});
      if(mins(payload.start)<mins(s.settings.dayStart)||mins(payload.end)>mins(s.settings.dayEnd))return send(res,400,{error:`Bookings must stay within ${s.settings.dayStart}–${s.settings.dayEnd}`});
      // Atomic recheck immediately before commit.
      const request={date:payload.date,start:payload.start,end:payload.end,resources};
      const conflicts=conflictsFor(s,request);
      if(conflicts.length)return send(res,409,{error:'Resources changed before booking could be confirmed',conflicts,suggestions:suggestionsFor(s,request)});
      const b={id:id('bk'),title:payload.title.trim().slice(0,100),date:payload.date,start:payload.start,end:payload.end,resources,organizer:(payload.organizer||'Studio team').trim().slice(0,80),status:'confirmed',kind:'booking',createdAt:new Date().toISOString()};
      s.bookings.push(b);s.audit.unshift({id:id('au'),type:'booking',title:`${b.title} confirmed`,detail:resources.map(x=>s.resources.find(r=>r.id===x)?.name).filter(Boolean).join(' · '),at:new Date().toISOString(),actor:b.organizer});write(s);
      return send(res,201,{booking:b});
    }
    if(/^\/api\/bookings\/[^/]+$/.test(p)&&req.method==='DELETE'){
      const bid=p.split('/').pop(),s=read(),idx=s.bookings.findIndex(b=>b.id===bid);
      if(idx<0)return send(res,404,{error:'Booking not found'});
      const [b]=s.bookings.splice(idx,1);
      s.audit.unshift({id:id('au'),type:'cancel',title:`${b.title} cancelled`,detail:`${b.date} · ${b.start}–${b.end}`,at:new Date().toISOString(),actor:'Studio team'});write(s);return send(res,200,{ok:true});
    }
    if(p==='/api/dev/competing'&&req.method==='POST'){
      const payload=await body(req),s=read(),rid=payload.resourceId||'camera-2';
      const b={id:id('bk'),title:'Last-minute internal hold',date:payload.date||'2026-09-12',start:payload.start||'13:00',end:payload.end||'14:00',resources:[rid],organizer:'Operations',status:'confirmed',kind:'hold',createdAt:new Date().toISOString()};
      s.bookings.push(b);s.audit.unshift({id:id('au'),type:'hold',title:'Competing hold created',detail:`${s.resources.find(r=>r.id===rid)?.name||rid} · ${b.start}–${b.end}`,at:new Date().toISOString(),actor:'Operations'});write(s);return send(res,201,b);
    }
    if(p==='/api/reset'&&req.method==='POST'){fs.copyFileSync(BASE,DATA);return send(res,200,{ok:true})}
    return staticFile(res,p);
  }catch(e){console.error(e);send(res,e.status||500,{error:e.message||'Server error'})}
});
server.listen(PORT,()=>console.log(`Slot running at http://localhost:${PORT}`));
