/**
 * Created by arolave on 06/10/2016.
 */
import transportFactoryConfig from '@gf-stellarjs/abstract-transport-queue';

import BullRedisQueueSystem from './BullRedisQueueSystem';
import startCleaner from './cleaner';

let instance;
function queueSystemFactory({ log }) {
  if (!instance) {
    instance = new BullRedisQueueSystem(log); // eslint-disable-line better-mutation/no-mutation
    if (process.env.NODE_ENV !== 'test') {
      startCleaner(instance, log);
    }
  }
  return instance;
}

const transportFactory = transportFactoryConfig({ queueSystemFactory });
transportFactory.type = 'bull'; // eslint-disable-line better-mutation/no-mutation

export { BullRedisQueueSystem, transportFactory as default, queueSystemFactory };
