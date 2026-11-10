import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,copyFile,unlink} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {catalogVersions,sourceIdentity} from './handoff.mjs';
const tool=fileURLToPath(new URL('./tools/apply-transparency.mjs',import.meta.url));
const hash=b=>createHash('sha256').update(b).digest('hex'),json=v=>JSON.stringify(v)+'\n';

test('transparency cutover recovers partial output and split metadata, protects shared media, and reruns idempotently',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'ad-transparency-'));
 try{
  const work=path.join(root,'.local','transparency','fixture');
  for(const folder of ['assets','.local/transparency/fixture/staged','.local/transparency/fixture/before-media/assets'])await mkdir(path.join(root,folder),{recursive:true});
  async function media(text){const sha256=hash(text),url='assets/'+sha256+'.png';await writeFile(path.join(root,url),text);return {url,sha256,source_frame:1,duration_ms:50};}
  const shared=await media('shared original'),obsolete=await media('obsolete original');
  const candidate={name:'approved',number:1,approval_category:'01_OWNER_APPROVED',media_kind:'animation',actual_dimensions:[[20,30]],geometry:{canvas:[20,30]},frames:[shared,{...obsolete,source_frame:2}],durations:[50,50],duration_verified_ms:100,unique_frame_files:2,source:{provider:'Reference',sha256:hash('provider')},usage:{character:'Test',action:'walk',direction:'right',attacking:false,status:'new-feature'}};
  const other={...structuredClone(candidate),name:'unreviewed',number:2,frames:[shared],durations:[50],duration_verified_ms:50,unique_frame_files:1};
  const before={sets:[candidate,other]},versions=await catalogVersions(before.sets),state={schema:'asset-displayer-review-state-v1',revision:13,decisions:Object.fromEntries(before.sets.map(s=>[s.name,{decision:s===candidate?'keep':'undecided',sourceKey:sourceIdentity(s),assetFingerprint:versions.get(s.name)}]))};
  const outputs=['clean frame one','clean frame two'].map((bytes,i)=>({bytes,frame:{url:'assets/'+hash(bytes)+'.png',sha256:hash(bytes),source_frame:i+1,duration_ms:50}}));
  const evidence=json({frames:outputs.map(()=>({protected_changed:0,output_alpha:{genuine_alpha:true}}))});
  const next=structuredClone(candidate);next.frames=outputs.map(o=>o.frame);next.transparency={schema:'ad-keep-transparency-v1',method:'native-matte-despill',helper_commit:'2a0754d3e9b899aeb90002533ddb75d2cd110f47',helper_sha256:hash('helper'),tolerance:92,edge_depth:4,matte_rgb:[255,0,255],evidence_sha256:hash(evidence),input_basis:'approved-frames'};
  await writeFile(path.join(work,'approved.json'),evidence);
  for(const [name,value]of [['data.json',before],['review-state.json',state],['comparisons.json',{baselines:[]}]] )await writeFile(path.join(root,name),json(value));
  for(const [name,value]of [['before-data.json',before],['before-review-state.json',state],['proposed-data.json',{sets:[next,other]}],['before-hashes.json',{media:{[shared.url]:shared.sha256,[obsolete.url]:obsolete.sha256}}]])await writeFile(path.join(work,name),json(value));
  for(const f of [shared,obsolete])await copyFile(path.join(root,f.url),path.join(work,'before-media',f.url));
  const run=()=>spawnSync(process.execPath,[tool,'--root',root,'--work',work],{encoding:'utf8'});
  await writeFile(path.join(work,'staged',path.basename(outputs[0].frame.url)),outputs[0].bytes);
  const interrupted=run();assert.notEqual(interrupted.status,0);assert.match(interrupted.stderr,/ENOENT/);
  assert.equal(await readFile(path.join(root,'data.json'),'utf8'),json(before));
  await writeFile(path.join(work,'staged',path.basename(outputs[1].frame.url)),outputs[1].bytes);
  const resumed=run();assert.equal(resumed.status,0,resumed.stderr);
  assert.equal(await readFile(path.join(root,shared.url),'utf8'),'shared original');
  await assert.rejects(readFile(path.join(root,obsolete.url)),{code:'ENOENT'});
  assert.equal(await readFile(path.join(work,'before-media',obsolete.url),'utf8'),'obsolete original');
  const published=JSON.parse(await readFile(path.join(root,'review-state.json')));
  assert.equal(published.revision,14);assert.equal(published.decisions.approved.decision,'keep');assert.equal(published.decisions.unreviewed.decision,'undecided');
  assert.notEqual(published.decisions.approved.assetFingerprint,state.decisions.approved.assetFingerprint);
  const afterData=await readFile(path.join(root,'data.json'),'utf8'),afterState=await readFile(path.join(root,'review-state.json'),'utf8');
  assert.equal(run().status,0);assert.equal(await readFile(path.join(root,'data.json'),'utf8'),afterData);assert.equal(await readFile(path.join(root,'review-state.json'),'utf8'),afterState);
  // Recreate interruption between atomic catalog and atomic state replacements.
  await unlink(path.join(work,'applied.json'));await writeFile(path.join(root,'review-state.json'),json(state));
  await copyFile(path.join(work,'before-media',obsolete.url),path.join(root,obsolete.url));
  const split=run();assert.equal(split.status,0,split.stderr);assert.equal(await readFile(path.join(root,'review-state.json'),'utf8'),afterState);
  await assert.rejects(readFile(path.join(root,obsolete.url)),{code:'ENOENT'});
  assert.equal(await readFile(path.join(root,shared.url),'utf8'),'shared original');
 }finally{await rm(root,{recursive:true,force:true});}
});
