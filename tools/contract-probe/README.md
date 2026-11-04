# Проверка цепочки генерации API

Техническая проба первого шага каркаса, проверенная 4 ноября 2026 года. После второго шага использует общий pnpm workspace и корневой lockfile. Единственная операция контракта: `GET /api/health`, HTTP 200, JSON `{"status":"ok"}`.

## Проверенные версии

| Инструмент | Версия |
| --- | --- |
| mise | 2026.10.25 |
| Node.js | 26.13.0 LTS |
| pnpm | 12.16.1 |
| TypeScript | 6.0.3 |
| @typespec/compiler, http, openapi, openapi3 | 1.17.0 |
| @hey-api/openapi-ts | 0.99.0 |
| @nestjs/common | 12.3.2 |
| @types/node | 26.6.6 |
| reflect-metadata | 0.2.2 |
| rxjs | 7.8.2 |

Инструменты закреплены в корневом `mise.toml`, прямые зависимости — точными версиями в манифестах пакетов, транзитивные — в общем `pnpm-lock.yaml`.

## Воспроизведение

Из корня учебного репозитория:

```sh
mise trust
mise --locked install
mise run setup
mise run verify:contract
```

Для отдельной проверки типов: `mise run typecheck`.

## Что проверяется

1. Контракт из `specs/main.tsp` компилируется в OpenAPI 3.1.0; предупреждения TypeSpec считаются ошибками.
2. В пакете `@calendar/api-sdk` из OpenAPI генерируются TypeScript-типы, Fetch SDK и сигнатуры методов контроллера NestJS.
3. SDK собирается с декларациями типов. Заготовка контроллера импортирует типы из workspace-пакета через его публичные экспорты и компилируется с декораторами NestJS в strict-режиме. Проверка типов зависимостей включена.
4. Проверяются путь, operationId, схема ответа и обязательное поле `status` в OpenAPI.
5. SDK через публичный экспорт пакета делает настоящий HTTP-запрос к временному Node.js-серверу. Проверяются метод GET, путь `/api/health`, код 200 и тело ответа.

Проверка использует свободный локальный порт на `127.0.0.1` и сама закрывает сервер. В среде агента может потребоваться разрешение на открытие локального порта.

## Расположение файлов

Контракт и настройки TypeSpec находятся в `specs/`, настройки SDK — в `packages/api-sdk/`. В этой пробе остаются только заготовка контроллера, проверочный сценарий и их зависимости.

`specs/generated/`, `packages/api-sdk/src/generated/` и каталоги `dist/` создаются командами и не коммитятся. Генерируемые файлы не редактируются вручную. Проверка актуальности сохраняемых артефактов будет подключена вместе с общими проверками на шестом шаге.

## Результаты и ограничения

- Генерация, strict-компиляция и HTTP-вызов SDK прошли на первом шаге и повторно после переноса в workspace.
- На первом шаге временная замена ответа контроллера на `{"status":"broken"}` привела к коду завершения 2 и ошибке TS2322. Корректный ответ восстановлен.
- TypeScript 7.0.2 проверен и отклонён: Hey API 0.99.0 падает при обращении к `ts.SyntaxKind.AnyKeyword`. Для этой цепочки выбран TypeScript 6.0.3.
- Плагин NestJS имеет статус beta и документирован для NestJS 11. Его сгенерированные сигнатуры проверены с `@nestjs/common` 12.3.2. Это проверка типов; запуск полного NestJS-приложения проверяется при создании backend.
- Плагин не генерирует HTTP-маршруты и runtime-валидацию запросов. Контроллеры реализуются вручную по контракту; соответствие контракту проверяется тестами.
- Временный HTTP-сервер нужен для проверки транспорта SDK. Backend и frontend создаются на следующих шагах.

## Официальные источники

- [TypeSpec: getting started](https://typespec.io/docs/getting-started/getting-started-rest/01-setup-basic-syntax/).
- [TypeSpec: OpenAPI emitter](https://typespec.io/docs/emitters/openapi3/reference/emitter/).
- [Hey API: getting started](https://heyapi.dev/docs/openapi/typescript/get-started).
- [Hey API: Fetch client](https://heyapi.dev/docs/openapi/typescript/clients/fetch).
- [Hey API: NestJS plugin](https://heyapi.dev/docs/openapi/typescript/plugins/nest).
- [Node.js: статус LTS-релизов](https://nodejs.org/en/about/previous-releases).

Версии пакетов и требования к окружению дополнительно проверены по npm registry.
