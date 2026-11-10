import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewNavigation,initialReviewCandidate} from './review-navigation.mjs';

const owner='01_OWNER_APPROVED',other='03_ALTERNATIVES_AND_DERIVED_CUTS';
const asset=(name,number,branch_of,approval_category=other,character='Jane')=>Object.freeze({name,number,branch_of,approval_category,usage:{character}});
const buttons=nodes=>nodes.flatMap(node=>[...(node.selectable?[node.set.name]:[]),...buttons(node.children)]);
const shape=nodes=>nodes.map(n=>[n.set.name,n.selectable,shape(n.children)]);

test('mixed families retain grouping with source context, never cross-partition asset buttons',()=>{
 const sets=Object.freeze([asset('kept source',1),asset('fix child',2,'kept source'),asset('kept grandchild',3,'fix child'),asset('review source',4),asset('kept child',5,'review source'),asset('redo child',6,'review source')]);
 const decisions=Object.freeze({'kept source':{decision:'keep'},'fix child':{decision:'hold'},'kept grandchild':{decision:'keep'},'kept child':{decision:'keep'},'redo child':{decision:'skip'}});
 const result=reviewNavigation(sets,decisions);
 assert.deepEqual(shape(result.review),[['kept source',false,[['fix child',true,[]]]],['review source',true,[['redo child',true,[]]]]]);
 assert.deepEqual(shape(result.approved),[['kept source',true,[['fix child',false,[['kept grandchild',true,[]]]]]],['review source',false,[['kept child',true,[]]]]]);
 assert.deepEqual(buttons(result.review),['fix child','review source','redo child']);
 assert.deepEqual(buttons(result.approved),['kept source','kept grandchild','kept child']);
 assert.equal(result.reviewCount,3);assert.equal(result.approvedCount,3);
 assert.equal(initialReviewCandidate(sets,decisions),sets[1]);
});

test('current decisions route every review state independently of historical category',()=>{
 const sets=[asset('historically approved',1,undefined,owner),asset('alternative',2)];
 for(const decision of ['undecided','hold','skip','delete','keep']){
  const decisions={'historically approved':{decision},alternative:{decision:'keep'}};
  const result=reviewNavigation(sets,decisions);
  assert.deepEqual(buttons(result.review),decision==='keep'?[]:['historically approved']);
  assert.deepEqual(buttons(result.approved),decision==='keep'?['historically approved','alternative']:['alternative']);
  assert.equal(sets[0].approval_category,owner);assert.equal(sets[1].approval_category,other);
 }
});

test('Owner approved selects kept decisions across categories; other filters and pending slots stay literal',()=>{
 const sets=[asset('old approved',1,undefined,owner),asset('kept Jane',2),asset('kept Seb',3,undefined,other,'Seb'),asset('review Jane',4)];
 const decisions={'kept Jane':{decision:'keep'},'kept Seb':{decision:'keep'}};
 const slots=[{id:'pending Jane',category:other,character:'Jane'},{id:'pending Seb',category:other,character:'Seb'},{id:'filled',category:other,character:'Jane',currentAssetId:'review Jane'},{id:'old approved slot',category:owner,character:'Jane'}];
 const approved=reviewNavigation(sets,decisions,slots,{category:owner});
 assert.deepEqual(buttons(approved.approved),['kept Jane','kept Seb']);assert.deepEqual(approved.review,[]);assert.deepEqual(approved.pending,[]);
 const jane=reviewNavigation(sets,decisions,slots,{character:'Jane',category:other});
 assert.deepEqual(buttons(jane.review),['review Jane']);assert.deepEqual(buttons(jane.approved),['kept Jane']);assert.deepEqual(jane.pending.map(s=>s.id),['pending Jane']);
 assert.equal(jane.reviewCount,1);assert.equal(jane.approvedCount,1);
 const filteredOut=reviewNavigation(sets,decisions,slots,{character:'Nobody'});
 assert.deepEqual([filteredOut.review,filteredOut.approved,filteredOut.pending],[[],[],[]]);
});

test('all-kept and empty catalogs have no review buttons and safe initial selection',()=>{
 const sets=[asset('source',1),asset('child',2,'source')],decisions={source:{decision:'keep'},child:{decision:'keep'}};
 const all=reviewNavigation(sets,decisions);
 assert.deepEqual(all.review,[]);assert.deepEqual(buttons(all.approved),['source','child']);assert.equal(initialReviewCandidate(sets,decisions),sets[0]);
 const empty=reviewNavigation([],{},[{id:'pending',character:'Jane',category:other}]);
 assert.equal(empty.reviewCount,0);assert.equal(empty.approvedCount,0);assert.equal(empty.pending[0].id,'pending');assert.equal(initialReviewCandidate([],{}),undefined);
});

test('missing parents, cycles and literal property names remain reachable in both partitions',()=>{
 const sets=[asset('__proto__',1,'missing'),asset('constructor',2,'__proto__'),asset('a',3,'b'),asset('b',4,'a'),asset('tail',5,'a'),asset('self',6,'self')];
 const decisions=Object.assign(Object.create(null),{['__proto__']:{decision:'keep'},constructor:{decision:'keep'},a:{decision:'keep'},self:{decision:'keep'}});
 const result=reviewNavigation(sets,decisions);
 assert.deepEqual(buttons(result.review).sort(),['b','tail']);assert.deepEqual(buttons(result.approved).sort(),['__proto__','a','constructor','self']);
 assert.equal(result.reviewCount+result.approvedCount,sets.length);
});

// Optional actual-browser coverage without adding a package dependency:
// PLAYWRIGHT_MODULE points at an installed Playwright ES module entry point.
test('browser: partition moves, native disclosure, filters, notes, handoff and empty states',{skip:!process.env.PLAYWRIGHT_MODULE},async()=>{
 const {readFile}=await import('node:fs/promises'),{createServer}=await import('node:http'),path=await import('node:path'),{pathToFileURL}=await import('node:url');
 const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
 const {catalogVersions,sourceIdentity}=await import('./handoff.mjs');
 const {STORAGE_KEY}=await import('./review-state.mjs');
 const catalog=JSON.parse(await readFile('data.json','utf8'));
 const base=catalog.sets[0];
 const names=['<b>kept source</b>','fix child','kept grandchild','review source','kept child','redo child'];
 const sets=names.map((name,i)=>({...base,name,number:i+1,branch_of:[undefined,names[0],names[1],undefined,names[3],names[3]][i],branch_label:undefined,approval_category:i===1?owner:other,replacement:undefined,review_mode:undefined,media_kind:'image',usage:{...base.usage,character:i===4?'Seb':'Jane'}}));
 const versions=await catalogVersions(sets);
 const published={schema:'asset-displayer-review-state-v1',revision:1,decisions:Object.fromEntries([0,2,4].map(i=>[names[i],{decision:'keep',sourceKey:sourceIdentity(sets[i]),assetFingerprint:versions.get(names[i])}]))};
 const pending={id:'pending',number:7,nextVersion:2,character:'Jane',category:other,direction:'right',rejectedAssetIds:[]};
 const server=createServer(async(req,res)=>{
  try{const pathname=new URL(req.url,'http://local').pathname;const file=path.resolve('.'+(pathname==='/'?'/index.html':pathname));assert(!path.relative(process.cwd(),file).startsWith('..'));res.setHeader('Content-Type',/\.m?js$/.test(file)?'text/javascript':file.endsWith('.json')?'application/json':file.endsWith('.css')?'text/css':file.endsWith('.webp')?'image/webp':'text/html');res.end(await readFile(file));}
  catch{res.statusCode=404;res.end();}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let browser;
 try{
  browser=await chromium.launch({channel:'chrome',headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  let fixture={...catalog,sets,redo_slots:[pending]},state=published;
  await page.route('**/data.json',route=>route.fulfill({json:fixture}));
  await page.route('**/review-state.json',route=>route.fulfill({json:state}));
  const url='http://127.0.0.1:'+server.address().port+'/';
  const load=async()=>{await page.goto(url);await page.waitForFunction(()=>document.querySelector('#title').textContent!=='Loading…');};
  const ids=selector=>page.locator(selector+' [data-asset]').evaluateAll(elements=>elements.map(e=>e.dataset.asset));
  const checkIds=async()=>{assert.deepEqual(await ids('#review-list'),[names[1],names[3],names[5]]);assert.deepEqual(await ids('#approved-list'),[names[0],names[2],names[4]]);};
  await load();
  assert.equal(await page.locator('#decision').inputValue(),'undecided');assert.match(await page.locator('#title').innerText(),/fix child/);
  await checkIds();
  assert.equal(await page.locator('#owner-approved').evaluate(e=>e.open),false);
  assert.equal(await page.locator('#approved-list .clip').first().isVisible(),false);
  assert.match(await page.locator('#counts').innerText(),/3 review · 3 approved · 1 pending/);
  assert.equal(await page.locator('#list b').count(),0);
  await page.locator('#approved-summary').click();
  await page.locator('#notes').fill('Independent child notes <b>literal</b>');
  assert.equal(await page.locator('#owner-approved').evaluate(e=>e.open),true);
  await page.locator('#decision').selectOption('keep');
  assert.deepEqual(await ids('#review-list'),[names[3],names[5]]);
  assert.deepEqual(await ids('#approved-list'),[names[0],names[1],names[2],names[4]]);
  assert.match(await page.locator('#title').innerText(),/fix child/);
  await page.locator('#decision').selectOption('hold');await checkIds();
  await page.locator('#approved-summary').click();
  await page.locator('#notes').fill('Independent child notes');
  assert.equal(await page.locator('#owner-approved').evaluate(e=>e.open),false);
  // A collapsed family remains collapsed after notes rerender.
  await page.locator('#review-list .branch-toggle').click();
  await page.locator('#notes').fill('Final child notes');
  assert.equal(await page.locator('#review-list .branch-toggle').getAttribute('aria-expanded'),'false');
  await page.locator('#category').selectOption(owner);
  assert.deepEqual(await ids('#review-list'),[]);assert.deepEqual(await ids('#approved-list'),[names[0],names[2],names[4]]);
  assert.match(await page.locator('#counts').innerText(),/0 review · 3 approved · 0 pending/);
  await page.locator('#character').selectOption('Jane');assert.deepEqual(await ids('#approved-list'),[names[0],names[2]]);
  await page.locator('#category').selectOption(other);
  assert.deepEqual(await ids('#review-list'),[names[3],names[5]]);assert.deepEqual(await ids('#approved-list'),[names[0],names[2]]);
  await page.locator('#category').selectOption('');await page.locator('#character').selectOption('');
  await page.locator('#owner-approved').evaluate(e=>e.open=true);
  await page.locator('#approved-list [data-asset]').first().click();
  assert.equal(await page.locator('#notes').inputValue(),'');
  const downloadEvent=page.waitForEvent('download');await page.locator('#export').click();
  const download=await downloadEvent,stream=await download.createReadStream(),chunks=[];for await(const chunk of stream)chunks.push(chunk);
  const handoff=JSON.parse(Buffer.concat(chunks).toString());
  assert.equal(handoff.assets.length,sets.length);
 for(const set of sets){const exported=handoff.assets.find(a=>a.assetId===set.name);assert.equal(exported.assetFingerprint,versions.get(set.name));assert.equal(exported.packageCategory,set.approval_category);}
  assert.equal(handoff.assets.find(a=>a.assetId===names[1]).requestedChanges,'Final child notes');
  await load();await checkIds();
  assert.equal(await page.locator('#decision').inputValue(),'hold');assert.equal(await page.locator('#notes').inputValue(),'Final child notes');
  const stored=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),STORAGE_KEY);
  stored.overrides[names[0]]={decision:'delete',notes:'Local override',sourceKey:sourceIdentity(sets[0]),assetFingerprint:versions.get(names[0])};
  await page.evaluate(([key,value])=>localStorage.setItem(key,JSON.stringify(value)),[STORAGE_KEY,stored]);
  await load();assert.equal((await ids('#review-list')).includes(names[0]),true);assert.equal((await ids('#approved-list')).includes(names[0]),false);
  await page.evaluate(()=>localStorage.clear());
  state={...published,decisions:Object.fromEntries(sets.map(set=>[set.name,{decision:'keep',sourceKey:sourceIdentity(set),assetFingerprint:versions.get(set.name)}]))};
  await load();assert.deepEqual(await ids('#review-list'),[]);assert.equal((await ids('#approved-list')).length,sets.length);assert.equal(await page.locator('#owner-approved').evaluate(e=>e.open),false);
  fixture={...fixture,sets:[]};state={...published,decisions:{}};await page.evaluate(()=>localStorage.clear());
  await load();assert.equal(await page.locator('#title').innerText(),'Awaiting replacements');assert.equal(await page.locator('#decision').isDisabled(),true);assert.match(await page.locator('#counts').innerText(),/0 review · 0 approved · 1 pending/);
  fixture={...fixture,redo_slots:[]};await load();assert.equal(await page.locator('#title').innerText(),'No candidates');assert.match(await page.locator('#counts').innerText(),/0 review · 0 approved · 0 pending/);
  // Exercise the unmocked local catalog too; browser storage remains ephemeral.
  await page.unroute('**/data.json');await page.unroute('**/review-state.json');
  await page.evaluate(()=>localStorage.clear());await load();
  assert.equal(await page.locator('#review-list [data-decision="keep"]').count(),0);
  assert.equal(await page.locator('#approved-list [data-asset]:not([data-decision="keep"])').count(),0);
  const actualNames=await ids('#list');assert.equal(new Set(actualNames).size,actualNames.length);
  if(await page.locator('#review-list [data-asset]').count())assert.notEqual(await page.locator('#decision').inputValue(),'keep');
  assert.equal(await page.locator('#owner-approved').evaluate(e=>e.open),false);
  await page.locator('#approved-summary').focus();await page.keyboard.press('Space');
  assert.equal(await page.locator('#owner-approved').evaluate(e=>e.open),true);
  await page.keyboard.press('Enter');assert.equal(await page.locator('#owner-approved').evaluate(e=>e.open),false);
  console.info('Local catalog UI: '+await page.locator('#counts').innerText());
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.locator('#approved-summary').isVisible(),true);
  assert.deepEqual(errors,[]);
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
});
