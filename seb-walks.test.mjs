import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {catalogVersions,buildHandoff,importHandoff,sourceIdentity} from './handoff.mjs';
const sets=JSON.parse(await readFile(new URL('./data.json',import.meta.url))).sets;
const slots=JSON.parse(await readFile(new URL('./data.json',import.meta.url))).redo_slots??[];
const retired=id=>slots.find(s=>s.rejectedAssetIds.includes(id));
test('Redo retires rear walk and sneak separately while reserving their next versions',()=>{
 const sneak=retired('seb-sneak-rear-low-sword-v1'),walk=retired('seb-walk-rear-low-sword-v1');assert(sneak&&walk);assert.notEqual(sneak.id,walk.id);assert.equal(sneak.status,'awaiting-replacement');assert.equal(walk.status,'awaiting-replacement');assert.equal(sneak.nextVersion,2);assert.equal(walk.nextVersion,2);assert.equal(sneak.rejectedVersions[0].sourceKey,'5fbf1781-eaa0-4b56-ad89-4c9164fa735b');assert.equal(sneak.rejectedVersions[0].masterRevision,3);assert.equal(walk.rejectedVersions[0].masterRevision,6);for(const id of [...sneak.rejectedAssetIds,...walk.rejectedAssetIds])assert(!sets.some(s=>s.name===id));
});

test('raw walks retain historical master mapping, native timestamps, one-video policy and originals',async()=>{
 const walks=sets.filter(s=>s.name.startsWith('seb-walk-'));assert(walks.length>=1);assert.equal(new Set(walks.map(s=>s.source.mj_job_uuid)).size,walks.length);
 assert.equal(new Set(walks.map(s=>s.usage.direction)).size,walks.length);
 for(const s of walks){const master=sets.find(m=>m.name===s.source.master_asset_id);if(master)assert(s.source.master_sha256===master.source.sha256||(master.source.previous_sha256s??[]).includes(s.source.master_sha256));else{assert.equal(s.source.master_catalog_status,'removed');assert(s.source.master_reference_sha256s.includes(s.source.master_sha256));}assert.equal(s.source.batch_size,1);assert.equal(s.source.speed,'relax');assert.equal(s.source.motion,'low');assert.equal(typeof s.source.loop_requested,'boolean');assert.equal(s.frames.length,s.durations.length);assert(s.frames.length>1);assert(Math.abs(s.durations.reduce((a,b)=>a+b,0)-s.duration_verified_ms)<.00001);assert.equal(s.original_video.sha256,s.source.video_sha256);assert.equal(s.replacement,undefined);assert.equal(s.usage.attacking,false);}
 const versions=await catalogVersions(sets),decisions=Object.fromEntries(walks.map(s=>[s.name,{decision:'hold',notes:'Review walk cadence and loop boundary',sourceKey:sourceIdentity(s),assetFingerprint:versions.get(s.name)}]));
 const handoff=buildHandoff(sets,versions,decisions),imported=importHandoff(handoff,sets,versions);for(const s of walks){const a=handoff.assets.find(a=>a.assetId===s.name);assert.equal(a.sourceJobId,s.source.mj_job_uuid);assert.equal(a.timelineEntries,s.frames.length);assert.equal(a.decision,'hold');assert.equal(a.replacement,undefined);assert.equal(imported.decisions[s.name].notes,decisions[s.name].notes);}
 const altered=structuredClone(handoff);altered.assets.find(a=>a.assetId===walks[0].name).inputMasterSha256='0'.repeat(64);assert.throws(()=>importHandoff(altered,sets,versions),/input master changed/);
 const input=walks.find(s=>s.source.source_transform)??walks[0];assert(input);
 const changedUpload=structuredClone(handoff);changedUpload.assets.find(a=>a.assetId===input.name).inputUploadedSha256='0'.repeat(64);assert.throws(()=>importHandoff(changedUpload,sets,versions),/input master changed/);
 const changedCanvas=structuredClone(handoff);changedCanvas.assets.find(a=>a.assetId===input.name).inputTransform={type:'padding',offset:[123,456]};assert.throws(()=>importHandoff(changedCanvas,sets,versions),/input master changed/);
 const changedRevision=structuredClone(handoff);changedRevision.assets.find(a=>a.assetId===input.name).inputMasterRevision++;assert.throws(()=>importHandoff(changedRevision,sets,versions),/input master changed/);
 const revisedSets=structuredClone(sets);revisedSets.find(s=>s.name===input.name).source.uploaded_source_sha256='0'.repeat(64);assert.notEqual((await catalogVersions(revisedSets)).get(input.name),versions.get(input.name));
});

test('rejected v1 assets stay retired and rear v4 remains in graded still history',()=>{
 for(const id of ['seb-master-left-low-sword-v1','seb-master-right-low-sword-v1','seb-walk-front-low-sword-v1','seb-walk-left-low-sword-v1','seb-walk-right-low-sword-v1'])assert(!sets.some(s=>s.name===id));
 assert(sets.find(s=>s.name==='seb-master-rear-low-sword-v1').source.previous_sha256s.includes('fba5020548e06319115799e65490db577cf429407ddff371b7b96844449b6e94'));
 assert.equal(retired('seb-walk-rear-low-sword-v1').rejectedVersions[0].masterRevision,6);
});

test('underbuilt v2 side masters and walks stay retired while approved front remains exact',()=>{
 for(const id of ['seb-master-left-low-sword-v2','seb-master-right-low-sword-v2','seb-walk-left-low-sword-v2','seb-walk-right-low-sword-v2'])assert(!sets.some(s=>s.name===id));
 const front=sets.find(s=>s.name==='seb-walk-front-low-sword-v2');assert.equal(front.source.mj_job_uuid,'20a2fb03-fca2-4150-8318-393372ca732b');assert.equal(front.original_video.sha256,'1cb1706538ec6a7a47414c256f4022ac224575ea1dfa681040bd911866df6fe2');
 for(const d of ['left','right'])assert(retired('seb-master-'+d+'-low-sword-v6'));
});

test('strength-approved but short v3 masters are retired after later master refinements',()=>{
 for(const d of ['left','right']){assert(!sets.some(s=>s.name==='seb-master-'+d+'-low-sword-v3'));assert(retired('seb-master-'+d+'-low-sword-v6'));}
});

test('retired oblique slots preserve source identity without replacing the kept profile references',()=>{
 for(const d of ['left','right']){const slot=retired('seb-master-'+d+'-low-sword-v6');assert(slot);assert.equal(slot.status,'awaiting-replacement');assert.equal(slot.nextVersion,8);assert.equal(slot.direction,'Oblique '+d);assert.match(slot.rejectedVersions[0].sourceKey,/^[a-f0-9]{64}$/);assert(sets.some(s=>s.name==='seb-master-'+d+'-low-sword-v7'));assert(!sets.some(s=>s.name==='seb-master-'+d+'-low-sword-v6'));}
});
