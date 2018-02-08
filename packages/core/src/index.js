/**
 * Created by arolave on 10/04/2017.
 */
import preconfigure from './factory';
import uuid from './source-generators/uuid';
import env from './source-generators/env';

const configureStellar = preconfigure({ defaultSourceGenerator: 'uuid', sourceGenerators: { uuid, env } });

export { configureStellar };
export { logger } from './logger';
export { StellarError } from './StellarError';
export { default as StellarCore } from './StellarCore';
export { default as StellarPubSub } from './StellarPubSub';
export { default as StellarRequest } from './StellarRequest';
export { default as StellarHandler } from './StellarHandler';
export { default as MessagingAdaptor } from './MessagingAdaptor';
export { uuid };
