import crypto from 'node:crypto';
import { syncBuiltinESMExports } from 'node:module';

// Publish one meeting type, then fail at the OS randomness boundary on booking.
const nativeRandomUUID = crypto.randomUUID;
let calls = 0;
crypto.randomUUID = (...args) => {
  if (calls++ === 0) return nativeRandomUUID(...args);
  throw new Error('Randomness source unavailable');
};
syncBuiltinESMExports();
