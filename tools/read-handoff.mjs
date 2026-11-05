import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {catalogVersions,parseHandoff,importHandoff} from '../handoff.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const source=path.resolve(root,process.argv[2]??'.local/asset-displayer-handoff.json');
const sets=JSON.parse(await readFile(path.join(root,'data.json'),'utf8')).sets;
const versions=await catalogVersions(sets);
const handoff=parseHandoff(await readFile(source,'utf8'));
const checked=importHandoff(handoff,sets,versions);
const sections=['Asset Displayer — private review handoff',`Read from: ${source}`,`Saved at: ${handoff.savedAt}`,`Revision: ${handoff.revision}`,''];
for(const state of ['keep','hold','skip','undecided']){
 const group=handoff.assets.filter(a=>a.decision===state);
 sections.push(`${state.toUpperCase()} (${group.length})`);
 for(const item of group){sections.push(`- ${item.assetId} | MJ ${item.sourceJobId}`);if(item.requestedChanges)sections.push(`  Requested changes: ${item.requestedChanges}`);}
 sections.push('');
}
if(checked.unknown.length)sections.push('Assets absent from current catalog: '+checked.unknown.join(', '));
sections.push('Planning only: no runtime changes, deletion, publication or automatic archive performed.');
await mkdir(path.join(root,'.local'),{recursive:true});
const report=path.join(root,'.local/asset-displayer-handoff.txt');
await writeFile(report,sections.join('\n')+'\n');
console.log(sections.join('\n'));console.log('\nReport: '+report);
