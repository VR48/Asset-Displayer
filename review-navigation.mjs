import {groupBranches} from './branch-navigation.mjs?v=1.30.0';

const ownerApproved='01_OWNER_APPROVED';
const characterOf=set=>set.usage?.character??'Other';

// Keep votes touched in this release remain visible for orientation. A new
// release clears only this presentation ledger, never decisions or private notes.
export function restoreReviewIteration(saved,version,sets){
 const names=new Set(sets.map(s=>s.name));
 return {version,touched:saved?.version===version&&Array.isArray(saved.touched)?[...new Set(saved.touched.filter(id=>typeof id==='string'&&names.has(id)))]:[]};
}
export function reviewNavigation(sets,decisions,redoSlots=[],{character='',category='',lingeringKeeps=new Set()}={}){
 const review=new Set(),approved=new Set();
 for(const set of sets){
  const kept=decisions[set.name]?.decision==='keep';
  if(character&&characterOf(set)!==character)continue;
  if(category&&(category===ownerApproved?!kept:set.approval_category!==category))continue;
  (kept&&!lingeringKeeps.has(set.name)?approved:review).add(set.name);
 }
 const groups=names=>{
  const mark=node=>({...node,selectable:names.has(node.set.name),children:node.children.map(mark)});
  return groupBranches(sets,set=>names.has(set.name)).map(mark);
 };
 const pending=redoSlots.filter(slot=>!slot.currentAssetId&&(!character||slot.character===character)&&(!category||(category!==ownerApproved&&slot.category===category)));
 return {review:groups(review),approved:groups(approved),pending,reviewCount:review.size,approvedCount:approved.size};
}

export function initialReviewCandidate(sets,decisions,lingeringKeeps=new Set()){
 return sets.find(set=>decisions[set.name]?.decision!=='keep'||lingeringKeeps.has(set.name))??sets[0];
}
