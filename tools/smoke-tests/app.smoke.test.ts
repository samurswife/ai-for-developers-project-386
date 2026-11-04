import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { chromium, type Browser } from 'playwright';
import { preview, type PreviewServer } from 'vite';
import { expect, test } from 'vitest';
import openapi from '../../specs/generated/openapi.json' with { type: 'json' };

const root = fileURLToPath(new URL('../../', import.meta.url));

test('frontend connects to backend and receives a response matching OpenAPI', async () => {
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
    if (!address || typeof address === 'string') throw new Error('Frontend did not open a TCP port');
    const frontendUrl = `http://127.0.0.1:${address.port}`;

    browser = await chromium.launch({ timeout: 10_000 });
    const page = await browser.newPage();
    page.setDefaultTimeout(5000);
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.goto(frontendUrl);
    await page.getByRole('heading', { name: 'Календарь звонков', exact: true }).waitFor();

    const [response] = await Promise.all([
      page.waitForResponse(
        (response) => response.url() === `${frontendUrl}/api/health` && response.request().method() === 'GET',
      ),
      page.getByRole('button', { name: 'Проверить соединение', exact: true }).click(),
    ]);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toMatch(/^application\/json\b/);
    expect(openapi.paths['/api/health'].get.responses['200'].content['application/json'].schema.$ref)
      .toBe('#/components/schemas/HealthResponse');

    const validate = new Ajv2020({ allErrors: true }).compile(openapi.components.schemas.HealthResponse);
    const body: unknown = await response.json();
    expect(validate(body), JSON.stringify(validate.errors)).toBe(true);
    await page.getByRole('status').filter({ hasText: 'Сервер доступен.' }).waitFor();
    expect(await page.getByRole('status').textContent()).toBe('Сервер доступен.');
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
            server.close((error) => error ? reject(error) : resolve());
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
