import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {validatePublicCandidate} from './candidate-schema.mjs';import {catalogVersions,buildHandoff} from './handoff.mjs';import {groupBranches} from './branch-navigation.mjs';
const d=JSON.parse(await readFile(new URL('./data.json',import.meta.url))),clips=d.sets.filter(s=>s.name.startsWith('jane-piledriver-'));
test('Pile Driver diagnostics retain paired Fast BS1 provenance and unchanged padded master',async()=>{
 assert.equal(clips.length,2);const versions=await catalogVersions(d.sets),handoff=buildHandoff(d.sets,versions,{});
 for(const s of clips){validatePublicCandidate(s);assert.equal(s.review_mode,'native-video');assert.equal(s.source.speed,'fast');assert.equal(s.source.batch_size,1);assert.equal(s.source.motion,'high');assert.equal(s.source.master_sha256,'5994573b3530ccd89802441af2327ca0dd39a52641749f8eb01221274ad67a01');assert.equal(s.source.uploaded_source_sha256,'55c5ed12508ac3f6c2009d2be75b7888d7605b28e0f15309181ed47f36270a55');
  assert.deepEqual(s.source.source_transform.uploaded_size,[2304,1792]);assert.equal(s.source.source_transform.character_pixels_unchanged,true);assert.equal(s.branch_of,s.source.master_asset_id);assert.equal(s.usage.attacking,true);assert.equal(s.usage.direction,'Right');assert.equal(s.preview_loop,s.source.loop_requested);assert.equal(handoff.assets.find(a=>a.assetId===s.name).decision,'undecided');
  const companion=clips.find(c=>c.name===(s.paired_loop_asset_id??s.paired_continuous_asset_id));assert(companion);assert.notEqual(s.source.mj_job_uuid,companion.source.mj_job_uuid);assert.equal(companion.source.master_sha256,s.source.master_sha256);
 }
 const family=groupBranches(d.sets).find(n=>n.set.name===clips[0].branch_of);assert(family);assert.deepEqual(new Set(family.children.map(n=>n.set.name)),new Set(clips.map(s=>s.name)));
});
