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
test('raw walks retain historical master mapping, native timestamps, one-video policy and originals',async()=>{
 const walks=sets.filter(s=>s.name.startsWith('seb-walk-'));assert(walks.length>=1);assert.equal(new Set(walks.map(s=>s.source.mj_job_uuid)).size,walks.length);
 assert.equal(new Set(walks.map(s=>s.usage.direction)).size,walks.length);
 for(const s of walks){const master=sets.find(m=>m.name===s.source.master_asset_id);assert(master);assert(s.source.master_sha256===master.source.sha256||(master.source.previous_sha256s??[]).includes(s.source.master_sha256));assert.equal(s.source.batch_size,1);assert.equal(s.source.speed,'relax');assert.equal(s.source.motion,'low');assert.equal(typeof s.source.loop_requested,'boolean');assert.equal(s.frames.length,s.durations.length);assert(s.frames.length>1);assert(Math.abs(s.durations.reduce((a,b)=>a+b,0)-s.duration_verified_ms)<.00001);assert.equal(s.original_video.sha256,s.source.video_sha256);assert.equal(s.source.preview_basis,'decoded-original-video');assert.equal(s.replacement,undefined);assert.equal(s.usage.attacking,false);}
 const versions=await catalogVersions(sets),decisions=Object.fromEntries(walks.map(s=>[s.name,{decision:'hold',notes:'Review walk cadence and loop boundary',sourceKey:sourceIdentity(s),assetFingerprint:versions.get(s.name)}]));
 const handoff=buildHandoff(sets,versions,decisions),imported=importHandoff(handoff,sets,versions);for(const s of walks){const a=handoff.assets.find(a=>a.assetId===s.name);assert.equal(a.sourceJobId,s.source.mj_job_uuid);assert.equal(a.timelineEntries,s.frames.length);assert.equal(a.decision,'hold');assert.equal(a.replacement,undefined);assert.equal(imported.decisions[s.name].notes,decisions[s.name].notes);}
 const altered=structuredClone(handoff);altered.assets.find(a=>a.assetId===walks[0].name).inputMasterSha256='0'.repeat(64);assert.throws(()=>importHandoff(altered,sets,versions),/input master changed/);
 const padded=walks.find(s=>s.source.source_transform);assert(padded);
 const changedUpload=structuredClone(handoff);changedUpload.assets.find(a=>a.assetId===padded.name).inputUploadedSha256='0'.repeat(64);assert.throws(()=>importHandoff(changedUpload,sets,versions),/input master changed/);
 const changedCanvas=structuredClone(handoff);changedCanvas.assets.find(a=>a.assetId===padded.name).inputTransform.offset[0]++;assert.throws(()=>importHandoff(changedCanvas,sets,versions),/input master changed/);
 const changedRevision=structuredClone(handoff);changedRevision.assets.find(a=>a.assetId===padded.name).inputMasterRevision++;assert.throws(()=>importHandoff(changedRevision,sets,versions),/input master changed/);
 const revisedSets=structuredClone(sets);revisedSets.find(s=>s.name===padded.name).source.uploaded_source_sha256='0'.repeat(64);assert.notEqual((await catalogVersions(revisedSets)).get(padded.name),versions.get(padded.name));
});

test('rejected v1 assets stay retired and rear v4 remains in graded still history',()=>{
 for(const id of ['seb-master-left-low-sword-v1','seb-master-right-low-sword-v1','seb-walk-front-low-sword-v1','seb-walk-left-low-sword-v1','seb-walk-right-low-sword-v1'])assert(!sets.some(s=>s.name===id));
 assert(sets.find(s=>s.name==='seb-master-rear-low-sword-v1').source.previous_sha256s.includes('fba5020548e06319115799e65490db577cf429407ddff371b7b96844449b6e94'));
 assert.equal(sets.find(s=>s.name==='seb-walk-rear-low-sword-v1').source.master_revision,6);
});

test('underbuilt v2 side masters and walks stay retired while approved front remains exact',()=>{
 for(const id of ['seb-master-left-low-sword-v2','seb-master-right-low-sword-v2','seb-walk-left-low-sword-v2','seb-walk-right-low-sword-v2'])assert(!sets.some(s=>s.name===id));
 const front=sets.find(s=>s.name==='seb-walk-front-low-sword-v2');assert.equal(front.source.mj_job_uuid,'20a2fb03-fca2-4150-8318-393372ca732b');assert.equal(front.original_video.sha256,'1cb1706538ec6a7a47414c256f4022ac224575ea1dfa681040bd911866df6fe2');
 for(const d of ['left','right'])assert(sets.some(s=>s.name==='seb-master-'+d+'-low-sword-v6'));
});

test('strength-approved but short v3 masters are retired after later master refinements',()=>{
 for(const d of ['left','right']){assert(!sets.some(s=>s.name==='seb-master-'+d+'-low-sword-v3'));assert(sets.some(s=>s.name==='seb-master-'+d+'-low-sword-v6'));}
});

test('oblique references preserve original lineage across explicit head-reference redraws',()=>{
 const front=sets.find(s=>s.name==='seb-master-front-low-sword-v1');
 for(const d of ['left','right'])for(const v of [4,5])assert(!sets.some(s=>s.name==='seb-master-'+d+'-low-sword-v'+v));
 const left=sets.find(s=>s.name==='seb-master-left-low-sword-v6'),right=sets.find(s=>s.name==='seb-master-right-low-sword-v6');assert(left&&right);
 assert.equal(left.source.render_basis,'explicit-oblique-head-reference-redraw');assert(left.source.previous_sha256s.includes('17d409905bfb5ff8f977eddaa3756558c4524f9e179a041ce0fbb7fad1d67622'));assert.equal(left.source.head_reference_sha256s.length,1);assert.equal(left.source.color_grade.revision,9);
 assert.equal(right.source.render_basis,'explicit-oblique-head-reference-redraw');assert.equal(right.source.armor_reference_sha256,front.source.sha256);assert(right.source.reference_sha256s.includes(front.source.sha256));
});
