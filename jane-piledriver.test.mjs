import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {validatePublicCandidate} from './candidate-schema.mjs';import {catalogVersions,buildHandoff} from './handoff.mjs';import {groupBranches} from './branch-navigation.mjs';
const d=JSON.parse(await readFile(new URL('./data.json',import.meta.url))),clips=d.sets.filter(s=>s.name.startsWith('jane-piledriver-'));
test('rejected Pile Driver versions retire into stable numbered retry slots',()=>{
 for(const [id,number]of [['jane-piledriver-right-end',92],['jane-piledriver-right-continuous',93]]){const slot=d.redo_slots.find(r=>r.id===id);assert(slot);assert.equal(slot.number,number);assert(slot.rejectedAssetIds.includes(id+'-v1'));assert(slot.nextVersion>=2);assert(!d.sets.some(s=>s.name===id+'-v1'));if(slot.currentAssetId)assert(d.sets.some(s=>s.name===slot.currentAssetId&&s.number===number));else assert.equal(slot.status,'awaiting-replacement');}
});
test('active Pile Driver retries retain paired Fast BS1 provenance and unchanged master pixels',async()=>{
 assert([0,2].includes(clips.length));const slots=d.redo_slots.filter(r=>r.id.startsWith('jane-piledriver-'));assert.equal(clips.length,slots.filter(r=>r.currentAssetId).length);const versions=await catalogVersions(d.sets),handoff=buildHandoff(d.sets,versions,{});
 for(const s of clips){validatePublicCandidate(s);assert.equal(s.review_mode,'native-video');assert.equal(s.source.speed,'fast');assert.equal(s.source.batch_size,1);assert.equal(s.source.motion,'low');assert.equal(s.source.master_sha256,'5994573b3530ccd89802441af2327ca0dd39a52641749f8eb01221274ad67a01');assert(['55c5ed12508ac3f6c2009d2be75b7888d7605b28e0f15309181ed47f36270a55','9af42beeaae0490b2dd9029dfbcb179c14ec4fc7770274d219e54a7e312adedc'].includes(s.source.uploaded_source_sha256));
  assert.deepEqual(s.source.source_transform.uploaded_size,[2304,1792]);assert.equal(s.source.source_transform.character_pixels_unchanged,true);assert.equal(s.branch_of,s.source.master_asset_id);assert.equal(s.usage.attacking,true);assert.equal(s.usage.direction,'Right');assert.equal(s.preview_loop,s.source.loop_requested);assert.equal(handoff.assets.find(a=>a.assetId===s.name).decision,'undecided');
  const companion=clips.find(c=>c.name===(s.paired_loop_asset_id??s.paired_continuous_asset_id));assert(companion);assert.notEqual(s.source.mj_job_uuid,companion.source.mj_job_uuid);assert.equal(companion.source.master_sha256,s.source.master_sha256);
 }
 if(clips.length){const family=groupBranches(d.sets).find(n=>n.set.name===clips[0].branch_of);assert(family);assert.deepEqual(new Set(family.children.map(n=>n.set.name)),new Set(clips.map(s=>s.name)));}
});
