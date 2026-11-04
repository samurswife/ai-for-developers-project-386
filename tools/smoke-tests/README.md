# Дымовой тест приложения

Vitest запускает production-сборки frontend и backend на свободных локальных портах. Playwright открывает frontend в
Chromium Headless Shell и проверяет всю цепочку React → SDK → Vite proxy → NestJS.

## Запуск

Из корня репозитория после установки зависимостей:

```sh
mise run test
```

`mise run setup` устанавливает зависимости и Chromium. Для отдельной установки браузера используйте
`mise run setup:browsers`.

`mise run test` собирает frontend и backend и проверяет их взаимодействие в браузере.

Браузер и оба сервера завершаются и при успешном тесте, и при ошибке. Конфигурация раннера находится в
`vitest.config.ts`.
