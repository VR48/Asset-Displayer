import test from 'node:test';
import assert from 'node:assert/strict';
import {groupBranches} from './branch-navigation.mjs';

const asset=(name,number,extra={})=>Object.freeze({name,number,...extra});
const shape=nodes=>nodes.map(({set,children})=>[set.name,shape(children)]);

test('only explicit parent names group assets, in candidate order, without duplicates or mutation',()=>{
 const sets=Object.freeze([
  asset('cut',4,{branch_of:'source',branch_label:'Loop'}),
  asset('same-job',2,{source:{job_id:'shared'},pair:'source'}),
  asset('source',3,{source:{job_id:'shared'}}),
  asset('same-label',1,{branch_label:'Loop'}),
  asset('tail',5,{branch_of:'source'})
 ]);
 const groups=groupBranches(sets);
 assert.deepEqual(shape(groups),[['same-label',[]],['same-job',[]],['source',[['cut',[]],['tail',[]]]]]);
 assert.equal(groups[2].set,sets[2]);
 assert.equal(groups[2].children[0].set,sets[0]);
});

test('a matching descendant keeps its entire source path but not unrelated siblings',()=>{
 const sets=[asset('source',1),asset('cut',2,{branch_of:'source'}),asset('tail',3,{branch_of:'cut'}),asset('sibling',4,{branch_of:'source'}),asset('other',5)];
 assert.deepEqual(shape(groupBranches(sets,s=>s.name==='tail')),[['source',[['cut',[['tail',[]]]]]]]);
 assert.deepEqual(shape(groupBranches(sets,s=>s.name==='source')),[['source',[]]]);
 assert.deepEqual(groupBranches(sets,()=>false),[]);
});

test('missing parents stay standalone and do not lose their own descendants',()=>{
 const sets=[asset('orphan',2,{branch_of:'missing'}),asset('cut',1,{branch_of:'orphan'}),asset('unlinked',3,{branch_of:42})];
 assert.deepEqual(shape(groupBranches(sets)),[['orphan',[['cut',[]]]],['unlinked',[]]]);
 assert.deepEqual(shape(groupBranches(sets,s=>s.name==='cut')),[['orphan',[['cut',[]]]]]);
});

test('cycles and self-links remain selectable without swallowing valid descendants',()=>{
 const sets=[asset('a',1,{branch_of:'b'}),asset('b',2,{branch_of:'c'}),asset('c',3,{branch_of:'a'}),asset('cut',4,{branch_of:'b'}),asset('self',5,{branch_of:'self'}),asset('tail',6,{branch_of:'cut'})];
 assert.deepEqual(shape(groupBranches(sets)),[['a',[]],['b',[['cut',[['tail',[]]]]]],['c',[]],['self',[]]]);
 assert.deepEqual(shape(groupBranches(sets,s=>s.name==='tail')),[['b',[['cut',[['tail',[]]]]]]]);
});

test('asset names are literal keys, including object property names',()=>{
 const sets=[asset('__proto__',1),asset('constructor',2,{branch_of:'__proto__'})];
 assert.deepEqual(shape(groupBranches(sets)),[['__proto__',[['constructor',[]]]]]);
});
