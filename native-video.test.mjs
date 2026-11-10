import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {catalogVersions,buildHandoff,importHandoff} from './handoff.mjs';
const data=JSON.parse(await readFile(new URL('./data.json',import.meta.url))),sets=data.sets;

test('native video handoffs preserve loop pairing and original identity after alpha conversion',async()=>{
 // Exercise the supported native-video presentation even when all live native
 // candidates have graduated to transparent frame previews.
 const videos=sets.filter(s=>s.original_video&&typeof s.source.loop_requested==='boolean'&&(s.paired_continuous_asset_id||s.paired_loop_asset_id||s.paired_loop_slot_id||s.paired_continuous_slot_id)).map(s=>({...structuredClone(s),review_mode:'native-video',native_frame_count:s.native_frame_count??s.frames.length,frames:[s.frames[0]],durations:[s.duration_verified_ms]}));
 assert(videos.length>=4);
 const nativeSets=sets.map(s=>videos.find(v=>v.name===s.name)??s),versions=await catalogVersions(nativeSets),handoff=buildHandoff(nativeSets,versions,{});
 for(const s of videos){
  assert(s.native_frame_count>1);assert.equal(s.source.batch_size,1);
  const companion=nativeSets.find(x=>x.name===(s.paired_continuous_asset_id??s.paired_loop_asset_id));
  const pending=(data.redo_slots??[]).find(r=>r.id===(s.paired_loop_slot_id??s.paired_continuous_slot_id));
  assert(companion||pending);
  const a=handoff.assets.find(a=>a.assetId===s.name);assert.equal(a.reviewMode,'native-video');assert.equal(a.nativeFrameCount,s.native_frame_count);assert.equal(a.originalVideoSha256,s.original_video.sha256);assert.equal(a.loopRequested,s.source.loop_requested);
 }
 const a=handoff.assets.find(a=>a.assetId===videos[0].name);a.decision='keep';assert.equal(importHandoff(handoff,nativeSets,versions).decisions[videos[0].name].decision,'keep');
});

test('derived review videos are fingerprinted and verified separately from originals',async()=>{
 const s=sets.find(s=>s.review_video);assert(s,'Expected a repaired-video candidate');const versions=await catalogVersions(sets),h=buildHandoff(sets,versions,{}),entry=h.assets.find(a=>a.assetId===s.name);assert.equal(entry.reviewVideoSha256,s.review_video.sha256);assert.equal(entry.originalVideoSha256,s.original_video.sha256);const changed=structuredClone(s);changed.review_video.sha256='0'.repeat(64);assert.notEqual((await catalogVersions([changed])).get(s.name),versions.get(s.name));entry.reviewVideoSha256='0'.repeat(64);assert.throws(()=>importHandoff(h,sets,versions),/Review video changed/);
});
