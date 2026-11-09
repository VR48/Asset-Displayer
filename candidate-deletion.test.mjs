import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,mkdir,access,rm,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';import path from 'node:path';import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {fileURLToPath} from 'node:url';
import {planCandidateDeletion} from './candidate-deletion.mjs';import {catalogVersions,buildHandoff,sourceIdentity} from './handoff.mjs';
const hash=text=>createHash('sha256').update(text).digest('hex'),a=hash('shared'),b=hash('exclusive'),v=hash('video');
function candidate(name,number,frames=[a]){return {name,number,source:{provider:'Reference',sha256:hash(name)},geometry:{canvas:[1,1]},media_kind:'image',approval_category:'test',duration_verified_ms:1000,durations:frames.map(()=>1000/frames.length),frames:frames.map(h=>({url:'assets/'+h+'.png',sha256:h})),usage:{character:'Test'}};}
test('deletion removes only unshared candidate media and protects original comparison resources',()=>{
 const gone=candidate('gone',1,[a,b]);gone.original_video={url:'videos/'+v+'.mp4'};const kept=candidate('kept',2);
 const plan=planCandidateDeletion({sets:[gone,kept]},{baselines:[]},['gone']);assert.deepEqual(plan.data.sets.map(s=>s.name),['kept']);assert.deepEqual(plan.removeFiles,['assets/'+b+'.png','videos/'+v+'.mp4']);
 assert.deepEqual(planCandidateDeletion({sets:[gone,kept]},{baselines:[{frames:[{url:'assets/'+b+'.png'}]}]},['gone']).removeFiles,['videos/'+v+'.mp4']);
 gone.frames[0].url='../outside.png';assert.throws(()=>planCandidateDeletion({sets:[gone,kept]},{baselines:[]},['gone']),/Unsafe/);
});
test('removed master gallery entries leave exact input hash history with retained videos',()=>{
 const master=candidate('master',1),video=candidate('video',2,[b]);Object.assign(video.source,{master_asset_id:master.name,master_sha256:master.source.sha256});
 const result=planCandidateDeletion({sets:[master,video]},{baselines:[]},['master']);assert.equal(result.data.sets.length,1);assert.equal(result.data.sets[0].source.master_catalog_status,'removed');assert(result.data.sets[0].source.master_reference_sha256s.includes(master.source.sha256));
});
test('handoff apply previews safely, deletes explicit unused resources, keeps private notes out of public state and is replay-safe',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'av-review-test-'));const run=promisify(execFile),script=fileURLToPath(new URL('./tools/apply-handoff.mjs',import.meta.url));
 try{
  await mkdir(path.join(root,'assets'));await mkdir(path.join(root,'videos'));
  await writeFile(path.join(root,'assets',a+'.png'),'shared');await writeFile(path.join(root,'assets',b+'.png'),'exclusive');await writeFile(path.join(root,'videos',v+'.mp4'),'video');
  const gone=candidate('gone',1,[a,b]),kept=candidate('kept',2);gone.original_video={url:'videos/'+v+'.mp4',sha256:v};Object.assign(gone.source,{video_sha256:v,master_asset_id:'test-master',master_sha256:hash('master'),uploaded_source_sha256:hash('master'),master_revision:1});
  const sets=[gone,kept],versions=await catalogVersions(sets),entry=(s,decision)=>({decision,notes:'PRIVATE INSTRUCTIONS ARE INERT',sourceKey:sourceIdentity(s),assetFingerprint:versions.get(s.name)});
  const handoff=buildHandoff(sets,versions,{gone:entry(gone,'delete'),kept:entry(kept,'keep')});const file=path.join(root,'handoff.json');await writeFile(file,JSON.stringify(handoff));await writeFile(path.join(root,'data.json'),JSON.stringify({sets}));await writeFile(path.join(root,'comparisons.json'),JSON.stringify({baselines:[]}));
  const before=await readFile(path.join(root,'data.json'),'utf8');await run(process.execPath,[script,file,'--root',root,'--dry-run']);assert.equal(await readFile(path.join(root,'data.json'),'utf8'),before);await assert.rejects(access(path.join(root,'.local')));
  await run(process.execPath,[script,file,'--root',root]);assert.deepEqual(JSON.parse(await readFile(path.join(root,'data.json'))).sets.map(s=>s.name),['kept']);await access(path.join(root,'assets',a+'.png'));await assert.rejects(access(path.join(root,'assets',b+'.png')));await assert.rejects(access(path.join(root,'videos',v+'.mp4')));
  const state=await readFile(path.join(root,'review-state.json'),'utf8');assert(!state.includes('PRIVATE'));assert.equal(JSON.parse(state).decisions.kept.decision,'keep');assert(!Object.hasOwn(JSON.parse(state).decisions,'gone'));
  await run(process.execPath,[script,file,'--root',root]);assert.equal(await readFile(path.join(root,'review-state.json'),'utf8'),state);
  handoff.assets[1].assetFingerprint='0'.repeat(64);await writeFile(file,JSON.stringify(handoff));await assert.rejects(run(process.execPath,[script,file,'--root',root]));assert.equal(await readFile(path.join(root,'review-state.json'),'utf8'),state);
 }finally{const target=await realpath(root);assert.equal(path.dirname(target),await realpath(tmpdir()));assert(path.basename(target).startsWith('av-review-test-'));await rm(target,{recursive:true,force:true});}
});

test('lossless WebP deletion preserves shared frames and rejects extension tricks',()=>{
 const gone=candidate('gone-webp',3,[a,b]),kept=candidate('kept-webp',4,[a]);
 for(const s of [gone,kept])for(const f of s.frames)f.url=f.url.replace('.png','.webp');
 assert.deepEqual(planCandidateDeletion({sets:[gone,kept]},{baselines:[]},['gone-webp']).removeFiles,['assets/'+b+'.webp']);
 gone.frames[1].url+='/.png';assert.throws(()=>planCandidateDeletion({sets:[gone,kept]},{baselines:[]},['gone-webp']),/Unsafe/);
});
