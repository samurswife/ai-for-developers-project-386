import { randomUUID } from 'node:crypto';
import { chromium, type Browser } from 'playwright';
import { expect, test } from 'vitest';
import type { Availability, MeetingType } from '@calendar/api-sdk';
import { startBackend } from './apps.js';

test('production serves the SPA and API, accepts a guest booking and rejects a stale overlapping booking', async () => {
  const backend = process.env.DEPLOYMENT_URL
    ? { url: process.env.DEPLOYMENT_URL.replace(/\/$/, ''), close: async () => {} }
    : await startBackend([], { NODE_ENV: 'production', HOST: '0.0.0.0' });
  let browser: Browser | undefined;
  try {
    browser = await chromium.launch();
    const context = await browser.newContext();
    context.setDefaultTimeout(15_000);
    const errors: string[] = [];
    context.on('page', (page) => page.on('pageerror', (error) => errors.push(error.message)));
    const owner = await context.newPage();
    const health = await context.request.get(`${backend.url}/api/health`);
    expect(health.status()).toBe(200);
    expect(await health.json()).toEqual({ status: 'ok' });

    const home = await context.request.get(backend.url);
    expect(home.status()).toBe(200);
    const html = await home.text();
    const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)];
    expect(assets.length).toBeGreaterThanOrEqual(2);
    for (const [, path] of assets) {
      const asset = await context.request.get(`${backend.url}${path}`);
      expect(asset.status(), path).toBe(200);
      expect(asset.headers()['content-type'], path).not.toContain('text/html');
    }

    for (const path of ['/api', '/api/not-found', '/assets/missing.js', '/missing.css']) {
      const response = await context.request.get(`${backend.url}${path}`);
      expect(response.status(), path).toBe(404);
      expect(response.headers()['content-type'], path).toContain('application/json');
    }
    await owner.goto(`${backend.url}/owner`);
    await owner.reload();
    const name = `Проверка деплоя ${randomUUID().slice(0, 8)}`;
    await owner.getByLabel('Название', { exact: true }).fill(name);
    await owner.getByLabel('Длительность в минутах', { exact: true }).fill('30');
    const created = owner.waitForResponse(
      (response) =>
        response.request().method() === 'POST' && response.url().endsWith('/api/meeting-types'),
    );
    await owner.getByRole('button', { name: 'Создать тип встречи', exact: true }).click();
    const response = await created;
    expect(response.status()).toBe(201);
    const item: MeetingType = await response.json();
    await owner.getByText('Тип встречи создан', { exact: true }).waitFor();

    const slotsResponse = await context.request.get(
      `${backend.url}/api/meeting-types/${item.id}/slots`,
    );
    expect(slotsResponse.status()).toBe(200);
    const availability: Availability = await slotsResponse.json();
    // Leave enough time for slow public deployments; never pin a calendar date.
    const day = availability.days.find((entry) =>
      entry.slots.some((slot) => Date.parse(slot.startsAt) > Date.now() + 3_600_000),
    );
    const slot = day?.slots.find((entry) => Date.parse(entry.startsAt) > Date.now() + 3_600_000);
    expect(day, 'A free day must exist in the booking window').toBeDefined();
    expect(slot, 'A free future slot must exist').toBeDefined();
    if (!day || !slot) throw new Error('No future slot available for the deployment scenario');

    const guest = await context.newPage();
    await guest.goto(backend.url);
    await guest.getByRole('link', { name: 'Записаться', exact: true }).first().click();
    await guest
      .getByRole('listitem')
      .filter({ has: guest.getByRole('heading', { name, exact: true }) })
      .getByRole('link', { name: 'Выбрать время', exact: true })
      .click();
    const dateLabel = new Intl.DateTimeFormat('ru-RU', {
      timeZone: 'Europe/Moscow',
      dateStyle: 'long',
    });
    const timeLabel = new Intl.DateTimeFormat('ru-RU', {
      timeZone: 'Europe/Moscow',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    await guest
      .getByRole('button', { name: dateLabel.format(new Date(slot.startsAt)), exact: true })
      .click();
    const interval = `${timeLabel.format(new Date(slot.startsAt))} – ${timeLabel.format(new Date(slot.endsAt))}`;
    await guest.getByRole('button', { name: interval, exact: true }).click();
    await guest.getByRole('button', { name: 'Продолжить', exact: true }).click();
    await guest.getByLabel('Имя', { exact: true }).fill('Тестовый гость');
    await guest.getByLabel('Электронная почта', { exact: true }).fill('deploy@example.com');

    const rival = await context.newPage();
    await rival.goto(guest.url());
    await rival.getByLabel('Имя', { exact: true }).fill('Второй гость');
    await rival.getByLabel('Электронная почта', { exact: true }).fill('rival@example.com');
    await guest.getByRole('button', { name: 'Подтвердить запись', exact: true }).click();
    await guest.getByRole('heading', { name: 'Вы записаны', exact: true }).waitFor();
    await guest.reload();
    await guest.getByRole('heading', { name: 'Вы записаны', exact: true }).waitFor();
    const rejected = rival.waitForResponse(
      (entry) => entry.request().method() === 'POST' && entry.url().endsWith('/api/bookings'),
    );
    await rival.getByRole('button', { name: 'Подтвердить запись', exact: true }).click();
    const conflict = await rejected;
    expect(conflict.status()).toBe(409);
    expect((await conflict.json()).code).toBe('SLOT_CONFLICT');
    await rival
      .getByRole('alert')
      .filter({ hasText: 'Это время уже занято. Выберите другой слот' })
      .waitFor();

    await owner.reload();
    const meetings = owner.getByRole('region', { name: 'Предстоящие встречи', exact: true });
    const booking = meetings.getByRole('listitem').filter({ hasText: name });
    await booking.getByText('Тестовый гость', { exact: true }).waitFor();
    expect(await booking.count()).toBe(1);
    expect(await booking.getByText('deploy@example.com', { exact: true }).isVisible()).toBe(true);
    expect(await booking.getByText(interval, { exact: true }).isVisible()).toBe(true);
    expect(await meetings.getByText('Второй гость', { exact: true }).count()).toBe(0);
    expect(errors).toEqual([]);
  } finally {
    await Promise.all([browser?.close(), backend.close()]);
  }
}, 120_000);
