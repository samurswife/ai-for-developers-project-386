import { expect, test } from 'vitest';
import { fileURLToPath } from 'node:url';
import { startBackend } from './apps.js';
import { Ajv2020 } from 'ajv/dist/2020.js';
import openapi from '../../specs/generated/openapi.json' with { type: 'json' };

const ajv = new Ajv2020({ allErrors: true, strictSchema: false });
ajv.addFormat('uuid', /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
ajv.addFormat('int32', {
  type: 'number',
  validate: (value: number) =>
    Number.isInteger(value) && value >= -2147483648 && value <= 2147483647,
});
const document = ajv.addSchema(openapi, 'api');

async function jsonResponse(response: Response, status: number, method: 'get' | 'post') {
  expect(response.status).toBe(status);
  expect(response.headers.get('content-type')).toMatch(/^application\/json\b/);
  const schema = document.compile({
    $ref: `api#/paths/~1api~1meeting-types/${method}/responses/${status}/content/application~1json/schema`,
  });
  const body = await response.json();
  expect(schema(body), JSON.stringify(schema.errors)).toBe(true);
  return body;
}

test('a fresh server returns an empty catalog', async () => {
  const backend = await startBackend();
  try {
    const response = await fetch(`${backend.url}/api/meeting-types`);
    expect(await jsonResponse(response, 200, 'get')).toEqual({ items: [] });
  } finally {
    await backend.close();
  }
});

test('field limits count Unicode characters rather than UTF-16 code units', async () => {
  const backend = await startBackend();
  try {
    const response = await fetch(`${backend.url}/api/meeting-types`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: `  ${'🌸'.repeat(100)}  `,
        description: '🌅'.repeat(2000),
        durationMinutes: 30,
      }),
    });
    const body = await jsonResponse(response, 201, 'post');
    expect(body.name).toBe('🌸'.repeat(100));
    expect(body.description).toBe('🌅'.repeat(2000));
  } finally {
    await backend.close();
  }
});

test('an unavailable UUID randomness source returns a contract 500 without leaking internal details', async () => {
  const backend = await startBackend([
    '--import',
    fileURLToPath(new URL('./fail-randomness.mjs', import.meta.url)),
  ]);
  try {
    const response = await fetch(`${backend.url}/api/meeting-types`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Знакомство', durationMinutes: 30 }),
    });
    expect(await jsonResponse(response, 500, 'post')).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'Не удалось выполнить запрос.',
    });
    expect(await jsonResponse(await fetch(`${backend.url}/api/meeting-types`), 200, 'get')).toEqual(
      { items: [] },
    );
  } finally {
    await backend.close();
  }
});

test('owner publishes a type, receives a UUID and guests see creation order including duplicate names', async () => {
  const backend = await startBackend();
  try {
    const items = [];
    for (const durationMinutes of [1, 540]) {
      const response = await fetch(`${backend.url}/api/meeting-types`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: `  ${'я'.repeat(100)}  `, durationMinutes }),
      });
      const body = await jsonResponse(response, 201, 'post');
      expect(body).toEqual({
        id: expect.stringMatching(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
        ),
        name: 'я'.repeat(100),
        description: '',
        durationMinutes,
      });
      items.push(body);
    }
    expect(items[0].id).not.toBe(items[1].id);
    const response = await fetch(`${backend.url}/api/meeting-types`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: '<b>Обычный текст</b>',
        description: `  ${'я'.repeat(1996)}  `,
        durationMinutes: 17,
      }),
    });
    items.push(await jsonResponse(response, 201, 'post'));
    expect(items[2].description).toBe(`  ${'я'.repeat(1996)}  `);
    expect(await jsonResponse(await fetch(`${backend.url}/api/meeting-types`), 200, 'get')).toEqual(
      { items },
    );
  } finally {
    await backend.close();
  }
});

test('malformed JSON has the same validation envelope and unsupported methods cannot publish', async () => {
  const backend = await startBackend();
  try {
    const response = await fetch(`${backend.url}/api/meeting-types`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{invalid',
    });
    expect((await jsonResponse(response, 400, 'post')).code).toBe('VALIDATION_ERROR');
    for (const method of ['PUT', 'PATCH', 'DELETE']) {
      expect((await fetch(`${backend.url}/api/meeting-types`, { method })).status).toBe(404);
    }
    expect(await jsonResponse(await fetch(`${backend.url}/api/meeting-types`), 200, 'get')).toEqual(
      { items: [] },
    );
  } finally {
    await backend.close();
  }
});

test('invalid request fields are rejected with a contract error and never published', async () => {
  const backend = await startBackend();
  const valid = { name: 'Знакомство', durationMinutes: 30 };
  const cases: [unknown, string][] = [
    [{ durationMinutes: 30 }, 'name'],
    [{ ...valid, name: '' }, 'name'],
    [{ ...valid, name: '   ' }, 'name'],
    [{ ...valid, name: 'я'.repeat(101) }, 'name'],
    [{ ...valid, name: null }, 'name'],
    [{ ...valid, name: 4 }, 'name'],
    [{ name: 'Встреча' }, 'durationMinutes'],
    ...[0, 541, 1.5, '30', null, false].map((durationMinutes): [unknown, string] => [
      { ...valid, durationMinutes },
      'durationMinutes',
    ]),
    ...[null, 5, false, 'я'.repeat(2001)].map((description): [unknown, string] => [
      { ...valid, description },
      'description',
    ]),
    [{ ...valid, extra: true }, 'extra'],
    [null, 'body'],
    [[], 'body'],
    ['string', 'body'],
  ];
  try {
    for (const [body, field] of cases) {
      const response = await fetch(`${backend.url}/api/meeting-types`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const error = await jsonResponse(response, 400, 'post');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.fieldErrors).toContainEqual({
        field,
        code: 'VALIDATION_ERROR',
        message: expect.any(String),
      });
    }
    expect(await jsonResponse(await fetch(`${backend.url}/api/meeting-types`), 200, 'get')).toEqual(
      { items: [] },
    );
  } finally {
    await backend.close();
  }
});
