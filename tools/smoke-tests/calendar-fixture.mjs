import { readFileSync } from 'node:fs';
const readState = () => JSON.parse(readFileSync(process.env.CALENDAR_TEST_STATE, 'utf8'));
// The process clock is an external boundary; application modules remain genuine.
const NativeDate = Date;
globalThis.Date = class extends NativeDate {
  constructor(...args) {
    super(...(args.length ? args : [readState().currentTime]));
  }
  static now() {
    return NativeDate.parse(readState().currentTime);
  }
};

// Until the public booking write exists, seed only the application data fixture.
const { calendar } = await import('../../apps/backend/dist/calendar.js');
calendar.bookings.push(...(readState().occupied ?? []));
