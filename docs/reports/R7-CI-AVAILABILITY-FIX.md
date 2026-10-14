# R7 · исправление CI: срок запасного календаря

Дата: 2026-10-14. PR #43, ветка `feat/company-rebrand-v7`.

## Причина

В GitHub Actions run `38570504455` job `115874130494` упал один тест:
`tests/availability-db.test.ts:76`, `expected null not to be null`.

Тест с пустой PostgreSQL ожидал непустую подпись запасного календаря независимо от даты запуска. `content/availability.ts` действителен до 2026-10-05; после срока production-код правильно возвращает `null`, чтобы не обещать устаревшие окна. Локальные предыдущие прогоны без `TEST_DATABASE_URL` пропускали этот интеграционный сценарий.

## Изменение

- Вместо проверки с текущим временем — три интеграционных сценария: за 1 мс до срока, на границе и через 1 мс после.
- Время передаётся через существующий `readAvailabilitySnapshot({ now })`; PostgreSQL, чтение таблиц и построение снимка остаются настоящими, без mock-хранилища или fake timers.
- Проверяются точная подпись / `null`, источник, configured, validUntil, slots, updatedAt и generatedAt.
- Production-код, реальные даты, workflow и правила пропуска тестов не менялись.

## Локальная проверка

Node 20.20.2, PostgreSQL 17.11, отдельная тестовая БД, схема применена `drizzle-kit push --force`.

- До исправления ошибка воспроизведена: 1 failed / 9 passed в availability-db.
- После: **1186 passed, 0 failed, 0 skipped**, 93 файла, полный Vitest с `TEST_DATABASE_URL` и `CRON_SECRET=ci-test-secret`.
- Число больше прежних 1172: включились ранее пропущенные DB-сценарии, 12 условно определяемых тестов PgLeadStore и два новых граничных сценария.
- Отдельно availability-db: 12 passed в каждой зоне UTC, Europe/Moscow, Pacific/Kiritimati, America/Los_Angeles.
- ESLint: 0 errors / 18 прежних warnings; TypeScript: passed; test:flow: 8 passed.

Это не проверка боевой БД или реальной доставки заявок. Build и E2E для этого test-only исправления должны дополнительно пройти в GitHub Actions; локальный результат не заменяет статус CI. Известные release-gates v6/v7 и предупреждения зависимостей не устранены этой правкой.

Merge и production-деплой остаются за владельцем.
