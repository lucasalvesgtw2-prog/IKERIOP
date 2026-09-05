import { type Redis } from 'ioredis';
import { getEnv } from '../config/env.js';
import { ConfigurationError } from '../core/errors.js';
import { createLogger } from '../core/logger.js';
import { type Signer } from './Signer.js';
import { MockSigner } from './mockSigner.js';
import { ManualSigner } from './manualSigner.js';

const log = createLogger('signer');

/**
 * Builds the configured signer.
 *
 * Env validation already refuses SIGNER_BACKEND=mock while LIVE_MODE=true;
 * this is the second check, made where the signer is actually constructed.
 */
export function createSigner(redis: Redis): Signer {
  const env = getEnv();

  switch (env.SIGNER_BACKEND) {
    case 'manual':
      return new ManualSigner(redis);

    case 'external':
      throw new ConfigurationError(
        'SIGNER_BACKEND=external is declared but no external signer adapter is installed. ' +
          'Implement the Signer interface for your signing service and register it here.',
      );

    case 'mock':
    default:
      if (env.LIVE_MODE) {
        throw new ConfigurationError('The mock signer cannot be used while LIVE_MODE=true');
      }
      log.warn('using the MOCK signer — payouts are simulated and no funds move');
      return new MockSigner(redis);
  }
}

export { type Signer, type PayoutRequest, type BroadcastResult } from './Signer.js';
export { MockSigner } from './mockSigner.js';
export { ManualSigner, ManualBroadcastRequired } from './manualSigner.js';
