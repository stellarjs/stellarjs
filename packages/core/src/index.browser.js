/**
 * Created by arolave on 10/04/2017.
 */
import Promise from 'bluebird';

import { setSourceGenerators } from './factory';
import browser from './source-generators/browser';

function setBluebirdScheduler(fn) {
  Promise.setScheduler(fn);
}

setSourceGenerators('browser', { browser });

export { setBluebirdScheduler };
export { logger } from './logger';
export { StellarError } from './StellarError';
export { default as StellarCore } from './StellarCore';
export { default as StellarPubSub } from './StellarPubSub';
export { default as StellarRequest } from './StellarRequest';
export { default as StellarHandler } from './StellarHandler';
export * from './factory';
export { browser };
