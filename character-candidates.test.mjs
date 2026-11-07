import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {catalogVersions,buildHandoff,importHandoff,sourceIdentity,sanitizeDecisions} from './handoff.mjs';
const sets=JSON.parse(await readFile(new URL('./data.json',import.meta.url))).sets;
const references=sets.filter(s=>s.media_kind==='image'&&!s.source.mj_job_uuid),versions=await catalogVersions(sets);
test('standing character references are stills with no replacement targets',()=>{
 assert(references.length>0);
 for(const s of references){assert.equal(s.usage.status,'new-feature');assert.equal(s.replacement,undefined);assert.equal(s.source.mj_job_uuid,undefined);
  assert.equal(s.frames.length,1);assert.match(s.source.sha256,/^[a-f0-9]{64}$/);assert(['Reference','ImageGen'].includes(s.source.provider));
 }
});
test('reference sources survive private handoff roundtrip without fictitious MJ IDs',()=>{
 const decisions=Object.fromEntries(references.map(s=>[s.name,{decision:'keep',notes:'Character reference review',sourceKey:sourceIdentity(s),assetFingerprint:versions.get(s.name)}]));
 const file=buildHandoff(sets,versions,decisions),read=importHandoff(file,sets,versions);
 for(const s of references){const a=file.assets.find(a=>a.assetId===s.name);assert.equal(a.decision,'keep');assert.equal(a.sourceProvider,s.source.provider);assert.equal(a.replacement,undefined);assert.equal(read.decisions[s.name].sourceKey,sourceIdentity(s));}
 const tampered=structuredClone(file);tampered.assets.find(a=>a.sourceProvider==='ImageGen').sourceAssetSha256='0'.repeat(64);assert.throws(()=>importHandoff(tampered,sets,versions),/source version changed/);
 const s=references[0],stale=sanitizeDecisions({[s.name]:{...decisions[s.name],assetFingerprint:'old'}},sets,versions)[s.name];assert.equal(stale.decision,'undecided');assert.equal(stale.notes,'Character reference review');
});
test('existing MJ catalog fingerprints and legacy browser choices retain compatibility',()=>{
 for(const s of sets.filter(s=>s.source.mj_job_uuid)){
  const old=createHash('sha256').update(JSON.stringify({uuid:s.source.mj_job_uuid,geometry:s.geometry,frames:s.frames.map((f,i)=>[f.sha256,s.durations[i]]),...(s.replacement?{replacement:s.replacement}:{})})).digest('hex');assert.equal(versions.get(s.name),old);
  const entry={decision:'keep',notes:'Earlier review',mjJobUuid:s.source.mj_job_uuid,assetFingerprint:old};assert.equal(sanitizeDecisions({[s.name]:entry},sets,versions)[s.name].decision,'keep');
 }
});
