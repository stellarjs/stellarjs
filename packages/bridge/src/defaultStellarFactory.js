import { configureStellar } from '@stellarjs/core';
import redisTransportFactory from '@stellarjs/transport-redis';

let stellarFactory = null;
export default function connectToMicroservices(log) {
  if (!stellarFactory) {
    // eslint-disable-next-line better-mutation/no-mutation
    stellarFactory = configureStellar({ log, transportFactory: redisTransportFactory });
  }

  return stellarFactory;
}
