import {validateRedoSlots} from './redo-slots.mjs';
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {baselineFor} from './comparison.mjs';
import {catalogVersions,sanitizeDecisions} from './handoff.mjs';
import {validateReviewState} from './review-state.mjs';
import {inspectLosslessFrameHeader} from './frame-format.mjs';
const manifest=JSON.parse(await readFile(new URL('./data.json',import.meta.url),'utf8'));
const frames=new Map(),videos=new Map();let entries=0;
validateRedoSlots(manifest);assert(Array.isArray(manifest.sets));assert.equal(new Set(manifest.sets.map(s=>s.name)).size,manifest.sets.length);assert.equal(new Set(manifest.sets.map(s=>s.number)).size,manifest.sets.length);
for(const set of manifest.sets){
 if(set.review_mode==='native-video'){assert.equal(set.frames.length,1);assert(Number.isInteger(set.native_frame_count)&&set.native_frame_count>1);assert(['native-original-video','native-derived-video'].includes(set.source.preview_basis));assert.equal(typeof set.source.loop_requested,'boolean');assert(set.original_video);assert.equal(set.usage.status,'new-feature');assert(manifest.sets.some(s=>s.name===(set.paired_continuous_asset_id??set.paired_loop_asset_id))||(manifest.redo_slots??[]).some(r=>r.id===(set.paired_loop_slot_id??set.paired_continuous_slot_id))||set.source.retired_pair_asset_ids?.length);}
 if(set.review_video){assert.equal(set.review_video.url,`videos/${set.review_video.sha256}.webm`);assert.match(set.review_video.sha256,/^[a-f0-9]{64}$/);assert.equal(set.review_video.mime_type,'video/webm');videos.set(set.review_video.url,set.review_video.sha256);}
 if(set.original_video){assert.equal(set.original_video.url,`videos/${set.original_video.sha256}.mp4`);assert.match(set.original_video.sha256,/^[a-f0-9]{64}$/);assert.equal(set.original_video.sha256,set.source.video_sha256);videos.set(set.original_video.url,set.original_video.sha256);}
 if(set.source.mj_job_uuid)assert.match(set.source.mj_job_uuid,/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/);
 else{assert(['Pika','ImageGen','Reference'].includes(set.source.provider));assert.match(set.source.sha256,/^[a-f0-9]{64}$/);if(set.source.provider==='Pika'){assert.match(set.source.job_id,/^creation_[a-f0-9-]{36}$/);assert.match(set.source.preview_sha256,/^[a-f0-9]{64}$/);}assert(['animation','image'].includes(set.media_kind));if(set.media_kind==='image')assert.equal(set.frames.length,1);if(set.source.origin_mj_job_uuid)assert.match(set.source.origin_mj_job_uuid,/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/);}
 assert.equal(set.frames.length,set.durations.length);
 assert(set.durations.every(ms=>Number.isFinite(ms)&&ms>0));
 assert(Math.abs(set.durations.reduce((a,b)=>a+b,0)-set.duration_verified_ms)<0.01);
 for(const [i,frame]of set.frames.entries()){
  if(frame.url.endsWith('.webp'))assert.match(frame.rgba_sha256,/^[a-f0-9]{64}$/);
  assert.match(frame.url,/^assets\/[a-f0-9]{64}\.(?:png|webp)$/);assert(frame.url.includes(frame.sha256));
  const duration=frame.duration_numerator!==undefined?1000*frame.duration_numerator/frame.duration_denominator:frame.duration_ms;
  assert(Math.abs(duration-set.durations[i])<1e-6);frames.set(frame.url,frame.sha256);entries++;
 }
}
for(const [file,sha]of frames){const bytes=await readFile(new URL(file,import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),sha);inspectLosslessFrameHeader(bytes,file.split('.').at(-1));}
assert.equal((await readdir(new URL('./assets/',import.meta.url))).length,frames.size);
for(const [file,sha]of videos){const bytes=await readFile(new URL(file,import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),sha);if(file.endsWith('.mp4'))assert.equal(bytes.toString('ascii',4,8),'ftyp');else assert.equal(bytes.subarray(0,4).toString('hex'),'1a45dfa3');}
try{assert.equal((await readdir(new URL('./videos/',import.meta.url))).length,videos.size);}catch(error){if(error.code!=='ENOENT'||videos.size)throw error;}
const content=await readFile(new URL('./data.json',import.meta.url),'utf8');
for(const privateField of ['provider_local_path','provider_message','owner_evidence','source_root_PRED','senderIp','controlToken','C:\\\\Users','D:\\\\'])assert(!content.includes(privateField),`Private field published: ${privateField}`);
const app=await readFile(new URL('./app.js',import.meta.url),'utf8');
assert(!app.includes("fetch('/"));assert(app.includes('img.src=set.frames[index].url'));
const catalog=JSON.parse(await readFile(new URL('./comparisons.json',import.meta.url),'utf8'));
const originalFrames=new Map();
for(const b of catalog.baselines){
 const {fingerprint,...source}=b;assert.equal(createHash('sha256').update(JSON.stringify(source)).digest('hex'),fingerprint);
 assert.equal(b.frames.length,b.durations.length);assert(b.durations.every(ms=>Number.isFinite(ms)&&ms>0));
 assert(Math.abs(b.durations.reduce((a,n)=>a+n,0)-b.duration_verified_ms)<1e-6);
 assert.match(b.sourceManifest,/^dist\/assets\/heroes\/(rook|vale|kest|mica)-animation\.json$/);
 for(const f of b.frames){assert.equal(f.url,`baselines/${f.sha256}.png`);originalFrames.set(f.url,f.sha256);}
}
for(const s of manifest.sets){assert(s.usage);assert.equal(Boolean(baselineFor(s,catalog)),s.usage.status==='replacement');}
for(const [file,hash]of originalFrames){const bytes=await readFile(new URL(file,import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),hash);assert.equal(bytes[25],6);}
assert.equal((await readdir(new URL('./baselines/',import.meta.url))).length,originalFrames.size);
console.log(JSON.stringify({sets:manifest.sets.length,timelineEntries:entries,uniqueFrames:frames.size,originalVideos:videos.size,replacementCandidates:catalog.baselines.length,originalFrames:originalFrames.size,sha256Verified:true,metadataBoundaryPassed:true}));

const published=validateReviewState(JSON.parse(await readFile(new URL('./review-state.json',import.meta.url),'utf8'))),versions=await catalogVersions(manifest.sets);
const publicDecisions=sanitizeDecisions(Object.fromEntries(Object.entries(published.decisions).map(([id,e])=>[id,{...e,notes:''}])),manifest.sets,versions);
for(const [id,entry] of Object.entries(published.decisions)){assert(manifest.sets.some(s=>s.name===id),'Deleted/unknown status retained: '+id);if(publicDecisions[id]?.needsReview)assert.equal(publicDecisions[id].decision,'undecided');else if(publicDecisions[id])assert.equal(publicDecisions[id].decision,entry.decision);}
console.log(JSON.stringify({publishedReviewRevision:published.revision,keep:Object.values(publicDecisions).filter(e=>e.decision==='keep').length,skip:Object.values(publicDecisions).filter(e=>e.decision==='skip').length,notesPublished:false}));
