import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {frameAt,baselineFor,comparisonBounds} from './comparison.mjs';
import {catalogVersions,buildHandoff,importHandoff,sanitizeDecisions} from './handoff.mjs';
const sets=JSON.parse(await readFile(new URL('./data.json',import.meta.url))).sets;
const catalog=JSON.parse(await readFile(new URL('./comparisons.json',import.meta.url)));
test('only verified character/action/bearing/phase targets expose a comparison',()=>{
 assert.deepEqual(sets.filter(s=>baselineFor(s,catalog)).map(s=>s.number),[1,2,10,11,12,13,30,32,33]);
 assert.equal(sets[12].replacement.slot,'mica/walk:down');assert.equal(sets[11].replacement.slot,'mica/attack:up');
 assert.equal(sets[10].replacement.phase,'recovery');assert.equal(sets[29].replacement.slot,'vale/walk:right');
 assert.equal(baselineFor({...sets[0],replacement:{...sets[0].replacement,baselineFingerprint:'changed'}},catalog),null);
 for(const s of sets.filter(s=>s.usage.status==='new-feature'))assert.equal(s.replacement,undefined);
});
test('unequal variable duration timelines use elapsed time and independent repeat/clamp',()=>{
 assert.equal(frameAt([41,42,41],40),0);assert.equal(frameAt([41,42,41],41),1);
 assert.equal(frameAt([41,42,41],124),0);assert.equal(frameAt([41,42,41],999,false),2);
 assert.equal(frameAt([10,10],25),0);assert.equal(frameAt([10,10,10],25),2);
 assert.deepEqual(comparisonBounds({canvas:[100,200],anchor:[50,180],renderScale:.1},{canvas:[200,400],native_anchor:[100,360],render_scale:.05}),[-5,-18,5,2]);
});
test('replacement authorization names exact original version, never follows Keep automatically',async()=>{
 const versions=await catalogVersions(sets),set=sets[0];
 const choice={decision:'keep',notes:'Compare approved',mjJobUuid:set.source.mj_job_uuid,assetFingerprint:versions.get(set.name)};
 assert.equal(buildHandoff(sets,versions,{[set.name]:choice}).assets[0].replacement.approved,false);
 const decisions={[set.name]:{...choice,replaceApproved:true,replacementFingerprint:set.replacement.baselineFingerprint}};
 const handoff=buildHandoff(sets,versions,decisions);assert.equal(handoff.assets[0].replacement.approved,true);
 assert.equal(importHandoff(handoff,sets,versions).decisions[set.name].replaceApproved,true);
 const modified=structuredClone(handoff);modified.assets[0].replacement.phase='active';assert.throws(()=>importHandoff(modified,sets,versions),/target changed/);
 decisions[set.name].replacementFingerprint='stale';assert.equal(buildHandoff(sets,versions,decisions).assets[0].replacement.approved,false);
 decisions[set.name].replacementFingerprint=set.replacement.baselineFingerprint;decisions[set.name].decision='skip';assert.equal(buildHandoff(sets,versions,decisions).assets[0].replacement.approved,false);
 decisions[set.name].assetFingerprint='stale';const reset=sanitizeDecisions(decisions,sets,versions)[set.name];assert.equal(reset.decision,'undecided');assert.equal(reset.replaceApproved,false);assert.equal(reset.notes,'Compare approved');
 const newFeature=structuredClone(handoff);newFeature.assets[2].replacement=handoff.assets[0].replacement;assert.throws(()=>importHandoff(newFeature,sets,versions),/target changed/);
});
