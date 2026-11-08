import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import {
  getHealth,
  meetingTypesCreateMeetingType,
  meetingTypesListMeetingTypes,
} from '@calendar/api-sdk';

const spec = JSON.parse(
  await readFile(new URL('../../specs/generated/openapi.json', import.meta.url), 'utf8'),
);
assert.equal(spec.openapi, '3.1.0');
assert.equal(spec.paths['/api/health'].get.operationId, 'getHealth');
assert.equal(
  spec.paths['/api/health'].get.responses['200'].content['application/json'].schema.$ref,
  '#/components/schemas/HealthResponse',
);
assert.deepEqual(spec.components.schemas.HealthResponse.properties.status.enum, ['ok']);
assert.deepEqual(spec.components.schemas.HealthResponse.required, ['status']);

// A transport fixture for the SDK, not the NestJS application.
const requests = [];
const meetingType = {
  id: '7d09f511-e6bb-4fda-8b7a-5602543d6790',
  name: 'Знакомство',
  description: '',
  durationMinutes: 30,
};
const validationError = {
  code: 'VALIDATION_ERROR',
  message: 'Проверьте поля запроса.',
  fieldErrors: [{ field: 'name', code: 'VALIDATION_ERROR', message: 'Введите название.' }],
};
const server = createServer(async (request, response) => {
  let text = '';
  for await (const chunk of request) text += chunk;
  const body = text ? JSON.parse(text) : undefined;
  requests.push({ method: request.method, url: request.url, ...(body ? { body } : {}) });
  if (request.url === '/api/meeting-types') {
    response.setHeader('content-type', 'application/json');
    if (request.method === 'GET') {
      response.writeHead(200).end(JSON.stringify({ items: [meetingType] }));
      return;
    }
    if (request.method === 'POST') {
      assert.equal(request.headers['content-type'], 'application/json');
      response
        .writeHead(body.name ? 201 : 400)
        .end(JSON.stringify(body.name ? meetingType : validationError));
      return;
    }
  }
  if (request.method !== 'GET' || request.url !== '/api/health') {
    response.writeHead(404).end();
    return;
  }
  response.writeHead(200, { 'content-type': 'application/json' });
  response.end(JSON.stringify({ status: 'ok' }));
});

try {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  const result = await getHealth({
    baseUrl: `http://127.0.0.1:${port}`,
    throwOnError: true,
    signal: AbortSignal.timeout(5000),
  });
  assert.equal(result.response.status, 200);
  assert.deepEqual(result.data, { status: 'ok' });
  assert.deepEqual(requests, [{ method: 'GET', url: '/api/health' }]);
  const baseUrl = `http://127.0.0.1:${port}`;
  const input = { name: 'Знакомство', durationMinutes: 30 };
  const created = await meetingTypesCreateMeetingType({ baseUrl, body: input, throwOnError: true });
  assert.equal(created.response.status, 201);
  assert.deepEqual(created.data, meetingType);
  const catalog = await meetingTypesListMeetingTypes({ baseUrl, throwOnError: true });
  assert.deepEqual(catalog.data, { items: [meetingType] });
  const invalid = await meetingTypesCreateMeetingType({
    baseUrl,
    body: { name: '', durationMinutes: 30 },
  });
  assert.equal(invalid.response.status, 400);
  assert.deepEqual(invalid.error, validationError);
  assert.deepEqual(requests.slice(1), [
    { method: 'POST', url: '/api/meeting-types', body: input },
    { method: 'GET', url: '/api/meeting-types' },
    { method: 'POST', url: '/api/meeting-types', body: { name: '', durationMinutes: 30 } },
  ]);
  assert.equal(
    spec.paths['/api/meeting-types'].post.requestBody.content['application/json'].schema.$ref,
    '#/components/schemas/CreateMeetingTypeRequest',
  );
  assert.equal(
    spec.paths['/api/meeting-types'].get.responses['200'].content['application/json'].schema
      .properties.items.items.$ref,
    '#/components/schemas/MeetingType',
  );
  assert.equal(
    spec.paths['/api/meeting-types'].post.responses['400'].content['application/json'].schema
      .properties.code.enum[0],
    'VALIDATION_ERROR',
  );
  console.log('PASS: OpenAPI 3.1, SDK GET/POST bodies, arrays and typed errors over real HTTP');
} finally {
  if (server.listening) {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
      server.closeAllConnections();
    });
  }
}
