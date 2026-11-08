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
