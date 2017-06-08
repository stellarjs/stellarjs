/**
 * Created by arolave on 10/04/2017.
 */
import { setSourceGenerators, configureStellar } from './factory';
import uuid from './source-generators/uuid';
import amazonEc2 from './source-generators/amazonEc2';

function configure(arg) {
  setSourceGenerators('uuid', { uuid, amazonEc2 });
  return configureStellar(arg);
}

export { configure as configureStellar };
export { logger } from './logger';
export { StellarError } from './StellarError';
export { default as StellarCore } from './StellarCore';
export { default as StellarPubSub } from './StellarPubSub';
export { default as StellarRequest } from './StellarRequest';
export { default as StellarHandler } from './StellarHandler';
export { uuid, amazonEc2 };
export {
  stellarRequest,
  stellarHandler,
  stellarAppPubSub,
  stellarNodePubSub,
  stellarPublish,
  stellarSubscribe,
  stellarSource,
  resetCache,
  setSourceGenerators,
} from './factory';

