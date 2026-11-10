// Optional catalog fields: branch_of is the exact parent asset name; branch_label
// is display text only. Jobs, pairs and labels never establish relationships.
// Filtering retains ancestors as selectable context, not unrelated siblings.
export function groupBranches(sets,matches=()=>true){
 const byName=new Map(sets.map(set=>[set.name,set])),parents=new Map();
 for(const set of sets)if(typeof set.branch_of==='string'&&byName.has(set.branch_of))parents.set(set.name,set.branch_of);
 // Drop every edge within a cycle. Its assets stay reachable, with any valid
 // non-cyclic descendants still attached. Iteration also handles deep chains.
 const visited=new Set();
 for(const set of sets){
  const path=[],indices=new Map();let name=set.name;
  while(name!==undefined&&!visited.has(name)){
   if(indices.has(name)){for(let i=indices.get(name);i<path.length;i++)parents.delete(path[i]);break;}
   indices.set(name,path.length);path.push(name);name=parents.get(name);
  }
  for(const name of path)visited.add(name);
 }
 const visible=new Set();
 for(const set of sets)if(matches(set)){
  let name=set.name;
  while(name!==undefined&&!visible.has(name)){visible.add(name);name=parents.get(name);}
 }
 const nodes=new Map(sets.filter(set=>visible.has(set.name)).map(set=>[set.name,{set,children:[]}])),roots=[];
 for(const set of [...sets].sort((a,b)=>a.number-b.number)){
  const node=nodes.get(set.name);if(!node)continue;
  const parent=nodes.get(parents.get(set.name));
  if(parent)parent.children.push(node);else roots.push(node);
 }
 return roots;
}
