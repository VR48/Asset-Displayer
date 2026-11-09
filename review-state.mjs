import {sanitizeDecisions} from './handoff.mjs?v=1.24.0';

export const STORAGE_KEY='asset-displayer-lanternwake-review-v2';
export const LEGACY_STORAGE_KEY='asset-displayer-lanternwake-review-v1';
const states=new Set(['undecided','keep','hold','skip']);
export const emptyReviewState=()=>({schema:'asset-displayer-review-state-v1',revision:0,decisions:{}});

export function validateReviewState(value){
 if(!value||Object.keys(value).some(k=>!['schema','revision','decisions'].includes(k))||value.schema!=='asset-displayer-review-state-v1'||!Number.isSafeInteger(value.revision)||value.revision<0||!value.decisions||typeof value.decisions!=='object'||Array.isArray(value.decisions)||Object.keys(value.decisions).length>1000)throw Error('Invalid published review state.');
 for(const entry of Object.values(value.decisions)){
  if(!entry||Object.keys(entry).some(k=>!['decision','sourceKey','assetFingerprint'].includes(k))||!states.has(entry.decision)||typeof entry.sourceKey!=='string'||entry.sourceKey.length>200||!/^[a-f0-9]{64}$/.test(entry.assetFingerprint))throw Error('Invalid published asset status.');
 }
 return value;
}

export function loadReviewSession(published,stored,legacy,sets,versions){
 validateReviewState(published);
 const publicEntries=Object.fromEntries(Object.entries(published.decisions).map(([id,e])=>[id,{...e,notes:''}]));
 const base=sanitizeDecisions(publicEntries,sets,versions);
 const current=stored?.schema==='asset-displayer-review-session-v2'&&Number.isSafeInteger(stored.baselineRevision);
 const old=sanitizeDecisions(current?stored.overrides:legacy,sets,versions);
 let overrides=old;
 if(!current||stored.baselineRevision!==published.revision){
  overrides=Object.create(null);
  for(const [id,entry] of Object.entries(old)){
   if(!Object.hasOwn(base,id))overrides[id]=entry;
   else if(entry.notes)overrides[id]={...base[id],notes:entry.notes};
  }
 }
 return {decisions:Object.assign(Object.create(null),base,overrides),session:{schema:'asset-displayer-review-session-v2',baselineRevision:published.revision,editRevision:current&&Number.isSafeInteger(stored.editRevision)?stored.editRevision:0,overrides}};
}
