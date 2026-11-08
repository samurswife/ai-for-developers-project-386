import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import {
  getHealth,
  bookingsCreateBooking,
  bookingsListUpcomingBookings,
  meetingTypesGetMeetingType,
  meetingTypesGetSlots,
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
let bookingCreated = false;
let savedBooking;
const server = createServer(async (request, response) => {
  let text = '';
  for await (const chunk of request) text += chunk;
  const body = text ? JSON.parse(text) : undefined;
  requests.push({ method: request.method, url: request.url, ...(body ? { body } : {}) });
  if (request.method === 'GET' && request.url === '/api/bookings/upcoming') {
    response
      .writeHead(200, { 'content-type': 'application/json' })
      .end(JSON.stringify({ items: savedBooking ? [savedBooking] : [] }));
    return;
  }
  if (request.method === 'POST' && request.url === '/api/bookings') {
    assert.equal(request.headers['content-type'], 'application/json');
    const conflict = {
      code: 'SLOT_CONFLICT',
      message: 'Это время уже занято. Выберите другой слот',
    };
    const booking = {
      id: 'f07a5448-2aad-4ca2-b809-5589161cfaf4',
      meetingType,
      startsAt: '2026-11-09T06:00:00.000Z',
      endsAt: '2026-11-09T06:30:00.000Z',
      guestName: body.guestName,
      guestEmail: body.guestEmail,
    };
    response
      .writeHead(bookingCreated ? 409 : 201, { 'content-type': 'application/json' })
      .end(JSON.stringify(bookingCreated ? conflict : booking));
    if (!bookingCreated) savedBooking = booking;
    bookingCreated = true;
    return;
  }
  if (request.method === 'GET' && request.url === `/api/meeting-types/${meetingType.id}`) {
    response
      .writeHead(200, { 'content-type': 'application/json' })
      .end(JSON.stringify(meetingType));
    return;
  }
  if (request.method === 'GET' && request.url === `/api/meeting-types/${meetingType.id}/slots`) {
    const dates = [
      '2026-11-08',
      '2026-11-09',
      '2026-11-10',
      '2026-11-11',
      '2026-11-12',
      '2026-11-13',
      '2026-11-14',
      '2026-11-15',
      '2026-11-16',
      '2026-11-17',
      '2026-11-18',
      '2026-11-19',
      '2026-11-20',
      '2026-11-21',
    ];
    response.writeHead(200, { 'content-type': 'application/json' }).end(
      JSON.stringify({
        currentTime: '2026-11-08T12:00:00.000Z',
        timeZone: 'Europe/Moscow',
        windowStartDate: '2026-11-08',
        windowEndDate: '2026-11-21',
        days: dates.map((date) => ({
          date,
          slots:
            date === '2026-11-09'
              ? [{ startsAt: '2026-11-09T06:00:00.000Z', endsAt: '2026-11-09T06:30:00.000Z' }]
              : [],
        })),
      }),
    );
    return;
  }
  if (
    request.method === 'GET' &&
    request.url === '/api/meeting-types/00000000-0000-4000-8000-000000000000/slots'
  ) {
    response
      .writeHead(404, { 'content-type': 'application/json' })
      .end(JSON.stringify({ code: 'MEETING_TYPE_NOT_FOUND', message: 'Тип встречи не найден.' }));
    return;
  }
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
  const read = await meetingTypesGetMeetingType({
    baseUrl,
    path: { id: meetingType.id },
    throwOnError: true,
  });
  assert.deepEqual(read.data, meetingType);
  const slots = await meetingTypesGetSlots({
    baseUrl,
    path: { id: meetingType.id },
    throwOnError: true,
  });
  assert.equal(slots.data.currentTime, '2026-11-08T12:00:00.000Z');
  assert.equal(slots.data.timeZone, 'Europe/Moscow');
  assert.equal(slots.data.windowStartDate, '2026-11-08');
  assert.equal(slots.data.windowEndDate, '2026-11-21');
  assert.equal(slots.data.days.length, 14);
  assert.deepEqual(slots.data.days[1], {
    date: '2026-11-09',
    slots: [{ startsAt: '2026-11-09T06:00:00.000Z', endsAt: '2026-11-09T06:30:00.000Z' }],
  });
  const missing = await meetingTypesGetSlots({
    baseUrl,
    path: { id: '00000000-0000-4000-8000-000000000000' },
  });
  assert.equal(missing.response.status, 404);
  assert.equal(missing.error.code, 'MEETING_TYPE_NOT_FOUND');
  assert.deepEqual(requests.slice(-3), [
    { method: 'GET', url: `/api/meeting-types/${meetingType.id}` },
    { method: 'GET', url: `/api/meeting-types/${meetingType.id}/slots` },
    { method: 'GET', url: '/api/meeting-types/00000000-0000-4000-8000-000000000000/slots' },
  ]);
  for (const path of ['/api/meeting-types/{id}', '/api/meeting-types/{id}/slots']) {
    assert.equal(spec.paths[path].get.parameters[0].name, 'id');
    assert.equal(spec.paths[path].get.parameters[0].in, 'path');
    assert.equal(spec.paths[path].get.parameters[0].schema.format, 'uuid');
    assert.equal(
      spec.paths[path].get.responses['404'].content['application/json'].schema.properties.code
        .enum[0],
      'MEETING_TYPE_NOT_FOUND',
    );
  }
  assert.equal(spec.components.schemas.MoscowDate.format, 'date');
  assert.equal(spec.components.schemas.UtcInstant.format, 'date-time');
  assert.equal(spec.components.schemas.UtcInstant.pattern, 'Z$');
  const bookingInput = {
    meetingTypeId: meetingType.id,
    startsAt: '2026-11-09T09:00:00+03:00',
    guestName: 'Анна',
    guestEmail: 'Anna@example.com',
  };
  const booked = await bookingsCreateBooking({ baseUrl, body: bookingInput });
  assert.equal(booked.response.status, 201);
  assert.deepEqual(booked.data, {
    id: 'f07a5448-2aad-4ca2-b809-5589161cfaf4',
    meetingType,
    startsAt: '2026-11-09T06:00:00.000Z',
    endsAt: '2026-11-09T06:30:00.000Z',
    guestName: 'Анна',
    guestEmail: 'Anna@example.com',
  });
  const conflict = await bookingsCreateBooking({ baseUrl, body: bookingInput });
  assert.equal(conflict.response.status, 409);
  assert.deepEqual(conflict.error, {
    code: 'SLOT_CONFLICT',
    message: 'Это время уже занято. Выберите другой слот',
  });
  assert.deepEqual(requests.slice(-2), [
    { method: 'POST', url: '/api/bookings', body: bookingInput },
    { method: 'POST', url: '/api/bookings', body: bookingInput },
  ]);
  assert.equal(
    spec.paths['/api/bookings'].post.requestBody.content['application/json'].schema.$ref,
    '#/components/schemas/CreateBookingRequest',
  );
  assert.equal(
    spec.paths['/api/bookings'].post.responses['201'].content['application/json'].schema.$ref,
    '#/components/schemas/Booking',
  );
  assert.equal(
    spec.components.schemas.Booking.properties.meetingType.$ref,
    '#/components/schemas/MeetingType',
  );
  assert.equal(
    spec.components.schemas.Booking.properties.startsAt.$ref,
    '#/components/schemas/UtcInstant',
  );
  assert.equal(
    spec.paths['/api/bookings'].post.responses['400'].content['application/json'].schema.anyOf
      .length,
    2,
  );
  const upcoming = await bookingsListUpcomingBookings({ baseUrl });
  assert.equal(upcoming.response.status, 200);
  assert.deepEqual(upcoming.data, { items: [booked.data] });
  assert.deepEqual(requests.at(-1), { method: 'GET', url: '/api/bookings/upcoming' });
  assert.equal(
    spec.paths['/api/bookings/upcoming'].get.responses['200'].content['application/json'].schema
      .properties.items.items.$ref,
    '#/components/schemas/Booking',
  );
  console.log(
    'PASS: OpenAPI 3.1, SDK GET/POST bodies, UUID paths, UTC instants, Moscow dates, arrays and typed errors over real HTTP',
  );
} finally {
  if (server.listening) {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
      server.closeAllConnections();
    });
  }
}
