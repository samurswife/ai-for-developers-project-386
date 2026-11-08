# Релизы приложения

Приложение выпускается целиком через [release-please][release-please]. Конфигурация корня использует стратегию
`simple`: текущая версия хранится в `version.txt` и `.release-please-manifest.json`, начальное значение — `0.0.0`.
Отдельные пакеты workspace не публикуются. Release PR обновляет оба файла версии и создаёт или обновляет `CHANGELOG.md`.

## Подготовка репозитория

Workflow `.github/workflows/release-please.yml` запускается при push в `main` и использует встроенный `GITHUB_TOKEN`.
Новые секреты не нужны. Для версий, тегов и GitHub Releases ему дано `contents: write`, для release PR и его меток —
`pull-requests: write` и `issues: write`. Остальные workflow сохраняют собственные права.

Владелец должен включить **Settings → Actions → General → Workflow permissions → Allow GitHub Actions to create and
approve pull requests**. Проверить состояние можно командой:

```sh
gh api repos/samurswife/ai-for-developers-project-386/actions/permissions/workflow
```

Нужно значение `can_approve_pull_request_reviews: true`. Владелец может включить его через настройки или выполнить:

```sh
gh api --method PUT repos/samurswife/ai-for-developers-project-386/actions/permissions/workflow \
  -F can_approve_pull_request_reviews=true
```

Менять `default_workflow_permissions: read` не требуется: права на запись заданы только в release workflow.
Настройки организации, если они ограничивают создание PR, также должны разрешать эту операцию.

## От изменения до выпуска

1. Сливайте изменения в `main` с заголовками [Conventional Commits][commits]. При squash merge проверьте заголовок
   итогового коммита. `feat:` повышает minor, `fix:` — patch, `!` или `BREAKING CHANGE:` — major;
   `chore:`, `docs:` и другие нерелизные типы сами по себе не создают выпуск.
2. После push release-please создаёт или обновляет один release PR на основе изменений с прошлого релиза.
   До первого релиза анализируется доступная история репозитория. Посмотрите предложенную версию и заметки.
3. Запустите проверки точной release-ветки по инструкции ниже. После каждого обновления release PR запускайте их
   заново; успешный результат предыдущего SHA не проверяет новые изменения.
4. После успешной проверки и ревью слейте release PR в `main`, сохранив его метки release-please.
   Следующий push запускает release-please: он создаёт тег `v<версия>` и GitHub Release с заметками.
   Публикация пакетов и развёртывание приложения отдельными шагами не настроены.

## Проверки release PR

Встроенный `GITHUB_TOKEN` [не запускает workflow по событию push][triggers] для созданной им release-ветки.
`Project checks` поддерживает `workflow_dispatch`, поэтому перед слиянием release PR запустите его явно.
Команды выполняются из клона репозитория пользователем с правом запуска Actions:

```sh
release_pr=123
release_branch=$(gh pr view "$release_pr" --json headRefName --jq .headRefName)
gh workflow run check.yml --ref "$release_branch"
gh run list --workflow check.yml --branch "$release_branch" --event workflow_dispatch --limit 1
```

Замените `123` номером release PR. Возьмите ID созданного запуска из списка и дождитесь результата:

```sh
gh run watch RUN_ID --exit-status
gh run view RUN_ID --json headSha,event,conclusion,url
gh pr view "$release_pr" --json headRefOid
```

Ожидаются `event: workflow_dispatch`, `conclusion: success` и `headSha`, равный текущему `headRefOid` PR.
Проверка включает `mise run check`. При настройке обязательных проверок учитывайте результат на текущем SHA release PR.
Существующий `hexlet-check.yml` сохраняется; его push-запуск для bot-ветки также не запускается автоматически.

## Проверка интеграции после включения

Локальные `mise run lint:workflows` и `mise run check` проверяют конфигурацию и проект, но не подтверждают права
`GITHUB_TOKEN` в GitHub. После попадания конфигурации в `main` и включения настройки владельцем проверьте успешный
запуск `Release please`, создание release PR, его файлы версии и `CHANGELOG.md`. Затем выполните ручные проверки
release-ветки. Создание тега и GitHub Release проверяется только после согласованного слияния release PR.

[release-please]: https://github.com/googleapis/release-please-action
[commits]: https://www.conventionalcommits.org/en/v1.0.0/
[triggers]: https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow
