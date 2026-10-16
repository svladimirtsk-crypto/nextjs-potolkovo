# ПОТОЛКОВО · передача первой реализации R7

Дата: 14 октября 2026.

- Репозиторий: https://github.com/svladimirtsk-crypto/nextjs-potolkovo
- Ветка: `feat/company-rebrand-v7`
- Коммит: `cc6a1235eae8c05cbc985ed5ae2f0c6791088134`
- База: `7f1b5cf8ec686b06d3b36e2991efd08faeb9426b`
- Рабочее дерево чистое. **Push и production-деплой не выполнялись.**
- Запущен отдельный live preview на порту 3100 с отключёнными реальными лидами/Telegram/Метрикой и snapshot-каталогом. Сервер предпросмотра не является постоянным хостингом.

## Файлы пакета

- `POTOLKOVO-R7-OVERVIEW.html` — обзор с фактическими снимками реализации, а не концепт-макета.
- `POTOLKOVO-R7.bundle` — перенос ветки с историей одного нового коммита. Bundle проверен; требует базовый коммит выше.
- `POTOLKOVO-R7.patch` — альтернативный binary patch всех изменений относительно базы. Не применять поверх уже импортированной ветки.
- `R7-IMPLEMENTATION.md` — подробный объём работ, QA и ограничения.
- `IMAGE-REPLACEMENT.md` — как заменить AI-визуализации собственными оригиналами.
- `evidence/` — финальные отчёты build/unit/E2E/axe/bundle. Ветки и assets полностью включены в bundle/patch.

## Импорт в обычный clone

```bash
git clone https://github.com/svladimirtsk-crypto/nextjs-potolkovo.git
cd nextjs-potolkovo
git bundle verify /путь/к/POTOLKOVO-R7.bundle
git fetch /путь/к/POTOLKOVO-R7.bundle refs/heads/feat/company-rebrand-v7:refs/heads/feat/company-rebrand-v7
git switch feat/company-rebrand-v7
npm ci
```

Если ветка с таким именем уже существует, сначала сравнить её коммиты; не применять force/reset без сохранения своих изменений.

## Preview

```bash
NEXT_PUBLIC_PREVIEW_MODE=1 LEAD_API_ENABLED=0 TELEGRAM_LEADS_ENABLED=0 CATALOG_LIVE_FEED2_ENABLED=0 npm run build
NEXT_PUBLIC_PREVIEW_MODE=1 LEAD_API_ENABLED=0 TELEGRAM_LEADS_ENABLED=0 CATALOG_LIVE_FEED2_ENABLED=0 npm run start -- --hostname 0.0.0.0 --port 3100
```

Метрика отключается при сборке, lead/Telegram — отдельными серверными флагами. Это не универсальный коммерческий kill switch. Prebuild генерирует `data/page-dates.json` по Git-истории; после нового коммита дата изменённых страниц может закономерно обновиться.

## Push

После настройки безопасной локальной аутентификации с доступом к этому репозиторию:

```bash
git push -u origin feat/company-rebrand-v7
```

PAT не отправлять в чат, не помещать в URL remote, команду/лог или коммит. Использовать штатный менеджер учётных данных либо безопасную настройку окружения. Не делать force push. После push — PR и согласование; не сливать и не деплоить автоматически.

## Примечание о рабочем окружении Arena

Чтобы сохранить проект в ограниченном snapshot, Git-метаданные заменены эквивалентным partial clone с полной историей и фильтром blob:none; базовый HEAD и список изменённых файлов проверены до/после. Рабочие файлы не удалялись. До замены исходные метаданные сохранены во временном cache; переносимые bundle/patch находятся вне cache.

Если платформа не сохранила `.git/config`, для продолжения работы с partial clone восстановить настройки публичного origin, либо использовать обычный clone + bundle (предпочтительно для независимой передачи):

```bash
git remote add origin https://github.com/svladimirtsk-crypto/nextjs-potolkovo.git
# Если origin уже есть — вместо add используйте remote set-url.
git config remote.origin.promisor true
git config remote.origin.partialclonefilter blob:none
```

Полные критерии выпуска v6/v7, DB-интеграция, реальные устройства и screen reader, данные EKS/SMART, юридическая модель и обновление безопасности не закрываются новым дизайном. Подробности — в отчёте.
