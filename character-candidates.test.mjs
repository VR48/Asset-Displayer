import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {catalogVersions,buildHandoff,importHandoff,sourceIdentity,sanitizeDecisions} from './handoff.mjs';
const sets=JSON.parse(await readFile(new URL('./data.json',import.meta.url))).sets;
const denis=sets.filter(s=>s.usage.character==='Denis'),versions=await catalogVersions(sets);
test('new character has four timed idles and four unchanged still references with no replacement targets',()=>{
 assert.equal(denis.length,8);assert.equal(denis.filter(s=>s.media_kind==='animation').length,4);
 for(const s of denis){assert.equal(s.usage.status,'new-feature');assert.equal(s.replacement,undefined);assert.equal(s.source.mj_job_uuid,undefined);
  if(s.media_kind==='image'){assert.equal(s.frames.length,1);assert.equal(s.frames[0].sha256,s.source.sha256);assert.equal(s.source.provider,'ImageGen');}
  else{assert.equal(s.frames.length,120);assert.equal(s.duration_verified_ms,5000);assert.equal(s.source.provider,'Pika');assert.equal(s.durations.reduce((a,b)=>a+b,0),5000);}
 }
});
test('Pika and still references survive private handoff roundtrip without fictitious MJ IDs',()=>{
 const decisions=Object.fromEntries(denis.map(s=>[s.name,{decision:'keep',notes:'Review Denis',sourceKey:sourceIdentity(s),assetFingerprint:versions.get(s.name)}]));
 const file=buildHandoff(sets,versions,decisions),read=importHandoff(file,sets,versions);
 for(const s of denis){const a=file.assets.find(a=>a.assetId===s.name);assert.equal(a.decision,'keep');assert.equal(a.sourceProvider,s.source.provider);assert.equal(a.replacement,undefined);assert.equal(read.decisions[s.name].sourceKey,sourceIdentity(s));}
 const tampered=structuredClone(file);tampered.assets.find(a=>a.sourceProvider==='ImageGen').sourceAssetSha256='0'.repeat(64);assert.throws(()=>importHandoff(tampered,sets,versions),/source version changed/);
 const s=denis[0],stale=sanitizeDecisions({[s.name]:{...decisions[s.name],assetFingerprint:'old'}},sets,versions)[s.name];assert.equal(stale.decision,'undecided');assert.equal(stale.notes,'Review Denis');
});
test('existing MJ catalog fingerprints and legacy browser choices retain compatibility',()=>{
 for(const s of sets.filter(s=>s.source.mj_job_uuid)){
  const old=createHash('sha256').update(JSON.stringify({uuid:s.source.mj_job_uuid,geometry:s.geometry,frames:s.frames.map((f,i)=>[f.sha256,s.durations[i]]),...(s.replacement?{replacement:s.replacement}:{})})).digest('hex');assert.equal(versions.get(s.name),old);
  const entry={decision:'keep',notes:'Earlier review',mjJobUuid:s.source.mj_job_uuid,assetFingerprint:old};assert.equal(sanitizeDecisions({[s.name]:entry},sets,versions)[s.name].decision,'keep');
 }
});
