# Backend календаря звонков

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

Контракт API — `specs/main.tsp`.

## Проверки

```sh
mise run typecheck
mise run test
mise run verify:contract
```
