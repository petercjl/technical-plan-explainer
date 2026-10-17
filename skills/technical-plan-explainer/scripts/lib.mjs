import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
export const hash=b=>createHash('sha256').update(b).digest('hex');
export function fail(code,message){throw Object.assign(new Error(message),{code});}
export const readJSON=async f=>JSON.parse(await fs.readFile(f,'utf8'));
export async function writeNew(f,body){
 try{await fs.lstat(f);fail('OUTPUT_EXISTS','Choose a new revision: '+f);}catch(e){if(e.code!=='ENOENT')throw e;}
 await fs.writeFile(f,typeof body==='string'||Buffer.isBuffer(body)?body:JSON.stringify(body,null,2)+'\n',{flag:'wx'});
}
export async function asset(root,rel){
 if(typeof rel!=='string'||!rel||path.isAbsolute(rel))fail('INVALID_PATH','Use a project-relative asset path');
 const base=await fs.realpath(root),file=await fs.realpath(path.resolve(root,rel));
 const delta=path.relative(base,file);
 if(delta==='..'||delta.startsWith('..'+path.sep)||path.isAbsolute(delta))fail('INVALID_PATH','Asset escapes project');
 return file;
}
export const configRoot=()=>process.env.XDG_CONFIG_HOME||path.join(os.homedir(),'.config');
export async function profile(file=process.env.TECH_PLAN_VOICE_PROFILE||path.join(configRoot(),'technical-plan-explainer','voice-profile.json')){
 let p;try{p=await readJSON(file);}catch(e){if(e.code==='ENOENT')fail('CONFIG_REQUIRED','Provide an accepted Cove voice profile');throw e;}
 if(typeof p.reference_file!=='string'||!p.reference_file)fail('VOICE_PROFILE_INVALID','Original voice reference is required');
 const ref=path.resolve(path.dirname(file),p.reference_file);
 if(p.profile_id!=='cove-reference-v1'||p.reference_status!=='locked'||p.synthesis_acceptance!=='accepted-by-user')fail('VOICE_PROFILE_INVALID','An accepted, locked Cove profile is required');
 let bytes;try{bytes=await fs.readFile(ref);}catch(e){if(e.code==='ENOENT')fail('CONFIG_REQUIRED','Original Cove reference file is missing');throw e;}
 if(hash(bytes)!==p.reference_sha256)fail('VOICE_REFERENCE_CHANGED','Reference checksum differs from locked profile');
 const s=p.synthesis||{};
 if(s.mode!=='audio-ref'||s.model!=='seed-audio-1.0'||s.sample_rate!==24000||s.speech_rate!==0||s.pitch_rate!==0)fail('VOICE_PROFILE_INVALID','Resolve a deliberate voice-contract change before generating');
 return {...p,reference_path:ref,config_path:file};
}
export const normalize=s=>String(s).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
export async function fingerprint(root,x){
 const entries=[];
 async function walk(dir){for(const e of (await fs.readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){if(['node_modules','.git','.hyperframes'].includes(e.name))continue;const file=path.join(dir,e.name);if(e.isSymbolicLink())fail('INVALID_PATH','Stage composition assets as real project files');if(e.isDirectory())await walk(file);else if(e.isFile())entries.push([path.relative(root,file),hash(await fs.readFile(file))]);}}
 await walk(x.composition);
 for(const rel of ['delivery.json',x.delivery.sources,x.delivery.storyboard,x.delivery.cues,x.delivery.script,...x.delivery.media.map(m=>m.path)])entries.push([rel,hash(await fs.readFile(await asset(root,rel)))]);
 return hash(JSON.stringify(entries));
}
export function timed(s,duration){return s&&typeof s.text==='string'&&Number.isFinite(s.start)&&Number.isFinite(s.end)&&s.start>=0&&s.end>=s.start&&s.end<=duration+.08;}
export async function validateProject(root){
 const d=await readJSON(path.join(root,'delivery.json'));
 if(d.schema_version!==1||!d.title||!Number.isFinite(d.duration)||d.duration<=0)fail('INVALID_PROJECT','Missing title, duration or schema_version');
 const sources=await readJSON(await asset(root,d.sources)),story=await readJSON(await asset(root,d.storyboard));
 const cue=await readJSON(await asset(root,d.cues)),script=await fs.readFile(await asset(root,d.script),'utf8');
 if(!Array.isArray(sources.references)||!sources.references.length||!Array.isArray(story.scenes)||!story.scenes.length)fail('INVALID_PROJECT','Source references and scenes are required');
 const refs=new Map(sources.references.map(r=>[r.id,r]));
 if(refs.size!==sources.references.length)fail('INVALID_PROJECT','Duplicate source IDs');
 for(const r of refs.values())if(!r.quote||!(r.section||r.location))fail('INVALID_PROJECT','Source quote and locator required');
 const ids=new Set();
 for(const s of story.scenes){
  if(!s.id||ids.has(s.id)||!Number.isFinite(s.start)||!Number.isFinite(s.end)||s.start<0||s.end<=s.start||s.end>d.duration)fail('INVALID_PROJECT','Invalid or duplicate scene');
  ids.add(s.id);
  for(const k of ['question','subject','initial_state','trigger','end_state'])if(!s[k])fail('INVALID_PROJECT','Scene missing '+k);
  if(s.initial_state===s.end_state||!s.motion_rules?.length||!Array.isArray(s.proof_times)||s.proof_times.length<2)fail('INVALID_PROJECT','Scene needs state change, motion recipe and proof frames');
  if(s.proof_times.some(t=>!Number.isFinite(t)||t<s.start||t>s.end))fail('INVALID_PROJECT','Proof frame outside scene');
  if(!s.source_refs?.length||s.source_refs.some(id=>!refs.has(id)))fail('INVALID_PROJECT','Broken scene source reference');
 }
 if(!Array.isArray(d.chapters)||!d.chapters.length||d.chapters[0].start!==0)fail('INVALID_PROJECT','Chapters must start at zero');
 for(let i=0;i<d.chapters.length;i++){const c=d.chapters[i];if(!c.title||!c.summary||!Number.isFinite(c.start)||c.start<0||c.start>=d.duration||(i&&c.start<=d.chapters[i-1].start)||!c.source_refs?.length||c.source_refs.some(id=>!refs.has(id)))fail('INVALID_PROJECT','Invalid chapter or source reference');}
 if(!cue.provenance?.length||!Array.isArray(cue.sentences)||!cue.sentences.length)fail('TIMING_REQUIRED','Actual provider/transcription provenance required');
 let prev=-1;
 for(const s of cue.sentences){if(!timed(s,d.duration)||s.start<prev)fail('TIMING_INVALID','Invalid sentence timing');prev=s.end;let wordEnd=s.start;for(const w of s.words||[]){if(!timed(w,d.duration)||w.start<wordEnd-.001||w.start<s.start-.08||w.end>s.end+.08)fail('TIMING_INVALID','Word timing outside sentence or out of order');wordEnd=w.end;}}
 if(normalize(script)!==normalize(cue.sentences.map(s=>s.text).join('')))fail('TRANSCRIPT_MISMATCH','Narration and timed transcript differ; fix alignment');
 if(!Array.isArray(d.media)||!d.media.length)fail('AUDIO_REQUIRED','Narration media required');
 const mediaIds=new Set();let lastEnd=0;
 for(const m of [...d.media].sort((a,b)=>a.start-b.start)){
  if(!m.id||mediaIds.has(m.id)||!m.task_id||!Number.isFinite(m.start)||!Number.isFinite(m.duration)||m.start<0||m.duration<=0||m.start+m.duration>d.duration+.08)fail('INVALID_PROJECT','Invalid narration media or missing task receipt');
  if(m.start<lastEnd-.01)fail('INVALID_PROJECT','Narration segments overlap');lastEnd=m.start+m.duration;mediaIds.add(m.id);
  if(m.profile_id!==d.voice?.profile_id||m.reference_sha256!==d.voice?.reference_sha256||m.model!==d.voice?.model||m.sample_rate!==24000||m.speech_rate!==0||m.pitch_rate!==0)fail('VOICE_CONTINUITY_FAILED','All narration segments must share the accepted voice contract');
  await asset(root,m.path);
 }
 if(d.voice?.profile_id!=='cove-reference-v1'||!d.voice.reference_sha256||d.voice.model!=='seed-audio-1.0')fail('VOICE_CONTINUITY_FAILED','Missing accepted voice contract');
 for(const s of cue.sentences)if(!mediaIds.has(s.media_id))fail('TIMING_INVALID','Sentence has no matching audio segment');
 for(const m of d.media){const sentences=cue.sentences.filter(s=>s.media_id===m.id);if(!sentences.length||sentences.some(s=>s.start<m.start-.08||s.end>m.start+m.duration+.08))fail('TIMING_INVALID','Sentence timing must match its actual audio segment');}
 for(const k of d.key_cues||[]){
  if(!ids.has(k.scene_id)||!refs.has(k.source_ref)||!k.audio_phrase||!Number.isFinite(k.word_start)||!Number.isFinite(k.motion_start)||Math.abs(k.word_start-k.motion_start)>.3)fail('TIMING_INVALID','Key action cue is missing or exceeds 300ms');
  const words=cue.sentences.flatMap(s=>s.words||[]);
  if(!words.some(w=>Math.abs(w.start-k.word_start)<.001))fail('TIMING_INVALID','Key cue must point to an actual word timestamp');
 }
 if(!d.key_cues?.length)fail('TIMING_REQUIRED','Declare semantic action anchors');
 const comp=await asset(root,d.composition);
 return {delivery:d,sources,story,cues:cue,script,composition:comp};
}
export function run(main){return main().catch(e=>{console.error(JSON.stringify({ok:false,code:e.code||'OUTPUT_CONTRACT_FAILED',message:e.message}));process.exitCode=1;});}
