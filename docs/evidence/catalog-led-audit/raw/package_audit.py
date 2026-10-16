from pathlib import Path
import json,hashlib,zipfile
O=Path(__file__).parent;R=Path('/home/user/repo')
files=[]
for n in ['POTOLKOVO-CATALOG-AUDIT.html','POTOLKOVO-CATALOG-AUDIT.docx','POTOLKOVO-CATALOG-LED-TZ.docx','POTOLKOVO-EKS-LED-MATRIX.xlsx','github-status.json']:
 files.append((O/n,n))
for n in ['CATALOG-LED-AUDIT.md','CATALOG-LED-TZ.md']:files.append((R/'docs/current'/n,'canonical/'+n))
for p in sorted((R/'docs/evidence/catalog-led-audit').iterdir()):
 if p.is_file():files.append((p,'evidence/'+p.name))
for p in sorted((O/'screenshots').glob('*.jpg')):
 if p.name!='test.jpg':files.append((p,'screenshots/'+p.name))
for n in ['eks-label-12379.png','eks-label-12386.png']:files.append((O/'sources'/n,'sources/'+n))
readme='''# ПОТОЛКОВО · аудит каталога / LED · 14.10.2026

Откройте POTOLKOVO-CATALOG-AUDIT.html — автономный обзор с подтверждёнными примерами и 15 находками.

- POTOLKOVO-CATALOG-AUDIT.docx — полный аудит.
- POTOLKOVO-CATALOG-LED-TZ.docx — ТЗ с 26 будущими приёмочными сценариями.
- POTOLKOVO-EKS-LED-MATRIX.xlsx — 72 позиции EKS, 186 смен артикулов, кандидаты управления, примеры мощности и источники.
- canonical/ — Markdown-копии действующих документов docs/current.
- evidence/ — снимок XML, хэши, машинные факты браузерного/кодового аудита и наблюдения маркировок.
- screenshots/ — текущая preview-версия, не будущий макет.
- sources/ — изображения маркировки EKS для анализа; не разрешение использовать фото в маркетинге.

Все 72 строки совместимости требуют дальнейшего review. title_only/label_observed не являются паспортом партии или инженерным испытанием. Приёмоочные сценарии из ТЗ ещё не выполнены как новая функциональность.

Аудит не меняет приложение: новый раздел/автоподбор ещё не внедрены. Main/production не менялись. Цены и склады — зафиксированный снимок, не предложение отгрузки. Электрическая схема/подключение/защита проверяются квалифицированным специалистом.

Текущая нормативная база целиком — в repo/docs/current, включая PT-020…049 и T8. Этот пакет их не заменяет; аудит и ТЗ уточняют задачи каталога.
'''.replace('Приёмоочные','Приёмочные')
sums=''.join(hashlib.sha256(p.read_bytes()).hexdigest()+'  '+n+'\n' for p,n in files)+hashlib.sha256(readme.encode()).hexdigest()+'  README-FIRST.md\n'
with zipfile.ZipFile(O/'POTOLKOVO-CATALOG-AUDIT-PACK.zip','w',zipfile.ZIP_DEFLATED) as z:
 for p,n in files:z.write(p,n)
 z.writestr('README-FIRST.md',readme);z.writestr('SHA256SUMS.txt',sums)
with zipfile.ZipFile(O/'POTOLKOVO-CATALOG-AUDIT-PACK.zip') as z:
 assert z.testzip() is None
 for h,n in (line.split('  ',1) for line in sums.splitlines()):assert hashlib.sha256(z.read(n)).hexdigest()==h,n
print('Audit pack verified:',(O/'POTOLKOVO-CATALOG-AUDIT-PACK.zip').stat().st_size,'bytes')
