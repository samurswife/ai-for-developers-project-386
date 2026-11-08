import { mkdtemp, writeFile, rename, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startBackend } from './apps.js';

export async function startCalendar(currentTime: string, extraNodeArgs: string[] = []) {
  const directory = await mkdtemp(join(tmpdir(), 'calendar-test-'));
  const path = join(directory, 'state.json');
  await writeFile(path, JSON.stringify({ currentTime }));
  try {
    const backend = await startBackend(
      [
        '--import',
        fileURLToPath(new URL('./calendar-fixture.mjs', import.meta.url)),
        ...extraNodeArgs,
      ],
      { CALENDAR_TEST_STATE: path },
    );
    return {
      ...backend,
      setTime: async (nextTime: string) => {
        await writeFile(`${path}.next`, JSON.stringify({ currentTime: nextTime }));
        await rename(`${path}.next`, path);
      },
      close: async () => {
        try {
          await backend.close();
        } finally {
          await rm(directory, { recursive: true, force: true });
        }
      },
    };
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}

/** Fill each working date by genuine public writes, with no in-process seeds. */
export async function fillCalendarWindow(url: string) {
  const typeResponse = await fetch(`${url}/api/meeting-types`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Рабочий день', durationMinutes: 540 }),
  });
  if (typeResponse.status !== 201) throw new Error('Cannot publish full-day meeting type');
  const item = await typeResponse.json();
  const availability = await (await fetch(`${url}/api/meeting-types/${item.id}/slots`)).json();
  for (const day of availability.days)
    for (const slot of day.slots) {
      const response = await fetch(`${url}/api/bookings`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          meetingTypeId: item.id,
          startsAt: slot.startsAt,
          guestName: 'Занято',
          guestEmail: 'busy@example.com',
        }),
      });
      if (response.status !== 201) throw new Error(`Cannot book working date ${day.date}`);
    }
}
