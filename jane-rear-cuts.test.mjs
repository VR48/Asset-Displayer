import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {catalogVersions,buildHandoff,importHandoff,sourceIdentity} from './handoff.mjs';
import {validatePublicCandidate} from './candidate-schema.mjs';
const data=JSON.parse(await readFile(new URL('./data.json',import.meta.url))),parent=data.sets.find(s=>s.name==='jane-walk-rear-v2');
const loop=data.sets.find(s=>s.name==='jane-walk-rear-cycle-cut-v1'),stop=data.sets.find(s=>s.name==='jane-walk-rear-stop-cut-v1');
test('rear cuts retain adjacent original ranges, native timing, framing and provenance',()=>{
 assert(parent&&loop&&stop);assert.equal(parent.original_video.sha256,'448b16709c90a1c42aa68d59caee8c818a6bbd09a827e531abb1d65eb99cacb7');
 for(const [cut,start,end,repeat]of [[loop,49,92,true],[stop,93,125,false]]){
  validatePublicCandidate(cut);assert.equal(cut.branch_of,parent.name);assert.equal(cut.source.derived_from_asset_id,parent.name);
  assert.equal(cut.preview_loop,repeat);assert.deepEqual(cut.geometry,parent.geometry);assert.deepEqual(cut.original_video,parent.original_video);
  assert.deepEqual(cut.frames.map(f=>f.source_frame),Array.from({length:end-start+1},(_,i)=>start+i));
  assert(cut.durations.every(d=>d===1000/24));assert.equal(cut.duration_verified_ms,(end-start+1)*1000/24);
  assert.equal(cut.source.loop_requested,false);assert.equal(cut.source.batch_size,1);assert.equal(cut.source.master_sha256,parent.source.master_sha256);
 }
 assert.equal(loop.frames.at(-1).source_frame+1,stop.frames[0].source_frame);
 assert.match(stop.source.review_classification,/no-stable-stop-certified/);
});
test('branches export and import independent reviews with bound relationships',async()=>{
 const sets=[parent,loop,stop],versions=await catalogVersions(sets),decisions={};
 for(const [set,decision,notes]of [[parent,'hold','Source'],[loop,'keep','Loop'],[stop,'hold','Plant']])decisions[set.name]={decision,notes,sourceKey:sourceIdentity(set),assetFingerprint:versions.get(set.name)};
 const h=buildHandoff(sets,versions,decisions),r=importHandoff(h,sets,versions);
 assert.equal(r.decisions[parent.name].decision,'hold');assert.equal(r.decisions[loop.name].decision,'keep');assert.equal(r.decisions[stop.name].notes,'Plant');
 h.assets.find(a=>a.assetId===stop.name).branchOf='another-source';assert.throws(()=>importHandoff(h,sets,versions),/Branch relationship/);
 const changed=structuredClone(loop);changed.branch_of='another-source';assert.notEqual((await catalogVersions([changed])).get(loop.name),versions.get(loop.name));
});
