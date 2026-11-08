import { expect, test } from 'vitest';
import { Ajv2020 } from 'ajv/dist/2020.js';
import openapi from '../../specs/generated/openapi.json' with { type: 'json' };
import { startCalendar } from './calendar.js';
import { fileURLToPath } from 'node:url';

const ajv = new Ajv2020({ allErrors: true, strictSchema: false });
ajv.addFormat('uuid', /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
ajv.addFormat('int32', { type: 'number', validate: Number.isInteger });
ajv.addFormat('date', /^\d{4}-\d{2}-\d{2}$/);
ajv.addFormat('date-time', {
  type: 'string',
  validate: (s: string) => /Z$/.test(s) && Number.isFinite(Date.parse(s)),
});
const document = ajv.addSchema(openapi, 'api');

async function responseJson(response: Response, status: number, upcoming = false) {
  expect(response.status).toBe(status);
  expect(response.headers.get('content-type')).toMatch(/^application\/json\b/);
  const validate = document.compile({
    $ref: `api#/paths/${upcoming ? '~1api~1bookings~1upcoming/get' : '~1api~1bookings/post'}/responses/${status}/content/application~1json/schema`,
  });
  const body = await response.json();
  expect(validate(body), JSON.stringify(validate.errors)).toBe(true);
  return body;
}

async function publish(url: string, durationMinutes = 30) {
  const response = await fetch(`${url}/api/meeting-types`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Знакомство', durationMinutes }),
  });
  expect(response.status).toBe(201);
  return response.json();
}

function request(url: string, body: unknown) {
  return fetch(`${url}/api/bookings`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const guest = { guestName: '  Анна  ', guestEmail: '  Anna@Example.com  ' };

test('upcoming list starts empty and reads a genuine saved booking with all nested fields', async () => {
  const backend = await startCalendar('2026-11-09T05:00:00.000Z');
  try {
    const read = () => fetch(`${backend.url}/api/bookings/upcoming`);
    expect(await responseJson(await read(), 200, true)).toEqual({ items: [] });
    const item = await publish(backend.url, 17);
    const booking = await responseJson(
      await request(backend.url, {
        meetingTypeId: item.id,
        startsAt: '2026-11-09T06:00:00Z',
        ...guest,
      }),
      201,
    );
    expect(await responseJson(await read(), 200, true)).toEqual({ items: [booking] });
  } finally {
    await backend.close();
  }
});

test('upcoming combines all types chronologically, excludes begun and exact-now starts, and includes dates outside the new-booking window', async () => {
  const backend = await startCalendar('2026-11-23T05:00:00.000Z');
  try {
    const long = await publish(backend.url, 60);
    const short = await publish(backend.url, 17);
    const book = async (id: string, startsAt: string, guestName: string) =>
      responseJson(
        await request(backend.url, {
          meetingTypeId: id,
          startsAt,
          guestName,
          guestEmail: `${guestName}@example.com`,
        }),
        201,
      );
    const outside = await book(long.id, '2026-12-04T06:00:00Z', 'Far');
    await backend.setTime('2026-11-09T05:00:00.000Z');
    const tomorrow = await book(short.id, '2026-11-10T06:00:00Z', 'Tomorrow');
    const next = await book(long.id, '2026-11-09T07:00:00Z', 'Next');
    await book(short.id, '2026-11-09T06:30:00Z', 'Now');
    await book(short.id, '2026-11-09T06:00:00Z', 'Begun');
    await backend.setTime('2026-11-09T06:30:00.000Z');
    expect(
      await responseJson(await fetch(`${backend.url}/api/bookings/upcoming`), 200, true),
    ).toEqual({ items: [next, tomorrow, outside] });
    await backend.setTime('2026-11-09T06:40:00.000Z');
    expect(
      await responseJson(await fetch(`${backend.url}/api/bookings/upcoming`), 200, true),
    ).toEqual({ items: [next, tomorrow, outside] });
    await backend.setTime('2026-12-04T06:00:00.000Z');
    expect(
      await responseJson(await fetch(`${backend.url}/api/bookings/upcoming`), 200, true),
    ).toEqual({ items: [] });
  } finally {
    await backend.close();
  }
});

test('a genuine booking server failure has the generated 500 contract and does not occupy the slot', async () => {
  const backend = await startCalendar('2026-11-09T05:00:00.000Z', [
    '--import',
    fileURLToPath(new URL('./fail-booking-randomness.mjs', import.meta.url)),
  ]);
  try {
    const item = await publish(backend.url);
    expect(
      await responseJson(
        await request(backend.url, {
          meetingTypeId: item.id,
          startsAt: '2026-11-09T06:00:00Z',
          ...guest,
        }),
        500,
      ),
    ).toEqual({ code: 'INTERNAL_ERROR', message: 'Не удалось выполнить запрос.' });
    const slots = await (await fetch(`${backend.url}/api/meeting-types/${item.id}/slots`)).json();
    expect(slots.days[0].slots[0].startsAt).toBe('2026-11-09T06:00:00.000Z');
  } finally {
    await backend.close();
  }
});

test('booking accepts one-minute and whole-day durations, maximum trimmed fields, zero fractional seconds and equivalent offsets', async () => {
  const backend = await startCalendar('2026-11-09T05:00:00.000Z');
  try {
    const full = await publish(backend.url, 540);
    expect(
      await responseJson(
        await request(backend.url, {
          meetingTypeId: full.id,
          startsAt: '2026-11-09T09:00:00.0000+03:00',
          guestName: 'Я'.repeat(100),
          guestEmail: `${'a'.repeat(242)}@example.com`,
        }),
        201,
      ),
    ).toMatchObject({ startsAt: '2026-11-09T06:00:00.000Z', endsAt: '2026-11-09T15:00:00.000Z' });
    const short = await publish(backend.url, 1);
    expect(
      await responseJson(
        await request(backend.url, {
          meetingTypeId: short.id,
          startsAt: '2026-11-10T12:45:00-05:00',
          ...guest,
        }),
        400,
      ),
    ).toMatchObject({ code: 'INVALID_TIME' });
    expect(
      await responseJson(
        await request(backend.url, {
          meetingTypeId: short.id,
          startsAt: '2026-11-10T09:45:00-05:00',
          ...guest,
        }),
        201,
      ),
    ).toMatchObject({ startsAt: '2026-11-10T14:45:00.000Z', endsAt: '2026-11-10T14:46:00.000Z' });
  } finally {
    await backend.close();
  }
});

test('two concurrent overlapping requests share one store: one creation, one conflict, only one interval occupied', async () => {
  const backend = await startCalendar('2026-11-09T05:00:00.000Z');
  try {
    const item = await publish(backend.url);
    const results = await Promise.all(
      ['2026-11-09T09:00:00+03:00', '2026-11-09T09:15:00+03:00'].map((startsAt) =>
        request(backend.url, { meetingTypeId: item.id, startsAt, ...guest }),
      ),
    );
    expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
    const bodies = await Promise.all(results.map((result) => responseJson(result, result.status)));
    expect(
      await responseJson(await fetch(`${backend.url}/api/bookings/upcoming`), 200, true),
    ).toEqual({ items: [bodies[results.findIndex((result) => result.status === 201)]] });
    // With exactly one insertion, the adjacent slot at the loser's outer boundary remains free.
    const slots = await (await fetch(`${backend.url}/api/meeting-types/${item.id}/slots`)).json();
    const winner = results.findIndex((result) => result.status === 201);
    const boundary = winner === 0 ? '2026-11-09T06:30:00.000Z' : '2026-11-09T06:45:00.000Z';
    expect(
      slots.days[0].slots.some((slot: { startsAt: string }) => slot.startsAt === boundary),
    ).toBe(true);
    expect(
      await responseJson(
        await request(backend.url, {
          meetingTypeId: item.id,
          startsAt: winner === 0 ? '2026-11-09T06:00:00Z' : '2026-11-09T06:15:00Z',
          guestName: 'Другой',
          guestEmail: 'other@example.com',
        }),
        409,
      ),
    ).toMatchObject({ code: 'SLOT_CONFLICT' });
  } finally {
    await backend.close();
  }
});

test('different types conflict for 60 minutes at 10:00 and 30 minutes at 10:30; adjacent time is allowed', async () => {
  const backend = await startCalendar('2026-11-09T05:00:00.000Z');
  try {
    const long = await publish(backend.url, 60);
    const short = await publish(backend.url, 30);
    const book = (id: string, startsAt: string) =>
      request(backend.url, { meetingTypeId: id, startsAt, ...guest });
    await responseJson(await book(long.id, '2026-11-09T10:00:00+03:00'), 201);
    for (const start of [
      '2026-11-09T10:30:00+03:00',
      '2026-11-09T09:45:00+03:00',
      '2026-11-09T10:00:00+03:00',
    ]) {
      expect(await responseJson(await book(short.id, start), 409)).toMatchObject({
        code: 'SLOT_CONFLICT',
      });
    }
    expect(await responseJson(await book(long.id, '2026-11-09T07:00:00Z'), 409)).toMatchObject({
      code: 'SLOT_CONFLICT',
    });
    await responseJson(await book(short.id, '2026-11-09T11:00:00+03:00'), 201);
    await backend.setTime('2026-11-09T07:10:00.000Z');
    expect(
      await responseJson(await book(short.id, '2026-11-09T10:15:00+03:00'), 409),
    ).toMatchObject({ code: 'SLOT_CONFLICT' });
    expect(await responseJson(await book(long.id, '2026-11-09T10:00:00+03:00'), 400)).toMatchObject(
      { code: 'INVALID_TIME' },
    );
  } finally {
    await backend.close();
  }
});

test('booking rechecks strict instants, Moscow grid, hours, future and rolling window using server time', async () => {
  const backend = await startCalendar('2026-11-09T05:00:00.000Z');
  try {
    const item = await publish(backend.url, 30);
    const book = (startsAt: string) =>
      request(backend.url, { meetingTypeId: item.id, startsAt, ...guest });
    for (const start of [
      'nonsense',
      '',
      '2026-11-09T09:00:00',
      '2026-11-09',
      '2026-11-09T06:00:01Z',
      '2026-11-09T06:00:00.001Z',
      '2026-11-09T06:05:00Z',
      '2026-11-09T05:45:00Z',
      '2026-11-09T14:45:00Z',
      '2026-11-14T06:00:00Z',
      '2026-11-23T06:00:00Z',
      '2026-02-30T06:00:00Z',
    ]) {
      expect(await responseJson(await book(start), 400), start).toMatchObject({
        code: 'INVALID_TIME',
      });
    }
    expect(await responseJson(await book('2026-11-09T14:30:00.000Z'), 201)).toMatchObject({
      endsAt: '2026-11-09T15:00:00.000Z',
    });
    await backend.setTime('2026-11-09T06:00:00.000Z');
    expect(await responseJson(await book('2026-11-09T06:00:00Z'), 400)).toMatchObject({
      code: 'INVALID_TIME',
    });
    await backend.setTime('2026-11-22T21:00:00.000Z');
    expect(await responseJson(await book('2026-11-09T06:00:00Z'), 400)).toMatchObject({
      code: 'INVALID_TIME',
    });
  } finally {
    await backend.close();
  }
});

test('booking rejects malformed fields before lookup and reports an unknown valid UUID before invalid time', async () => {
  const backend = await startCalendar('2026-11-09T05:00:00.000Z');
  try {
    const item = await publish(backend.url);
    const valid = { meetingTypeId: item.id, startsAt: '2026-11-09T06:00:00Z', ...guest };
    for (const body of [
      null,
      [],
      {},
      { ...valid, extra: true },
      { ...valid, meetingTypeId: 'bad' },
      { ...valid, startsAt: null },
      { ...valid, startsAt: 42 },
      { ...valid, guestName: ' ' },
      { ...valid, guestName: 'Я'.repeat(101) },
      { ...valid, guestName: null },
      { ...valid, guestEmail: 'wrong' },
      { ...valid, guestEmail: null },
      { ...valid, guestEmail: `${'a'.repeat(243)}@example.com` },
    ]) {
      expect(await responseJson(await request(backend.url, body), 400)).toMatchObject({
        code: 'VALIDATION_ERROR',
        fieldErrors: expect.any(Array),
      });
    }
    expect(
      await responseJson(
        await request(backend.url, {
          ...valid,
          meetingTypeId: '00000000-0000-4000-8000-000000000000',
          startsAt: 'invalid',
        }),
        404,
      ),
    ).toMatchObject({ code: 'MEETING_TYPE_NOT_FOUND' });
    expect(
      await responseJson(
        await request(backend.url, {
          ...valid,
          meetingTypeId: '00000000-0000-4000-8000-000000000000',
          startsAt: false,
        }),
        400,
      ),
    ).toMatchObject({ code: 'VALIDATION_ERROR' });
  } finally {
    await backend.close();
  }
});

test('booking computes its end, trims guest fields and returns a nested type and UTC instants', async () => {
  const backend = await startCalendar('2026-11-09T05:00:00.000Z');
  try {
    const item = await publish(backend.url, 17);
    const booking = await responseJson(
      await request(backend.url, {
        meetingTypeId: item.id,
        startsAt: '2026-11-09T09:00:00+03:00',
        ...guest,
      }),
      201,
    );
    expect(booking).toEqual({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      meetingType: item,
      startsAt: '2026-11-09T06:00:00.000Z',
      endsAt: '2026-11-09T06:17:00.000Z',
      guestName: 'Анна',
      guestEmail: 'Anna@Example.com',
    });
    const slots = await (await fetch(`${backend.url}/api/meeting-types/${item.id}/slots`)).json();
    expect(slots.days[0].slots[0].startsAt).toBe('2026-11-09T06:30:00.000Z');
  } finally {
    await backend.close();
  }
});
