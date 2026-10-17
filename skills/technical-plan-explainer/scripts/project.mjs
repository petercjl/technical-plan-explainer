import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync,spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {hash,writeNew,profile,readJSON,timed,validateProject,fingerprint,asset,fail,run} from './lib.mjs';
const [cmd,...args]=process.argv.slice(2),flag=n=>{const i=args.indexOf(n);return i>=0?args[i+1]:undefined;};
run(async()=>{
 if(cmd==='profile'){const p=await profile(args[0]);console.log(JSON.stringify({ok:true,profile_id:p.profile_id,reference_path:p.reference_path,reference_sha256:p.reference_sha256,synthesis:p.synthesis}));return;}
 if(cmd==='doctor'){
  const checks={node22:Number(process.versions.node.split('.')[0])>=22};
  for(const name of ['hyperframes','seedaudiocli','ffprobe']){const r=spawnSync(name,name==='seedaudiocli'?['version']:name==='ffprobe'?['-version']:['--version'],{encoding:'utf8',timeout:15000,env:{...process.env,SEEDAUDIO_AUTO_UPDATE:'0'}});checks[name]={ok:r.status===0,version:r.status===0?r.stdout.trim().split('\n')[0]:'unavailable'};}
  try{await profile();checks.voice=true;}catch(e){checks.voice={ok:false,code:e.code||'CONFIG_REQUIRED'};}
  console.log(JSON.stringify({ok:Object.values(checks).every(c=>c===true||c.ok),checks}));return;
 }
 if(cmd==='init'){
  const root=path.resolve(args[0]||'');if(!args[0]||!flag('--title'))fail('INVALID_INPUT','init OUTPUT --title TITLE --source FILE');
  try{await fs.lstat(root);fail('OUTPUT_EXISTS','Use a fresh revision directory');}catch(e){if(e.code!=='ENOENT')throw e;}
  const sources=[];for(let i=0;i<args.length;i++)if(args[i]==='--source')sources.push(path.resolve(args[++i]));
  if(!sources.length)fail('INVALID_INPUT','At least one saved source is required');
  const loaded=await Promise.all(sources.map(async f=>({f,b:await fs.readFile(f)})));
  await fs.mkdir(root);for(const dir of ['sources','media','qa','dist'])await fs.mkdir(path.join(root,dir));
  const refs=[];for(const [i,s] of loaded.entries()){const file='sources/'+String(i+1).padStart(2,'0')+path.extname(s.f);await writeNew(path.join(root,file),s.b);refs.push({id:'source-'+(i+1),file,sha256:hash(s.b),coverage:'pending-reading'});}
  await writeNew(path.join(root,'project.json'),{schema_version:1,title:flag('--title'),stage:'sources-staged',sources:refs,nodes:{},voice_profile_id:'cove-reference-v1'});
  console.log(JSON.stringify({ok:true,project:root,sources:refs,next:'Read sources, author fact-map/script/storyboard, create native composition with HyperFrames init, then fill delivery.json per references/contracts.md'}));return;
 }
 if(cmd==='validate'){const x=await validateProject(path.resolve(args[0]));console.log(JSON.stringify({ok:true,duration:x.delivery.duration,scenes:x.story.scenes.length,sentences:x.cues.sentences.length,media:x.delivery.media.length}));return;}
 if(cmd==='check'){
  const root=path.resolve(args[0]),x=await validateProject(root),rel=x.delivery.native_check||'qa/hyperframes-check.json';
  const parent=await asset(root,path.dirname(rel)),out=path.join(parent,path.basename(rel));
  try{await fs.lstat(out);fail('OUTPUT_EXISTS','Choose a new native_check report path in delivery.json');}catch(e){if(e.code!=='ENOENT')throw e;}
  const before=await fingerprint(root,x);
  const report=await new Promise((resolve,reject)=>{
   const proc=spawn('hyperframes',['check',x.composition,'--json','--snapshots'],{stdio:['ignore','pipe','pipe']});let stdout='';let stderr='';
   proc.stdout.on('data',b=>{stdout+=b;});proc.stderr.on('data',b=>{stderr+=b;if(stderr.length>4000)stderr=stderr.slice(-4000);});proc.on('error',reject);
   proc.on('close',code=>{try{const j=JSON.parse(stdout);resolve({...j,command_exit:code});}catch{reject(Object.assign(new Error('Native check did not return JSON; inspect native project diagnostics'),{code:'NATIVE_CHECK_FAILED'}));}});
  });
  report.application_fingerprint=before;
  if(before!==await fingerprint(root,x))fail('INPUT_CHANGED','Composition changed during native check');
  await writeNew(out,report);console.log(JSON.stringify({ok:report.ok===true&&report.command_exit===0,report:out,browserSkipped:report.browserSkipped}));
  if(!report.ok||report.command_exit!==0)process.exitCode=1;return;
 }
 if(cmd==='cache-key'){
  const p=await profile(flag('--profile')),text=await fs.readFile(args[0],'utf8'),prompt=await fs.readFile(flag('--prompt'),'utf8');
  const s=p.synthesis;console.log(JSON.stringify({ok:true,key:hash(JSON.stringify({text,prompt,reference_sha256:p.reference_sha256,model:s.model,mode:s.mode,format:s.format,sample_rate:s.sample_rate,speech_rate:s.speech_rate,pitch_rate:s.pitch_rate}))}));return;
 }
 if(cmd==='cues'){
  const raw=await readJSON(args[0]),offset=Number(flag('--offset')||0),media_id=flag('--id'),duration=Number(flag('--duration')),out=flag('--output');
  if(!media_id||!out||!Number.isFinite(offset)||offset<0||!Number.isFinite(duration)||duration<=0)fail('INVALID_INPUT','cues SUBTITLES --id ID --offset SECONDS --duration AUDIO_SECONDS --output FILE');
  const format=Array.isArray(raw.sentences)?'provider-ms':Array.isArray(raw)?'hyperframes-words':null;
  if(!format)fail('TIMING_FORMAT_UNSUPPORTED','Use provider sentences or normalized HyperFrames word array');
  const word=(w)=>({text:w.text,start:(format==='provider-ms'?w.start_time/1000:w.start)+offset,end:(format==='provider-ms'?w.end_time/1000:w.end)+offset});
  const sentences=format==='provider-ms'?raw.sentences.map(s=>({...word(s),words:(s.words||[]).map(word),media_id})):[];
  if(format==='hyperframes-words'){
   let group=[];for(const w of raw){group.push(word(w));if(/[。！？.!?]$/.test(w.text)||group.length>=22){sentences.push({text:group.map(w=>w.text).join(''),start:group[0].start,end:group.at(-1).end,words:group,media_id});group=[];}}
   if(group.length)sentences.push({text:group.map(w=>w.text).join(''),start:group[0].start,end:group.at(-1).end,words:group,media_id});
  }
  if(!sentences.length||sentences.some(s=>!timed(s,offset+duration)))fail('TIMING_INVALID','Invalid or out-of-range source timings');
  const result={schema_version:1,provenance:[{media_id,format,source_sha256:hash(await fs.readFile(args[0])),offset,audio_duration:duration}],sentences};
  await writeNew(out,result);console.log(JSON.stringify({ok:true,sentences:sentences.length,output:out}));return;
 }
 console.log('Usage: project.mjs doctor | profile [CONFIG] | init OUTPUT --title TITLE --source FILE | validate PROJECT | check PROJECT | cache-key TEXT --prompt PROMPT [--profile CONFIG] | cues SUBTITLES --id ID --offset S --duration S --output FILE');
 if(cmd&&cmd!=='help')process.exitCode=1;
});
