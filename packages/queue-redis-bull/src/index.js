/**
 * Created by arolave on 06/10/2016.
 */
import BullRedisQueueSystem from './BullRedisQueueSystem';
import startCleaner from './cleaner';

let instance;
function transportFactory({ log }) {
  if (!instance) {
    instance = new BullRedisQueueSystem(log); // eslint-disable-line better-mutation/no-mutation
    startCleaner(instance, log);
  }
  return instance;
}
transportFactory.type = 'redis';


export { BullRedisQueueSystem, transportFactory as default };
