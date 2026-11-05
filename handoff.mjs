export const SCHEMA='asset-displayer-handoff-v1';
export const FILE_NAME='asset-displayer-handoff.json';
const choices=new Set(['undecided','keep','hold','skip']);
async function sha(value){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value))))].map(b=>b.toString(16).padStart(2,'0')).join('');}
export async function catalogVersions(sets){
 const result=new Map();
 for(const set of sets)result.set(set.name,await sha({uuid:set.source.mj_job_uuid,geometry:set.geometry,frames:set.frames.map((f,i)=>[f.sha256,set.durations[i]])}));
 return result;
}
export function sanitizeDecisions(value,sets,versions){
 const result=Object.create(null);
 if(!value||typeof value!=='object'||Array.isArray(value))return result;
 for(const set of sets){
  const entry=Object.hasOwn(value,set.name)?value[set.name]:null;
  if(!entry||!choices.has(entry.decision)||typeof entry.notes!=='string'||entry.notes.length>4000||entry.mjJobUuid!==set.source.mj_job_uuid)continue;
  const stale=versions&&entry.assetFingerprint!==versions.get(set.name);
  result[set.name]={decision:stale?'undecided':entry.decision,notes:entry.notes,mjJobUuid:set.source.mj_job_uuid,packageCategory:set.approval_category,...(versions?{assetFingerprint:versions.get(set.name)}:{}),...((stale||entry.needsReview)?{needsReview:true,previousDecision:entry.previousDecision??entry.decision}:{})};
 }
 return result;
}
export function buildHandoff(sets,versions,decisions,revision=0){
 const clean=sanitizeDecisions(decisions,sets,versions);
 const assets=sets.map(set=>({assetId:set.name,assetNumber:set.number,assetFingerprint:versions.get(set.name),sourceJobId:set.source.mj_job_uuid,packageCategory:set.approval_category,decision:clean[set.name]?.decision??'undecided',requestedChanges:clean[set.name]?.notes??'',timelineEntries:set.frames.length,durationMs:set.duration_verified_ms,...(clean[set.name]?.needsReview?{needsReview:true,previousDecision:clean[set.name].previousDecision}:{})}));
 return {schema:SCHEMA,project:'Lanternwake',savedAt:new Date().toISOString(),revision,summary:Object.fromEntries([...choices].map(c=>[c,assets.filter(a=>a.decision===c).length])),assets};
}
export function importHandoff(value,sets,versions){
 if(!value||value.schema!==SCHEMA||value.project!=='Lanternwake'||!Array.isArray(value.assets)||value.assets.length>1000)throw Error('This is not an Asset Displayer handoff.');
 const catalog=new Map(sets.map(s=>[s.name,s])),seen=new Set(),decisions=Object.create(null),unknown=[];
 for(const entry of value.assets){
  if(!entry||typeof entry.assetId!=='string'||seen.has(entry.assetId)||!choices.has(entry.decision)||typeof entry.requestedChanges!=='string'||entry.requestedChanges.length>4000)throw Error('Invalid or duplicate asset decision.');
  seen.add(entry.assetId);const set=catalog.get(entry.assetId);
  if(!set){unknown.push(entry.assetId);continue;}
  if(entry.sourceJobId!==set.source.mj_job_uuid||entry.assetFingerprint!==versions.get(set.name))throw Error('The source version changed for '+set.name+'. Review it again before importing.');
  decisions[set.name]={decision:entry.needsReview?'undecided':entry.decision,notes:entry.requestedChanges,mjJobUuid:set.source.mj_job_uuid,packageCategory:set.approval_category,assetFingerprint:versions.get(set.name),...(entry.needsReview?{needsReview:true,previousDecision:choices.has(entry.previousDecision)?entry.previousDecision:'undecided'}:{})};
 }
 return {decisions,unknown};
}
export function parseHandoff(text){if(typeof text!=='string'||text.length>2000000)throw Error('Handoff is too large.');try{return JSON.parse(text);}catch{throw Error('Handoff is not valid JSON.');}}
// Serialized writes plus an optimistic content check avoid overwriting changes
// from another tab/editor. No file handles or notes are transmitted over HTTP.
export class HandoffWriter {
 constructor(handle,initialText,onState=()=>{}){this.handle=handle;this.expected=initialText;this.onState=onState;this.queue=Promise.resolve();this.active=true;}
 enqueue(snapshot){
  if(!this.active)return Promise.reject(Error('Handoff is disconnected.'));
  const text=JSON.stringify(snapshot,null,2)+'\n';
  this.onState('saving');
  const work=this.queue.catch(()=>{}).then(async()=>{
   if(!this.active)return;
   const commit=async()=>{
    let stream;
    try{
     stream=await this.handle.createWritable({mode:'exclusive'});
     if(await(await this.handle.getFile()).text()!==this.expected)throw Error('The handoff changed in another tab or editor. Reconnect and review it before saving.');
     await stream.write(text);await stream.close();this.expected=text;this.onState('saved',snapshot.savedAt);
    }catch(error){try{await stream?.abort();}catch{}throw error;}
   };
   const locks=globalThis.navigator?.locks;
   if(locks)await locks.request('asset-displayer-handoff-'+this.handle.name,{mode:'exclusive',ifAvailable:true},async lock=>{if(!lock)throw Error('Another tab is writing this handoff. Wait, then reconnect.');return commit();});
   else await commit();
  });
  this.queue=work.catch(error=>{this.onState('error',error.message);throw error;});
  // Keep the queue rejection observed even if the caller closes the page.
  this.queue.catch(()=>{});return this.queue;
 }
 async disconnect(){this.active=false;await this.queue.catch(()=>{});this.onState('disconnected');}
}
