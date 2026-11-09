export const SCHEMA='asset-displayer-handoff-v1';
export const FILE_NAME='asset-displayer-handoff.json';
const choices=new Set(['undecided','keep','hold','skip','delete']);
export const sourceIdentity=set=>set.source.mj_job_uuid??set.source.job_id??set.source.sha256;
async function sha(value){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value))))].map(b=>b.toString(16).padStart(2,'0')).join('');}
export async function catalogVersions(sets){
 const result=new Map();
 for(const set of sets)result.set(set.name,await sha({uuid:set.source.mj_job_uuid,geometry:set.geometry,frames:set.frames.map((f,i)=>[f.sha256,set.durations[i]]),...(set.replacement?{replacement:set.replacement}:{}),...(!set.source.mj_job_uuid?{source:set.source,mediaKind:set.media_kind}:{}),...(set.review_video?{reviewVideo:set.review_video}:{}),...(set.original_video?{originalVideo:set.original_video,inputMasterSha256:set.source.master_sha256,inputUploadedSha256:set.source.uploaded_source_sha256,inputTransform:set.source.source_transform??null,inputMasterRevision:set.source.master_revision}:{})}));
 return result;
}
export function sanitizeDecisions(value,sets,versions){
 const result=Object.create(null);
 if(!value||typeof value!=='object'||Array.isArray(value))return result;
 for(const set of sets){
  const entry=Object.hasOwn(value,set.name)?value[set.name]:null;
  if(!entry||!choices.has(entry.decision)||typeof entry.notes!=='string'||entry.notes.length>4000)continue;
  const key=entry.sourceKey??entry.mjJobUuid,previous=typeof key==='string'&&[set.source.previous_sha256,...(set.source.previous_sha256s??[])].includes(key);
  if(key!==sourceIdentity(set)&&!previous)continue;
  const stale=previous||versions&&entry.assetFingerprint!==versions.get(set.name);
  result[set.name]={decision:stale?'undecided':entry.decision,notes:entry.notes,mjJobUuid:set.source.mj_job_uuid,sourceKey:sourceIdentity(set),packageCategory:set.approval_category,replaceApproved:!stale&&entry.decision==='keep'&&!!set.replacement&&entry.replaceApproved===true&&entry.replacementFingerprint===set.replacement.baselineFingerprint,replacementFingerprint:set.replacement?.baselineFingerprint,...(versions?{assetFingerprint:versions.get(set.name)}:{}),...((stale||entry.needsReview)?{needsReview:true,previousDecision:entry.previousDecision??entry.decision}:{})};
 }
 return result;
}
export function buildHandoff(sets,versions,decisions,revision=0){
 const clean=sanitizeDecisions(decisions,sets,versions);
 const assets=sets.map(set=>({assetId:set.name,assetNumber:set.number,assetFingerprint:versions.get(set.name),sourceJobId:set.source.mj_job_uuid??set.source.job_id??null,...(!set.source.mj_job_uuid?{sourceProvider:set.source.provider,sourceAssetSha256:set.source.sha256,sourcePreviewSha256:set.source.preview_sha256??null,mediaKind:set.media_kind}:{}),...(set.source.origin_mj_job_uuid?{sourceOrigin:{provider:'Midjourney',jobId:set.source.origin_mj_job_uuid,imageIndex:set.source.origin_image_index}}:{}),...(set.original_video?{originalVideoSha256:set.original_video.sha256,inputMasterAssetId:set.source.master_asset_id,inputMasterSha256:set.source.master_sha256,inputUploadedSha256:set.source.uploaded_source_sha256,inputTransform:set.source.source_transform??null,inputMasterRevision:set.source.master_revision}:{}),...(set.review_video?{reviewVideoSha256:set.review_video.sha256,processing:set.source.processing}:{}),packageCategory:set.approval_category,decision:clean[set.name]?.decision??'undecided',requestedChanges:clean[set.name]?.notes??'',...(set.review_mode==='native-video'?{reviewMode:'native-video',nativeFrameCount:set.native_frame_count,loopRequested:set.source.loop_requested,pairedContinuousAssetId:set.paired_continuous_asset_id,pairedLoopAssetId:set.paired_loop_asset_id}:{}),timelineEntries:set.frames.length,durationMs:set.duration_verified_ms,...(set.usage?{usage:set.usage}:{}),...(set.replacement?{replacement:{...set.replacement,approved:clean[set.name]?.replaceApproved===true}}:{}),...(clean[set.name]?.needsReview?{needsReview:true,previousDecision:clean[set.name].previousDecision}:{})}));
 return {schema:SCHEMA,project:'Lanternwake',savedAt:new Date().toISOString(),revision,decisionLabels:{undecided:'Undecided',keep:'Keep candidate',hold:'Hold / compare',skip:'Redo',delete:'Delete candidate'},summary:Object.fromEntries([...choices].map(c=>[c,assets.filter(a=>a.decision===c).length])),assets};
}
export function importHandoff(value,sets,versions){
 if(!value||value.schema!==SCHEMA||value.project!=='Lanternwake'||!Array.isArray(value.assets)||value.assets.length>1000)throw Error('This is not an Asset Displayer handoff.');
 const catalog=new Map(sets.map(s=>[s.name,s])),seen=new Set(),decisions=Object.create(null),unknown=[];
 for(const entry of value.assets){
  if(!entry||typeof entry.assetId!=='string'||seen.has(entry.assetId)||!choices.has(entry.decision)||typeof entry.requestedChanges!=='string'||entry.requestedChanges.length>4000)throw Error('Invalid or duplicate asset decision.');
  seen.add(entry.assetId);const set=catalog.get(entry.assetId);
  if(!set){unknown.push(entry.assetId);continue;}
  if(entry.sourceJobId!==(set.source.mj_job_uuid??set.source.job_id??null)||entry.assetFingerprint!==versions.get(set.name)||!set.source.mj_job_uuid&&(entry.sourceProvider!==set.source.provider||entry.sourceAssetSha256!==set.source.sha256||entry.sourcePreviewSha256!==(set.source.preview_sha256??null)||entry.mediaKind!==set.media_kind))throw Error('The source version changed for '+set.name+'. Review it again before importing.');
  if(set.source.origin_mj_job_uuid&&(entry.sourceOrigin?.provider!=='Midjourney'||entry.sourceOrigin?.jobId!==set.source.origin_mj_job_uuid||entry.sourceOrigin?.imageIndex!==set.source.origin_image_index)||entry.sourceOrigin&&!set.source.origin_mj_job_uuid)throw Error('Source origin changed for '+set.name);
  if(set.original_video&&(entry.originalVideoSha256!==set.original_video.sha256||entry.inputMasterAssetId!==set.source.master_asset_id||entry.inputMasterSha256!==set.source.master_sha256||entry.inputUploadedSha256!==set.source.uploaded_source_sha256||entry.inputMasterRevision!==set.source.master_revision||JSON.stringify(entry.inputTransform??null)!==JSON.stringify(set.source.source_transform??null)))throw Error('Original video or input master changed for '+set.name);
  if(set.review_video&&entry.reviewVideoSha256!==set.review_video.sha256||!set.review_video&&entry.reviewVideoSha256)throw Error('Review video changed for '+set.name);
  if(entry.replacement){if(!set.replacement||Object.keys(set.replacement).some(key=>entry.replacement[key]!==set.replacement[key]))throw Error('Replacement target changed for '+set.name);if(typeof entry.replacement.approved!=='boolean'||entry.replacement.approved&& (entry.decision!=='keep'||entry.needsReview))throw Error('Invalid replacement approval');}
  decisions[set.name]={decision:entry.needsReview?'undecided':entry.decision,notes:entry.requestedChanges,mjJobUuid:set.source.mj_job_uuid,sourceKey:sourceIdentity(set),packageCategory:set.approval_category,assetFingerprint:versions.get(set.name),replaceApproved:entry.replacement?.approved===true,replacementFingerprint:set.replacement?.baselineFingerprint,...(entry.needsReview?{needsReview:true,previousDecision:choices.has(entry.previousDecision)?entry.previousDecision:'undecided'}:{})};
 }
 return {decisions,unknown};
}
export function parseHandoff(text){if(typeof text!=='string'||text.length>2000000)throw Error('Handoff is too large.');try{return JSON.parse(text);}catch{throw Error('Handoff is not valid JSON.');}}
