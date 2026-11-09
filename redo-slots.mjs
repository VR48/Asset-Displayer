import {actionKind,validatePublicCandidate} from './candidate-schema.mjs';
export const candidateVersion=s=>Number.isSafeInteger(s.candidate_version)?s.candidate_version:Number(s.name.match(/-v(\d+)$/)?.[1]??1);
export const candidateSlot=s=>s.slot_id??s.name.replace(/-v\d+$/,'');
const sourceKey=s=>s.source.mj_job_uuid??s.source.job_id??s.source.sha256;
export function pendingRedoNotes(slots,stored,legacy){
 const out=Object.create(null);for(const slot of slots){if(slot.currentAssetId)continue;const saved=stored?.redoNotes?.[slot.id];if(typeof saved==='string'&&saved.length<=4000)out[slot.id]=saved;
 for(const id of [...slot.rejectedAssetIds].reverse()){const note=stored?.overrides?.[id]?.notes??legacy?.[id]?.notes;if(typeof note==='string'&&note&&note.length<=4000){out[slot.id]=note;break;}}}return out;
}
export function retargetPairs(data,removedIds=[]){
 const removed=new Set(removedIds),sets=new Map(data.sets.map(s=>[s.name,s]));
 for(const s of data.sets)for(const [field,slotField]of [['paired_loop_asset_id','paired_loop_slot_id'],['paired_continuous_asset_id','paired_continuous_slot_id']]){
  const id=s[field],slot=(data.redo_slots??[]).find(r=>r.id===s[slotField]||r.rejectedAssetIds.includes(id));
  if(slot&&(s[slotField]||removed.has(id))){const active=sets.get(slot.currentAssetId);if(active&&active.source.master_sha256===s.source.master_sha256){s[field]=active.name;delete s[slotField];}else{delete s[field];s[slotField]=slot.id;}if(id){s.source.retired_pair_asset_ids=[...new Set([...(s.source.retired_pair_asset_ids??[]),id])];}}
  else if(s[slotField]&&!slot){delete s[slotField];}
  else if(id&&removed.has(id)){delete s[field];s.source.retired_pair_asset_ids=[...new Set([...(s.source.retired_pair_asset_ids??[]),id])];}
 }
}
export function applyRedoSlots(before,after,decisions,redoIds,removedIds=redoIds){
 const next=structuredClone(after),slots=structuredClone(before.redo_slots??[]).filter(r=>!removedIds.includes(r.currentAssetId)||redoIds.includes(r.currentAssetId)),removed=new Set(removedIds),byName=new Map(before.sets.map(s=>[s.name,s])),touched=new Set();
 for(const id of redoIds){const s=byName.get(id);if(!s)throw Error('Unknown redo candidate.');const key=candidateSlot(s);let slot=slots.find(r=>r.id===key||r.rejectedAssetIds.includes(id));
  if(!slot){slot={id:key,number:s.number,character:s.usage.character,action:s.usage.action??'Candidate',direction:s.usage.direction??'',mediaKind:s.media_kind??'animation',category:s.approval_category??'06_NEW_CHARACTER_CANDIDATES',nextVersion:1,currentAssetId:null,status:'awaiting-replacement',rejectedAssetIds:[],rejectedVersions:[]};slots.push(slot);}
  slot.number=Math.min(slot.number,s.number);if(!slot.rejectedAssetIds.includes(id)){slot.rejectedAssetIds.push(id);slot.rejectedVersions.push({assetId:id,version:candidateVersion(s),sourceKey:sourceKey(s),masterSha256:s.source.master_sha256??null,masterRevision:s.source.master_revision??null,originalVideoSha256:s.original_video?.sha256??null});}
  slot.nextVersion=Math.max(slot.nextVersion,candidateVersion(s)+1,...before.sets.filter(a=>candidateSlot(a)===key).map(a=>candidateVersion(a)+1));touched.add(slot.id);
 }
 for(const slot of slots){if(!touched.has(slot.id))continue;
  const eligible=next.sets.filter(s=>(s.slot_id===slot.id||slot.rejectedAssetIds.includes(s.source.redo_of))&&s.usage.character===slot.character&&actionKind(s.usage.action)===actionKind(slot.action)&&(s.usage.direction??'')===slot.direction&&(s.media_kind??'animation')===slot.mediaKind).sort((a,b)=>candidateVersion(b)-candidateVersion(a));
  const current=eligible.find(s=>s.name===slot.currentAssetId)??eligible[0];slot.currentAssetId=current?.name??null;slot.status=current?'active':'awaiting-replacement';
  if(current){current.number=slot.number;current.slot_id=slot.id;current.candidate_version=candidateVersion(current);slot.nextVersion=Math.max(slot.nextVersion,current.candidate_version+1);}
 }
 next.redo_slots=slots.sort((a,b)=>a.number-b.number);retargetPairs(next,removedIds);next.sets.sort((a,b)=>a.number-b.number);validateRedoSlots(next);return next;
}
export function validateRedoSlots(data){
 const slots=data.redo_slots??[],ids=new Set(),numbers=new Set(),sets=new Map(data.sets.map(s=>[s.name,s]));
 for(const r of slots){if(Object.keys(r).some(k=>!['id','number','character','action','direction','mediaKind','category','nextVersion','currentAssetId','status','rejectedAssetIds','rejectedVersions'].includes(k)))throw Error('Unexpected public redo-slot field.');
  if(typeof r.id!=='string'||!r.id||ids.has(r.id)||!Number.isSafeInteger(r.number)||r.number<1||numbers.has(r.number)||!Number.isSafeInteger(r.nextVersion)||r.nextVersion<2||!Array.isArray(r.rejectedAssetIds)||!Array.isArray(r.rejectedVersions))throw Error('Invalid redo slot.');ids.add(r.id);numbers.add(r.number);
  for(const old of r.rejectedVersions)if(Object.keys(old).some(k=>!['assetId','version','sourceKey','masterSha256','masterRevision','originalVideoSha256'].includes(k)))throw Error('Unexpected public redo history field.');
  if(r.rejectedAssetIds.some(id=>sets.has(id)))throw Error('Rejected version still appears in catalog.');
  const current=sets.get(r.currentAssetId);if(r.status==='active'){if(!current||current.slot_id!==r.id||current.number!==r.number||candidateVersion(current)>=r.nextVersion)throw Error('Invalid active replacement.');}else if(r.status!=='awaiting-replacement'||r.currentAssetId!==null||data.sets.some(s=>s.number===r.number))throw Error('Pending slot is not reserved.');
 }
 for(const s of data.sets){if(s.slot_id&&!slots.some(r=>r.id===s.slot_id&&r.currentAssetId===s.name))throw Error('Candidate is not the registered slot version.');const root=slots.find(r=>r.rejectedAssetIds.includes(s.source.redo_of));if(root&&root.currentAssetId!==s.name)throw Error('Register replacement through tools/install-replacement.mjs.');}
 return slots;
}
export function installSlotCandidate(data,slotId,candidate){
 validatePublicCandidate(candidate);const next=structuredClone(data),slot=(next.redo_slots??[]).find(r=>r.id===slotId);if(!slot||slot.status!=='awaiting-replacement')throw Error('Slot is not awaiting replacement.');
 if(candidate.name!==slot.id+'-v'+slot.nextVersion||next.sets.some(s=>s.name===candidate.name)||(next.redo_slots??[]).some(r=>r.rejectedAssetIds.includes(candidate.name)))throw Error('Use the reserved next version name.');
 if(actionKind(candidate.usage.action)!==actionKind(slot.action)||candidate.usage.character!==slot.character||(candidate.usage.direction??'')!==slot.direction||(candidate.media_kind??'animation')!==slot.mediaKind)throw Error('Replacement target does not match slot.');
 const added=structuredClone(candidate);added.number=slot.number;added.slot_id=slot.id;added.candidate_version=slot.nextVersion;added.source.redo_of=slot.rejectedAssetIds.at(-1);slot.currentAssetId=added.name;slot.status='active';slot.nextVersion++;next.sets.push(added);next.sets.sort((a,b)=>a.number-b.number);retargetPairs(next);validateRedoSlots(next);return next;
}
