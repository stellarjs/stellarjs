/**
 * Created by arolave on 10/04/2017.
 */
import preconfigure from './factory';
import nanoid from './source-generators/nanoid';
import env from './source-generators/env';

const configureStellar = preconfigure({ defaultSourceGenerator: 'nanoid', sourceGenerators: { nanoid, env } });

export { configureStellar };
export { default as StellarCore } from './StellarCore';
export { default as StellarPubSub } from './StellarPubSub';
export { default as StellarRequest } from './StellarRequest';
export { default as StellarHandler } from './StellarHandler';
export { default as standardizeObjectFactory } from './utils/standardizeObject';
