import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { root, pkg, fail } from './runtime.mjs';

export const stateRoot = () => process.env.TECH_PLAN_STATE_DIR || (process.platform === 'win32' ? path.join(process.env.LOCALAPPDATA || os.homedir(), 'technical-plan-explainer') : path.join(os.homedir(), '.local', 'state', 'technical-plan-explainer'));
export function newer(a, b) {
  if (!/^\d+\.\d+\.\d+$/.test(a)) return false;
  const x=a.split('.').map(Number), y=b.split('.').map(Number);
  for(let i=0;i<3;i++) { if(x[i]!==y[i]) return x[i]>y[i]; }
  return false;
}
export function globalPrefix(location=root, platform=process.platform) {
  const modules=path.dirname(path.dirname(location));
  if(path.basename(modules)!=='node_modules' || fs.existsSync(path.join(location,'.git'))) return null;
  if(platform==='win32') return path.dirname(modules);
  return path.basename(path.dirname(modules))==='lib' ? path.dirname(path.dirname(modules)) : null;
}
export async function checkUpdate(registry=fetch) {
  try {
    const r=await registry(`https://registry.npmjs.org/${encodeURIComponent(pkg.name)}/latest`,{signal:AbortSignal.timeout(8000)});
    if(!r.ok) throw Error('Registry unavailable');
    const data=await r.json();
    if(data.name!==pkg.name || !/^\d+\.\d+\.\d+$/.test(data.version)) throw Error('Invalid stable package');
    return {ok:true,current:pkg.version,available:data.version,updateAvailable:newer(data.version,pkg.version),tag:'latest'};
  } catch { return {ok:false,code:'REGISTRY_UNAVAILABLE',current:pkg.version,updateAvailable:false,offline:'keep-current'}; }
}
function npm(args) {
  let cli=process.env.npm_execpath;
  if(!cli?.endsWith('npm-cli.js')) {
    const found=spawnSync(process.platform==='win32'?'where':'which',[process.platform==='win32'?'npm.cmd':'npm'],{encoding:'utf8',timeout:10000});
    const launcher=found.stdout?.trim().split(/\r?\n/)[0];
    cli=launcher && (process.platform==='win32' ? path.join(path.dirname(launcher),'node_modules','npm','bin','npm-cli.js') : fs.realpathSync(launcher));
  }
  if(!cli || !fs.existsSync(cli)) throw fail('NPM_UNAVAILABLE','npm is required for updates.');
  const r=spawnSync(process.execPath,[cli,...args],{encoding:'utf8',timeout:180000});
  if(r.status!==0) throw fail('UPDATE_FAILED','npm update failed; check npm connectivity and installation permissions.');
  return r.stdout;
}
export function installUpdate(check, services={}) {
  const prefix=services.prefix || globalPrefix();
  if(!prefix) throw fail('UPDATE_OWNER_REQUIRED','This installation is managed by its source checkout or parent package.');
  const state=stateRoot(); fs.mkdirSync(state,{recursive:true});
  const lock=path.join(state,'update.lock');
  try { fs.mkdirSync(lock); } catch { throw fail('UPDATE_BUSY','Another update is running. Retry this command after it finishes.'); }
  const run=services.npm || npm, spawn=services.spawn || spawnSync;
  const backup=path.join(state,'package-backups',crypto.randomUUID());
  const targets=[];
  try {
    // Recheck the live package under the lock; another process may have updated it.
    const live=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
    if(!newer(check.available,live.version)) return {ok:true,changed:false,version:live.version};
    fs.mkdirSync(backup,{recursive:true});
    const archive=JSON.parse(run(['pack',root,'--ignore-scripts','--pack-destination',backup,'--json']))[0];
    const registered=path.join(state,'skill-targets');
    const known=[path.join(process.env.CODEX_HOME || path.join(os.homedir(),'.codex'),'skills','technical-plan-explainer')];
    for(const f of (fs.existsSync(registered) ? fs.readdirSync(registered) : [])) {
      try { known.push(JSON.parse(fs.readFileSync(path.join(registered,f),'utf8')).target); } catch { /* invalid registration */ }
    }
    for(const target of new Set(known)) {
      try { if(JSON.parse(fs.readFileSync(path.join(target,'.technical-plan-explainer-managed.json'),'utf8')).package===pkg.name) targets.push(target); } catch { /* unmanaged or absent */ }
    }
    const entry=path.join(root,'npm','cli.mjs');
    const sync=target=>spawn(process.execPath,[entry,'skill','update','--root',path.dirname(target)],{encoding:'utf8',timeout:30000,env:{...process.env,TECH_PLAN_AUTO_UPDATE:'0'}});
    let mutated=false;
    try {
      mutated=true;
      run(['install','--global','--prefix',prefix,'--prefer-online','--ignore-scripts','--no-audit','--no-fund',`${pkg.name}@${check.available}`]);
      const version=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version;
      if(version!==check.available) throw fail('UPDATE_VERIFY_FAILED','Installed package version mismatch.');
      for(const target of targets) if(sync(target).status!==0) throw fail('SKILL_SYNC_FAILED','A managed Skill needs reconciliation.');
      return {ok:true,changed:true,from:pkg.version,version,backup:path.join(backup,archive.filename)};
    } catch(e) {
      if(mutated) {
        try { run(['install','--global','--prefix',prefix,'--ignore-scripts',path.join(backup,archive.filename)]); }
        catch { throw fail('ROLLBACK_REQUIRED','Automatic recovery failed; restore the package archive before running commands.'); }
        for(const target of targets) if(sync(target).status!==0) throw fail('ROLLBACK_SYNC_REQUIRED','Package restored; reconcile edited Skill files before updating.');
      }
      throw e;
    }
  } finally { fs.rmdirSync(lock); }
}
export async function beforeRun(args, services={}) {
  if(process.env.TECH_PLAN_AUTO_UPDATE==='0' || !globalPrefix() || args[0]==='update') return false;
  const check=await (services.check || checkUpdate)();
  if(!check.ok) console.error('[technical-plan-explainer] Update check unavailable; using installed version.');
  if(!check.updateAvailable) return false;
  if(check.available.split('.')[0]!==pkg.version.split('.')[0]) {
    console.error('[technical-plan-explainer] A new major version is available; use an explicit update to migrate.');
    return false;
  }
  try {
    const result=(services.install || installUpdate)(check);
    console.error(`[technical-plan-explainer] Using latest ${result.version}.`);
  } catch(e) {
    if(['UPDATE_BUSY','ROLLBACK_SYNC_REQUIRED','ROLLBACK_REQUIRED'].includes(e.code)) throw e;
    console.error(`[technical-plan-explainer] ${e.code || 'UPDATE_FAILED'}; using restored installed version.`);
  }
  // Delegate once only after update/rollback; never replay a business request.
  const r=spawnSync(process.execPath,[path.join(root,'npm','cli.mjs'),...args],{stdio:'inherit',env:{...process.env,TECH_PLAN_AUTO_UPDATE:'0'}});
  process.exitCode=r.status??1;
  return true;
}
