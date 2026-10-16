from pathlib import Path
import zipfile,hashlib,shutil
R=Path('/home/user/repo');O=Path(__file__).parent
for ext in ['pdf','html']:
 shutil.copyfile(R/f'design/brand/v8/POTOLKOVO-BRANDBOOK.{ext}',O/f'POTOLKOVO-BRANDBOOK.{ext}')
entries=[]
for folder in ['design/brand/v8','docs/current','docs/evidence/latest-qa']:
 for p in sorted((R/folder).rglob('*')):
  if p.is_file():entries.append((p,str(p.relative_to(R))))
for rel in ['docs/maintenance/DOCS-CLEANUP-V8.json','design/brand/v7/typefaces/OFL.txt','design/brand/v7/typefaces/provenance.json','design/brand/v7/typefaces/Inter-CyrillicLatin.ttf','public/brand/v7/inter-cyrillic-latin.woff2','public/brand/v7/social/home.jpg','scripts/build-brand-kit.py','scripts/export-brand-kit.mjs']:
 entries.append((R/rel,rel))
readme='''# ПОТОЛКОВО · цифровой бренд-комплект v8.1

Откройте `design/brand/v8/POTOLKOVO-BRANDBOOK.pdf` или автономный HTML рядом.
Логотипы: `design/brand/v8/exports/` — 12 SVG в контурах + 12 прозрачных PNG.
Цветовые варианты: ink для светлого фона, reverse для тёмного, black/white монохромные.

Это текущая айдентика компании, не смена знака. RGB-мастера для цифрового использования и согласования; не готовая CMYK-полиграфия. Утверждение владельцем, проверка обозначения, печатный профиль и проба остаются открыты.

Исходники брендбука, генераторы, лицензия и исходный шрифт приложены. Сохранена структура путей репозитория. Для повторной генерации используйте окружение проекта с Python/fontTools и npm-зависимостями sharp/@playwright/test (Chromium); комплект не заменяет исходники сайта.

`docs/current/README.md` — актуальные задания PT и бренда; `BRAND-VOICE-CLAIMS.md` — язык компании и начальный реестр утверждений. Технический план не отменён.

Только preview. Main/production не изменяются передачей этого пакета.
'''
sums=''.join(hashlib.sha256(p.read_bytes()).hexdigest()+'  '+n+'\n' for p,n in entries)
sums+=hashlib.sha256(readme.encode()).hexdigest()+'  README-FIRST.md\n'
with zipfile.ZipFile(O/'POTOLKOVO-BRAND-KIT-V8.zip','w',zipfile.ZIP_DEFLATED) as z:
 for p,n in entries:z.write(p,n)
 z.writestr('README-FIRST.md',readme);z.writestr('SHA256SUMS.txt',sums)
with zipfile.ZipFile(O/'POTOLKOVO-BRAND-KIT-V8.zip') as z:
 assert z.testzip() is None
 for h,n in (line.split('  ',1) for line in sums.splitlines()):assert hashlib.sha256(z.read(n)).hexdigest()==h
print('Verified brand kit package:',(O/'POTOLKOVO-BRAND-KIT-V8.zip').stat().st_size,'bytes')
