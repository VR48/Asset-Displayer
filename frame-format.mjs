// Structural header checks; conversion and browser QA independently verify decoded RGBA.
export function inspectLosslessFrameHeader(bytes,extension){
 if(extension==='png'){
  if(bytes.length<26||bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'||bytes[25]!==6)throw Error('Expected RGBA PNG frame.');
  return {width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20),encoding:'rgba-png'};
 }
 if(extension!=='webp'||bytes.length<26||bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WEBP'||bytes.readUInt32LE(4)+8!==bytes.length)throw Error('Invalid lossless WebP frame.');
 let found=null;
 for(let offset=12;offset+8<=bytes.length;){
  const kind=bytes.toString('ascii',offset,offset+4),length=bytes.readUInt32LE(offset+4),start=offset+8;
  if(start+length>bytes.length)throw Error('Truncated WebP chunk.');
  if(['VP8 ','ANIM','ANMF'].includes(kind))throw Error('Lossless still WebP required.');
  if(kind==='VP8L'){
   if(found||length<5||bytes[start]!==0x2f)throw Error('Invalid VP8L frame.');
   const bits=bytes.readUInt32LE(start+1);if(bits>>>29)throw Error('Unsupported VP8L version.');
   found={width:(bits&0x3fff)+1,height:((bits>>>14)&0x3fff)+1,encoding:'webp-lossless'};
  }
  offset=start+length+(length%2);
 }
 if(!found)throw Error('Lossless VP8L payload required.');return found;
}
