# Проверки качества

Команды выполняются из корня репозитория.

Все проверки: `mise run check`. Для работы нужны Chromium (`mise run setup:browsers`) и доступ к сети для OSV.
`mise run setup` устанавливает зависимости, Chromium и Git-хуки hk. Для отдельной установки хуков:
`mise exec -- hk install --mise`.

Перед коммитом hk запускает `mise run check`, затем проверяет сообщение по Conventional Commits.
GitHub Actions запускает `mise run setup` и `mise run check` на каждый push через `.github/workflows/check.yml`.

| Команда | Проверка |
| --- | --- |
| `mise run lint` | Все перечисленные ниже задачи `lint:*` |
| `mise run lint:code` | Oxlint: ошибки TS/JS, React и доступности |
| `mise run lint:css` | Stylelint: CSS с синтаксисом Tailwind |
| `mise run lint:format` | Oxfmt: форматирование исходников и конфигурации |
| `mise run lint:typespec` | Форматирование TypeSpec |
| `mise run lint:unused` | Knip: неиспользуемые файлы, экспорты и зависимости |
| `mise run lint:architecture` | Dependency cruiser: циклы импортов и границы пакетов |
| `mise run lint:versions` | Syncpack: согласованность и точные версии зависимостей |
| `mise run lint:commits` | Commitlint: Conventional Commits в истории разработки |
| `mise run lint:openapi` | Vacuum: ошибки и предупреждения OpenAPI |
| `mise run lint:generated` | Сравнение OpenAPI и SDK с независимой повторной генерацией |
| `mise run lint:markdown` | Rumdl: Markdown в каталогах приложений, пакетов и инструментов |
| `mise run lint:workflows` | Jactionlint: workflow проверок проекта |
| `mise run lint:agents` | Agnix: инструкции в AGENTS.md |
| `mise run scan:secrets` | Betterleaks: секреты в файлах с редактированием значений в отчёте |
| `mise run scan:vulnerabilities` | OSV Scanner: уязвимости зависимостей из lockfile; нужен доступ к сети |

Для обновления сгенерированных файлов используйте `mise run generate`, для проверки типов — `mise run typecheck`.

`lint:commits` проверяет коммиты. Для проверки отдельного сообщения:
`printf '%s\n' 'feat: описание' | mise exec -- pnpm exec commitlint`.
