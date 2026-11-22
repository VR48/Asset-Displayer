import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validatePublicCandidate} from './candidate-schema.mjs';
import {catalogVersions,buildHandoff,importHandoff} from './handoff.mjs';
const d=JSON.parse(await readFile(new URL('./data.json',import.meta.url)));
const combo=d.sets.find(s=>s.name==='jane-pile-bunker-two-hit-repaired-v2');
const kick=d.sets.find(s=>s.name==='jane-pile-bunker-kickback-repaired-v2');
test('attack cuts stop at feet together and retain forward recoil with native timing',()=>{
 for(const [s,number,last,size,uuid] of [[combo,97,89,[1008,528],'aa52f06c-1a73-4551-8816-e2bdab1988f8'],[kick,98,56,[752,528],'d8177deb-5bb5-4484-aa00-3ccc7e2f300a']]){
  assert.equal(s?.number,number);
  assert.equal(s.candidate_version,2);
  const ids=Array.from({length:last},(_,i)=>i+1);
  assert(s);validatePublicCandidate(s);assert.deepEqual(s.frames.map(f=>f.source_frame),ids);assert.deepEqual(s.geometry.canvas,size);assert.equal(s.source.mj_job_uuid,uuid);assert.equal(s.preview_loop,false);assert(s.durations.every(t=>t===1000/24));assert(Math.abs(s.duration_verified_ms-ids.length*1000/24)<1e-6);assert.equal(s.source.video_raw,true);assert.equal(s.source.batch_size,1);assert.equal(s.source.custom_end_requested,true);assert.equal(s.source.loop_requested,false);assert(s.original_video);assert.equal(s.usage.status,'new-feature');assert.equal(s.replacement,undefined);
 }
 assert.notEqual(kick.frames[0].sha256,kick.frames.at(-1).sha256,'Kickback ends on the raised weapon pose');
});
test('repaired animation handoffs retain original identities without inheriting owner approval',async()=>{
 const versions=await catalogVersions(d.sets),h=buildHandoff(d.sets,versions,{}),parsed=importHandoff(h,d.sets,versions);for(const s of [combo,kick]){const e=h.assets.find(a=>a.assetId===s.name);assert.equal(parsed.decisions[s.name].decision,'undecided');assert.equal(e.originalVideoSha256,s.original_video.sha256);assert.deepEqual(e.customVideoEndpoints,{endSourceSha256:s.source.end_source_sha256,videoRaw:true});}
});
