import crypto from 'node:crypto';
import { syncBuiltinESMExports } from 'node:module';

// Fault injection at the operating-system randomness boundary, before Nest starts.
// The real controller, store and exception filter remain unchanged.
crypto.randomUUID = () => {
  throw new Error('Randomness source unavailable');
};
syncBuiltinESMExports();
