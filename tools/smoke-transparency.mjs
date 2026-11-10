// Ephemeral loopback server; never connects to or changes the game service.
import {createServer} from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import {catalogVersions,importHandoff} from '../handoff.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),work=process.argv[2];
if(!work)throw Error('Usage: node tools/smoke-transparency.mjs PRIVATE_WORK_DIRECTORY');
const {chromium}=createRequire(path.join(root,'../lanternwake/package.json'))('playwright');
const data=JSON.parse(await readFile(path.join(root,'data.json'))),state=JSON.parse(await readFile(path.join(root,'review-state.json'))),before=JSON.parse(await readFile(path.join(work,'before-review-state.json')));
const selected=data.sets.filter(s=>state.decisions[s.name]?.decision==='keep'&&s.media_kind!=='image');
const server=createServer(async(req,res)=>{try{let url=new URL(req.url,'http://localhost').pathname;if(url==='/')url='/index.html';const file=path.resolve(root,'.'+decodeURIComponent(url));if(path.relative(root,file).startsWith('..'))throw Error('Outside root');res.setHeader('Content-Type',file.endsWith('.mjs')||file.endsWith('.js')?'text/javascript':file.endsWith('.json')?'application/json':file.endsWith('.css')?'text/css':file.endsWith('.webp')?'image/webp':file.endsWith('.png')?'image/png':'text/html');res.end(await readFile(file));}catch{res.statusCode=404;res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const context=await browser.newContext({viewport:{width:1600,height:1100}}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const note='Private old-fingerprint transparency smoke note';
 const migration=selected.find(s=>s.transparency),old=before.decisions[migration.name];
 assert.notEqual(old.assetFingerprint,state.decisions[migration.name].assetFingerprint);
 await page.addInitScript(({id,old,note,revision})=>localStorage.setItem('asset-displayer-lanternwake-review-v2',JSON.stringify({schema:'asset-displayer-review-session-v2',baselineRevision:revision,editRevision:7,overrides:{[id]:{...old,decision:'skip',notes:note}}})),{id:migration.name,old,note,revision:before.revision});
 await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>document.querySelector('#counts')?.textContent.includes('approved'));
 assert.equal(await page.locator('#owner-approved').getAttribute('open'),null);
 const session=await page.evaluate(()=>JSON.parse(localStorage.getItem('asset-displayer-lanternwake-review-v2')));
 assert.equal(session.overrides[migration.name].decision,'keep');assert.equal(session.overrides[migration.name].notes,note);assert.equal(session.baselineRevision,state.revision);
 await page.locator('#approved-summary').click();
 const results=[];
 for(const candidate of selected){
  const button=page.locator('button.clip').filter({hasText:candidate.name}).first();
  // Approved source submenus remain independently collapsed.
  await page.evaluate(name=>{const button=[...document.querySelectorAll('button.clip')].find(b=>b.dataset.asset===name);for(let p=button.parentElement;p;p=p.parentElement)if(p.classList.contains('branch-items'))p.hidden=false;},candidate.name);
  await button.click();
  assert.equal(await page.locator('#decision').inputValue(),'keep');
  assert.equal(await page.locator('#native-player').isHidden(),true);
  for(const index of new Set([0,Math.floor(candidate.frames.length/2),candidate.frames.length-1])){
   const source=candidate.frames[index];
   await page.locator('#scrub').evaluate((el,value)=>{el.value=String(value);el.dispatchEvent(new Event('input',{bubbles:true}));},index);
   // Compare the actual UI canvas to the decoded preview. Anchor overlays are
   // disabled for this pixel check; the native canvas must not be reframed.
   if(await page.locator('#pivot').isChecked())await page.locator('#pivot').uncheck();
   await page.evaluate(async url=>{const image=new Image();image.src=url;await image.decode();const reference=document.createElement('canvas');reference.width=image.width;reference.height=image.height;const rc=reference.getContext('2d');rc.drawImage(image,0,0);window.transparencyReference=rc.getImageData(0,0,image.width,image.height).data;},source.url);
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   const proof=await page.evaluate(()=>{const canvas=document.querySelector('#canvas'),expected=window.transparencyReference,actual=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;let transparent=0,different=0,alphaDifferent=0,opaqueDifferent=0,maxCompositedDelta=0;for(let i=0;i<actual.length;i++){if(actual[i]!==expected[i])different++;const alphaIndex=(i&~3)+3;if(i%4===3){if(actual[i]===0)transparent++;if(actual[i]!==expected[i])alphaDifferent++;}else{if(actual[alphaIndex]===255&&actual[i]!==expected[i])opaqueDifferent++;maxCompositedDelta=Math.max(maxCompositedDelta,Math.abs(actual[i]*actual[alphaIndex]-expected[i]*expected[alphaIndex])/255);}}return {different,alphaDifferent,opaqueDifferent,maxCompositedDelta,transparent,width:canvas.width,height:canvas.height,bytes:actual.length,expectedBytes:expected.length};});
   // Chrome's GPU and readback-backed canvases can round translucent RGB
   // differently. Alpha and opaque pixels must be exact; composited edge error
   // may not exceed one 8-bit unit. Encoded RGBA is checked exactly by Python.
   assert.equal(proof.alphaDifferent,0,candidate.name+' '+index+' alpha');
   assert.equal(proof.opaqueDifferent,0,candidate.name+' '+index+' opaque');
   assert(proof.maxCompositedDelta<=1,candidate.name+' '+index+' '+JSON.stringify(proof));assert.equal(proof.bytes,proof.expectedBytes);
   assert.deepEqual([proof.width,proof.height],candidate.actual_dimensions[0]);assert(proof.transparent>0);
   results.push({asset:candidate.name,index,...proof});
  }
  for(const value of ['light','dark','checker']){await page.locator('#background').selectOption(value);await page.screenshot({path:path.join(work,candidate.name+'.browser-'+value+'.png')});}
 }
 await page.locator('#scrub').evaluate(el=>{el.value='0';el.dispatchEvent(new Event('input',{bubbles:true}));});
 await page.locator('#play').click();await page.waitForFunction(()=>Number(document.querySelector('#scrub').value)>0);
 await page.locator('#play').click();assert.equal(await page.locator('#play').textContent(),'Play');
 const download=page.waitForEvent('download');await page.locator('#export').click();
 const handoffPath=path.join(work,'fresh-preview-handoff.private.json');await(await download).saveAs(handoffPath);
 const handoff=JSON.parse(await readFile(handoffPath)),versions=await catalogVersions(data.sets);
 assert.equal(handoff.assets.length,data.sets.length);assert.equal(handoff.summary.keep,Object.values(state.decisions).filter(e=>e.decision==='keep').length);
 for(const entry of handoff.assets)assert.equal(entry.assetFingerprint,versions.get(entry.assetId));
 assert.equal(importHandoff(handoff,data.sets,versions).decisions[migration.name].notes,note);
 assert.deepEqual(errors,[]);
 const report={animations:selected.length,sampledFrames:results.length,oldFingerprintNotesPreserved:true,ownerApprovedInitiallyCollapsed:true,playbackAdvanced:true,handoffAssets:handoff.assets.length,handoffKeep:handoff.summary.keep,freshPreviewFingerprintsVerified:true,errors,frames:results};
 await writeFile(path.join(work,'browser-verification.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
