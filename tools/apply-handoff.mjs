import {readFile,writeFile,mkdir,rename,unlink,realpath} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {catalogVersions,parseHandoff,importHandoff,sourceIdentity} from '../handoff.mjs';
import {emptyReviewState,validateReviewState} from '../review-state.mjs';
import {planCandidateDeletion} from '../candidate-deletion.mjs';

const args=process.argv.slice(2),dryRun=args.includes('--dry-run');
let root=fileURLToPath(new URL('../',import.meta.url)),source;
for(let i=0;i<args.length;i++){
 if(args[i]==='--dry-run')continue;
 if(args[i]==='--root'){if(!args[i+1])throw Error('--root requires a directory.');root=path.resolve(args[++i]);continue;}
 if(args[i].startsWith('--')||source)throw Error('Usage: node tools/apply-handoff.mjs HANDOFF.json [--dry-run]');
 source=path.resolve(args[i]);
}
if(!source)throw Error('Provide the downloaded handoff JSON.');
root=await realpath(root);
const bytes=await readFile(source),inputHash=createHash('sha256').update(bytes).digest('hex');
const data=JSON.parse(await readFile(path.join(root,'data.json'),'utf8'));
const comparisons=JSON.parse(await readFile(path.join(root,'comparisons.json'),'utf8'));
const versions=await catalogVersions(data.sets),handoff=parseHandoff(bytes.toString('utf8').replace(/^\uFEFF/,''));
const checked=importHandoff(handoff,data.sets,versions);
let previous;try{previous=validateReviewState(JSON.parse(await readFile(path.join(root,'review-state.json'),'utf8')));}catch(e){if(e.code!=='ENOENT')throw e;previous=emptyReviewState();}
const ids=Object.entries(checked.decisions).filter(([,e])=>e.decision==='delete'&&!e.needsReview).map(([id])=>id);
const deletion=planCandidateDeletion(data,comparisons,ids);
const statuses=Object.create(null);
for(const set of deletion.data.sets){
 const entry=checked.decisions[set.name]??previous.decisions[set.name];
 if(!entry)continue;
 statuses[set.name]={decision:entry.decision,sourceKey:entry.sourceKey??sourceIdentity(set),assetFingerprint:entry.assetFingerprint??versions.get(set.name)};
}
const keys=Object.keys(statuses),same=keys.length===Object.keys(previous.decisions).length&&keys.every(id=>Object.hasOwn(previous.decisions,id)&&['decision','sourceKey','assetFingerprint'].every(k=>previous.decisions[id][k]===statuses[id][k]));
const published=validateReviewState({schema:previous.schema,revision:previous.revision+(same?0:1),decisions:statuses});
const resources=[];
for(const url of deletion.removeFiles){
 const file=path.resolve(root,url),folder=path.dirname(file);
 if(![path.join(root,'assets'),path.join(root,'videos')].includes(folder))throw Error('Resource escapes the AV media directories.');
 const actual=await realpath(file),relative=path.relative(root,actual);
 if(relative.startsWith('..')||path.isAbsolute(relative)||path.dirname(actual)!==folder)throw Error('Resource resolves outside its AV media directory.');
 const expected=path.basename(url).split('.')[0],hash=createHash('sha256').update(await readFile(file)).digest('hex');
 if(hash!==expected)throw Error('Media hash changed before deletion: '+url);
 resources.push(file);
}
const report={dryRun,inputHash,baselineRevision:published.revision,counts:Object.fromEntries(['undecided','keep','hold','skip','delete'].map(c=>[c,Object.values(checked.decisions).filter(e=>e.decision===c).length])),deletedCandidates:ids,removedResources:deletion.removeFiles,unknown:checked.unknown};
if(!dryRun){
 // Full handoff/notes/removal records stay in ignored local storage only.
 const archive=path.join(root,'.local','reviews',inputHash);await mkdir(archive,{recursive:true});
 await writeFile(path.join(archive,'handoff.json'),bytes);
 await writeFile(path.join(archive,'decisions.private.json'),JSON.stringify(checked.decisions,null,2)+'\n');
 await writeFile(path.join(archive,'removed-entries.json'),JSON.stringify(deletion.removed,null,2)+'\n');
 await writeFile(path.join(archive,'report.json'),JSON.stringify(report,null,2)+'\n');
 async function atomic(name,value){const file=path.join(root,name),temp=file+'.tmp';await writeFile(temp,JSON.stringify(value,null,name==='data.json'?undefined:2)+'\n');await rename(temp,file);}
 if(ids.length)await atomic('data.json',deletion.data);
 await atomic('review-state.json',published);
 for(const file of resources)await unlink(file);
}
console.log(JSON.stringify(report,null,2));
