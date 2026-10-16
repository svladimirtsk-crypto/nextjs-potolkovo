from pathlib import Path
import zipfile,hashlib,shutil
R=Path('/home/user/repo');O=Path(__file__).parent;D=R/'design/client/v8'
for ext in ['pdf','html']:shutil.copyfile(D/f'POTOLKOVO-CLIENT-MATERIALS.{ext}',O/f'POTOLKOVO-CLIENT-MATERIALS.{ext}')
for p in (D/'editable').iterdir():shutil.copyfile(p,O/p.name)
entries=[(p,str(p.relative_to(R))) for p in sorted(D.rglob('*')) if p.is_file()]
for rel in ['docs/current/CLIENT-MATERIALS.md','docs/evidence/latest-qa/client-materials-summary.json','design/brand/v8/exports/potolkovo-horizontal-ink.png','design/brand/v7/typefaces/OFL.txt','public/brand/v7/inter-cyrillic-latin.woff2','scripts/build-client-materials.py','scripts/export-client-materials-data.ts','scripts/export-client-materials.mjs']:
 entries.append((R/rel,rel))
readme='''# ПОТОЛКОВО · клиентские материалы v8.2

Начните с `design/client/v8/POTOLKOVO-CLIENT-MATERIALS.pdf` (10 страниц) или автономного HTML рядом.

Редактируемые документы — `design/client/v8/editable/`:
1. Предварительное предложение.
2. Памятка перед замером и монтажом.
3. Передача результата и сервис.
4. Паспорт проекта для публикации.
5. Фотобриф.
6. Реестр проектов и фото (XLSX).

Это шаблоны, не заполненные клиентские документы. Не отправлять без заполнения, сверки и утверждения. Нет автоматической выгрузки с сайта или второго расчётного ядра: сумма и состав переносятся из одной версии действующего расчёта.

Ни договор, ни юридический акт, ни гарантийный талон не объявлены готовыми. Гарантии, реквизиты и правовая модель согласуются отдельно.

Реестр содержит 6 текущих примеров и 18 фото с миниатюрами, а не подтверждённое портфолио. Все права, факты и разрешения на новые кейсы ещё требуют проверки. Текущая галерея и оригинальные фото не менялись.

DOCX/XLSX сохраняйте как отдельную заполненную копию в защищённой папке. Перегенерация исходных шаблонов не должна затирать заполненные документы. Для воспроизведения нужны исходный репозиторий (включая фотографии), зависимости и команды из `design/client/v8/README.md`; этот пакет не является копией приложения.

Правила использования: `docs/current/CLIENT-MATERIALS.md`. Только preview; production-выпуск не разрешён этим комплектом.
'''
sums=''.join(hashlib.sha256(p.read_bytes()).hexdigest()+'  '+n+'\n' for p,n in entries)+hashlib.sha256(readme.encode()).hexdigest()+'  README-FIRST.md\n'
with zipfile.ZipFile(O/'POTOLKOVO-CLIENT-MATERIALS-V8.zip','w',zipfile.ZIP_DEFLATED) as z:
 for p,n in entries:z.write(p,n)
 z.writestr('README-FIRST.md',readme);z.writestr('SHA256SUMS.txt',sums)
with zipfile.ZipFile(O/'POTOLKOVO-CLIENT-MATERIALS-V8.zip') as z:
 assert z.testzip() is None
 for h,n in (line.split('  ',1) for line in sums.splitlines()):assert hashlib.sha256(z.read(n)).hexdigest()==h
print('Verified client package:',(O/'POTOLKOVO-CLIENT-MATERIALS-V8.zip').stat().st_size,'bytes')
