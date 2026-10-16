from pathlib import Path
import zipfile,hashlib
O=Path(__file__).parent;R=Path('/home/user/repo');files=[]
for name in ['POTOLKOVO-CALCULATOR-AUDIT.html','POTOLKOVO-CALCULATOR-AUDIT.docx','POTOLKOVO-CALCULATOR-UX-TZ.docx','POTOLKOVO-FIXTURE-ROLE-AUDIT.xlsx','github-status.json']:
 files.append((O/name,name))
for name in ['CALCULATOR-AUDIT.md','CALCULATOR-UX-TZ.md','CATALOG-LED-AUDIT.md','CATALOG-LED-TZ.md']:
 files.append((R/'docs/current'/name,'docs/current/'+name))
for folder in ['calculator-audit-2026-10-15','catalog-led-audit']:
 for p in sorted((R/'docs/evidence'/folder).rglob('*')):
  if p.is_file():files.append((p,str(p.relative_to(R))))
for name in ['01-first-390.jpg','02-default-390-review.jpg','05-room-edit-390.jpg','06-after-area-edit-390.jpg','09-final-390.jpg','13-floating-light-step.jpg','accessories-chromium-mobile.jpg','track-controls-chromium-mobile.jpg']:
 files.append((O/'screenshots'/name,'screenshots/'+name))
readme='''# ПОТОЛКОВО · калькулятор и светильники · 15.10.2026

Откройте HTML-обзор. DOCX — полный аудит и целевой UX-контракт, XLSX — 547 записей, 13 адресных строк и 20 записей без основного browse-раздела для review.

Выполнено: адресные роли 5 устройств управления треком и 7 дополнений, единые счётчики; 0У-00001341/offer2021 снят с активной выдачи/подбора/index/prefill/API. Архив — только историческое распознавание недоступного товара. Старый расчёт предупреждает и даёт явное удаление.

Не выполнено этим этапом: новый выбор решений, реформа комнат/прогресса, LED-зоны/BOM и целевой итог. Это задания из UX-ТЗ и LED-ТЗ. Классификация не является гарантией электрической совместимости или актуального наличия.

Снимки первых экранов — аудит исходного 8c14802; снимки accessories/track-controls — после исправлений. QA кода 2775d4b: 1305 unit, 288 E2E passed / 12 skipped / 0 failed / 0 flaky. Последний push — 569ad55, только feat/company-rebrand-v7-preview. Main не изменён.

Реальные заявки не отправлялись. Реальные устройства/экранная клавиатура/screen reader/инженерный стенд не объявлены проверенными. Полная текущая документация и PT-очередь — в repo/docs/current; этот пакет не заменяет её.
'''
sums=''.join(hashlib.sha256(p.read_bytes()).hexdigest()+'  '+n+'\n' for p,n in files)+hashlib.sha256(readme.encode()).hexdigest()+'  README-FIRST.md\n'
with zipfile.ZipFile(O/'POTOLKOVO-CALCULATOR-AUDIT-PACK.zip','w',zipfile.ZIP_DEFLATED) as z:
 for p,n in files:z.write(p,n)
 z.writestr('README-FIRST.md',readme);z.writestr('SHA256SUMS.txt',sums)
with zipfile.ZipFile(O/'POTOLKOVO-CALCULATOR-AUDIT-PACK.zip') as z:
 assert z.testzip() is None
 for h,n in (line.split('  ',1) for line in sums.splitlines()):assert hashlib.sha256(z.read(n)).hexdigest()==h,n
print('Verified package:',(O/'POTOLKOVO-CALCULATOR-AUDIT-PACK.zip').stat().st_size,'bytes')
