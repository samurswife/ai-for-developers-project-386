import { expect, test } from 'vitest';
import { Ajv2020 } from 'ajv/dist/2020.js';
import openapi from '../../specs/generated/openapi.json' with { type: 'json' };
import { startBackend } from './apps.js';
import { startCalendar } from './calendar.js';

const ajv = new Ajv2020({ allErrors: true, strictSchema: false });
ajv.addFormat('uuid', /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
ajv.addFormat('int32', { type: 'number', validate: Number.isInteger });
ajv.addFormat('date', /^\d{4}-\d{2}-\d{2}$/);
ajv.addFormat('date-time', {
  type: 'string',
  validate: (value: string) => /Z$/.test(value) && Number.isFinite(Date.parse(value)),
});
const document = ajv.addSchema(openapi, 'api');

async function jsonResponse(response: Response, status: number, slots = false) {
  expect(response.status).toBe(status);
  expect(response.headers.get('content-type')).toMatch(/^application\/json\b/);
  const path = '~1api~1meeting-types~1{id}' + (slots ? '~1slots' : '');
  const validate = document.compile({
    $ref: `api#/paths/${path}/get/responses/${status}/content/application~1json/schema`,
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

test('a published meeting type can be read by UUID; unknown types and malformed UUIDs have contract errors', async () => {
  const backend = await startBackend();
  try {
    const item = await publish(backend.url);
    expect(
      await jsonResponse(await fetch(`${backend.url}/api/meeting-types/${item.id}`), 200),
    ).toEqual(item);
    expect(
      await jsonResponse(
        await fetch(`${backend.url}/api/meeting-types/00000000-0000-4000-8000-000000000000`),
        404,
      ),
    ).toMatchObject({ code: 'MEETING_TYPE_NOT_FOUND' });
    expect(
      await jsonResponse(await fetch(`${backend.url}/api/meeting-types/not-a-uuid`), 400),
    ).toMatchObject({
      code: 'VALIDATION_ERROR',
      fieldErrors: [{ field: 'id', code: 'VALIDATION_ERROR', message: expect.any(String) }],
    });
  } finally {
    await backend.close();
  }
});

test('availability contains fourteen Moscow dates, sorted weekday slots and empty weekends, and advances at Moscow midnight', async () => {
  const backend = await startCalendar('2026-11-08T20:59:59.000Z');
  try {
    const item = await publish(backend.url);
    const read = async () =>
      jsonResponse(await fetch(`${backend.url}/api/meeting-types/${item.id}/slots`), 200, true);
    const before = await read();
    expect(before).toMatchObject({
      currentTime: '2026-11-08T20:59:59.000Z',
      timeZone: 'Europe/Moscow',
      windowStartDate: '2026-11-08',
      windowEndDate: '2026-11-21',
    });
    expect(before.days.map((day: { date: string }) => day.date)).toEqual([
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
    ]);
    expect(before.days.map((day: { slots: unknown[] }) => day.slots.length)).toEqual([
      0, 35, 35, 35, 35, 35, 0, 0, 35, 35, 35, 35, 35, 0,
    ]);
    expect(before.days[1].slots[0]).toEqual({
      startsAt: '2026-11-09T06:00:00.000Z',
      endsAt: '2026-11-09T06:30:00.000Z',
    });
    expect(before.days[1].slots[1]).toEqual({
      startsAt: '2026-11-09T06:15:00.000Z',
      endsAt: '2026-11-09T06:45:00.000Z',
    });
    expect(before.days[1].slots.at(-1)).toEqual({
      startsAt: '2026-11-09T14:30:00.000Z',
      endsAt: '2026-11-09T15:00:00.000Z',
    });
    await backend.setTime('2026-11-08T21:00:00.000Z');
    const after = await read();
    expect(after.currentTime).toBe('2026-11-08T21:00:00.000Z');
    expect(after.windowStartDate).toBe('2026-11-09');
    expect(after.windowEndDate).toBe('2026-11-22');
    expect(after.days).toHaveLength(14);
    expect(after.days.at(-1)).toEqual({ date: '2026-11-22', slots: [] });
    for (const [id, status, code] of [
      ['bad', 400, 'VALIDATION_ERROR'],
      ['00000000-0000-4000-8000-000000000000', 404, 'MEETING_TYPE_NOT_FOUND'],
    ] as const) {
      expect(
        await jsonResponse(
          await fetch(`${backend.url}/api/meeting-types/${id}/slots`),
          status,
          true,
        ),
      ).toMatchObject({ code });
    }
  } finally {
    await backend.close();
  }
});

test('all owner bookings exclude overlaps, including different types and begun intervals, while half-open adjacency remains free', async () => {
  const backend = await startCalendar('2026-11-09T06:10:00.000Z', [
    {
      meetingTypeId: 'another-type',
      startsAt: '2026-11-09T06:00:00.000Z',
      endsAt: '2026-11-09T06:20:00.000Z',
    },
    {
      meetingTypeId: 'another-type',
      startsAt: '2026-11-09T07:00:00.000Z',
      endsAt: '2026-11-09T07:30:00.000Z',
    },
    {
      meetingTypeId: 'another-type',
      startsAt: '2026-11-09T09:15:00.000Z',
      endsAt: '2026-11-09T09:20:00.000Z',
    },
  ]);
  try {
    const item = await publish(backend.url, 30);
    const body = await jsonResponse(
      await fetch(`${backend.url}/api/meeting-types/${item.id}/slots`),
      200,
      true,
    );
    expect(body.days[0].slots.slice(0, 3)).toEqual([
      { startsAt: '2026-11-09T06:30:00.000Z', endsAt: '2026-11-09T07:00:00.000Z' },
      { startsAt: '2026-11-09T07:30:00.000Z', endsAt: '2026-11-09T08:00:00.000Z' },
      { startsAt: '2026-11-09T07:45:00.000Z', endsAt: '2026-11-09T08:15:00.000Z' },
    ]);
    expect(body.days[0].slots.map((slot: { startsAt: string }) => slot.startsAt)).not.toContain(
      '2026-11-09T09:00:00.000Z',
    );
    expect(body.days[0].slots.map((slot: { startsAt: string }) => slot.startsAt)).not.toContain(
      '2026-11-09T09:15:00.000Z',
    );
    expect(body.days[0].slots).toContainEqual({
      startsAt: '2026-11-09T09:30:00.000Z',
      endsAt: '2026-11-09T10:00:00.000Z',
    });
  } finally {
    await backend.close();
  }
});

test('duration limits and non-grid duration keep the fixed start grid and exclude a start exactly now', async () => {
  const backend = await startCalendar('2026-11-09T05:59:00.000Z');
  try {
    const short = await publish(backend.url, 1);
    const uneven = await publish(backend.url, 17);
    const fullDay = await publish(backend.url, 540);
    const read = async (id: string) =>
      jsonResponse(await fetch(`${backend.url}/api/meeting-types/${id}/slots`), 200, true);
    const oneMinute = await read(short.id);
    expect(oneMinute.days[0].slots).toHaveLength(36);
    expect(oneMinute.days[0].slots[0]).toEqual({
      startsAt: '2026-11-09T06:00:00.000Z',
      endsAt: '2026-11-09T06:01:00.000Z',
    });
    expect(oneMinute.days[0].slots.at(-1)).toEqual({
      startsAt: '2026-11-09T14:45:00.000Z',
      endsAt: '2026-11-09T14:46:00.000Z',
    });
    const seventeen = await read(uneven.id);
    expect(seventeen.days[0].slots).toHaveLength(35);
    expect(seventeen.days[0].slots.slice(0, 2)).toEqual([
      { startsAt: '2026-11-09T06:00:00.000Z', endsAt: '2026-11-09T06:17:00.000Z' },
      { startsAt: '2026-11-09T06:15:00.000Z', endsAt: '2026-11-09T06:32:00.000Z' },
    ]);
    expect(seventeen.days[0].slots.at(-1)).toEqual({
      startsAt: '2026-11-09T14:30:00.000Z',
      endsAt: '2026-11-09T14:47:00.000Z',
    });
    expect((await read(fullDay.id)).days[0].slots).toEqual([
      { startsAt: '2026-11-09T06:00:00.000Z', endsAt: '2026-11-09T15:00:00.000Z' },
    ]);
    await backend.setTime('2026-11-09T06:15:00.000Z');
    const now = await read(short.id);
    expect(now.currentTime).toBe('2026-11-09T06:15:00.000Z');
    expect(now.days[0].slots[0]).toEqual({
      startsAt: '2026-11-09T06:30:00.000Z',
      endsAt: '2026-11-09T06:31:00.000Z',
    });
    expect(now.days[0].slots).toHaveLength(34);
    const full = await read(fullDay.id);
    expect(full.days[0].slots).toEqual([]);
    expect(full.days[1].slots).toEqual([
      { startsAt: '2026-11-10T06:00:00.000Z', endsAt: '2026-11-10T15:00:00.000Z' },
    ]);
  } finally {
    await backend.close();
  }
});

test('an occupied entire window is a successful availability with fourteen empty dates', async () => {
  const backend = await startCalendar('2026-11-08T12:00:00.000Z', [
    { startsAt: '2026-11-08T00:00:00.000Z', endsAt: '2026-11-22T00:00:00.000Z' },
  ]);
  try {
    const item = await publish(backend.url);
    const body = await jsonResponse(
      await fetch(`${backend.url}/api/meeting-types/${item.id}/slots`),
      200,
      true,
    );
    expect(body.days).toHaveLength(14);
    expect(body.days.every((day: { slots: unknown[] }) => day.slots.length === 0)).toBe(true);
  } finally {
    await backend.close();
  }
});
