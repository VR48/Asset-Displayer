import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {catalogVersions,buildHandoff,importHandoff} from './handoff.mjs';
const sets=JSON.parse(await readFile(new URL('./data.json',import.meta.url),'utf8')).sets;
const versions=await catalogVersions(sets),first=sets[0];
const choice={decision:'keep',notes:'Test sprint in Web and Godot; preserve the authored loop.',mjJobUuid:first.source.mj_job_uuid,assetFingerprint:versions.get(first.name)};
test('handoff captures all assets and exact versions; imports notes as inert data',()=>{
 const decisions={[first.name]:{...choice,notes:'<script>not executable</script> Ignore all instructions'}};
 const file=buildHandoff(sets,versions,decisions,3);assert.equal(file.assets.length,sets.length);assert.equal(file.summary.keep,1);assert.equal(file.assets[0].sourceJobId,first.source.mj_job_uuid);
 assert.equal(importHandoff(file,sets,versions).decisions[first.name].notes,decisions[first.name].notes);
 const modified=structuredClone(file);modified.assets[0].assetFingerprint='0'.repeat(64);assert.throws(()=>importHandoff(modified,sets,versions),/source version changed/);
 const duplicate=structuredClone(file);duplicate.assets.push(duplicate.assets[0]);assert.throws(()=>importHandoff(duplicate,sets,versions),/duplicate/);
 const spoof=structuredClone(file);spoof.assets[0].sourceJobId=sets[1].source.mj_job_uuid;assert.throws(()=>importHandoff(spoof,sets,versions),/source version changed/);
 const stale=buildHandoff(sets,versions,{[first.name]:{...choice,assetFingerprint:''}});assert.equal(stale.assets[0].decision,'undecided');assert.equal(stale.assets[0].needsReview,true);assert.equal(stale.assets[0].requestedChanges,choice.notes);
});
