# Проверка цепочки генерации API

Проверка цепочки TypeSpec → OpenAPI → TypeScript SDK и типов методов NestJS. Контракт описывает `GET /api/health`, возвращающий HTTP 200 и JSON `{"status":"ok"}`.

Инструменты закреплены в корневом `mise.toml`, прямые зависимости — точными версиями в манифестах пакетов, транзитивные — в общем `pnpm-lock.yaml`.

## Запуск

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

Проверка использует свободный локальный порт на `127.0.0.1` и сама закрывает сервер.

## Расположение файлов

Контракт и настройки TypeSpec находятся в `specs/`, настройки SDK — в `packages/api-sdk/`. Этот пакет содержит заготовку контроллера и проверочный сценарий.

`specs/generated/`, `packages/api-sdk/src/generated/` и каталоги `dist/` создаются командами и не коммитятся. Генерируемые файлы не редактируются вручную.

## Ограничения

- Hey API `0.99.0` несовместим с compiler API TypeScript 7. В проекте закреплён TypeScript `6.0.3`.
- Плагин NestJS имеет статус beta и документирован для NestJS 11. Совместимость с NestJS 12 проверяется компиляцией заготовки контроллера.
- Плагин генерирует типы методов; HTTP-маршруты и runtime-валидация запросов реализуются вручную по контракту.

## Официальные источники

- [TypeSpec: getting started](https://typespec.io/docs/getting-started/getting-started-rest/01-setup-basic-syntax/).
- [TypeSpec: OpenAPI emitter](https://typespec.io/docs/emitters/openapi3/reference/emitter/).
- [Hey API: getting started](https://heyapi.dev/docs/openapi/typescript/get-started).
- [Hey API: Fetch client](https://heyapi.dev/docs/openapi/typescript/clients/fetch).
- [Hey API: NestJS plugin](https://heyapi.dev/docs/openapi/typescript/plugins/nest).
- [Node.js: статус LTS-релизов](https://nodejs.org/en/about/previous-releases).
