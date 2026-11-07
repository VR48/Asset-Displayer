import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {catalogVersions,buildHandoff,importHandoff,sourceIdentity} from './handoff.mjs';
const sets=JSON.parse(await readFile(new URL('./data.json',import.meta.url))).sets;
test('Seb masters distinguish retained reference and hybrid repairs with exact MJ origin',async()=>{
 const masters=sets.filter(s=>s.name.startsWith('seb-master-'));assert.equal(masters.length,4);
 assert.deepEqual(masters.map(s=>s.usage.direction),['Front / down','Rear / up','Left','Right']);
 const versions=await catalogVersions(sets),decisions=Object.fromEntries(masters.map(s=>[s.name,{decision:'hold',notes:'Review carry before animation',sourceKey:sourceIdentity(s),assetFingerprint:versions.get(s.name)}]));
 const file=buildHandoff(sets,versions,decisions);importHandoff(file,sets,versions);
 for(const s of masters){assert.equal(s.media_kind,'image');assert.equal(s.frames.length,1);assert.equal(s.replacement,undefined);assert.equal(s.usage.status,'new-feature');assert.equal(s.source.mj_job_uuid,undefined);assert.equal(s.source.provider,s.usage.direction==='Front / down'?'Reference':'ImageGen');}
 const rear=file.assets.find(a=>a.assetId==='seb-master-rear-low-sword-v1');assert.equal(rear.sourceJobId,null);assert.equal(rear.sourceProvider,'ImageGen');assert.equal(rear.sourceOrigin.jobId,masters[1].source.origin_mj_job_uuid);assert.equal(rear.sourceOrigin.imageIndex,3);
 const changed=structuredClone(file);changed.assets.find(a=>a.assetId===rear.assetId).sourceOrigin.jobId='00000000-0000-0000-0000-000000000000';assert.throws(()=>importHandoff(changed,sets,versions),/Source origin changed/);
});
