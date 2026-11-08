import { writeFile } from 'node:fs/promises';
import { chromium, type Browser, type Page } from 'playwright';
import { expect, test } from 'vitest';
import { startFrontend } from './apps.js';
import { fillCalendarWindow, startCalendar } from './calendar.js';

async function scenario(run: (page: Page, url: string, backendUrl: string) => Promise<void>) {
  const backend = await startCalendar('2026-11-08T12:00:00.000Z');
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
    await run(page, frontend.url, backend.url);
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
  if (cleanupErrors.length) throw new AggregateError(cleanupErrors, 'Application cleanup failed');
}

async function publish(url: string) {
  const response = await fetch(`${url}/api/meeting-types`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Знакомство', description: 'Обсудим планы', durationMinutes: 30 }),
  });
  expect(response.status).toBe(201);
  return response.json();
}

test('guest opens the real calendar from catalog, chooses Moscow time with keyboard, and changing dates clears the selection', async () => {
  await scenario(async (page, url, backendUrl) => {
    await publish(backendUrl);
    await page.goto(`${url}/meeting-types`);
    await page.getByRole('link', { name: 'Выбрать время' }).click();
    await page.getByRole('heading', { name: 'Знакомство', exact: true }).waitFor();
    await page.getByText('Московское время (UTC+3)', { exact: true }).waitFor();
    const dates = page.getByRole('group', { name: 'Даты записи' });
    expect(await dates.getByRole('button').count()).toBe(14);
    expect(
      await dates.getByRole('button', { name: /^9 ноября/ }).getAttribute('aria-pressed'),
    ).toBe('true');
    const firstSlot = page.getByRole('button', { name: '09:00 – 09:30', exact: true });
    await firstSlot.focus();
    await page.keyboard.press('Enter');
    expect(await firstSlot.getAttribute('aria-pressed')).toBe('true');
    await page.getByText('Выбрано: 09:00 – 09:30', { exact: true }).waitFor();
    expect(await page.getByRole('button', { name: 'Продолжить', exact: true }).isDisabled()).toBe(
      false,
    );
    await page.getByText('Выбор слота не удерживает время.', { exact: true }).waitFor();
    expect(await firstSlot.evaluate((element) => getComputedStyle(element).boxShadow)).not.toBe(
      'none',
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await firstSlot.evaluate(async (element) => {
      await Promise.all(element.getAnimations().map((animation) => animation.finished));
    });
    const selectedStyle = await firstSlot.evaluate((element) => {
      const style = getComputedStyle(element);
      return { opacity: style.opacity, color: style.color, background: style.backgroundColor };
    });
    expect(await firstSlot.isDisabled()).toBe(false);
    expect(selectedStyle.opacity).toBe('1');
    await writeFile('/tmp/ticket11-selected-style.json', JSON.stringify(selectedStyle));
    await page.screenshot({ path: '/tmp/ticket11-calendar-mobile.png', fullPage: true });
    await dates.getByRole('button', { name: /^10 ноября/ }).click();
    expect(
      await page
        .getByRole('group', { name: 'Свободное время' })
        .getByRole('button', { pressed: true })
        .count(),
    ).toBe(0);
    expect(await page.getByText(/^Выбрано:/).count()).toBe(0);
    await dates.getByRole('button', { name: /^8 ноября/ }).click();
    await page.getByText('На эту дату свободного времени нет', { exact: true }).waitFor();
    expect(
      await dates.getByRole('button', { name: /^8 ноября/ }).getAttribute('aria-pressed'),
    ).toBe('true');
    await page.reload();
    await dates.getByRole('button', { name: /^9 ноября/ }).waitFor();
    expect(
      await dates.getByRole('button', { name: /^9 ноября/ }).getAttribute('aria-pressed'),
    ).toBe('true');
    expect(await page.getByText(/^Выбрано:/).count()).toBe(0);
  });
});

for (const suffix of ['', '/slots']) {
  test(`calendar distinguishes loading and failed ${suffix || 'type'} reads and explicitly retries a genuine read`, async () => {
    await scenario(async (page, url, backendUrl) => {
      const item = await publish(backendUrl);
      let release!: () => void;
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });
      await page.route(`**/api/meeting-types/${item.id}${suffix}`, async (route) => {
        const response = await route.fetch();
        await held;
        await route.fulfill({ response });
      });
      try {
        await page.goto(`${url}/meeting-types/${item.id}`);
        await page.getByRole('status').filter({ hasText: 'Загружаем доступное время' }).waitFor();
        expect(
          await page.getByText('На эту дату свободного времени нет', { exact: true }).count(),
        ).toBe(0);
      } finally {
        release();
      }
      await page.getByRole('button', { name: '09:00 – 09:30', exact: true }).waitFor();
      await page.unroute(`**/api/meeting-types/${item.id}${suffix}`);
      await page.route(`**/api/meeting-types/${item.id}${suffix}`, (route) =>
        route.abort('connectionreset'),
      );
      await page.reload();
      await page
        .getByRole('alert')
        .filter({ hasText: 'Не удалось загрузить доступное время.' })
        .waitFor();
      expect(
        await page.getByText('На эту дату свободного времени нет', { exact: true }).count(),
      ).toBe(0);
      await page.unroute(`**/api/meeting-types/${item.id}${suffix}`);
      await page.getByRole('button', { name: 'Повторить', exact: true }).click();
      await page.getByRole('button', { name: '09:00 – 09:30', exact: true }).waitFor();
    });
  });
}

test('a genuine unknown meeting type offers a catalog recovery path', async () => {
  await scenario(async (page, url) => {
    await page.goto(`${url}/meeting-types/00000000-0000-4000-8000-000000000000`);
    await page.getByRole('heading', { name: 'Тип встречи не найден', exact: true }).waitFor();
    await page.getByRole('link', { name: 'В каталог', exact: true }).click();
    await page.getByRole('heading', { name: 'Типы встреч', exact: true }).waitFor();
  });
});

test('a fully occupied real calendar shows all dates, selects the first and explains the empty window', async () => {
  await scenario(async (page, url, backendUrl) => {
    await fillCalendarWindow(backendUrl);
    const item = await publish(backendUrl);
    await page.goto(`${url}/meeting-types/${item.id}`);
    await page.getByText('В ближайшие 14 дней свободного времени нет', { exact: true }).waitFor();
    await page.getByText('На эту дату свободного времени нет', { exact: true }).waitFor();
    const dates = page.getByRole('group', { name: 'Даты записи' });
    expect(await dates.getByRole('button').count()).toBe(14);
    expect(
      await dates.getByRole('button', { name: /^8 ноября/ }).getAttribute('aria-pressed'),
    ).toBe('true');
    await dates.getByRole('button', { name: /^9 ноября/ }).click();
    expect(
      await dates.getByRole('button', { name: /^9 ноября/ }).getAttribute('aria-pressed'),
    ).toBe('true');
    expect(await page.getByRole('button', { name: 'Продолжить', exact: true }).isDisabled()).toBe(
      true,
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
});
