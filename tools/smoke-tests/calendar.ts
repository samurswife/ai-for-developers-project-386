import { mkdtemp, writeFile, rename, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startBackend } from './apps.js';

export async function startCalendar(
  currentTime: string,
  occupied: { startsAt: string; endsAt: string; meetingTypeId?: string }[] = [],
) {
  const directory = await mkdtemp(join(tmpdir(), 'calendar-test-'));
  const path = join(directory, 'state.json');
  await writeFile(path, JSON.stringify({ currentTime, occupied }));
  try {
    const backend = await startBackend(
      ['--import', fileURLToPath(new URL('./calendar-fixture.mjs', import.meta.url))],
      { CALENDAR_TEST_STATE: path },
    );
    return {
      ...backend,
      setTime: async (nextTime: string) => {
        await writeFile(`${path}.next`, JSON.stringify({ currentTime: nextTime, occupied }));
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
