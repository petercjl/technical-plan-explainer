import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'techplan-test-'));
process.env.TECH_PLAN_STATE_DIR=path.join(scratch,'state');
process.env.TECH_PLAN_AUTO_UPDATE='0';
const {install,status,targetPath,inventory}=await import('../npm/skills.mjs');
const {checkUpdate,newer,globalPrefix,installUpdate}=await import('../npm/update.mjs');
const target=()=>path.join(scratch,crypto.randomUUID(),'technical-plan-explainer');

test('install: fresh and repeated, UTF-8 and first-install UI metadata',()=>{
  const t=target(); const first=install(t);
  assert.equal(first.managed,true); assert.equal(first.backup,null);
  assert.match(fs.readFileSync(path.join(t,'SKILL.md'),'utf8'),/技术方案动画讲解/);
  assert.ok(fs.existsSync(path.join(t,'agents/openai.yaml')));
  assert.equal(install(t).changed,false); assert.equal(status(t).current,true);
});
test('install: unrelated directory and symlink remain user-owned',()=>{
  const t=target(); fs.mkdirSync(t,{recursive:true}); fs.writeFileSync(path.join(t,'keep'),'user');
  assert.throws(()=>install(t),{code:'SKILL_UNMANAGED'});
  assert.equal(fs.readFileSync(path.join(t,'keep'),'utf8'),'user');
  const l=target();fs.mkdirSync(path.dirname(l),{recursive:true});
  fs.symlinkSync(t,l,process.platform==='win32'?'junction':'dir');
  assert.throws(()=>install(l),{code:'SKILL_UNMANAGED'});
});
test('update: edited managed content refused and preserved',()=>{
  const t=target();install(t);fs.appendFileSync(path.join(t,'SKILL.md'),'\nUser edit');
  assert.equal(status(t).edited,true); assert.throws(()=>install(t),{code:'SKILL_EDITED'});
});
test('update: stale version, locked-directory in-place sync, backup and customized UI metadata',()=>{
  const t=target();install(t);
  const marker=path.join(t,'.technical-plan-explainer-managed.json');
  const record=JSON.parse(fs.readFileSync(marker,'utf8'));record.version='0.0.1';fs.writeFileSync(marker,JSON.stringify(record));
  fs.writeFileSync(path.join(t,'agents/openai.yaml'),'display_name: User custom\n');
  fs.writeFileSync(path.join(t,'extra.txt'),'keep');
  const originalRename=fs.renameSync;fs.renameSync=()=>{throw Object.assign(Error('locked'),{code:'EPERM'});};
  let r;try{r=install(t);}finally{fs.renameSync=originalRename;}
  assert.ok(fs.existsSync(r.backup));assert.equal(status(t).current,true);
  assert.equal(fs.readFileSync(path.join(t,'agents/openai.yaml'),'utf8'),'display_name: User custom\n');
  assert.equal(fs.readFileSync(path.join(t,'extra.txt'),'utf8'),'keep');
});
test('update: failure after backup provides recoverable evidence',()=>{
  const t=target();install(t);
  const m=path.join(t,'.technical-plan-explainer-managed.json');const r=JSON.parse(fs.readFileSync(m,'utf8'));r.version='0.0.1';fs.writeFileSync(m,JSON.stringify(r));
  const copy=fs.copyFileSync;fs.copyFileSync=()=>{throw Error('simulated write failure');};
  try{assert.throws(()=>install(t),e=>e.code==='SKILL_INSTALL_FAILED'&&e.message.includes('restore from'));}finally{fs.copyFileSync=copy;}
  assert.ok(fs.existsSync(path.join(t,'SKILL.md')));
});
test('install: invalid receipt traversal and nested symlink rejected',()=>{
  const t=target();install(t);const m=path.join(t,'.technical-plan-explainer-managed.json');
  const r=JSON.parse(fs.readFileSync(m,'utf8'));r.files['../outside']='x';fs.writeFileSync(m,JSON.stringify(r));
  assert.throws(()=>status(t),{code:'SKILL_UNSAFE_TARGET'});
  const s=target();install(s);fs.symlinkSync(scratch,path.join(s,'escape'),process.platform==='win32'?'junction':'dir');
  assert.throws(()=>inventory(s),{code:'SKILL_UNSAFE_TARGET'});
});
test('agent target discovery: explicit roots and managed runtime Node entry',()=>{
  for(const a of ['codex','sealseek','workbuddy']) assert.equal(targetPath(a,scratch),path.join(scratch,'technical-plan-explainer'));
  assert.throws(()=>targetPath('unknown',scratch),{code:'INVALID_AGENT'});
  const r=spawnSync(process.execPath,[path.join(root,'npm/cli.mjs'),'skill','source','--json'],{encoding:'utf8'});
  assert.equal(r.status,0);assert.ok(fs.existsSync(path.join(JSON.parse(r.stdout).source,'SKILL.md')));
});
test('offline registry keeps current and stable version comparison',async()=>{
  assert.equal((await checkUpdate(async()=>{throw Error('offline');})).offline,'keep-current');
  assert.equal(newer('0.2.0','0.1.0'),true);assert.equal(newer('0.2.0-beta.1','0.1.0'),false);
  assert.equal(newer('0.1.0','0.1.0'),false);
  assert.equal(globalPrefix(root),null);
});
test('update: registry identity validation and new version check',async()=>{
  const r=await checkUpdate(async()=>({ok:true,json:async()=>({name:'@petercjl/technical-plan-explainer',version:'0.9.0'})}));
  assert.equal(r.updateAvailable,true);
  assert.equal((await checkUpdate(async()=>({ok:true,json:async()=>({name:'wrong',version:'0.9.0'})}))).ok,false);
});
test('update: package version verification, rollback and lock release',()=>{
  const calls=[];
  const runner=args=>{calls.push(args);return args[0]==='pack'?'[{"filename":"old.tgz"}]':'';};
  assert.throws(()=>installUpdate({available:'0.9.0'},{prefix:scratch,npm:runner,spawn:()=>({status:0})}),{code:'UPDATE_VERIFY_FAILED'});
  assert.equal(calls.filter(x=>x[0]==='install').length,2);
  assert.ok(calls.find(x=>x[0]==='install').includes('--prefer-online'),'update must refresh stale registry metadata');
  assert.equal(fs.existsSync(path.join(process.env.TECH_PLAN_STATE_DIR,'update.lock')),false);
});
test('doctor: absent runtime dependencies produce structured failure, no false ready',()=>{
  const r=spawnSync(process.execPath,[path.join(root,'npm/cli.mjs'),'doctor','--json'],{encoding:'utf8',env:{...process.env,PATH:'',TECH_PLAN_VOICE_PROFILE:path.join(scratch,'missing.json')}});
  const report=JSON.parse(r.stdout);assert.equal(report.ok,false);
});
test('packed installer: fresh global prefix and complete bundled resources',{skip:!process.env.TECH_PLAN_PACKED_TARBALL},()=>{
  const npmCli=process.env.npm_execpath;assert.ok(npmCli);
  const prefix=path.join(scratch,'packed-prefix');
  const r=spawnSync(process.execPath,[npmCli,'install','--global','--prefix',prefix,'--ignore-scripts','--no-audit','--no-fund',process.env.TECH_PLAN_PACKED_TARBALL],{encoding:'utf8',timeout:60000});
  assert.equal(r.status,0,r.stderr);
  const base=process.platform==='win32'?prefix:path.join(prefix,'lib');
  const entry=path.join(base,'node_modules/@petercjl/technical-plan-explainer/npm/cli.mjs');
  const resolved=spawnSync(process.execPath,[entry,'skill','source','--json'],{encoding:'utf8'});assert.equal(resolved.status,0);
  const skill=JSON.parse(resolved.stdout).source;
  for(const f of ['SKILL.md','scripts/bundle.mjs','scripts/verify.mjs','assets/player-shell.html','adapters/workbuddy.json']) assert.ok(fs.existsSync(path.join(skill,f)),f);
  const installed=spawnSync(process.execPath,[entry,'skill','install','--agent','workbuddy','--root',path.join(scratch,'packed-host')],{encoding:'utf8'});assert.equal(installed.status,0,installed.stdout);
});
test.after(()=>fs.rmSync(scratch,{recursive:true,force:true}));
