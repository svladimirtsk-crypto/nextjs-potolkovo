from pathlib import Path
import subprocess, hashlib, json, shutil, csv
repo=Path('/home/user/repo'); workspace=Path('/home/user'); current=repo/'docs/current'
required=['README.md','STATUS.md','BRAND-REDESIGN-TZ-V8.md','TECHNICAL-TZ-V8.md','RELEASE-OPERATIONS.md','LEGACY-MAP.csv']
assert all((current/name).is_file() for name in required)
text=(current/'TECHNICAL-TZ-V8.md').read_text()
assert all(f'### T8-{i:03d} ' in text for i in range(1,37))
assert all(f'### B8-{i:03d} ' in (current/'BRAND-REDESIGN-TZ-V8.md').read_text() for i in range(1,9))
assert len(list(csv.DictReader((current/'LEGACY-MAP.csv').open())))==137
assert subprocess.check_output(['git','branch','--show-current'],cwd=repo,text=True).strip()=='feat/company-rebrand-v7-preview'
# Protect all product sources/assets/config, including original supplier XML.
tracked=[repo/f.decode() for f in subprocess.check_output(['git','ls-files','-z'],cwd=repo).split(b'\0') if f]
protected=[p for p in tracked if p.parts[len(repo.parts)] in {'app','components','content','lib','db','tests','e2e','scripts','design','public','data'} or p.name in {'package.json','package-lock.json','next.config.ts','amvera.yaml','.env.example','playwright.config.ts','vitest.config.ts'} or p==repo/'tzv3/feed.xml']
def fingerprint(paths):
 h=hashlib.sha256()
 for p in sorted(paths):h.update(str(p.relative_to(repo)).encode()+b'\0'+p.read_bytes())
 return h.hexdigest()
before=fingerprint(protected)
# Preserve the latest full QA as the only active set, byte for byte.
src=repo/'docs/reports/evidence/R7-gallery';dest=repo/'docs/evidence/latest-qa';dest.mkdir(parents=True,exist_ok=True)
relocated=[]
for p in sorted(src.glob('*')):
 if p.is_file():
  q=dest/p.name;shutil.copyfile(p,q);assert p.read_bytes()==q.read_bytes();relocated.append({'from':str(p.relative_to(repo)),'to':str(q.relative_to(repo)),'sha256':hashlib.sha256(q.read_bytes()).hexdigest()})
assert len(relocated)==9
candidates=[]
for name in ['01-audit-sootvetstvie-tz.md','02-glubokiy-audit.md','03-tz-v2.md','tz-agent.md','POTOLKOVO-TZ-V5-FINAL.md']:
 candidates.append(repo/name)
candidates+=list(repo.glob('PHASE-*-REPORT.md'))+list(repo.glob('PT-*-REPORT.md'))
for folder in ['TZv5 допы','tz portal']:
 candidates += [p for p in (repo/folder).rglob('*') if p.is_file()]
candidates += [p for p in (repo/'tzv3').glob('*') if p.is_file() and p.name!='feed.xml']
candidates += [current/'POTOLKOVO-BRAND-REDESIGN-TZ-V7.md',current/'POTOLKOVO-FINAL-AUDIT-TZ-V6.md']
candidates += [p for p in (repo/'docs/reports').rglob('*') if p.is_file()]
# Generated obsolete specifications outside Git. Do not delete visual concepts or implementation backups.
audit=workspace/'audit'; candidates += list(audit.glob('POTOLKOVO-*V6.*'))
candidates += [audit/x for x in ['README-FIRST.md','SHA256SUMS.txt','mapping.json','tasks.json','qa.json','CHECKOUT-REFERENCE.json']]
rebrand=workspace/'rebrand';candidates += list(rebrand.glob('POTOLKOVO-BRAND-REDESIGN-TZ-V7.*'))
candidates += [rebrand/x for x in ['POTOLKOVO-BACKLOG-V7.xlsx','README-FIRST.md','SHA256SUMS.txt','tasks-r7.json']]
impl=workspace/'implementation'
candidates += list(impl.glob('R7-*.md'))+list(impl.glob('*/R7-*.md'))
candidates += list(impl.glob('README-HANDOFF.md'))+list(impl.glob('*/README-HANDOFF.md'))+list(impl.glob('*/SHA256SUMS.txt'))
for p in impl.rglob('*'):
 if p.is_file() and 'evidence' in p.relative_to(impl).parts and p.suffix in {'.log','.json'}:candidates.append(p)
candidates += list((impl/'ci-fix').glob('*.log'))+list(impl.glob('ci-fix-*.log'))
records=[]
for p in sorted(set(candidates)):
 if not p.is_file():continue
 assert '/uploads/' not in str(p)
 assert p not in protected
 data=p.read_bytes(); records.append({'path':str(p.relative_to(workspace)),'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'recovery':'Git at 3dd20cd / origin history' if p.is_relative_to(repo) else 'Generated historical copy; requirements migrated to docs/current; implementation backups retained'})
manifest={'date':'2026-10-14','baseCommit':'3dd20cd5eccb68e82148a643840d95a369e75000','replacement':'docs/current v8','requirementsCoverage':{'technicalCards':36,'brandCards':8,'legacyMappingRows':137},'preserved':'Product sources/assets/config, uploads, licenses, source XML, visual concepts, implementation ZIP/bundle backups, last full QA, Git history','protectedFiles':len(protected),'sourceFingerprintBefore':before,'relocatedQA':relocated,'removed':records,'removedCount':len(records),'removedBytes':sum(x['bytes'] for x in records)}
(repo/'docs/maintenance').mkdir(parents=True,exist_ok=True)
manifestPath=repo/'docs/maintenance/DOCS-CLEANUP-V8.json';manifestPath.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
for p in sorted(set(candidates)):
 if p.is_file():p.unlink()
for folder in [repo/'docs/reports',repo/'TZv5 допы',repo/'tz portal']:
 for d in sorted((p for p in folder.rglob('*') if p.is_dir()),reverse=True):
  if not any(d.iterdir()):d.rmdir()
 if folder.exists() and not any(folder.iterdir()):folder.rmdir()
after=fingerprint(protected);assert after==before
manifest['sourceFingerprintAfter']=after;manifest['sourceUnchanged']=True
manifestPath.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
(workspace/'implementation/documentation-v8/CLEANUP.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:manifest[k] for k in ['removedCount','removedBytes','protectedFiles','sourceUnchanged','requirementsCoverage']},ensure_ascii=False,indent=2))
