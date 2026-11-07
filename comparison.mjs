export function frameAt(durations,time,repeat=true){
 const total=durations.reduce((a,b)=>a+b,0);
 time=repeat?((time%total)+total)%total:Math.max(0,Math.min(time,total-.000001));
 let end=0;for(let i=0;i<durations.length;i++){end+=durations[i];if(time<end)return i;}return durations.length-1;
}
export function baselineFor(set,catalog){
 if(set.usage?.status!=='replacement'||!set.replacement)return null;
 return catalog.baselines.find(b=>b.id===set.replacement.baselineId&&b.fingerprint===set.replacement.baselineFingerprint)??null;
}
export function comparisonBounds(a,b){
 const box=g=>{const [w,h]=g.canvas??g.derived_canvas,[x,y]=g.anchor??g.native_anchor??g.fixed_native_anchor,s=g.renderScale??g.render_scale??g.fixed_render_scale;return [-x*s,-y*s,(w-x)*s,(h-y)*s];};
 const boxes=[box(a),box(b)];return [Math.min(...boxes.map(b=>b[0])),Math.min(...boxes.map(b=>b[1])),Math.max(...boxes.map(b=>b[2])),Math.max(...boxes.map(b=>b[3]))];
}
