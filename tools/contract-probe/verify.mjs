import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { getHealth } from '@calendar/api-sdk';

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
const server = createServer((request, response) => {
  requests.push({ method: request.method, url: request.url });
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
  console.log('PASS: OpenAPI 3.1 shape and generated SDK over real HTTP');
} finally {
  if (server.listening) {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
      server.closeAllConnections();
    });
  }
}
