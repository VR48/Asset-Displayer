import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const manifest=JSON.parse(await readFile(new URL('./data.json',import.meta.url),'utf8'));
const frames=new Map();let entries=0;
assert.equal(manifest.sets.length,34);
for(const set of manifest.sets){
 assert.match(set.source.mj_job_uuid,/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/);
 assert.equal(set.frames.length,set.durations.length);
 assert(set.durations.every(ms=>Number.isFinite(ms)&&ms>0));
 assert(Math.abs(set.durations.reduce((a,b)=>a+b,0)-set.duration_verified_ms)<0.01);
 for(const [i,frame]of set.frames.entries()){
  assert.match(frame.url,/^assets\/[a-f0-9]{64}\.png$/);assert(frame.url.includes(frame.sha256));
  const duration=frame.duration_numerator!==undefined?1000*frame.duration_numerator/frame.duration_denominator:frame.duration_ms;
  assert(Math.abs(duration-set.durations[i])<1e-6);frames.set(frame.url,frame.sha256);entries++;
 }
}
for(const [file,sha]of frames){const bytes=await readFile(new URL(file,import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),sha);assert.equal(bytes.subarray(1,4).toString(),'PNG');assert.equal(bytes[25],6);}
assert.equal((await readdir(new URL('./assets/',import.meta.url))).length,frames.size);
const content=await readFile(new URL('./data.json',import.meta.url),'utf8');
for(const privateField of ['provider_local_path','provider_message','owner_evidence','source_root_PRED','senderIp','controlToken','C:\\\\Users','D:\\\\'])assert(!content.includes(privateField),`Private field published: ${privateField}`);
const app=await readFile(new URL('./app.js',import.meta.url),'utf8');
assert(!app.includes("fetch('/"));assert(app.includes('img.src=current.frames[index].url'));
console.log(JSON.stringify({sets:manifest.sets.length,timelineEntries:entries,uniqueFrames:frames.size,sha256Verified:true,metadataBoundaryPassed:true}));
