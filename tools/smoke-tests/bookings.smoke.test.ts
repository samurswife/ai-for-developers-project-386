import { chromium, type Browser, type Page } from 'playwright';
import { expect, test } from 'vitest';
import { startFrontend } from './apps.js';
import { startCalendar } from './calendar.js';

async function scenario(
  run: (
    page: Page,
    url: string,
    backend: Awaited<ReturnType<typeof startCalendar>>,
  ) => Promise<void>,
) {
  const backend = await startCalendar('2026-11-09T05:00:00.000Z');
  let frontend: Awaited<ReturnType<typeof startFrontend>> | undefined;
  let browser: Browser | undefined;
  const cleanupErrors: unknown[] = [];
  try {
    frontend = await startFrontend(backend.url);
    browser = await chromium.launch();
    const context = await browser.newContext({
      timezoneId: 'America/Los_Angeles',
      viewport: { width: 320, height: 900 },
    });
    const page = await context.newPage();
    page.setDefaultTimeout(5000);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await run(page, frontend.url, backend);
    expect(errors).toEqual([]);
  } finally {
    const cleanup = await Promise.allSettled([
      browser?.close(),
      frontend?.close(),
      backend.close(),
    ]);
    const errors = cleanup
      .filter((result) => result.status === 'rejected')
      .map((result) => result.reason);
    cleanupErrors.push(...errors);
  }
  if (cleanupErrors.length) throw new AggregateError(cleanupErrors, 'Cleanup failed');
}

async function publish(url: string) {
  const response = await fetch(`${url}/api/meeting-types`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Знакомство', durationMinutes: 30 }),
  });
  expect(response.status).toBe(201);
  return response.json();
}

async function choose(page: Page, start = '09:00 – 09:30') {
  await page.getByRole('button', { name: start, exact: true }).click();
  await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  await page.getByRole('heading', { name: 'Подтвердите запись', exact: true }).waitFor();
  await page.getByLabel('Имя', { exact: true }).waitFor();
}

test('guest books through SDK, reloads confirmation, navigates back without POST and starts a clean new booking', async () => {
  await scenario(async (page, url, backend) => {
    const item = await publish(backend.url);
    let posts = 0;
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.url().endsWith('/api/bookings')) posts++;
    });
    await page.goto(`${url}/meeting-types/${item.id}`);
    await choose(page);
    await page.getByText('Московское время (UTC+3)', { exact: true }).waitFor();
    await page.getByLabel('Имя', { exact: true }).fill('Анна');
    await page.getByLabel('Электронная почта', { exact: true }).fill('Anna@Example.com');
    await page.screenshot({ path: '/tmp/ticket12-form-mobile.png', fullPage: true });
    await page.getByRole('button', { name: 'Подтвердить запись', exact: true }).click();
    await page.getByRole('heading', { name: 'Вы записаны', exact: true }).waitFor();
    expect(page.url()).toMatch(/\/bookings\/[0-9a-f-]+\/confirmation$/);
    await page.getByText('Анна', { exact: true }).waitFor();
    await page.getByText('Anna@Example.com', { exact: true }).waitFor();
    await page.getByText('09:00 – 09:30', { exact: true }).waitFor();
    const confirmation = page.url();
    await page.reload();
    await page.getByRole('heading', { name: 'Вы записаны', exact: true }).waitFor();
    await page.goBack();
    await page.goForward();
    await page.getByRole('heading', { name: 'Вы записаны', exact: true }).waitFor();
    expect(posts).toBe(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: '/tmp/ticket12-confirmation-mobile.png', fullPage: true });
    await page.getByRole('link', { name: 'Записаться снова', exact: true }).click();
    await page.getByRole('link', { name: 'Выбрать время', exact: true }).click();
    expect(await page.getByRole('button', { name: '09:00 – 09:30', exact: true }).count()).toBe(0);
    await choose(page, '09:30 – 10:00');
    expect(await page.getByLabel('Имя', { exact: true }).inputValue()).toBe('');
    expect(await page.getByLabel('Электронная почта', { exact: true }).inputValue()).toBe('');
    expect(posts).toBe(1);
    await page.goto(
      confirmation.replace(
        /\/bookings\/[^/]+\//,
        '/bookings/00000000-0000-4000-8000-000000000000/',
      ),
    );
    await page
      .getByRole('heading', { name: 'Данные подтверждения недоступны', exact: true })
      .waitFor();
    const other = await page.context().newPage();
    await other.goto(confirmation);
    await other
      .getByRole('heading', { name: 'Данные подтверждения недоступны', exact: true })
      .waitFor();
    await other.close();
  });
});

test('field errors retain values, changing time preserves draft, reload clears fields, and in-flight confirmation cannot be repeated', async () => {
  await scenario(async (page, url, backend) => {
    const item = await publish(backend.url);
    await page.goto(`${url}/meeting-types/${item.id}`);
    await choose(page);
    await page.getByLabel('Имя', { exact: true }).fill(' ');
    await page.getByLabel('Электронная почта', { exact: true }).fill('wrong');
    await page.getByRole('button', { name: 'Подтвердить запись', exact: true }).click();
    await page.getByText('Введите имя от 1 до 100 символов.', { exact: true }).waitFor();
    await page
      .getByText('Введите корректную электронную почту не длиннее 254 символов.', { exact: true })
      .waitFor();
    expect(await page.getByLabel('Электронная почта', { exact: true }).inputValue()).toBe('wrong');
    expect(await page.getByLabel('Имя', { exact: true }).getAttribute('aria-invalid')).toBe('true');
    await page.getByLabel('Имя', { exact: true }).fill('Анна');
    await page.getByLabel('Электронная почта', { exact: true }).fill('anna@example.com');
    await page.getByRole('link', { name: 'Изменить время', exact: true }).click();
    await choose(page, '09:30 – 10:00');
    expect(await page.getByLabel('Имя', { exact: true }).inputValue()).toBe('Анна');
    expect(await page.getByLabel('Электронная почта', { exact: true }).inputValue()).toBe(
      'anna@example.com',
    );
    await page.reload();
    await page.getByLabel('Имя', { exact: true }).waitFor();
    expect(await page.getByLabel('Имя', { exact: true }).inputValue()).toBe('');
    await page.getByLabel('Имя', { exact: true }).fill('Анна');
    await page.getByLabel('Электронная почта', { exact: true }).fill('anna@example.com');
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    let sent = 0;
    await page.route('**/api/bookings', async (route) => {
      sent++;
      const response = await route.fetch();
      await held;
      await route.fulfill({ response });
    });
    try {
      const confirm = page.getByRole('button', { name: 'Подтвердить запись', exact: true });
      await confirm.focus();
      await page.keyboard.press('Enter');
      await page.getByRole('button', { name: 'Отправляем…', exact: true }).waitFor();
      expect(
        await page.getByRole('button', { name: 'Отправляем…', exact: true }).isDisabled(),
      ).toBe(true);
      await page.keyboard.press('Enter');
      expect(await page.getByRole('heading', { name: 'Вы записаны', exact: true }).count()).toBe(0);
      expect(sent).toBe(1);
    } finally {
      release();
    }
    await page.getByRole('heading', { name: 'Вы записаны', exact: true }).waitFor();
    expect(sent).toBe(1);
  });
});

for (const cause of ['conflict', 'start-now', 'midnight'] as const) {
  test(`stale selection after ${cause} refreshes calendar without POST retry, preserves fields and allows a different booking`, async () => {
    await scenario(async (page, url, backend) => {
      const item = await publish(backend.url);
      await page.goto(`${url}/meeting-types/${item.id}`);
      await choose(page);
      await page.getByLabel('Имя', { exact: true }).fill('Анна');
      await page.getByLabel('Электронная почта', { exact: true }).fill('anna@example.com');
      if (cause === 'conflict') {
        const rival = await fetch(`${backend.url}/api/bookings`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            meetingTypeId: item.id,
            startsAt: '2026-11-09T06:00:00Z',
            guestName: 'Другой',
            guestEmail: 'other@example.com',
          }),
        });
        expect(rival.status).toBe(201);
      } else
        await backend.setTime(
          cause === 'start-now' ? '2026-11-09T06:00:00.000Z' : '2026-11-09T21:00:00.000Z',
        );
      let posts = 0;
      page.on('request', (request) => {
        if (request.method() === 'POST' && request.url().endsWith('/api/bookings')) posts++;
      });
      let reads = 0;
      await page.route(`**/api/meeting-types/${item.id}/slots`, async (route) => {
        reads++;
        if (reads === 1) await route.abort('connectionreset');
        else await route.continue();
      });
      await page.getByRole('button', { name: 'Подтвердить запись', exact: true }).click();
      await page
        .getByRole('alert')
        .filter({
          hasText:
            cause === 'conflict'
              ? 'Это время уже занято. Выберите другой слот'
              : 'Выбранное время больше недоступно: старт наступил или дата вышла из окна записи. Выберите другой слот.',
        })
        .waitFor();
      await page
        .getByRole('alert')
        .filter({ hasText: 'Не удалось загрузить доступное время.' })
        .waitFor();
      expect(posts).toBe(1);
      await page.getByRole('button', { name: 'Повторить', exact: true }).click();
      const nextSlot = cause === 'midnight' ? '09:00 – 09:30' : '09:30 – 10:00';
      await page.getByRole('button', { name: nextSlot, exact: true }).waitFor();
      expect(
        await page
          .getByRole('group', { name: 'Свободное время' })
          .getByRole('button', { pressed: true })
          .count(),
      ).toBe(0);
      expect(await page.getByRole('button', { name: 'Продолжить', exact: true }).isDisabled()).toBe(
        true,
      );
      expect(posts).toBe(1);
      await choose(page, nextSlot);
      expect(await page.getByLabel('Имя', { exact: true }).inputValue()).toBe('Анна');
      expect(await page.getByLabel('Электронная почта', { exact: true }).inputValue()).toBe(
        'anna@example.com',
      );
      await page.getByRole('button', { name: 'Подтвердить запись', exact: true }).click();
      await page.getByRole('heading', { name: 'Вы записаны', exact: true }).waitFor();
      expect(posts).toBe(2);
    });
  });
}

for (const failure of ['lost-response', '500'] as const) {
  test(`a real save followed by ${failure} reports unknown result, never retries and preserves draft for choosing time`, async () => {
    await scenario(async (page, url, backend) => {
      const item = await publish(backend.url);
      await page.goto(`${url}/meeting-types/${item.id}`);
      await choose(page);
      await page.getByLabel('Имя', { exact: true }).fill('Анна');
      await page.getByLabel('Электронная почта', { exact: true }).fill('anna@example.com');
      let sent = 0;
      let saved = false;
      await page.route('**/api/bookings', async (route) => {
        sent++;
        const response = await route.fetch();
        expect(response.status()).toBe(201);
        saved = true;
        if (failure === 'lost-response') await route.abort('connectionreset');
        else
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({
              code: 'INTERNAL_ERROR',
              message: 'Не удалось выполнить запрос.',
            }),
          });
      });
      await page.getByRole('button', { name: 'Подтвердить запись', exact: true }).click();
      await page
        .getByRole('alert')
        .filter({ hasText: 'Результат записи неизвестен. Запись могла сохраниться.' })
        .waitFor();
      expect(saved).toBe(true);
      expect(sent).toBe(1);
      expect(await page.getByRole('heading', { name: 'Вы записаны', exact: true }).count()).toBe(0);
      expect(
        await page.getByRole('button', { name: 'Подтвердить запись', exact: true }).isDisabled(),
      ).toBe(true);
      await page.getByRole('link', { name: 'Изменить время', exact: true }).click();
      await page.getByRole('button', { name: '09:30 – 10:00', exact: true }).waitFor();
      expect(await page.getByRole('button', { name: '09:00 – 09:30', exact: true }).count()).toBe(
        0,
      );
      await page
        .getByRole('alert')
        .filter({ hasText: 'Результат записи неизвестен. Запись могла сохраниться.' })
        .waitFor();
      await choose(page, '09:30 – 10:00');
      expect(await page.getByLabel('Имя', { exact: true }).inputValue()).toBe('Анна');
      expect(await page.getByLabel('Электронная почта', { exact: true }).inputValue()).toBe(
        'anna@example.com',
      );
      expect(sent).toBe(1);
    });
  });
}

test('entering a booking URL rechecks availability, handles unknown types and retries failed reads without creating', async () => {
  await scenario(async (page, url, backend) => {
    const item = await publish(backend.url);
    let posts = 0;
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.url().endsWith('/api/bookings')) posts++;
    });
    const formUrl = `${url}/meeting-types/${item.id}/book?start=${encodeURIComponent('2026-11-09T06:00:00.000Z')}`;
    for (const suffix of ['', '/slots']) {
      await page.route(`**/api/meeting-types/${item.id}${suffix}`, (route) =>
        route.abort('connectionreset'),
      );
      await page.goto(formUrl);
      await page
        .getByRole('alert')
        .filter({ hasText: 'Не удалось проверить выбранное время.' })
        .waitFor();
      await page.unroute(`**/api/meeting-types/${item.id}${suffix}`);
      await page.getByRole('button', { name: 'Повторить', exact: true }).click();
      await page.getByLabel('Имя', { exact: true }).waitFor();
    }
    await backend.setTime('2026-11-09T06:00:00.000Z');
    await page.reload();
    await page
      .getByRole('alert')
      .filter({ hasText: 'Выбранное время больше недоступно. Выберите другой слот.' })
      .waitFor();
    await page.getByRole('button', { name: '09:15 – 09:45', exact: true }).waitFor();
    expect(await page.getByRole('button', { name: 'Продолжить', exact: true }).isDisabled()).toBe(
      true,
    );
    await page.goto(
      `${url}/meeting-types/00000000-0000-4000-8000-000000000000/book?start=2026-11-09T06:00:00Z`,
    );
    await page.getByRole('heading', { name: 'Тип встречи не найден', exact: true }).waitFor();
    await page.getByRole('link', { name: 'В каталог', exact: true }).click();
    await page.getByRole('heading', { name: 'Типы встреч', exact: true }).waitFor();
    expect(posts).toBe(0);
  });
});

test('a meeting type that disappears before submit gives a catalog recovery path after a genuine 404', async () => {
  await scenario(async (page, url, backend) => {
    const item = await publish(backend.url);
    await page.goto(`${url}/meeting-types/${item.id}`);
    await choose(page);
    await page.getByLabel('Имя', { exact: true }).fill('Анна');
    await page.getByLabel('Электронная почта', { exact: true }).fill('anna@example.com');
    const restartedBackend = await startCalendar('2026-11-09T05:00:00.000Z');
    try {
      await page.route('**/api/bookings', async (route) => {
        const response = await route.fetch({ url: `${restartedBackend.url}/api/bookings` });
        expect(response.status()).toBe(404);
        await route.fulfill({ response });
      });
      await page.getByRole('button', { name: 'Подтвердить запись', exact: true }).click();
      await page.getByRole('heading', { name: 'Тип встречи не найден', exact: true }).waitFor();
      await page.getByRole('link', { name: 'В каталог', exact: true }).click();
      await page.getByRole('heading', { name: 'Типы встреч', exact: true }).waitFor();
    } finally {
      await restartedBackend.close();
    }
  });
});
