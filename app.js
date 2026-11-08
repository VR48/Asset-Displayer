
import {FILE_NAME,catalogVersions,sanitizeDecisions,buildHandoff,sourceIdentity} from './handoff.mjs?v=1.14.0';
import {frameAt,baselineFor,comparisonBounds} from './comparison.mjs?v=1.14.0';
const $=id=>document.getElementById(id), data=await(await fetch('./data.json',{cache:'no-cache'})).json();
const comparisons=await(await fetch('./comparisons.json',{cache:'no-cache'})).json();
const versions=await catalogVersions(data.sets);
let decisions={};try{decisions=JSON.parse(localStorage.getItem('asset-displayer-lanternwake-review-v1')||'{}');}catch{}
decisions=sanitizeDecisions(decisions,data.sets,versions);
try{localStorage.setItem('asset-displayer-lanternwake-review-v1',JSON.stringify(decisions));}catch{}
let revision=0;
const handoffStatus=(text,error=false)=>{$('handoff-status').textContent=text;$('handoff-status').parentElement.classList.toggle('error',error);};
const snapshot=()=>buildHandoff(data.sets,versions,decisions,revision);
function persistBrowser(){try{localStorage.setItem('asset-displayer-lanternwake-review-v1',JSON.stringify(decisions));}catch{handoffStatus('Browser storage is unavailable. Download your handoff before closing this page.',true);}}
let current,frame=0,position=0,elapsed=0,playing=true,last=performance.now(),generation=0,comparing=false,baseline=null,originalFrame=-1,originalPaint=0;
const cache=new Map();
const character=s=>s.usage?.character??'Other';
const categoryLabels={'01_OWNER_APPROVED':'01 · Owner approved','02_OWNER_SELECTED_SOURCES':'02 · Selected source / compromise','03_ALTERNATIVES_AND_DERIVED_CUTS':'03 · Alternative / derived cut','04_REVIEW_CONDITIONAL':'04 · Conditional review','05_TECHNICAL_PORT_PENDING_VISUAL_REVIEW':'05 · Seb port — visual review','06_NEW_CHARACTER_CANDIDATES':'06 · New character candidates'};
for(const value of [...new Set(data.sets.map(character))]){const o=document.createElement('option');o.value=value;o.textContent=value;$('character').append(o);}
for(const [value,label] of Object.entries(categoryLabels)){const o=document.createElement('option');o.value=value;o.textContent=label;$('category').append(o);}
function list(){
 $('list').replaceChildren();const shown=data.sets.filter(s=>(!$('character').value||character(s)===$('character').value)&&(!$('category').value||s.approval_category===$('category').value));
 $('counts').textContent=shown.length+' sets · '+Object.keys(decisions).filter(k=>decisions[k].decision!=='undecided').length+' choices saved';
 for(const s of shown){const b=document.createElement('button');b.className='clip'+(current?.number===s.number?' active':'');b.textContent=String(s.number).padStart(2,'0')+' · '+s.name;const sub=document.createElement('span');sub.textContent=s.usage.action+' · '+s.usage.direction+' · '+(s.replacement?'Replacement candidate':'New feature')+' · '+(decisions[s.name]?.decision||'undecided');b.append(sub);b.onclick=()=>select(s);$('list').append(b);}
}
function image(index,set=current){
 const key=set.frames[index].url;
 if(cache.has(key))return cache.get(key);
 const img=new Image();const p=new Promise((resolve,reject)=>{img.onload=()=>resolve(img);img.onerror=reject;});img.src=set.frames[index].url;cache.set(key,p);
 if(cache.size>24)cache.delete(cache.keys().next().value);return p;
}
function paint(canvas,img,geometry){
 const c=canvas.getContext('2d');c.clearRect(0,0,canvas.width,canvas.height);c.save();
 const a=geometry.anchor??geometry.native_anchor??geometry.fixed_native_anchor;
 if(comparing){const [left,top,right,bottom]=comparisonBounds(current.geometry,baseline.geometry),scale=580/Math.max(right-left,bottom-top),s=geometry.renderScale??geometry.render_scale??geometry.fixed_render_scale;
  c.translate(320-(left+right)*scale/2,320-(top+bottom)*scale/2);c.scale(scale*s,scale*s);c.translate(-a[0],-a[1]);}
 c.drawImage(img,0,0);
 if($('pivot').checked&&a){c.strokeStyle='#ffd45c';c.lineWidth=2;c.beginPath();c.moveTo(a[0]-14,a[1]);c.lineTo(a[0]+14,a[1]);c.moveTo(a[0],a[1]-14);c.lineTo(a[0],a[1]+14);c.stroke();}c.restore();
}
async function drawOriginal(force=false){
 if(!comparing||!baseline)return;const index=frameAt(baseline.durations,elapsed,$('loop').checked);
 if(!force&&index===originalFrame)return;originalFrame=index;const selected=baseline,stamp=generation,paintId=++originalPaint;
 $('original-info').textContent=`${index+1} / ${baseline.frames.length} · ${baseline.frames[index].phase} · ${(baseline.duration_verified_ms/1000).toFixed(2)}s preview · ${baseline.timing}`;
 try{const img=await image(index,selected);if(stamp!==generation||paintId!==originalPaint||!comparing)return;paint($('original-canvas'),img,selected.geometry);}catch{if(stamp===generation&&comparing)$('original-info').textContent='Original frame could not be loaded. Check your connection before reviewing this comparison.';}
}
async function draw(index){
 frame=index;$('scrub').value=index;
 const selected=current,stamp=generation;
 $('time').textContent=selected.media_kind==='image'?'Still reference':`${index+1} / ${selected.frames.length} · ${(position/1000).toFixed(2)}s`;
 $('frameInfo').textContent=selected.media_kind==='image'?'Original RGBA still · source review geometry retained':`Source frame ${selected.frames[index].source_frame??'?'} · ${selected.durations[index].toFixed(3)} ms · ${selected.source.preview_basis==='decoded-original-video'?'original video timing retained':selected.source.provider==='Pika'?'chronological preview timing retained':'offsets retained as provenance'}`;
 try{const img=await image(index);if(stamp!==generation||frame!==index)return;paint($('canvas'),img,selected.geometry);
 }catch{$('time').textContent='Frame could not be loaded';}
}
function select(s){
 generation++;cache.clear();current=s;position=0;elapsed=0;frame=0;last=performance.now();comparing=false;baseline=baselineFor(s,comparisons);originalFrame=-1;originalPaint++;
 $('title').textContent=String(s.number).padStart(2,'0')+' · '+s.name;$('approval').textContent=categoryLabels[s.approval_category]+(decisions[s.name]?.needsReview?' · Previous '+decisions[s.name].previousDecision+' needs source-version review':'');
 const [w,h]=s.actual_dimensions[0];$('canvas').width=w;$('canvas').height=h;$('scrub').max=s.frames.length-1;
 const still=s.media_kind==='image';
 $('pixel-status').textContent=s.source.preview_basis==='decoded-original-video'?'Raw MJ video preview. Magenta retained; not cleaned or stabilized.':still?'Source pixels retained. No runtime installation.':'Delivered PNGs only. Stabilization offsets are not applied again.';
 const original=s.original_video?.url;if(original&&/^videos\/[a-f0-9]{64}\.mp4$/.test(original)){$('original-video-download').href=original;$('original-video-download').download=s.name+'.mp4';$('original-video-download').hidden=false;}else{$('original-video-download').hidden=true;$('original-video-download').removeAttribute('href');}
 $('geometry').textContent=`${w} × ${h} native canvas · ${still?'Still reference (not animated)':s.unique_png_files+' unique PNGs · '+(s.duration_verified_ms/1000).toFixed(3)+' seconds'}`;
 $('uuid').textContent=s.source.mj_job_uuid?'MJ UUID: '+s.source.mj_job_uuid:s.source.provider+(s.source.job_id?' · Job: '+s.source.job_id:' · Source SHA-256: '+s.source.sha256);$('caveats').replaceChildren();
 for(const id of ['play','previous','next','scrub','speed','loop'])$(id).disabled=still;
 if(still)playing=false;$('play').textContent=still?'Still image':playing?'Pause':'Play';
 for(const text of s.caveats||[]){const li=document.createElement('li');li.textContent=text;$('caveats').append(li);}
 $('decision').value=decisions[s.name]?.decision||'undecided';$('notes').value=decisions[s.name]?.notes||'';list();draw(0);
 $('usage').textContent=`${s.usage.character} · ${s.usage.action} · ${s.usage.direction} · ${s.usage.attacking?'Attacking in this direction':'Not firing'}`;
 $('comparison-reason').textContent=baseline?`Existing slot: ${s.replacement.slot} · ${s.replacement.phase}. Compare against the Original runtime bank snapshot (${comparisons.sourceCommit.slice(0,8)}). Approval applies to this slot and phase only.`:s.usage.reason??'The original for this target is unavailable.';
 $('compare').hidden=!baseline;$('compare').textContent='Compare';$('compare').setAttribute('aria-pressed','false');$('previews').classList.remove('comparing');$('original-pane').hidden=true;$('candidate-label').hidden=true;
 $('original-info').textContent='';
 $('replacement-row').hidden=!baseline;$('replace-approved').disabled=!baseline;$('replace-approved').checked=decisions[s.name]?.replaceApproved===true;
 $('replacement-label').textContent=baseline?`Authorize replacing ${s.replacement.slot} (${s.replacement.phase}) with this candidate.`:'';
}
function save(){if($('decision').value!=='keep')$('replace-approved').checked=false;decisions[current.name]={decision:$('decision').value,notes:$('notes').value,mjJobUuid:current.source.mj_job_uuid,sourceKey:sourceIdentity(current),packageCategory:current.approval_category,assetFingerprint:versions.get(current.name),replaceApproved:!!baseline&&$('replace-approved').checked,replacementFingerprint:current.replacement?.baselineFingerprint};persistBrowser();list();revision++;}
$('replace-approved').onchange=()=>{if($('replace-approved').checked)$('decision').value='keep';save();};
$('compare').onclick=()=>{if(!baseline)return;comparing=!comparing;generation++;originalPaint++;originalFrame=-1;$('previews').classList.toggle('comparing',comparing);$('original-pane').hidden=!comparing;$('candidate-label').hidden=!comparing;$('compare').textContent=comparing?'Close comparison':'Compare';$('compare').setAttribute('aria-pressed',String(comparing));$('original-label').textContent=`Current original · ${current.replacement.slot} · ${baseline.phase}`;
 const [w,h]=current.actual_dimensions[0];$('canvas').width=comparing?640:w;$('canvas').height=comparing?640:h;$('original-canvas').width=640;$('original-canvas').height=640;draw(frame);drawOriginal(true);};
$('decision').onchange=save;$('notes').oninput=save;$('character').onchange=list;$('category').onchange=list;
$('play').onclick=()=>{playing=!playing;$('play').textContent=playing?'Pause':'Play';last=performance.now();};
function seek(i){playing=false;$('play').textContent='Play';i=Math.max(0,Math.min(current.frames.length-1,i));elapsed=position=current.durations.slice(0,i).reduce((a,b)=>a+b,0);draw(i);drawOriginal(true);}
$('previous').onclick=()=>seek(frame-1);$('next').onclick=()=>seek(frame+1);$('scrub').oninput=()=>seek(Number($('scrub').value));
$('pivot').onchange=()=>{draw(frame);drawOriginal(true);};$('background').onchange=()=>{for(const id of ['stage','original-stage'])$(id).className='stage '+$('background').value;};
$('export').onclick=()=>{const blob=new Blob([JSON.stringify(snapshot(),null,2)+'\n'],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=FILE_NAME;a.click();handoffStatus('Download requested. Attach '+FILE_NAME+' in chat when it finishes.');setTimeout(()=>URL.revokeObjectURL(a.href),1000);};
function tick(now){const delta=now-last;last=now;if(current&&playing){elapsed+=delta*Number($('speed').value);const duration=comparing?Math.max(current.duration_verified_ms,baseline.duration_verified_ms):current.duration_verified_ms;if(!$('loop').checked&&elapsed>=duration){elapsed=duration-.001;playing=false;$('play').textContent='Play';}position=$('loop').checked?elapsed%current.duration_verified_ms:Math.min(elapsed,current.duration_verified_ms-.001);const index=frameAt(current.durations,position,false);if(index!==frame)draw(index);drawOriginal();for(let j=1;j<=3;j++)image((index+j)%current.frames.length).catch(()=>{});}requestAnimationFrame(tick);}
select(data.sets[0]);requestAnimationFrame(tick);
