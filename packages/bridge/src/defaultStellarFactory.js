import { configureStellar } from '@stellarjs/core';
import messagingFactoryConfig from '@stellarjs/messaging-queue';
import transportFactory from '@stellarjs/transport-redis';

let stellarFactory = null;
export default function connectToMicroservices(log) {
  if (!stellarFactory) {
    // eslint-disable-next-line better-mutation/no-mutation
    stellarFactory = configureStellar({ log, messagingAdaptorFactory: messagingFactoryConfig({ transportFactory }) });
  }

  return stellarFactory;
}
