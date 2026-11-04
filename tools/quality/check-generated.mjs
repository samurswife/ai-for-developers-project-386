import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const temporary = await mkdtemp(join(tmpdir(), 'calendar-generated-'));

async function files(directory, relative = '') {
  const found = [];
  for (const entry of await readdir(join(directory, relative), { withFileTypes: true })) {
    const name = join(relative, entry.name);
    if (entry.isDirectory()) found.push(...(await files(directory, name)));
    else found.push(name);
  }
  return found.sort();
}

async function compare(actual, expected) {
  const actualFiles = await files(actual);
  assert.deepEqual(actualFiles, await files(expected), `Generated file list differs: ${actual}`);
  for (const name of actualFiles) {
    assert.ok(
      (await readFile(join(actual, name))).equals(await readFile(join(expected, name))),
      `Generated file differs: ${join(actual, name)}. Run mise run generate.`,
    );
  }
}

try {
  execFileSync(
    'pnpm',
    [
      '--filter',
      '@calendar/contract',
      'exec',
      'tsp',
      'compile',
      '.',
      '--option',
      `@typespec/openapi3.emitter-output-dir=${join(temporary, 'openapi')}`,
    ],
    { cwd: root, stdio: 'inherit' },
  );
  execFileSync(
    'pnpm',
    [
      '--filter',
      '@calendar/api-sdk',
      'exec',
      'openapi-ts',
      '--input',
      join(temporary, 'openapi/openapi.json'),
      '--output',
      join(temporary, 'sdk'),
      '--no-log-file',
    ],
    { cwd: root, stdio: 'inherit' },
  );
  await compare(join(root, 'specs/generated'), join(temporary, 'openapi'));
  await compare(join(root, 'packages/api-sdk/src/generated'), join(temporary, 'sdk'));
  console.log('Generated OpenAPI and SDK match the TypeSpec contract.');
} finally {
  await rm(temporary, { recursive: true, force: true });
}
