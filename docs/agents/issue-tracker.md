# Трекер задач

Задачи, спецификации и карты решений хранятся в GitHub Issues:
<https://github.com/samurswife/ai-for-developers-project-386/issues>

Используй GitHub CLI из корня репозитория.
Перед первой записью проверь целевой репозиторий:
`gh repo view --json nameWithOwner`.
Ожидаемый результат: `samurswife/ai-for-developers-project-386`.

- Прочитать задачу: `gh issue view <number> --comments`.
- Найти задачи: `gh issue list`.
- Создать задачу: `gh issue create --title "..." --body-file <file>`.
- Для многострочного текста используй UTF-8 файл с настоящими переносами строк.
- Связи между задачами оформляй через GitHub sub-issues и native dependencies.
- Если связи недоступны, используй `Part of #<number>` и `Blocked by: #<number>`.
- При публикации спецификации создавай GitHub Issue.
- Перед закрытием задачи опубликуй результат и выполненные проверки.

PRs as a request surface: no.

Для wayfinder используй метки `wayfinder:map` и `wayfinder:<type>`,
где type — research, prototype, grilling или task.
Карта содержит ссылки на дочерние задачи и принятые решения.
