import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {catalogVersions,buildHandoff,importHandoff,sourceIdentity} from './handoff.mjs';
const sets=JSON.parse(await readFile(new URL('./data.json',import.meta.url))).sets;
test('the retained rear take is a separate sneak candidate rather than the normal walk',()=>{
 const sneak=sets.find(s=>s.name==='seb-sneak-rear-low-sword-v1');assert(sneak);
 assert.match(sneak.usage.action,/Sneak/);assert.equal(sneak.usage.direction,'Rear / up');
 assert.equal(sneak.source.mj_job_uuid,'5fbf1781-eaa0-4b56-ad89-4c9164fa735b');
 assert.equal(sneak.source.master_revision,3);assert.equal(sneak.usage.status,'new-feature');assert.equal(sneak.replacement,undefined);
 const rear=sets.find(s=>s.name==='seb-walk-rear-low-sword-v1');assert.notEqual(rear.source.mj_job_uuid,sneak.source.mj_job_uuid);assert.notEqual(rear.source.master_sha256,sneak.source.master_sha256);
});
test('four raw walks retain the updated master mapping, native timestamps, one-video policy and originals',async()=>{
 const walks=sets.filter(s=>s.name.startsWith('seb-walk-'));assert.equal(walks.length,4);assert.equal(new Set(walks.map(s=>s.source.mj_job_uuid)).size,4);
 assert.deepEqual(walks.map(s=>s.usage.direction),['Front / down','Rear / up','Left','Right']);
 for(const s of walks){const master=sets.find(m=>m.name===s.source.master_asset_id);assert(master);assert.equal(s.source.master_sha256,master.source.sha256);assert.equal(s.source.batch_size,1);assert.equal(s.source.speed,'relax');assert.equal(s.source.motion,'low');assert.equal(s.source.loop_requested,true);assert.equal(s.frames.length,s.durations.length);assert(s.frames.length>1);assert(Math.abs(s.durations.reduce((a,b)=>a+b,0)-s.duration_verified_ms)<.00001);assert.equal(s.original_video.sha256,s.source.video_sha256);assert.equal(s.source.preview_basis,'decoded-original-video');assert.equal(s.replacement,undefined);assert.equal(s.usage.attacking,false);}
 const versions=await catalogVersions(sets),decisions=Object.fromEntries(walks.map(s=>[s.name,{decision:'hold',notes:'Review walk cadence and loop boundary',sourceKey:sourceIdentity(s),assetFingerprint:versions.get(s.name)}]));
 const handoff=buildHandoff(sets,versions,decisions),imported=importHandoff(handoff,sets,versions);for(const s of walks){const a=handoff.assets.find(a=>a.assetId===s.name);assert.equal(a.sourceJobId,s.source.mj_job_uuid);assert.equal(a.timelineEntries,s.frames.length);assert.equal(a.decision,'hold');assert.equal(a.replacement,undefined);assert.equal(imported.decisions[s.name].notes,decisions[s.name].notes);}
 const altered=structuredClone(handoff);altered.assets.find(a=>a.assetId===walks[0].name).inputMasterSha256='0'.repeat(64);assert.throws(()=>importHandoff(altered,sets,versions),/input master changed/);
 const padded=walks.find(s=>s.source.source_transform);assert(padded);
 const changedUpload=structuredClone(handoff);changedUpload.assets.find(a=>a.assetId===padded.name).inputUploadedSha256='0'.repeat(64);assert.throws(()=>importHandoff(changedUpload,sets,versions),/input master changed/);
 const changedCanvas=structuredClone(handoff);changedCanvas.assets.find(a=>a.assetId===padded.name).inputTransform.offset[0]++;assert.throws(()=>importHandoff(changedCanvas,sets,versions),/input master changed/);
 const changedRevision=structuredClone(handoff);changedRevision.assets.find(a=>a.assetId===padded.name).inputMasterRevision++;assert.throws(()=>importHandoff(changedRevision,sets,versions),/input master changed/);
 const revisedSets=structuredClone(sets);revisedSets.find(s=>s.name===padded.name).source.uploaded_source_sha256='0'.repeat(64);assert.notEqual((await catalogVersions(revisedSets)).get(padded.name),versions.get(padded.name));
});
