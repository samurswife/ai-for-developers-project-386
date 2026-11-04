# Проверки качества

Команды запускаются из корня репозитория через mise. Версии CLI закреплены в `mise.toml` и `mise.lock`,
версии npm-пакетов — в манифестах и `pnpm-lock.yaml`.

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
| `mise run scan:secrets` | Betterleaks: секреты в файлах с редактированием значений в отчёте |
| `mise run scan:vulnerabilities` | OSV Scanner: уязвимости зависимостей из lockfile; нужен доступ к сети |

Сканеры запускаются отдельными командами. При находках они возвращают ненулевой код завершения.
`scan:secrets` проверяет рабочие файлы, без истории Git и установленных или сгенерированных зависимостей.

Для обновления сгенерированных файлов используйте `mise run generate`, для проверки типов — `mise run typecheck`.

`lint:commits` проверяет коммиты. Для проверки отдельного сообщения:
`printf '%s\n' 'feat: описание' | mise exec -- pnpm exec commitlint`.

Jactionlint и Agnix закреплены в mise для проверки GitHub Actions и инструкций агента соответственно.
Их можно вызвать через `mise exec -- jactionlint --strict-exit <workflow.yml>` и
`mise exec -- agnix --strict --target codex <AGENTS.md>`.
