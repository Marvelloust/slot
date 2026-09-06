
const Slot={
 data:null,date:'2026-09-12',selectedResources:new Set(),availability:null,draft:null,filter:'All',
 async init(){this.bind();await this.load();this.render()},
 bind(){
   document.addEventListener('click',e=>this.click(e));
   document.getElementById('newBookingBtn').addEventListener('click',()=>this.bookingDrawer());
   document.getElementById('auditBtn').addEventListener('click',()=>this.auditDrawer());
   document.getElementById('prevDay').addEventListener('click',()=>this.shiftDay(-1));
   document.getElementById('nextDay').addEventListener('click',()=>this.shiftDay(1));
   document.getElementById('dateBtn').addEventListener('click',()=>document.getElementById('dateInput').showPicker?.()||document.getElementById('dateInput').click());
   document.getElementById('dateInput').addEventListener('change',e=>{this.date=e.target.value;this.load().then(()=>this.render())});
   document.getElementById('modalBackdrop').addEventListener('click',()=>this.closeDrawer());
 },
 async load(){const r=await fetch(`./api/bootstrap?date=${encodeURIComponent(this.date)}`);this.data=await r.json()},
 async click(e){
   const rc=e.target.closest('[data-res]');if(rc){const id=rc.dataset.res;if(this.selectedResources.has(id))this.selectedResources.delete(id);else this.selectedResources.add(id);this.renderResourcePicker();return}
   const check=e.target.closest('#checkAvailability');if(check)return this.checkAvailability();
   const use=e.target.closest('[data-use-suggestion]');if(use)return this.useSuggestion(+use.dataset.useSuggestion);
   const confirm=e.target.closest('#confirmBooking');if(confirm)return this.confirmBooking();
   const block=e.target.closest('[data-booking]');if(block)return this.bookingDetail(block.dataset.booking);
   const cancel=e.target.closest('[data-cancel-booking]');if(cancel)return this.cancelBooking(cancel.dataset.cancelBooking);
   const close=e.target.closest('[data-close]');if(close)return this.closeDrawer();
   const compete=e.target.closest('#simulateCompetition');if(compete)return this.simulateCompetition();
   const boardFilter=e.target.closest('#resourceFilter');if(boardFilter)return this.filterDrawer();
   const filter=e.target.closest('[data-filter]');if(filter){this.filter=filter.dataset.filter;this.closeDrawer();this.render();return}
   const reset=e.target.closest('#resetDemo');if(reset)return this.reset();
 },
 render(){
   this.renderDate();this.renderSummary();this.renderBoard();this.renderUtilization();
 },
 renderDate(){
   const d=new Date(this.date+'T12:00:00');document.getElementById('dateLabel').textContent=d.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'}).toUpperCase();document.getElementById('dateSub').textContent=d.getFullYear();document.getElementById('dateInput').value=this.date;
 },
 renderSummary(){
   const day=this.data.bookings.filter(b=>b.date===this.date),confirmed=day.filter(b=>b.kind==='booking').length,blocked=day.filter(b=>b.kind==='maintenance').length,holds=day.filter(b=>b.kind==='hold').length;
   document.getElementById('summaryStats').innerHTML=`<div class="sum-stat"><span>BOOKINGS</span><strong>${confirmed}</strong></div><div class="sum-stat"><span>MAINTENANCE</span><strong>${blocked}</strong></div><div class="sum-stat"><span>HOLDS</span><strong>${holds}</strong></div>`;
 },
 resources(){return this.filter==='All'?this.data.resources:this.data.resources.filter(r=>r.type===this.filter||r.group===this.filter)},
 renderBoard(){
   const resources=this.resources(),start=this.min(this.data.settings.dayStart),end=this.min(this.data.settings.dayEnd);
   const hours=[];for(let m=start;m<end;m+=60)hours.push(m);
   document.getElementById('resourceFilter').textContent=`${this.filter==='All'?'All types':this.filter} ▾`;
   document.getElementById('timelineHead').innerHTML=hours.map(m=>`<div class="hour-label">${this.humanTime(this.tm(m))}</div>`).join('');
   document.getElementById('resourceLabels').innerHTML=resources.map(r=>`<div class="resource-label"><span class="res-dot ${r.color}"></span><div><strong>${r.name}</strong><small>${r.type} · ${r.bufferBefore}/${r.bufferAfter}m buffer</small></div></div>`).join('');
   document.getElementById('timelineGrid').innerHTML=resources.map(r=>this.row(r,start,end)).join('');
 },
 row(r,start,end){
   const blocks=this.data.bookings.filter(b=>b.date===this.date&&b.resources.includes(r.id));
   return `<div class="timeline-row">${blocks.map(b=>this.block(b,r,start,end)).join('')}</div>`;
 },
 block(b,r,start,end){
   const st=this.min(b.start),en=this.min(b.end),day=end-start,left=(st-start)/(day)*100,width=(en-st)/(day)*100;
   const bst=st-(r.bufferBefore||0),ben=en+(r.bufferAfter||0),bleft=(bst-start)/day*100,bwidth=(ben-bst)/day*100;
   return `<div class="buffer" style="left:${bleft}%;width:${bwidth}%"></div><button class="booking-block ${b.kind}" data-booking="${b.id}" style="left:${left}%;width:${width}%"><strong>${this.escape(b.title)}</strong><small>${this.humanTime(b.start)}–${this.humanTime(b.end)}</small></button>`;
 },
 renderUtilization(){
   document.getElementById('utilGrid').innerHTML=this.data.resources.map(r=>{const u=this.data.utilization[r.id]||0;return `<article class="util-card"><span>${r.name}</span><strong>${u}%</strong><div class="util-bar"><i style="width:${u}%"></i></div></article>`}).join('');
 },
 bookingDrawer(){
   this.selectedResources=new Set(['studio-a','camera-1','lighting-1']);this.availability=null;
   this.showDrawer(`<div class="drawer-head"><div><span class="eyebrow">NEW ALLOCATION</span><h2>Build a booking</h2></div><button class="close" data-close>×</button></div><div class="drawer-body"><div class="field"><label>BOOKING TITLE</label><input id="bookingTitle" value="Creator campaign shoot"></div><div class="field"><label>ORGANIZER</label><input id="organizer" value="Marvellous O."></div><div class="two"><div class="field"><label>DATE</label><input id="bookingDate" type="date" value="${this.date}"></div><div></div><div class="field"><label>START</label><input id="startTime" type="time" step="1800" value="13:00"></div><div class="field"><label>END</label><input id="endTime" type="time" step="1800" value="17:00"></div></div><div class="field"><label>RESOURCES</label><div class="resource-picker" id="resourcePicker"></div></div><button class="primary" id="checkAvailability" style="width:100%">Check constraints</button><div class="availability" id="availability"></div></div>`);
   this.renderResourcePicker();
 },
 renderResourcePicker(){
   const el=document.getElementById('resourcePicker');if(!el)return;
   el.innerHTML=this.data.resources.map(r=>`<button class="res-check ${this.selectedResources.has(r.id)?'active':''}" data-res="${r.id}"><strong>${r.name}</strong><small>${r.type} · ${r.bufferBefore}/${r.bufferAfter}m turnaround</small></button>`).join('');
 },
 request(){
   return {title:document.getElementById('bookingTitle').value.trim(),organizer:document.getElementById('organizer').value.trim(),date:document.getElementById('bookingDate').value,start:document.getElementById('startTime').value,end:document.getElementById('endTime').value,resources:[...this.selectedResources]};
 },
 async checkAvailability(){
   const req=this.request();if(!req.resources.length)return this.toast('Choose at least one resource');
   const r=await fetch('./api/availability',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(req)});const d=await r.json();if(!r.ok)return this.toast(d.error||'Could not check');
   this.availability=d;this.draft=req;this.renderAvailability();
 },
 renderAvailability(){
   const el=document.getElementById('availability');if(!el)return;
   if(!this.availability){el.innerHTML='';return}
   if(this.availability.available){el.innerHTML=`<div class="availability-ok"><strong>✓ Bundle available</strong><div style="margin-top:4px">All selected resources are clear including turnaround buffers.</div></div><button class="primary" id="confirmBooking" style="width:100%;margin-top:9px;background:var(--orange)">Confirm booking</button><button class="ghost" id="simulateCompetition" style="width:100%;margin-top:7px">Simulate stale option</button>`;return}
   const names=Object.fromEntries(this.data.resources.map(r=>[r.id,r.name]));
   el.innerHTML=`<div class="conflict-box"><h3>Constraint conflict</h3>${this.availability.conflicts.map(c=>`<div class="conflict"><strong>${c.resourceName} unavailable ${this.humanTime(c.busyStart)}–${this.humanTime(c.busyEnd)}</strong><small>${c.title} · blocked with buffer ${this.humanTime(c.busyWithBufferStart)}–${this.humanTime(c.busyWithBufferEnd)}</small></div>`).join('')}</div><div class="suggestions"><span>BEST ALTERNATIVES</span>${this.availability.suggestions.map((s,i)=>`<div class="suggestion"><div><strong>${this.suggestionTitle(s,names)}</strong><small>${this.prettyDate(s.date)} · ${this.humanTime(s.start)}–${this.humanTime(s.end)}</small></div><button data-use-suggestion="${i}">Use option</button></div>`).join('')||'<p style="font-size:9px;color:var(--muted)">No clean alternative found inside current search range.</p>'}</div><button class="ghost" id="simulateCompetition" style="width:100%;margin-top:10px">Simulate another team taking an option</button>`;
 },
 suggestionTitle(s,names){
   if(s.type==='substitute')return s.substitutions.map(x=>`${names[x.from]} → ${names[x.to]}`).join(' · ');
   if(s.type==='shift')return `${s.shiftMinutes>0?'Later':'Earlier'} by ${Math.abs(s.shiftMinutes)} min`;
   return `Same time on ${this.prettyDate(s.date)}`;
 },
 useSuggestion(i){
   const s=this.availability?.suggestions?.[i];if(!s)return;
   document.getElementById('bookingDate').value=s.date;document.getElementById('startTime').value=s.start;document.getElementById('endTime').value=s.end;this.selectedResources=new Set(s.resources);this.renderResourcePicker();this.availability={available:true,conflicts:[],suggestions:[]};this.draft=this.request();this.renderAvailability();this.toast('Alternative applied');
 },
 async confirmBooking(){
   const req=this.request();const r=await fetch('./api/bookings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(req)});const d=await r.json();
   if(r.status===409){this.availability={available:false,conflicts:d.conflicts,suggestions:d.suggestions};this.renderAvailability();return this.toast('Resources changed — choose a new option')}
   if(!r.ok)return this.toast(d.error||'Booking failed');
   this.date=req.date;await this.load();this.closeDrawer();this.render();this.toast('Booking confirmed');
 },
 async simulateCompetition(){
   if(this.availability?.available){
     const req=this.request();
     const rid=req.resources[0];
     await fetch('./api/dev/competing',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({resourceId:rid,date:req.date,start:req.start,end:this.tm(Math.min(this.min(req.end),this.min(req.start)+60))})});
     await this.load();
     this.toast('Another team just took part of this bundle. Confirm it to test the atomic recheck.');
     return;
   }
   const target=this.availability?.suggestions?.[0];if(!target)return this.toast('No suggestion available to compete for');
   const rid=target.resources.find(r=>!this.draft.resources.includes(r))||target.resources[0];
   await fetch('./api/dev/competing',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({resourceId:rid,date:target.date,start:target.start,end:this.tm(Math.min(this.min(target.end),this.min(target.start)+60))})});
   await this.load();this.toast('Another team placed a hold. Rechecking the original request…');this.availability=null;await this.checkAvailability();
 },
 bookingDetail(id){
   const b=this.data.bookings.find(x=>x.id===id);if(!b)return;const names=b.resources.map(id=>this.data.resources.find(r=>r.id===id)?.name).filter(Boolean);
   this.showDrawer(`<div class="drawer-head"><div><span class="eyebrow">${b.kind.toUpperCase()}</span><h2>${this.escape(b.title)}</h2></div><button class="close" data-close>×</button></div><div class="drawer-body"><div class="booking-detail"><span class="badge">${b.status}</span><h3>${this.prettyDate(b.date)} · ${this.humanTime(b.start)}–${this.humanTime(b.end)}</h3><p><strong>Resources</strong><br>${names.join(' · ')}</p><p><strong>Organizer</strong><br>${this.escape(b.organizer)}</p></div>${b.kind==='booking'||b.kind==='hold'?`<button class="danger" data-cancel-booking="${b.id}" style="width:100%;margin-top:12px">Cancel ${b.kind}</button>`:''}</div>`);
 },
 async cancelBooking(id){
   if(!confirm('Cancel this allocation?'))return;const r=await fetch(`./api/bookings/${id}`,{method:'DELETE'});if(!r.ok)return this.toast('Could not cancel');await this.load();this.closeDrawer();this.render();this.toast('Allocation cancelled');
 },
 filterDrawer(){
   const groups=['All','Space','Gear','Room','Studios','Camera','Lighting','Post','Audio'];
   this.showDrawer(`<div class="drawer-head"><div><span class="eyebrow">BOARD VIEW</span><h2>Filter resources</h2></div><button class="close" data-close>×</button></div><div class="drawer-body"><p style="font-size:9px;color:var(--muted);line-height:1.5;margin-top:0">Filter the planning board by resource type or operating group.</p><div class="resource-picker">${groups.map(g=>`<button class="res-check ${this.filter===g?'active':''}" data-filter="${g}"><strong>${g}</strong><small>${g==='All'?'Show the complete resource board':'Show matching resource lanes'}</small></button>`).join('')}</div></div>`);
 },
 auditDrawer(){
   this.showDrawer(`<div class="drawer-head"><div><span class="eyebrow">OPERATIONS</span><h2>Activity</h2></div><button class="close" data-close>×</button></div><div class="drawer-body"><div style="display:flex;gap:7px;margin-bottom:12px"><button class="ghost" data-filter="All">All resources</button><button class="ghost" data-filter="Space">Spaces</button><button class="ghost" data-filter="Gear">Gear</button><button class="ghost" data-filter="Room">Rooms</button></div>${this.data.audit.map(a=>`<div class="audit-item"><time>${new Date(a.at).toLocaleDateString([],{month:'short',day:'numeric'})}<br>${new Date(a.at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</time><div><strong>${this.escape(a.title)}</strong><p>${this.escape(a.detail)}</p><p>${this.escape(a.actor)}</p></div></div>`).join('')}<button class="danger" id="resetDemo" style="width:100%;margin-top:14px">Reset demo workspace</button></div>`);
 },
 async reset(){await fetch('./api/reset',{method:'POST'});this.date='2026-09-12';this.filter='All';await this.load();this.closeDrawer();this.render();this.toast('Slot reset')},
 shiftDay(delta){const d=new Date(this.date+'T12:00:00');d.setDate(d.getDate()+delta);this.date=d.toISOString().slice(0,10);this.load().then(()=>this.render())},
 showDrawer(html){document.getElementById('drawer').innerHTML=html;document.getElementById('drawer').classList.add('open');document.getElementById('modalBackdrop').classList.add('open')},
 closeDrawer(){document.getElementById('drawer').classList.remove('open');document.getElementById('modalBackdrop').classList.remove('open')},
 toast(msg){const t=document.createElement('div');t.className='toast';t.textContent=msg;document.getElementById('toasts').appendChild(t);setTimeout(()=>t.remove(),3000)},
 min(t){const [h,m]=String(t).split(':').map(Number);return h*60+m},tm(m){return `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`},
 humanTime(t){const [h,m]=t.split(':').map(Number);const ap=h>=12?'PM':'AM',hh=h%12||12;return `${hh}:${String(m).padStart(2,'0')} ${ap}`},prettyDate(s){return new Date(s+'T12:00:00').toLocaleDateString([],{weekday:'short',month:'short',day:'numeric'})},escape(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
};
Slot.init();
