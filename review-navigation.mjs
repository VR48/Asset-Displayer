import {groupBranches} from './branch-navigation.mjs?v=1.28.0';

const ownerApproved='01_OWNER_APPROVED';
const characterOf=set=>set.usage?.character??'Other';

// Decisions are the resolved session, including local overrides. Category metadata
// remains provenance; only the Owner approved filter uses current Keep decisions.
export function reviewNavigation(sets,decisions,redoSlots=[],{character='',category=''}={}){
 const review=new Set(),approved=new Set();
 for(const set of sets){
  const kept=decisions[set.name]?.decision==='keep';
  if(character&&characterOf(set)!==character)continue;
  if(category&&(category===ownerApproved?!kept:set.approval_category!==category))continue;
  (kept?approved:review).add(set.name);
 }
 const groups=names=>{
  const mark=node=>({...node,selectable:names.has(node.set.name),children:node.children.map(mark)});
  return groupBranches(sets,set=>names.has(set.name)).map(mark);
 };
 const pending=redoSlots.filter(slot=>!slot.currentAssetId&&(!character||slot.character===character)&&(!category||(category!==ownerApproved&&slot.category===category)));
 return {review:groups(review),approved:groups(approved),pending,reviewCount:review.size,approvedCount:approved.size};
}

export function initialReviewCandidate(sets,decisions){
 return sets.find(set=>decisions[set.name]?.decision!=='keep')??sets[0];
}
