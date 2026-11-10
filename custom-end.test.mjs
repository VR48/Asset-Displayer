import test from 'node:test';import assert from 'node:assert/strict';import{readFile}from'node:fs/promises';import{catalogVersions,buildHandoff,importHandoff}from'./handoff.mjs';import{validatePublicCandidate}from'./candidate-schema.mjs';
const data=JSON.parse(await readFile(new URL('./data.json',import.meta.url))),s=data.sets.find(s=>s.source.custom_end_requested);
test('custom-end lunge reference retains one contiguous native phase and truthful controls',()=>{
 assert(s);validatePublicCandidate(s);assert.equal(s.source.video_raw,true);assert.equal(s.source.loop_requested,false);assert.equal(s.source.batch_size,1);assert.equal(s.preview_loop,false);assert.equal(s.usage.status,'new-feature');assert.equal(s.replacement,undefined);assert.deepEqual(s.frames.map(f=>f.source_frame),Array.from({length:43},(_,i)=>i+1));assert(Math.abs(s.duration_verified_ms-43000/24)<1e-6);
 const invalid=structuredClone(s);invalid.source.loop_requested=true;assert.throws(()=>validatePublicCandidate(invalid),/custom video endpoint/);
});
test('custom endpoint and Raw metadata bind fingerprints and private handoffs',async()=>{
 const versions=await catalogVersions(data.sets),h=buildHandoff(data.sets,versions,{}),entry=h.assets.find(a=>a.assetId===s.name);assert.deepEqual(entry.customVideoEndpoints,{endSourceSha256:s.source.end_source_sha256,videoRaw:true});assert.equal(importHandoff(h,data.sets,versions).decisions[s.name].decision,'undecided');
 const altered=structuredClone(s);altered.source.end_source_sha256='0'.repeat(64);assert.notEqual((await catalogVersions([altered])).get(s.name),versions.get(s.name));entry.customVideoEndpoints.endSourceSha256='0'.repeat(64);assert.throws(()=>importHandoff(h,data.sets,versions),/Custom video endpoints changed/);
 const state=JSON.parse(await readFile(new URL('./review-state.json',import.meta.url)));for(const [name,decision]of Object.entries(state.decisions))assert.equal(versions.get(name),decision.assetFingerprint,'Existing decision fingerprint changed: '+name);
});
