
import {FILE_NAME,catalogVersions,sanitizeDecisions,buildHandoff} from './handoff.mjs?v=1.2.0';
const $=id=>document.getElementById(id), data=await(await fetch('./data.json',{cache:'no-cache'})).json();
const versions=await catalogVersions(data.sets);
let decisions={};try{decisions=JSON.parse(localStorage.getItem('asset-displayer-lanternwake-review-v1')||'{}');}catch{}
decisions=sanitizeDecisions(decisions,data.sets,versions);
try{localStorage.setItem('asset-displayer-lanternwake-review-v1',JSON.stringify(decisions));}catch{}
let revision=0;
const handoffStatus=(text,error=false)=>{$('handoff-status').textContent=text;$('handoff-status').parentElement.classList.toggle('error',error);};
const snapshot=()=>buildHandoff(data.sets,versions,decisions,revision);
function persistBrowser(){try{localStorage.setItem('asset-displayer-lanternwake-review-v1',JSON.stringify(decisions));}catch{handoffStatus('Browser storage is unavailable. Download your handoff before closing this page.',true);}}
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
 $('title').textContent=String(s.number).padStart(2,'0')+' · '+s.name;$('approval').textContent=categoryLabels[s.approval_category]+(decisions[s.name]?.needsReview?' · Previous '+decisions[s.name].previousDecision+' needs source-version review':'');
 const [w,h]=s.actual_dimensions[0];$('canvas').width=w;$('canvas').height=h;$('scrub').max=s.frames.length-1;
 $('geometry').textContent=`${w} × ${h} native canvas · ${s.unique_png_files} unique PNGs · ${(s.duration_verified_ms/1000).toFixed(3)} seconds`;
 $('uuid').textContent='MJ UUID: '+s.source.mj_job_uuid;$('caveats').replaceChildren();
 for(const text of s.caveats||[]){const li=document.createElement('li');li.textContent=text;$('caveats').append(li);}
 $('decision').value=decisions[s.name]?.decision||'undecided';$('notes').value=decisions[s.name]?.notes||'';list();draw(0);
}
function save(){decisions[current.name]={decision:$('decision').value,notes:$('notes').value,mjJobUuid:current.source.mj_job_uuid,packageCategory:current.approval_category,assetFingerprint:versions.get(current.name)};persistBrowser();list();revision++;}
$('decision').onchange=save;$('notes').oninput=save;$('character').onchange=list;$('category').onchange=list;
$('play').onclick=()=>{playing=!playing;$('play').textContent=playing?'Pause':'Play';last=performance.now();};
function seek(i){playing=false;$('play').textContent='Play';i=Math.max(0,Math.min(current.frames.length-1,i));position=current.durations.slice(0,i).reduce((a,b)=>a+b,0);draw(i);}
$('previous').onclick=()=>seek(frame-1);$('next').onclick=()=>seek(frame+1);$('scrub').oninput=()=>seek(Number($('scrub').value));
$('pivot').onchange=()=>draw(frame);$('background').onchange=()=>$('stage').className='stage '+$('background').value;
$('export').onclick=()=>{const blob=new Blob([JSON.stringify(snapshot(),null,2)+'\n'],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=FILE_NAME;a.click();handoffStatus('Download requested. Attach '+FILE_NAME+' in chat when it finishes.');setTimeout(()=>URL.revokeObjectURL(a.href),1000);};
function tick(now){const delta=now-last;last=now;if(current&&playing){position+=delta*Number($('speed').value);if(position>=current.duration_verified_ms){if($('loop').checked)position%=current.duration_verified_ms;else{position=current.duration_verified_ms-.001;playing=false;$('play').textContent='Play';}}let sum=0,index=0;for(;index<current.durations.length-1;index++){sum+=current.durations[index];if(sum>position)break;}if(index!==frame)draw(index);for(let j=1;j<=3;j++)image((index+j)%current.frames.length).catch(()=>{});}requestAnimationFrame(tick);}
select(data.sets[0]);requestAnimationFrame(tick);
