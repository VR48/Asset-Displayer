
import {FILE_NAME,catalogVersions,sanitizeDecisions,buildHandoff,parseHandoff,importHandoff,HandoffWriter} from './handoff.mjs';
const $=id=>document.getElementById(id), data=await(await fetch('./data.json')).json();
const versions=await catalogVersions(data.sets);
let decisions={};try{decisions=JSON.parse(localStorage.getItem('asset-displayer-lanternwake-review-v1')||'{}');}catch{}
decisions=sanitizeDecisions(decisions,data.sets,versions);
try{localStorage.setItem('asset-displayer-lanternwake-review-v1',JSON.stringify(decisions));}catch{}
let writer=null,revision=0,saveTimer=null,pendingWrites=0;
const handoffStatus=(text,error=false)=>{$('handoff-status').textContent=text;$('handoff-status').parentElement.classList.toggle('error',error);};
const snapshot=()=>buildHandoff(data.sets,versions,decisions,revision);
function persistBrowser(){try{localStorage.setItem('asset-displayer-lanternwake-review-v1',JSON.stringify(decisions));}catch{handoffStatus('Browser storage is unavailable. Connect or download your handoff to keep changes.',true);}}
function flushHandoff(){
 clearTimeout(saveTimer);saveTimer=null;if(!writer)return;
 pendingWrites++;const connected=writer;const value=snapshot();
 connected.enqueue(value).catch(()=>{}).finally(()=>{pendingWrites--;});
}
function scheduleHandoff(){revision++;clearTimeout(saveTimer);if(writer){handoffStatus('Saving private handoff…');saveTimer=setTimeout(flushHandoff,300);}}
async function loadReview(value,{schedule=true}={}){
 const incoming=importHandoff(value,data.sets,versions);
 if(incoming.unknown.length)throw Error('This handoff includes assets outside the current gallery. Keep it for the archived assets; no decisions were imported.');
 const hasWork=Object.values(decisions).some(d=>d.decision!=='undecided'||d.notes);
 if(hasWork&&!confirm('Replace the decisions shown in this browser with this handoff? Your existing file remains unchanged until you connect or save.'))return false;
 decisions=incoming.decisions;persistBrowser();if(current)select(current);if(schedule)scheduleHandoff();return true;
}
if(!('showSaveFilePicker' in window)){$('connect').disabled=true;$('connect').title='Use Chrome or Edge to connect a local file. Download handoff works in this browser.';handoffStatus('This browser can download/import handoffs. Open this site in Chrome or Edge for automatic updates to one local file.');}
let current,frame=0,position=0,playing=true,last=performance.now(),generation=0;
const cache=new Map(),ctx=$('canvas').getContext('2d');
const character=s=>s.name.toLowerCase().includes('seb')?'Seb':['Rook','Kest','Mica','Vale','Chaser','Runner','Heavy'].find(c=>s.name.includes(c.toLowerCase()))||'Other';
const categoryLabels={'01_OWNER_APPROVED':'01 · Owner approved','02_OWNER_SELECTED_SOURCES':'02 · Selected source / compromise','03_ALTERNATIVES_AND_DERIVED_CUTS':'03 · Alternative / derived cut','04_REVIEW_CONDITIONAL':'04 · Conditional review','05_TECHNICAL_PORT_PENDING_VISUAL_REVIEW':'05 · Seb port — visual review'};
for(const value of [...new Set(data.sets.map(character))]){const o=document.createElement('option');o.value=value;o.textContent=value;$('character').append(o);}
for(const [value,label] of Object.entries(categoryLabels)){const o=document.createElement('option');o.value=value;o.textContent=label;$('category').append(o);}
function list(){
 $('list').replaceChildren();const shown=data.sets.filter(s=>(!$('character').value||character(s)===$('character').value)&&(!$('category').value||s.approval_category===$('category').value));
 $('counts').textContent=shown.length+' sets · '+Object.keys(decisions).filter(k=>decisions[k].decision!=='undecided').length+' choices saved';
 for(const s of shown){const b=document.createElement('button');b.className='clip'+(current?.number===s.number?' active':'');b.textContent=String(s.number).padStart(2,'0')+' · '+s.name;const sub=document.createElement('span');sub.textContent=s.approval_category.slice(0,2)+' · '+s.frames.length+' frames · '+(s.duration_verified_ms/1000).toFixed(2)+'s · '+(decisions[s.name]?.decision||'undecided');b.append(sub);b.onclick=()=>select(s);$('list').append(b);}
}
function image(index){
 const key=current.frames[index].url;
 if(cache.has(key))return cache.get(key);
 const img=new Image();const p=new Promise((resolve,reject)=>{img.onload=()=>resolve(img);img.onerror=reject;});img.src=current.frames[index].url;cache.set(key,p);
 if(cache.size>12)cache.delete(cache.keys().next().value);return p;
}
async function draw(index){
 frame=index;$('scrub').value=index;
 const selected=current,stamp=generation;
 $('time').textContent=`${index+1} / ${selected.frames.length} · ${(position/1000).toFixed(2)}s`;
 $('frameInfo').textContent=`Source frame ${selected.frames[index].source_frame??'?'} · ${selected.durations[index].toFixed(3)} ms · offsets retained as provenance`;
 try{const img=await image(index);if(stamp!==generation||frame!==index)return;ctx.clearRect(0,0,$('canvas').width,$('canvas').height);ctx.drawImage(img,0,0);
  if($('pivot').checked){const g=selected.geometry,a=g.anchor??g.native_anchor??g.fixed_native_anchor;if(a){ctx.strokeStyle='#ffd45c';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(a[0]-14,a[1]);ctx.lineTo(a[0]+14,a[1]);ctx.moveTo(a[0],a[1]-14);ctx.lineTo(a[0],a[1]+14);ctx.stroke();}}
 }catch{$('time').textContent='Frame could not be loaded';}
}
function select(s){
 generation++;cache.clear();current=s;position=0;frame=0;last=performance.now();
 $('title').textContent=String(s.number).padStart(2,'0')+' · '+s.name;$('approval').textContent=categoryLabels[s.approval_category];
 const [w,h]=s.actual_dimensions[0];$('canvas').width=w;$('canvas').height=h;$('scrub').max=s.frames.length-1;
 $('geometry').textContent=`${w} × ${h} native canvas · ${s.unique_png_files} unique PNGs · ${(s.duration_verified_ms/1000).toFixed(3)} seconds`;
 $('uuid').textContent='MJ UUID: '+s.source.mj_job_uuid;$('caveats').replaceChildren();
 for(const text of s.caveats||[]){const li=document.createElement('li');li.textContent=text;$('caveats').append(li);}
 $('decision').value=decisions[s.name]?.decision||'undecided';$('notes').value=decisions[s.name]?.notes||'';list();draw(0);
}
function save(){decisions[current.name]={decision:$('decision').value,notes:$('notes').value,mjJobUuid:current.source.mj_job_uuid,packageCategory:current.approval_category,assetFingerprint:versions.get(current.name)};persistBrowser();list();scheduleHandoff();}
$('decision').onchange=save;$('notes').oninput=save;$('character').onchange=list;$('category').onchange=list;
$('play').onclick=()=>{playing=!playing;$('play').textContent=playing?'Pause':'Play';last=performance.now();};
function seek(i){playing=false;$('play').textContent='Play';i=Math.max(0,Math.min(current.frames.length-1,i));position=current.durations.slice(0,i).reduce((a,b)=>a+b,0);draw(i);}
$('previous').onclick=()=>seek(frame-1);$('next').onclick=()=>seek(frame+1);$('scrub').oninput=()=>seek(Number($('scrub').value));
$('pivot').onchange=()=>draw(frame);$('background').onchange=()=>$('stage').className='stage '+$('background').value;
$('export').onclick=()=>{const blob=new Blob([JSON.stringify(snapshot(),null,2)+'\n'],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=FILE_NAME;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);};
$('connect').onclick=async()=>{
 try{
  const handle=await window.showSaveFilePicker({suggestedName:FILE_NAME,types:[{description:'Asset review handoff JSON',accept:{'application/json':['.json']}}],excludeAcceptAllOption:true});
  const file=await handle.getFile();if(file.size>2000000)throw Error('Choose a handoff file smaller than 2 MB.');
  const text=await file.text();
  if(text.trim()){
   const value=parseHandoff(text);const incoming=importHandoff(value,data.sets,versions);
   if(incoming.unknown.length)throw Error('This file contains archived/unknown assets. Use a new handoff file for this gallery.');
   const fileHasWork=Object.values(incoming.decisions).some(d=>d.decision!=='undecided'||d.notes);
   const different=data.sets.some(s=>(decisions[s.name]?.decision??'undecided')!==(incoming.decisions[s.name]?.decision??'undecided')||(decisions[s.name]?.notes??'')!==(incoming.decisions[s.name]?.notes??''));
   if(fileHasWork&&different){if(!await loadReview(value,{schedule:false}))return;}
  }
  clearTimeout(saveTimer);saveTimer=null;if(writer)await writer.disconnect();
  writer=new HandoffWriter(handle,text,(state,detail)=>{
   if(state==='saving')handoffStatus('Saving private handoff to '+handle.name+'…');
   else if(state==='saved')handoffStatus(saveTimer||pendingWrites>1?'Saving latest private handoff…':'Private handoff saved to '+handle.name+' at '+new Date(detail).toLocaleTimeString()+'. Reconnect this file after reloading the page.');
   else if(state==='error')handoffStatus('Handoff not saved: '+detail+' Browser choices are retained; reconnect or download.',true);
  });
  $('disconnect').hidden=false;$('connect').textContent='Reconnect / choose file';revision++;flushHandoff();
 }catch(error){if(error.name!=='AbortError')handoffStatus('Could not connect: '+error.message,true);}
};
$('disconnect').onclick=async()=>{clearTimeout(saveTimer);saveTimer=null;const prior=writer;writer=null;await prior?.disconnect();$('disconnect').hidden=true;$('connect').textContent='Connect handoff file';handoffStatus('File disconnected. New changes stay in this browser until connected or downloaded.');};
$('import').onclick=()=>$('import-file').click();
$('import-file').onchange=async()=>{try{const file=$('import-file').files[0];if(!file)return;if(file.size>2000000)throw Error('Handoff exceeds 2 MB.');if(await loadReview(parseHandoff(await file.text())))handoffStatus(writer?'Review imported; saving to the connected handoff…':'Review imported privately. Connect or download to save a handoff.');}catch(error){handoffStatus('Import stopped: '+error.message,true);}finally{$('import-file').value='';}};
window.addEventListener('beforeunload',event=>{if(writer&&(saveTimer||pendingWrites)){event.preventDefault();event.returnValue='';}});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&saveTimer)flushHandoff();});
function tick(now){const delta=now-last;last=now;if(current&&playing){position+=delta*Number($('speed').value);if(position>=current.duration_verified_ms){if($('loop').checked)position%=current.duration_verified_ms;else{position=current.duration_verified_ms-.001;playing=false;$('play').textContent='Play';}}let sum=0,index=0;for(;index<current.durations.length-1;index++){sum+=current.durations[index];if(sum>position)break;}if(index!==frame)draw(index);for(let j=1;j<=3;j++)image((index+j)%current.frames.length).catch(()=>{});}requestAnimationFrame(tick);}
select(data.sets[0]);requestAnimationFrame(tick);
