# Backend календаря звонков

NestJS 12.3.2, TypeScript 6.0.3, ESM.

## Запуск

Выполняйте команды из корня репозитория после установки окружения по корневому README:

```sh
mise run setup
mise run dev:backend
```

Сервер слушает `127.0.0.1:3000`. Для другого порта: `PORT=3001 mise run dev:backend`. Для остановки нажмите `Ctrl+C`.

Сборка:

```sh
mise run build:backend
```

Сборка и запуск production-версии:

```sh
mise run start:backend
```

## Контракт

```sh
curl http://127.0.0.1:3000/api/health
```

Ответ: HTTP 200, `Content-Type: application/json`, тело `{"status":"ok"}`.

Контракт хранится в `specs/main.tsp`. Типы методов контроллеров и ответов генерируются из него и доступны в
workspace-пакете `@calendar/api-sdk`.

## Проверки

```sh
mise run typecheck
mise run test
mise run verify:contract
```

`typecheck` включает backend и остальные TypeScript-пакеты. `test` собирает оба приложения и проверяет соединение
frontend с backend в Chromium, включая соответствие HTTP-ответа OpenAPI-схеме. `verify:contract` проверяет генерацию,
компиляцию заготовки контроллера и SDK с тестовым HTTP-сервером.
