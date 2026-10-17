import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import {configRoot,hash,readJSON,writeNew,asset,validateProject,fail,run} from './lib.mjs';
run(async()=>{
 const root=path.resolve(process.argv[2]||''),entry=process.argv[3]||'dist/explainer.html',x=await validateProject(root),file=await asset(root,entry);
 const receipt=await readJSON(file+'.receipt.json');if(receipt.sha256!==hash(await fs.readFile(file)))fail('ARTIFACT_CHANGED','HTML differs from bundle receipt');
 let cfg={};try{cfg=await readJSON(process.env.TECH_PLAN_RUNTIME_CONFIG||path.join(configRoot(),'technical-plan-explainer','runtime.json'));}catch(e){if(e.code!=='ENOENT')throw e;}
 const moduleName=process.env.TECH_PLAN_PLAYWRIGHT_MODULE||cfg.playwright_module;
 let moduleFile;if(moduleName)moduleFile=path.resolve(moduleName);else{try{moduleFile=createRequire(path.join(x.composition,'package.json')).resolve('playwright');}catch{fail('CAPABILITY_UNAVAILABLE','Install Playwright in the project or configure its existing module');}}
 let chromium;try{({chromium}=await import(pathToFileURL(moduleFile).href));}catch{fail('CAPABILITY_UNAVAILABLE','Configured Playwright module cannot be loaded');}
 const cdp=process.env.TECH_PLAN_BROWSER_CDP||cfg.browser_cdp;
 if(!cdp)fail('CAPABILITY_UNAVAILABLE','Configure an authorized browser CDP endpoint in runtime.json or TECH_PLAN_BROWSER_CDP');
 const browser=await chromium.connectOverCDP(cdp),page=await browser.contexts()[0].newPage();
 const qa=path.join(root,'qa','browser-'+randomUUID());await fs.mkdir(qa);
 const errors=[],requests=[],assertions=[];
 const assert=(name,ok,detail)=>{assertions.push({name,ok,detail});if(!ok)fail('BROWSER_CHECK_FAILED',name);};
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
 await page.route(/^https?:\/\//,r=>r.abort());
 const seek=async t=>{await page.evaluate(t=>samplePlayer.seek(t),t);await page.waitForTimeout(120);};
 const state=()=>page.evaluate(()=>{const p=samplePlayer,d=p.iframeElement.contentDocument;return{time:p.currentTime,paused:p.paused,audio:[...d.querySelectorAll('audio'),...p.shadowRoot.querySelectorAll('audio')].map(a=>({time:a.currentTime,paused:a.paused,rate:a.playbackRate,error:a.error?.code||null}))};});
 try{
  await page.setViewportSize({width:1280,height:1000});await page.goto(pathToFileURL(file).href);
  await page.waitForFunction(()=>window.samplePlayer?.ready&&window.samplePlayer?.assetsReady,{timeout:30000});
  assert('native duration',Math.abs(await page.evaluate(()=>samplePlayer.duration)-x.delivery.duration)<.05);
  const proof=[...new Set(x.story.scenes.flatMap(s=>s.proof_times))];
  for(const [i,t] of proof.entries()){await seek(t);await page.locator('hyperframes-player').screenshot({path:path.join(qa,'proof-'+i+'-'+t.toFixed(2)+'.png')});}
  const t=x.delivery.chapters[Math.min(1,x.delivery.chapters.length-1)].start+.4;
  await seek(t);const first=await page.locator('hyperframes-player').screenshot();await seek(x.delivery.duration-.1);await seek(0);await seek(t);const second=await page.locator('hyperframes-player').screenshot();
  assert('backward seek identical pixels',hash(first)===hash(second));
  const media=x.delivery.media[0];await seek(media.start+Math.min(1,media.duration/6));await page.evaluate(()=>{samplePlayer.muted=true;});const before=await state();
  await page.locator('#toggle').click();await page.waitForTimeout(1100);const playing=await state();
  assert('media actually plays',playing.time-before.time>.7&&playing.audio.some(a=>!a.paused&&!a.error&&a.time>0),playing);
  await page.locator('#toggle').click();const paused=await state();await page.waitForTimeout(250);const still=await state();assert('pause shared media clock',Math.abs(paused.time-still.time)<.06&&still.audio.every(a=>a.paused));
  await page.selectOption('#speed','1.5');await page.locator('#toggle').click();const fast0=await state();await page.waitForTimeout(1000);const fast=await state();assert('speed shared media clock',fast.time-fast0.time>1.2&&fast.time-fast0.time<1.85&&fast.audio.some(a=>a.rate===1.5));
  await page.locator('#toggle').click();await seek(x.delivery.duration);await page.locator('#replay').click();await page.waitForTimeout(250);const replay=await state();assert('replay from end',!replay.paused&&replay.time<1);
  await page.locator('#toggle').click();await page.locator('[data-chapter="0"]').click();assert('chapter pauses',await page.evaluate(()=>samplePlayer.paused&&samplePlayer.currentTime===0));
  await page.locator('#read').click();assert('static transcript',await page.locator('#script').evaluate(e=>e.open));await page.locator('#show-source').click();assert('source panel',await page.locator('#sources').evaluate(e=>e.open));
  await page.evaluate(()=>{document.getElementById('script').open=false;document.getElementById('sources').open=false;window.scrollTo(0,0);});await page.setViewportSize({width:390,height:900});
  assert('mobile no horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(qa,'mobile.png'),fullPage:true});
  await page.setViewportSize({width:1280,height:1000});await seek(.5);await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:path.join(qa,'desktop.png'),fullPage:true});
  assert('offline no external requests',requests.length===0,requests);assert('no script errors',errors.length===0,errors);
 }finally{
  const report={ok:assertions.length>=12&&assertions.every(a=>a.ok),browser:browser.version(),artifact:entry,artifact_sha256:hash(await fs.readFile(file)),assertions,errors,external_requests:requests,screenshot_directory:path.relative(root,qa)};
  await writeNew(path.join(qa,'report.json'),report);await page.close();
  console.log(JSON.stringify({ok:report.ok,report:path.join(qa,'report.json'),assertions:assertions.length}));
 }
}).finally(()=>process.exit(process.exitCode||0));
