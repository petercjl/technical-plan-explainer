import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {profile,hash} from '../skills/technical-plan-explainer/scripts/lib.mjs';

test('voice: fresh user resolves bundled master; explicit and existing overrides stay authoritative',async()=>{
 const scratch=await fs.mkdtemp(path.join(os.tmpdir(),'techplan-voice-'));
 const oldXdg=process.env.XDG_CONFIG_HOME,oldProfile=process.env.TECH_PLAN_VOICE_PROFILE;
 process.env.XDG_CONFIG_HOME=scratch;delete process.env.TECH_PLAN_VOICE_PROFILE;
 try{
  const p=await profile();assert.equal(p.profile_source,'bundled');
  assert.equal(hash(await fs.readFile(p.reference_path)),p.reference_sha256);
  assert.equal(p.synthesis.model,'seed-audio-1.0');
  const missing=path.join(scratch,'missing.json');
  await assert.rejects(profile(missing),{code:'CONFIG_REQUIRED'});
  process.env.TECH_PLAN_VOICE_PROFILE=missing;
  await assert.rejects(profile(),{code:'CONFIG_REQUIRED'});delete process.env.TECH_PLAN_VOICE_PROFILE;
  const dir=path.join(scratch,'technical-plan-explainer');await fs.mkdir(dir);
  const config=path.join(dir,'voice-profile.json');
  const raw=JSON.parse(await fs.readFile(p.config_path,'utf8'));
  raw.reference_file='own.wav';await fs.copyFile(p.reference_path,path.join(dir,'own.wav'));
  await fs.writeFile(config,JSON.stringify(raw),{flag:'wx'});
  assert.equal((await profile()).profile_source,'user');
  assert.equal((await profile()).reference_path,path.join(dir,'own.wav'));
  await fs.appendFile(path.join(dir,'own.wav'),'changed');
  await assert.rejects(profile(),{code:'VOICE_REFERENCE_CHANGED'});
  await fs.unlink(path.join(dir,'own.wav'));
  await assert.rejects(profile(),{code:'CONFIG_REQUIRED'});
  await fs.writeFile(config,'invalid');await assert.rejects(profile(),SyntaxError);
 }finally{
  if(oldXdg===undefined)delete process.env.XDG_CONFIG_HOME;else process.env.XDG_CONFIG_HOME=oldXdg;
  if(oldProfile===undefined)delete process.env.TECH_PLAN_VOICE_PROFILE;else process.env.TECH_PLAN_VOICE_PROFILE=oldProfile;
  await fs.rm(scratch,{recursive:true,force:true});
 }
});
