/**
 * Created by arolave on 10/04/2017.
 */
import { setSourceGenerators, configureStellar } from './factory';
import uuid from './source-generators/uuid';

function configure(arg) {
  setSourceGenerators('uuid', { uuid });
  return configureStellar(arg);
}

export { configure as configureStellar };
export { logger } from './logger';
export { StellarError } from './StellarError';
export { default as StellarCore } from './StellarCore';
export { default as StellarPubSub } from './StellarPubSub';
export { default as StellarRequest } from './StellarRequest';
export { default as StellarHandler } from './StellarHandler';
export { uuid };
export {
  stellarRequest,
  stellarHandler,
  stellarAppPubSub,
  getSource,
  setSourceGenerators,
} from './factory';

