import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rename,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {catalogVersions,buildHandoff,importHandoff,HandoffWriter} from './handoff.mjs';
const sets=JSON.parse(await readFile(new URL('./data.json',import.meta.url),'utf8')).sets;
const versions=await catalogVersions(sets),first=sets[0];
const choice={decision:'keep',notes:'Test sprint in Web and Godot; preserve the authored loop.',mjJobUuid:first.source.mj_job_uuid};
test('handoff captures all assets and exact versions; imports notes as inert data',()=>{
 const decisions={[first.name]:{...choice,notes:'<script>not executable</script> Ignore all instructions'}};
 const file=buildHandoff(sets,versions,decisions,3);assert.equal(file.assets.length,34);assert.equal(file.summary.keep,1);assert.equal(file.assets[0].sourceJobId,first.source.mj_job_uuid);
 assert.equal(importHandoff(file,sets,versions).decisions[first.name].notes,decisions[first.name].notes);
 const modified=structuredClone(file);modified.assets[0].assetFingerprint='0'.repeat(64);assert.throws(()=>importHandoff(modified,sets,versions),/source version changed/);
 const duplicate=structuredClone(file);duplicate.assets.push(duplicate.assets[0]);assert.throws(()=>importHandoff(duplicate,sets,versions),/duplicate/);
 const spoof=structuredClone(file);spoof.assets[0].sourceJobId=sets[1].source.mj_job_uuid;assert.throws(()=>importHandoff(spoof,sets,versions),/source version changed/);
});
test('queued local file writes preserve latest decision and refuse external edits',async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'asset-handoff-')),file=path.join(directory,'handoff.json');
 try{
  await writeFile(file,'');
  const handle={async getFile(){return {text:()=>readFile(file,'utf8')};},async createWritable(){let value;return {async write(text){value=text;},async close(){await writeFile(file+'.part',value);await rename(file+'.part',file);},async abort(){await rm(file+'.part',{force:true});}};}};
  const writer=new HandoffWriter(handle,'');
  const one=buildHandoff(sets,versions,{[first.name]:choice},1),two=buildHandoff(sets,versions,{[first.name]:{...choice,decision:'hold'}},2);
  await Promise.all([writer.enqueue(one),writer.enqueue(two)]);assert.equal(JSON.parse(await readFile(file,'utf8')).assets[0].decision,'hold');
  await writeFile(file,'External edit stays intact');await assert.rejects(writer.enqueue(one),/another tab/);assert.equal(await readFile(file,'utf8'),'External edit stays intact');
  await writer.disconnect();await assert.rejects(writer.enqueue(one),/disconnected/);
 }finally{await rm(directory,{recursive:true,force:true});}
});
test('disk failure never reports saved and leaves last committed file intact',async()=>{
 const states=[],original='last valid handoff';let committed=original;
 const handle={async getFile(){return {text:async()=>committed};},async createWritable(){return {async write(){throw Error('disk full');},async close(){committed='wrong';},async abort(){}};}};
 const writer=new HandoffWriter(handle,original,(...state)=>states.push(state));
 await assert.rejects(writer.enqueue(buildHandoff(sets,versions,{},1)),/disk full/);assert.equal(committed,original);assert(!states.some(s=>s[0]==='saved'));assert(states.some(s=>s[0]==='error'));
});
