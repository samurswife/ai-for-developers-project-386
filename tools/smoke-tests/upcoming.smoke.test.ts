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
    const page = await browser.newPage({
      timezoneId: 'America/Los_Angeles',
      viewport: { width: 320, height: 900 },
    });
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

test('owner creates type, guest books through catalog and confirmation, owner sees Moscow meeting details on a narrow keyboard-accessible page', async () => {
  await scenario(async (page, url) => {
    await page.goto(url);
    await page.getByRole('link', { name: 'Управление встречами', exact: true }).click();
    await page.getByLabel('Название').fill('Обсудим проект');
    await page.getByLabel('Описание (необязательно)').fill('Планы и вопросы');
    await page.getByLabel('Длительность в минутах').fill('30');
    await page.getByRole('button', { name: 'Создать тип встречи', exact: true }).click();
    await page.getByText('Тип встречи создан', { exact: true }).waitFor();
    await page.getByRole('link', { name: 'Посмотреть в каталоге', exact: true }).click();
    await page.getByRole('heading', { name: 'Обсудим проект', exact: true }).waitFor();
    await page.getByRole('link', { name: 'Выбрать время', exact: true }).click();
    await page.getByRole('button', { name: '09:00 – 09:30', exact: true }).click();
    await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
    await page.getByLabel('Имя', { exact: true }).fill('Анна');
    await page.getByLabel('Электронная почта', { exact: true }).fill('Anna@Example.com');
    await page.getByRole('button', { name: 'Подтвердить запись', exact: true }).click();
    await page.getByRole('heading', { name: 'Вы записаны', exact: true }).waitFor();
    await page.getByRole('link', { name: 'Управление встречами', exact: true }).click();
    const list = page.getByRole('region', { name: 'Предстоящие встречи', exact: true });
    await list.getByText('Обсудим проект', { exact: true }).waitFor();
    for (const detail of [
      '9 ноября 2026 г.',
      '09:00 – 09:30',
      '30 мин',
      'Московское время (UTC+3)',
      'Анна',
      'Anna@Example.com',
    ])
      expect(await list.getByText(detail, { exact: true }).isVisible()).toBe(true);
    expect(
      await page.getByRole('button', { name: 'Создать тип встречи', exact: true }).isVisible(),
    ).toBe(true);
    await page.getByRole('button', { name: 'Создать тип встречи', exact: true }).focus();
    await page.keyboard.press('Tab');
    expect(
      await list
        .getByRole('button', { name: 'Обновить', exact: true })
        .evaluate((element) => element === document.activeElement),
    ).toBe(true);
    expect(await page.evaluate(() => getComputedStyle(document.activeElement!).boxShadow)).not.toBe(
      'none',
    );
    await page.keyboard.press('Enter');
    await list.getByText('Анна', { exact: true }).waitFor();
    await list.getByRole('button', { name: 'Обновить', exact: true }).click({ trial: true });
    expect(await list.getByRole('button', { name: 'Обновить', exact: true }).isEnabled()).toBe(
      true,
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: '/tmp/ticket13-owner-mobile.png', fullPage: true });
  });
});

test('owner distinguishes loading, failed read with retry and empty list; only manual refresh retrieves new bookings and removes begun meetings', async () => {
  await scenario(async (page, url, backend) => {
    await page.clock.install();
    let reads = 0;
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route('**/api/bookings/upcoming', async (route) => {
      reads++;
      if (reads === 1) {
        await held;
        await route.abort('failed');
      } else await route.continue();
    });
    await page.goto(`${url}/owner`);
    const list = page.getByRole('region', { name: 'Предстоящие встречи', exact: true });
    try {
      await list.getByText('Загружаем предстоящие встречи…', { exact: true }).waitFor();
      expect(await list.getByRole('button', { name: 'Обновить', exact: true }).isDisabled()).toBe(
        true,
      );
    } finally {
      release();
    }
    await list
      .getByRole('alert')
      .filter({ hasText: 'Не удалось загрузить предстоящие встречи.' })
      .waitFor();
    expect(await list.getByText('Предстоящих встреч пока нет', { exact: true }).count()).toBe(0);
    await list.getByRole('button', { name: 'Повторить', exact: true }).click();
    await list.getByText('Предстоящих встреч пока нет', { exact: true }).waitFor();
    const itemResponse = await fetch(`${backend.url}/api/meeting-types`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Новая встреча', durationMinutes: 30 }),
    });
    expect(itemResponse.status).toBe(201);
    const item = await itemResponse.json();
    const bookingResponse = await fetch(`${backend.url}/api/bookings`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        meetingTypeId: item.id,
        startsAt: '2026-11-09T06:00:00Z',
        guestName: 'Гость',
        guestEmail: 'guest@example.com',
      }),
    });
    expect(bookingResponse.status).toBe(201);
    const before = reads;
    await page.clock.fastForward(120_000);
    expect(reads).toBe(before);
    expect(await list.getByText('Предстоящих встреч пока нет', { exact: true }).isVisible()).toBe(
      true,
    );
    await list.getByRole('button', { name: 'Обновить', exact: true }).click();
    await list.getByText('Новая встреча', { exact: true }).waitFor();
    expect(reads).toBe(before + 1);
    await backend.setTime('2026-11-09T06:00:00.000Z');
    await list.getByRole('button', { name: 'Обновить', exact: true }).click();
    await list.getByText('Предстоящих встреч пока нет', { exact: true }).waitFor();
    expect(await list.getByText('Новая встреча', { exact: true }).count()).toBe(0);
  });
});
