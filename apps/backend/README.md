# Backend календаря звонков

NestJS 12.3.2, TypeScript 6.0.3, ESM.

## Запуск

Выполняйте команды из корня репозитория после установки окружения по корневому README:

```sh
mise run setup
mise run dev:backend
```

Сервер слушает `127.0.0.1:3000`. Для другого порта: `PORT=3001 mise run dev:backend`. Для остановки нажмите `Ctrl+C`.

Production-сборка и запуск:

```sh
mise run build:backend
mise run start:backend
```

`start:backend` самостоятельно выполняет сборку зависимостей и backend перед запуском. Поэтому для обычного production-запуска достаточно этой команды.

## Контракт

```sh
curl http://127.0.0.1:3000/api/health
```

Ответ: HTTP 200, `Content-Type: application/json`, тело `{"status":"ok"}`.

Контракт хранится в `specs/main.tsp`. `HealthController` реализует сгенерированный `HealthControllerMethods`, ответ типизирован сгенерированным `GetHealthResponse`. Оба типа импортируются из workspace-пакета `@calendar/api-sdk`; runtime-импорт SDK в backend не требуется.

## Проверки

```sh
mise run typecheck
mise run verify:contract
```

`typecheck` включает backend и остальные TypeScript-пакеты. `verify:contract` проверяет генерацию, компиляцию заготовки контроллера и SDK с временным HTTP-сервером.

## Устройство

- `src/main.ts` запускает приложение и подключает корректное завершение по сигналам.
- `src/app.module.ts` регистрирует контроллер.
- `src/health.controller.ts` отвечает на технический запрос запуска.
