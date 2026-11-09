import {constants} from 'node:fs';import {copyFile,readFile,realpath,open,link,unlink} from 'node:fs/promises';import {createHash,randomUUID} from 'node:crypto';import path from 'node:path';import {within} from './path-safety.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
export async function publishArchivedMedia(source,dest,expected,archiveRoot,beforePublish){
 if(!within(archiveRoot,await realpath(path.dirname(dest))))throw Error('Archive folder escaped.');const temp=dest+'.'+randomUUID()+'.tmp';
 try{await copyFile(source,temp,constants.COPYFILE_EXCL);if(hash(await readFile(temp))!==expected)throw Error('Archive copy hash mismatch.');const h=await open(temp,'r+');try{await h.sync();}finally{await h.close();}if(beforePublish)await beforePublish();try{await link(temp,dest);}catch(e){if(e.code!=='EEXIST')throw e;}const actual=await realpath(dest);if(!within(archiveRoot,actual)||hash(await readFile(actual))!==expected)throw Error('Conflicting archive media.');}
 finally{try{await unlink(temp);}catch(e){if(e.code!=='ENOENT')throw e;}}
}
