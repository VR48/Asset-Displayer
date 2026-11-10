import {pendingRedoNotes} from './redo-slots.mjs?v=1.28.0';
import {previewAnchor,drawAnchor} from './anchor.mjs?v=1.28.0';

import {FILE_NAME,catalogVersions,buildHandoff,sourceIdentity} from './handoff.mjs?v=1.28.0';
import {frameAt,baselineFor,comparisonBounds} from './comparison.mjs?v=1.28.0';
import {STORAGE_KEY,LEGACY_STORAGE_KEY,validateReviewState,loadReviewSession} from './review-state.mjs?v=1.28.0';
import {reviewNavigation,initialReviewCandidate} from './review-navigation.mjs?v=1.28.0';
const $=id=>document.getElementById(id), data=await(await fetch('./data.json',{cache:'no-cache'})).json();
const comparisons=await(await fetch('./comparisons.json',{cache:'no-cache'})).json();
const APP_VERSION='1.28.0';$('ad-version').textContent='v'+APP_VERSION;
const versions=await catalogVersions(data.sets);
let published;
try{const response=await fetch('./review-state.json',{cache:'no-cache'});if(!response.ok)throw Error('Saved status request failed.');published=validateReviewState(await response.json());}
catch(error){$('handoff-status').textContent='Saved decisions could not be loaded. Reload before reviewing or downloading a handoff.';$('export').disabled=true;throw error;}
let stored=null,legacy=null;try{stored=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');legacy=JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY)||'null');}catch{}
const restored=loadReviewSession(published,stored,legacy,data.sets,versions),session=restored.session;
session.redoNotes=pendingRedoNotes(data.redo_slots??[],stored,legacy);
let decisions=restored.decisions,revision=session.editRevision;
const handoffStatus=(text,error=false)=>{$('handoff-status').textContent=text;$('handoff-status').parentElement.classList.toggle('error',error);};
const snapshot=()=>({...buildHandoff(data.sets,versions,decisions,revision,data.redo_slots??[],session.redoNotes),adVersion:APP_VERSION});
function persistBrowser(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(session));}catch{handoffStatus('Browser storage is unavailable. Download your handoff before closing this page.',true);}}
persistBrowser();
let current,frame=0,position=0,elapsed=0,playing=true,last=performance.now(),generation=0,comparing=false,baseline=null,originalFrame=-1,originalPaint=0;
const cache=new Map(),nativeSample=document.createElement('canvas');let nativeAnchor=null;nativeSample.width=160;nativeSample.height=240;const nativeContext=nativeSample.getContext('2d',{willReadFrequently:true});
function paintNativeAnchor(){const overlay=$('anchor-overlay');overlay.hidden=!$('pivot').checked||current?.review_mode!=='native-video';if(overlay.hidden||!nativeAnchor)return;const c=overlay.getContext('2d');c.clearRect(0,0,overlay.width,overlay.height);const v=$('native-video');if(v.readyState>=2){nativeContext.drawImage(v,0,0,160,240);drawAnchor(c,nativeAnchor,nativeContext,$('background').value);}}
const character=s=>s.usage?.character??'Other';
const decisionLabels={undecided:'Undecided',keep:'Keep candidate',hold:'Modify/Fix',skip:'Redo',delete:'Delete candidate'};
function decisionVisuals(){const state=decisions[current.name]?.decision??'undecided';$('decision').dataset.decision=state;$('candidate-panel').dataset.decision=state;$('decision-info').textContent=state==='skip'?'This version will be archived and removed when your handoff is applied; its slot awaits a new version.':state==='delete'?'Marked for deletion when your handoff is applied in the next update.':decisionLabels[state];}
const categoryLabels={'01_OWNER_APPROVED':'01 · Owner approved','02_OWNER_SELECTED_SOURCES':'02 · Selected source / compromise','03_ALTERNATIVES_AND_DERIVED_CUTS':'03 · Alternative / derived cut','04_REVIEW_CONDITIONAL':'04 · Conditional review','05_TECHNICAL_PORT_PENDING_VISUAL_REVIEW':'05 · Seb port — visual review','06_NEW_CHARACTER_CANDIDATES':'06 · New character candidates'};
for(const value of [...new Set([...data.sets.map(character),...(data.redo_slots??[]).map(s=>s.character)])]){const o=document.createElement('option');o.value=value;o.textContent=value;$('character').append(o);}
for(const [value,label] of Object.entries(categoryLabels)){const o=document.createElement('option');o.value=value;o.textContent=label;$('category').append(o);}
const collapsedBranches=new Set(),filteredExpansion=new Map();
function assetButton(s,role=''){
 const b=document.createElement('button'),state=decisions[s.name]?.decision??'undecided',selected=current?.name===s.name;
 b.type='button';b.className='clip'+(selected?' active':'');b.dataset.asset=s.name;b.dataset.navigation='asset:'+s.name;b.dataset.decision=state;b.setAttribute('aria-pressed',String(selected));
 b.textContent=String(s.number).padStart(2,'0')+' · '+(role?role+' · ':'')+(s.branch_label?s.branch_label+' · ':'')+s.name;
 const sub=document.createElement('span');sub.textContent=s.usage.action+' · '+s.usage.direction+' · '+(s.replacement?'Replacement candidate':'New feature')+' · '+decisionLabels[state];b.append(sub);b.onclick=()=>select(s);return b;
}
function branchGroup(node,filtering,partition){
 const {set,children,selectable}=node;
 if(!children.length)return assetButton(set);
 const group=document.createElement('div'),items=document.createElement('div');
 items.className='branch-items';
 if(!selectable){
  const context=document.createElement('p');context.className='source-context';context.textContent='Source context · '+set.name;
  group.className='branch-context';for(const child of children)items.append(branchGroup(child,filtering,partition));group.append(context,items);return group;
 }
 const key=partition+':'+set.name,toggle=document.createElement('button'),expanded=filtering?(filteredExpansion.get(key)??true):!collapsedBranches.has(key);
 group.className='branch-group';toggle.type='button';toggle.className='branch-toggle';toggle.dataset.navigation='group:'+key;
 items.id='branch-items-'+partition+'-'+set.number;items.hidden=!expanded;toggle.setAttribute('aria-controls',items.id);
 const update=()=>{toggle.setAttribute('aria-expanded',String(!items.hidden));toggle.textContent=(items.hidden?'▸ ':'▾ ')+set.name;};
 toggle.onclick=()=>{items.hidden=!items.hidden;if(filtering)filteredExpansion.set(key,!items.hidden);else if(items.hidden)collapsedBranches.add(key);else collapsedBranches.delete(key);update();};update();
 items.append(assetButton(set,'Source'));for(const child of children)items.append(branchGroup(child,filtering,partition));group.append(toggle,items);return group;
}
function list(){
 const focusKey=$('list').contains(document.activeElement)?document.activeElement.dataset.navigation:null;
 const {review,approved,pending,reviewCount,approvedCount}=reviewNavigation(data.sets,decisions,data.redo_slots??[],{character:$('character').value,category:$('category').value}),filtering=!!($('character').value||$('category').value);
 // Keep the native details/summary mounted: open state and keyboard focus survive
 // notes, decisions and filter rerenders without switching the current panel.
 $('review-list').replaceChildren();$('approved-list').replaceChildren();
 $('counts').textContent=reviewCount+' review · '+approvedCount+' approved · '+pending.length+' pending · '+Object.keys(decisions).filter(k=>decisions[k].decision!=='undecided').length+' choices saved';
 $('review-heading').textContent='For review ('+reviewCount+')';
 $('approved-summary').textContent='Owner approved ('+approvedCount+')';
 $('review-empty').hidden=!!(reviewCount||pending.length);
 const entries=[...review.map(node=>({node,number:node.set.number})),...pending.map(slot=>({pending:slot,number:slot.number}))].sort((a,b)=>a.number-b.number);
 for(const entry of entries){
  if(entry.node){$('review-list').append(branchGroup(entry.node,filtering,'review'));continue;}
  const slot=entry.pending,b=document.createElement('button');b.type='button';b.className='clip pending';b.disabled=true;b.textContent=String(slot.number).padStart(2,'0')+' · '+slot.id+' · v'+slot.nextVersion+' pending';const sub=document.createElement('span');sub.textContent='Awaiting replacement · '+slot.direction;b.append(sub);$('review-list').append(b);
 }
 for(const node of approved)$('approved-list').append(branchGroup(node,filtering,'approved'));
 if(focusKey)for(const b of $('list').querySelectorAll('[data-navigation]'))if(b.dataset.navigation===focusKey){
  if($('approved-list').contains(b)&&!$('owner-approved').open)$('approved-summary').focus({preventScroll:true});else b.focus({preventScroll:true});break;
 }
}
function image(index,set=current){
 const key=set.frames[index].url;
 if(cache.has(key))return cache.get(key);
 const img=new Image();const p=new Promise((resolve,reject)=>{img.onload=()=>resolve(img);img.onerror=reject;});img.src=set.frames[index].url;cache.set(key,p);
 if(cache.size>24)cache.delete(cache.keys().next().value);return p;
}
function paint(canvas,img,geometry){
 const c=canvas.getContext('2d');c.clearRect(0,0,canvas.width,canvas.height);c.save();
 const a=previewAnchor(img,geometry);
 if(comparing){const [left,top,right,bottom]=comparisonBounds(current.geometry,baseline.geometry),scale=580/Math.max(right-left,bottom-top),s=geometry.renderScale??geometry.render_scale??geometry.fixed_render_scale;
  c.translate(320-(left+right)*scale/2,320-(top+bottom)*scale/2);c.scale(scale*s,scale*s);c.translate(-a[0],-a[1]);}
 c.drawImage(img,0,0);
 const point=new DOMPoint(...a).matrixTransform(c.getTransform());c.restore();if($('pivot').checked)drawAnchor(c,[point.x,point.y],c,$('background').value);
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
 if(selected.review_mode==='native-video'){ $('time').textContent='Native video controls';$('frameInfo').textContent=selected.native_frame_count+' frames · native video controls';try{const img=await image(0);if(stamp===generation){nativeAnchor=previewAnchor(img,selected.geometry);paintNativeAnchor();}}catch{}return;}
 $('frameInfo').textContent=selected.media_kind==='image'?'Original RGBA still · source review geometry retained':`Source frame ${selected.frames[index].source_frame??'?'} · ${selected.durations[index].toFixed(3)} ms · ${selected.source.preview_basis==='decoded-original-video'?'original video timing retained':selected.source.provider==='Pika'?'chronological preview timing retained':'offsets retained as provenance'}`;
 try{const img=await image(index,selected);if(!(selected.geometry.anchor??selected.geometry.native_anchor??selected.geometry.fixed_native_anchor))previewAnchor(await image(0,selected),selected.geometry);if(stamp!==generation||frame!==index)return;paint($('canvas'),img,selected.geometry);
 }catch{if(stamp===generation&&frame===index)$('time').textContent='Frame could not be loaded';}
}
function select(s){
 const video=$('native-video');video.pause();video.removeAttribute('src');video.load();video.hidden=true;$('native-player').hidden=true;$('anchor-overlay').hidden=true;nativeAnchor=null;$('canvas').hidden=false;
 generation++;cache.clear();current=s;playing=false;position=0;elapsed=0;frame=0;last=performance.now();comparing=false;baseline=baselineFor(s,comparisons);originalFrame=-1;originalPaint++;
 $('title').textContent=String(s.number).padStart(2,'0')+' · '+(s.branch_label?s.branch_label+' · ':'')+s.name;$('approval').textContent=categoryLabels[s.approval_category]+(decisions[s.name]?.needsReview?' · Previous '+decisions[s.name].previousDecision+' needs source-version review':'');
 const [w,h]=s.actual_dimensions[0];$('canvas').width=w;$('canvas').height=h;$('scrub').max=s.frames.length-1;
 const still=s.media_kind==='image',native=s.review_mode==='native-video';
 if(typeof s.preview_loop==='boolean')$('loop').checked=s.preview_loop;
 if(native){playing=false;video.src=(s.review_video??s.original_video).url;video.poster=s.frames[0].url;video.loop=$('loop').checked;video.playbackRate=Number($('speed').value);video.hidden=false;$('native-player').hidden=false;$('native-player').style.aspectRatio=w+'/'+h;$('anchor-overlay').width=w;$('anchor-overlay').height=h;$('canvas').hidden=true;}
 const review=s.review_video;if(review&&/^videos\/[a-f0-9]{64}\.webm$/.test(review.url)){$('review-video-download').href=review.url;$('review-video-download').download=s.name+'.webm';$('review-video-download').hidden=false;}else{$('review-video-download').hidden=true;$('review-video-download').removeAttribute('href');}
 const original=s.original_video?.url;if(original&&/^videos\/[a-f0-9]{64}\.mp4$/.test(original)){$('original-video-download').href=original;$('original-video-download').download=s.name+'.mp4';$('original-video-download').hidden=false;}else{$('original-video-download').hidden=true;$('original-video-download').removeAttribute('href');}
 $('geometry').textContent=`${w} × ${h} native canvas · ${native?s.native_frame_count+' native video frames · '+(s.duration_verified_ms/1000).toFixed(3)+' seconds':still?'Still reference (not animated)':(s.unique_frame_files??s.unique_png_files)+' unique lossless frames · '+(s.duration_verified_ms/1000).toFixed(3)+' seconds'}`;
 $('uuid').textContent=s.source.mj_job_uuid?'MJ UUID: '+s.source.mj_job_uuid:s.source.provider+(s.source.job_id?' · Job: '+s.source.job_id:' · Source SHA-256: '+s.source.sha256);
 for(const id of ['play','previous','next','scrub','speed','loop'])$(id).disabled=still||(native&&['previous','next','scrub'].includes(id));
 if(still)playing=false;$('play').textContent=still?'Still image':playing?'Pause':'Play';
 $('decision').value=decisions[s.name]?.decision||'undecided';$('notes').value=decisions[s.name]?.notes||'';decisionVisuals();list();draw(0);
 $('usage').textContent=`${s.usage.character} · ${s.usage.action} · ${s.usage.direction} · ${s.usage.attacking?'Attacking in this direction':'Not firing'}`;
 $('comparison-reason').textContent=baseline?`Existing slot: ${s.replacement.slot} · ${s.replacement.phase}. Compare against the Original runtime bank snapshot (${comparisons.sourceCommit.slice(0,8)}). Approval applies to this slot and phase only.`:'';$('comparison-reason').hidden=!baseline;
 $('compare').hidden=!baseline;$('compare').textContent='Compare';$('compare').setAttribute('aria-pressed','false');$('previews').classList.remove('comparing');$('original-pane').hidden=true;$('candidate-label').hidden=true;
 $('original-info').textContent='';
 $('replacement-row').hidden=!baseline;$('replace-approved').disabled=!baseline;$('replace-approved').checked=decisions[s.name]?.replaceApproved===true;
 $('replacement-label').textContent=baseline?`Authorize replacing ${s.replacement.slot} (${s.replacement.phase}) with this candidate.`:'';
}
function save(){if($('decision').value!=='keep')$('replace-approved').checked=false;decisions[current.name]={decision:$('decision').value,notes:$('notes').value,mjJobUuid:current.source.mj_job_uuid,sourceKey:sourceIdentity(current),packageCategory:current.approval_category,assetFingerprint:versions.get(current.name),replaceApproved:!!baseline&&$('replace-approved').checked,replacementFingerprint:current.replacement?.baselineFingerprint};session.overrides[current.name]=decisions[current.name];session.editRevision=++revision;persistBrowser();list();decisionVisuals();}
$('replace-approved').onchange=()=>{if($('replace-approved').checked)$('decision').value='keep';save();};
$('compare').onclick=()=>{if(!baseline)return;comparing=!comparing;generation++;originalPaint++;originalFrame=-1;$('previews').classList.toggle('comparing',comparing);$('original-pane').hidden=!comparing;$('candidate-label').hidden=!comparing;$('compare').textContent=comparing?'Close comparison':'Compare';$('compare').setAttribute('aria-pressed',String(comparing));$('original-label').textContent=`Current original · ${current.replacement.slot} · ${baseline.phase}`;
 const [w,h]=current.actual_dimensions[0];$('canvas').width=comparing?640:w;$('canvas').height=comparing?640:h;$('original-canvas').width=640;$('original-canvas').height=640;draw(frame);drawOriginal(true);};
 $('decision').onchange=save;$('notes').oninput=save;const filterChanged=()=>{filteredExpansion.clear();list();};$('character').onchange=filterChanged;$('category').onchange=filterChanged;
$('native-video').onplay=()=>{$('play').textContent='Pause';};$('native-video').onpause=()=>{if(current?.review_mode==='native-video')$('play').textContent='Play';};
$('speed').onchange=()=>{$('native-video').playbackRate=Number($('speed').value);};$('loop').onchange=()=>{$('native-video').loop=$('loop').checked;};
$('play').onclick=()=>{if(current.review_mode==='native-video'){const v=$('native-video');if(v.paused)v.play().catch(()=>{$('time').textContent='Video could not play. Check your connection.';});else v.pause();return;}if(!playing&&elapsed>=current.duration_verified_ms-.01){elapsed=position=0;draw(0);}playing=!playing;$('play').textContent=playing?'Pause':'Play';last=performance.now();};
function seek(i){playing=false;$('play').textContent='Play';i=Math.max(0,Math.min(current.frames.length-1,i));elapsed=position=current.durations.slice(0,i).reduce((a,b)=>a+b,0);draw(i);drawOriginal(true);}
$('previous').onclick=()=>seek(frame-1);$('next').onclick=()=>seek(frame+1);$('scrub').oninput=()=>seek(Number($('scrub').value));
$('pivot').onchange=()=>{draw(frame);drawOriginal(true);};$('background').onchange=()=>{for(const id of ['stage','original-stage'])$(id).className='stage '+$('background').value;};
$('export').onclick=()=>{const blob=new Blob([JSON.stringify(snapshot(),null,2)+'\n'],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=FILE_NAME;a.click();handoffStatus('Download requested. Attach '+FILE_NAME+' in chat when it finishes.');setTimeout(()=>URL.revokeObjectURL(a.href),1000);};
function tick(now){const delta=now-last;last=now;if(current&&playing){elapsed+=delta*Number($('speed').value);const duration=comparing?Math.max(current.duration_verified_ms,baseline.duration_verified_ms):current.duration_verified_ms;if(!$('loop').checked&&elapsed>=duration){elapsed=duration-.001;playing=false;$('play').textContent='Play';}position=$('loop').checked?elapsed%current.duration_verified_ms:Math.min(elapsed,current.duration_verified_ms-.001);const index=frameAt(current.durations,position,false);if(index!==frame)draw(index);drawOriginal();for(let j=1;j<=3;j++)image((index+j)%current.frames.length).catch(()=>{});}paintNativeAnchor();requestAnimationFrame(tick);}
const initial=initialReviewCandidate(data.sets,decisions);
if(initial)select(initial);
else{list();$('title').textContent=(data.redo_slots??[]).some(s=>!s.currentAssetId)?'Awaiting replacements':'No candidates';for(const id of ['play','previous','next','scrub','speed','loop','pivot','decision','notes'])$(id).disabled=true;$('compare').hidden=true;}
requestAnimationFrame(tick);
