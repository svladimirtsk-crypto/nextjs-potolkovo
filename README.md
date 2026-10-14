# ПОТОЛКОВО · сайт компании

Компания потолков и освещения, сегмент средний+. Основатель + привлечённые мастера / партнёрские бригады.

## Текущая работа

**Ветка: `feat/company-rebrand-v7-preview`. Main автоматически разворачивается в production.** Без отдельного разрешения выпуска не открывать PR в main, не мержить и не пушить туда. После отката PR #43 работа продолжается только в preview.

- [Единый индекс документации v8](docs/current/README.md)
- [Что сделано и что осталось](docs/current/STATUS.md)
- [Действующее продолжение PT-020…049 из main](docs/current/PT-CONTINUATION-TZ.md)
- [ТЗ на завершение бренда и дизайна](docs/current/BRAND-REDESIGN-TZ-V8.md)
- [Техническое ТЗ и допуски](docs/current/TECHNICAL-TZ-V8.md)
- [Клиентские материалы и подтверждение проектов](docs/current/CLIENT-MATERIALS.md)
- [Эксплуатация, проверки, реестр пропусков и выпуск](docs/current/RELEASE-OPERATIONS.md)

В этой же ветке продолжается техническая очередь из main: PT-020 сохранена, следующая кодовая задача — PT-021. Основные страницы и галерея уже реализованы. Не начинать редизайн с нуля и не считать открытые инженерные задачи автоматически закрытыми новым UI.

## Безопасный preview

```bash
npm ci
NEXT_PUBLIC_PREVIEW_MODE=1 LEAD_API_ENABLED=0 TELEGRAM_LEADS_ENABLED=0 CATALOG_LIVE_FEED2_ENABLED=0 npm run build
LEAD_API_ENABLED=0 TELEGRAM_LEADS_ENABLED=0 CATALOG_LIVE_FEED2_ENABLED=0 npm run start -- --hostname 0.0.0.0 --port 3100
```

Не использовать production-БД/секреты и реальные доставки для тестов. Preview-флаг задавать при build, а серверные ограничения — и при запуске. Список окружения: [.env.example](.env.example).

## Проверки

`npm run lint`, `npx tsc --noEmit`, `npm run test`, `npm run test:flow`, `npm run validate:catalog`, build, `npm run check:bundle`, Playwright и строгий flaky gate. Полный DB-прогон требует отдельной PostgreSQL через `TEST_DATABASE_URL`; пропуски не равны успешной интеграционной проверке. Команды и причины skips — в runbook выше.

GitHub CI не запускается по обычному push текущей preview-ветки. Последняя зафиксированная полная локальная проверка продукта: 1211 unit с БД; 270 E2E passed / 12 skipped / 0 failed / 0 flaky. Это снимок на `3dd20cd`, не автоматический результат будущих изменений.

## Исходники

`app/`, `components/`, `content/` — интерфейс; `lib/` — бизнес-логика; `db/` — схема; `tests/`, `e2e/` — проверки; `design/brand/v7/` — действующие бренд-ассеты и лицензии (имя папки историческое, переименовывать ради номера ТЗ не нужно).

Старые аудиты/ТЗ/поэтапные отчёты больше не являются рабочими документами. Требования перенесены в v8, [карта происхождения](docs/current/LEGACY-MAP.csv) и [манифест очистки](docs/maintenance/DOCS-CLEANUP-V8.json) сохранены. История Git не переписана.
