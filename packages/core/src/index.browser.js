/**
 * Created by arolave on 10/04/2017.
 */
import Promise from 'bluebird';

import preconfigure from './factory';
import browser from './source-generators/browser';

function setBluebirdScheduler(fn) {
  Promise.setScheduler(fn);
}

function setBluebirdConfig(values) {
  Promise.config(values);
}

const configureStellar = preconfigure({ defaultSourceGenerator: 'browser', sourceGenerators: { browser } });

export { logger } from './logger';
export { StellarError } from './StellarError';
export { default as StellarCore } from './StellarCore';
export { default as StellarPubSub } from './StellarPubSub';
export { default as StellarRequest } from './StellarRequest';
export { default as StellarHandler } from './StellarHandler';
export { setBluebirdScheduler, setBluebirdConfig, configureStellar, browser };
