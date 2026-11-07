import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {baselineFor} from './comparison.mjs';
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
assert(!app.includes("fetch('/"));assert(app.includes('img.src=set.frames[index].url'));
const catalog=JSON.parse(await readFile(new URL('./comparisons.json',import.meta.url),'utf8'));
const originalFrames=new Map();
for(const b of catalog.baselines){
 const {fingerprint,...source}=b;assert.equal(createHash('sha256').update(JSON.stringify(source)).digest('hex'),fingerprint);
 assert.equal(b.frames.length,b.durations.length);assert(b.durations.every(ms=>Number.isFinite(ms)&&ms>0));
 assert(Math.abs(b.durations.reduce((a,n)=>a+n,0)-b.duration_verified_ms)<1e-6);
 assert.match(b.sourceManifest,/^dist\/assets\/heroes\/(rook|vale|kest|mica)-animation\.json$/);
 for(const f of b.frames){assert.equal(f.url,`baselines/${f.sha256}.png`);originalFrames.set(f.url,f.sha256);}
}
for(const s of manifest.sets){assert(s.usage);assert.equal(Boolean(baselineFor(s,catalog)),s.usage.status==='replacement');}
for(const [file,hash]of originalFrames){const bytes=await readFile(new URL(file,import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),hash);assert.equal(bytes[25],6);}
assert.equal((await readdir(new URL('./baselines/',import.meta.url))).length,originalFrames.size);
console.log(JSON.stringify({sets:manifest.sets.length,timelineEntries:entries,uniqueFrames:frames.size,replacementCandidates:catalog.baselines.length,originalFrames:originalFrames.size,sha256Verified:true,metadataBoundaryPassed:true}));
