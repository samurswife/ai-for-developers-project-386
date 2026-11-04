# Frontend календаря звонков

React, TypeScript, Vite, Tailwind CSS и shadcn/ui. Страница проверки соединения обращается к backend через
сгенерированный TypeScript SDK.

## Запуск

Выполняйте команды из корня репозитория после установки окружения по корневому README:

```sh
mise run setup
mise run dev:backend
```

В отдельном терминале:

```sh
mise run dev:frontend
```

Откройте `http://127.0.0.1:5173`. Для остановки сервера нажмите `Ctrl+C`.

## Подключение backend

Vite проксирует `/api` к `http://127.0.0.1:3000` в dev-режиме и локальном preview. Для другого адреса backend:

```sh
BACKEND_URL=http://127.0.0.1:3001 mise run dev:frontend
```

Адрес задаётся в окружении процесса Vite. Браузер отправляет запросы на тот же origin, с которого открыта страница.

## Сборка и проверка типов

```sh
mise run build:frontend
mise run typecheck
mise run test
```

`test` проверяет соединение frontend с backend в Chromium и соответствие ответа OpenAPI-контракту.

Production-сборка находится в `apps/frontend/dist/`. Для её локального просмотра при работающем backend:

```sh
mise run preview:frontend
```

Откройте `http://127.0.0.1:4173`.

## UI-компоненты

Компоненты shadcn/ui хранятся в `src/components/ui/`, настройки генерации — в `components.json`, тема — в
`src/index.css`.

Добавить компонент shadcn/ui можно закреплённой версией CLI:

```sh
mise exec -- pnpm --filter @calendar/frontend exec shadcn add dialog
```
