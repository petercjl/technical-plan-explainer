#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { root, pkg, fail } from './runtime.mjs';
import { source, targetPath, status, install } from './skills.mjs';
import { beforeRun, checkUpdate, installUpdate } from './update.mjs';

const args = process.argv.slice(2);
const option = name => { const i=args.indexOf(name); return i<0 ? undefined : args[i+1]; };
const out = value => console.log(JSON.stringify(value, null, 2));
try {
  if (await beforeRun(args)) { /* newly installed entry has handled this request */ }
  else if (args[0]==='version' || args[0]==='--version') out({name:pkg.name,version:pkg.version});
  else if (args[0]==='capabilities') out(JSON.parse(fs.readFileSync(path.join(root,'capabilities.json'),'utf8')));
  else if (args[0]==='skill') {
    const action=args[1];
    if (action==='source') out({ok:true,package:pkg.name,version:pkg.version,source});
    else {
      const target=targetPath(option('--agent') || 'codex',option('--root'));
      if (action==='status') out({...status(target),record:undefined});
      else if (['install','update'].includes(action)) out(install(target));
      else throw fail('INVALID_COMMAND','Use skill source/status/install/update.');
    }
  } else if (args[0]==='update') {
    const check=await checkUpdate();
    if(args[1]==='check') out(check);
    else if(args[1]==='install') {
      if(!args.includes('--yes')) throw fail('PERMISSION_REQUIRED','Package update requires --yes.');
      if(!check.ok) throw fail(check.code,'Registry unavailable; installed version retained.');
      out(check.updateAvailable ? installUpdate(check) : {ok:true,changed:false,version:pkg.version});
    } else throw fail('INVALID_COMMAND','Use update check/install.');
  } else if (args[0]==='doctor' || args[0]==='project') {
    const command=args[0]==='doctor' ? ['doctor',...(option('--profile')?['--profile',option('--profile')]:[])] : args.slice(1);
    const r=spawnSync(process.execPath,[path.join(source,'scripts/project.mjs'),...command],{stdio:'inherit',env:{...process.env,TECH_PLAN_AUTO_UPDATE:'0'},windowsHide:true});
    process.exitCode=r.status??1;
  } else if (['bundle','verify'].includes(args[0])) {
    const r=spawnSync(process.execPath,[path.join(source,'scripts',args[0]+'.mjs'),...args.slice(1)],{stdio:'inherit',windowsHide:true});
    process.exitCode=r.status??1;
  } else console.log('technical-plan-explainer\nversion | capabilities --json | doctor --json\nskill source/status/install/update [--agent codex|sealseek|workbuddy] [--root SKILLS_DIRECTORY]\nupdate check/install --yes\nproject <command> | bundle PROJECT | verify PROJECT\nNode.js 22+. Resolve the current canonical Skill with skill source --json.');
} catch(e) { out({ok:false,code:e.code||'COMMAND_FAILED',message:e.message}); process.exitCode=1; }
