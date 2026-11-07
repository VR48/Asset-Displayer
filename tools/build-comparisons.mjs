// Read the existing game banks; export only the explicitly mapped review slots.
// Usage: node tools/build-comparisons.mjs /absolute/path/to/lanternwake
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {deflateSync} from 'node:zlib';
import {execFileSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'..'),game=path.resolve(process.argv[2]??'../lanternwake');
const {validateRookAnimation}=await import(pathToFileURL(path.join(game,'dist/rook-animation.mjs')));
const {applyHeroTuning}=await import(pathToFileURL(path.join(game,'dist/hero-tuning.mjs')));
const digest=b=>createHash('sha256').update(b).digest('hex');
const sourceCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:game,encoding:'utf8'}).trim();
const vendor=path.join(game,'dist/vendor/basis-universal');
const factory=vm.runInNewContext(await readFile(path.join(vendor,'basis_transcoder.js'),'utf8')+';BASIS',{console,process,require:createRequire(import.meta.url),__dirname:vendor,TextDecoder,TextEncoder,performance,setTimeout,clearTimeout});
const basis=await factory({wasmBinary:new Uint8Array(await readFile(path.join(vendor,'basis_transcoder.wasm')))});basis.initializeBasis();
function crc32(bytes){let crc=0xffffffff;for(const b of bytes){crc^=b;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return(crc^0xffffffff)>>>0;}
function chunk(type,bytes){const tag=Buffer.from(type),out=Buffer.alloc(bytes.length+12);out.writeUInt32BE(bytes.length);tag.copy(out,4);bytes.copy(out,8);out.writeUInt32BE(crc32(Buffer.concat([tag,bytes])),out.length-4);return out;}
function png(w,h,rgba){const header=Buffer.alloc(13);header.writeUInt32BE(w);header.writeUInt32BE(h,4);header[8]=8;header[9]=6;const rows=Buffer.alloc((w*4+1)*h);for(let y=0;y<h;y++)rgba.copy(rows,y*(w*4+1)+1,y*w*4,(y+1)*w*4);return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]);}
// Explicit semantic mapping, not inferred from filenames at runtime. Attack phase
// replacements preserve the distinction between raising, firing and lowering.
const targets={1:['rook','sprint:right','cycle'],2:['kest','attack:right','action'],10:['mica','attack:up','windup'],11:['mica','attack:up','recovery'],12:['mica','attack:up','active'],13:['mica','walk:down','cycle'],30:['vale','walk:right','cycle'],32:['rook','walk:up','cycle'],33:['rook','walk:down','cycle']};
const labels={1:['Rook','Sprint','Right',false],2:['Kest','Fire / raise / lower','Right',true],3:['Chaser','Recover','Source bearing',false],4:['Chaser','Stun','Source bearing',false],5:['Heavy','Gesture','Source bearing',false],6:['Heavy','Stun / KO','Source bearing',false],7:['Mica','Crouch / rise','Up-right',false],8:['Mica','Crouch lower','Up-right',false],9:['Mica','Crouch rise','Up-right',false],10:['Mica','Raise weapon','Up-right',false],11:['Mica','Lower weapon','Up-right',false],12:['Mica','Fire','Up-right',true],13:['Mica','Walk','Down-right',false],14:['Runner','Recover','Source bearing',false],15:['Runner','Stun','Source bearing',false],16:['Chaser','Bite attack','Source bearing',true],17:['Chaser','Idle','Source bearing',false],18:['Chaser','Attack','Source bearing',true],19:['Heavy','Idle','Source bearing',false],20:['Heavy','Walk','Source bearing',false],21:['Heavy','Walk','Source bearing',false],22:['Mica','Sneak','Down-right',false],23:['Mica','Sneak','Up-right',false],24:['Mica','Sneak','Up-right',false],25:['Rook','Sneak / step / stop','Rear / up',false],26:['Rook','Sneak / look around','Left',false],27:['Rook','Sneak','Left',false],28:['Rook','Sneak (reversed)','Up-right',false],29:['Runner','Idle','Source bearing',false],30:['Vale','Walk','Right',false],31:['Vale','Walk stop','Right',false],32:['Rook','Walk','Up',false],33:['Rook','Walk','Down',false],34:['Seb','Walk','Front / down',false]};
const data=JSON.parse(await readFile(path.join(root,'data.json'),'utf8')),baselines=[];
await mkdir(path.join(root,'baselines'),{recursive:true});
for(const set of data.sets){
 if(!labels[set.number]){if(!set.usage||set.replacement)throw Error('Unmapped candidate '+set.name);continue;}
 const [character,action,direction,attacking]=labels[set.number];
 set.usage={character,action,direction,attacking,status:targets[set.number]?'replacement':'new-feature'};
 delete set.replacement;
 if(!targets[set.number]){
  set.usage.reason=['Chaser','Runner','Heavy'].includes(character)?'Current Web and Godot enemies use static character art; this animation needs a new playback hook.':character==='Seb'?'Seb has no existing playable character animation bank in this baseline.':set.number===31?'No separate walk-to-stop transition slot exists.':action.startsWith('Crouch')?'No Mica crouch transition slot exists.':'No sneak action slot exists; this is not a walk or sprint replacement.';
  continue;
 }
 const [hero,slot,phase]=targets[set.number],id=`${hero}-${slot.replace(':','-')}-${phase}`;
 const sourceManifest=`dist/assets/heroes/${hero}-animation.json`,source=await readFile(path.join(game,sourceManifest));
 const bank=applyHeroTuning(validateRookAnimation(JSON.parse(source))),clip=bank.clips[slot];
 if(!clip)throw Error('Missing target '+id);
 const phases=phase==='action'?['windup','active','recovery']:[phase];
 const sequence=phases.flatMap(p=>{
  const indices=p==='cycle'?clip.frameIndices:clip[p+'Frames'];
  const seconds=p==='cycle'?clip.nominalCycleSeconds/(clip.cadenceScale??1):p==='active'?bank.attackCycleSeconds:clip[p+'Seconds'];
  return indices.map(i=>({index:i,duration:1000*seconds/indices.length,phase:p}));
 });
 const frames=new Map(),pages=[];
 for(const pageIndex of new Set(sequence.map(f=>clip.frames[f.index].page))){
  const page=clip.pages[pageIndex],relative=`dist/assets/heroes/${page.sheet}`,input=await readFile(path.join(game,relative));
  pages.push({path:relative,sha256:digest(input)});
  let file;
  try{
   file=new basis.KTX2File(new Uint8Array(input));if(!file.isValid()||!file.startTranscoding())throw Error('Invalid KTX2 '+relative);
   const format=basis.transcoder_texture_format.cTFRGBA32.value,w=file.getWidth();
   const pixels=new Uint8Array(file.getImageTranscodedSizeInBytes(0,0,0,format));
   if(!file.transcodeImage(pixels,0,0,0,format,0,-1,-1))throw Error('Transcode failed');
   const rgba=Buffer.from(pixels.buffer,pixels.byteOffset,pixels.byteLength);
   for(const index of new Set(sequence.map(f=>f.index).filter(i=>clip.frames[i].page===pageIndex))){
    const f=clip.frames[index],cw=clip.frameWidth,ch=clip.frameHeight,crop=Buffer.alloc(cw*ch*4);
    for(let y=0;y<ch;y++)rgba.copy(crop,y*cw*4,((f.y+y)*w+f.x)*4,((f.y+y)*w+f.x+cw)*4);
    const bytes=png(cw,ch,crop),sha256=digest(bytes),url=`baselines/${sha256}.png`;
    await writeFile(path.join(root,url),bytes);frames.set(index,{url,sha256,source_frame:f.sourceFrame});
   }
  }finally{file?.close();file?.delete();}
 }
 const baseline={id,character,slot,phase,direction,attacking:slot.startsWith('attack'),sourceManifest,sourceManifestSha256:digest(source),sourceCommit,pages,
  geometry:{canvas:[clip.frameWidth,clip.frameHeight],anchor:[clip.anchor.x,clip.anchor.y],renderScale:clip.renderScale},
  timing:phase==='cycle'?'Nominal gameplay gait cadence; actual speed changes with movement.':'Authored attack phases; one active firing cycle. Holding fire repeats the active phase.',
  frames:sequence.map(f=>({...frames.get(f.index),phase:f.phase})),durations:sequence.map(f=>f.duration),duration_verified_ms:sequence.reduce((sum,f)=>sum+f.duration,0)};
 baseline.fingerprint=digest(JSON.stringify(baseline));baselines.push(baseline);
 set.replacement={baselineId:id,slot:`${hero}/${slot}`,phase,baselineFingerprint:baseline.fingerprint,baselineSourceCommit:sourceCommit};
 console.log(id,sequence.length+' frames');
}
await writeFile(path.join(root,'comparisons.json'),JSON.stringify({schema:'asset-displayer-comparisons-v1',sourceCommit,bank:'Original runtime bank (ASUS checkout snapshot)',conversion:'Pinned official Basis decoder to RGBA32, native clip rectangle; no scaling or retiming beyond authored playback rules.',baselines},null,2)+'\n');
await writeFile(path.join(root,'data.json'),JSON.stringify(data)+'\n');

