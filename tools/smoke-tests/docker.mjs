import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('../../', import.meta.url));
const image = 'calendar-calls:docker-test';
const docker = (...args) => execFileSync('docker', args, { cwd: root, encoding: 'utf8' }).trim();

async function waitForHealth(url) {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const response = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(1000) });
      if (response.ok && (await response.json()).status === 'ok') return;
    } catch {
      // A newly started container might not have bound its port yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Container did not become healthy at ${url}`);
}

execFileSync('docker', ['build', '-t', image, '.'], { cwd: root, stdio: 'inherit' });
assert.equal(docker('image', 'inspect', '--format', '{{.Config.User}}', image), 'node');
for (const port of [8080, 10000]) {
  const id = docker(
    'run',
    '--detach',
    '--rm',
    '-e',
    `PORT=${port}`,
    '-p',
    `127.0.0.1::${port}`,
    image,
  );
  try {
    let url = `http://${docker('port', id, `${port}/tcp`)}`;
    await waitForHealth(url);
    assert.match(await (await fetch(url)).text(), /<title>Запись на звонок<\/title>/);
    if (port === 8080) {
      execFileSync('pnpm', ['exec', 'vitest', 'run', 'production.smoke.test.ts'], {
        cwd: fileURLToPath(new URL('./', import.meta.url)),
        env: { ...process.env, DEPLOYMENT_URL: url },
        stdio: 'inherit',
      });
      docker('restart', id);
      url = `http://${docker('port', id, `${port}/tcp`)}`;
      await waitForHealth(url);
      for (const path of ['/api/meeting-types', '/api/bookings/upcoming']) {
        const response = await fetch(`${url}${path}`);
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { items: [] });
      }
    }
    console.log(`Docker: PORT=${port}, automatic startup and HTTP checks passed`);
  } finally {
    console.log(docker('logs', id));
    docker('stop', id);
  }
}
