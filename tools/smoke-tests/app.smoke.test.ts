import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { chromium, type Browser } from 'playwright';
import { preview, type PreviewServer } from 'vite';
import { expect, test } from 'vitest';
import openapi from '../../specs/generated/openapi.json' with { type: 'json' };

const root = fileURLToPath(new URL('../../', import.meta.url));

test('home page explains booking without activating unfinished sections; API proxy matches OpenAPI', async () => {
  const child = spawn(process.execPath, [join(root, 'apps/backend/dist/main.js')], {
    cwd: root,
    env: { ...process.env, PORT: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const closed = new Promise<void>((resolve) => child.once('close', () => resolve()));
  let output = '';
  let startupTimer: ReturnType<typeof setTimeout> | undefined;
  let frontend: PreviewServer | undefined;
  let browser: Browser | undefined;
  const ready = new Promise<string>((resolve, reject) => {
    startupTimer = setTimeout(() => {
      reject(new Error(`Backend did not start within 10 seconds:\n${output}`));
    }, 10_000);
    const collectOutput = (chunk: Buffer) => {
      output += chunk.toString();
      const address = output.match(/Backend listening at (http:\/\/127\.0\.0\.1:\d+)/);
      if (address) resolve(address[1]);
    };
    child.stdout.on('data', collectOutput);
    child.stderr.on('data', collectOutput);
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      reject(new Error(`Backend exited before becoming ready (${code}/${signal}):\n${output}`));
    });
  });

  try {
    const backendUrl = await ready;
    clearTimeout(startupTimer);
    frontend = await preview({
      root: join(root, 'apps/frontend'),
      preview: {
        host: '127.0.0.1',
        port: 0,
        proxy: { '/api': { target: backendUrl, changeOrigin: true } },
      },
    });
    const address = frontend.httpServer.address();
    if (!address || typeof address === 'string')
      throw new Error('Frontend did not open a TCP port');
    const frontendUrl = `http://127.0.0.1:${address.port}`;

    browser = await chromium.launch({ timeout: 10_000 });
    const page = await browser.newPage();
    page.setDefaultTimeout(5000);
    const pageErrors: string[] = [];
    const apiRequests: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/')) apiRequests.push(request.url());
    });
    await page.goto(frontendUrl);
    expect(await page.title()).toBe('Запись на звонок');
    const heading = page.getByRole('heading', { name: 'Запись на звонок', exact: true });
    await heading.waitFor();
    expect(await page.getByRole('heading', { name: 'Проверка соединения' }).count()).toBe(0);

    for (const width of [1400, 768, 375, 320]) {
      await page.setViewportSize({ width, height: 1050 });
      expect(await heading.isVisible()).toBe(true);
      expect(
        await page.getByRole('heading', { name: 'Возможности', exact: true }).isVisible(),
      ).toBe(true);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);

      const unavailable = page.getByRole('button');
      expect(await unavailable.count()).toBe(3);
      expect(await page.getByRole('button', { name: 'Записаться', exact: true }).count()).toBe(2);
      expect(
        await page.getByRole('button', { name: 'Управление встречами', exact: true }).isDisabled(),
      ).toBe(true);
      for (const control of await unavailable.all()) {
        expect(await control.isVisible()).toBe(true);
        expect(await control.isDisabled()).toBe(true);
        const descriptionId = await control.getAttribute('aria-describedby');
        expect(descriptionId).toBeTruthy();
        const description = page.locator(`[id="${descriptionId}"]`);
        expect(await description.isVisible()).toBe(true);
        expect(await description.textContent()).toBe('Раздел готовится');
      }
    }
    await page.keyboard.press('Tab');
    expect(
      await page
        .getByRole('link', { name: 'Запись на звонок', exact: true })
        .evaluate((element) => element === document.activeElement),
    ).toBe(true);
    await page.keyboard.press('Enter');
    await heading.waitFor();
    expect(new URL(page.url()).pathname).toBe('/');
    expect(apiRequests).toEqual([]);

    // Keep checking the proxy and contract without a diagnostic control on the public page.
    const response = await page.request.get(`${frontendUrl}/api/health`);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toMatch(/^application\/json\b/);
    expect(
      openapi.paths['/api/health'].get.responses['200'].content['application/json'].schema.$ref,
    ).toBe('#/components/schemas/HealthResponse');

    const validate = new Ajv2020({ allErrors: true }).compile(
      openapi.components.schemas.HealthResponse,
    );
    const body: unknown = await response.json();
    expect(validate(body), JSON.stringify(validate.errors)).toBe(true);
    expect(pageErrors).toEqual([]);
  } finally {
    clearTimeout(startupTimer);
    try {
      await browser?.close();
    } finally {
      try {
        if (frontend) {
          const server = frontend.httpServer;
          const frontendClosed = new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
          });
          if ('closeAllConnections' in server) server.closeAllConnections();
          await frontendClosed;
        }
      } finally {
        if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
        const shutdownTimer = setTimeout(() => child.kill('SIGKILL'), 3000);
        try {
          await closed;
        } finally {
          clearTimeout(shutdownTimer);
        }
      }
    }
  }
});
