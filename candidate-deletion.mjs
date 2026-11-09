const candidateFile=/^(assets\/[a-f0-9]{64}\.(?:png|webp)|videos\/[a-f0-9]{64}\.(?:mp4|webm))$/;
export function candidateResources(set){
 const urls=[...set.frames.map(f=>f.url),...(set.original_video?[set.original_video.url]:[]),...(set.review_video?[set.review_video.url]:[])];
 for(const url of urls)if(!candidateFile.test(url))throw Error('Unsafe candidate resource path.');
 return urls;
}

export function planCandidateDeletion(data,comparisons,ids){
 const wanted=new Set(ids),removed=data.sets.filter(s=>wanted.has(s.name));
 if(removed.length!==wanted.size)throw Error('A deletion does not identify an existing candidate.');
 const next=structuredClone(data);next.sets=next.sets.filter(s=>!wanted.has(s.name));
 // A removed standing reference can still be the historical input of a video.
 // Keep hashes with that video, without retaining the deleted gallery entry/media.
 const masters=new Map(removed.map(s=>[s.name,s]));
 for(const set of next.sets){
  const master=masters.get(set.source.master_asset_id);if(!master)continue;
  const hashes=[master.source.sha256,...(master.source.previous_sha256s??[])].filter(h=>typeof h==='string');
  if(!hashes.includes(set.source.master_sha256))throw Error('Deleted master does not match a retained video input.');
  set.source.master_catalog_status='removed';set.source.master_reference_sha256s=[...new Set(hashes)];
 }
 const retained=new Set(next.sets.flatMap(candidateResources));
 for(const original of comparisons.baselines??[])for(const frame of original.frames)retained.add(frame.url);
 const removeFiles=[...new Set(removed.flatMap(candidateResources))].filter(url=>!retained.has(url)).sort();
 return {data:next,removed,removeFiles};
}
