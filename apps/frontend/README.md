# Frontend календаря звонков

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

Для фонового запуска обоих серверов через mise:

```sh
mise daemons start frontend
mise daemons status
mise daemons logs backend -n 20
mise daemons logs frontend -n 20
mise daemons stop
```

## Подключение backend

Vite проксирует `/api` к `http://127.0.0.1:3000` в dev-режиме и локальном preview. Для другого адреса backend:

```sh
BACKEND_URL=http://127.0.0.1:3001 mise run dev:frontend
```

## Сборка и проверка типов

```sh
mise run build:frontend
mise run typecheck
mise run test
```

Для локального просмотра production-сборки при работающем backend:

```sh
mise run preview:frontend
```

Откройте `http://127.0.0.1:4173`.

## UI-компоненты

Добавить компонент shadcn/ui можно закреплённой версией CLI:

```sh
mise exec -- pnpm --filter @calendar/frontend exec shadcn add dialog
```
