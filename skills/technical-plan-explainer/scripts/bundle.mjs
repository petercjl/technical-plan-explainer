import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {hash,writeNew,readJSON,asset,validateProject,fingerprint,fail,run} from './lib.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
run(async()=>{
 const root=path.resolve(process.argv[2]||''),out=process.argv[3]||'dist/explainer.html';
 const x=await validateProject(root),d=x.delivery;
 const check=await readJSON(await asset(root,d.native_check||'qa/hyperframes-check.json'));
 if(check.ok!==true||check.browserSkipped!==false||!check.layout?.samples?.length)fail('NATIVE_CHECK_REQUIRED','Save an actual passing native HyperFrames check first');
 if(check.application_fingerprint!==await fingerprint(root,x))fail('NATIVE_CHECK_STALE','Run project.mjs check on the current input revision');
 if(path.isAbsolute(out))fail('INVALID_PATH','Output must be project-relative');
 const parent=await asset(root,path.dirname(out)),target=path.join(parent,path.basename(out));
 try{await fs.lstat(target);fail('OUTPUT_EXISTS','Choose a new HTML revision');}catch(e){if(e.code!=='ENOENT')throw e;}
 const req=createRequire(path.join(x.composition,'package.json'));
 const coreManifest=req.resolve('@hyperframes/core/package.json'),corePkg=await readJSON(coreManifest);
 const choose=entry=>typeof entry==='string'?entry:entry&&(choose(entry.node)||choose(entry.import)||choose(entry.default));
 const compilerEntry=choose(corePkg.exports?.['./compiler']);
 if(!compilerEntry)fail('FEATURE_UNSUPPORTED','Installed core does not expose its ESM compiler contract');
 const {bundleToSingleHtml,parseHTMLContent}=await import(pathToFileURL(path.resolve(path.dirname(coreManifest),compilerEntry)).href);
 let html=await bundleToSingleHtml(x.composition,{runtime:'inline',inlineAssets:true});
 const parsed=parseHTMLContent(html),doc=parsed.document||parsed;
 const native=doc.querySelector('[data-composition-id]');
 if(!native||Math.abs(Number(native.dataset.duration)-d.duration)>.02)fail('DURATION_MISMATCH','Static composition duration must match delivery');
 for(const m of d.media){
  const a=doc.getElementById(m.id);
  if(!a||a.tagName.toLowerCase()!=='audio'||Math.abs(Number(a.dataset.start)-m.start)>.02||Math.abs(Number(a.dataset.duration)-m.duration)>.02)fail('AUDIO_CONTRACT_FAILED','Media ID, start and duration must match native composition');
  const src=a.getAttribute('src')||'',data=src.match(/^data:[^;]+;base64,(.+)$/s);
  const actual=data?Buffer.from(data[1],'base64'):await fs.readFile(await asset(x.composition,decodeURIComponent(src)));
  if(hash(actual)!==hash(await fs.readFile(await asset(root,m.path))))fail('AUDIO_CONTRACT_FAILED','Native audio bytes differ from the declared generated segment');
 }
 for(const node of doc.querySelectorAll('audio[src],video[src]')){
  const src=node.getAttribute('src');if(src.startsWith('data:'))continue;
  if(/^\w+:/.test(src))fail('EXTERNAL_ASSET','Stage media locally before bundling');
  const f=await asset(x.composition,decodeURIComponent(src)),bytes=await fs.readFile(f),ext=path.extname(f).toLowerCase();
  const mime={'.mp3':'audio/mpeg','.wav':'audio/wav','.ogg':'audio/ogg','.mp4':'video/mp4','.webm':'video/webm'}[ext];
  if(!mime)fail('UNSUPPORTED_MEDIA','Unsupported embedded media extension');node.setAttribute('src','data:'+mime+';base64,'+bytes.toString('base64'));
 }
 for(const n of doc.querySelectorAll('[src],link[href],[poster],image[href],use[href]')){
  for(const k of ['src','href','poster']){const v=n.getAttribute(k);if(v&&!v.startsWith('data:')&&!v.startsWith('#'))fail('EXTERNAL_ASSET','Unresolved embedded resource');}
 }
 for(const style of doc.querySelectorAll('style')){
  if(/@import\s/i.test(style.textContent))fail('EXTERNAL_ASSET','Unresolved CSS import');
  for(const m of style.textContent.matchAll(/url\(\s*["']?([^)'"\s]+)/g))if(!m[1].startsWith('data:')&&!m[1].startsWith('#'))fail('EXTERNAL_ASSET','Unresolved CSS resource');
 }
 html=doc.toString();
 const playerEntry=req.resolve('@hyperframes/player'),playerDir=path.dirname(playerEntry);
 const player=await fs.readFile(path.join(playerDir,'hyperframes-player.global.js'),'utf8');
 const gsapSource=await fs.readFile(req.resolve('gsap'),'utf8');
 const gsapNotice=gsapSource.slice(0,4096).match(/\/\*![\s\S]*?\*\//)?.[0];
 if(!gsapNotice)fail('LICENSE_NOTICE_REQUIRED','Preserve the installed GSAP copyright and license notice');
 const license=(await fs.readFile(path.join(path.dirname(coreManifest),'LICENSE'),'utf8'))+'\n\nGSAP distribution notice\n'+gsapNotice;
 const template=await fs.readFile(path.join(here,'../assets/player-shell.html'),'utf8');
 const data={title:d.title,description:d.description,duration:d.duration,width:Number(native.dataset.width),height:Number(native.dataset.height),composition:html,cues:x.cues.sentences,chapters:d.chapters,script:x.script,sources:x.sources.references,glossary:d.glossary||[],license,credits:'HyperFrames '+corePkg.version+' — Apache License 2.0；GSAP 保留内嵌发行文件的原始许可头。'};
 const result=template.replace('@@PLAYER@@',()=>player.replaceAll('</script','<\\/script')).replace('@@DATA@@',()=>JSON.stringify(data).replaceAll('<','\\u003c'));
 await writeNew(target,result);
 await writeNew(target+'.receipt.json',{ok:true,html:path.relative(root,target),sha256:hash(result),bytes:Buffer.byteLength(result),duration:d.duration,engine:'HyperFrames',version:corePkg.version,native_check:d.native_check||'qa/hyperframes-check.json',input_sha256:{delivery:hash(await fs.readFile(path.join(root,'delivery.json'))),script:hash(x.script)},browser_verification:'pending'});
 console.log(JSON.stringify({ok:true,html:target,bytes:Buffer.byteLength(result),duration:d.duration}));
});
