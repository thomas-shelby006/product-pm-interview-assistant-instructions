import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

function options(argv) { const out={}; for(let i=2;i<argv.length;i+=2) out[String(argv[i]||'').replace(/^--/,'')]=argv[i+1]; return out; }
function run(cwd,args) { const value=spawnSync('git',args,{cwd,encoding:'utf8'}); if(value.status!==0) throw new Error(value.stderr||`git ${args.join(' ')} failed`); return value.stdout.trim(); }
function canonical(value) { if(Array.isArray(value)) return value.map(canonical); if(!value||typeof value!=='object') return value; return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])); }
function sha(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
const args=options(process.argv); const repo=path.resolve(String(args.repo||'')); const evidencePath=path.resolve(String(args.evidence||'')); const output=path.resolve(String(args.output||'')); const original=args.original?path.resolve(String(args.original)):'';
if(!repo||!evidencePath||!output) throw new Error('Required options: --repo, --evidence, --output [--original]');
const evidence=JSON.parse(await fs.readFile(evidencePath,'utf8')); const commit=run(repo,['rev-parse','HEAD']);
if(String(evidence.commit||'')!==commit) throw new Error('Release evidence commit does not match HEAD');
const trackedStatus=run(repo,['status','--porcelain','--untracked-files=no']); if(trackedStatus) throw new Error('Tracked working tree is not clean');
const branch=run(repo,['branch','--show-current']); const tags=run(repo,['tag','--points-at','HEAD']).split(/\r?\n/).filter(Boolean); const parentCount=run(repo,['rev-list','--parents','-n','1','HEAD']).split(/\s+/).length-1;
const originalStatus=original?run(original,['status','--porcelain']):''; const base=args.base||'main'; let changed=[]; try{changed=run(repo,['diff','--name-only',`${base}...HEAD`]).split(/\r?\n/).filter(Boolean).sort();}catch{changed=[];}
const manifest=await fs.readFile(path.join(repo,'runtime/extension/manifest.json'),'utf8').then(JSON.parse);
const value=canonical({ schema:'pmia-main-handoff/v1', version:String(manifest.version||''), commit, branch, base, releaseEvidenceHash:String(evidence.manifestHash||''), releaseEvidenceFile:path.basename(evidencePath), trackedTreeClean:true, originalCheckoutClean:!originalStatus, tagsAtHead:tags, parentCount, changedFiles:changed, changedFileCount:changed.length, noPushMergeTagConfirmed:String(args['no-push-confirmed']||'false')==='true'&&tags.length===0&&parentCount===1, generatedAt:Number(args['generated-at']||0) });
const ready=Boolean(value.releaseEvidenceHash&&value.trackedTreeClean&&value.originalCheckoutClean&&value.noPushMergeTagConfirmed); const finalValue={...value,ready,handoffHash:sha(JSON.stringify(value))};
await fs.mkdir(path.dirname(output),{recursive:true}); await fs.writeFile(output,`${JSON.stringify(finalValue,null,2)}\n`,'utf8'); console.log(JSON.stringify({ok:ready,output,commit,handoffHash:finalValue.handoffHash,changedFileCount:changed.length})); if(!ready) process.exitCode=1;
