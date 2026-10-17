import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'techplan-pack-'));
const cmd=process.platform==='win32'?'npm.cmd':'npm';
const run=(args,env={})=>spawnSync(cmd,args,{encoding:'utf8',shell:process.platform==='win32',env:{...process.env,...env},timeout:120000});
try {
  const pack=run(['pack','--pack-destination',dir,'--json']);
  if(pack.status!==0) throw Error(pack.stderr);
  const archives=fs.readdirSync(dir).filter(f=>f.endsWith('.tgz'));
  if(archives.length!==1) throw Error('Expected one package archive');
  const test=run(['test'],{TECH_PLAN_PACKED_TARBALL:path.join(dir,archives[0])});
  console.log(test.stdout);if(test.status!==0)throw Error(test.stderr);
} finally {fs.rmSync(dir,{recursive:true,force:true});}
