import {readFile,rename,unlink,open,realpath} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {catalogVersions,sourceIdentity} from '../handoff.mjs';
import {validateReviewState} from '../review-state.mjs';
import {validatePublicCandidate} from '../candidate-schema.mjs';
import {candidateResources} from '../candidate-deletion.mjs';

const hash=b=>createHash('sha256').update(b).digest('hex');
const json=v=>JSON.stringify(v,null,2)+'\n';
const args=process.argv.slice(2);
let root=fileURLToPath(new URL('../',import.meta.url)),work;
for(let i=0;i<args.length;i++){
 if(args[i]==='--root')root=path.resolve(args[++i]);
 else if(args[i]==='--work')work=path.resolve(args[++i]);
 else throw Error('Usage: apply-transparency.mjs --work ARCHIVE [--root ROOT]');
}
root=await realpath(root);if(!work)throw Error('Private work directory required.');work=await realpath(work);
const privateRoot=path.join(root,'.local','transparency')+path.sep;
if(!work.startsWith(privateRoot))throw Error('Work directory escapes private archive.');
const read=async p=>readFile(p,'utf8');
async function atomic(file,bytes){const tmp=file+'.transparency.tmp',handle=await open(tmp,'w');try{await handle.writeFile(bytes);await handle.sync();}finally{await handle.close();}await rename(tmp,file);}
async function optional(file){try{return await read(file);}catch(e){if(e.code==='ENOENT')return null;throw e;}}
const txFile=path.join(work,'transaction.json');
let tx=JSON.parse(await optional(txFile)??'null');
if(!tx){
 const beforeData=await read(path.join(work,'before-data.json')),beforeState=await read(path.join(work,'before-review-state.json'));
 assert.equal(hash(await read(path.join(root,'data.json'))),hash(beforeData),'Catalog changed during processing');
 assert.equal(hash(await read(path.join(root,'review-state.json'))),hash(beforeState),'State changed during processing');
 const before=JSON.parse(beforeData),after=JSON.parse(await read(path.join(work,'proposed-data.json'))),state=validateReviewState(JSON.parse(beforeState));
 const oldVersions=await catalogVersions(before.sets),versions=await catalogVersions(after.sets),changed=[];
 assert.equal(before.sets.length,after.sets.length);assert.deepEqual({...before,sets:[]},{...after,sets:[]});
 for(const [i,s]of before.sets.entries()){
  const next=after.sets[i];assert.equal(next.name,s.name);
  if(JSON.stringify(s)===JSON.stringify(next))continue;
  assert.equal(state.decisions[s.name]?.decision,'keep');assert.notEqual(s.media_kind,'image');
  assert.equal(state.decisions[s.name].assetFingerprint,oldVersions.get(s.name),'Stale Keep cannot authorize processing');
  const stable=value=>{const {frames,durations,duration_verified_ms,unique_frame_files,unique_png_files,review_mode,transparency,source,...rest}=value;return rest;};
  assert.deepEqual(stable(next),stable(s),'Non-preview candidate metadata changed');
  const authority=source=>Object.fromEntries(Object.entries(source).filter(([k])=>!['processing','preview_basis','review_frame_encoding','protected_component_rgba_unchanged','review_rgb_lossless_verified'].includes(k)));
  assert.deepEqual(authority(next.source),authority(s.source),'Source authority changed');
  validatePublicCandidate(next);assert.deepEqual(next.geometry,s.geometry);assert.deepEqual(next.actual_dimensions,s.actual_dimensions);
  assert.deepEqual(next.original_video,s.original_video);assert.deepEqual(next.review_video,s.review_video);
  assert(Math.abs(next.duration_verified_ms-s.duration_verified_ms)<.01);
  if(s.review_mode!=='native-video'){
   assert.deepEqual(next.durations,s.durations);
   for(const [j,f]of next.frames.entries())for(const [k,v]of Object.entries(s.frames[j]))if(!['url','sha256','rgba_sha256'].includes(k))assert.deepEqual(f[k],v);
  }else{assert.equal(next.frames.length,s.native_frame_count);assert.deepEqual(next.frames.map(f=>f.source_frame),Array.from({length:s.native_frame_count},(_,j)=>j+1));}
  const evidence=await readFile(path.join(work,s.name+'.json'));assert.equal(hash(evidence),next.transparency.evidence_sha256);
  for(const metric of JSON.parse(evidence).frames){assert.equal(metric.protected_changed??0,0);assert(metric.preserved||metric.output_alpha.genuine_alpha);}
  changed.push(s.name);
 }
 assert(changed.length,'No changed previews to apply');
 // Only changed preview frames are eligible for pruning. All references in the
 // resulting catalog and comparison baselines protect shared files.
 const live=new Set(after.sets.flatMap(candidateResources));
 const comparisons=await read(path.join(root,'comparisons.json'));
 for(const b of JSON.parse(comparisons).baselines)for(const f of b.frames)live.add(f.url);
 const remove=[...new Set(before.sets.filter(s=>changed.includes(s.name)).flatMap(s=>s.frames.map(f=>f.url)))].filter(u=>!live.has(u));
 for(const name of changed){state.decisions[name]={...state.decisions[name],sourceKey:sourceIdentity(after.sets.find(s=>s.name===name)),assetFingerprint:versions.get(name)};}
 state.revision++;validateReviewState(state);
 const afterData=JSON.stringify(after)+'\n',afterState=json(state),archiveHashes=JSON.parse(await read(path.join(work,'before-hashes.json')));
 const outputs=[...new Set(after.sets.filter(s=>changed.includes(s.name)).flatMap(s=>s.frames.map(f=>f.url)))];
 const body={schema:'ad-transparency-transaction-v1',beforeDataHash:hash(beforeData),beforeStateHash:hash(beforeState),afterDataHash:hash(afterData),afterStateHash:hash(afterState),comparisonHash:hash(comparisons),afterData,afterState,outputs,remove,archiveHashes,changed,revision:state.revision};
 tx={...body,integrityHash:hash(JSON.stringify(body))};
 // A durable plan precedes any public media or metadata mutation.
 await atomic(path.join(work,'after-data.json'),afterData);await atomic(path.join(work,'after-review-state.json'),afterState);await atomic(txFile,json(tx));
}
const {integrityHash,...body}=tx;assert.equal(integrityHash,hash(JSON.stringify(body)));assert.equal(tx.schema,'ad-transparency-transaction-v1');
assert.equal(hash(tx.afterData),tx.afterDataHash);assert.equal(hash(tx.afterState),tx.afterStateHash);
assert.equal(hash(await read(path.join(root,'comparisons.json'))),tx.comparisonHash);
for(const [name,expected]of [['before-data.json',tx.beforeDataHash],['before-review-state.json',tx.beforeStateHash]])assert.equal(hash(await readFile(path.join(work,name))),expected);
for(const [url,expected]of Object.entries(tx.archiveHashes.media))assert.equal(hash(await readFile(path.join(work,'before-media',url))),expected);
const applied=await optional(path.join(work,'applied.json'));
if(applied){assert.equal(JSON.parse(applied).integrityHash,integrityHash);console.log(json({alreadyApplied:true,revision:tx.revision,changed:tx.changed}));process.exit(0);}
for(const [name,before,after]of [['data.json',tx.beforeDataHash,tx.afterDataHash],['review-state.json',tx.beforeStateHash,tx.afterStateHash]])assert([before,after].includes(hash(await readFile(path.join(root,name)))),'Refusing stale recovery: '+name);
function media(url){candidateResources({frames:[{url}]});assert(url.startsWith('assets/'));const file=path.resolve(root,url);assert.equal(path.dirname(file),path.join(root,'assets'));return file;}
for(const url of tx.outputs){
 const dest=media(url),expected=path.basename(url).split('.')[0];let bytes;
 try{bytes=await readFile(dest);}catch(e){if(e.code!=='ENOENT')throw e;bytes=await readFile(path.join(work,'staged',path.basename(url)));assert.equal(hash(bytes),expected);await atomic(dest,bytes);}
 assert.equal(hash(bytes),expected);
}
await atomic(path.join(root,'data.json'),tx.afterData);await atomic(path.join(root,'review-state.json'),tx.afterState);
for(const url of tx.remove){
 assert.equal(tx.archiveHashes.media[url],path.basename(url).split('.')[0]);
 const file=media(url);try{assert.equal(hash(await readFile(file)),tx.archiveHashes.media[url]);await unlink(file);}catch(e){if(e.code!=='ENOENT')throw e;}
}
await atomic(path.join(work,'applied.json'),json({integrityHash,revision:tx.revision}));
console.log(json({alreadyApplied:false,revision:tx.revision,changed:tx.changed,removedUnsharedFrames:tx.remove.length}));
