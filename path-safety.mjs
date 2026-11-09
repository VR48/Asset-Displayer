import path from 'node:path';
export function within(base,target,api=path){const rel=api.relative(base,target);return !rel.startsWith('..')&&!api.isAbsolute(rel);}
