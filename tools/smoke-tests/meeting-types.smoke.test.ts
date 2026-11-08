import type { Page } from 'playwright';
import { expect, test } from 'vitest';
import { startBackend } from './apps.js';
import { browserScenario } from './browser-scenario.js';

async function scenario(run: (page: Page, url: string, backendUrl: string) => Promise<void>) {
  await browserScenario(startBackend, {}, (page, url, backend) => run(page, url, backend.url));
}

test('owner creates a meeting type and guests find its real saved data in the catalog', async () => {
  await scenario(async (page, url) => {
    await page.goto(url);
    await page.getByRole('link', { name: 'Управление встречами', exact: true }).click();
    await page.getByLabel('Название').fill('Знакомство');
    await page.getByLabel('Описание (необязательно)').fill('Обсудим ваши планы');
    await page.getByLabel('Длительность в минутах').fill('30');
    await page.getByRole('button', { name: 'Создать тип встречи', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Тип встречи создан' }).waitFor();
    expect(await page.getByLabel('Название').inputValue()).toBe('');
    await page.screenshot({ path: '/tmp/ticket10-owner-success.png', fullPage: true });
    await page.getByRole('link', { name: 'Посмотреть в каталоге' }).click();
    await page.getByRole('heading', { name: 'Знакомство', exact: true }).waitFor();
    expect(await page.getByText('Обсудим ваши планы', { exact: true }).isVisible()).toBe(true);
    expect(await page.getByText('30 мин', { exact: true }).isVisible()).toBe(true);
    expect(await page.getByRole('link', { name: 'Выбрать время' }).getAttribute('href')).toMatch(
      /^\/meeting-types\/[0-9a-f-]+$/,
    );
    await page.screenshot({ path: '/tmp/ticket10-catalog.png', fullPage: true });
  });
});

test('server field errors retain form values; submission stays blocked while real creation is pending', async () => {
  await scenario(async (page, url) => {
    await page.goto(`${url}/owner`);
    await page.getByLabel('Название').fill('   ');
    await page.getByLabel('Описание (необязательно)').fill('Сохраняется');
    await page.getByLabel('Длительность в минутах').fill('0');
    await page.getByRole('button', { name: 'Создать тип встречи', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'Проверьте поля' }).waitFor();
    expect(await page.getByLabel('Название').getAttribute('aria-invalid')).toBe('true');
    expect(
      await page.getByText('Введите целое число от 1 до 540.', { exact: true }).isVisible(),
    ).toBe(true);
    expect(await page.getByLabel('Описание (необязательно)').inputValue()).toBe('Сохраняется');
    await page.getByLabel('Название').fill('Новая встреча');
    await page.getByLabel('Длительность в минутах').fill('20');
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    let postCount = 0;
    await page.route('**/api/meeting-types', async (route) => {
      if (route.request().method() !== 'POST') return route.continue();
      postCount++;
      const response = await route.fetch();
      await held;
      await route.fulfill({ response });
    });
    try {
      await page.getByRole('button', { name: 'Создать тип встречи', exact: true }).click();
      await page.getByRole('button', { name: 'Создаём…' }).waitFor();
      expect(await page.getByRole('button', { name: 'Создаём…' }).isDisabled()).toBe(true);
      await page.getByLabel('Длительность в минутах').press('Enter');
    } finally {
      release();
    }
    await page.getByRole('status').filter({ hasText: 'Тип встречи создан' }).waitFor();
    expect(postCount).toBe(1);
  });
});

test('catalog separates loading, empty and failed reads and retries a real read explicitly', async () => {
  await scenario(async (page, url) => {
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route('**/api/meeting-types', async (route) => {
      await held;
      await route.continue();
    });
    try {
      await page.goto(`${url}/meeting-types`);
      await page.getByRole('status').filter({ hasText: 'Загружаем' }).waitFor();
      expect(await page.getByText('Типов встреч пока нет', { exact: true }).count()).toBe(0);
    } finally {
      release();
    }
    await page.getByText('Типов встреч пока нет', { exact: true }).waitFor();
    await page.unroute('**/api/meeting-types');
    await page.route('**/api/meeting-types', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'INTERNAL_ERROR', message: 'Не удалось выполнить запрос.' }),
      }),
    );
    await page.reload();
    await page.getByRole('alert').filter({ hasText: 'Не удалось загрузить' }).waitFor();
    expect(await page.getByText('Типов встреч пока нет', { exact: true }).count()).toBe(0);
    await page.unroute('**/api/meeting-types');
    await page.getByRole('button', { name: 'Повторить' }).click();
    await page.getByText('Типов встреч пока нет', { exact: true }).waitFor();
  });
});

for (const failure of ['lost-response', '500'] as const) {
  test(`${failure}: a real saved type has unknown creation result without false success or automatic POST retry`, async () => {
    await scenario(async (page, url, backendUrl) => {
      let posts = 0;
      await page.route('**/api/meeting-types', async (route) => {
        if (route.request().method() !== 'POST') return route.continue();
        posts++;
        const saved = await route.fetch();
        expect(saved.status()).toBe(201);
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
      await page.goto(`${url}/owner`);
      await page.getByLabel('Название').fill('Ответ потерян');
      await page.getByLabel('Длительность в минутах').fill('45');
      await page.getByRole('button', { name: 'Создать тип встречи', exact: true }).click();
      await page.getByRole('alert').filter({ hasText: 'Тип встречи мог сохраниться' }).waitFor();
      expect(await page.getByRole('status').count()).toBe(0);
      expect(await page.getByLabel('Название').inputValue()).toBe('Ответ потерян');
      expect(
        await page.getByRole('button', { name: 'Создать тип встречи', exact: true }).isDisabled(),
      ).toBe(true);
      const catalog = await (await fetch(`${backendUrl}/api/meeting-types`)).json();
      expect(catalog.items).toHaveLength(1);
      expect(catalog.items[0].name).toBe('Ответ потерян');
      await page.reload();
      await page.goBack();
      expect(posts).toBe(1);
    });
  });
}

test('narrow screens, keyboard controls and unknown routes remain usable', async () => {
  await scenario(async (page, url) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto(`${url}/owner`);
    for (let tab = 0; tab < 4; tab++) await page.keyboard.press('Tab');
    expect(
      await page.getByLabel('Название').evaluate((element) => element === document.activeElement),
    ).toBe(true);
    expect(
      await page.getByLabel('Название').evaluate((element) => getComputedStyle(element).boxShadow),
    ).not.toBe('none');
    await page.keyboard.type('С клавиатуры');
    await page.keyboard.press('Tab');
    await page.keyboard.type('Описание');
    await page.keyboard.press('Tab');
    await page.keyboard.type('15');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await page.getByRole('status').filter({ hasText: 'Тип встречи создан' }).waitFor();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.screenshot({ path: '/tmp/ticket10-owner-mobile.png', fullPage: true });
    await page.getByRole('link', { name: 'Посмотреть в каталоге' }).click();
    await page.getByRole('heading', { name: 'С клавиатуры', exact: true }).waitFor();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.goto(`${url}/unknown`);
    await page.getByRole('heading', { name: 'Страница не найдена' }).waitFor();
    await page.getByRole('link', { name: 'На главную', exact: true }).click();
    await page.getByRole('heading', { name: 'Запись на звонок', exact: true }).waitFor();
  });
});
