import { configureStellar } from '@stellarjs/core';
import transportFactoryConfig from '@stellarjs/transport-queue';
import queueSystemFactory from '@stellarjs/queue-redis-bull';

let stellarFactory = null;
export default function connectToMicroservices(log) {
  if (!stellarFactory) {
    // eslint-disable-next-line better-mutation/no-mutation
    stellarFactory = configureStellar({ log, transportFactory: transportFactoryConfig({ queueSystemFactory }) });
  }

  return stellarFactory;
}
