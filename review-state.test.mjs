import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {catalogVersions,sourceIdentity,buildHandoff,importHandoff} from './handoff.mjs';
import {loadReviewSession,validateReviewState} from './review-state.mjs';
const sets=JSON.parse(await readFile(new URL('./data.json',import.meta.url))).sets,versions=await catalogVersions(sets),set=sets[0];
const published=decision=>({schema:'asset-displayer-review-state-v1',revision:1,decisions:{[set.name]:{decision,sourceKey:sourceIdentity(set),assetFingerprint:versions.get(set.name)}}});
const local=decision=>({decision,sourceKey:sourceIdentity(set),assetFingerprint:versions.get(set.name),notes:'Private notes stay local',replaceApproved:true,replacementFingerprint:set.replacement?.baselineFingerprint});

test('published decisions initialize fresh visitors and supersede old browser choices',()=>{
 assert.equal(loadReviewSession(published('keep'),null,null,sets,versions).decisions[set.name].decision,'keep');
 const migrated=loadReviewSession(published('keep'),null,{[set.name]:local('skip')},sets,versions);
 assert.equal(migrated.decisions[set.name].decision,'keep');assert.equal(migrated.decisions[set.name].notes,'Private notes stay local');assert.equal(migrated.decisions[set.name].replaceApproved,false);
});
test('local edits survive the same baseline; a new handoff baseline overrides status but retains private notes',()=>{
 const stored={schema:'asset-displayer-review-session-v2',baselineRevision:1,overrides:{[set.name]:local('delete')}};
 assert.equal(loadReviewSession(published('keep'),stored,null,sets,versions).decisions[set.name].decision,'delete');
 const next=published('skip');next.revision=2;const result=loadReviewSession(next,stored,null,sets,versions);
 assert.equal(result.decisions[set.name].decision,'skip');assert.equal(result.decisions[set.name].notes,'Private notes stay local');assert.equal(result.session.baselineRevision,2);
});
test('a changed asset version does not inherit an old green decision',async()=>{
 const changed=structuredClone(sets);changed[0].geometry={...changed[0].geometry,reviewTest:1};const updated=await catalogVersions(changed);
 const state=loadReviewSession(published('keep'),null,null,changed,updated).decisions[set.name];assert.equal(state.decision,'undecided');assert.equal(state.needsReview,true);
});
test('public status files cannot contain notes or pending deletions',()=>{
 const privateData=published('keep');privateData.decisions[set.name].notes='Private';assert.throws(()=>validateReviewState(privateData));assert.throws(()=>validateReviewState(published('delete')));
});
test('delete handoffs roundtrip without granting replacement approval; stale deletes are rejected',()=>{
 const file=buildHandoff(sets,versions,{[set.name]:local('delete')});assert.equal(file.summary.delete,1);assert.equal(file.assets[0].replacement?.approved,false);
 assert.equal(importHandoff(file,sets,versions).decisions[set.name].decision,'delete');
 file.assets[0].assetFingerprint='0'.repeat(64);assert.throws(()=>importHandoff(file,sets,versions),/source version changed/);
});
