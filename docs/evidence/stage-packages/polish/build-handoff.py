from pathlib import Path
import base64, json, hashlib, zipfile, subprocess, shutil
from PIL import Image
root=Path(__file__).parent
repo=Path('/home/user/repo')
commit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=repo,text=True).strip()
base='65fdce4c4fc100971a8787e2dc1a5cea48bc0742'
assert commit!=base
views=[]
for key,label in [('action','Заявка и контакты'),('reviews','Отзывы'),('proof','Примеры работ'),('work-dialog','Окно работы'),('404','Страница 404'),('privacy','Политика')]:
 for width in [1440,390]: views.append((root/f'evidence/{key}-{width}.jpg',f'{label} · '+('desktop' if width==1440 else 'mobile'),width==390))
for key,label in [('home','Главная'),('smart','Управляемый свет'),('privacy','Документы')]:
 views.append((repo/f'public/brand/v7/social/{key}.jpg',f'Превью ссылки · {label}',False))
figures=[]
for i,(p,label,mobile) in enumerate(views):
 w,h=Image.open(p).size;data=base64.b64encode(p.read_bytes()).decode()
 figures.append(f'<figure class="'+('mobile' if mobile else 'desktop')+'"'+(' hidden' if i else '')+f'><img width="{w}" height="{h}" alt="{label}" src="data:image/jpeg;base64,{data}"><figcaption>{label}</figcaption></figure>')
icons=''.join(f'<div><img width="{size}" height="{size}" alt="Значок {size} пикселей" src="data:image/png;base64,{base64.b64encode((repo/f"public/brand/v7/icon-{size}.png").read_bytes()).decode()}"><span>{size} px</span></div>' for size in [16,32,48])
html='''<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ПОТОЛКОВО · полировка бренда</title><style>*{box-sizing:border-box}body{margin:0;background:#f6f5ef;color:#173c36;font-family:Arial,sans-serif}main{max-width:1460px;margin:auto;padding:30px clamp(16px,4vw,56px)}header{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #cbd3c8;padding-bottom:22px;gap:20px}.brand{font-size:25px;font-weight:bold;letter-spacing:-1px}.stamp{font-size:12px;line-height:1.7;text-align:right;color:#53675e}.eyebrow{font-size:11px;letter-spacing:.16em;text-transform:uppercase;margin:35px 0 18px}h1{font-size:clamp(35px,5vw,65px);font-weight:500;letter-spacing:-.04em;line-height:1.08;margin:0 0 25px}.lead{max-width:830px;color:#53675e;font-size:16px;line-height:1.85}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:22px;margin:30px 0}.stat{padding-top:17px;border-top:1px solid #b6c3b4}.stat strong{font-size:30px;font-weight:500;display:block}.stat span{display:block;font-size:12px;color:#53675e;line-height:1.65;margin-top:8px}.controls{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;margin:34px 0 18px}select{font:inherit;color:inherit;background:#f6f5ef;border:1px solid #829779;border-radius:4px;min-height:46px;padding:10px 14px;max-width:100%;cursor:pointer}label{display:flex;align-items:center;gap:12px;font-size:13px}select:focus-visible{outline:3px solid #63854e;outline-offset:4px}.small{font-size:12px;line-height:1.75;color:#53675e}.viewer{border:1px solid #cbd3c8;background:#e8ecdf;padding:10px;border-radius:5px}figure{margin:0}figure[hidden]{display:none}figure.mobile{max-width:390px;margin:auto}.viewer img{display:block;width:100%;height:auto;border-radius:4px}figcaption{font-size:12px;color:#53675e;text-align:center;padding-top:11px}.columns{display:grid;grid-template-columns:1fr 1fr;gap:45px;margin:34px 0}h2{font-size:27px;font-weight:500;letter-spacing:-.025em;line-height:1.2;margin:0 0 18px}li{font-size:14px;line-height:1.8;margin:10px 0}.icons{display:flex;align-items:end;gap:35px;margin:28px 0}.icons div{display:flex;flex-direction:column;gap:15px;align-items:center}.icons span{font-size:12px;color:#53675e}.note{background:#173c36;color:#f6f5ef;padding:27px;border-radius:5px;line-height:1.85;font-size:14px}.note h2{color:#d7ed89;font-size:25px}.note p{margin-bottom:0;color:#d2decf}footer{border-top:1px solid #cbd3c8;margin-top:28px;padding-top:20px;font-size:12px;line-height:1.8;color:#53675e}@media(max-width:640px){.stats{grid-template-columns:1fr 1fr}.columns{grid-template-columns:1fr;gap:30px}.viewer{padding:6px}label{flex-direction:column;align-items:start}.controls{align-items:start}.note{padding:22px}}</style></head><body><main><header><div class="brand">ПОТОЛКОВО</div><div class="stamp">Редизайн / этап 06<br>14 октября 2026</div></header><p class="eyebrow">Сквозная полировка и цифровая айдентика</p><h1>Бренд —<br>в каждой детали.</h1><p class="lead">Форма, отзывы, примеры работ и вспомогательные страницы теперь говорят на одном визуальном языке. Добавлены фирменные иконки, локальный шрифт и отдельные обложки ссылок для всех публичных направлений.</p><div class="stats"><div class="stat"><strong>14</strong><span>фирменных превью ссылок<br>1200×630 · 21–71 КБ</span></div><div class="stat"><strong>6</strong><span>размеров PNG-значка<br>плюс SVG и favicon ICO</span></div><div class="stat"><strong>258</strong><span>E2E passed · 12 skipped<br>0 failed / 0 flaky</span></div><div class="stat"><strong>1119</strong><span>unit passed<br>53 DB-теста пропущены</span></div></div><div class="controls"><label>Посмотреть<select id="view-choice">'''
html+=''.join(f'<option value="{i}">{label}</option>' for i,(_,label,_) in enumerate(views))
html+='</select></label><span class="small">Скриншоты действующего проекта</span></div><div class="viewer">'+''.join(figures)+'''</div><p class="small">В обзоре переключаются скриншоты. Срезы отдельных секций сняты без плавающей шапки и mobile CTA — на самом сайте они работают. Все изображения встроены; сеть для просмотра не нужна.</p><div class="columns"><section><h2>Узнаваемость<br>за пределами hero.</h2>'''+f'<div class="icons">{icons}</div>'+'''<ul><li>Один цифровой знак для вкладки браузера, закладок и домашнего экрана. ICO содержит кадры 16/32/48 px, Apple touch — 180 px.</li><li>14 JPEG-обложек: главная, решения, 9 услуг, компания, управляемый свет и документы. Иллюстрации подписаны, не выданы за объекты.</li><li>Локальный variable Inter с кириллицей, ₽ и м². Лицензия SIL OFL 1.1 и происхождение сохранены; сборка больше не скачивает шрифт из Google.</li></ul></section><section><h2>Меньше визуального шума.<br>Больше ясности.</h2><ul><li>Перестроены форма на главной и контакты: на мобильном форма предшествует дополнительным каналам связи.</li><li>Отзывы имеют явную атрибуцию профиля основателя. Все цитаты сохранены; данные профиля отделены от числа публикаций на сайте.</li><li>Окно работы удерживает и возвращает клавиатурный фокус. Исправлены контраст и доступные названия стрелок.</li><li>404, ошибка и политика получили фирменное оформление. Юридические абзацы и версия согласия не менялись.</li></ul></section></div><div class="note"><h2>Что осталось вне этого этапа</h2><p>Это не полный брендбук и не production-релиз. Не закрыты подтверждение кейсов и прав на фотографии, печатные носители, юридическая модель, EKS/SMART/BOM, server quote, security и сохранение автономной корзины после reload. Реальные устройства, screen reader, 200% zoom, DB и доставка не проверялись.</p></div><footer>'''+f'<b>Коммит {commit[:7]}</b> · feat/company-rebrand-v7 · push и production-деплой не выполнялись.'+'''<br>Build, TypeScript, guards, 8 flow-тестов и JS budget пройдены. В 12 новых axe-проверках нарушений нет. Lint: 0 ошибок / 18 прежних предупреждений.<br>Пакет POTOLKOVO-R7-POLISH-HANDOFF.zip применяется поверх 65fdce4. Команды и ограничения — в README-HANDOFF.md.</footer></main><script>document.getElementById('view-choice').addEventListener('change',function(){document.querySelectorAll('figure').forEach((f,i)=>f.hidden=String(i)!==this.value)});</script></body></html>'''
(root/'POTOLKOVO-POLISH-OVERVIEW.html').write_text(html)
readme=f'''# ПОТОЛКОВО · R7-POLISH

Коммит: `{commit}`. База: `{base}`. Ветка `feat/company-rebrand-v7`.
14 октября 2026. **Инкрементальный пакет, не полный клон.**

## Состав

- `POTOLKOVO-POLISH-OVERVIEW.html` — автономный обзор: 12 desktop/mobile-снимков и 3 примера social cards.
- `POTOLKOVO-R7-POLISH.bundle` — код, иконки, шрифты с лицензией, все 14 обложек, тесты и отчёт.
- `R7-POLISH.md` — фактический объём и ограничения.
- `evidence/` — финальные логи и summary; `SHA256SUMS.txt` — контрольные суммы.

## Применение

В репозитории уже должен существовать 65fdce4 (компания и управляемый свет). Сначала сохраните собственные незакоммиченные изменения.

```bash
git status --short
git cat-file -t {base}
git bundle verify /path/to/POTOLKOVO-R7-POLISH.bundle
git fetch /path/to/POTOLKOVO-R7-POLISH.bundle refs/heads/feat/company-rebrand-v7
git switch -c review/polish-r7 FETCH_HEAD
npm ci
```

Замените `/path/to/` реальным путём. Если имя ветки занято, выберите другое. Последовательность предыдущих пакетов: калькулятор c06af58 → каталог e7d3244 → услуги e0c612e → редакционные страницы 65fdce4 → этот пакет.

## Безопасный preview

```bash
RAYON_NUM_THREADS=1 NODE_OPTIONS=--max-old-space-size=1024 NEXT_PUBLIC_PREVIEW_MODE=1 LEAD_API_ENABLED=0 TELEGRAM_LEADS_ENABLED=0 CATALOG_LIVE_FEED2_ENABLED=0 npm run build
NEXT_PUBLIC_PREVIEW_MODE=1 LEAD_API_ENABLED=0 TELEGRAM_LEADS_ENABLED=0 CATALOG_LIVE_FEED2_ENABLED=0 npm run start -- --hostname 0.0.0.0 --port 3100
```

Откройте `/#action`, `/#reviews`, `/#proof`, `/privacy` и любой отсутствующий адрес для 404. Обложки — `public/brand/v7/social`. `npm run build:brand-identity` собирает цифровые assets локально; Python для обычной сборки не нужен.

## Фактические проверки

258 E2E passed / 12 skipped / 0 failed / 0 flaky; 1119 unit passed / 53 DB skipped; 8 flow passed. Build/TypeScript/guards/bundle пройдены. Lint: 0 ошибок / 18 прежних warnings. Новые 12 axe-проверок без нарушений. 14 OG/Twitter назначений и assets проверены в обоих браузерных проектах. 404 отдаёт 404/noindex.

Error-screen проверен unit-render/reset, без намеренного падения production-приложения. Реальные устройства, screen reader, 200% zoom, внешние social caches, DB и доставка не проверены. Gitleaks отсутствовал.

## Ограничения

Тарифы, формулы, API, пресеты, storage и корзина не переписаны; reload автономной корзины остаётся открытым. В ActionForm изменена только одна корпоративная формулировка. Юридические абзацы и цитаты сохранены. Данные профиля Avito статические, не live-feed. Рабочий знак не равен проверенному товарному знаку или полному печатному брендбуку.

Сохраняются release-gates v6/v7: EKS/SMART/BOM, server quote, право продажи оборудования и договоры партнёров, безопасность, подтверждённые кейсы и реальные интеграции. Push и production-деплой не выполнены, новый ключ ожидается от владельца.

Откат только этой итерации: `git revert {commit}`. Очистка временных файлов не затрагивает исходники, Git или финальные архивы.
'''
(root/'README-HANDOFF.md').write_text(readme)
shutil.copyfile(repo/'docs/reports/R7-POLISH.md',root/'R7-POLISH.md')
files=[root/name for name in ['POTOLKOVO-POLISH-OVERVIEW.html','POTOLKOVO-R7-POLISH.bundle','README-HANDOFF.md','R7-POLISH.md']]
files += [root/'evidence'/name for name in ['build.log','unit.log','e2e.log','lint.log','flow.log','bundle.log','flaky.log','identity.log','e2e-summary.json']]
(root/'SHA256SUMS.txt').write_text('\n'.join(f'{hashlib.sha256(p.read_bytes()).hexdigest()}  {p.relative_to(root)}' for p in files)+'\n')
archive=root/'POTOLKOVO-R7-POLISH-HANDOFF.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
 for p in files+[root/'SHA256SUMS.txt']:z.write(p,p.relative_to(root))
with zipfile.ZipFile(archive) as z:
 assert z.testzip() is None
 for p in files:assert z.read(str(p.relative_to(root)))==p.read_bytes()
 print('Verified ZIP:',len(z.namelist()),'entries; commit',commit)
p=Path('/home/user/implementation/STATE.json');state=json.loads(p.read_text());state.pop('inProgress',None);state.update(commit=commit,previous=base,stage='brand-polish-and-digital-identity',clean=True,pushed=False,deployed=False,unitPassed=1119,e2ePassed=258,e2eSkipped=12,e2eFailed=0,e2eFlaky=0,lintErrors=0,lintWarnings=18,polishAxeChecks=12,handoff=str(archive),previewProcess=None,previewStatus='Production preview can be started from the successful safe build.');p.write_text(json.dumps(state,ensure_ascii=False,indent=2)+'\n')
