# Правила проекта

## Команды

Выполнять из корня репозитория:

- `mise run setup` — установить зависимости, Chromium и Git-хуки.
- `mise run dev:backend` и `mise run dev:frontend` — запустить приложения в отдельных терминалах.
- `mise daemons start frontend` — запустить оба приложения в фоне; `mise daemons stop` — остановить.
- `mise run generate` — обновить OpenAPI, SDK и типы контроллеров.
- `mise run test` — собрать приложения и выполнить браузерный дымовой тест.
- `mise run lint` — запустить линтеры; `mise run typecheck` — проверить типы.
- `mise run check` — выполнить все проверки, как в GitHub Actions и pre-commit.

## Устройство проекта

- `apps/backend` — NestJS; `apps/frontend` — React, Vite и shadcn/ui.
- `specs/main.tsp` — контракт API; `packages/api-sdk` — генерация клиентского SDK и типов NestJS.
- `tools/smoke-tests` — браузерный тест; `tools/contract-probe` — проверка цепочки генерации.

## Правила работы

- Использовать Conventional Commits: `feat:`, `fix:`, `docs:`, `test:`, `chore:`, `ci:` и другие допустимые типы.
- Каждый коммит реализации должен ссылаться на соответствующий тикет, например `feat: запись на свободный слот (#12)`.
- Изменения API начинать с TypeSpec; сгенерированные файлы обновлять через `mise run generate`.
- Генерируемые пути: `specs/generated/` — OpenAPI; `packages/api-sdk/src/generated/` — клиентский SDK и серверные типы NestJS.
  Не редактировать их вручную. Артефакты не коммитятся; CI генерирует их из чистого состояния перед сборкой и тестами.
- В README оставлять только полезную будущим разработчикам информацию:
  без рабочих заметок, планов и объяснений того, что понятно из кода.
- Не изменять `.github/workflows/hexlet-check.yml`.

## Agent skills

### Issue tracker

Перед работой с задачами и спецификациями прочитай
`docs/agents/issue-tracker.md`. Трекер — GitHub Issues проекта.

### Triage labels

Перед разбором задач прочитай `docs/agents/triage-labels.md`.

### Domain docs

Перед изучением предметной области прочитай `docs/agents/domain.md`.
Используем единый словарь и общие ADR.
